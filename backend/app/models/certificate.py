from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.utils.timezone import get_pacific_date_iso
import uuid


def generate_certificate_id():
    """Generate unique certificate ID in format KOS-YYYYMMDD-XXXXX.

    Uses Pacific Time for the date portion since KOS is based in California.
    """
    date_part = get_pacific_date_iso(datetime.utcnow()).replace("-", "")
    unique_part = uuid.uuid4().hex[:5].upper()
    return f"KOS-{date_part}-{unique_part}"


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, unique=True)

    # Unique certificate identifier for verification
    certificate_id = Column(String(50), unique=True, nullable=False, index=True, default=generate_certificate_id)

    # Certificate details
    candidate_name = Column(String(255), nullable=False)
    test_date = Column(DateTime, nullable=False)
    track = Column(String(100), nullable=True)  # e.g., "Biomedical Engineer", "ML Engineer"

    # Score tier based on overall_score
    # Distinguished: 90-100, Proficient: 75-89, Passed: 60-74, Did Not Pass: <60
    score_tier = Column(String(50), nullable=False)
    overall_score = Column(Integer, nullable=False)

    # PDF certificate stored as binary
    pdf_data = Column(LargeBinary, nullable=True)
    pdf_filename = Column(String(255), nullable=True)

    # Verification URL (for QR code)
    verification_url = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    report = relationship("Report", back_populates="certificate")


def get_score_tier(score: float) -> str:
    """Determine score tier based on overall score."""
    if score >= 90:
        return "Distinguished"
    elif score >= 75:
        return "Proficient"
    elif score >= 60:
        return "Passed"
    else:
        return "Did Not Pass"
