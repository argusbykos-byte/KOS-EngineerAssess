from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TestCreate(BaseModel):
    candidate_id: int


class TestResponse(BaseModel):
    id: int
    candidate_id: int
    access_token: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_hours: int
    status: str
    current_section: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TestStart(BaseModel):
    access_token: str


class QuestionSummary(BaseModel):
    id: int
    category: str
    question_order: int
    question_text: str
    question_code: Optional[str] = None
    max_score: int
    is_answered: bool = False

    class Config:
        from_attributes = True


class TestWithQuestions(TestResponse):
    candidate_name: str
    candidate_email: str
    categories: List[str]
    difficulty: str
    questions_by_section: dict  # category -> list of questions
    time_remaining_seconds: Optional[int] = None
