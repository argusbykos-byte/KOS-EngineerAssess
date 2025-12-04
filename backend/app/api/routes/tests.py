from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime, timedelta
import secrets
from app.database import get_db
from app.models import Candidate, Test, Question, Answer
from app.models.test import TestStatus
from app.schemas.test import TestCreate, TestResponse, TestWithQuestions
from app.services.ai_service import ai_service

router = APIRouter()


@router.get("/", response_model=List[TestResponse])
async def list_tests(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    db: AsyncSession = Depends(get_db)
):
    """List all tests."""
    query = select(Test).offset(skip).limit(limit).order_by(Test.created_at.desc())
    if status:
        query = query.where(Test.status == status)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=TestResponse)
async def create_test(test_data: TestCreate, db: AsyncSession = Depends(get_db)):
    """Create a new test for a candidate and generate questions."""
    # Get candidate
    result = await db.execute(select(Candidate).where(Candidate.id == test_data.candidate_id))
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Generate unique access token
    access_token = secrets.token_urlsafe(32)

    # Create test
    test = Test(
        candidate_id=candidate.id,
        access_token=access_token,
        duration_hours=candidate.test_duration_hours,
        status=TestStatus.PENDING.value
    )
    db.add(test)
    await db.flush()

    # Map frontend categories to internal categories
    category_mapping = {
        "backend": "coding",
        "ml": "coding",
        "fullstack": "coding",
        "python": "coding",
        "react": "coding",
        "signal_processing": "signal_processing"
    }

    # Determine which sections to include
    sections = ["brain_teaser"]  # Always include

    if candidate.categories:
        if any(cat in ["backend", "ml", "fullstack", "python", "react"] for cat in candidate.categories):
            sections.extend(["coding", "code_review", "system_design"])
        if "signal_processing" in candidate.categories:
            sections.append("signal_processing")
    else:
        sections.extend(["coding", "code_review", "system_design"])

    sections = list(set(sections))  # Remove duplicates

    # Generate questions using AI
    questions_data = await ai_service.generate_test_questions(
        categories=sections,
        difficulty=candidate.difficulty,
        skills=candidate.extracted_skills or [],
        resume_text=candidate.resume_text
    )

    # STEP 1: Create all questions first and collect them
    created_questions = []
    for section_order, category in enumerate(sections):
        category_questions = questions_data.get(category, [])
        for q_order, q_data in enumerate(category_questions):
            question = Question(
                test_id=test.id,
                category=category,
                section_order=section_order,
                question_order=q_order,
                question_text=q_data.get("question_text", ""),
                question_code=q_data.get("question_code"),
                expected_answer=q_data.get("expected_answer"),
                hints=q_data.get("hints"),
                max_score=100
            )
            db.add(question)
            created_questions.append(question)

    # Flush to get question IDs assigned
    await db.flush()

    # STEP 2: Now create answer records with valid question IDs
    for question in created_questions:
        answer = Answer(question_id=question.id)
        db.add(answer)

    await db.commit()
    await db.refresh(test)

    return test


@router.get("/{test_id}", response_model=TestResponse)
async def get_test(test_id: int, db: AsyncSession = Depends(get_db)):
    """Get test by ID."""
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    return test


@router.get("/token/{access_token}", response_model=TestWithQuestions)
async def get_test_by_token(access_token: str, db: AsyncSession = Depends(get_db)):
    """Get test by access token (for candidates)."""
    query = (
        select(Test)
        .options(
            selectinload(Test.candidate),
            selectinload(Test.questions).selectinload(Question.answer)
        )
        .where(Test.access_token == access_token)
    )
    result = await db.execute(query)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Check if test is expired
    if test.status == TestStatus.IN_PROGRESS.value and test.start_time:
        end_time = test.start_time + timedelta(hours=test.duration_hours)
        if datetime.utcnow() > end_time:
            test.status = TestStatus.EXPIRED.value
            await db.commit()

    # Calculate remaining time
    time_remaining = None
    if test.status == TestStatus.IN_PROGRESS.value and test.start_time:
        end_time = test.start_time + timedelta(hours=test.duration_hours)
        remaining = end_time - datetime.utcnow()
        time_remaining = max(0, int(remaining.total_seconds()))

    # Organize questions by section
    questions_by_section = {}
    for question in test.questions:
        if question.category not in questions_by_section:
            questions_by_section[question.category] = []

        is_answered = bool(
            question.answer and
            (question.answer.candidate_answer or question.answer.candidate_code)
        )

        questions_by_section[question.category].append({
            "id": question.id,
            "category": question.category,
            "question_order": question.question_order,
            "question_text": question.question_text,
            "question_code": question.question_code,
            "max_score": question.max_score,
            "is_answered": is_answered
        })

    # Sort questions within each section
    for category in questions_by_section:
        questions_by_section[category].sort(key=lambda x: x["question_order"])

    return TestWithQuestions(
        id=test.id,
        candidate_id=test.candidate_id,
        access_token=test.access_token,
        start_time=test.start_time,
        end_time=test.end_time,
        duration_hours=test.duration_hours,
        status=test.status,
        current_section=test.current_section,
        created_at=test.created_at,
        candidate_name=test.candidate.name,
        candidate_email=test.candidate.email,
        categories=test.candidate.categories or [],
        difficulty=test.candidate.difficulty,
        questions_by_section=questions_by_section,
        time_remaining_seconds=time_remaining
    )


@router.post("/token/{access_token}/start", response_model=TestResponse)
async def start_test(access_token: str, db: AsyncSession = Depends(get_db)):
    """Start a test (candidate action)."""
    result = await db.execute(select(Test).where(Test.access_token == access_token))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status != TestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Test already started or completed")

    test.status = TestStatus.IN_PROGRESS.value
    test.start_time = datetime.utcnow()
    test.current_section = "brain_teaser"

    await db.commit()
    await db.refresh(test)

    return test


@router.post("/token/{access_token}/complete", response_model=TestResponse)
async def complete_test(access_token: str, db: AsyncSession = Depends(get_db)):
    """Complete a test (candidate action)."""
    result = await db.execute(select(Test).where(Test.access_token == access_token))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status == TestStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Test already completed")

    test.status = TestStatus.COMPLETED.value
    test.end_time = datetime.utcnow()

    await db.commit()
    await db.refresh(test)

    return test


from pydantic import BaseModel
from typing import Literal


class AntiCheatEvent(BaseModel):
    event_type: Literal["tab_switch", "paste_attempt"]
    timestamp: str


@router.post("/token/{access_token}/anti-cheat")
async def log_anti_cheat_event(
    access_token: str,
    event: AntiCheatEvent,
    db: AsyncSession = Depends(get_db)
):
    """Log an anti-cheat event (tab switch or paste attempt)."""
    result = await db.execute(select(Test).where(Test.access_token == access_token))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    if event.event_type == "tab_switch":
        test.tab_switch_count = (test.tab_switch_count or 0) + 1
        timestamps = test.tab_switch_timestamps or []
        timestamps.append(event.timestamp)
        test.tab_switch_timestamps = timestamps
    elif event.event_type == "paste_attempt":
        test.paste_attempt_count = (test.paste_attempt_count or 0) + 1

    await db.commit()

    return {
        "success": True,
        "tab_switch_count": test.tab_switch_count,
        "paste_attempt_count": test.paste_attempt_count
    }
