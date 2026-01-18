"""
Specialization Test Models

Models for 1-hour deep specialization assessment tests.
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


class TestType(str, enum.Enum):
    """Types of tests"""
    STANDARD = "standard"
    SPECIALIZATION = "specialization"
    COMPETITION = "competition"


class SpecializationResult(Base):
    """
    Results from a deep specialization assessment.

    Captures the candidate's exact sub-specialty within their focus area,
    along with recommended tasks and team fit analysis.
    """
    __tablename__ = "specialization_results"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    test_id = Column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)

    # Primary specialty identification
    focus_area = Column(String(100), nullable=False)  # e.g., "ml", "embedded", "biomedical"
    primary_specialty = Column(String(255), nullable=True)  # e.g., "Reinforcement Learning - Policy Optimization"
    specialty_score = Column(Float, nullable=True)  # Overall score for specialty (0-100)
    confidence = Column(Float, nullable=True)  # Confidence in specialty determination (0-100)

    # Sub-specialties breakdown
    # JSON array: [{"name": "Policy Gradient Methods", "score": 95, "rank": 1}, ...]
    sub_specialties = Column(JSON, nullable=True)

    # Recommendations
    # JSON array of recommended tasks based on specialty
    recommended_tasks = Column(JSON, nullable=True)

    # Team fit analysis
    team_fit_analysis = Column(Text, nullable=True)

    # Raw analysis from AI
    raw_analysis = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    test = relationship("Test", back_populates="specialization_result")
    candidate = relationship("Candidate", back_populates="specialization_results")

    def __repr__(self):
        return f"<SpecializationResult(id={self.id}, focus={self.focus_area}, specialty='{self.primary_specialty}')>"

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "test_id": self.test_id,
            "candidate_id": self.candidate_id,
            "focus_area": self.focus_area,
            "primary_specialty": self.primary_specialty,
            "specialty_score": self.specialty_score,
            "confidence": self.confidence,
            "sub_specialties": self.sub_specialties or [],
            "recommended_tasks": self.recommended_tasks or [],
            "team_fit_analysis": self.team_fit_analysis,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# Focus areas for specialization tests
SPECIALIZATION_FOCUS_AREAS = {
    "ml": {
        "name": "Machine Learning",
        "description": "Deep dive into ML sub-specialties",
        "sub_specialties": [
            "Reinforcement Learning",
            "Computer Vision",
            "Natural Language Processing",
            "Supervised Learning",
            "Unsupervised Learning",
            "Graph Neural Networks",
            "Time Series Analysis",
            "MLOps & Deployment",
            "Model Optimization",
            "Research & Architecture Design",
        ],
    },
    "embedded": {
        "name": "Embedded Systems",
        "description": "Embedded and firmware specialization",
        "sub_specialties": [
            "RTOS Development",
            "Bare-metal Programming",
            "Driver Development",
            "Power Optimization",
            "Communication Protocols",
            "Memory Management",
            "Real-time Constraints",
            "Hardware-Software Integration",
            "Debugging & Testing",
            "Security",
        ],
    },
    "biomedical": {
        "name": "Biomedical Engineering",
        "description": "Medical device and biosensor specialization",
        "sub_specialties": [
            "Biosensor Development",
            "Signal Processing for Biomedical",
            "FDA Regulatory",
            "Clinical Validation",
            "Wearable Devices",
            "Physiological Modeling",
            "Medical Image Processing",
            "Drug Delivery Systems",
            "Neural Engineering",
            "Rehabilitation Engineering",
        ],
    },
    "signal_processing": {
        "name": "Signal Processing",
        "description": "DSP and sensor data processing",
        "sub_specialties": [
            "Filter Design",
            "Spectral Analysis",
            "Adaptive Filtering",
            "Statistical Signal Processing",
            "Array Processing",
            "Image Processing",
            "Audio Processing",
            "Sensor Fusion",
            "Real-time DSP",
            "Compressed Sensing",
        ],
    },
    "frontend": {
        "name": "Frontend Development",
        "description": "Web and mobile frontend specialization",
        "sub_specialties": [
            "React/React Native",
            "Vue/Nuxt",
            "Angular",
            "Performance Optimization",
            "State Management",
            "Accessibility",
            "Animation & Graphics",
            "Mobile Development",
            "Testing & QA",
            "Design Systems",
        ],
    },
    "backend": {
        "name": "Backend Development",
        "description": "Server-side and infrastructure",
        "sub_specialties": [
            "API Design",
            "Database Design",
            "Microservices",
            "Event-driven Architecture",
            "Performance Optimization",
            "Security",
            "DevOps/Infrastructure",
            "Data Engineering",
            "Real-time Systems",
            "Distributed Systems",
        ],
    },
    "cybersecurity": {
        "name": "Cybersecurity",
        "description": "Security engineering specialization",
        "sub_specialties": [
            "Application Security",
            "Network Security",
            "Cryptography",
            "Penetration Testing",
            "Security Architecture",
            "Incident Response",
            "Cloud Security",
            "IoT Security",
            "Compliance & Governance",
            "Security Operations",
        ],
    },
}


def get_focus_area_config(focus_area: str) -> dict:
    """Get configuration for a focus area."""
    return SPECIALIZATION_FOCUS_AREAS.get(focus_area, {})


def get_all_focus_areas() -> list:
    """Get list of all available focus areas."""
    return [
        {
            "id": key,
            "name": config["name"],
            "description": config["description"],
        }
        for key, config in SPECIALIZATION_FOCUS_AREAS.items()
    ]
