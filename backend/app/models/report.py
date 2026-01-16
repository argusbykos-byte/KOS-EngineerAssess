from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)

    overall_score = Column(Float, nullable=True)  # 0-100
    recommendation = Column(String(50), nullable=True)  # strong_hire, hire, maybe, no_hire

    # Section scores
    brain_teaser_score = Column(Float, nullable=True)
    coding_score = Column(Float, nullable=True)
    code_review_score = Column(Float, nullable=True)
    system_design_score = Column(Float, nullable=True)
    signal_processing_score = Column(Float, nullable=True)
    general_engineering_score = Column(Float, nullable=True)

    # Detailed analysis
    strengths = Column(JSON, nullable=True)
    weaknesses = Column(JSON, nullable=True)
    detailed_feedback = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)

    # Dual scoring system (Phase 3)
    general_score = Column(Float, nullable=True)  # Out of 500 (5 categories x 100)
    specialization_score = Column(Float, nullable=True)  # Out of 500 (5 questions x 100)
    specialization_track = Column(String(50), nullable=True)  # Track ID like "ai_researcher"
    specialist_recommendation = Column(String(50), nullable=True)  # strong_hire, hire, specialist_hire, consider, no_hire

    generated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    test = relationship("Test", back_populates="report")
    certificate = relationship("Certificate", back_populates="report", uselist=False, cascade="all, delete-orphan")
