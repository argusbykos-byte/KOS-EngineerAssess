from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class CompetitionStatus(str, enum.Enum):
    REGISTRATION_OPEN = "registration_open"
    SCREENING_ACTIVE = "screening_active"
    SCREENING_CLOSED = "screening_closed"
    LIVE_ACTIVE = "live_active"
    COMPLETED = "completed"


class Competition(Base):
    __tablename__ = "competitions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Competition timeline
    screening_start_date = Column(DateTime, nullable=True)
    screening_deadline = Column(DateTime, nullable=True)
    live_competition_date = Column(DateTime, nullable=True)

    # Participant limits
    max_participants = Column(Integer, default=30000)
    qualified_count = Column(Integer, default=500)  # Top N qualify for live competition

    # Status
    status = Column(String(50), default=CompetitionStatus.REGISTRATION_OPEN.value)

    # Screening test configuration
    test_duration_minutes = Column(Integer, default=60)  # 1-hour screening test
    questions_count = Column(Integer, default=20)  # Number of questions
    passing_percentile = Column(Float, default=98.33)  # Top 500 out of 30000 = ~98.33 percentile

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    registrations = relationship("CompetitionRegistration", back_populates="competition", cascade="all, delete-orphan")


class CompetitionRegistration(Base):
    __tablename__ = "competition_registrations"

    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)

    # Unique registration token for screening test access
    registration_token = Column(String(255), unique=True, nullable=False, index=True)

    registered_at = Column(DateTime, default=datetime.utcnow)

    # Screening status
    screening_started_at = Column(DateTime, nullable=True)
    screening_completed_at = Column(DateTime, nullable=True)
    screening_completed = Column(Boolean, default=False)
    screening_score = Column(Float, nullable=True)  # 0-100
    screening_percentile = Column(Float, nullable=True)  # Calculated after screening closes

    # Qualification status
    is_qualified = Column(Boolean, default=False)
    qualified_at = Column(DateTime, nullable=True)
    qualification_rank = Column(Integer, nullable=True)  # 1-500 for qualified candidates

    # Test reference (links to the actual Test model for this screening)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    competition = relationship("Competition", back_populates="registrations")
    candidate = relationship("Candidate", back_populates="competition_registrations")
    test = relationship("Test", back_populates="competition_registration")
    behavioral_metrics = relationship("BehavioralMetrics", back_populates="registration", uselist=False, cascade="all, delete-orphan")


class BehavioralMetrics(Base):
    __tablename__ = "behavioral_metrics"

    id = Column(Integer, primary_key=True, index=True)
    registration_id = Column(Integer, ForeignKey("competition_registrations.id"), nullable=False)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=True)

    # Time tracking per question (JSON array of {question_id, time_seconds, question_category, question_complexity})
    time_per_question = Column(JSON, default=list)

    # Aggregate timing metrics (in seconds)
    average_response_time = Column(Float, nullable=True)
    fastest_response = Column(Float, nullable=True)
    slowest_response = Column(Float, nullable=True)
    median_response_time = Column(Float, nullable=True)
    std_dev_response_time = Column(Float, nullable=True)

    # Suspicious activity flags
    suspiciously_fast_count = Column(Integer, default=0)  # Answers < 30 seconds on complex questions
    suspiciously_slow_count = Column(Integer, default=0)  # Answers > 10 minutes

    # Behavioral patterns
    consistency_score = Column(Float, default=100.0)  # 0-100, higher = more consistent

    # Anomaly detection (JSON array of {type, question_id, timestamp, description, severity})
    anomaly_flags = Column(JSON, default=list)

    # Overall risk assessment
    risk_score = Column(Float, default=0.0)  # 0-100, higher = more suspicious
    risk_factors = Column(JSON, default=list)  # List of factors contributing to risk

    # Additional behavioral signals
    answer_change_count = Column(Integer, default=0)  # How many times answers were changed
    navigation_pattern = Column(JSON, default=list)  # Sequence of question visits
    idle_time_total = Column(Float, default=0.0)  # Total idle time in seconds

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    registration = relationship("CompetitionRegistration", back_populates="behavioral_metrics")
    test = relationship("Test", back_populates="behavioral_metrics")
