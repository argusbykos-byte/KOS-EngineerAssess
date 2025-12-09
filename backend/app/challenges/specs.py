"""
Challenge specifications for KOS Quest assessment tracks.

This module defines the two main challenge tracks:
1. Signal Processing - For candidates with DSP/biomedical signal processing background
2. LLM/Generative AI - For candidates with LLM/AI background
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel


class Track(str, Enum):
    SIGNAL_PROCESSING = "signal_processing"
    LLM = "llm"


class ChallengeTask(BaseModel):
    """A single task within a challenge."""
    id: str
    title: str
    description: str
    requirements: List[str]


class AutoPresentation(BaseModel):
    """Configuration for auto-generated presentation."""
    enabled: bool = True
    sections: List[str]


class ChallengeSpec(BaseModel):
    """Complete specification for a challenge track."""
    track: Track
    title: str
    short_summary: str
    tasks: List[ChallengeTask]
    deliverables: List[str]
    auto_presentation: AutoPresentation
    estimated_time_hours: int


# Signal Processing Challenge - Argus CGM
SIGNAL_PROCESSING_CHALLENGE = ChallengeSpec(
    track=Track.SIGNAL_PROCESSING,
    title="Skin-Tone-Aware PPG Signal Processing Challenge (Argus – Non-Invasive CGM)",
    short_summary="Develop an algorithm that automatically detects skin tone from multi-wavelength PPG signals and adapts the optical pipeline accordingly.",
    tasks=[
        ChallengeTask(
            id="sp-1",
            title="Skin Tone Detection from Multi-Wavelength PPG",
            description="Using raw PPG data (Red, IR, Green), design an algorithm that infers skin tone automatically, without explicit user input.",
            requirements=[
                "Use multi-wavelength PPG (at least Red and IR; Green if available).",
                "Output a discrete skin-type class (e.g., Fitzpatrick scale or a simplified 3–5 class scheme).",
                "Return a confidence score for each prediction.",
                "Make the method robust to motion artifacts and ambient light variations.",
            ],
        ),
        ChallengeTask(
            id="sp-2",
            title="Adaptation of Optical Pipeline to Skin Tone",
            description="Based on the detected skin tone, adapt the wavelength weighting and/or preprocessing pipeline.",
            requirements=[
                "Propose wavelength weighting or gain factors per skin-tone class.",
                "Explain how this improves SNR and feature quality for darker/lighter skin.",
                "Describe how this could be integrated into a real-time embedded system.",
            ],
        ),
        ChallengeTask(
            id="sp-3",
            title="Evaluation & Failure Analysis",
            description="Evaluate your approach and describe where it fails and why.",
            requirements=[
                "Define simple metrics to judge performance (e.g., accuracy, calibration curves, confusion matrix).",
                "Describe at least 3 failure modes or edge cases.",
                "Propose concrete improvements or next steps for a production system.",
            ],
        ),
    ],
    deliverables=[
        "Source code for your algorithm (Python / MATLAB / C++ – choose one).",
        "A short README explaining how to run your code.",
        "A short report (Markdown or PDF) describing the approach, signal processing pipeline, and evaluation.",
    ],
    auto_presentation=AutoPresentation(
        enabled=True,
        sections=[
            "Problem Statement & Context",
            "Data & Assumptions",
            "Signal Processing Pipeline & Algorithm Design",
            "Skin Tone Detection Logic",
            "Adaptation of Optical Pipeline to Skin Tone",
            "Results & Metrics",
            "Limitations & Future Work",
            "Clinical Relevance for Argus CGM",
        ],
    ),
    estimated_time_hours=6,
)


# LLM / Generative AI Challenge
LLM_CHALLENGE = ChallengeSpec(
    track=Track.LLM,
    title="Safe Diabetes Assistant – LLM / Generative AI Challenge",
    short_summary="Design a HIPAA-safe medical AI assistant for diabetes education with hallucination detection, guideline grounding, and auditability.",
    tasks=[
        ChallengeTask(
            id="llm-1",
            title="System Design for a Diabetes AI Assistant",
            description="Design a system that answers patient questions about diabetes and Argus CGM, safely and accurately.",
            requirements=[
                "Propose an architecture with LLM, retrieval (RAG), and safety components.",
                "Explain how you ground answers in clinical guidelines and verified content.",
                "Describe how the system behaves when it is uncertain.",
            ],
        ),
        ChallengeTask(
            id="llm-2",
            title="Hallucination Detection & Safety Logic",
            description="Define how the system detects and mitigates hallucinations for medical content.",
            requirements=[
                "Describe concrete signals or checks used to detect hallucinations.",
                "Specify refusal / fallback behaviors when the model is not confident.",
                "Explain how you log and audit interactions for regulatory purposes.",
            ],
        ),
        ChallengeTask(
            id="llm-3",
            title="Example Conversations & Edge Cases",
            description="Provide example dialogues that show the system's behavior in normal and risky situations.",
            requirements=[
                "Include at least 5 example conversations (happy path + edge cases).",
                "Show at least 2 situations where the assistant refuses to answer or escalates.",
                "Highlight how HIPAA and privacy are preserved.",
            ],
        ),
    ],
    deliverables=[
        "System design document (Markdown or PDF).",
        "Simplified prototype or pseudo-code for the core logic (Python preferred).",
        "Example conversations showing safe and unsafe scenario handling.",
    ],
    auto_presentation=AutoPresentation(
        enabled=True,
        sections=[
            "Problem Statement & Use Cases",
            "High-Level System Architecture",
            "Grounding & Retrieval Strategy",
            "Hallucination Detection & Guardrails",
            "HIPAA / GDPR & Safety Considerations",
            "Example Conversations",
            "Limitations & Future Roadmap",
        ],
    ),
    estimated_time_hours=4,
)


def build_challenge_spec(track: Track) -> ChallengeSpec:
    """
    Build a challenge spec based on the candidate's track.
    This is called AFTER Kimi-2 has analyzed the resume and decided which track fits best.
    """
    if track == Track.SIGNAL_PROCESSING:
        return SIGNAL_PROCESSING_CHALLENGE
    return LLM_CHALLENGE


def get_track_display_name(track: Track) -> str:
    """Get human-readable track name."""
    if track == Track.SIGNAL_PROCESSING:
        return "Signal Processing & Feature Engineering"
    return "LLM / Generative AI"
