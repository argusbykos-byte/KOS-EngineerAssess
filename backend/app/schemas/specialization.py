"""
Specialization Test Schemas

Pydantic models for specialization test API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class FocusArea(str, Enum):
    """Available focus areas for specialization tests"""
    ML = "ml"
    EMBEDDED = "embedded"
    BIOMEDICAL = "biomedical"
    SIGNAL_PROCESSING = "signal_processing"
    FRONTEND = "frontend"
    BACKEND = "backend"
    CYBERSECURITY = "cybersecurity"


# =============================================================================
# Request Schemas
# =============================================================================

class GenerateSpecializationTestRequest(BaseModel):
    """Request to generate a specialization test"""
    candidate_id: int
    focus_area: str  # FocusArea enum value
    duration_minutes: int = Field(default=60, ge=30, le=120)
    parent_test_id: Optional[int] = None  # Optional: link to completed test for richer context


class AnalyzeSpecializationResultsRequest(BaseModel):
    """Request to analyze specialization test results"""
    test_id: int


# =============================================================================
# Response Schemas
# =============================================================================

class SubSpecialtyScore(BaseModel):
    """Score for a sub-specialty"""
    name: str
    score: float
    rank: int
    evidence: Optional[str] = None


class FocusAreaInfo(BaseModel):
    """Information about a focus area"""
    id: str
    name: str
    description: str
    sub_specialties: Optional[List[str]] = None


class SpecializationResultResponse(BaseModel):
    """Response for specialization result"""
    id: int
    test_id: int
    candidate_id: int
    candidate_name: Optional[str] = None
    focus_area: str
    primary_specialty: Optional[str] = None
    specialty_score: Optional[float] = None
    confidence: Optional[float] = None
    sub_specialties: List[SubSpecialtyScore] = []
    recommended_tasks: List[str] = []
    team_fit_analysis: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateSpecializationTestResponse(BaseModel):
    """Response after generating a specialization test"""
    success: bool
    message: str
    test_id: Optional[int] = None
    access_token: Optional[str] = None
    questions_generated: int = 0


class SpecializationTestListItem(BaseModel):
    """Item in specialization test list"""
    id: int
    test_id: int
    access_token: str
    candidate_id: int
    candidate_name: str
    focus_area: str
    primary_specialty: Optional[str] = None
    specialty_score: Optional[float] = None
    status: str
    created_at: datetime


class SpecializationTestListResponse(BaseModel):
    """List of specialization tests"""
    items: List[SpecializationTestListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class SpecializationQuestionGenerated(BaseModel):
    """Generated specialization question"""
    question_text: str
    question_code: Optional[str] = None
    expected_answer: Optional[str] = None
    hints: Optional[List[str]] = None
    tests_sub_specialty: str  # Which sub-specialty this question tests


class TeamCompositionSuggestion(BaseModel):
    """Suggestion for team composition"""
    candidate_id: int
    candidate_name: str
    primary_specialty: str
    recommended_role: str
    team_fit_notes: str
    synergy_with: List[str] = []


class TeamBuilderResponse(BaseModel):
    """Response for team builder"""
    candidates: List[SpecializationResultResponse]
    composition_suggestions: List[TeamCompositionSuggestion]
    focus_area_groups: Dict[str, List[int]]  # focus_area -> list of candidate_ids
