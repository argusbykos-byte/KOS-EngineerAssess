from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ===== Task Response Schemas =====

class TaskResponseDraft(BaseModel):
    """Schema for auto-saving task response drafts."""
    task_id: str
    response_text: Optional[str] = None
    response_code: Optional[str] = None


class TaskResponseSubmit(BaseModel):
    """Schema for submitting a task response for evaluation."""
    task_id: str
    response_text: Optional[str] = None
    response_code: Optional[str] = None


class TaskResponseResponse(BaseModel):
    """Response schema for task responses."""
    id: int
    task_id: str
    response_text: Optional[str] = None
    response_code: Optional[str] = None
    is_submitted: bool = False
    submitted_at: Optional[datetime] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    version: int = 1
    edit_count: int = 0
    previous_score: Optional[float] = None
    needs_resubmit: bool = False

    class Config:
        from_attributes = True


# ===== Deliverable Schemas =====

class DeliverableCreate(BaseModel):
    """Schema for creating a deliverable."""
    deliverable_type: str  # "code", "readme", "report"
    title: Optional[str] = None
    inline_content: Optional[str] = None


class DeliverableResponse(BaseModel):
    """Response schema for deliverables."""
    id: int
    deliverable_type: str
    title: Optional[str] = None
    file_name: Optional[str] = None
    content_type: Optional[str] = None
    inline_content: Optional[str] = None
    file_size_bytes: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Challenge Submission Schemas =====

class ChallengeSubmissionCreate(BaseModel):
    """Schema for creating a challenge submission."""
    track: str


class ChallengeSubmissionResponse(BaseModel):
    """Response schema for challenge submissions."""
    id: int
    test_id: int
    track: str
    is_submitted: bool = False
    submitted_at: Optional[datetime] = None
    overall_score: Optional[float] = None
    overall_feedback: Optional[str] = None
    presentation_generated_at: Optional[datetime] = None
    task_responses: List[TaskResponseResponse] = []
    deliverables: List[DeliverableResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Draft Save Response =====

class TaskDraftSaveResponse(BaseModel):
    """Response for draft save operations."""
    success: bool
    task_id: str
    saved_at: datetime
    version: int = 1


# ===== Challenge Spec Schemas (for API responses) =====

class ChallengeTaskSpec(BaseModel):
    """Task specification from challenge specs."""
    id: str
    title: str
    description: str
    requirements: List[str]


class AutoPresentationSpec(BaseModel):
    """Auto-presentation configuration."""
    enabled: bool
    sections: List[str]


class ChallengeSpecResponse(BaseModel):
    """Full challenge specification for frontend."""
    track: str
    title: str
    short_summary: str
    tasks: List[ChallengeTaskSpec]
    deliverables: List[str]
    auto_presentation: AutoPresentationSpec
    estimated_time_hours: int


# ===== Presentation Schemas =====

class PresentationSlide(BaseModel):
    """A single slide in the presentation."""
    title: str
    content: str
    notes: Optional[str] = None


class PresentationData(BaseModel):
    """Full presentation data."""
    title: str
    candidate_name: str
    track: str
    slides: List[PresentationSlide]
    generated_at: datetime
