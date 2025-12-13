from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class TestStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    ON_BREAK = "on_break"
    COMPLETED = "completed"
    EXPIRED = "expired"


class Test(Base):
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    access_token = Column(String(255), unique=True, nullable=False, index=True)

    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration_hours = Column(Integer, default=2)

    status = Column(String(50), default=TestStatus.PENDING.value)
    current_section = Column(String(100), nullable=True)

    # Break tracking
    # 8hr test = 60min total break, 4hr test = 30min total break
    # Max single break = 15-20 min
    total_break_time_seconds = Column(Integer, default=0)  # Allowed break time based on duration
    used_break_time_seconds = Column(Integer, default=0)  # Total break time used
    break_count = Column(Integer, default=0)  # Number of breaks taken
    current_break_start = Column(DateTime, nullable=True)  # When current break started (null if not on break)
    break_history = Column(JSON, default=list)  # List of {start, end, duration_seconds}

    # Anti-cheat tracking
    tab_switch_count = Column(Integer, default=0)
    tab_switch_timestamps = Column(JSON, default=list)  # List of ISO timestamps
    paste_attempt_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="tests")
    questions = relationship("Question", back_populates="test", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="test", uselist=False, cascade="all, delete-orphan")
    challenge_submission = relationship(
        "ChallengeSubmission",
        back_populates="test",
        uselist=False,
        cascade="all, delete-orphan"
    )
