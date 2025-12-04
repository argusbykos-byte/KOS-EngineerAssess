from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)

    category = Column(String(100), nullable=False)  # brain_teaser, coding, code_review, system_design, signal_processing
    section_order = Column(Integer, default=0)
    question_order = Column(Integer, default=0)

    question_text = Column(Text, nullable=False)
    question_code = Column(Text, nullable=True)  # For coding/code review questions
    expected_answer = Column(Text, nullable=True)
    hints = Column(JSON, nullable=True)
    max_score = Column(Integer, default=100)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    test = relationship("Test", back_populates="questions")
    answer = relationship("Answer", back_populates="question", uselist=False, cascade="all, delete-orphan")
