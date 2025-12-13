from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CertificateResponse(BaseModel):
    id: int
    report_id: int
    certificate_id: str
    candidate_name: str
    test_date: datetime
    track: Optional[str] = None
    score_tier: str
    overall_score: int
    verification_url: Optional[str] = None
    created_at: datetime
    has_pdf: bool = False

    class Config:
        from_attributes = True


class CertificateVerification(BaseModel):
    """Response for certificate verification endpoint."""
    valid: bool
    certificate_id: str
    candidate_name: Optional[str] = None
    test_date: Optional[datetime] = None
    track: Optional[str] = None
    score_tier: Optional[str] = None
    overall_score: Optional[int] = None
    issued_by: str = "KOS (Kernel of Science)"
    message: Optional[str] = None
