from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
import hashlib
import time
from typing import Dict, Tuple, Any
from app.database import get_db
from app.models import Answer, Question, Test, Candidate
from app.models.test import TestStatus
from app.schemas.answer import (
    AnswerSubmit, AnswerResponse, AnswerDraft, DraftSaveResponse,
    BatchAnswerSubmit, BatchAnswerResponse, BatchAnswerResultItem,
    BatchDraftSave, BatchDraftResponse, BatchDraftResultItem,
    FeedbackRequest, FeedbackResponse,
)
from app.services.ai_service import ai_service

router = APIRouter()

# Simple in-memory cache for feedback (question_id -> (feedback, timestamp, answer_hash))
_feedback_cache: Dict[int, Tuple[Dict[str, Any], float, str]] = {}
FEEDBACK_CACHE_TTL = 30  # seconds

# Threshold for flagging suspiciously fast answers (in seconds)
SUSPICIOUSLY_FAST_THRESHOLD = 30


@router.post("/draft", response_model=DraftSaveResponse)
async def save_draft(
    draft_data: AnswerDraft,
    db: AsyncSession = Depends(get_db)
):
    """Auto-save a draft answer without AI evaluation.

    This endpoint is called frequently during typing (debounced).
    It saves the answer content without triggering AI evaluation.
    Allows saving even after submission (for editing).
    """
    # Get question with test info
    query = (
        select(Question)
        .options(selectinload(Question.test))
        .where(Question.id == draft_data.question_id)
    )
    result = await db.execute(query)
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    test = question.test
    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    # Get or create answer
    answer_result = await db.execute(
        select(Answer).where(Answer.question_id == question.id)
    )
    answer = answer_result.scalar_one_or_none()

    if not answer:
        answer = Answer(question_id=question.id, version=1)
        db.add(answer)

    # Track if this is an edit to a submitted answer
    if answer.is_submitted:
        # Store previous version if not already stored
        if not answer.previous_answer and answer.candidate_answer:
            answer.previous_answer = answer.candidate_answer
            answer.previous_code = answer.candidate_code
            answer.previous_score = answer.score

        # Increment edit count and version
        answer.edit_count = (answer.edit_count or 0) + 1
        answer.version = (answer.version or 1) + 1
        answer.last_edited_at = datetime.utcnow()

        # Clear the score since content changed - needs re-evaluation
        # Keep previous_score for reference
        answer.score = None
        answer.feedback = None
        answer.ai_evaluation = None
        answer.evaluated_at = None

    # Update content
    answer.candidate_answer = draft_data.candidate_answer
    answer.candidate_code = draft_data.candidate_code
    answer.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(answer)

    return DraftSaveResponse(
        success=True,
        question_id=question.id,
        saved_at=datetime.utcnow(),
        version=answer.version or 1
    )


@router.post("/submit", response_model=AnswerResponse)
async def submit_answer(
    answer_data: AnswerSubmit,
    db: AsyncSession = Depends(get_db)
):
    """Submit an answer for a question.

    If already submitted, this is a re-submission which triggers re-evaluation.
    """
    # Get question with test info
    query = (
        select(Question)
        .options(selectinload(Question.test).selectinload(Test.candidate))
        .where(Question.id == answer_data.question_id)
    )
    result = await db.execute(query)
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    test = question.test
    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    # Get or create answer
    answer_result = await db.execute(
        select(Answer).where(Answer.question_id == question.id)
    )
    answer = answer_result.scalar_one_or_none()

    if not answer:
        answer = Answer(question_id=question.id, version=1)
        db.add(answer)

    is_resubmission = answer.is_submitted

    if is_resubmission:
        # Store previous version if changed
        if answer.candidate_answer != answer_data.candidate_answer or \
           answer.candidate_code != answer_data.candidate_code:
            if not answer.previous_answer:
                answer.previous_answer = answer.candidate_answer
                answer.previous_code = answer.candidate_code
            answer.previous_score = answer.score
            answer.version = (answer.version or 1) + 1
            answer.edit_count = (answer.edit_count or 0) + 1
            answer.last_edited_at = datetime.utcnow()

    # Update answer and mark as submitted
    answer.candidate_answer = answer_data.candidate_answer
    answer.candidate_code = answer_data.candidate_code
    answer.is_submitted = True
    answer.submitted_at = datetime.utcnow()

    # Handle time tracking
    if answer_data.time_spent_seconds is not None:
        answer.time_spent_seconds = answer_data.time_spent_seconds
        answer.is_suspiciously_fast = answer_data.time_spent_seconds < SUSPICIOUSLY_FAST_THRESHOLD

    # Evaluate answer using AI
    evaluation = await ai_service.evaluate_answer(
        question_text=question.question_text,
        question_code=question.question_code,
        expected_answer=question.expected_answer or "",
        candidate_answer=answer_data.candidate_answer or "",
        candidate_code=answer_data.candidate_code or "",
        category=question.category,
        difficulty=test.candidate.difficulty
    )

    answer.score = evaluation.get("score", 0)
    answer.feedback = evaluation.get("feedback", "")
    answer.ai_evaluation = str(evaluation)
    answer.evaluated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(answer)

    # Add computed field for needs_resubmit
    response = AnswerResponse.model_validate(answer)
    response.needs_resubmit = False  # Just submitted, so no resubmit needed

    return response


@router.get("/{answer_id}", response_model=AnswerResponse)
async def get_answer(answer_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific answer."""
    result = await db.execute(select(Answer).where(Answer.id == answer_id))
    answer = result.scalar_one_or_none()

    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    return answer


@router.post("/batch/draft", response_model=BatchDraftResponse)
async def batch_save_drafts(
    batch_data: BatchDraftSave,
    db: AsyncSession = Depends(get_db)
):
    """Save multiple draft answers at once without AI evaluation.

    This is more efficient than multiple individual calls.
    Useful for periodic background syncing.
    """
    results: list[BatchDraftResultItem] = []
    successful = 0
    failed = 0

    for draft in batch_data.drafts:
        try:
            # Get question with test info
            query = (
                select(Question)
                .options(selectinload(Question.test))
                .where(Question.id == draft.question_id)
            )
            result = await db.execute(query)
            question = result.scalar_one_or_none()

            if not question:
                results.append(BatchDraftResultItem(
                    question_id=draft.question_id,
                    success=False,
                    error="Question not found"
                ))
                failed += 1
                continue

            test = question.test
            if test.status != TestStatus.IN_PROGRESS.value:
                results.append(BatchDraftResultItem(
                    question_id=draft.question_id,
                    success=False,
                    error="Test is not in progress"
                ))
                failed += 1
                continue

            # Get or create answer
            answer_result = await db.execute(
                select(Answer).where(Answer.question_id == question.id)
            )
            answer = answer_result.scalar_one_or_none()

            if not answer:
                answer = Answer(question_id=question.id, version=1)
                db.add(answer)

            # Track if this is an edit to a submitted answer
            if answer.is_submitted:
                if not answer.previous_answer and answer.candidate_answer:
                    answer.previous_answer = answer.candidate_answer
                    answer.previous_code = answer.candidate_code
                    answer.previous_score = answer.score

                answer.edit_count = (answer.edit_count or 0) + 1
                answer.version = (answer.version or 1) + 1
                answer.last_edited_at = datetime.utcnow()
                answer.score = None
                answer.feedback = None
                answer.ai_evaluation = None
                answer.evaluated_at = None

            # Update content
            answer.candidate_answer = draft.candidate_answer
            answer.candidate_code = draft.candidate_code
            answer.updated_at = datetime.utcnow()

            results.append(BatchDraftResultItem(
                question_id=draft.question_id,
                success=True,
                version=answer.version or 1
            ))
            successful += 1

        except Exception as e:
            results.append(BatchDraftResultItem(
                question_id=draft.question_id,
                success=False,
                error=str(e)
            ))
            failed += 1

    await db.commit()

    return BatchDraftResponse(
        total=len(batch_data.drafts),
        successful=successful,
        failed=failed,
        saved_at=datetime.utcnow(),
        results=results
    )


@router.post("/batch/submit", response_model=BatchAnswerResponse)
async def batch_submit_answers(
    batch_data: BatchAnswerSubmit,
    db: AsyncSession = Depends(get_db)
):
    """Submit multiple answers at once with AI evaluation.

    Each answer is evaluated by AI and scored.
    More efficient than individual submissions for bulk operations.
    """
    results: list[BatchAnswerResultItem] = []
    successful = 0
    failed = 0

    # First, load all questions we need
    question_ids = [item.question_id for item in batch_data.answers]
    query = (
        select(Question)
        .options(selectinload(Question.test).selectinload(Test.candidate))
        .where(Question.id.in_(question_ids))
    )
    result = await db.execute(query)
    questions = {q.id: q for q in result.scalars().all()}

    for answer_data in batch_data.answers:
        try:
            question = questions.get(answer_data.question_id)

            if not question:
                results.append(BatchAnswerResultItem(
                    question_id=answer_data.question_id,
                    success=False,
                    error="Question not found"
                ))
                failed += 1
                continue

            test = question.test
            if test.status != TestStatus.IN_PROGRESS.value:
                results.append(BatchAnswerResultItem(
                    question_id=answer_data.question_id,
                    success=False,
                    error="Test is not in progress"
                ))
                failed += 1
                continue

            # Get or create answer
            answer_result = await db.execute(
                select(Answer).where(Answer.question_id == question.id)
            )
            answer = answer_result.scalar_one_or_none()

            if not answer:
                answer = Answer(question_id=question.id, version=1)
                db.add(answer)

            is_resubmission = answer.is_submitted

            if is_resubmission:
                if answer.candidate_answer != answer_data.candidate_answer or \
                   answer.candidate_code != answer_data.candidate_code:
                    if not answer.previous_answer:
                        answer.previous_answer = answer.candidate_answer
                        answer.previous_code = answer.candidate_code
                    answer.previous_score = answer.score
                    answer.version = (answer.version or 1) + 1
                    answer.edit_count = (answer.edit_count or 0) + 1
                    answer.last_edited_at = datetime.utcnow()

            # Update answer and mark as submitted
            answer.candidate_answer = answer_data.candidate_answer
            answer.candidate_code = answer_data.candidate_code
            answer.is_submitted = True
            answer.submitted_at = datetime.utcnow()

            if answer_data.time_spent_seconds is not None:
                answer.time_spent_seconds = answer_data.time_spent_seconds
                answer.is_suspiciously_fast = answer_data.time_spent_seconds < SUSPICIOUSLY_FAST_THRESHOLD

            # Evaluate answer using AI
            evaluation = await ai_service.evaluate_answer(
                question_text=question.question_text,
                question_code=question.question_code,
                expected_answer=question.expected_answer or "",
                candidate_answer=answer_data.candidate_answer or "",
                candidate_code=answer_data.candidate_code or "",
                category=question.category,
                difficulty=test.candidate.difficulty
            )

            answer.score = evaluation.get("score", 0)
            answer.feedback = evaluation.get("feedback", "")
            answer.ai_evaluation = str(evaluation)
            answer.evaluated_at = datetime.utcnow()

            results.append(BatchAnswerResultItem(
                question_id=answer_data.question_id,
                success=True,
                score=answer.score,
                feedback=answer.feedback
            ))
            successful += 1

        except Exception as e:
            results.append(BatchAnswerResultItem(
                question_id=answer_data.question_id,
                success=False,
                error=str(e)
            ))
            failed += 1

    await db.commit()

    return BatchAnswerResponse(
        total=len(batch_data.answers),
        successful=successful,
        failed=failed,
        results=results
    )


@router.post("/feedback", response_model=FeedbackResponse)
async def get_live_feedback(
    request: FeedbackRequest,
    db: AsyncSession = Depends(get_db)
):
    """Get real-time AI feedback for an in-progress answer.

    This is a lightweight endpoint designed for live feedback while typing.
    It returns hints, missing points, and strengths without full evaluation.
    Uses caching to avoid repeated AI calls for similar content.
    """
    # Check if answer content is sufficient
    answer_text = request.candidate_answer or ""
    code_text = request.candidate_code or ""

    if len(answer_text.strip()) < 20 and not code_text.strip():
        return FeedbackResponse(
            hints=[],
            missing_points=[],
            strengths=[],
            status="too_short"
        )

    # Create hash of the answer for cache lookup
    content_hash = hashlib.md5(
        f"{answer_text}{code_text}".encode()
    ).hexdigest()[:16]

    # Check cache
    cached = _feedback_cache.get(request.question_id)
    if cached:
        cached_feedback, cached_time, cached_hash = cached
        # Return cached if within TTL and answer hasn't changed significantly
        if time.time() - cached_time < FEEDBACK_CACHE_TTL and cached_hash == content_hash:
            return FeedbackResponse(
                hints=cached_feedback.get("hints", []),
                missing_points=cached_feedback.get("missing_points", []),
                strengths=cached_feedback.get("strengths", []),
                status="cached"
            )

    # Get question details
    query = (
        select(Question)
        .options(selectinload(Question.test))
        .where(Question.id == request.question_id)
    )
    result = await db.execute(query)
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    test = question.test
    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    # Call AI service for lightweight feedback
    feedback = await ai_service.generate_live_feedback(
        question_text=question.question_text,
        question_code=question.question_code,
        expected_answer=question.expected_answer or "",
        candidate_answer=answer_text,
        candidate_code=code_text if code_text else None,
        category=question.category
    )

    # Cache the result
    _feedback_cache[request.question_id] = (feedback, time.time(), content_hash)

    return FeedbackResponse(
        hints=feedback.get("hints", []),
        missing_points=feedback.get("missing_points", []),
        strengths=feedback.get("strengths", []),
        status=feedback.get("status", "success")
    )
