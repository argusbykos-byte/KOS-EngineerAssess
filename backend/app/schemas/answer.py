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


class AnswerDraft(BaseModel):
    """Schema for auto-saving draft answers (no AI evaluation)"""
    question_id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None


class AnswerResponse(BaseModel):
    id: int
    question_id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    ai_evaluation: Optional[str] = None
    is_submitted: Optional[bool] = False
    submitted_at: Optional[datetime] = None
    evaluated_at: Optional[datetime] = None
    time_spent_seconds: Optional[int] = None
    is_suspiciously_fast: Optional[bool] = None
    # Version tracking
    version: Optional[int] = 1
    edit_count: Optional[int] = 0
    previous_score: Optional[float] = None
    needs_resubmit: Optional[bool] = False  # True if edited after submission

    class Config:
        from_attributes = True


class DraftSaveResponse(BaseModel):
    """Response for draft save operations"""
    success: bool
    question_id: int
    saved_at: datetime
    version: Optional[int] = 1


class BatchAnswerItem(BaseModel):
    """Single answer item for batch operations"""
    question_id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None
    time_spent_seconds: Optional[int] = None


class BatchAnswerSubmit(BaseModel):
    """Batch answer submission request"""
    answers: list[BatchAnswerItem]


class BatchAnswerResultItem(BaseModel):
    """Result of a single answer in batch submission"""
    question_id: int
    success: bool
    score: Optional[float] = None
    feedback: Optional[str] = None
    error: Optional[str] = None


class BatchAnswerResponse(BaseModel):
    """Response for batch answer operations"""
    total: int
    successful: int
    failed: int
    results: list[BatchAnswerResultItem]


class BatchDraftItem(BaseModel):
    """Single draft item for batch save"""
    question_id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None


class BatchDraftSave(BaseModel):
    """Batch draft save request"""
    drafts: list[BatchDraftItem]


class BatchDraftResultItem(BaseModel):
    """Result of a single draft save in batch"""
    question_id: int
    success: bool
    version: Optional[int] = None
    error: Optional[str] = None


class BatchDraftResponse(BaseModel):
    """Response for batch draft save operations"""
    total: int
    successful: int
    failed: int
    saved_at: datetime
    results: list[BatchDraftResultItem]


class FeedbackRequest(BaseModel):
    """Request for real-time AI feedback on an in-progress answer"""
    question_id: int
    candidate_answer: Optional[str] = None
    candidate_code: Optional[str] = None


class FeedbackResponse(BaseModel):
    """Response with real-time AI feedback"""
    hints: list[str] = []
    missing_points: list[str] = []
    strengths: list[str] = []
    status: str = "success"  # success, too_short, ai_unavailable, cached
