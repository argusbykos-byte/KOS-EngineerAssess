from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.database import get_db
from app.models import Question, Test
from app.schemas.question import QuestionResponse, QuestionWithAnswer

router = APIRouter()


@router.get("/test/{test_id}", response_model=List[QuestionWithAnswer])
async def get_questions_by_test(test_id: int, db: AsyncSession = Depends(get_db)):
    """Get all questions for a test (admin view with answers)."""
    query = (
        select(Question)
        .options(selectinload(Question.answer))
        .where(Question.test_id == test_id)
        .order_by(Question.section_order, Question.question_order)
    )
    result = await db.execute(query)
    questions = result.scalars().all()

    response = []
    for q in questions:
        answer_data = None
        if q.answer:
            answer_data = {
                "id": q.answer.id,
                "candidate_answer": q.answer.candidate_answer,
                "candidate_code": q.answer.candidate_code,
                "score": q.answer.score,
                "feedback": q.answer.feedback,
                "submitted_at": q.answer.submitted_at
            }

        response.append(QuestionWithAnswer(
            id=q.id,
            test_id=q.test_id,
            category=q.category,
            section_order=q.section_order,
            question_order=q.question_order,
            question_text=q.question_text,
            question_code=q.question_code,
            hints=q.hints,
            max_score=q.max_score,
            created_at=q.created_at,
            expected_answer=q.expected_answer,
            answer=answer_data
        ))

    return response


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific question."""
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    return question
