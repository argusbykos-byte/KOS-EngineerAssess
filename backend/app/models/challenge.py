from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ChallengeSubmission(Base):
    """
    Stores a candidate's submission for a challenge track.
    Each test can have one challenge submission with multiple task responses.
    """
    __tablename__ = "challenge_submissions"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False, unique=True)

    # Track info
    track = Column(String(50), nullable=False)  # "signal_processing" or "llm"

    # Overall submission status
    is_submitted = Column(Boolean, default=False)
    submitted_at = Column(DateTime, nullable=True)

    # Auto-generated presentation (stored as JSON)
    presentation_data = Column(JSON, nullable=True)
    presentation_generated_at = Column(DateTime, nullable=True)

    # Overall evaluation
    overall_score = Column(Float, nullable=True)
    overall_feedback = Column(Text, nullable=True)
    evaluated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    test = relationship("Test", back_populates="challenge_submission")
    task_responses = relationship(
        "TaskResponse",
        back_populates="challenge_submission",
        cascade="all, delete-orphan"
    )
    deliverables = relationship(
        "Deliverable",
        back_populates="challenge_submission",
        cascade="all, delete-orphan"
    )


class TaskResponse(Base):
    """
    Stores a candidate's response to a specific task within a challenge.
    """
    __tablename__ = "task_responses"

    id = Column(Integer, primary_key=True, index=True)
    challenge_submission_id = Column(
        Integer,
        ForeignKey("challenge_submissions.id"),
        nullable=False
    )

    # Task identification
    task_id = Column(String(50), nullable=False)  # e.g., "sp-1", "llm-2"

    # Response content
    response_text = Column(Text, nullable=True)
    response_code = Column(Text, nullable=True)

    # Draft/submission state
    is_submitted = Column(Boolean, default=False)
    submitted_at = Column(DateTime, nullable=True)

    # AI Evaluation
    score = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    ai_evaluation = Column(JSON, nullable=True)
    evaluated_at = Column(DateTime, nullable=True)

    # Version tracking for edits
    version = Column(Integer, default=1)
    previous_response = Column(Text, nullable=True)
    previous_code = Column(Text, nullable=True)
    previous_score = Column(Float, nullable=True)
    edit_count = Column(Integer, default=0)
    last_edited_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    challenge_submission = relationship("ChallengeSubmission", back_populates="task_responses")


class Deliverable(Base):
    """
    Stores uploaded deliverables for a challenge (code files, documents, etc.).
    """
    __tablename__ = "deliverables"

    id = Column(Integer, primary_key=True, index=True)
    challenge_submission_id = Column(
        Integer,
        ForeignKey("challenge_submissions.id"),
        nullable=False
    )

    # Deliverable type
    deliverable_type = Column(String(50), nullable=False)  # "code", "readme", "report"
    title = Column(String(255), nullable=True)

    # Content - either file path or inline content
    file_path = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    content_type = Column(String(100), nullable=True)  # MIME type
    inline_content = Column(Text, nullable=True)  # For text content

    # Metadata
    file_size_bytes = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    challenge_submission = relationship("ChallengeSubmission", back_populates="deliverables")
