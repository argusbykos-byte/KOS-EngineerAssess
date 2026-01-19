from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TestCreate(BaseModel):
    candidate_id: int


class BreakHistoryEntry(BaseModel):
    start: str  # ISO timestamp
    end: Optional[str] = None  # ISO timestamp, null if break ongoing
    duration_seconds: int


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

    # Test type (standard, specialization, competition)
    test_type: str = "standard"
    specialization_focus: Optional[str] = None

    # Break info
    total_break_time_seconds: int = 0
    used_break_time_seconds: int = 0
    break_count: int = 0
    is_on_break: bool = False

    # NDA and Testing Integrity Agreement info
    nda_signature: Optional[str] = None
    nda_signed_at: Optional[datetime] = None
    integrity_agreed: bool = False

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
    questions: List[dict] = []  # Flat list of all questions (for specialization tests)
    time_remaining_seconds: Optional[int] = None

    # Break info for frontend
    remaining_break_time_seconds: int = 0
    max_single_break_seconds: int = 1200  # 20 minutes default
    break_history: List[BreakHistoryEntry] = []

    # Disqualification info
    is_disqualified: bool = False
    disqualification_reason: Optional[str] = None

    # NDA and Testing Integrity Agreement info
    nda_signature: Optional[str] = None
    nda_signed_at: Optional[datetime] = None
    integrity_agreed: bool = False


class BreakStartResponse(BaseModel):
    success: bool
    message: str
    remaining_break_time_seconds: int
    max_single_break_seconds: int
    break_start_time: Optional[datetime] = None


class BreakEndResponse(BaseModel):
    success: bool
    message: str
    break_duration_seconds: int
    remaining_break_time_seconds: int
    total_used_break_time_seconds: int
