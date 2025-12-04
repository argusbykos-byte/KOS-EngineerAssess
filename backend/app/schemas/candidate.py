from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class CandidateBase(BaseModel):
    name: str
    email: EmailStr


class CandidateCreate(CandidateBase):
    test_duration_hours: int = 2
    categories: List[str] = []
    difficulty: str = "mid"


class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    test_duration_hours: Optional[int] = None
    categories: Optional[List[str]] = None
    difficulty: Optional[str] = None


class CandidateResponse(CandidateBase):
    id: int
    resume_path: Optional[str] = None
    extracted_skills: Optional[List[str]] = None
    test_duration_hours: int
    categories: List[str]
    difficulty: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestSummary(BaseModel):
    id: int
    access_token: str
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    overall_score: Optional[float] = None

    class Config:
        from_attributes = True


class CandidateWithTests(CandidateResponse):
    tests: List[TestSummary] = []
