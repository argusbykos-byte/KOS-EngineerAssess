from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class QuestionCreate(BaseModel):
    test_id: int
    category: str
    section_order: int = 0
    question_order: int = 0
    question_text: str
    question_code: Optional[str] = None
    expected_answer: Optional[str] = None
    hints: Optional[List[str]] = None
    max_score: int = 100


class QuestionResponse(BaseModel):
    id: int
    test_id: int
    category: str
    section_order: int
    question_order: int
    question_text: str
    question_code: Optional[str] = None
    hints: Optional[List[str]] = None
    max_score: int
    created_at: datetime

    class Config:
        from_attributes = True


class AnswerSummary(BaseModel):
    id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuestionWithAnswer(QuestionResponse):
    expected_answer: Optional[str] = None
    answer: Optional[AnswerSummary] = None
