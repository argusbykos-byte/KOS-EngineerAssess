from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.database import get_db
from app.models import Answer, Question, Test, Candidate
from app.models.test import TestStatus
from app.schemas.answer import AnswerSubmit, AnswerResponse
from app.services.ai_service import ai_service

router = APIRouter()

# Threshold for flagging suspiciously fast answers (in seconds)
SUSPICIOUSLY_FAST_THRESHOLD = 30


@router.post("/submit", response_model=AnswerResponse)
async def submit_answer(
    answer_data: AnswerSubmit,
    db: AsyncSession = Depends(get_db)
):
    """Submit an answer for a question."""
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
        answer = Answer(question_id=question.id)
        db.add(answer)

    # Update answer
    answer.candidate_answer = answer_data.candidate_answer
    answer.candidate_code = answer_data.candidate_code
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

    return answer


@router.get("/{answer_id}", response_model=AnswerResponse)
async def get_answer(answer_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific answer."""
    result = await db.execute(select(Answer).where(Answer.id == answer_id))
    answer = result.scalar_one_or_none()

    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    return answer
