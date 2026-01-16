"""
Application Portal Models

Models for public application submission and skill self-assessment.
This is a separate system from the existing candidate/test workflow.
"""

import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    DateTime,
    ForeignKey,
    JSON,
    Enum,
)
from sqlalchemy.orm import relationship
from app.database import Base


class ApplicationStatus(str, enum.Enum):
    """Status progression for applications"""
    PENDING = "pending"                    # Initial submission
    REVIEWING = "reviewing"                # Under HR/hiring review
    SKILLS_ASSESSMENT = "skills_assessment"  # Skill self-rating in progress
    ANALYZED = "analyzed"                  # Kimi2 analysis complete
    TEST_GENERATED = "test_generated"      # Test created for candidate
    TEST_IN_PROGRESS = "test_in_progress"  # Candidate taking test
    COMPLETED = "completed"                # All assessments complete
    HIRED = "hired"                        # Accepted
    REJECTED = "rejected"                  # Not moving forward


class AvailabilityChoice(str, enum.Enum):
    """Availability options for candidates"""
    YES = "yes"
    NO = "no"
    NEED_TO_DISCUSS = "need_to_discuss"


class SkillCategory(str, enum.Enum):
    """Categories for skill assessment"""
    TECHNICAL = "technical"
    LANGUAGES = "languages"
    FRAMEWORKS = "frameworks"
    TOOLS = "tools"
    COMPETENCIES = "competencies"


class Application(Base):
    """
    Public application submission model.

    Candidates submit their application through a public form,
    receive a unique token, and can track their application status.
    """
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)

    # Personal Information
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    location = Column(String(255), nullable=True)

    # Education & Availability
    graduation_date = Column(String(50), nullable=True)  # e.g., "May 2025", "Already graduated"
    preferred_start_date = Column(String(100), nullable=True)
    availability = Column(
        Enum(AvailabilityChoice, values_callable=lambda x: [e.value for e in x]),
        default=AvailabilityChoice.NEED_TO_DISCUSS,
        nullable=False
    )
    preferred_trial_date = Column(String(100), nullable=True)

    # Self-Description
    self_description = Column(String(255), nullable=True)  # e.g., "AI Researcher", "ML Engineer"
    motivation = Column(Text, nullable=True)  # One sentence motivation
    admired_engineers = Column(Text, nullable=True)  # Engineers they admire and why
    overall_self_rating = Column(Integer, nullable=True)  # 1-100
    unique_trait = Column(Text, nullable=True)  # What makes them unique

    # Resume
    resume_path = Column(String(500), nullable=True)  # Path to uploaded resume
    resume_text = Column(Text, nullable=True)  # Extracted text from resume
    resume_filename = Column(String(255), nullable=True)  # Original filename

    # Application Token (for candidate access)
    application_token = Column(String(64), unique=True, nullable=False, index=True)

    # Status & Processing
    # Use values_callable to store enum values (lowercase) instead of names (uppercase)
    status = Column(
        Enum(ApplicationStatus, values_callable=lambda x: [e.value for e in x]),
        default=ApplicationStatus.PENDING,
        nullable=False,
        index=True
    )

    # Kimi2 Analysis Results
    kimi_analysis = Column(JSON, nullable=True)  # Full analysis response
    suggested_position = Column(String(255), nullable=True)  # Kimi's suggested role
    position_fit_score = Column(Float, nullable=True)  # 0-100 fit score

    # Link to existing candidate system (after conversion)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=True)

    # Admin notes
    admin_notes = Column(Text, nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    skills_submitted_at = Column(DateTime, nullable=True)

    # Relationships
    skill_assessments = relationship(
        "SkillAssessment",
        back_populates="application",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Application(id={self.id}, name='{self.full_name}', status='{self.status}')>"


class SkillAssessment(Base):
    """
    Individual skill self-assessment and Kimi2 rating.

    Candidates rate themselves on various skills, and Kimi2
    provides an objective rating based on resume analysis.
    """
    __tablename__ = "skill_assessments"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key to application
    application_id = Column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Skill identification
    category = Column(Enum(SkillCategory, values_callable=lambda x: [e.value for e in x]), nullable=False)
    skill_name = Column(String(255), nullable=False)

    # Ratings
    self_rating = Column(Integer, nullable=True)  # 1-10, candidate's self-assessment
    kimi_rating = Column(Integer, nullable=True)  # 1-10, Kimi2's assessment from resume

    # Kimi2 analysis details
    kimi_confidence = Column(Float, nullable=True)  # 0-1, confidence in kimi_rating
    kimi_evidence = Column(Text, nullable=True)  # Supporting evidence from resume

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship
    application = relationship("Application", back_populates="skill_assessments")

    def __repr__(self):
        return f"<SkillAssessment(skill='{self.skill_name}', self={self.self_rating}, kimi={self.kimi_rating})>"
