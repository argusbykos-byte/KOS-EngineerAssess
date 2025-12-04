from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AnswerCreate(BaseModel):
    question_id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None


class AnswerSubmit(BaseModel):
    question_id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None
    time_spent_seconds: Optional[int] = None


class AnswerResponse(BaseModel):
    id: int
    question_id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    ai_evaluation: Optional[str] = None
    submitted_at: Optional[datetime] = None
    evaluated_at: Optional[datetime] = None
    time_spent_seconds: Optional[int] = None
    is_suspiciously_fast: Optional[bool] = None

    class Config:
        from_attributes = True
