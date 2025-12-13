from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime, timedelta
import secrets
from app.database import get_db
from app.models import Candidate, Test, Question, Answer, Report
from app.models.test import TestStatus
from app.schemas.test import TestCreate, TestResponse, TestWithQuestions
from app.services.ai_service import ai_service, detect_programming_language

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
        # Add general engineering for all technical candidates
        if any(cat in ["backend", "ml", "fullstack", "python", "react", "signal_processing"] for cat in candidate.categories):
            sections.append("general_engineering")
    else:
        sections.extend(["coding", "code_review", "system_design", "general_engineering"])

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
            question_text = q_data.get("question_text", "")
            question_code = q_data.get("question_code")

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


@router.delete("/{test_id}")
async def delete_test(test_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a test and all associated data (answers, questions, reports)."""
    # Check if test exists
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Get all question IDs for this test
    questions_result = await db.execute(
        select(Question.id).where(Question.test_id == test_id)
    )
    question_ids = [q[0] for q in questions_result.fetchall()]

    # Delete answers for these questions
    if question_ids:
        await db.execute(
            delete(Answer).where(Answer.question_id.in_(question_ids))
        )

    # Delete questions
    await db.execute(
        delete(Question).where(Question.test_id == test_id)
    )

    # Delete any reports for this test
    await db.execute(
        delete(Report).where(Report.test_id == test_id)
    )

    # Delete the test itself
    await db.delete(test)
    await db.commit()

    return {"success": True, "message": f"Test {test_id} and all associated data deleted"}


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

        # is_answered is True only if submitted (not just draft saved)
        is_answered = bool(
            question.answer and
            question.answer.is_submitted
        )

        # Include draft answer data for the frontend to restore
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
    """Complete a test (candidate action). Idempotent - returns success if already completed."""
    result = await db.execute(select(Test).where(Test.access_token == access_token))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Idempotent: if already completed, just return the test without error
    if test.status == TestStatus.COMPLETED.value:
        return test

    test.status = TestStatus.COMPLETED.value
    test.end_time = datetime.utcnow()

    await db.commit()
    await db.refresh(test)

    return test


from pydantic import BaseModel
from typing import Literal, Optional


class AntiCheatEvent(BaseModel):
    event_type: Literal["tab_switch", "paste_attempt", "code_copy", "code_paste"]
    timestamp: str
    chars: Optional[int] = None
    lines: Optional[int] = None


@router.post("/token/{access_token}/anti-cheat")
async def log_anti_cheat_event(
    access_token: str,
    event: AntiCheatEvent,
    db: AsyncSession = Depends(get_db)
):
    """Log an anti-cheat event (tab switch, paste attempt, code copy/paste)."""
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
    elif event.event_type in ["paste_attempt", "code_paste"]:
        # Both textarea paste attempts and code editor pastes count as paste attempts
        test.paste_attempt_count = (test.paste_attempt_count or 0) + 1
    # code_copy events are logged but don't increment any counter
    # They're tracked for auditing purposes

    await db.commit()

    return {
        "success": True,
        "tab_switch_count": test.tab_switch_count,
        "paste_attempt_count": test.paste_attempt_count
    }


@router.get("/kimi/test")
async def test_kimi_connection():
    """Test endpoint to verify Kimi2 connection is working."""
    import time
    start_time = time.time()

    try:
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say 'Hello, Kimi2 is working!' in exactly those words."}
        ]

        response = await ai_service._call_kimi_with_retry(messages, temperature=0.1)
        elapsed = time.time() - start_time

        return {
            "success": bool(response),
            "response": response[:500] if response else None,
            "response_length": len(response) if response else 0,
            "elapsed_seconds": round(elapsed, 2),
            "api_url": ai_service.api_url,
            "timeout": ai_service.timeout
        }
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "elapsed_seconds": round(elapsed, 2),
            "api_url": ai_service.api_url,
            "timeout": ai_service.timeout
        }


@router.post("/{test_id}/reevaluate")
async def reevaluate_test(test_id: int, db: AsyncSession = Depends(get_db)):
    """Re-evaluate all answers for a test using AI.

    This is useful when:
    - AI was not working during original evaluation
    - You want to re-score with updated AI model
    - Original scores were placeholder values (like 50%)
    """
    # Get the test with all questions and answers
    query = (
        select(Test)
        .options(
            selectinload(Test.candidate),
            selectinload(Test.questions).selectinload(Question.answer)
        )
        .where(Test.id == test_id)
    )
    result = await db.execute(query)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Get candidate info for evaluation context
    candidate = test.candidate
    difficulty = candidate.difficulty if candidate else "mid"

    results = []
    total_questions = 0
    evaluated_count = 0
    skipped_count = 0
    error_count = 0

    for question in test.questions:
        total_questions += 1
        answer = question.answer

        # Skip if no answer submitted
        if not answer or (not answer.candidate_answer and not answer.candidate_code):
            skipped_count += 1
            results.append({
                "question_id": question.id,
                "category": question.category,
                "status": "skipped",
                "reason": "No answer submitted"
            })
            continue

        try:
            # Call AI to evaluate
            evaluation = await ai_service.evaluate_answer(
                question_text=question.question_text,
                question_code=question.question_code,
                expected_answer=question.expected_answer or "",
                candidate_answer=answer.candidate_answer or "",
                candidate_code=answer.candidate_code,
                category=question.category,
                difficulty=difficulty
            )

            # Update answer with new evaluation
            answer.score = evaluation.get("score", 50)
            answer.feedback = evaluation.get("feedback", "")
            answer.ai_evaluation = str(evaluation)
            answer.evaluated_at = datetime.utcnow()

            evaluated_count += 1
            results.append({
                "question_id": question.id,
                "category": question.category,
                "status": "evaluated",
                "new_score": answer.score,
                "feedback_preview": (evaluation.get("feedback", "")[:100] + "..."
                                     if len(evaluation.get("feedback", "")) > 100
                                     else evaluation.get("feedback", ""))
            })

        except Exception as e:
            error_count += 1
            results.append({
                "question_id": question.id,
                "category": question.category,
                "status": "error",
                "error": str(e)
            })

    await db.commit()

    # Calculate new average score
    scores = [r["new_score"] for r in results if r.get("new_score") is not None]
    avg_score = sum(scores) / len(scores) if scores else 0

    return {
        "test_id": test_id,
        "candidate_name": candidate.name if candidate else "Unknown",
        "total_questions": total_questions,
        "evaluated": evaluated_count,
        "skipped": skipped_count,
        "errors": error_count,
        "new_average_score": round(avg_score, 1),
        "details": results
    }
