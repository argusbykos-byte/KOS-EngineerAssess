from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.database import get_db
from app.models import Candidate, Test, Report
from app.schemas.candidate import CandidateCreate, CandidateResponse, CandidateUpdate, CandidateWithTests
from app.services.ai_service import ai_service
from app.services.resume_service import resume_service

router = APIRouter()


@router.get("/", response_model=List[CandidateWithTests])
async def list_candidates(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List all candidates with their test summaries."""
    query = (
        select(Candidate)
        .options(selectinload(Candidate.tests).selectinload(Test.report))
        .offset(skip)
        .limit(limit)
        .order_by(Candidate.created_at.desc())
    )
    result = await db.execute(query)
    candidates = result.scalars().all()

    response = []
    for candidate in candidates:
        tests_summary = []
        for test in candidate.tests:
            tests_summary.append({
                "id": test.id,
                "access_token": test.access_token,
                "status": test.status,
                "start_time": test.start_time,
                "end_time": test.end_time,
                "overall_score": test.report.overall_score if test.report else None
            })

        response.append(CandidateWithTests(
            id=candidate.id,
            name=candidate.name,
            email=candidate.email,
            resume_path=candidate.resume_path,
            extracted_skills=candidate.extracted_skills,
            test_duration_hours=candidate.test_duration_hours,
            categories=candidate.categories or [],
            difficulty=candidate.difficulty,
            created_at=candidate.created_at,
            updated_at=candidate.updated_at,
            tests=tests_summary
        ))

    return response


@router.post("/", response_model=CandidateResponse)
async def create_candidate(
    name: str = Form(...),
    email: str = Form(...),
    test_duration_hours: int = Form(2),
    categories: str = Form(""),  # Comma-separated
    difficulty: str = Form("mid"),
    resume: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    """Create a new candidate with optional resume upload."""
    # Check if email already exists
    existing = await db.execute(select(Candidate).where(Candidate.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Parse categories
    category_list = [c.strip() for c in categories.split(",") if c.strip()]

    # Create candidate
    candidate = Candidate(
        name=name,
        email=email,
        test_duration_hours=test_duration_hours,
        categories=category_list,
        difficulty=difficulty
    )
    db.add(candidate)
    await db.flush()

    # Handle resume upload
    if resume:
        content = await resume.read()
        file_path = await resume_service.save_resume(content, resume.filename, candidate.id)
        candidate.resume_path = file_path

        # Extract text and skills
        resume_text = resume_service.extract_text(content, resume.filename)
        candidate.resume_text = resume_text

        if resume_text:
            skills = await ai_service.extract_skills_from_resume(resume_text)
            candidate.extracted_skills = skills

    await db.commit()
    await db.refresh(candidate)

    return CandidateResponse(
        id=candidate.id,
        name=candidate.name,
        email=candidate.email,
        resume_path=candidate.resume_path,
        extracted_skills=candidate.extracted_skills,
        test_duration_hours=candidate.test_duration_hours,
        categories=candidate.categories or [],
        difficulty=candidate.difficulty,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at
    )


@router.get("/{candidate_id}", response_model=CandidateWithTests)
async def get_candidate(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific candidate by ID."""
    query = (
        select(Candidate)
        .options(selectinload(Candidate.tests).selectinload(Test.report))
        .where(Candidate.id == candidate_id)
    )
    result = await db.execute(query)
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    tests_summary = []
    for test in candidate.tests:
        tests_summary.append({
            "id": test.id,
            "access_token": test.access_token,
            "status": test.status,
            "start_time": test.start_time,
            "end_time": test.end_time,
            "overall_score": test.report.overall_score if test.report else None
        })

    return CandidateWithTests(
        id=candidate.id,
        name=candidate.name,
        email=candidate.email,
        resume_path=candidate.resume_path,
        extracted_skills=candidate.extracted_skills,
        test_duration_hours=candidate.test_duration_hours,
        categories=candidate.categories or [],
        difficulty=candidate.difficulty,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
        tests=tests_summary
    )


@router.put("/{candidate_id}", response_model=CandidateResponse)
async def update_candidate(
    candidate_id: int,
    update: CandidateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update candidate settings."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)

    await db.commit()
    await db.refresh(candidate)

    return candidate


@router.delete("/{candidate_id}")
async def delete_candidate(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a candidate."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    await db.delete(candidate)
    await db.commit()

    return {"message": "Candidate deleted"}


@router.post("/{candidate_id}/upload-resume", response_model=CandidateResponse)
async def upload_resume(
    candidate_id: int,
    resume: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload or update candidate resume."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    content = await resume.read()
    file_path = await resume_service.save_resume(content, resume.filename, candidate.id)
    candidate.resume_path = file_path

    # Extract text and skills
    resume_text = resume_service.extract_text(content, resume.filename)
    candidate.resume_text = resume_text

    if resume_text:
        skills = await ai_service.extract_skills_from_resume(resume_text)
        candidate.extracted_skills = skills

    await db.commit()
    await db.refresh(candidate)

    return candidate
