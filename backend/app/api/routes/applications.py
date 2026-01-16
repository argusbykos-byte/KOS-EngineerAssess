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
from app.models import Candidate, Test, Question, Answer
from app.services.ai_service import detect_programming_language
from app.config.tracks import SPECIALIZATION_TRACKS, get_track_config
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
# HELPER FUNCTIONS FOR TEST GENERATION FROM APPLICATION
# =============================================================================

# Map self_description/suggested_position to specialization tracks
ROLE_TO_TRACK_MAPPING = {
    # AI/ML roles
    "ai researcher": "ai_researcher",
    "machine learning researcher": "ai_researcher",
    "machine learning engineer": "ai_ml_engineer",
    "ml engineer": "ai_ml_engineer",
    "data scientist": "ai_ml_engineer",
    # Engineering roles
    "embedded systems engineer": "firmware",
    "firmware engineer": "firmware",
    "biomedical engineer": "biomedical",
    "biomechanical engineer": "biomedical",
    "biomedical / biomechanical engineer": "biomedical",
    "electrical engineer": "hardware_ee",
    "pcb engineer": "hardware_ee",
    "ee engineer": "hardware_ee",
    # Software roles
    "software engineer": None,  # Uses default categories
    "full-stack developer": "frontend",
    "full stack developer": "frontend",
    "frontend developer": "frontend",
    "frontend engineer": "frontend",
    "backend developer": None,
    "backend engineer": None,
    # Security
    "cybersecurity engineer": "cybersecurity",
    "security engineer": "cybersecurity",
    # Design
    "ui/ux designer": "ui_ux",
    "ux designer": "ui_ux",
    "ui designer": "ui_ux",
    # Algorithm roles
    "algorithm design engineer": "ai_researcher",
    "mathematical engineer": "ai_researcher",
}

# Critical skills for KOS that should always be tested
KOS_CRITICAL_SKILLS = [
    "Signal Processing",
    "Machine Learning",
    "Deep Learning",
    "Embedded Systems",
    "Time Series Analysis",
    "Python",
    "C",
    "C++",
    "PyTorch",
    "TensorFlow",
    "Signal & Sensor Data Processing",
    "Model Optimization & Deployment",
    "Embedded Hardware Integration",
]


def map_role_to_track(role: str) -> Optional[str]:
    """Map a role description to a specialization track ID."""
    if not role:
        return None
    role_lower = role.lower().strip()
    # Direct match
    if role_lower in ROLE_TO_TRACK_MAPPING:
        return ROLE_TO_TRACK_MAPPING[role_lower]
    # Partial match
    for role_key, track_id in ROLE_TO_TRACK_MAPPING.items():
        if role_key in role_lower or role_lower in role_key:
            return track_id
    return None


def determine_categories_from_skills(skill_assessments: List[SkillAssessment]) -> List[str]:
    """Determine test categories based on candidate's skill self-assessments."""
    categories = ["brain_teaser"]  # Always include

    # Check skill areas
    has_ml = False
    has_coding = False
    has_signal = False
    has_embedded = False

    for skill in skill_assessments:
        if skill.self_rating is None:
            continue

        skill_name_lower = skill.skill_name.lower()
        rating = skill.self_rating

        # Only consider skills rated 5+ for category determination
        if rating >= 5:
            if any(kw in skill_name_lower for kw in ["machine learning", "deep learning", "pytorch", "tensorflow", "cnn", "rnn", "transformer"]):
                has_ml = True
            if any(kw in skill_name_lower for kw in ["python", "c++", "javascript", "typescript", "java", "c#"]):
                has_coding = True
            if any(kw in skill_name_lower for kw in ["signal processing", "time series", "sensor"]):
                has_signal = True
            if any(kw in skill_name_lower for kw in ["embedded", "firmware", "rtos"]):
                has_embedded = True

    if has_coding or has_ml:
        categories.extend(["coding", "code_review", "system_design"])
    if has_signal or has_embedded:
        categories.append("signal_processing")

    # Always include general_engineering for all technical candidates
    categories.append("general_engineering")

    return list(set(categories))


def extract_skills_for_questions(skill_assessments: List[SkillAssessment]) -> tuple[List[str], List[str], List[str]]:
    """
    Extract skills categorized by rating for personalized question generation.

    Returns:
        (high_priority_skills, medium_priority_skills, critical_skills_to_verify)
    """
    high_priority = []  # Skills rated 8-10 (ask advanced verification questions)
    medium_priority = []  # Skills rated 5-7 (ask intermediate questions)
    critical_to_verify = []  # KOS critical skills regardless of rating

    for skill in skill_assessments:
        if skill.self_rating is None:
            continue

        skill_name = skill.skill_name
        rating = skill.self_rating

        # Check if this is a KOS critical skill
        if any(critical.lower() in skill_name.lower() or skill_name.lower() in critical.lower()
               for critical in KOS_CRITICAL_SKILLS):
            critical_to_verify.append(skill_name)

        # Categorize by rating
        if rating >= 8:
            high_priority.append(skill_name)
        elif rating >= 5:
            medium_priority.append(skill_name)
        # Skills rated 1-4 are skipped or get basic questions only

    return high_priority, medium_priority, critical_to_verify


def build_skill_context_for_prompt(
    skill_assessments: List[SkillAssessment],
    resume_text: str,
    self_description: str
) -> str:
    """Build a context string for AI prompt based on candidate's application data."""
    context_parts = []

    if self_description:
        context_parts.append(f"Candidate identifies as: {self_description}")

    # Group skills by rating level
    high_rated = []
    medium_rated = []

    for skill in skill_assessments:
        if skill.self_rating is None:
            continue
        if skill.self_rating >= 8:
            high_rated.append(f"{skill.skill_name} ({skill.self_rating}/10)")
        elif skill.self_rating >= 5:
            medium_rated.append(f"{skill.skill_name} ({skill.self_rating}/10)")

    if high_rated:
        context_parts.append(f"\nHigh-rated skills (8-10): {', '.join(high_rated[:15])}")
    if medium_rated:
        context_parts.append(f"\nMedium-rated skills (5-7): {', '.join(medium_rated[:15])}")

    if resume_text:
        # Truncate resume for prompt context
        context_parts.append(f"\nResume excerpt:\n{resume_text[:2000]}")

    return "\n".join(context_parts)


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


@router.delete("/admin/{application_id}")
async def delete_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete an application and all associated data (admin endpoint).

    This will cascade delete:
    - All skill assessments for the application
    - The uploaded resume file (if any)
    """
    # Get application
    query = select(Application).where(Application.id == application_id)
    result = await db.execute(query)
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Check if application has been converted to a candidate
    if application.candidate_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete application that has been converted to a candidate. Delete the candidate first."
        )

    # Delete resume file if exists
    if application.resume_path and os.path.exists(application.resume_path):
        try:
            os.remove(application.resume_path)
        except Exception as e:
            print(f"[Applications] Warning: Failed to delete resume file: {e}")

    # Delete application (skill_assessments cascade deleted automatically)
    await db.delete(application)
    await db.commit()

    return {"success": True, "message": f"Application for {application.full_name} deleted successfully"}


@router.post("/admin/{application_id}/create-candidate", response_model=CreateCandidateResponse)
async def create_candidate_from_application(
    application_id: int,
    data: CreateCandidateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Convert an application to a candidate in the existing test system.

    Creates a candidate record, generates personalized questions based on:
    - The candidate's 71 skill self-assessments
    - Resume text and self-description
    - KOS's needs (medical devices, PPG signal processing, ML for glucose monitoring)

    Includes specialization category based on candidate's role for dual scoring.

    IMPORTANT: This function generates questions FIRST (outside transaction) to avoid
    holding database locks during the 90+ second AI generation process.
    """
    # =========================================================================
    # PHASE 1: Read application data (quick read, no write lock)
    # =========================================================================
    query = (
        select(Application)
        .options(selectinload(Application.skill_assessments))
        .where(Application.id == application_id)
    )
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

    # Extract all needed data from application BEFORE releasing db session
    app_full_name = application.full_name
    app_email = application.email
    app_resume_path = application.resume_path
    app_resume_text = application.resume_text
    app_self_description = application.self_description
    app_suggested_position = application.suggested_position
    # Make a copy of skill assessments data
    skill_assessments_copy = [
        {
            "skill_name": s.skill_name,
            "self_rating": s.self_rating,
            "category": s.category
        }
        for s in application.skill_assessments
    ]

    # Determine specialization track from self_description or suggested_position
    track_id = None
    if app_suggested_position:
        track_id = map_role_to_track(app_suggested_position)
    if not track_id and app_self_description:
        track_id = map_role_to_track(app_self_description)

    print(f"[Applications] Determined track: {track_id} from role: {app_suggested_position or app_self_description}")

    # Determine categories based on skill assessments
    if data.categories:
        categories = data.categories
    else:
        categories = determine_categories_from_skills(application.skill_assessments)

    # Extract skills for personalized question focus
    high_priority_skills, medium_priority_skills, critical_skills = extract_skills_for_questions(
        application.skill_assessments
    )

    # Combine skills for AI context
    all_skills = list(set(high_priority_skills + medium_priority_skills + critical_skills))[:20]

    print(f"[Applications] Categories: {categories}")
    print(f"[Applications] High-priority skills (8-10): {high_priority_skills[:10]}")
    print(f"[Applications] Critical skills to verify: {critical_skills[:10]}")

    # Build skill context for AI prompt
    skill_context = build_skill_context_for_prompt(
        application.skill_assessments,
        app_resume_text or "",
        app_self_description or ""
    )

    # =========================================================================
    # PHASE 2: Generate questions via AI (OUTSIDE transaction - no db lock held)
    # This takes 90+ seconds but doesn't block other database operations
    # =========================================================================
    print(f"[Applications] Generating personalized questions for {app_full_name}...")

    # Generate questions using AI
    questions_data = {}
    try:
        questions_data = await ai_service.generate_test_questions(
            categories=categories,
            difficulty=data.difficulty,
            skills=all_skills,
            resume_text=skill_context,
            track_id=track_id
        )
    except Exception as e:
        print(f"[Applications] Error generating questions: {e}")

    # Generate specialization questions if candidate has a track
    specialization_questions = []
    if track_id and get_track_config(track_id):
        print(f"[Applications] Generating specialization questions for track: {track_id}")
        try:
            specialization_questions = await ai_service.generate_specialization_questions(
                track_id=track_id,
                difficulty=data.difficulty
            )
        except Exception as e:
            print(f"[Applications] Error generating specialization questions: {e}")

    # =========================================================================
    # PHASE 3: Quick database transaction to insert everything
    # This is fast (<1 second) so database lock is held briefly
    # =========================================================================
    print(f"[Applications] Inserting candidate and questions into database...")

    # Re-check that candidate wasn't created while we were generating questions
    existing_check = await db.execute(
        select(Candidate).where(func.lower(Candidate.email) == app_email.lower())
    )
    if existing_check.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="A candidate with this email was created while generating questions"
        )

    # Re-check application wasn't already converted
    app_check = await db.execute(
        select(Application.candidate_id).where(Application.id == application_id)
    )
    app_candidate_id = app_check.scalar_one_or_none()
    if app_candidate_id:
        raise HTTPException(
            status_code=400,
            detail="Application was already converted while generating questions"
        )

    # Create candidate with track
    candidate = Candidate(
        name=app_full_name,
        email=app_email,
        resume_path=app_resume_path,
        resume_text=app_resume_text,
        extracted_skills=all_skills,
        test_duration_hours=data.test_duration_hours,
        categories=categories,
        difficulty=data.difficulty,
        track=track_id,
    )

    db.add(candidate)
    await db.flush()

    # Calculate break time based on test duration
    duration_hours = data.test_duration_hours
    if duration_hours >= 8:
        total_break = 60 * 60
    elif duration_hours >= 4:
        total_break = int((30 + (duration_hours - 4) * (30 / 4)) * 60)
    elif duration_hours >= 2:
        total_break = int((15 + (duration_hours - 2) * (15 / 2)) * 60)
    else:
        total_break = 10 * 60

    # Create test
    test = Test(
        candidate_id=candidate.id,
        access_token=secrets.token_urlsafe(32),
        status="pending",
        duration_hours=data.test_duration_hours,
        total_break_time_seconds=total_break,
        used_break_time_seconds=0,
        break_count=0,
        break_history=[],
    )

    db.add(test)
    await db.flush()

    # Track created questions for answer record creation
    created_questions = []
    sections = list(set(categories))

    # Create Question records from generated questions
    for section_order, category in enumerate(sections):
        category_questions = questions_data.get(category, [])

        if not category_questions:
            print(f"[Applications] Warning: No questions generated for category {category}")
            continue

        for q_order, q_data in enumerate(category_questions):
            question_text = q_data.get("question_text", "")
            question_code = q_data.get("question_code")

            if not question_text:
                continue

            # Detect programming language for code-related questions
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

    # Add specialization questions with track as category
    if specialization_questions:
        specialization_section_order = len(sections)
        for q_order, q_data in enumerate(specialization_questions):
            question_text = q_data.get("question_text", "")
            question_code = q_data.get("question_code")

            if not question_text:
                continue

            # Detect programming language for code-related questions
            language = None
            if question_code:
                language = detect_programming_language(
                    text=question_text,
                    code=question_code,
                    category=track_id
                )

            question = Question(
                test_id=test.id,
                category=track_id,  # Use track ID as category for specialization scoring
                section_order=specialization_section_order,
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

    # Flush to get question IDs assigned
    await db.flush()

    # Create Answer records for each question
    for question in created_questions:
        answer = Answer(question_id=question.id)
        db.add(answer)

    # Link application to candidate - need to re-fetch to update
    app_to_update = await db.get(Application, application_id)
    if app_to_update:
        app_to_update.candidate_id = candidate.id
        app_to_update.status = ApplicationStatus.TEST_GENERATED

    await db.commit()

    question_count = len(created_questions)
    print(f"[Applications] Created test with {question_count} personalized questions for {app_full_name}")

    return CreateCandidateResponse(
        success=True,
        candidate_id=candidate.id,
        test_id=test.id,
        access_token=test.access_token,
        message=f"Successfully created candidate and test with {question_count} personalized questions for {app_full_name}",
    )
