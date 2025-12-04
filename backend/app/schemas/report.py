from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ReportCreate(BaseModel):
    test_id: int


class ReportResponse(BaseModel):
    id: int
    test_id: int
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None

    brain_teaser_score: Optional[float] = None
    coding_score: Optional[float] = None
    code_review_score: Optional[float] = None
    system_design_score: Optional[float] = None
    signal_processing_score: Optional[float] = None

    strengths: Optional[List[str]] = None
    weaknesses: Optional[List[str]] = None
    detailed_feedback: Optional[str] = None
    ai_summary: Optional[str] = None

    generated_at: datetime

    class Config:
        from_attributes = True


class ReportWithCandidate(ReportResponse):
    candidate_name: str
    candidate_email: str
    test_duration_hours: int
    categories: List[str]
    difficulty: str

    # Anti-cheat data
    tab_switch_count: Optional[int] = None
    tab_switch_timestamps: Optional[List[str]] = None
    paste_attempt_count: Optional[int] = None
