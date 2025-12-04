from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)

    candidate_answer = Column(Text, nullable=True)
    candidate_code = Column(Text, nullable=True)  # For coding questions

    score = Column(Float, nullable=True)  # 0-100
    feedback = Column(Text, nullable=True)
    ai_evaluation = Column(Text, nullable=True)

    submitted_at = Column(DateTime, nullable=True)
    evaluated_at = Column(DateTime, nullable=True)

    # Time tracking
    time_spent_seconds = Column(Integer, nullable=True)
    is_suspiciously_fast = Column(Boolean, default=False)
    question_opened_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    question = relationship("Question", back_populates="answer")
