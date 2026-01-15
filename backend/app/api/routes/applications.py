"""
Application Portal API Routes

Public endpoints for application submission and skill self-assessment.
Admin endpoints for managing and converting applications.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Set
from datetime import datetime
import asyncio
import secrets
import os
import aiofiles

from app.database import get_db
from app.models.application import (
    Application,
    SkillAssessment,
    ApplicationStatus,
    AvailabilityChoice,
    SkillCategory,
)
from app.models import Candidate, Test
from app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    ApplicationDetailResponse,
    ApplicationAdminResponse,
    ApplicationSubmitResponse,
    ApplicationListItem,
    ApplicationListResponse,
    SkillAssessmentCreate,
    SkillAssessmentBatchCreate,
    SkillAssessmentResponse,
    SkillFormItem,
    SkillFormResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    CreateCandidateRequest,
    CreateCandidateResponse,
)
from app.data.skill_categories import SKILL_CATEGORIES, get_all_skills
from app.services.ai_service import ai_service

router = APIRouter()

# In-memory lock to prevent duplicate application submission
_application_creation_locks: Set[str] = set()
_lock = asyncio.Lock()

# Upload directory for resumes
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "applications")


def generate_application_token() -> str:
    """Generate a unique application token."""
    return secrets.token_urlsafe(32)


async def save_resume_file(file: UploadFile, application_id: int) -> tuple[str, str]:
    """Save uploaded resume and return (path, original_filename)."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] if file.filename else ".pdf"
    filename = f"application_{application_id}_{secrets.token_hex(8)}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Save file
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)

    return filepath, file.filename or "resume"


# =============================================================================
# PUBLIC ENDPOINTS
# =============================================================================

@router.post("/submit", response_model=ApplicationSubmitResponse)
async def submit_application(
    full_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    graduation_date: Optional[str] = Form(None),
    preferred_start_date: Optional[str] = Form(None),
    availability: str = Form("need_to_discuss"),
    preferred_trial_date: Optional[str] = Form(None),
    self_description: Optional[str] = Form(None),
    motivation: Optional[str] = Form(None),
    admired_engineers: Optional[str] = Form(None),
    overall_self_rating: Optional[int] = Form(None),
    unique_trait: Optional[str] = Form(None),
    resume: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a new application (public endpoint).

    Returns an application token that the candidate can use to:
    - Check their application status
    - Complete skill self-assessments
    - View analysis results
    """
    email_lower = email.lower().strip()

    # Prevent duplicate submissions
    async with _lock:
        if email_lower in _application_creation_locks:
            raise HTTPException(
                status_code=409,
                detail="Application submission in progress for this email. Please wait."
            )
        _application_creation_locks.add(email_lower)

    try:
        # Check if email already has an application
        existing = await db.execute(
            select(Application).where(func.lower(Application.email) == email_lower)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="An application with this email already exists. Please use your existing application token."
            )

        # Parse availability enum
        try:
            avail_enum = AvailabilityChoice(availability)
        except ValueError:
            avail_enum = AvailabilityChoice.NEED_TO_DISCUSS

        # Create application
        application = Application(
            full_name=full_name.strip(),
            email=email_lower,
            phone=phone,
            location=location,
            graduation_date=graduation_date,
            preferred_start_date=preferred_start_date,
            availability=avail_enum,
            preferred_trial_date=preferred_trial_date,
            self_description=self_description,
            motivation=motivation,
            admired_engineers=admired_engineers,
            overall_self_rating=overall_self_rating,
            unique_trait=unique_trait,
            application_token=generate_application_token(),
            status=ApplicationStatus.PENDING,
        )

        db.add(application)
        await db.flush()  # Get the ID

        # Save resume if provided
        if resume and resume.filename:
            filepath, original_name = await save_resume_file(resume, application.id)
            application.resume_path = filepath
            application.resume_filename = original_name

            # TODO: Extract text from resume using resume_service
            # application.resume_text = await resume_service.extract_text(filepath)

        await db.commit()
        await db.refresh(application)

        return ApplicationSubmitResponse(
            application_token=application.application_token,
            message="Application submitted successfully!",
            next_step="Complete your skill self-assessment to continue."
        )

    finally:
        async with _lock:
            _application_creation_locks.discard(email_lower)


@router.get("/{token}", response_model=ApplicationDetailResponse)
async def get_application_by_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get application details by token (public endpoint for candidates).

    Candidates can use this to check their application status and progress.
    """
    query = (
        select(Application)
        .options(selectinload(Application.skill_assessments))
        .where(Application.application_token == token)
    )
    result = await db.execute(query)
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Check if skills are completed
    total_skills = sum(len(skills) for skills in SKILL_CATEGORIES.values())
    completed_skills = len([s for s in application.skill_assessments if s.self_rating is not None])

    return ApplicationDetailResponse(
        id=application.id,
        full_name=application.full_name,
        email=application.email,
        application_token=application.application_token,
        status=application.status.value,
        self_description=application.self_description,
        has_resume=bool(application.resume_path),
        skills_completed=completed_skills >= total_skills,
        skills_submitted_at=application.skills_submitted_at,
        suggested_position=application.suggested_position,
        position_fit_score=application.position_fit_score,
        created_at=application.created_at,
        updated_at=application.updated_at,
        phone=application.phone,
        location=application.location,
        graduation_date=application.graduation_date,
        preferred_start_date=application.preferred_start_date,
        availability=application.availability.value if application.availability else None,
        preferred_trial_date=application.preferred_trial_date,
        motivation=application.motivation,
        admired_engineers=application.admired_engineers,
        overall_self_rating=application.overall_self_rating,
        unique_trait=application.unique_trait,
        resume_filename=application.resume_filename,
        resume_text=application.resume_text,
        skill_assessments=[
            SkillAssessmentResponse(
                id=s.id,
                category=s.category.value,
                skill_name=s.skill_name,
                self_rating=s.self_rating,
                kimi_rating=s.kimi_rating,
                kimi_confidence=s.kimi_confidence,
                kimi_evidence=s.kimi_evidence,
                created_at=s.created_at,
            )
            for s in application.skill_assessments
        ],
    )


@router.get("/{token}/skills", response_model=SkillFormResponse)
async def get_skill_form(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the skill assessment form for an application.

    Returns all skills organized by category, with any existing ratings.
    """
    # Get application
    query = (
        select(Application)
        .options(selectinload(Application.skill_assessments))
        .where(Application.application_token == token)
    )
    result = await db.execute(query)
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Build existing ratings map
    existing_ratings = {
        (s.category.value, s.skill_name): s.self_rating
        for s in application.skill_assessments
    }

    # Build form response
    categories = {}
    total_skills = 0
    completed_skills = 0

    for category, skills in SKILL_CATEGORIES.items():
        categories[category] = []
        for skill_name in skills:
            current_rating = existing_ratings.get((category, skill_name))
            categories[category].append(SkillFormItem(
                category=category,
                skill_name=skill_name,
                current_rating=current_rating,
            ))
            total_skills += 1
            if current_rating is not None:
                completed_skills += 1

    return SkillFormResponse(
        categories=categories,
        total_skills=total_skills,
        completed_skills=completed_skills,
    )


@router.post("/{token}/skills", response_model=dict)
async def submit_skills(
    token: str,
    data: SkillAssessmentBatchCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit skill self-assessments for an application.

    Can be called multiple times to update ratings.
    """
    # Get application
    query = (
        select(Application)
        .options(selectinload(Application.skill_assessments))
        .where(Application.application_token == token)
    )
    result = await db.execute(query)
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Build existing assessments map
    existing_map = {
        (s.category.value, s.skill_name): s
        for s in application.skill_assessments
    }

    # Process each assessment
    created = 0
    updated = 0

    for assessment in data.assessments:
        key = (assessment.category.value, assessment.skill_name)

        if key in existing_map:
            # Update existing
            existing_map[key].self_rating = assessment.self_rating
            existing_map[key].updated_at = datetime.utcnow()
            updated += 1
        else:
            # Create new
            try:
                category_enum = SkillCategory(assessment.category.value)
            except ValueError:
                continue

            new_assessment = SkillAssessment(
                application_id=application.id,
                category=category_enum,
                skill_name=assessment.skill_name,
                self_rating=assessment.self_rating,
            )
            db.add(new_assessment)
            created += 1

    # Update application status if all skills completed
    total_skills = sum(len(skills) for skills in SKILL_CATEGORIES.values())
    current_count = len(existing_map) + created

    if current_count >= total_skills and application.status == ApplicationStatus.PENDING:
        application.status = ApplicationStatus.SKILLS_ASSESSMENT
        application.skills_submitted_at = datetime.utcnow()

    await db.commit()

    return {
        "success": True,
        "created": created,
        "updated": updated,
        "message": f"Saved {created + updated} skill assessments"
    }


@router.post("/{token}/analyze", response_model=AnalyzeResponse)
async def analyze_application(
    token: str,
    request: AnalyzeRequest = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger Kimi2 analysis of the application.

    Analyzes resume and skill self-assessments to provide:
    - Suggested position
    - Position fit score
    - Skill ratings based on resume evidence
    - Strengths and areas for growth
    """
    # Get application with skills
    query = (
        select(Application)
        .options(selectinload(Application.skill_assessments))
        .where(Application.application_token == token)
    )
    result = await db.execute(query)
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Check if already analyzed and not forcing reanalysis
    if application.kimi_analysis and not (request and request.force_reanalyze):
        return AnalyzeResponse(
            success=True,
            message="Application already analyzed. Use force_reanalyze=true to reanalyze.",
            analysis=None,
        )

    # Prepare skill assessments for AI
    skill_assessments = [
        {
            "category": s.category.value,
            "skill_name": s.skill_name,
            "self_rating": s.self_rating,
        }
        for s in application.skill_assessments
        if s.self_rating is not None
    ]

    # Check if we have enough data
    if not application.resume_text and len(skill_assessments) == 0:
        return AnalyzeResponse(
            success=False,
            message="No resume or skill assessments available. Please upload a resume or complete skill ratings first.",
            analysis=None,
        )

    try:
        # Call Kimi2 for analysis
        analysis_result = await ai_service.analyze_application(
            name=application.full_name,
            email=application.email,
            self_description=application.self_description,
            overall_self_rating=application.overall_self_rating,
            motivation=application.motivation,
            unique_trait=application.unique_trait,
            resume_text=application.resume_text or "",
            skill_assessments=skill_assessments,
        )

        # Store the analysis in the application
        application.kimi_analysis = analysis_result
        application.suggested_position = analysis_result.get("best_position")
        application.position_fit_score = float(analysis_result.get("fit_score", 0))

        # Update status if it was pending skills assessment
        if application.status == ApplicationStatus.SKILLS_ASSESSMENT:
            application.status = ApplicationStatus.ANALYZED

        application.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(application)

        return AnalyzeResponse(
            success=True,
            message="Application analyzed successfully.",
            analysis={
                "suggested_position": analysis_result.get("best_position"),
                "position_fit_score": float(analysis_result.get("fit_score", 0)),
                "skill_ratings": [
                    {
                        "skill_name": s.get("skill"),
                        "rating": s.get("adjusted_rating"),
                        "confidence": 1.0 if s.get("resume_evidence") == "strong" else 0.7 if s.get("resume_evidence") == "moderate" else 0.4,
                        "evidence": s.get("notes"),
                    }
                    for s in analysis_result.get("skill_verification", [])
                ],
                "strengths": analysis_result.get("strengths", []),
                "areas_for_growth": analysis_result.get("areas_for_growth", []),
                "overall_assessment": analysis_result.get("overall_assessment", ""),
                "recommendation": "strong_candidate" if analysis_result.get("fit_score", 0) >= 80 else "good_candidate" if analysis_result.get("fit_score", 0) >= 60 else "potential" if analysis_result.get("fit_score", 0) >= 40 else "not_recommended",
                "analysis_timestamp": datetime.utcnow().isoformat(),
            },
        )

    except Exception as e:
        print(f"[Applications] Error during Kimi2 analysis: {e}")
        return AnalyzeResponse(
            success=False,
            message=f"Analysis failed: {str(e)}. Please try again later.",
            analysis=None,
        )


# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

@router.get("/admin/list", response_model=ApplicationListResponse)
async def list_applications(
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    List all applications (admin endpoint).

    Supports filtering by status and searching by name/email.
    """
    # Base query
    query = select(Application).options(selectinload(Application.skill_assessments))

    # Apply filters
    if status:
        try:
            status_enum = ApplicationStatus(status)
            query = query.where(Application.status == status_enum)
        except ValueError:
            pass

    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            (func.lower(Application.full_name).like(search_term)) |
            (func.lower(Application.email).like(search_term))
        )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Application.created_at.desc())

    result = await db.execute(query)
    applications = result.scalars().all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    # Build response
    items = []
    total_skills = sum(len(skills) for skills in SKILL_CATEGORIES.values())

    for app in applications:
        completed_skills = len([s for s in app.skill_assessments if s.self_rating is not None])
        items.append(ApplicationListItem(
            id=app.id,
            full_name=app.full_name,
            email=app.email,
            self_description=app.self_description,
            status=app.status.value,
            suggested_position=app.suggested_position,
            position_fit_score=app.position_fit_score,
            created_at=app.created_at,
            updated_at=app.updated_at,
            has_resume=bool(app.resume_path),
            skills_completed=completed_skills >= total_skills,
        ))

    return ApplicationListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/admin/{application_id}", response_model=ApplicationAdminResponse)
async def get_application_admin(
    application_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get full application details (admin endpoint).
    """
    query = (
        select(Application)
        .options(selectinload(Application.skill_assessments))
        .where(Application.id == application_id)
    )
    result = await db.execute(query)
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    total_skills = sum(len(skills) for skills in SKILL_CATEGORIES.values())
    completed_skills = len([s for s in application.skill_assessments if s.self_rating is not None])

    return ApplicationAdminResponse(
        id=application.id,
        full_name=application.full_name,
        email=application.email,
        application_token=application.application_token,
        status=application.status.value,
        self_description=application.self_description,
        has_resume=bool(application.resume_path),
        skills_completed=completed_skills >= total_skills,
        skills_submitted_at=application.skills_submitted_at,
        suggested_position=application.suggested_position,
        position_fit_score=application.position_fit_score,
        created_at=application.created_at,
        updated_at=application.updated_at,
        phone=application.phone,
        location=application.location,
        graduation_date=application.graduation_date,
        preferred_start_date=application.preferred_start_date,
        availability=application.availability.value if application.availability else None,
        preferred_trial_date=application.preferred_trial_date,
        motivation=application.motivation,
        admired_engineers=application.admired_engineers,
        overall_self_rating=application.overall_self_rating,
        unique_trait=application.unique_trait,
        resume_filename=application.resume_filename,
        resume_text=application.resume_text,
        kimi_analysis=application.kimi_analysis,
        admin_notes=application.admin_notes,
        reviewed_by=application.reviewed_by,
        reviewed_at=application.reviewed_at,
        candidate_id=application.candidate_id,
        skill_assessments=[
            SkillAssessmentResponse(
                id=s.id,
                category=s.category.value,
                skill_name=s.skill_name,
                self_rating=s.self_rating,
                kimi_rating=s.kimi_rating,
                kimi_confidence=s.kimi_confidence,
                kimi_evidence=s.kimi_evidence,
                created_at=s.created_at,
            )
            for s in application.skill_assessments
        ],
    )


@router.put("/admin/{application_id}", response_model=ApplicationAdminResponse)
async def update_application(
    application_id: int,
    data: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update application status and admin notes (admin endpoint).
    """
    query = (
        select(Application)
        .options(selectinload(Application.skill_assessments))
        .where(Application.id == application_id)
    )
    result = await db.execute(query)
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Update fields
    if data.status is not None:
        application.status = ApplicationStatus(data.status.value)
    if data.admin_notes is not None:
        application.admin_notes = data.admin_notes
    if data.reviewed_by is not None:
        application.reviewed_by = data.reviewed_by
        application.reviewed_at = datetime.utcnow()
    if data.suggested_position is not None:
        application.suggested_position = data.suggested_position
    if data.position_fit_score is not None:
        application.position_fit_score = data.position_fit_score

    application.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(application)

    # Return updated application (reuse get_application_admin logic)
    return await get_application_admin(application_id, db)


@router.post("/admin/{application_id}/create-candidate", response_model=CreateCandidateResponse)
async def create_candidate_from_application(
    application_id: int,
    data: CreateCandidateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Convert an application to a candidate in the existing test system.

    Creates a candidate record and generates a test for them.
    Links the application to the candidate for tracking.
    """
    # Get application
    query = select(Application).where(Application.id == application_id)
    result = await db.execute(query)
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.candidate_id:
        raise HTTPException(
            status_code=400,
            detail="Application already converted to candidate"
        )

    # Check if email already exists as candidate
    existing = await db.execute(
        select(Candidate).where(func.lower(Candidate.email) == application.email.lower())
    )
    existing_candidate = existing.scalar_one_or_none()

    if existing_candidate:
        raise HTTPException(
            status_code=400,
            detail="A candidate with this email already exists"
        )

    # Create candidate
    candidate = Candidate(
        name=application.full_name,
        email=application.email,
        resume_path=application.resume_path,
        test_duration_hours=data.test_duration_hours,
        categories=data.categories or [],
        difficulty=data.difficulty,
    )

    db.add(candidate)
    await db.flush()

    # Create test
    test = Test(
        candidate_id=candidate.id,
        access_token=secrets.token_urlsafe(32),
        status="pending",
        duration_hours=data.test_duration_hours,
        total_break_time_seconds=data.test_duration_hours * 450,  # 7.5 min per hour
    )

    db.add(test)
    await db.flush()

    # Link application to candidate
    application.candidate_id = candidate.id
    application.status = ApplicationStatus.TEST_GENERATED

    await db.commit()

    return CreateCandidateResponse(
        success=True,
        candidate_id=candidate.id,
        test_id=test.id,
        access_token=test.access_token,
        message=f"Successfully created candidate and test for {application.full_name}",
    )
