from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime
import secrets
import statistics

from app.database import get_db
from app.models import Candidate, Test, Question, Answer
from app.models.competition import Competition, CompetitionRegistration, BehavioralMetrics, CompetitionStatus
from app.models.test import TestStatus
from app.schemas.competition import (
    CompetitionCreate, CompetitionUpdate, CompetitionResponse, CompetitionDetail,
    RegistrationCreate, RegistrationResponse, RegistrationWithToken,
    ScreeningTestResponse, ScreeningSubmission, ScreeningResult,
    BehavioralMetricsResponse, RankingEntry, RankingsResponse, QualifyResponse,
    RegistrationSummary
)
from app.services.ai_service import ai_service, detect_programming_language

router = APIRouter()


# ============== Competition CRUD Endpoints ==============

@router.post("", response_model=CompetitionResponse)
async def create_competition(
    competition_data: CompetitionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new competition (admin only)."""
    competition = Competition(
        name=competition_data.name,
        description=competition_data.description,
        screening_start_date=competition_data.screening_start_date,
        screening_deadline=competition_data.screening_deadline,
        live_competition_date=competition_data.live_competition_date,
        max_participants=competition_data.max_participants,
        qualified_count=competition_data.qualified_count,
        test_duration_minutes=competition_data.test_duration_minutes,
        questions_count=competition_data.questions_count,
        status=CompetitionStatus.REGISTRATION_OPEN.value
    )
    db.add(competition)
    await db.commit()
    await db.refresh(competition)

    return CompetitionResponse(
        id=competition.id,
        name=competition.name,
        description=competition.description,
        screening_start_date=competition.screening_start_date,
        screening_deadline=competition.screening_deadline,
        live_competition_date=competition.live_competition_date,
        max_participants=competition.max_participants,
        qualified_count=competition.qualified_count,
        status=competition.status,
        test_duration_minutes=competition.test_duration_minutes,
        questions_count=competition.questions_count,
        passing_percentile=competition.passing_percentile,
        created_at=competition.created_at,
        updated_at=competition.updated_at,
        registration_count=0,
        completed_count=0
    )


@router.get("", response_model=List[CompetitionResponse])
async def list_competitions(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all competitions."""
    query = select(Competition).offset(skip).limit(limit).order_by(Competition.created_at.desc())
    if status:
        query = query.where(Competition.status == status)

    result = await db.execute(query)
    competitions = result.scalars().all()

    response = []
    for comp in competitions:
        # Count registrations
        reg_count = await db.execute(
            select(func.count(CompetitionRegistration.id))
            .where(CompetitionRegistration.competition_id == comp.id)
        )
        registration_count = reg_count.scalar() or 0

        # Count completed screenings
        completed_count_result = await db.execute(
            select(func.count(CompetitionRegistration.id))
            .where(
                CompetitionRegistration.competition_id == comp.id,
                CompetitionRegistration.screening_completed == True
            )
        )
        completed_count = completed_count_result.scalar() or 0

        response.append(CompetitionResponse(
            id=comp.id,
            name=comp.name,
            description=comp.description,
            screening_start_date=comp.screening_start_date,
            screening_deadline=comp.screening_deadline,
            live_competition_date=comp.live_competition_date,
            max_participants=comp.max_participants,
            qualified_count=comp.qualified_count,
            status=comp.status,
            test_duration_minutes=comp.test_duration_minutes,
            questions_count=comp.questions_count,
            passing_percentile=comp.passing_percentile,
            created_at=comp.created_at,
            updated_at=comp.updated_at,
            registration_count=registration_count,
            completed_count=completed_count
        ))

    return response


@router.get("/{competition_id}", response_model=CompetitionDetail)
async def get_competition(competition_id: int, db: AsyncSession = Depends(get_db)):
    """Get competition details with registrations summary."""
    query = (
        select(Competition)
        .options(
            selectinload(Competition.registrations)
            .selectinload(CompetitionRegistration.candidate)
        )
        .where(Competition.id == competition_id)
    )
    result = await db.execute(query)
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Build registrations summary
    registrations = []
    for reg in competition.registrations:
        registrations.append(RegistrationSummary(
            id=reg.id,
            candidate_id=reg.candidate_id,
            candidate_name=reg.candidate.name if reg.candidate else "Unknown",
            candidate_email=reg.candidate.email if reg.candidate else "",
            registered_at=reg.registered_at,
            screening_completed=reg.screening_completed,
            screening_score=reg.screening_score,
            is_qualified=reg.is_qualified,
            qualification_rank=reg.qualification_rank
        ))

    # Count stats
    registration_count = len(registrations)
    completed_count = sum(1 for r in registrations if r.screening_completed)

    return CompetitionDetail(
        id=competition.id,
        name=competition.name,
        description=competition.description,
        screening_start_date=competition.screening_start_date,
        screening_deadline=competition.screening_deadline,
        live_competition_date=competition.live_competition_date,
        max_participants=competition.max_participants,
        qualified_count=competition.qualified_count,
        status=competition.status,
        test_duration_minutes=competition.test_duration_minutes,
        questions_count=competition.questions_count,
        passing_percentile=competition.passing_percentile,
        created_at=competition.created_at,
        updated_at=competition.updated_at,
        registration_count=registration_count,
        completed_count=completed_count,
        registrations=registrations
    )


@router.put("/{competition_id}", response_model=CompetitionResponse)
async def update_competition(
    competition_id: int,
    update: CompetitionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update competition settings (admin only)."""
    result = await db.execute(select(Competition).where(Competition.id == competition_id))
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(competition, field, value)

    await db.commit()
    await db.refresh(competition)

    # Get counts
    reg_count = await db.execute(
        select(func.count(CompetitionRegistration.id))
        .where(CompetitionRegistration.competition_id == competition.id)
    )
    registration_count = reg_count.scalar() or 0

    completed_count_result = await db.execute(
        select(func.count(CompetitionRegistration.id))
        .where(
            CompetitionRegistration.competition_id == competition.id,
            CompetitionRegistration.screening_completed == True
        )
    )
    completed_count = completed_count_result.scalar() or 0

    return CompetitionResponse(
        id=competition.id,
        name=competition.name,
        description=competition.description,
        screening_start_date=competition.screening_start_date,
        screening_deadline=competition.screening_deadline,
        live_competition_date=competition.live_competition_date,
        max_participants=competition.max_participants,
        qualified_count=competition.qualified_count,
        status=competition.status,
        test_duration_minutes=competition.test_duration_minutes,
        questions_count=competition.questions_count,
        passing_percentile=competition.passing_percentile,
        created_at=competition.created_at,
        updated_at=competition.updated_at,
        registration_count=registration_count,
        completed_count=completed_count
    )


# ============== Public Registration Endpoints ==============

@router.post("/{competition_id}/register", response_model=RegistrationWithToken)
async def register_for_competition(
    competition_id: int,
    registration: RegistrationCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register an engineer for a competition (public endpoint)."""
    # Get competition
    result = await db.execute(select(Competition).where(Competition.id == competition_id))
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Check if registration is open
    if competition.status not in [CompetitionStatus.REGISTRATION_OPEN.value, CompetitionStatus.SCREENING_ACTIVE.value]:
        raise HTTPException(status_code=400, detail="Registration is not open for this competition")

    # Check max participants
    reg_count = await db.execute(
        select(func.count(CompetitionRegistration.id))
        .where(CompetitionRegistration.competition_id == competition_id)
    )
    current_count = reg_count.scalar() or 0
    if current_count >= competition.max_participants:
        raise HTTPException(status_code=400, detail="Competition has reached maximum participants")

    # Check if email already registered for this competition
    existing_candidate = await db.execute(
        select(Candidate).where(Candidate.email == registration.email)
    )
    candidate = existing_candidate.scalar_one_or_none()

    if candidate:
        # Check if already registered for this competition
        existing_reg = await db.execute(
            select(CompetitionRegistration).where(
                CompetitionRegistration.competition_id == competition_id,
                CompetitionRegistration.candidate_id == candidate.id
            )
        )
        if existing_reg.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered for this competition")
    else:
        # Create new candidate
        candidate = Candidate(
            name=registration.name,
            email=registration.email,
            test_duration_hours=competition.test_duration_minutes // 60 or 1,
            categories=["general_engineering", "brain_teaser"],
            difficulty="mid"
        )
        db.add(candidate)
        await db.flush()

    # Generate unique registration token
    registration_token = secrets.token_urlsafe(32)

    # Create registration
    comp_registration = CompetitionRegistration(
        competition_id=competition_id,
        candidate_id=candidate.id,
        registration_token=registration_token
    )
    db.add(comp_registration)
    await db.commit()
    await db.refresh(comp_registration)

    return RegistrationWithToken(
        registration_id=comp_registration.id,
        registration_token=registration_token,
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        candidate_email=candidate.email,
        competition_name=competition.name,
        screening_start_date=competition.screening_start_date,
        screening_deadline=competition.screening_deadline
    )


# ============== Screening Test Endpoints ==============

@router.get("/{competition_id}/screening/{token}", response_model=ScreeningTestResponse)
async def get_screening_test(
    competition_id: int,
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Get screening test for a registered candidate."""
    # Find registration
    query = (
        select(CompetitionRegistration)
        .options(
            selectinload(CompetitionRegistration.competition),
            selectinload(CompetitionRegistration.candidate),
            selectinload(CompetitionRegistration.test)
            .selectinload(Test.questions)
            .selectinload(Question.answer)
        )
        .where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.registration_token == token
        )
    )
    result = await db.execute(query)
    registration = result.scalar_one_or_none()

    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")

    competition = registration.competition
    candidate = registration.candidate

    # Check if screening is active
    if competition.status not in [CompetitionStatus.SCREENING_ACTIVE.value, CompetitionStatus.REGISTRATION_OPEN.value]:
        raise HTTPException(status_code=400, detail="Screening is not currently active")

    # Check deadline
    if competition.screening_deadline and datetime.utcnow() > competition.screening_deadline:
        raise HTTPException(status_code=400, detail="Screening deadline has passed")

    # If already completed, return completion status
    if registration.screening_completed:
        return ScreeningTestResponse(
            registration_id=registration.id,
            competition_name=competition.name,
            candidate_name=candidate.name,
            test_duration_minutes=competition.test_duration_minutes,
            questions_count=competition.questions_count,
            screening_deadline=competition.screening_deadline,
            screening_started=True,
            screening_completed=True,
            test_id=registration.test_id,
            test_status="completed",
            test_access_token=registration.test.access_token if registration.test else None
        )

    # If test exists and is in progress, return test data
    if registration.test:
        test = registration.test
        time_remaining = None

        if test.status == TestStatus.IN_PROGRESS.value and test.start_time:
            from datetime import timedelta
            end_time = test.start_time + timedelta(minutes=competition.test_duration_minutes)
            remaining = end_time - datetime.utcnow()
            time_remaining = max(0, int(remaining.total_seconds()))

            # Check if expired
            if time_remaining <= 0:
                test.status = TestStatus.EXPIRED.value
                registration.screening_completed = True
                registration.screening_completed_at = datetime.utcnow()
                await db.commit()

        # Build questions by section
        questions_by_section = {}
        for question in test.questions:
            if question.category not in questions_by_section:
                questions_by_section[question.category] = []

            is_answered = bool(question.answer and question.answer.is_submitted)
            draft_answer = None
            draft_code = None
            if question.answer and not question.answer.is_submitted:
                draft_answer = question.answer.candidate_answer
                draft_code = question.answer.candidate_code

            questions_by_section[question.category].append({
                "id": question.id,
                "category": question.category,
                "question_order": question.question_order,
                "question_text": question.question_text,
                "question_code": question.question_code,
                "max_score": question.max_score,
                "is_answered": is_answered,
                "draft_answer": draft_answer,
                "draft_code": draft_code,
                "language": question.language
            })

        # Sort questions within each section
        for category in questions_by_section:
            questions_by_section[category].sort(key=lambda x: x["question_order"])

        return ScreeningTestResponse(
            registration_id=registration.id,
            competition_name=competition.name,
            candidate_name=candidate.name,
            test_duration_minutes=competition.test_duration_minutes,
            questions_count=competition.questions_count,
            screening_deadline=competition.screening_deadline,
            screening_started=test.status != TestStatus.PENDING.value,
            screening_completed=False,
            test_id=test.id,
            test_status=test.status,
            test_access_token=test.access_token,
            time_remaining_seconds=time_remaining,
            questions_by_section=questions_by_section
        )

    # No test yet - create one
    test = await _create_screening_test(db, registration, competition, candidate)

    return ScreeningTestResponse(
        registration_id=registration.id,
        competition_name=competition.name,
        candidate_name=candidate.name,
        test_duration_minutes=competition.test_duration_minutes,
        questions_count=competition.questions_count,
        screening_deadline=competition.screening_deadline,
        screening_started=False,
        screening_completed=False,
        test_id=test.id,
        test_status=test.status,
        test_access_token=test.access_token
    )


async def _create_screening_test(
    db: AsyncSession,
    registration: CompetitionRegistration,
    competition: Competition,
    candidate: Candidate
) -> Test:
    """Create a screening test for a competition registration."""
    access_token = secrets.token_urlsafe(32)

    # Calculate break time (shorter for 1-hour test)
    total_break = 5 * 60  # 5 minutes for 1-hour test
    max_single_break = 5 * 60

    test = Test(
        candidate_id=candidate.id,
        access_token=access_token,
        duration_hours=competition.test_duration_minutes / 60,
        status=TestStatus.PENDING.value,
        total_break_time_seconds=total_break,
        used_break_time_seconds=0,
        break_count=0,
        break_history=[]
    )
    db.add(test)
    await db.flush()

    # Link test to registration
    registration.test_id = test.id

    # Generate screening questions using AI
    # For screening, we use a mix of brain teasers and general engineering
    sections = ["brain_teaser", "general_engineering", "coding"]

    questions_data = await ai_service.generate_test_questions(
        categories=sections,
        difficulty="mid",
        skills=candidate.extracted_skills or [],
        resume_text=candidate.resume_text
    )
    # Note: generate_test_questions returns ~3-4 questions per category
    # We limit to competition.questions_count when creating questions below

    # Create questions
    created_questions = []
    question_count = 0
    for section_order, category in enumerate(sections):
        category_questions = questions_data.get(category, [])
        for q_order, q_data in enumerate(category_questions):
            if question_count >= competition.questions_count:
                break

            question_text = q_data.get("question_text", "")
            question_code = q_data.get("question_code")

            language = None
            if category in ["coding", "code_review"]:
                language = detect_programming_language(
                    text=question_text,
                    code=question_code,
                    category=category
                )

            question = Question(
                test_id=test.id,
                category=category,
                section_order=section_order,
                question_order=q_order,
                question_text=question_text,
                question_code=question_code,
                expected_answer=q_data.get("expected_answer"),
                hints=q_data.get("hints"),
                max_score=100,
                language=language
            )
            db.add(question)
            created_questions.append(question)
            question_count += 1

        if question_count >= competition.questions_count:
            break

    await db.flush()

    # Create answer records
    for question in created_questions:
        answer = Answer(question_id=question.id)
        db.add(answer)

    # Create behavioral metrics record
    behavioral_metrics = BehavioralMetrics(
        registration_id=registration.id,
        test_id=test.id
    )
    db.add(behavioral_metrics)

    await db.commit()
    await db.refresh(test)

    return test


@router.post("/{competition_id}/screening/{token}/start")
async def start_screening_test(
    competition_id: int,
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Start the screening test."""
    # Find registration with test
    query = (
        select(CompetitionRegistration)
        .options(
            selectinload(CompetitionRegistration.test),
            selectinload(CompetitionRegistration.competition)
        )
        .where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.registration_token == token
        )
    )
    result = await db.execute(query)
    registration = result.scalar_one_or_none()

    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")

    if not registration.test:
        raise HTTPException(status_code=400, detail="No test created yet. Please access the screening page first.")

    test = registration.test
    if test.status != TestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Test already started or completed")

    # Start the test
    test.status = TestStatus.IN_PROGRESS.value
    test.start_time = datetime.utcnow()
    test.current_section = "brain_teaser"

    registration.screening_started_at = datetime.utcnow()

    await db.commit()

    return {
        "success": True,
        "message": "Screening test started",
        "test_id": test.id,
        "start_time": test.start_time.isoformat(),
        "duration_minutes": registration.competition.test_duration_minutes
    }


@router.post("/{competition_id}/screening/{token}/submit", response_model=ScreeningResult)
async def submit_screening_test(
    competition_id: int,
    token: str,
    submission: ScreeningSubmission,
    db: AsyncSession = Depends(get_db)
):
    """Submit completed screening test with answers and timing data."""
    # Find registration with test and questions
    query = (
        select(CompetitionRegistration)
        .options(
            selectinload(CompetitionRegistration.competition),
            selectinload(CompetitionRegistration.candidate),
            selectinload(CompetitionRegistration.test)
            .selectinload(Test.questions)
            .selectinload(Question.answer),
            selectinload(CompetitionRegistration.behavioral_metrics)
        )
        .where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.registration_token == token
        )
    )
    result = await db.execute(query)
    registration = result.scalar_one_or_none()

    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")

    if registration.screening_completed:
        # Return existing result
        return ScreeningResult(
            registration_id=registration.id,
            competition_name=registration.competition.name,
            candidate_name=registration.candidate.name,
            screening_completed=True,
            screening_score=registration.screening_score,
            screening_percentile=registration.screening_percentile,
            is_qualified=registration.is_qualified,
            qualification_rank=registration.qualification_rank,
            total_questions=len(registration.test.questions) if registration.test else 0,
            questions_answered=sum(1 for q in registration.test.questions if q.answer and q.answer.is_submitted) if registration.test else 0
        )

    test = registration.test
    if not test:
        raise HTTPException(status_code=400, detail="No test found")

    # Process answers
    question_map = {q.id: q for q in test.questions}
    total_score = 0
    questions_answered = 0
    time_per_question_data = []

    for answer_data in submission.answers:
        question = question_map.get(answer_data.question_id)
        if not question or not question.answer:
            continue

        answer = question.answer
        answer.candidate_answer = answer_data.candidate_answer
        answer.candidate_code = answer_data.candidate_code
        answer.time_spent_seconds = answer_data.time_spent_seconds
        answer.is_submitted = True
        answer.submitted_at = datetime.utcnow()

        # Flag suspiciously fast answers (< 30 seconds on complex questions)
        if answer_data.time_spent_seconds < 30 and question.category in ["coding", "system_design"]:
            answer.is_suspiciously_fast = True

        # Evaluate answer using AI
        try:
            evaluation = await ai_service.evaluate_answer(
                question_text=question.question_text,
                question_code=question.question_code,
                expected_answer=question.expected_answer or "",
                candidate_answer=answer.candidate_answer or "",
                candidate_code=answer.candidate_code,
                category=question.category,
                difficulty="mid"
            )
            answer.score = evaluation.get("score", 50)
            answer.feedback = evaluation.get("feedback", "")
            answer.ai_evaluation = str(evaluation)
            answer.evaluated_at = datetime.utcnow()
        except Exception:
            answer.score = 50  # Default score if AI fails

        total_score += answer.score
        questions_answered += 1

    # Process timing data for behavioral metrics
    for timing in submission.time_per_question:
        time_per_question_data.append({
            "question_id": timing.question_id,
            "time_seconds": timing.time_seconds,
            "question_category": timing.question_category
        })

    # Calculate behavioral metrics
    behavioral_metrics = registration.behavioral_metrics
    if behavioral_metrics:
        behavioral_metrics = await _calculate_behavioral_metrics(
            behavioral_metrics,
            time_per_question_data,
            test
        )

    # Calculate final score (0-100)
    final_score = total_score / questions_answered if questions_answered > 0 else 0

    # Update registration
    registration.screening_completed = True
    registration.screening_completed_at = datetime.utcnow()
    registration.screening_score = final_score

    # Mark test as completed
    test.status = TestStatus.COMPLETED.value
    test.end_time = datetime.utcnow()

    await db.commit()
    await db.refresh(registration)

    # Build behavioral metrics response
    behavioral_response = None
    if behavioral_metrics:
        behavioral_response = BehavioralMetricsResponse(
            id=behavioral_metrics.id,
            registration_id=behavioral_metrics.registration_id,
            time_per_question=behavioral_metrics.time_per_question or [],
            average_response_time=behavioral_metrics.average_response_time,
            fastest_response=behavioral_metrics.fastest_response,
            slowest_response=behavioral_metrics.slowest_response,
            median_response_time=behavioral_metrics.median_response_time,
            suspiciously_fast_count=behavioral_metrics.suspiciously_fast_count,
            suspiciously_slow_count=behavioral_metrics.suspiciously_slow_count,
            consistency_score=behavioral_metrics.consistency_score,
            anomaly_flags=behavioral_metrics.anomaly_flags or [],
            risk_score=behavioral_metrics.risk_score,
            risk_factors=behavioral_metrics.risk_factors or []
        )

    return ScreeningResult(
        registration_id=registration.id,
        competition_name=registration.competition.name,
        candidate_name=registration.candidate.name,
        screening_completed=True,
        screening_score=final_score,
        screening_percentile=None,  # Calculated after screening closes
        is_qualified=None,  # Determined after ranking
        total_questions=len(test.questions),
        questions_answered=questions_answered,
        behavioral_metrics=behavioral_response
    )


async def _calculate_behavioral_metrics(
    metrics: BehavioralMetrics,
    time_per_question: list,
    test: Test
) -> BehavioralMetrics:
    """Calculate behavioral metrics from timing data."""
    metrics.time_per_question = time_per_question

    times = [t["time_seconds"] for t in time_per_question if t["time_seconds"] > 0]

    if times:
        metrics.average_response_time = sum(times) / len(times)
        metrics.fastest_response = min(times)
        metrics.slowest_response = max(times)
        metrics.median_response_time = statistics.median(times)

        if len(times) > 1:
            metrics.std_dev_response_time = statistics.stdev(times)

        # Count suspicious responses
        suspiciously_fast = 0
        suspiciously_slow = 0
        anomaly_flags = []
        risk_factors = []

        for t in time_per_question:
            time_sec = t["time_seconds"]
            category = t.get("question_category", "")
            question_id = t["question_id"]

            # Flag answers < 30 seconds on complex questions
            if time_sec < 30 and category in ["coding", "system_design", "code_review"]:
                suspiciously_fast += 1
                anomaly_flags.append({
                    "type": "suspiciously_fast",
                    "question_id": question_id,
                    "time_seconds": time_sec,
                    "description": f"Answered {category} question in {time_sec}s",
                    "severity": "high"
                })

            # Flag answers > 10 minutes
            if time_sec > 600:
                suspiciously_slow += 1
                anomaly_flags.append({
                    "type": "suspiciously_slow",
                    "question_id": question_id,
                    "time_seconds": time_sec,
                    "description": f"Took {time_sec // 60} minutes on question",
                    "severity": "low"
                })

        metrics.suspiciously_fast_count = suspiciously_fast
        metrics.suspiciously_slow_count = suspiciously_slow
        metrics.anomaly_flags = anomaly_flags

        # Calculate consistency score (based on standard deviation)
        if metrics.std_dev_response_time and metrics.average_response_time:
            cv = metrics.std_dev_response_time / metrics.average_response_time  # Coefficient of variation
            # Lower CV = more consistent. Score from 0-100
            metrics.consistency_score = max(0, 100 - (cv * 50))
        else:
            metrics.consistency_score = 100

        # Calculate risk score
        risk_score = 0
        if suspiciously_fast > 0:
            risk_factors.append(f"{suspiciously_fast} suspiciously fast answers")
            risk_score += suspiciously_fast * 15

        # Check anti-cheat violations from test
        if test.tab_switch_count and test.tab_switch_count > 5:
            risk_factors.append(f"{test.tab_switch_count} tab switches")
            risk_score += test.tab_switch_count * 2

        if test.paste_attempt_count and test.paste_attempt_count > 0:
            risk_factors.append(f"{test.paste_attempt_count} paste attempts")
            risk_score += test.paste_attempt_count * 5

        if test.dev_tools_open_count and test.dev_tools_open_count > 0:
            risk_factors.append(f"Dev tools opened {test.dev_tools_open_count} times")
            risk_score += test.dev_tools_open_count * 10

        if metrics.consistency_score < 50:
            risk_factors.append("Inconsistent response times")
            risk_score += 10

        metrics.risk_score = min(100, risk_score)
        metrics.risk_factors = risk_factors

    return metrics


# ============== Results Endpoints ==============

@router.get("/{competition_id}/results/{token}", response_model=ScreeningResult)
async def get_screening_results(
    competition_id: int,
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Get screening results for a candidate."""
    query = (
        select(CompetitionRegistration)
        .options(
            selectinload(CompetitionRegistration.competition),
            selectinload(CompetitionRegistration.candidate),
            selectinload(CompetitionRegistration.test)
            .selectinload(Test.questions)
            .selectinload(Question.answer),
            selectinload(CompetitionRegistration.behavioral_metrics)
        )
        .where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.registration_token == token
        )
    )
    result = await db.execute(query)
    registration = result.scalar_one_or_none()

    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")

    behavioral_response = None
    if registration.behavioral_metrics:
        bm = registration.behavioral_metrics
        behavioral_response = BehavioralMetricsResponse(
            id=bm.id,
            registration_id=bm.registration_id,
            time_per_question=bm.time_per_question or [],
            average_response_time=bm.average_response_time,
            fastest_response=bm.fastest_response,
            slowest_response=bm.slowest_response,
            median_response_time=bm.median_response_time,
            suspiciously_fast_count=bm.suspiciously_fast_count,
            suspiciously_slow_count=bm.suspiciously_slow_count,
            consistency_score=bm.consistency_score,
            anomaly_flags=bm.anomaly_flags or [],
            risk_score=bm.risk_score,
            risk_factors=bm.risk_factors or []
        )

    questions_answered = 0
    total_questions = 0
    if registration.test:
        total_questions = len(registration.test.questions)
        questions_answered = sum(
            1 for q in registration.test.questions
            if q.answer and q.answer.is_submitted
        )

    return ScreeningResult(
        registration_id=registration.id,
        competition_name=registration.competition.name,
        candidate_name=registration.candidate.name,
        screening_completed=registration.screening_completed,
        screening_score=registration.screening_score,
        screening_percentile=registration.screening_percentile,
        is_qualified=registration.is_qualified,
        qualification_rank=registration.qualification_rank,
        total_questions=total_questions,
        questions_answered=questions_answered,
        behavioral_metrics=behavioral_response
    )


# ============== Admin Rankings Endpoints ==============

@router.get("/{competition_id}/rankings", response_model=RankingsResponse)
async def get_rankings(
    competition_id: int,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get competition rankings (admin only)."""
    # Get competition
    result = await db.execute(select(Competition).where(Competition.id == competition_id))
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Get all completed registrations with scores
    query = (
        select(CompetitionRegistration)
        .options(
            selectinload(CompetitionRegistration.candidate),
            selectinload(CompetitionRegistration.behavioral_metrics)
        )
        .where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.screening_completed == True
        )
        .order_by(CompetitionRegistration.screening_score.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    registrations = result.scalars().all()

    # Count totals
    total_reg = await db.execute(
        select(func.count(CompetitionRegistration.id))
        .where(CompetitionRegistration.competition_id == competition_id)
    )
    total_registrations = total_reg.scalar() or 0

    completed_count = await db.execute(
        select(func.count(CompetitionRegistration.id))
        .where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.screening_completed == True
        )
    )
    completed_screenings = completed_count.scalar() or 0

    qualified_count_result = await db.execute(
        select(func.count(CompetitionRegistration.id))
        .where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.is_qualified == True
        )
    )
    qualified_count = qualified_count_result.scalar() or 0

    # Build rankings
    rankings = []
    for idx, reg in enumerate(registrations, start=skip + 1):
        risk_score = 0
        consistency_score = 100
        if reg.behavioral_metrics:
            risk_score = reg.behavioral_metrics.risk_score or 0
            consistency_score = reg.behavioral_metrics.consistency_score or 100

        rankings.append(RankingEntry(
            rank=idx,
            registration_id=reg.id,
            candidate_id=reg.candidate_id,
            candidate_name=reg.candidate.name if reg.candidate else "Unknown",
            candidate_email=reg.candidate.email if reg.candidate else "",
            screening_score=reg.screening_score or 0,
            screening_completed_at=reg.screening_completed_at,
            is_qualified=reg.is_qualified,
            risk_score=risk_score,
            consistency_score=consistency_score
        ))

    # Calculate cutoff score if enough completed
    cutoff_score = None
    if completed_screenings >= competition.qualified_count:
        # Get the score at qualified_count position
        cutoff_query = (
            select(CompetitionRegistration.screening_score)
            .where(
                CompetitionRegistration.competition_id == competition_id,
                CompetitionRegistration.screening_completed == True
            )
            .order_by(CompetitionRegistration.screening_score.desc())
            .offset(competition.qualified_count - 1)
            .limit(1)
        )
        cutoff_result = await db.execute(cutoff_query)
        cutoff_score = cutoff_result.scalar()

    return RankingsResponse(
        competition_id=competition_id,
        competition_name=competition.name,
        total_registrations=total_registrations,
        completed_screenings=completed_screenings,
        qualified_count=qualified_count,
        rankings=rankings,
        cutoff_score=cutoff_score
    )


@router.post("/{competition_id}/qualify", response_model=QualifyResponse)
async def qualify_top_candidates(
    competition_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Mark top N candidates as qualified (admin only)."""
    # Get competition
    result = await db.execute(select(Competition).where(Competition.id == competition_id))
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Get top N completed registrations by score
    query = (
        select(CompetitionRegistration)
        .where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.screening_completed == True
        )
        .order_by(CompetitionRegistration.screening_score.desc())
        .limit(competition.qualified_count)
    )
    result = await db.execute(query)
    top_registrations = result.scalars().all()

    if not top_registrations:
        raise HTTPException(status_code=400, detail="No completed screenings to qualify")

    # Mark as qualified and assign ranks
    cutoff_score = 0
    now = datetime.utcnow()

    for rank, reg in enumerate(top_registrations, start=1):
        reg.is_qualified = True
        reg.qualified_at = now
        reg.qualification_rank = rank
        if rank == len(top_registrations):
            cutoff_score = reg.screening_score or 0

    # Calculate percentiles for all completed registrations
    all_completed = await db.execute(
        select(CompetitionRegistration)
        .where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.screening_completed == True
        )
        .order_by(CompetitionRegistration.screening_score.desc())
    )
    all_regs = all_completed.scalars().all()
    total = len(all_regs)

    for idx, reg in enumerate(all_regs):
        # Percentile = (number of people you beat) / (total - 1) * 100
        percentile = ((total - idx - 1) / (total - 1) * 100) if total > 1 else 100
        reg.screening_percentile = round(percentile, 2)

    # Update competition status
    competition.status = CompetitionStatus.SCREENING_CLOSED.value

    await db.commit()

    return QualifyResponse(
        success=True,
        message=f"Qualified top {len(top_registrations)} candidates",
        qualified_count=len(top_registrations),
        cutoff_score=cutoff_score
    )


@router.delete("/{competition_id}")
async def delete_competition(competition_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a competition and all its registrations (admin only)."""
    result = await db.execute(select(Competition).where(Competition.id == competition_id))
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    await db.delete(competition)
    await db.commit()

    return {"success": True, "message": f"Competition {competition_id} deleted"}
