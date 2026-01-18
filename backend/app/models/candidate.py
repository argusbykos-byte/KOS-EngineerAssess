from sqlalchemy import Column, Integer, String, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    resume_path = Column(String(500), nullable=True)
    resume_text = Column(Text, nullable=True)
    extracted_skills = Column(JSON, nullable=True)

    # Test settings
    test_duration_hours = Column(Integer, default=2)
    categories = Column(JSON, default=list)  # ["backend", "ml", "fullstack", etc.]
    difficulty = Column(String(50), default="mid")  # junior, mid, senior

    # Challenge track (signal_processing or llm)
    # This is determined by AI analysis of resume
    track = Column(String(50), nullable=True)  # "signal_processing" or "llm"

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tests = relationship("Test", back_populates="candidate", cascade="all, delete-orphan")
    competition_registrations = relationship("CompetitionRegistration", back_populates="candidate", cascade="all, delete-orphan")
    specialization_results = relationship("SpecializationResult", back_populates="candidate", cascade="all, delete-orphan")
