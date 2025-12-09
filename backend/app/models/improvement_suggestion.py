from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class SuggestionStatus(str, enum.Enum):
    PENDING = "pending"
    AUTO_IMPLEMENTED = "auto_implemented"
    ADMIN_REVIEWED = "admin_reviewed"
    IGNORED = "ignored"
    FAILED = "failed"


class SuggestionCategory(str, enum.Enum):
    NEW_QUESTION = "new_question"
    IMPROVE_QUESTION = "improve_question"
    NEW_TERMINOLOGY = "new_terminology"
    UI_FEEDBACK = "ui_feedback"
    TECHNICAL_ISSUE = "technical_issue"
    OTHER = "other"


class SuggestionPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ImprovementSuggestion(Base):
    __tablename__ = "improvement_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=True)

    # Raw feedback from candidate
    raw_feedback = Column(Text, nullable=False)

    # Kimi2 AI analysis results
    kimi2_analysis = Column(JSON, nullable=True)
    # Expected structure:
    # {
    #   "is_valid": bool,
    #   "category": str (SuggestionCategory),
    #   "priority": str (SuggestionPriority),
    #   "can_auto_implement": bool,
    #   "suggested_action": str,
    #   "extracted_content": {
    #       "question_text": str (if new question),
    #       "expected_answer": str,
    #       "hints": list,
    #       "difficulty": str,
    #       "track_id": str,
    #       "term_name": str (if terminology),
    #       "term_definition": str,
    #       ...
    #   },
    #   "reasoning": str
    # }

    # Claude Code command for manual implementation
    claude_code_command = Column(Text, nullable=True)

    # Processing status
    status = Column(String(50), default=SuggestionStatus.PENDING.value)

    # Implementation tracking
    implemented_at = Column(DateTime, nullable=True)
    implemented_by = Column(String(100), nullable=True)  # "auto" or admin username
    implementation_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    candidate = relationship("Candidate", backref="improvement_suggestions")
    test = relationship("Test", backref="improvement_suggestions")
