from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Dict, Set
from datetime import datetime, timedelta
import secrets
import asyncio
from app.database import get_db
from app.models import Candidate, Test, Question, Answer, Report
from app.models.test import TestStatus
from app.schemas.test import (
    TestCreate, TestResponse, TestWithQuestions,
    BreakStartResponse, BreakEndResponse, BreakHistoryEntry
)
from app.services.ai_service import ai_service, detect_programming_language
from app.services.nda_service import nda_service

router = APIRouter()

# CRITICAL: In-memory lock to prevent duplicate test creation
# When test generation is in progress for a candidate, block additional requests
_test_generation_locks: Set[int] = set()  # Set of candidate_ids currently generating
_lock = asyncio.Lock()  # Protects access to _test_generation_locks


def calculate_break_time(duration_hours: int) -> tuple[int, int]:
    """Calculate total break time and max single break based on test duration.

    Returns:
        tuple: (total_break_seconds, max_single_break_seconds)

    Rules:
    - 8hr test = 60min total break, max 20min single break
    - 4hr test = 30min total break, max 15min single break
    - Linear interpolation for other durations
    """
    if duration_hours >= 8:
        return (60 * 60, 20 * 60)  # 60 min total, 20 min max single
    elif duration_hours >= 4:
        # Interpolate: 4hr = 30min, 8hr = 60min
        total_minutes = 30 + (duration_hours - 4) * (30 / 4)
        max_single = 15 + (duration_hours - 4) * (5 / 4)  # 15 to 20 min
        return (int(total_minutes * 60), int(max_single * 60))
    elif duration_hours >= 2:
        # 2-4hr tests get 15-30 min break
        total_minutes = 15 + (duration_hours - 2) * (15 / 2)
        return (int(total_minutes * 60), 15 * 60)  # max 15 min single
    else:
        # Tests under 2hr get 10min break
        return (10 * 60, 10 * 60)


@router.get("", response_model=List[TestResponse])
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


@router.post("", response_model=TestResponse)
async def create_test(test_data: TestCreate, db: AsyncSession = Depends(get_db)):
    """Create a new test for a candidate and generate questions."""
    candidate_id = test_data.candidate_id

    # CRITICAL: Check if test generation is already in progress for this candidate
    async with _lock:
        if candidate_id in _test_generation_locks:
            raise HTTPException(
                status_code=409,  # Conflict
                detail="Test generation already in progress for this candidate. Please wait for it to complete."
            )
        # Acquire the lock for this candidate
        _test_generation_locks.add(candidate_id)

    try:
        # Get candidate
        result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
        candidate = result.scalar_one_or_none()

        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        # Generate unique access token
        access_token = secrets.token_urlsafe(32)

        # Calculate break time allowance
        total_break, max_single_break = calculate_break_time(candidate.test_duration_hours)

        # Create test
        test = Test(
            candidate_id=candidate.id,
            access_token=access_token,
            duration_hours=candidate.test_duration_hours,
            status=TestStatus.PENDING.value,
            total_break_time_seconds=total_break,
            used_break_time_seconds=0,
            break_count=0,
            break_history=[]
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

        # Define category groups for question type mapping
        # BUG 5 FIX: Include "frontend" in the technical categories for coding sections
        coding_categories = ["backend", "ml", "fullstack", "python", "react", "frontend", "javascript", "typescript"]

        if candidate.categories:
            # Add coding/code_review/system_design for any technical software role
            if any(cat in coding_categories for cat in candidate.categories):
                sections.extend(["coding", "code_review", "system_design"])
            if "signal_processing" in candidate.categories:
                sections.append("signal_processing")
            # Add general engineering for all technical candidates
            if any(cat in coding_categories + ["signal_processing"] for cat in candidate.categories):
                sections.append("general_engineering")
        else:
            sections.extend(["coding", "code_review", "system_design", "general_engineering"])

        sections = list(set(sections))  # Remove duplicates

        # Generate questions using AI (this is the slow part - 2-4 minutes)
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

        # STEP 1.5: Generate specialization questions if candidate has a track
        if candidate.track:
            specialization_questions = await ai_service.generate_specialization_questions(
                track_id=candidate.track,
                difficulty=candidate.difficulty
            )

            # Add specialization questions with track as category
            specialization_section_order = len(sections)  # After all other sections
            for q_order, q_data in enumerate(specialization_questions):
                question_text = q_data.get("question_text", "")
                question_code = q_data.get("question_code")

                # Detect programming language for code-related questions
                language = None
                if question_code:
                    language = detect_programming_language(
                        text=question_text,
                        code=question_code,
                        category=candidate.track
                    )

                question = Question(
                    test_id=test.id,
                    category=candidate.track,  # Use track ID as category
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

        # STEP 2: Now create answer records with valid question IDs
        for question in created_questions:
            answer = Answer(question_id=question.id)
            db.add(answer)

        await db.commit()
        await db.refresh(test)

        return test

    finally:
        # CRITICAL: Always release the lock, even if an error occurred
        async with _lock:
            _test_generation_locks.discard(candidate_id)


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


@router.post("/{test_id}/reset-tab-switches")
async def reset_tab_switches(test_id: int, db: AsyncSession = Depends(get_db)):
    """Reset tab switch count for a test (admin endpoint).

    Allows admins to give candidates another chance after tab switch violations.
    Only works for tests that are in_progress.
    """
    try:
        result = await db.execute(select(Test).where(Test.id == test_id))
        test = result.scalar_one_or_none()

        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        if test.status != "in_progress":
            raise HTTPException(
                status_code=400,
                detail=f"Can only reset tab switches for in_progress tests. Current status: {test.status}"
            )

        previous_count = test.tab_switch_count or 0
        test.tab_switch_count = 0
        test.tab_switch_timestamps = []
        flag_modified(test, "tab_switch_timestamps")  # Mark JSON field as modified
        test.warning_count = max(0, (test.warning_count or 0) - previous_count)

        await db.commit()

        return {
            "success": True,
            "message": f"Reset tab switch count from {previous_count} to 0",
            "previous_count": previous_count
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{test_id}/reset-paste-attempts")
async def reset_paste_attempts(test_id: int, db: AsyncSession = Depends(get_db)):
    """Reset paste attempt count for a test (admin endpoint).

    Allows admins to give candidates another chance after paste attempt violations.
    Only works for tests that are in_progress.
    """
    try:
        result = await db.execute(select(Test).where(Test.id == test_id))
        test = result.scalar_one_or_none()

        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        if test.status != "in_progress":
            raise HTTPException(
                status_code=400,
                detail=f"Can only reset paste attempts for in_progress tests. Current status: {test.status}"
            )

        previous_count = test.paste_attempt_count or 0
        test.paste_attempt_count = 0
        test.warning_count = max(0, (test.warning_count or 0) - previous_count)

        await db.commit()

        return {
            "success": True,
            "message": f"Reset paste attempt count from {previous_count} to 0",
            "previous_count": previous_count
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{test_id}/reinstate")
async def reinstate_disqualified_test(test_id: int, db: AsyncSession = Depends(get_db)):
    """Reinstate a disqualified test - give candidate another chance.

    Resets ALL violation counters and changes status back to in_progress.
    Only works for disqualified tests.

    Violation Scoring System:
    - Tab switch = 1.0 point
    - Paste attempt = 2.0 points
    - Copy attempt = 1.0 points
    - Dev tools open = 3.0 points
    - Right click = 0.5 points
    - Focus loss = 0.5 points
    - Disqualification threshold = 5.0 points
    """
    try:
        result = await db.execute(select(Test).where(Test.id == test_id))
        test = result.scalar_one_or_none()

        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        if not test.is_disqualified:
            raise HTTPException(
                status_code=400,
                detail="Can only reinstate disqualified tests. This test is not disqualified."
            )

        # Save disqualification info for response
        previous_reason = test.disqualification_reason
        previous_status = test.status

        # Reset test status to in_progress
        test.status = "in_progress"
        test.is_disqualified = False
        test.disqualification_reason = None
        test.disqualified_at = None

        # Reset ALL violation counters
        test.tab_switch_count = 0
        test.paste_attempt_count = 0
        test.copy_attempt_count = 0
        test.right_click_count = 0
        test.dev_tools_open_count = 0
        test.focus_loss_count = 0
        test.warning_count = 0

        # Clear violation tracking arrays
        test.violation_events = []
        test.tab_switch_timestamps = []
        flag_modified(test, "violation_events")
        flag_modified(test, "tab_switch_timestamps")

        await db.commit()

        return {
            "success": True,
            "message": f"Test reinstated. Previous reason: {previous_reason}",
            "previous_status": previous_status,
            "previous_reason": previous_reason,
            "new_status": "in_progress",
            "all_violations_cleared": True
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{test_id}/mark-completed")
async def mark_test_completed(test_id: int, db: AsyncSession = Depends(get_db)):
    """Mark a test as completed (admin endpoint).

    Used when a test is still 'in_progress' but has already been scored/evaluated.
    This can happen if the candidate's session ended without proper completion.
    """
    try:
        result = await db.execute(select(Test).where(Test.id == test_id))
        test = result.scalar_one_or_none()

        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        if test.status == "completed":
            return {
                "success": True,
                "message": "Test is already completed",
                "status": "completed"
            }

        previous_status = test.status
        test.status = "completed"
        test.end_time = test.end_time or datetime.utcnow()

        await db.commit()

        return {
            "success": True,
            "message": f"Test marked as completed (was: {previous_status})",
            "previous_status": previous_status,
            "new_status": "completed"
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


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

    # Check if test is expired (account for break time - breaks pause the test)
    if test.status in [TestStatus.IN_PROGRESS.value, TestStatus.ON_BREAK.value] and test.start_time:
        # Effective end time = start + duration + used break time
        effective_duration = timedelta(hours=test.duration_hours) + timedelta(seconds=test.used_break_time_seconds or 0)
        end_time = test.start_time + effective_duration
        if datetime.utcnow() > end_time and test.status != TestStatus.ON_BREAK.value:
            test.status = TestStatus.EXPIRED.value
            await db.commit()

    # Calculate remaining time (excluding current break if on break)
    time_remaining = None
    if test.status in [TestStatus.IN_PROGRESS.value, TestStatus.ON_BREAK.value] and test.start_time:
        effective_duration = timedelta(hours=test.duration_hours) + timedelta(seconds=test.used_break_time_seconds or 0)
        end_time = test.start_time + effective_duration
        remaining = end_time - datetime.utcnow()
        time_remaining = max(0, int(remaining.total_seconds()))

    # Calculate break info
    total_break, max_single_break = calculate_break_time(test.duration_hours)
    remaining_break_time = max(0, (test.total_break_time_seconds or total_break) - (test.used_break_time_seconds or 0))
    is_on_break = test.status == TestStatus.ON_BREAK.value

    # Build break history for response
    break_history = []
    for entry in (test.break_history or []):
        break_history.append(BreakHistoryEntry(
            start=entry.get("start", ""),
            end=entry.get("end"),
            duration_seconds=entry.get("duration_seconds", 0)
        ))

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

        # BUG 6 FIX: Include submitted answer data for answered questions
        # The frontend needs this to display submitted answers after page refresh
        answer_data = None
        if question.answer:
            answer_data = {
                "candidate_answer": question.answer.candidate_answer,
                "candidate_code": question.answer.candidate_code,
                "score": question.answer.score,
                "feedback": question.answer.feedback,
                "is_submitted": question.answer.is_submitted,
            }

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
            "language": question.language,
            "answer": answer_data,  # BUG 6 FIX: Include full answer data
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
        # Test type for specialization tests
        test_type=test.test_type or "standard",
        specialization_focus=test.specialization_focus,
        candidate_name=test.candidate.name,
        candidate_email=test.candidate.email,
        categories=test.candidate.categories or [],
        difficulty=test.candidate.difficulty,
        questions_by_section=questions_by_section,
        time_remaining_seconds=time_remaining,
        # Break info
        total_break_time_seconds=test.total_break_time_seconds or total_break,
        used_break_time_seconds=test.used_break_time_seconds or 0,
        break_count=test.break_count or 0,
        is_on_break=is_on_break,
        remaining_break_time_seconds=remaining_break_time,
        max_single_break_seconds=max_single_break,
        break_history=break_history,
        # Disqualification info
        is_disqualified=test.is_disqualified or False,
        disqualification_reason=test.disqualification_reason,
        # NDA and Testing Integrity Agreement info
        nda_signature=test.nda_signature,
        nda_signed_at=test.nda_signed_at,
        integrity_agreed=test.integrity_agreed or False,
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

    # If on break, end the break first
    if test.status == TestStatus.ON_BREAK.value and test.current_break_start:
        break_duration = int((datetime.utcnow() - test.current_break_start).total_seconds())
        test.used_break_time_seconds = (test.used_break_time_seconds or 0) + break_duration

        # Update break history
        history = list(test.break_history or [])
        if history and history[-1].get("end") is None:
            history[-1]["end"] = datetime.utcnow().isoformat()
            history[-1]["duration_seconds"] = break_duration
            test.break_history = history

        test.current_break_start = None

    test.status = TestStatus.COMPLETED.value
    test.end_time = datetime.utcnow()

    await db.commit()
    await db.refresh(test)

    return test


@router.post("/token/{access_token}/break/start", response_model=BreakStartResponse)
async def start_break(access_token: str, db: AsyncSession = Depends(get_db)):
    """Start a break (pauses the test timer)."""
    result = await db.execute(select(Test).where(Test.access_token == access_token))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start break - test is {test.status}"
        )

    # Calculate remaining break time
    total_break, max_single_break = calculate_break_time(test.duration_hours)
    total_allowed = test.total_break_time_seconds or total_break
    used = test.used_break_time_seconds or 0
    remaining = total_allowed - used

    if remaining <= 0:
        raise HTTPException(
            status_code=400,
            detail="No break time remaining"
        )

    # Start the break
    now = datetime.utcnow()
    test.status = TestStatus.ON_BREAK.value
    test.current_break_start = now
    test.break_count = (test.break_count or 0) + 1

    # Add to break history
    history = list(test.break_history or [])
    history.append({
        "start": now.isoformat(),
        "end": None,
        "duration_seconds": 0
    })
    test.break_history = history

    await db.commit()

    return BreakStartResponse(
        success=True,
        message=f"Break started. You have {remaining // 60} minutes of break time remaining.",
        remaining_break_time_seconds=remaining,
        max_single_break_seconds=max_single_break,
        break_start_time=now
    )


@router.post("/token/{access_token}/break/end", response_model=BreakEndResponse)
async def end_break(access_token: str, db: AsyncSession = Depends(get_db)):
    """End a break (resumes the test timer)."""
    result = await db.execute(select(Test).where(Test.access_token == access_token))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status != TestStatus.ON_BREAK.value:
        raise HTTPException(
            status_code=400,
            detail="Not currently on break"
        )

    if not test.current_break_start:
        raise HTTPException(
            status_code=400,
            detail="Break start time not recorded"
        )

    # Calculate break duration
    now = datetime.utcnow()
    break_duration = int((now - test.current_break_start).total_seconds())

    # Check if exceeded max single break or total break time
    total_break, max_single_break = calculate_break_time(test.duration_hours)
    total_allowed = test.total_break_time_seconds or total_break

    # Cap break duration at max allowed
    used_before = test.used_break_time_seconds or 0
    remaining_before = total_allowed - used_before

    # If they took longer than allowed, cap it and show warning
    actual_duration = min(break_duration, remaining_before)
    exceeded = break_duration > remaining_before

    # Update test
    test.used_break_time_seconds = used_before + actual_duration
    test.current_break_start = None
    test.status = TestStatus.IN_PROGRESS.value

    # Update break history
    history = list(test.break_history or [])
    if history and history[-1].get("end") is None:
        history[-1]["end"] = now.isoformat()
        history[-1]["duration_seconds"] = actual_duration
        test.break_history = history

    await db.commit()

    remaining_after = total_allowed - test.used_break_time_seconds

    message = f"Break ended. {actual_duration // 60} minutes used."
    if exceeded:
        message += f" Warning: Break exceeded allowed time. Only {actual_duration // 60} minutes counted."
    message += f" {remaining_after // 60} minutes remaining."

    return BreakEndResponse(
        success=True,
        message=message,
        break_duration_seconds=actual_duration,
        remaining_break_time_seconds=remaining_after,
        total_used_break_time_seconds=test.used_break_time_seconds
    )


from pydantic import BaseModel
from typing import Literal, Optional


class AntiCheatEvent(BaseModel):
    event_type: Literal[
        "tab_switch", "paste_attempt", "code_copy", "code_paste",
        "copy_attempt", "right_click", "dev_tools_open", "focus_loss"
    ]
    timestamp: str
    chars: Optional[int] = None
    lines: Optional[int] = None
    details: Optional[str] = None


# Anti-cheat configuration - can be made database-backed later
ANTI_CHEAT_CONFIG = {
    "warning_threshold": 3,  # Warnings before disqualification
    "disqualification_threshold": 5,  # Total violations for auto-disqualification
    "violation_weights": {
        "tab_switch": 1,
        "paste_attempt": 2,
        "copy_attempt": 1,
        "right_click": 0.5,
        "dev_tools_open": 3,
        "focus_loss": 0.5,
    }
}


@router.get("/anti-cheat/config")
async def get_anti_cheat_config():
    """Get anti-cheat configuration."""
    return ANTI_CHEAT_CONFIG


@router.post("/token/{access_token}/anti-cheat")
async def log_anti_cheat_event(
    access_token: str,
    event: AntiCheatEvent,
    db: AsyncSession = Depends(get_db)
):
    """Log an anti-cheat event (tab switch, paste attempt, code copy/paste, dev tools, etc.)."""
    result = await db.execute(select(Test).where(Test.access_token == access_token))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status not in [TestStatus.IN_PROGRESS.value, TestStatus.ON_BREAK.value]:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    # Check if already disqualified
    if test.is_disqualified:
        return {
            "success": False,
            "is_disqualified": True,
            "disqualification_reason": test.disqualification_reason
        }

    # Log violation event
    violation_events = list(test.violation_events or [])
    violation_events.append({
        "type": event.event_type,
        "timestamp": event.timestamp,
        "details": event.details or "",
        "chars": event.chars,
        "lines": event.lines
    })
    test.violation_events = violation_events

    # Update counters based on event type
    if event.event_type == "tab_switch":
        test.tab_switch_count = (test.tab_switch_count or 0) + 1
        timestamps = list(test.tab_switch_timestamps or [])
        timestamps.append(event.timestamp)
        test.tab_switch_timestamps = timestamps
    elif event.event_type in ["paste_attempt", "code_paste"]:
        test.paste_attempt_count = (test.paste_attempt_count or 0) + 1
    elif event.event_type in ["copy_attempt", "code_copy"]:
        test.copy_attempt_count = (test.copy_attempt_count or 0) + 1
    elif event.event_type == "right_click":
        test.right_click_count = (test.right_click_count or 0) + 1
    elif event.event_type == "dev_tools_open":
        test.dev_tools_open_count = (test.dev_tools_open_count or 0) + 1
    elif event.event_type == "focus_loss":
        test.focus_loss_count = (test.focus_loss_count or 0) + 1

    # Calculate weighted violation score
    violation_score = (
        (test.tab_switch_count or 0) * ANTI_CHEAT_CONFIG["violation_weights"]["tab_switch"] +
        (test.paste_attempt_count or 0) * ANTI_CHEAT_CONFIG["violation_weights"]["paste_attempt"] +
        (test.copy_attempt_count or 0) * ANTI_CHEAT_CONFIG["violation_weights"]["copy_attempt"] +
        (test.right_click_count or 0) * ANTI_CHEAT_CONFIG["violation_weights"]["right_click"] +
        (test.dev_tools_open_count or 0) * ANTI_CHEAT_CONFIG["violation_weights"]["dev_tools_open"] +
        (test.focus_loss_count or 0) * ANTI_CHEAT_CONFIG["violation_weights"]["focus_loss"]
    )

    # Determine if warning or disqualification is needed
    should_warn = False
    should_disqualify = False
    warning_count = test.warning_count or 0

    if violation_score >= ANTI_CHEAT_CONFIG["disqualification_threshold"]:
        should_disqualify = True
        test.is_disqualified = True
        test.disqualified_at = datetime.utcnow()
        test.disqualification_reason = f"Exceeded violation threshold (score: {violation_score:.1f})"
    elif violation_score >= ANTI_CHEAT_CONFIG["warning_threshold"] * (warning_count + 1) / ANTI_CHEAT_CONFIG["warning_threshold"]:
        should_warn = True
        test.warning_count = warning_count + 1

    await db.commit()

    return {
        "success": True,
        "tab_switch_count": test.tab_switch_count,
        "paste_attempt_count": test.paste_attempt_count,
        "copy_attempt_count": test.copy_attempt_count,
        "right_click_count": test.right_click_count,
        "dev_tools_open_count": test.dev_tools_open_count,
        "focus_loss_count": test.focus_loss_count,
        "violation_score": violation_score,
        "warning_count": test.warning_count,
        "should_warn": should_warn,
        "is_disqualified": test.is_disqualified,
        "disqualification_reason": test.disqualification_reason if test.is_disqualified else None
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


# ============================================================================
# NDA and Testing Integrity Agreement Endpoints
# ============================================================================

class AgreementRequest(BaseModel):
    """Request body for signing agreement."""
    signature: str  # Full legal name
    integrity_agreed: bool
    nda_agreed: bool


def get_client_ip(request: Request) -> str:
    """Extract client IP address from request headers."""
    # Check for forwarded headers (when behind proxy/load balancer)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can contain multiple IPs, first one is the client
        return forwarded.split(",")[0].strip()

    # Check for real IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fall back to direct client host
    if request.client:
        return request.client.host

    return "Unknown"


@router.post("/token/{access_token}/agreement")
async def sign_agreement(
    access_token: str,
    agreement: AgreementRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Sign NDA and Testing Integrity Agreement before starting test."""
    result = await db.execute(select(Test).where(Test.access_token == access_token))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Validate signature is not empty
    signature = agreement.signature.strip()
    if not signature:
        raise HTTPException(status_code=400, detail="Signature is required")

    if not agreement.integrity_agreed:
        raise HTTPException(status_code=400, detail="Testing integrity agreement is required")

    if not agreement.nda_agreed:
        raise HTTPException(status_code=400, detail="Arbitration agreement is required")

    # Get client IP
    ip_address = get_client_ip(request)

    # Record the agreement
    now = datetime.utcnow()
    test.nda_signature = signature
    test.nda_signed_at = now
    test.nda_ip_address = ip_address
    test.integrity_agreed = True
    test.integrity_agreed_at = now

    await db.commit()

    return {
        "success": True,
        "message": "Agreement signed successfully",
        "signed_at": now.isoformat()
    }


@router.get("/{test_id}/nda-pdf")
async def download_nda_pdf(
    test_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Download signed NDA and Testing Integrity Agreement as PDF."""
    # Get test with candidate info
    query = (
        select(Test)
        .options(selectinload(Test.candidate))
        .where(Test.id == test_id)
    )
    result = await db.execute(query)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if not test.nda_signature:
        raise HTTPException(
            status_code=400,
            detail="No signed agreement found for this test"
        )

    # Generate PDF
    pdf_bytes = await nda_service.generate_signed_agreement_pdf(
        candidate_name=test.candidate.name,
        signature=test.nda_signature,
        signed_at=test.nda_signed_at or datetime.utcnow(),
        ip_address=test.nda_ip_address or "Not recorded",
        integrity_agreed=test.integrity_agreed or True,
        nda_agreed=True,  # If signature exists, NDA was agreed
    )

    # Format filename
    candidate_name_safe = test.candidate.name.replace(" ", "_")
    date_str = (test.nda_signed_at or datetime.utcnow()).strftime("%Y%m%d")
    filename = f"KOS_NDA_{candidate_name_safe}_{date_str}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
