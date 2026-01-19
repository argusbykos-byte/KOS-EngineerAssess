"""
Application Portal Schemas

Pydantic models for application submission and skill assessment API.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ApplicationStatus(str, Enum):
    """Status progression for applications"""
    PENDING = "pending"
    REVIEWING = "reviewing"
    SKILLS_ASSESSMENT = "skills_assessment"
    ANALYZED = "analyzed"
    TEST_GENERATED = "test_generated"
    TEST_IN_PROGRESS = "test_in_progress"
    COMPLETED = "completed"
    HIRED = "hired"
    REJECTED = "rejected"


class AvailabilityChoice(str, Enum):
    """Availability options"""
    YES = "yes"
    NO = "no"
    NEED_TO_DISCUSS = "need_to_discuss"


class SkillCategory(str, Enum):
    """Skill categories"""
    TECHNICAL = "technical"
    LANGUAGES = "languages"
    FRAMEWORKS = "frameworks"
    TOOLS = "tools"
    COMPETENCIES = "competencies"


# =============================================================================
# Skill Assessment Schemas
# =============================================================================

class SkillAssessmentCreate(BaseModel):
    """Create a single skill assessment"""
    category: SkillCategory
    skill_name: str
    self_rating: int = Field(..., ge=1, le=10, description="Self rating 1-10")


class SkillAssessmentBatchCreate(BaseModel):
    """Create multiple skill assessments at once"""
    assessments: List[SkillAssessmentCreate]


class SkillAssessmentResponse(BaseModel):
    """Skill assessment response"""
    id: int
    category: str
    skill_name: str
    self_rating: Optional[int] = None
    kimi_rating: Optional[int] = None
    kimi_confidence: Optional[float] = None
    kimi_evidence: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SkillFormItem(BaseModel):
    """Single skill item for the form"""
    category: str
    skill_name: str
    current_rating: Optional[int] = None


class SkillFormResponse(BaseModel):
    """Full skill form with all skills to rate"""
    categories: Dict[str, List[SkillFormItem]]
    total_skills: int
    completed_skills: int


# =============================================================================
# Application Schemas
# =============================================================================

class ApplicationCreate(BaseModel):
    """Create a new application (public submission)"""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=255)

    graduation_date: Optional[str] = Field(None, max_length=50)
    preferred_start_date: Optional[str] = Field(None, max_length=100)
    availability: AvailabilityChoice = AvailabilityChoice.NEED_TO_DISCUSS
    preferred_trial_date: Optional[str] = Field(None, max_length=100)

    self_description: Optional[str] = Field(None, max_length=255)
    motivation: Optional[str] = None
    admired_engineers: Optional[str] = None
    overall_self_rating: Optional[int] = Field(None, ge=1, le=100)
    unique_trait: Optional[str] = None


class ApplicationUpdate(BaseModel):
    """Update application (admin)"""
    status: Optional[ApplicationStatus] = None
    admin_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    suggested_position: Optional[str] = None
    position_fit_score: Optional[float] = Field(None, ge=0, le=100)


class ApplicationResponse(BaseModel):
    """Public application response (for candidate view)"""
    id: int
    full_name: str
    email: str
    application_token: str
    status: str
    self_description: Optional[str] = None

    # Progress indicators
    has_resume: bool = False
    skills_completed: bool = False
    skills_submitted_at: Optional[datetime] = None

    # Kimi analysis summary (if available)
    suggested_position: Optional[str] = None
    position_fit_score: Optional[float] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationDetailResponse(ApplicationResponse):
    """Detailed application response (includes all fields)"""
    phone: Optional[str] = None
    location: Optional[str] = None
    graduation_date: Optional[str] = None
    preferred_start_date: Optional[str] = None
    availability: Optional[str] = None
    preferred_trial_date: Optional[str] = None
    motivation: Optional[str] = None
    admired_engineers: Optional[str] = None
    overall_self_rating: Optional[int] = None
    unique_trait: Optional[str] = None
    resume_filename: Optional[str] = None
    resume_text: Optional[str] = None
    skill_assessments: List[SkillAssessmentResponse] = []


class CandidateTestSummary(BaseModel):
    """Summary of a test for admin view"""
    id: int
    access_token: str
    status: str
    test_type: Optional[str] = None
    specialization_focus: Optional[str] = None
    created_at: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    overall_score: Optional[float] = None
    has_report: bool = False


class ApplicationAdminResponse(ApplicationDetailResponse):
    """Admin view with all fields including internal data"""
    kimi_analysis: Optional[Dict[str, Any]] = None
    admin_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    candidate_id: Optional[int] = None
    test_access_token: Optional[str] = None  # Access token for the most recent test (backward compat)
    tests: List[CandidateTestSummary] = []  # All tests for this candidate


class ApplicationSubmitResponse(BaseModel):
    """Response after submitting application"""
    application_token: str
    message: str
    next_step: str


class ApplicationListItem(BaseModel):
    """Application list item for admin view"""
    id: int
    full_name: str
    email: str
    self_description: Optional[str] = None
    status: str
    suggested_position: Optional[str] = None
    position_fit_score: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    has_resume: bool = False
    skills_completed: bool = False

    class Config:
        from_attributes = True


class ApplicationListResponse(BaseModel):
    """Paginated list of applications"""
    items: List[ApplicationListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================================================
# Kimi Analysis Schemas
# =============================================================================

class KimiSkillAnalysis(BaseModel):
    """Kimi's analysis of a single skill"""
    skill_name: str
    rating: int = Field(..., ge=1, le=10)
    confidence: float = Field(..., ge=0, le=1)
    evidence: Optional[str] = None


class KimiAnalysisResult(BaseModel):
    """Full Kimi analysis result"""
    suggested_position: str
    position_fit_score: float = Field(..., ge=0, le=100)
    skill_ratings: List[KimiSkillAnalysis]
    strengths: List[str]
    areas_for_growth: List[str]
    overall_assessment: str
    recommendation: str  # "strong_candidate", "good_candidate", "potential", "not_recommended"
    analysis_timestamp: datetime


class AnalyzeRequest(BaseModel):
    """Request to trigger Kimi analysis"""
    force_reanalyze: bool = False


class AnalyzeResponse(BaseModel):
    """Response from analysis"""
    success: bool
    message: str
    analysis: Optional[KimiAnalysisResult] = None


# =============================================================================
# Admin Actions
# =============================================================================

class CreateCandidateRequest(BaseModel):
    """Request to convert application to candidate"""
    test_duration_hours: int = Field(default=2, ge=1, le=8)
    categories: List[str] = []
    difficulty: str = "mid"


class CreateCandidateResponse(BaseModel):
    """Response after creating candidate from application"""
    success: bool
    candidate_id: int
    test_id: int
    access_token: str
    message: str
