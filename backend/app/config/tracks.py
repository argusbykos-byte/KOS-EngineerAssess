"""Specialization tracks configuration for dual scoring system."""

from typing import Dict, List, Any, Optional


SPECIALIZATION_TRACKS: Dict[str, Dict[str, Any]] = {
    "ai_researcher": {
        "name": "AI Researcher",
        "description": "Model architecture, training theory, neural networks, research methodology",
        "question_topics": [
            "transformer architectures",
            "training dynamics",
            "optimization theory",
            "research paper analysis",
            "novel model design"
        ]
    },
    "ai_ml_engineer": {
        "name": "AI/ML Engineer",
        "description": "PyTorch/TensorFlow, data pipelines, MLOps, model deployment",
        "question_topics": [
            "ML pipeline design",
            "model serving",
            "feature engineering",
            "distributed training",
            "model optimization"
        ]
    },
    "frontend": {
        "name": "Frontend Engineer",
        "description": "React, CSS, accessibility, performance, state management",
        "question_topics": [
            "React patterns",
            "CSS architecture",
            "web accessibility",
            "performance optimization",
            "state management"
        ]
    },
    "ui_ux": {
        "name": "UI/UX Designer",
        "description": "Design principles, user research, prototyping, design systems",
        "question_topics": [
            "user research methods",
            "design systems",
            "usability testing",
            "interaction design",
            "visual hierarchy"
        ]
    },
    "cybersecurity": {
        "name": "Cybersecurity Engineer",
        "description": "Threat modeling, encryption, vulnerabilities, secure coding",
        "question_topics": [
            "threat modeling",
            "cryptography",
            "vulnerability assessment",
            "secure architecture",
            "incident response"
        ]
    },
    "hardware_ee": {
        "name": "PCB/EE Engineer",
        "description": "Circuit design, PCB layout, signal integrity, power systems",
        "question_topics": [
            "circuit analysis",
            "PCB design rules",
            "signal integrity",
            "power management",
            "EMI/EMC"
        ]
    },
    "firmware": {
        "name": "Firmware Engineer",
        "description": "Embedded C, RTOS, peripherals, debugging, memory management",
        "question_topics": [
            "RTOS concepts",
            "peripheral drivers",
            "memory optimization",
            "debugging techniques",
            "real-time constraints"
        ]
    },
    "biomedical": {
        "name": "Biomedical Engineer",
        "description": "Medical devices, biosensors, FDA regulations, physiology",
        "question_topics": [
            "FDA regulatory pathways",
            "biosensor design",
            "physiological signals",
            "clinical validation",
            "medical device standards"
        ]
    }
}


def get_track_config(track_id: str) -> Optional[Dict[str, Any]]:
    """Get configuration for a specific track."""
    return SPECIALIZATION_TRACKS.get(track_id)


def get_track_name(track_id: str) -> str:
    """Get the display name for a track."""
    track = SPECIALIZATION_TRACKS.get(track_id)
    return track["name"] if track else track_id


def get_all_tracks() -> Dict[str, Dict[str, Any]]:
    """Get all available tracks."""
    return SPECIALIZATION_TRACKS


def get_track_topics(track_id: str) -> List[str]:
    """Get the question topics for a track."""
    track = SPECIALIZATION_TRACKS.get(track_id)
    return track["question_topics"] if track else []


def is_valid_track(track_id: str) -> bool:
    """Check if a track ID is valid."""
    return track_id in SPECIALIZATION_TRACKS
