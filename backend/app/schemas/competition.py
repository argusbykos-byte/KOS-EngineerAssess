from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime


# Competition Schemas
class CompetitionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    screening_start_date: Optional[datetime] = None
    screening_deadline: Optional[datetime] = None
    live_competition_date: Optional[datetime] = None
    max_participants: int = 30000
    qualified_count: int = 500
    test_duration_minutes: int = 60
    questions_count: int = 20


class CompetitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    screening_start_date: Optional[datetime] = None
    screening_deadline: Optional[datetime] = None
    live_competition_date: Optional[datetime] = None
    max_participants: Optional[int] = None
    qualified_count: Optional[int] = None
    status: Optional[str] = None
    test_duration_minutes: Optional[int] = None
    questions_count: Optional[int] = None


class CompetitionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    screening_start_date: Optional[datetime] = None
    screening_deadline: Optional[datetime] = None
    live_competition_date: Optional[datetime] = None
    max_participants: int
    qualified_count: int
    status: str
    test_duration_minutes: int
    questions_count: int
    passing_percentile: float
    created_at: datetime
    updated_at: datetime
    registration_count: int = 0
    completed_count: int = 0

    class Config:
        from_attributes = True


class CompetitionDetail(CompetitionResponse):
    registrations: List["RegistrationSummary"] = []


# Registration Schemas
class RegistrationCreate(BaseModel):
    name: str
    email: EmailStr


class RegistrationResponse(BaseModel):
    id: int
    competition_id: int
    candidate_id: int
    registration_token: str
    registered_at: datetime
    screening_completed: bool
    screening_score: Optional[float] = None
    screening_percentile: Optional[float] = None
    is_qualified: bool
    qualified_at: Optional[datetime] = None
    qualification_rank: Optional[int] = None
    candidate_name: str
    candidate_email: str

    class Config:
        from_attributes = True


class RegistrationSummary(BaseModel):
    id: int
    candidate_id: int
    candidate_name: str
    candidate_email: str
    registered_at: datetime
    screening_completed: bool
    screening_score: Optional[float] = None
    is_qualified: bool
    qualification_rank: Optional[int] = None

    class Config:
        from_attributes = True


class RegistrationWithToken(BaseModel):
    registration_id: int
    registration_token: str
    candidate_id: int
    candidate_name: str
    candidate_email: str
    competition_name: str
    screening_start_date: Optional[datetime] = None
    screening_deadline: Optional[datetime] = None


# Screening Test Schemas
class ScreeningTestResponse(BaseModel):
    registration_id: int
    competition_name: str
    candidate_name: str
    test_duration_minutes: int
    questions_count: int
    screening_deadline: Optional[datetime] = None
    screening_started: bool
    screening_completed: bool
    test_id: Optional[int] = None
    test_status: Optional[str] = None
    test_access_token: Optional[str] = None
    time_remaining_seconds: Optional[int] = None
    questions_by_section: Optional[dict] = None

    class Config:
        from_attributes = True


class ScreeningSubmission(BaseModel):
    answers: List["AnswerSubmission"]
    time_per_question: List["QuestionTiming"]


class AnswerSubmission(BaseModel):
    question_id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None
    time_spent_seconds: int


class QuestionTiming(BaseModel):
    question_id: int
    time_seconds: float
    question_category: Optional[str] = None


class ScreeningResult(BaseModel):
    registration_id: int
    competition_name: str
    candidate_name: str
    screening_completed: bool
    screening_score: Optional[float] = None
    screening_percentile: Optional[float] = None
    is_qualified: Optional[bool] = None
    qualification_rank: Optional[int] = None
    total_questions: int
    questions_answered: int
    behavioral_metrics: Optional["BehavioralMetricsResponse"] = None

    class Config:
        from_attributes = True


# Behavioral Metrics Schemas
class BehavioralMetricsResponse(BaseModel):
    id: int
    registration_id: int
    time_per_question: List[Any]
    average_response_time: Optional[float] = None
    fastest_response: Optional[float] = None
    slowest_response: Optional[float] = None
    median_response_time: Optional[float] = None
    suspiciously_fast_count: int
    suspiciously_slow_count: int
    consistency_score: float
    anomaly_flags: List[Any]
    risk_score: float
    risk_factors: List[Any]

    class Config:
        from_attributes = True


# Rankings Schemas
class RankingEntry(BaseModel):
    rank: int
    registration_id: int
    candidate_id: int
    candidate_name: str
    candidate_email: str
    screening_score: float
    screening_completed_at: Optional[datetime] = None
    is_qualified: bool
    risk_score: float
    consistency_score: float

    class Config:
        from_attributes = True


class RankingsResponse(BaseModel):
    competition_id: int
    competition_name: str
    total_registrations: int
    completed_screenings: int
    qualified_count: int
    rankings: List[RankingEntry]
    cutoff_score: Optional[float] = None


class QualifyResponse(BaseModel):
    success: bool
    message: str
    qualified_count: int
    cutoff_score: float


# Update forward references
CompetitionDetail.model_rebuild()
ScreeningSubmission.model_rebuild()
ScreeningResult.model_rebuild()
