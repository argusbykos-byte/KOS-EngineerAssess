"""
Specialization Test API Routes

Endpoints for generating and managing specialization tests
that help identify candidates' exact sub-specialty within their focus area.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Set
from datetime import datetime
import asyncio
import secrets

from app.database import get_db
from app.models import (
    Candidate, Test, Question, Answer, Report,
    SpecializationResult, Application, SkillAssessment,
    get_focus_area_config, get_all_focus_areas, SPECIALIZATION_FOCUS_AREAS,
)
from app.models.test import TestStatus, TestType
from app.schemas.specialization import (
    GenerateSpecializationTestRequest,
    GenerateSpecializationTestResponse,
    SpecializationResultResponse,
    SpecializationTestListItem,
    SpecializationTestListResponse,
    FocusAreaInfo,
    SubSpecialtyScore,
    TeamBuilderResponse,
    TeamCompositionSuggestion,
)
from app.services.ai_service import ai_service, detect_programming_language

router = APIRouter()

# In-memory lock to prevent duplicate specialization test generation
_specialization_locks: Set[int] = set()  # Set of candidate_ids currently generating
_lock = asyncio.Lock()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def get_candidate_context(
    candidate_id: int,
    db: AsyncSession,
    parent_test_id: Optional[int] = None
) -> dict:
    """
    Get candidate's comprehensive context for specialization test generation.

    Fetches data from:
    - Candidate (name, resume, extracted skills)
    - Test (scores per category, AI analysis, strengths, improvements)
    - Application (motivation, admired_engineers, what_makes_unique, self_rating, role)
    - SkillAssessments (all self-assessed skills)

    Returns:
        dict with comprehensive candidate profile for specialization test generation
    """
    # Get candidate
    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        return {}

    context = {
        "candidate_name": candidate.name,
        "candidate_email": candidate.email,
        "resume_summary": "",
        "top_skills": [],
        "extracted_skills": [],
        "previous_score": None,
        "self_description": "",
        "track": candidate.track,
        "difficulty": candidate.difficulty,
        # Test performance data
        "test_scores": {},
        "test_ai_analysis": None,
        "test_strengths": [],
        "test_improvements": [],
        # Application data
        "motivation": None,
        "admired_engineers": None,
        "what_makes_unique": None,
        "self_rating": None,
        "role": None,
        "fit_score": None,
        "suggested_position": None,
        # Skill assessments
        "skill_assessments": [],
    }

    # Get resume text
    if candidate.resume_text:
        context["resume_summary"] = candidate.resume_text[:3000]

    # Get extracted skills
    if candidate.extracted_skills:
        context["extracted_skills"] = candidate.extracted_skills[:15]
        context["top_skills"] = candidate.extracted_skills[:15]

    # Get test data - either specific parent test or latest completed
    test_query = (
        select(Test)
        .options(selectinload(Test.report))
        .where(Test.candidate_id == candidate_id)
        .where(Test.status == "completed")
    )
    if parent_test_id:
        test_query = test_query.where(Test.id == parent_test_id)
    else:
        test_query = test_query.order_by(Test.created_at.desc())

    test_result = await db.execute(test_query)
    previous_test = test_result.scalar_one_or_none()

    if previous_test and previous_test.report:
        report = previous_test.report
        context["previous_score"] = report.overall_score
        context["previous_test_id"] = previous_test.id

        # Add category scores
        context["test_scores"] = {
            "overall": report.overall_score,
            "brain_teaser": report.brain_teaser_score,
            "coding": report.coding_score,
            "code_review": report.code_review_score,
            "system_design": report.system_design_score,
            "signal_processing": report.signal_processing_score,
        }

        # Add AI analysis and feedback
        context["test_ai_analysis"] = report.ai_summary
        context["test_strengths"] = report.strengths or []
        context["test_improvements"] = report.weaknesses or []

    # Get application data - try by candidate_id first, then by email
    app_result = await db.execute(
        select(Application)
        .options(selectinload(Application.skill_assessments))
        .where(Application.candidate_id == candidate_id)
    )
    application = app_result.scalar_one_or_none()

    # If not found by candidate_id, try by email
    if not application and candidate.email:
        app_result = await db.execute(
            select(Application)
            .options(selectinload(Application.skill_assessments))
            .where(Application.email == candidate.email)
        )
        application = app_result.scalar_one_or_none()

    if application:
        context["self_description"] = application.self_description or ""
        context["motivation"] = application.motivation
        context["admired_engineers"] = application.admired_engineers
        context["what_makes_unique"] = application.unique_trait
        context["self_rating"] = application.overall_self_rating
        context["role"] = application.self_description

        # Get fit score and suggested position from kimi_analysis
        if application.kimi_analysis:
            kimi = application.kimi_analysis
            context["fit_score"] = kimi.get("fit_score")
            context["suggested_position"] = kimi.get("best_position")

        # Get ALL skill assessments with ratings
        skill_assessments = []
        high_rated = []
        for skill in application.skill_assessments:
            skill_data = {
                "name": skill.skill_name,
                "category": skill.category,
                "self_rating": skill.self_rating,
            }
            skill_assessments.append(skill_data)
            if skill.self_rating and skill.self_rating >= 7:
                high_rated.append(skill)

        context["skill_assessments"] = skill_assessments

        # Update top_skills with self-rated skills if available
        if high_rated:
            high_rated_sorted = sorted(high_rated, key=lambda x: x.self_rating or 0, reverse=True)[:10]
            context["top_skills"] = [s.skill_name for s in high_rated_sorted]

    return context


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/focus-areas", response_model=List[FocusAreaInfo])
async def list_focus_areas():
    """
    List all available focus areas for specialization tests.
    """
    return [
        FocusAreaInfo(
            id=key,
            name=config["name"],
            description=config["description"],
            sub_specialties=config.get("sub_specialties", [])
        )
        for key, config in SPECIALIZATION_FOCUS_AREAS.items()
    ]


@router.post("/generate", response_model=GenerateSpecializationTestResponse)
async def generate_specialization_test(
    data: GenerateSpecializationTestRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a specialization test for a candidate.

    This creates a 1-hour deep-dive test that identifies the candidate's
    exact sub-specialty within their focus area.

    Uses Kimi2 to analyze:
    - Previous test results
    - Resume highlights
    - Self-assessed skills

    Then generates personalized questions to differentiate between sub-specialties.
    """
    candidate_id = data.candidate_id
    focus_area = data.focus_area
    duration_minutes = data.duration_minutes

    # Validate focus area
    focus_config = get_focus_area_config(focus_area)
    if not focus_config:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid focus area: {focus_area}. Use /specialization/focus-areas to see available options."
        )

    # Check lock
    async with _lock:
        if candidate_id in _specialization_locks:
            raise HTTPException(
                status_code=409,
                detail="Specialization test generation already in progress for this candidate."
            )
        _specialization_locks.add(candidate_id)

    try:
        # Get candidate
        result = await db.execute(
            select(Candidate).where(Candidate.id == candidate_id)
        )
        candidate = result.scalar_one_or_none()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        # Get comprehensive context for question generation
        context = await get_candidate_context(candidate_id, db, data.parent_test_id)

        print(f"[Specialization] Generating {focus_area} test for {candidate.name}")
        print(f"[Specialization] Context: previous_score={context.get('previous_score')}, skills={context.get('top_skills', [])[:5]}")
        print(f"[Specialization] Application data: fit_score={context.get('fit_score')}, motivation={bool(context.get('motivation'))}")

        # Generate specialization questions using AI with comprehensive context
        questions_data = await ai_service.generate_specialization_test_questions(
            focus_area=focus_area,
            sub_specialties=focus_config.get("sub_specialties", []),
            candidate_name=context.get("candidate_name", candidate.name),
            self_description=context.get("self_description", ""),
            top_skills=context.get("top_skills", []),
            previous_score=context.get("previous_score"),
            resume_summary=context.get("resume_summary", ""),
            # Additional context from test and application
            test_scores=context.get("test_scores", {}),
            test_strengths=context.get("test_strengths", []),
            test_improvements=context.get("test_improvements", []),
            motivation=context.get("motivation"),
            admired_engineers=context.get("admired_engineers"),
            what_makes_unique=context.get("what_makes_unique"),
            self_rating=context.get("self_rating"),
            fit_score=context.get("fit_score"),
            suggested_position=context.get("suggested_position"),
            skill_assessments=context.get("skill_assessments", []),
        )

        if not questions_data:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate specialization questions. Please try again."
            )

        # Create test record
        duration_hours = duration_minutes / 60
        test = Test(
            candidate_id=candidate_id,
            access_token=secrets.token_urlsafe(32),
            status=TestStatus.PENDING.value,
            duration_hours=int(duration_hours) or 1,
            test_type=TestType.SPECIALIZATION.value,
            specialization_focus=focus_area,
            parent_test_id=context.get("previous_test_id"),
            total_break_time_seconds=15 * 60,  # 15 min break for 1hr test
            used_break_time_seconds=0,
            break_count=0,
            break_history=[],
        )
        db.add(test)
        await db.flush()

        # Create Question records
        created_questions = []
        for q_order, q_data in enumerate(questions_data):
            question_text = q_data.get("question_text", "")
            question_code = q_data.get("question_code")

            if not question_text:
                continue

            # Detect language for code questions
            language = None
            if question_code:
                language = detect_programming_language(
                    text=question_text,
                    code=question_code,
                    category=focus_area
                )

            question = Question(
                test_id=test.id,
                category=f"specialization_{focus_area}",
                section_order=0,
                question_order=q_order,
                question_text=question_text,
                question_code=question_code,
                expected_answer=q_data.get("expected_answer"),
                hints=q_data.get("hints"),
                max_score=100,
                language=language,
            )
            db.add(question)
            created_questions.append(question)

        await db.flush()

        # Create Answer records
        for question in created_questions:
            answer = Answer(question_id=question.id)
            db.add(answer)

        # Create SpecializationResult record (to be populated after test completion)
        spec_result = SpecializationResult(
            test_id=test.id,
            candidate_id=candidate_id,
            focus_area=focus_area,
        )
        db.add(spec_result)

        await db.commit()

        print(f"[Specialization] Created test {test.id} with {len(created_questions)} questions")

        return GenerateSpecializationTestResponse(
            success=True,
            message=f"Specialization test generated for {focus_config['name']}",
            test_id=test.id,
            access_token=test.access_token,
            questions_generated=len(created_questions),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Specialization] Error generating test: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate specialization test: {str(e)}"
        )
    finally:
        async with _lock:
            _specialization_locks.discard(candidate_id)


@router.get("/{test_id}/results", response_model=SpecializationResultResponse)
async def get_specialization_results(
    test_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the specialization results for a completed test.

    Returns the candidate's identified primary specialty, sub-specialty scores,
    recommended tasks, and team fit analysis.
    """
    # Get specialization result
    result = await db.execute(
        select(SpecializationResult)
        .options(selectinload(SpecializationResult.test))
        .where(SpecializationResult.test_id == test_id)
    )
    spec_result = result.scalar_one_or_none()

    if not spec_result:
        raise HTTPException(status_code=404, detail="Specialization result not found")

    # Get candidate name
    candidate_result = await db.execute(
        select(Candidate).where(Candidate.id == spec_result.candidate_id)
    )
    candidate = candidate_result.scalar_one_or_none()

    # Parse sub_specialties
    sub_specialties = []
    if spec_result.sub_specialties:
        for ss in spec_result.sub_specialties:
            sub_specialties.append(SubSpecialtyScore(
                name=ss.get("name", ""),
                score=ss.get("score", 0),
                rank=ss.get("rank", 0),
                evidence=ss.get("evidence"),
            ))

    return SpecializationResultResponse(
        id=spec_result.id,
        test_id=spec_result.test_id,
        candidate_id=spec_result.candidate_id,
        candidate_name=candidate.name if candidate else None,
        focus_area=spec_result.focus_area,
        primary_specialty=spec_result.primary_specialty,
        specialty_score=spec_result.specialty_score,
        confidence=spec_result.confidence,
        sub_specialties=sub_specialties,
        recommended_tasks=spec_result.recommended_tasks or [],
        team_fit_analysis=spec_result.team_fit_analysis,
        created_at=spec_result.created_at,
    )


@router.post("/{test_id}/analyze")
async def analyze_specialization_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze a completed specialization test and determine the candidate's
    primary specialty and sub-specialty rankings.

    This should be called after the test is completed.
    """
    # Get test with questions and answers
    test_result = await db.execute(
        select(Test)
        .options(
            selectinload(Test.questions).selectinload(Question.answer),
            selectinload(Test.specialization_result),
            selectinload(Test.candidate),
        )
        .where(Test.id == test_id)
    )
    test = test_result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.test_type != TestType.SPECIALIZATION.value:
        raise HTTPException(status_code=400, detail="This is not a specialization test")

    if not test.specialization_result:
        raise HTTPException(status_code=404, detail="Specialization result record not found")

    # Score any unscored answers first
    unscored_count = 0
    for question in test.questions:
        if question.answer and question.answer.score is None:
            unscored_count += 1
            try:
                # Score the answer using AI
                print(f"[Specialization] Scoring unscored answer for question {question.id}")
                evaluation = await ai_service.evaluate_answer(
                    question_text=question.question_text,
                    question_code=question.question_code,
                    expected_answer=question.expected_answer,
                    candidate_answer=question.answer.candidate_answer,
                    candidate_code=question.answer.candidate_code,
                    max_score=question.max_score,
                    category=question.category,
                )
                if evaluation:
                    question.answer.score = evaluation.get("score", 0)
                    question.answer.feedback = evaluation.get("feedback", "")
                    question.answer.ai_evaluation = evaluation
            except Exception as e:
                print(f"[Specialization] Error scoring question {question.id}: {e}")
                # Continue with other questions even if one fails

    if unscored_count > 0:
        print(f"[Specialization] Scored {unscored_count} previously unscored answers")
        await db.commit()
        await db.refresh(test)

    # Collect answers (now with scores)
    question_answers = []
    for question in test.questions:
        if question.answer:
            question_answers.append({
                "question_text": question.question_text,
                "candidate_answer": question.answer.candidate_answer,
                "candidate_code": question.answer.candidate_code,
                "score": question.answer.score,
                "feedback": question.answer.feedback,
            })

    # Get focus area config
    focus_config = get_focus_area_config(test.specialization_focus)
    sub_specialties = focus_config.get("sub_specialties", []) if focus_config else []

    # Analyze with AI
    analysis = await ai_service.analyze_specialization_results(
        focus_area=test.specialization_focus,
        sub_specialties=sub_specialties,
        candidate_name=test.candidate.name if test.candidate else "Candidate",
        question_answers=question_answers,
    )

    if not analysis:
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze specialization results"
        )

    # Update specialization result
    spec_result = test.specialization_result
    spec_result.primary_specialty = analysis.get("primary_specialty")
    spec_result.specialty_score = analysis.get("specialty_score")
    spec_result.confidence = analysis.get("confidence")
    spec_result.sub_specialties = analysis.get("sub_specialties", [])
    spec_result.recommended_tasks = analysis.get("recommended_tasks", [])
    spec_result.team_fit_analysis = analysis.get("team_fit_analysis")
    spec_result.raw_analysis = analysis
    spec_result.updated_at = datetime.utcnow()

    await db.commit()

    return {
        "success": True,
        "message": "Specialization analysis complete",
        "primary_specialty": spec_result.primary_specialty,
        "specialty_score": spec_result.specialty_score,
    }


@router.get("/results", response_model=SpecializationTestListResponse)
async def list_specialization_results(
    focus_area: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    List all specialization test results with optional filtering by focus area.
    """
    # Base query
    query = (
        select(SpecializationResult)
        .options(selectinload(SpecializationResult.test))
    )

    if focus_area:
        query = query.where(SpecializationResult.focus_area == focus_area)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(SpecializationResult.created_at.desc())

    result = await db.execute(query)
    spec_results = result.scalars().all()

    # Get candidate names
    candidate_ids = [sr.candidate_id for sr in spec_results]
    if candidate_ids:
        candidates_result = await db.execute(
            select(Candidate).where(Candidate.id.in_(candidate_ids))
        )
        candidates = {c.id: c for c in candidates_result.scalars().all()}
    else:
        candidates = {}

    # Build response
    items = []
    for sr in spec_results:
        candidate = candidates.get(sr.candidate_id)
        items.append(SpecializationTestListItem(
            id=sr.id,
            test_id=sr.test_id,
            access_token=sr.test.access_token if sr.test else "",
            candidate_id=sr.candidate_id,
            candidate_name=candidate.name if candidate else "Unknown",
            focus_area=sr.focus_area,
            primary_specialty=sr.primary_specialty,
            specialty_score=sr.specialty_score,
            status=sr.test.status if sr.test else "unknown",
            created_at=sr.created_at,
        ))

    total_pages = (total + page_size - 1) // page_size

    return SpecializationTestListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/team-builder", response_model=TeamBuilderResponse)
async def get_team_builder_data(
    focus_area: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get data for team builder view.

    Returns all candidates with specialization results, grouped by focus area,
    along with AI-generated team composition suggestions.
    """
    # Get all specialization results with completed tests
    query = (
        select(SpecializationResult)
        .options(selectinload(SpecializationResult.test))
        .where(SpecializationResult.primary_specialty.isnot(None))
    )

    if focus_area:
        query = query.where(SpecializationResult.focus_area == focus_area)

    result = await db.execute(query)
    spec_results = result.scalars().all()

    # Get candidate info
    candidate_ids = [sr.candidate_id for sr in spec_results]
    if candidate_ids:
        candidates_result = await db.execute(
            select(Candidate).where(Candidate.id.in_(candidate_ids))
        )
        candidates = {c.id: c for c in candidates_result.scalars().all()}
    else:
        candidates = {}

    # Build response
    candidate_responses = []
    focus_area_groups = {}

    for sr in spec_results:
        candidate = candidates.get(sr.candidate_id)

        # Parse sub_specialties
        sub_specialties = []
        if sr.sub_specialties:
            for ss in sr.sub_specialties:
                sub_specialties.append(SubSpecialtyScore(
                    name=ss.get("name", ""),
                    score=ss.get("score", 0),
                    rank=ss.get("rank", 0),
                    evidence=ss.get("evidence"),
                ))

        candidate_responses.append(SpecializationResultResponse(
            id=sr.id,
            test_id=sr.test_id,
            candidate_id=sr.candidate_id,
            candidate_name=candidate.name if candidate else None,
            focus_area=sr.focus_area,
            primary_specialty=sr.primary_specialty,
            specialty_score=sr.specialty_score,
            confidence=sr.confidence,
            sub_specialties=sub_specialties,
            recommended_tasks=sr.recommended_tasks or [],
            team_fit_analysis=sr.team_fit_analysis,
            created_at=sr.created_at,
        ))

        # Group by focus area
        if sr.focus_area not in focus_area_groups:
            focus_area_groups[sr.focus_area] = []
        focus_area_groups[sr.focus_area].append(sr.candidate_id)

    # Generate composition suggestions (simplified version)
    composition_suggestions = []
    for sr in spec_results[:10]:  # Limit suggestions
        candidate = candidates.get(sr.candidate_id)
        if candidate and sr.primary_specialty:
            composition_suggestions.append(TeamCompositionSuggestion(
                candidate_id=sr.candidate_id,
                candidate_name=candidate.name,
                primary_specialty=sr.primary_specialty,
                recommended_role=f"{sr.focus_area.upper()} Specialist",
                team_fit_notes=sr.team_fit_analysis or "Good team fit based on specialization.",
                synergy_with=[],
            ))

    return TeamBuilderResponse(
        candidates=candidate_responses,
        composition_suggestions=composition_suggestions,
        focus_area_groups=focus_area_groups,
    )


@router.get("/candidate/{candidate_id}", response_model=List[SpecializationResultResponse])
async def get_candidate_specializations(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all specialization results for a specific candidate.
    """
    # Get candidate
    candidate_result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id)
    )
    candidate = candidate_result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get specialization results
    result = await db.execute(
        select(SpecializationResult)
        .where(SpecializationResult.candidate_id == candidate_id)
        .order_by(SpecializationResult.created_at.desc())
    )
    spec_results = result.scalars().all()

    responses = []
    for sr in spec_results:
        # Parse sub_specialties
        sub_specialties = []
        if sr.sub_specialties:
            for ss in sr.sub_specialties:
                sub_specialties.append(SubSpecialtyScore(
                    name=ss.get("name", ""),
                    score=ss.get("score", 0),
                    rank=ss.get("rank", 0),
                    evidence=ss.get("evidence"),
                ))

        responses.append(SpecializationResultResponse(
            id=sr.id,
            test_id=sr.test_id,
            candidate_id=sr.candidate_id,
            candidate_name=candidate.name,
            focus_area=sr.focus_area,
            primary_specialty=sr.primary_specialty,
            specialty_score=sr.specialty_score,
            confidence=sr.confidence,
            sub_specialties=sub_specialties,
            recommended_tasks=sr.recommended_tasks or [],
            team_fit_analysis=sr.team_fit_analysis,
            created_at=sr.created_at,
        ))

    return responses
