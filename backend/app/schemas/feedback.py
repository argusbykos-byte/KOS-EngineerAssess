from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class SuggestionSubmit(BaseModel):
    """Request model for submitting a feedback suggestion."""
    raw_feedback: str = Field(..., min_length=10, max_length=5000)
    test_access_token: Optional[str] = None


class KimiAnalysis(BaseModel):
    """Kimi2 AI analysis result for a suggestion."""
    is_valid: bool
    category: str
    priority: str
    can_auto_implement: bool
    suggested_action: str
    extracted_content: Optional[Dict[str, Any]] = None
    reasoning: str


class SuggestionResponse(BaseModel):
    """Response model for a single suggestion."""
    id: int
    candidate_id: Optional[int] = None
    test_id: Optional[int] = None
    raw_feedback: str
    kimi2_analysis: Optional[KimiAnalysis] = None
    claude_code_command: Optional[str] = None
    status: str
    implemented_at: Optional[datetime] = None
    implemented_by: Optional[str] = None
    implementation_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SuggestionListResponse(BaseModel):
    """Response model for listing suggestions with pagination."""
    suggestions: List[SuggestionResponse]
    total: int
    pending_count: int
    auto_implemented_count: int


class SuggestionUpdate(BaseModel):
    """Request model for admin to update a suggestion."""
    status: Optional[str] = None
    implementation_notes: Optional[str] = None


class AutoImplementResult(BaseModel):
    """Result of auto-implementation attempt."""
    success: bool
    message: str
    changes_made: Optional[List[str]] = None


class SuggestionSubmitResponse(BaseModel):
    """Response after submitting a suggestion."""
    id: int
    message: str
    analysis: Optional[KimiAnalysis] = None
    auto_implemented: bool = False
    auto_implement_result: Optional[AutoImplementResult] = None
