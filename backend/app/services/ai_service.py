import httpx
import json
import asyncio
import re
import time
import os
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from app.config import settings


# KOS AI Company Context - included in all question generation prompts
KOS_COMPANY_CONTEXT = """
KOS AI COMPANY CONTEXT:
KOS AI is a health-tech company developing Argus, a non-invasive continuous glucose monitoring (CGM)
wearable device. Generate questions relevant to this work when appropriate.

SIGNAL PROCESSING FOCUS:
- Multi-wavelength PPG (photoplethysmography) using Red, IR, Green LEDs
- 6-channel PPG data collection with MAXM86146 sensor hub
- Skin-tone adaptive algorithms (Fitzpatrick scale detection)
- Motion artifact removal and signal denoising
- Heart rate variability (HRV) analysis from PPG

BIOMEDICAL ALGORITHMS:
- Non-invasive glucose estimation from optical signals
- Temperature detection from PPG waveforms
- SpO2 (blood oxygen) measurement
- Blood pressure estimation algorithms
- Perfusion index calculation

MACHINE LEARNING:
- Multi-modal sensor fusion (PPG + accelerometer + temperature)
- Time-series prediction for glucose trends
- Edge ML deployment on ARM Cortex-M4 processors
- Signal quality classification

SYSTEM DESIGN:
- Real-time embedded systems with <50ms latency requirements
- Low-power BLE communication protocols
- HIPAA-compliant cloud data pipelines
- FDA regulatory considerations for medical devices

When generating questions, prefer topics related to:
- PPG signal processing and analysis
- Biomedical sensor data processing
- Embedded systems and real-time constraints
- Healthcare data privacy and compliance
- Edge ML and resource-constrained deployment
"""


def detect_programming_language(text: str, code: str = None, category: str = None) -> str:
    """Detect programming language from question text and code snippets.

    Args:
        text: Question text
        code: Code snippet if any
        category: Question category (coding, code_review, etc.)

    Returns:
        Language identifier for Monaco editor (python, javascript, c, typescript, etc.)
    """
    combined = f"{text or ''} {code or ''}".lower()

    # Explicit language mentions
    if "python" in combined or ".py" in combined:
        return "python"
    if "javascript" in combined or ".js" in combined or "node" in combined:
        return "javascript"
    if "typescript" in combined or ".ts" in combined:
        return "typescript"
    if "c++" in combined or ".cpp" in combined or "cpp" in combined:
        return "cpp"
    if "rust" in combined or ".rs" in combined:
        return "rust"
    if "go " in combined or "golang" in combined or ".go" in combined:
        return "go"
    if "java " in combined or ".java" in combined:
        return "java"
    if "sql" in combined:
        return "sql"
    if "bash" in combined or "shell" in combined or ".sh" in combined:
        return "shell"

    # C detection (after C++ to avoid false positives)
    if (" c " in combined or "c code" in combined or ".c" in combined or
        "firmware" in combined or "embedded c" in combined or
        "microcontroller" in combined or "#include" in combined):
        return "c"

    # Syntax-based detection from code snippets
    if code:
        # Python patterns
        if "def " in code or "import " in code or "print(" in code or "self." in code:
            return "python"
        # JavaScript patterns
        if "const " in code or "let " in code or "function " in code or "=>" in code or "console.log" in code:
            return "javascript"
        # C/C++ patterns
        if "#include" in code or "int main(" in code or "printf(" in code:
            return "c"

    # Default based on category
    if category == "code_review":
        return "javascript"  # Code reviews often use JS

    return "python"  # Default to Python for coding questions


class InterviewKnowledgeBase:
    """Manages the interview knowledge base with questions, rubrics, and terminology."""

    def __init__(self):
        self.data = None
        self.loaded = False
        self._load_knowledge_base()

    def _load_knowledge_base(self):
        """Load the knowledge base JSON file."""
        try:
            # Try multiple possible paths
            possible_paths = [
                Path(__file__).parent.parent.parent / "data" / "interview_knowledge.json",
                Path("/Users/abhinavagarwal/Projects/KOS-EngineerAssess/backend/data/interview_knowledge.json"),
                Path("data/interview_knowledge.json"),
            ]

            for path in possible_paths:
                if path.exists():
                    with open(path, 'r', encoding='utf-8') as f:
                        self.data = json.load(f)
                    self.loaded = True
                    print(f"[KnowledgeBase] Loaded from {path}")
                    print(f"[KnowledgeBase] Tracks available: {list(self.data.get('engineer_tracks', {}).keys())}")
                    return

            print("[KnowledgeBase] Warning: Knowledge base file not found")
            self.data = {}
        except Exception as e:
            print(f"[KnowledgeBase] Error loading knowledge base: {e}")
            self.data = {}

    def get_terminology(self, term: str) -> Optional[Dict[str, str]]:
        """Get definition and example for a technical term."""
        if not self.data:
            return None
        terminology = self.data.get("terminology", {})
        # Try exact match first
        if term in terminology:
            return terminology[term]
        # Try case-insensitive match
        term_lower = term.lower().replace(" ", "_").replace("-", "_")
        for key, value in terminology.items():
            if key.lower() == term_lower:
                return value
        return None

    def explain_term(self, term: str) -> str:
        """Get a human-readable explanation of a technical term."""
        term_data = self.get_terminology(term)
        if term_data:
            full_name = term_data.get("term", term)
            definition = term_data.get("definition", "No definition available.")
            example = term_data.get("example", "")
            explanation = f"**{full_name}**: {definition}"
            if example:
                explanation += f"\n\n*Example: {example}*"
            return explanation
        return f"Term '{term}' not found in knowledge base."

    def get_all_terminology(self) -> Dict[str, Dict[str, str]]:
        """Get all terminology entries."""
        return self.data.get("terminology", {}) if self.data else {}

    def get_brain_teasers(self, difficulty: str = None) -> List[Dict]:
        """Get brain teaser questions, optionally filtered by difficulty."""
        if not self.data:
            return []
        questions = self.data.get("brain_teasers", {}).get("questions", [])
        if difficulty:
            questions = [q for q in questions if difficulty in q.get("difficulty", [])]
        return questions

    def get_track_questions(self, track_id: str, difficulty: str = None, category: str = None) -> List[Dict]:
        """Get technical questions for a specific engineer track."""
        if not self.data:
            return []
        tracks = self.data.get("engineer_tracks", {})
        track = tracks.get(track_id, {})
        questions = track.get("technical_questions", [])

        if difficulty:
            questions = [q for q in questions if difficulty in q.get("difficulty", [])]
        if category:
            questions = [q for q in questions if q.get("category") == category]

        return questions

    def get_track_info(self, track_id: str) -> Optional[Dict]:
        """Get information about a specific track."""
        if not self.data:
            return None
        return self.data.get("engineer_tracks", {}).get(track_id)

    def get_available_tracks(self) -> List[str]:
        """Get list of available engineer track IDs."""
        if not self.data:
            return []
        return list(self.data.get("engineer_tracks", {}).keys())

    def get_difficulty_info(self, level: str) -> Optional[Dict]:
        """Get information about a difficulty level."""
        if not self.data:
            return None
        return self.data.get("difficulty_levels", {}).get(level)

    def get_passing_score(self) -> int:
        """Get the passing score threshold."""
        return self.data.get("passing_score", 70) if self.data else 70

    def format_rubric_for_prompt(self, question: Dict) -> str:
        """Format a question's rubric into a string for AI prompts."""
        rubric = question.get("rubric", {})
        if not rubric:
            return ""

        lines = ["Scoring Rubric (10 points total):"]
        for category, details in rubric.items():
            points = details.get("points", 0)
            lines.append(f"\n{category.replace('_', ' ').title()} ({points} points):")
            for criterion in details.get("criteria", []):
                desc = criterion.get("description", "")
                pts = criterion.get("points", 0)
                lines.append(f"  - {desc} ({pts} pt{'s' if pts != 1 else ''})")

        return "\n".join(lines)


class ResumeAnalyzer:
    """Analyzes resumes to determine experience level and best-fit track."""

    # Keywords that indicate experience level
    SENIOR_KEYWORDS = [
        "architect", "principal", "staff", "lead", "director", "vp", "head of",
        "senior", "sr.", "tech lead", "team lead", "manager", "10+ years",
        "8+ years", "designed and implemented", "led team", "mentored",
        "architected", "scaled to", "patent", "published"
    ]

    MID_KEYWORDS = [
        "software engineer", "developer", "3+ years", "4+ years", "5+ years",
        "implemented", "developed", "built", "optimized", "improved",
        "contributed to", "collaborated"
    ]

    JUNIOR_KEYWORDS = [
        "intern", "junior", "entry", "graduate", "bootcamp", "certification",
        "learning", "familiar with", "exposure to", "coursework", "project"
    ]

    # Track-specific keywords
    TRACK_KEYWORDS = {
        "ml_engineer": [
            "machine learning", "deep learning", "neural network", "pytorch", "tensorflow",
            "sklearn", "pandas", "numpy", "data science", "model training", "feature engineering",
            "nlp", "computer vision", "reinforcement learning", "mlops", "model deployment",
            "signal processing", "time series", "prediction", "classification", "regression"
        ],
        "biomedical_engineer": [
            "biomedical", "medical device", "fda", "regulatory", "510k", "iso 13485",
            "biosignal", "ecg", "ppg", "clinical", "healthcare", "patient safety",
            "risk management", "iso 14971", "iec 60601", "biocompatibility", "validation"
        ],
        "electrical_engineer": [
            "pcb", "schematic", "analog", "digital", "circuit", "power supply",
            "emc", "signal integrity", "amplifier", "adc", "dac", "oscilloscope",
            "altium", "cadence", "ltspice", "mixed-signal", "rf", "antenna"
        ],
        "firmware_engineer": [
            "firmware", "embedded", "rtos", "freertos", "microcontroller", "arm",
            "cortex", "stm32", "nrf", "c/c++", "interrupt", "dma", "uart", "spi",
            "i2c", "ble", "bluetooth", "low power", "bare metal", "hal"
        ],
        "mechanical_engineer": [
            "mechanical", "cad", "solidworks", "catia", "inventor", "dfm",
            "injection molding", "tolerance", "gd&t", "fea", "thermal", "structural",
            "assembly", "ip rating", "enclosure", "prototype", "manufacturing"
        ]
    }

    @classmethod
    def analyze_experience_level(cls, resume_text: str, skills: List[str] = None) -> Tuple[str, float, Dict]:
        """
        Analyze resume to determine experience level.

        Returns:
            Tuple of (difficulty_level, confidence, analysis_details)
        """
        if not resume_text:
            return "medium", 0.5, {"reason": "No resume provided"}

        text_lower = resume_text.lower()
        skills_text = " ".join(skills).lower() if skills else ""
        combined_text = f"{text_lower} {skills_text}"

        # Count keyword matches
        senior_count = sum(1 for kw in cls.SENIOR_KEYWORDS if kw in combined_text)
        mid_count = sum(1 for kw in cls.MID_KEYWORDS if kw in combined_text)
        junior_count = sum(1 for kw in cls.JUNIOR_KEYWORDS if kw in combined_text)

        # Extract years of experience
        years_match = re.search(r'(\d+)\+?\s*years?\s*(of)?\s*(experience|exp)?', text_lower)
        years = int(years_match.group(1)) if years_match else 0

        # Calculate scores
        senior_score = senior_count * 2 + (1 if years >= 5 else 0)
        mid_score = mid_count * 1.5 + (1 if 2 <= years < 5 else 0)
        junior_score = junior_count * 1 + (1 if years < 2 else 0)

        total_score = senior_score + mid_score + junior_score

        analysis = {
            "years_detected": years,
            "senior_keywords": senior_count,
            "mid_keywords": mid_count,
            "junior_keywords": junior_count,
            "senior_score": senior_score,
            "mid_score": mid_score,
            "junior_score": junior_score
        }

        # Determine level
        if total_score == 0:
            return "medium", 0.3, {**analysis, "reason": "No experience indicators found"}

        if senior_score > mid_score and senior_score > junior_score:
            confidence = min(senior_score / (total_score + 1), 0.95)
            return "hard", confidence, {**analysis, "reason": "Senior-level indicators detected"}
        elif junior_score > mid_score:
            confidence = min(junior_score / (total_score + 1), 0.95)
            return "easy", confidence, {**analysis, "reason": "Junior-level indicators detected"}
        else:
            confidence = min(mid_score / (total_score + 1), 0.95)
            return "medium", confidence, {**analysis, "reason": "Mid-level indicators detected"}

    @classmethod
    def detect_best_track(cls, resume_text: str, skills: List[str] = None) -> Tuple[str, float, Dict]:
        """
        Detect the best engineer track for a candidate.

        Returns:
            Tuple of (track_id, confidence, analysis_details)
        """
        if not resume_text and not skills:
            return "ml_engineer", 0.3, {"reason": "No data provided, defaulting to ML"}

        text_lower = resume_text.lower() if resume_text else ""
        skills_text = " ".join(skills).lower() if skills else ""
        combined_text = f"{text_lower} {skills_text}"

        # Count matches for each track
        track_scores = {}
        track_matches = {}

        for track_id, keywords in cls.TRACK_KEYWORDS.items():
            matches = [kw for kw in keywords if kw in combined_text]
            track_matches[track_id] = matches
            track_scores[track_id] = len(matches)

        # Find best track
        if not any(track_scores.values()):
            return "ml_engineer", 0.3, {"reason": "No track keywords found, defaulting to ML"}

        best_track = max(track_scores, key=track_scores.get)
        best_score = track_scores[best_track]
        total_score = sum(track_scores.values())

        confidence = min(best_score / max(total_score, 1) + 0.2, 0.95)

        analysis = {
            "track_scores": track_scores,
            "matched_keywords": {k: v[:5] for k, v in track_matches.items()},  # Top 5 matches
            "reason": f"Highest match for {best_track} with {best_score} keyword matches"
        }

        return best_track, confidence, analysis


# Default questions for each category when AI fails - KOS AI specific
DEFAULT_QUESTIONS = {
    "brain_teaser": [
        {
            "question_text": "A PPG sensor measures light absorption at 3 wavelengths: Red (deeper penetration), IR (medium), and Green (shallow). Motion artifact corrupts the Green channel but not Red. What does this tell you about the artifact source - is it from finger movement or blood volume change? Explain your reasoning.",
            "question_code": None,
            "expected_answer": "Finger movement causes motion artifact. Since Green has shallow penetration and is affected while Red (deep) is not, the artifact is at the skin surface level, indicating physical movement rather than blood volume changes which would affect all wavelengths proportionally to their penetration depth.",
            "hints": ["Consider what each wavelength 'sees' at different tissue depths", "Blood volume changes affect all wavelengths, motion affects surface differently"]
        },
        {
            "question_text": "You're designing a wearable glucose monitor. The battery lasts 7 days with continuous 100 Hz sampling. Marketing wants 14-day battery life. The signal bandwidth is 5 Hz. What's the minimum sampling rate you can use without losing information, and how much battery improvement does this give you?",
            "question_code": None,
            "expected_answer": "By Nyquist theorem, minimum rate is 2x bandwidth = 10 Hz. Reducing from 100 Hz to 10 Hz is 10x reduction in samples. If sampling dominates power, this could extend battery to ~70 days. Realistically, 14 days is achievable with 10 Hz sampling plus other optimizations.",
            "hints": ["Apply Nyquist-Shannon sampling theorem", "Consider the relationship between sampling rate and power consumption"]
        },
        {
            "question_text": "Your PPG sensor works perfectly on lighter skin but fails on darker skin tones. The issue is signal-to-noise ratio. Given that melanin absorbs more light at shorter wavelengths, which LED color (Red, IR, or Green) would you increase power for darker skin, and why might this create other problems?",
            "question_code": None,
            "expected_answer": "Increase IR power as it's least absorbed by melanin. However, increasing LED power raises thermal issues (skin heating limits), reduces battery life, and may cause photobleaching. Better solution: adaptive gain control and longer integration times.",
            "hints": ["Consider melanin absorption spectrum", "Think about thermal, power, and safety constraints"]
        },
        {
            "question_text": "You have a 6-channel PPG sensor (2 Red, 2 IR, 2 Green LEDs). Each channel samples at 100 Hz with 16-bit resolution. You need to transmit data over BLE with 20-byte MTU. What's the maximum achievable data rate, and how would you prioritize channels if bandwidth is insufficient?",
            "question_code": None,
            "expected_answer": "Data rate: 6 channels × 100 Hz × 16 bits = 9600 bps = 1200 bytes/sec. BLE ~20 packets/sec × 20 bytes = 400 bytes/sec. Need 3x compression or prioritization. Priority: IR (best for SpO2), then Red (deep tissue), Green last (redundant info). Can also reduce sample rate or use delta encoding.",
            "hints": ["Calculate raw data rate first", "Consider which wavelengths carry unique information"]
        }
    ],
    "coding": [
        {
            "question_text": "Write a function to detect and remove motion artifacts from a PPG signal using a simple threshold-based approach. Motion is indicated when the accelerometer magnitude exceeds a threshold. Replace artifact regions with interpolated values.",
            "question_code": "import numpy as np\n\ndef remove_motion_artifacts(\n    ppg_signal: np.ndarray,\n    accel_magnitude: np.ndarray,\n    motion_threshold: float = 1.5\n) -> np.ndarray:\n    '''\n    Remove motion artifacts from PPG signal.\n    \n    Args:\n        ppg_signal: 1D array of PPG values\n        accel_magnitude: 1D array of accelerometer magnitude (same length)\n        motion_threshold: Threshold for detecting motion (in g's)\n    \n    Returns:\n        Cleaned PPG signal with artifacts interpolated\n    '''\n    # Your code here\n    pass\n\n# Example:\n# ppg = [100, 102, 98, 50, 45, 52, 101, 99]  # artifacts at indices 3-5\n# accel = [0.1, 0.2, 0.1, 2.0, 2.5, 1.8, 0.2, 0.1]\n# result should interpolate values at indices 3-5",
            "expected_answer": "Create boolean mask where accel > threshold. Find contiguous artifact regions. For each region, use np.interp() with boundary indices. Handle edge cases: artifact at start/end, entire signal corrupted.",
            "hints": ["Use boolean indexing to find artifact regions", "np.interp() is useful for linear interpolation", "Consider edge cases at signal boundaries"]
        },
        {
            "question_text": "Implement a simple moving average filter optimized for real-time embedded use. It should use O(1) time per sample and minimal memory. The filter processes incoming PPG samples one at a time.",
            "question_code": "class MovingAverageFilter:\n    '''\n    Real-time moving average filter using circular buffer.\n    Optimized for embedded systems: O(1) per sample, O(window_size) memory.\n    '''\n    \n    def __init__(self, window_size: int):\n        '''\n        Initialize the filter.\n        \n        Args:\n            window_size: Number of samples to average\n        '''\n        # Your initialization code here\n        pass\n    \n    def process(self, sample: float) -> float:\n        '''\n        Process a single sample and return the filtered output.\n        \n        Args:\n            sample: New input sample\n        \n        Returns:\n            Filtered output (average of last window_size samples)\n        '''\n        # Your code here\n        pass\n\n# Example usage:\n# filt = MovingAverageFilter(window_size=5)\n# filt.process(10)  # returns 10.0 (only 1 sample)\n# filt.process(20)  # returns 15.0 (avg of 10, 20)\n# ...",
            "expected_answer": "Use circular buffer array of size window_size. Track current index, running sum, and count. On each sample: subtract oldest value from sum, add new value, update buffer. Return sum/min(count, window_size). O(1) time per sample.",
            "hints": ["A circular buffer avoids shifting elements", "Keep a running sum to avoid recalculating", "Handle the warm-up period when buffer isn't full"]
        },
        {
            "question_text": "Write a function to calculate heart rate from PPG signal peaks. Detect peaks, calculate inter-beat intervals (IBI), filter outliers, and return BPM. Handle noisy real-world signals.",
            "question_code": "import numpy as np\nfrom typing import Tuple\n\ndef calculate_heart_rate(\n    ppg_signal: np.ndarray,\n    sample_rate: float,\n    min_bpm: float = 40,\n    max_bpm: float = 200\n) -> Tuple[float, np.ndarray]:\n    '''\n    Calculate heart rate from PPG signal.\n    \n    Args:\n        ppg_signal: 1D array of PPG values\n        sample_rate: Sampling frequency in Hz\n        min_bpm: Minimum valid heart rate\n        max_bpm: Maximum valid heart rate\n    \n    Returns:\n        Tuple of (heart_rate_bpm, peak_indices)\n    '''\n    # Your code here\n    pass\n\n# Example:\n# 10 seconds of signal at 100Hz with ~60 BPM\n# Should return approximately 60.0 and indices of detected peaks",
            "expected_answer": "1) Find peaks using scipy.signal.find_peaks or zero-crossing. 2) Calculate IBI as diff of peak indices / sample_rate. 3) Filter outliers: reject IBI outside [60/max_bpm, 60/min_bpm] seconds. 4) BPM = 60 / median(valid_IBIs). Use median for robustness.",
            "hints": ["scipy.signal.find_peaks can help detect peaks", "Convert peak intervals to BPM: BPM = 60 * sample_rate / interval", "Use median instead of mean for robustness to outliers"]
        }
    ],
    "code_review": [
        {
            "question_text": "Review this PPG signal processing code. Identify bugs, performance issues, and potential problems for embedded deployment.",
            "question_code": "import numpy as np\n\nclass PPGProcessor:\n    def __init__(self):\n        self.buffer = []\n        self.filtered_signal = []\n    \n    def add_sample(self, sample):\n        self.buffer.append(sample)\n        if len(self.buffer) > 1000:\n            self.buffer = self.buffer[-1000:]  # Keep last 1000\n        \n        # Apply low-pass filter\n        filtered = self.apply_filter()\n        self.filtered_signal.append(filtered)\n    \n    def apply_filter(self):\n        # 10-point moving average\n        if len(self.buffer) < 10:\n            return self.buffer[-1]\n        window = self.buffer[-10:]\n        return sum(window) / 10\n    \n    def get_heart_rate(self):\n        # Find peaks\n        peaks = []\n        for i in range(1, len(self.filtered_signal) - 1):\n            if self.filtered_signal[i] > self.filtered_signal[i-1] and \\\n               self.filtered_signal[i] > self.filtered_signal[i+1]:\n                peaks.append(i)\n        \n        # Calculate average interval\n        intervals = []\n        for i in range(len(peaks) - 1):\n            intervals.append(peaks[i+1] - peaks[i])\n        \n        avg_interval = sum(intervals) / len(intervals)\n        return 60 * 100 / avg_interval  # Assumes 100 Hz",
            "expected_answer": "Issues: 1) Memory leak: filtered_signal grows unbounded. 2) O(n) filter: recalculates entire sum each time instead of running sum. 3) List slicing creates copies: use deque or circular buffer. 4) Peak detection too simple: no threshold, catches noise. 5) Division by zero if no intervals. 6) Hardcoded sample rate. 7) No outlier rejection in HR calculation.",
            "hints": ["Check for memory growth over time", "Look for O(n) operations that should be O(1)", "Consider what happens with noisy input"]
        },
        {
            "question_text": "This code handles patient glucose data. Identify security, privacy, and reliability issues.",
            "question_code": "import sqlite3\nimport json\nfrom datetime import datetime\n\nclass GlucoseDataHandler:\n    def __init__(self):\n        self.db = sqlite3.connect('patient_data.db')\n    \n    def store_reading(self, patient_id, glucose_value, timestamp=None):\n        if timestamp is None:\n            timestamp = str(datetime.now())\n        \n        query = f\"INSERT INTO readings VALUES ('{patient_id}', {glucose_value}, '{timestamp}')\"\n        self.db.execute(query)\n        self.db.commit()\n    \n    def get_patient_readings(self, patient_id):\n        query = f\"SELECT * FROM readings WHERE patient_id = '{patient_id}'\"\n        result = self.db.execute(query).fetchall()\n        return json.dumps(result)\n    \n    def export_all_data(self):\n        result = self.db.execute(\"SELECT * FROM readings\").fetchall()\n        with open('export.json', 'w') as f:\n            json.dump(result, f)\n        return 'export.json'\n    \n    def delete_patient(self, patient_id):\n        self.db.execute(f\"DELETE FROM readings WHERE patient_id = '{patient_id}'\")",
            "expected_answer": "Security: SQL injection in all queries - use parameterized queries. Privacy: No encryption at rest, no access control, bulk export without audit, no data anonymization. HIPAA violations: no access logging, no encryption. Reliability: no connection error handling, no transaction rollback, single database connection (no pooling).",
            "hints": ["Check for SQL injection vulnerabilities", "Consider HIPAA requirements for health data", "Look for missing error handling and audit logging"]
        },
        {
            "question_text": "Review this BLE communication code for a medical wearable. Identify issues with power, reliability, and real-time performance.",
            "question_code": "import time\nimport threading\n\nclass BLETransmitter:\n    def __init__(self):\n        self.data_queue = []\n        self.is_connected = False\n        self.transmission_thread = None\n    \n    def start(self):\n        self.transmission_thread = threading.Thread(target=self._transmit_loop)\n        self.transmission_thread.start()\n    \n    def queue_data(self, data):\n        self.data_queue.append(data)\n    \n    def _transmit_loop(self):\n        while True:\n            if self.is_connected and len(self.data_queue) > 0:\n                data = self.data_queue.pop(0)\n                self._send_ble_packet(data)\n            time.sleep(0.001)  # 1ms polling\n    \n    def _send_ble_packet(self, data):\n        # Simulated BLE send - waits for acknowledgment\n        max_retries = 10\n        for attempt in range(max_retries):\n            success = self._hardware_send(data)\n            if success:\n                return\n            time.sleep(0.1)  # Wait before retry\n        raise Exception(\"BLE transmission failed\")\n    \n    def _hardware_send(self, data):\n        # Placeholder for actual hardware call\n        return True",
            "expected_answer": "Power: 1ms polling is wasteful, use event-driven/condition variable. Queue: list.pop(0) is O(n), use deque. Thread safety: data_queue accessed without lock (race condition). Reliability: exception in thread kills transmitter silently, no reconnection logic. Real-time: blocking retries (1 sec worst case) stalls queue. Missing: queue size limit (memory), graceful shutdown, connection state machine.",
            "hints": ["1ms polling wastes CPU/battery", "List operations can be O(n)", "Consider thread safety and error handling"]
        }
    ],
    "system_design": [
        {
            "question_text": "Design the end-to-end data pipeline for a continuous glucose monitoring (CGM) wearable device. The device collects PPG data, estimates glucose levels, and syncs to a mobile app and cloud. Consider power constraints, real-time requirements, and HIPAA compliance.",
            "question_code": None,
            "expected_answer": "Device layer: ARM Cortex-M4 with edge ML model (~50KB), circular buffers, low-power sleep between readings. Communication: BLE 5.0 with connection intervals optimized for battery, local caching when phone unavailable. Mobile app: real-time display, local SQLite with encryption, background sync. Cloud: HIPAA-compliant (AWS/GCP healthcare), encrypted at rest/transit, audit logging. Data flow: Raw PPG → on-device filtering → glucose estimation → encrypted BLE → app → encrypted HTTPS → cloud. Latency: <5 sec device to app, async to cloud.",
            "hints": ["Consider where to run the ML model (device vs cloud)", "Think about what happens when phone is out of range", "HIPAA requires encryption and audit trails"]
        },
        {
            "question_text": "Design a real-time motion artifact detection and compensation system for a PPG-based wearable. The system should work on resource-constrained hardware (Cortex-M4, 256KB RAM) with <50ms latency.",
            "question_code": None,
            "expected_answer": "Sensors: 3-axis accelerometer + multi-wavelength PPG synchronized sampling. Architecture: Pipeline of fixed-point DSP blocks. Motion detection: accelerometer magnitude threshold + derivative check, <1ms. Compensation: adaptive filter (LMS/NLMS) using accel as reference, or multi-wavelength ratio method. Fallback: if motion severe, mark data as unreliable rather than guessing. Memory: double-buffering with fixed 256-sample windows (~5KB). Latency budget: 10ms sampling + 20ms filtering + 10ms ML + 10ms output = 50ms. Power: duty-cycle accelerometer at lower rate when stationary.",
            "hints": ["Accelerometer can detect motion before it corrupts PPG", "Adaptive filters can subtract motion artifacts", "Consider graceful degradation when motion is too severe"]
        },
        {
            "question_text": "Design a system to handle diverse skin tones in a PPG-based wearable. The system should automatically adapt to different Fitzpatrick scale skin types without requiring user input. Consider both hardware and software approaches.",
            "question_code": None,
            "expected_answer": "Hardware: Multi-wavelength LEDs (IR least affected by melanin), adjustable LED current, multiple photodiode gains. Software: Auto-calibration at startup - sweep LED powers, measure SNR per channel, select optimal settings. Runtime adaptation: monitor signal quality, adjust gains dynamically. ML approach: train models on diverse skin tone dataset, use skin tone as implicit feature (inferred from green/red ratio). Fallback: if SNR too low, prefer IR wavelength, increase averaging window (trade temporal resolution for SNR). Validation: test across Fitzpatrick I-VI, ensure <5% accuracy variance.",
            "hints": ["Different wavelengths interact differently with melanin", "Consider both hardware (LED power, gain) and software (algorithm) adaptation", "How do you detect skin tone without asking the user?"]
        }
    ],
    "signal_processing": [
        {
            "question_text": "PPG (photoplethysmography) signals contain both DC and AC components. Explain what physiological information each component carries. Your PPG signal has a DC offset of 50,000 ADC counts with an AC amplitude of only 500 counts. What is the perfusion index, and what might cause it to be low?",
            "question_code": None,
            "expected_answer": "DC component: tissue absorption, venous blood, skin pigmentation (baseline). AC component: arterial blood volume changes with heartbeat. Perfusion Index = (AC/DC) × 100 = (500/50000) × 100 = 1%. Low PI causes: poor perfusion (cold, vasoconstriction), sensor placement, motion, high melanin absorption.",
            "hints": ["DC reflects static absorption, AC reflects pulsatile blood flow", "Perfusion index is a ratio - what does a low ratio mean physiologically?"]
        },
        {
            "question_text": "Design a bandpass filter for isolating heart rate from PPG signals. Heart rate ranges from 0.5 Hz (30 BPM) to 4 Hz (240 BPM). The PPG is sampled at 100 Hz. Explain your filter choice (FIR vs IIR) and design parameters for a wearable device with limited compute.",
            "question_code": "import numpy as np\nfrom scipy import signal\n\ndef design_ppg_bandpass(sample_rate: float = 100.0) -> tuple:\n    '''\n    Design a bandpass filter for heart rate extraction from PPG.\n    Passband: 0.5 - 4 Hz (30-240 BPM)\n    \n    Args:\n        sample_rate: Sampling frequency in Hz\n    \n    Returns:\n        Tuple of (b, a) filter coefficients for IIR\n        or filter coefficients array for FIR\n    '''\n    # Your code here\n    pass",
            "expected_answer": "IIR (Butterworth) preferred for embedded: fewer coefficients, less computation. 2nd-4th order sufficient. Normalized frequencies: [0.5/50, 4/50] = [0.01, 0.08]. Use scipy.signal.butter with btype='bandpass'. FIR needs ~100+ taps for sharp transitions at low frequencies. Watch for phase distortion in IIR if timing matters.",
            "hints": ["Low frequency passband requires many FIR taps", "Consider computational constraints on Cortex-M4", "Think about group delay for peak timing accuracy"]
        },
        {
            "question_text": "Multi-wavelength PPG uses the ratio of Red to IR absorption to calculate SpO2. The formula involves R = (AC_red/DC_red) / (AC_ir/DC_ir). Explain why this ratio method works, and what happens to accuracy when motion artifacts affect only one wavelength.",
            "question_code": None,
            "expected_answer": "R ratio works because: oxygenated hemoglobin (HbO2) absorbs more IR than Red, while deoxygenated (Hb) absorbs more Red. SpO2 is calibrated empirically: SpO2 = 110 - 25R (approximate). If motion affects only one wavelength, R becomes invalid - the ratio assumes both see the same blood volume changes. Solution: detect wavelength-specific artifacts and either compensate or mark unreliable.",
            "hints": ["Think about the absorption spectra of HbO2 vs Hb", "Why does the ratio cancel out path length?", "What assumption breaks during motion?"]
        },
        {
            "question_text": "Implement an adaptive noise cancellation (ANC) filter to remove motion artifacts from PPG using accelerometer data as a reference. Use the LMS (Least Mean Squares) algorithm. Explain the choice of step size and its effect on convergence vs stability.",
            "question_code": "import numpy as np\n\nclass LMSAdaptiveFilter:\n    '''\n    LMS adaptive filter for motion artifact removal.\n    Uses accelerometer as reference signal to cancel motion noise from PPG.\n    '''\n    \n    def __init__(self, filter_order: int = 16, step_size: float = 0.01):\n        '''\n        Args:\n            filter_order: Number of filter taps\n            step_size: LMS adaptation rate (mu)\n        '''\n        # Your initialization here\n        pass\n    \n    def process(self, ppg_sample: float, accel_sample: float) -> float:\n        '''\n        Process one sample.\n        \n        Args:\n            ppg_sample: Current PPG value (desired + noise)\n            accel_sample: Current accelerometer value (reference)\n        \n        Returns:\n            Filtered PPG (motion artifact removed)\n        '''\n        # Your code here\n        pass",
            "expected_answer": "Initialize weights to zeros, maintain buffer of reference samples. Process: 1) Shift buffer, add new accel sample. 2) Estimate noise: y = dot(weights, buffer). 3) Error: e = ppg - y. 4) Update weights: w = w + mu * e * buffer. Return e (cleaned signal). Step size mu: too large = unstable/oscillates, too small = slow adaptation. Typical: 0.001-0.1. Normalized LMS (NLMS) adapts mu based on signal power for stability.",
            "hints": ["LMS minimizes mean square error between prediction and actual", "The reference signal should be correlated with the noise, not the desired signal", "Consider normalized LMS for better stability"]
        }
    ],
    # BUG 3 & 4 FIX: Add default questions for general_engineering category
    "general_engineering": [
        {
            "question_text": "Explain the difference between unit tests, integration tests, and end-to-end tests. When would you use each type, and what are the trade-offs in terms of coverage, speed, and maintenance?",
            "question_code": None,
            "expected_answer": "Unit tests: test individual functions/methods in isolation, fast, easy to maintain, but miss integration issues. Integration tests: test multiple components together, catch interface bugs, slower, more complex setup. E2E tests: test full system from user perspective, highest confidence but slowest, flakiest, hardest to maintain. Testing pyramid: many unit tests, fewer integration, fewest E2E. Trade-off: coverage vs speed vs maintenance cost.",
            "hints": ["Think about the testing pyramid", "Consider what types of bugs each test level catches", "What happens when tests fail - how easy is it to find the root cause?"]
        },
        {
            "question_text": "What is the difference between optimistic and pessimistic locking in database systems? Give an example scenario where each would be preferred.",
            "question_code": None,
            "expected_answer": "Pessimistic: lock data before reading, prevents conflicts but reduces concurrency. Good for high-contention scenarios (bank transfers). Optimistic: read without locking, check for conflicts before commit (using version numbers or timestamps). Good for low-contention, read-heavy workloads (user profiles). Optimistic scales better but may require retry logic on conflicts.",
            "hints": ["Consider what happens when two users try to edit the same record", "Think about throughput vs consistency trade-offs", "Version numbers and timestamps are key to optimistic locking"]
        },
        {
            "question_text": "Explain how you would debug a production issue where an API endpoint is intermittently returning 500 errors. Walk through your debugging approach step by step.",
            "question_code": None,
            "expected_answer": "1) Check logs for error messages and stack traces. 2) Look at metrics: error rate, latency percentiles, resource usage. 3) Check for patterns: time-based, user-based, input-based. 4) Review recent deployments or config changes. 5) Check dependencies: database, external APIs, queues. 6) Try to reproduce with specific inputs. 7) Add additional logging/tracing if needed. 8) Use APM tools to trace request flow. Key: systematic elimination, correlate with timeline.",
            "hints": ["Start with logs and metrics", "Look for patterns in when errors occur", "Consider external dependencies like databases and APIs"]
        },
        {
            "question_text": "What are the key differences between REST and GraphQL APIs? When would you choose one over the other?",
            "question_code": None,
            "expected_answer": "REST: resource-based URLs, fixed response structures, multiple endpoints, HTTP verbs for operations, simpler caching. GraphQL: single endpoint, client specifies exact data needed, reduces over-fetching/under-fetching, typed schema, more complex caching. Choose REST for: simple CRUD, public APIs, caching-heavy. Choose GraphQL for: complex nested data, mobile apps (bandwidth), rapidly evolving front-ends, multiple client types.",
            "hints": ["Think about over-fetching and under-fetching of data", "Consider caching strategies for each", "Mobile vs web clients may have different needs"]
        }
    ]
}


class AIService:
    def __init__(self):
        self.api_url = settings.KIMI_API_URL
        self.timeout = 300.0  # 300 seconds for Kimi2 671B model
        self.client = httpx.AsyncClient(timeout=self.timeout)
        self.max_retries = 3
        self.retry_delay = 2  # seconds

        # Initialize knowledge base and resume analyzer
        self.knowledge_base = InterviewKnowledgeBase()
        self.resume_analyzer = ResumeAnalyzer()

        print(f"[AIService] Initialized with API URL: {self.api_url}, timeout: {self.timeout}s")
        if self.knowledge_base.loaded:
            print(f"[AIService] Knowledge base loaded with tracks: {self.knowledge_base.get_available_tracks()}")

    async def _call_kimi_with_retry(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
        """Make a call to the Kimi2 LLM API with retry logic."""
        last_error = None

        # Convert messages to a single prompt for llama.cpp
        prompt = ""
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                prompt += f"System: {content}\n\n"
            elif role == "user":
                prompt += f"User: {content}\n\n"
            elif role == "assistant":
                prompt += f"Assistant: {content}\n\n"
        prompt += "Assistant:"

        for attempt in range(self.max_retries):
            try:
                prompt_preview = prompt[:200] + "..." if len(prompt) > 200 else prompt
                print(f"[Kimi2] API call attempt {attempt + 1}/{self.max_retries}")
                print(f"[Kimi2] URL: {self.api_url}, Timeout: {self.timeout}s")
                print(f"[Kimi2] Prompt length: {len(prompt)} chars, preview: {prompt_preview}")

                start_time = time.time()

                response = await self.client.post(
                    self.api_url,
                    json={
                        "prompt": prompt,
                        "temperature": temperature,
                        "n_predict": 2048,
                        "stop": ["User:", "\n\nUser"]
                    },
                    timeout=self.timeout
                )

                elapsed = time.time() - start_time
                response.raise_for_status()
                data = response.json()
                result = data.get("content", "")
                print(f"[Kimi2] Response received in {elapsed:.1f}s: {len(result)} chars")
                return result
            except httpx.TimeoutException as e:
                last_error = e
                elapsed = time.time() - start_time
                print(f"[Kimi2] TIMEOUT after {elapsed:.1f}s (attempt {attempt + 1}/{self.max_retries}): {e}")
            except httpx.HTTPStatusError as e:
                last_error = e
                print(f"[Kimi2] HTTP error (attempt {attempt + 1}/{self.max_retries}): {e}")
            except Exception as e:
                last_error = e
                print(f"[Kimi2] Error (attempt {attempt + 1}/{self.max_retries}): {type(e).__name__}: {e}")

            if attempt < self.max_retries - 1:
                await asyncio.sleep(self.retry_delay * (attempt + 1))

        print(f"All {self.max_retries} retries failed. Last error: {last_error}")
        return ""

    def analyze_resume_difficulty(self, resume_text: str, skills: List[str] = None) -> Dict[str, Any]:
        """
        Analyze resume to determine appropriate difficulty level.

        Returns:
            Dict with difficulty, confidence, and analysis details
        """
        difficulty, confidence, analysis = self.resume_analyzer.analyze_experience_level(resume_text, skills)
        return {
            "difficulty": difficulty,
            "confidence": confidence,
            "analysis": analysis
        }

    def detect_candidate_track(self, resume_text: str, skills: List[str] = None) -> Dict[str, Any]:
        """
        Detect the best engineer track for a candidate based on resume.

        Returns:
            Dict with track_id, confidence, and analysis details
        """
        track_id, confidence, analysis = self.resume_analyzer.detect_best_track(resume_text, skills)
        return {
            "track_id": track_id,
            "confidence": confidence,
            "analysis": analysis
        }

    def explain_technical_term(self, term: str) -> Dict[str, Any]:
        """
        Explain a technical term using the knowledge base.

        Returns:
            Dict with explanation and whether term was found
        """
        term_data = self.knowledge_base.get_terminology(term)
        if term_data:
            return {
                "found": True,
                "term": term_data.get("term", term),
                "definition": term_data.get("definition", ""),
                "example": term_data.get("example", ""),
                "explanation": self.knowledge_base.explain_term(term)
            }
        return {
            "found": False,
            "term": term,
            "definition": "",
            "example": "",
            "explanation": f"Term '{term}' not found in knowledge base."
        }

    def get_questions_from_knowledge_base(
        self,
        track_id: str = None,
        difficulty: str = "medium",
        include_brain_teasers: bool = True,
        num_technical: int = 3,
        num_brain_teasers: int = 1
    ) -> Dict[str, List[Dict]]:
        """
        Get questions directly from the knowledge base.

        Returns:
            Dict with 'technical' and 'brain_teaser' question lists
        """
        result = {"technical": [], "brain_teaser": []}

        # Get brain teasers
        if include_brain_teasers:
            brain_teasers = self.knowledge_base.get_brain_teasers(difficulty)
            if brain_teasers:
                import random
                selected = random.sample(brain_teasers, min(num_brain_teasers, len(brain_teasers)))
                result["brain_teaser"] = selected

        # Get technical questions for track
        if track_id:
            technical = self.knowledge_base.get_track_questions(track_id, difficulty)
            if technical:
                import random
                selected = random.sample(technical, min(num_technical, len(technical)))
                result["technical"] = selected

        return result

    async def extract_skills_from_resume(self, resume_text: str) -> List[str]:
        """Extract skills from resume text using AI."""
        messages = [
            {
                "role": "system",
                "content": """You are an expert technical recruiter. Extract all technical skills from the resume.
Return ONLY a JSON array of skill strings. Include:
- Programming languages
- Frameworks and libraries
- Tools and platforms
- Databases
- Cloud services
- Methodologies
- Domain expertise (e.g., ML, signal processing, etc.)

Example output: ["Python", "FastAPI", "PostgreSQL", "AWS", "Machine Learning", "Docker"]"""
            },
            {
                "role": "user",
                "content": f"Extract technical skills from this resume:\n\n{resume_text}"
            }
        ]

        response = await self._call_kimi_with_retry(messages, temperature=0.3)

        if not response:
            return []

        try:
            skills = json.loads(response)
            if isinstance(skills, list):
                return skills
        except json.JSONDecodeError:
            match = re.search(r'\[.*\]', response, re.DOTALL)
            if match:
                try:
                    skills = json.loads(match.group())
                    if isinstance(skills, list):
                        return skills
                except:
                    pass
        return []

    async def generate_test_questions(
        self,
        categories: List[str],
        difficulty: str,
        skills: List[str],
        resume_text: Optional[str] = None,
        track_id: Optional[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Generate personalized test questions based on candidate profile."""

        # Auto-detect difficulty if resume provided
        if resume_text and difficulty == "auto":
            analysis = self.analyze_resume_difficulty(resume_text, skills)
            difficulty = analysis["difficulty"]
            print(f"[AIService] Auto-detected difficulty: {difficulty} (confidence: {analysis['confidence']:.2f})")

        # Map difficulty to difficulty level
        difficulty_map = {"easy": "junior", "medium": "mid", "hard": "senior"}
        difficulty_label = difficulty_map.get(difficulty, difficulty)

        category_prompts = {
            "brain_teaser": "Logic puzzles and problem-solving questions that test analytical thinking",
            "coding": "Programming challenges that require writing code to solve problems",
            "code_review": "Buggy code snippets that need to be identified and fixed",
            "system_design": "Architecture and system design questions",
            "signal_processing": "Digital signal processing questions (filters, FFT, DSP algorithms)",
            "general_engineering": "General software engineering concepts: algorithms, data structures, design patterns, testing strategies, debugging approaches, version control, APIs, databases, and software development best practices"
        }

        difficulty_guidance = {
            "junior": "Entry-level questions suitable for 0-2 years experience. Focus on fundamentals.",
            "mid": "Intermediate questions for 2-5 years experience. Include some complexity.",
            "senior": "Advanced questions for 5+ years experience. Focus on architecture, optimization, and edge cases.",
            "easy": "Entry-level questions suitable for 0-2 years experience. Focus on fundamentals.",
            "medium": "Intermediate questions for 2-5 years experience. Include some complexity.",
            "hard": "Advanced questions for 5+ years experience. Focus on architecture, optimization, and edge cases."
        }

        questions_by_category = {}

        # Try to get questions from knowledge base first for relevant categories
        kb_questions = self.get_questions_from_knowledge_base(
            track_id=track_id,
            difficulty=difficulty,
            include_brain_teasers="brain_teaser" in categories
        )

        for category in categories:
            if category not in category_prompts:
                continue

            num_questions = 3 if category in ["coding", "system_design"] else 4

            # Check if we have knowledge base questions for this category
            if category == "brain_teaser" and kb_questions.get("brain_teaser"):
                # Transform KB format to expected format
                kb_bt = kb_questions["brain_teaser"]
                questions_by_category[category] = [{
                    "question_text": q["question_text"],
                    "question_code": None,
                    "expected_answer": q.get("sample_strong_answer", ""),
                    "hints": q.get("hints", []),
                    "rubric": q.get("rubric", {}),
                    "follow_up": q.get("follow_up", ""),
                    "kb_id": q.get("id", "")
                } for q in kb_bt[:num_questions]]
                continue

            # For technical questions matching the track
            if track_id and kb_questions.get("technical"):
                # Check if this category matches any KB questions
                matching_kb = [q for q in kb_questions["technical"]
                              if q.get("category", "").lower() in category.lower() or
                              category.lower() in q.get("category", "").lower()]
                if matching_kb:
                    questions_by_category[category] = [{
                        "question_text": q["question_text"],
                        "question_code": q.get("question_code"),
                        "expected_answer": q.get("sample_strong_answer", ""),
                        "hints": q.get("hints", []),
                        "rubric": q.get("rubric", {}),
                        "follow_up": q.get("follow_up", ""),
                        "kb_id": q.get("id", "")
                    } for q in matching_kb[:num_questions]]
                    continue

            # Build rubric context if we have track-specific questions
            rubric_context = ""
            if track_id:
                track_questions = self.knowledge_base.get_track_questions(track_id, difficulty)
                if track_questions:
                    sample_q = track_questions[0]
                    rubric_context = f"\n\nUse this rubric structure for evaluation:\n{self.knowledge_base.format_rubric_for_prompt(sample_q)}"

            messages = [
                {
                    "role": "system",
                    "content": f"""You are an expert technical interviewer creating assessment questions for KOS AI.

{KOS_COMPANY_CONTEXT}

Category: {category_prompts.get(category, category)}
Difficulty: {difficulty_guidance.get(difficulty_label, difficulty)}
Candidate Skills: {', '.join(skills) if skills else 'General'}
{f'Engineer Track: {track_id}' if track_id else ''}
{rubric_context}

Generate {num_questions} questions for this category. Questions should be relevant to KOS AI's work when the category allows:
- For signal_processing: Focus on PPG, biomedical signals, motion artifact removal, multi-wavelength analysis
- For system_design: Consider real-time embedded systems, HIPAA compliance, BLE protocols, edge ML
- For coding: Include problems related to signal processing, time-series data, or embedded constraints
- For brain_teaser: Use scenarios involving sensors, signals, or health-tech concepts
- For code_review: Include code with issues common in embedded/signal processing contexts

Return a JSON array of question objects with this structure:
{{
  "question_text": "The question prompt",
  "question_code": "Code snippet if applicable (for coding/code_review), null otherwise",
  "expected_answer": "Brief description of expected answer or solution approach",
  "hints": ["Hint 1", "Hint 2"]
}}

UX 3 FIX - HINT GUIDELINES:
- Hints should be DIRECTIONAL, not revealing (guide thinking, don't give answers)
- Good hints: "Consider X", "Think about Y", "What happens when Z?"
- Bad hints: "The answer is X", "Use Y formula", "The solution involves Z"
- Hints should help a stuck candidate take one step forward
- 1-2 hints per question is ideal, keep them SHORT (1 sentence each)

Return ONLY the JSON array, no other text."""
                },
                {
                    "role": "user",
                    "content": f"Generate {num_questions} {difficulty} level {category} questions."
                    + (f"\n\nCandidate background:\n{resume_text[:2000]}" if resume_text else "")
                }
            ]

            response = await self._call_kimi_with_retry(messages, temperature=0.7)

            if not response:
                print(f"Using default questions for category: {category}")
                if category in DEFAULT_QUESTIONS:
                    questions_by_category[category] = DEFAULT_QUESTIONS[category][:num_questions]
                else:
                    questions_by_category[category] = []
                continue

            try:
                questions = json.loads(response)
                if isinstance(questions, list) and len(questions) > 0:
                    questions_by_category[category] = questions
                else:
                    if category in DEFAULT_QUESTIONS:
                        questions_by_category[category] = DEFAULT_QUESTIONS[category][:num_questions]
                    else:
                        questions_by_category[category] = []
            except json.JSONDecodeError:
                match = re.search(r'\[.*\]', response, re.DOTALL)
                if match:
                    try:
                        questions = json.loads(match.group())
                        if isinstance(questions, list) and len(questions) > 0:
                            questions_by_category[category] = questions
                            continue
                    except:
                        pass

                print(f"Failed to parse AI response for {category}, using defaults")
                if category in DEFAULT_QUESTIONS:
                    questions_by_category[category] = DEFAULT_QUESTIONS[category][:num_questions]
                else:
                    questions_by_category[category] = []

        return questions_by_category

    async def evaluate_answer(
        self,
        question_text: str,
        question_code: Optional[str],
        expected_answer: str,
        candidate_answer: str,
        candidate_code: Optional[str],
        category: str,
        difficulty: str,
        rubric: Optional[Dict] = None,
        track_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Evaluate a candidate's answer using AI with optional rubric."""

        # Build rubric context
        rubric_context = ""
        if rubric:
            rubric_context = "\n\nScoring Rubric (10 points total):\n"
            for cat_name, details in rubric.items():
                points = details.get("points", 0)
                rubric_context += f"\n{cat_name.replace('_', ' ').title()} ({points} points):\n"
                for criterion in details.get("criteria", []):
                    desc = criterion.get("description", "")
                    pts = criterion.get("points", 0)
                    rubric_context += f"  - {desc} ({pts} pt{'s' if pts != 1 else ''})\n"
            rubric_context += "\nScore the answer against each criterion and sum for total."

        messages = [
            {
                "role": "system",
                "content": f"""You are an expert technical interviewer evaluating candidate responses.

Category: {category}
Difficulty Level: {difficulty}
{f'Engineer Track: {track_id}' if track_id else ''}
{rubric_context}

Evaluate the candidate's answer and provide:
1. A score from 0-100 (or 0-10 if using rubric, then multiply by 10)
2. Detailed feedback explaining the score
3. What was good about the answer
4. What could be improved
{f'5. Breakdown of points per rubric category' if rubric else ''}

Return a JSON object:
{{
  "score": <number 0-100>,
  "feedback": "Detailed feedback",
  "strengths": ["What was good"],
  "improvements": ["What could be better"],
  {'"rubric_scores": {"category_name": points},' if rubric else ''}
  "meets_passing_threshold": <true if score >= 70>
}}

Be fair but rigorous. Consider:
- Correctness of the solution
- Code quality (if applicable)
- Problem-solving approach
- Communication clarity
- Edge case handling

Return ONLY the JSON object."""
            },
            {
                "role": "user",
                "content": f"""Question: {question_text}
{f'Question Code: {question_code}' if question_code else ''}

Expected Answer: {expected_answer}

Candidate's Answer: {candidate_answer}
{f'Candidate Code: {candidate_code}' if candidate_code else ''}

Evaluate this response."""
            }
        ]

        response = await self._call_kimi_with_retry(messages, temperature=0.3)

        if not response:
            return {
                "score": 50,
                "feedback": "Unable to evaluate automatically. Manual review required.",
                "strengths": [],
                "improvements": [],
                "meets_passing_threshold": False
            }

        try:
            evaluation = json.loads(response)
            # Ensure meets_passing_threshold is set
            if "meets_passing_threshold" not in evaluation:
                evaluation["meets_passing_threshold"] = evaluation.get("score", 0) >= 70
            return evaluation
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    evaluation = json.loads(match.group())
                    if "meets_passing_threshold" not in evaluation:
                        evaluation["meets_passing_threshold"] = evaluation.get("score", 0) >= 70
                    return evaluation
                except:
                    pass
            return {
                "score": 50,
                "feedback": "Unable to evaluate automatically. Manual review required.",
                "strengths": [],
                "improvements": [],
                "meets_passing_threshold": False
            }

    async def answer_candidate_question(
        self,
        candidate_question: str,
        context: Optional[str] = None,
        track_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Answer a candidate's question during the interview.
        Can explain technical terms, clarify questions, or provide hints.
        """

        # First check if this is asking about a term we know
        # Look for patterns like "what is X", "what does X mean", "explain X"
        term_patterns = [
            r"what (?:is|are|does) (?:a |an |the )?([A-Za-z0-9_\-\s]+?)(?:\?|$|\s+mean)",
            r"explain (?:what )?(?:is )?(?:a |an |the )?([A-Za-z0-9_\-\s]+?)(?:\?|$)",
            r"define (?:a |an |the )?([A-Za-z0-9_\-\s]+?)(?:\?|$)",
            r"meaning of (?:a |an |the )?([A-Za-z0-9_\-\s]+?)(?:\?|$)",
        ]

        for pattern in term_patterns:
            match = re.search(pattern, candidate_question.lower())
            if match:
                term = match.group(1).strip()
                term_info = self.explain_technical_term(term)
                if term_info["found"]:
                    return {
                        "answer": term_info["explanation"],
                        "source": "knowledge_base",
                        "term_found": True,
                        "related_terms": []
                    }

        # Build context with terminology for AI
        terminology_context = "Technical terms you can reference:\n"
        all_terms = self.knowledge_base.get_all_terminology()
        for term_key, term_data in list(all_terms.items())[:15]:  # Limit to 15 terms
            terminology_context += f"- {term_data.get('term', term_key)}: {term_data.get('definition', '')[:100]}...\n"

        messages = [
            {
                "role": "system",
                "content": f"""You are a helpful technical interview assistant at KOS AI.
A candidate is asking a question during their interview. Help them understand concepts without giving away answers.

{KOS_COMPANY_CONTEXT}

{terminology_context}

Guidelines:
1. If they ask about a technical term, explain it clearly with examples
2. If they ask for clarification on a question, help them understand what's being asked
3. If they seem stuck, provide a gentle hint without revealing the answer
4. Be encouraging and supportive
5. Keep explanations concise but complete

Return a JSON object:
{{
  "answer": "Your helpful response",
  "is_hint": true/false,
  "related_terms": ["List of related technical terms they might want to know"]
}}

Return ONLY the JSON object."""
            },
            {
                "role": "user",
                "content": f"""Candidate's question: {candidate_question}
{f'Current question context: {context}' if context else ''}
{f'Candidate is on track: {track_id}' if track_id else ''}

Please help the candidate."""
            }
        ]

        response = await self._call_kimi_with_retry(messages, temperature=0.5)

        if not response:
            return {
                "answer": "I'd be happy to help! Could you rephrase your question?",
                "source": "fallback",
                "is_hint": False,
                "related_terms": []
            }

        try:
            result = json.loads(response)
            result["source"] = "ai"
            return result
        except json.JSONDecodeError:
            # Try to extract answer from response
            return {
                "answer": response[:500] if response else "Could you rephrase your question?",
                "source": "ai_raw",
                "is_hint": False,
                "related_terms": []
            }

    async def generate_report(
        self,
        candidate_name: str,
        categories: List[str],
        difficulty: str,
        section_scores: Dict[str, float],
        question_details: List[Dict[str, Any]],
        track_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a comprehensive assessment report."""

        # Get passing score from knowledge base
        passing_score = self.knowledge_base.get_passing_score()

        messages = [
            {
                "role": "system",
                "content": f"""You are an expert technical hiring manager creating a comprehensive candidate assessment report.

{f'Assessment Track: {track_id}' if track_id else ''}
Passing Score Threshold: {passing_score}%

Based on the candidate's performance, generate a detailed report with:
1. Overall recommendation (strong_hire, hire, maybe, no_hire)
2. Summary of performance
3. Key strengths
4. Areas for improvement
5. Detailed analysis

Return a JSON object:
{{
  "recommendation": "strong_hire|hire|maybe|no_hire",
  "summary": "Brief overall summary",
  "strengths": ["Key strength 1", "Key strength 2"],
  "weaknesses": ["Area for improvement 1"],
  "detailed_feedback": "Comprehensive analysis of the candidate's performance",
  "meets_passing_threshold": true/false,
  "suggested_follow_up": ["Topics to probe in follow-up interview"]
}}

Be objective and professional. Consider the difficulty level when making recommendations."""
            },
            {
                "role": "user",
                "content": f"""Candidate: {candidate_name}
Test Difficulty: {difficulty}
Categories Tested: {', '.join(categories)}

Section Scores:
{json.dumps(section_scores, indent=2)}

Question Details:
{json.dumps(question_details[:10], indent=2)}

Generate a comprehensive assessment report."""
            }
        ]

        response = await self._call_kimi_with_retry(messages, temperature=0.5)

        avg_score = sum(section_scores.values()) / len(section_scores) if section_scores else 0
        if avg_score >= 85:
            rec = "strong_hire"
        elif avg_score >= passing_score:
            rec = "hire"
        elif avg_score >= 50:
            rec = "maybe"
        else:
            rec = "no_hire"

        fallback_report = {
            "recommendation": rec,
            "summary": f"Candidate scored an average of {avg_score:.1f}% across all sections.",
            "strengths": [],
            "weaknesses": [],
            "detailed_feedback": "Automated report generation. Manual review recommended.",
            "meets_passing_threshold": avg_score >= passing_score,
            "suggested_follow_up": []
        }

        if not response:
            return fallback_report

        try:
            report = json.loads(response)
            if "meets_passing_threshold" not in report:
                report["meets_passing_threshold"] = avg_score >= passing_score
            return report
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    report = json.loads(match.group())
                    if "meets_passing_threshold" not in report:
                        report["meets_passing_threshold"] = avg_score >= passing_score
                    return report
                except:
                    pass
            return fallback_report

    async def determine_track(self, resume_text: str, skills: List[str]) -> str:
        """Determine the best challenge track for a candidate based on their resume."""

        # First try rule-based detection
        rule_result = self.detect_candidate_track(resume_text, skills)
        if rule_result["confidence"] >= 0.6:
            # Map internal track IDs to expected values
            track_mapping = {
                "ml_engineer": "signal_processing",  # ML engineers often do signal processing at KOS
                "biomedical_engineer": "signal_processing",
                "electrical_engineer": "signal_processing",
                "firmware_engineer": "signal_processing",
                "mechanical_engineer": "signal_processing"
            }
            detected_track = rule_result["track_id"]
            # Default to the two main tracks
            if "ml" in detected_track or "signal" in detected_track.lower():
                return "signal_processing"
            return track_mapping.get(detected_track, "llm")

        # Fall back to AI-based detection
        messages = [
            {
                "role": "system",
                "content": """You are an expert technical recruiter determining which assessment track is best for a candidate.

We have two tracks:
1. "signal_processing" - For candidates with background in DSP, biomedical signal processing, embedded systems, sensor data, PPG/ECG signals, or related hardware/firmware experience.
2. "llm" - For candidates with background in LLMs, NLP, RAG systems, generative AI, prompt engineering, or AI/ML application development.

Analyze the candidate's resume and skills to determine which track is a better fit.
Consider their education, work experience, and listed skills.

Return ONLY a JSON object:
{
  "track": "signal_processing" or "llm",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}"""
            },
            {
                "role": "user",
                "content": f"""Skills: {', '.join(skills) if skills else 'Not specified'}

Resume:
{resume_text[:3000] if resume_text else 'No resume provided'}

Which track should this candidate take?"""
            }
        ]

        response = await self._call_kimi_with_retry(messages, temperature=0.3)

        if not response:
            # Default to LLM track if unable to determine
            return "llm"

        try:
            result = json.loads(response)
            track = result.get("track", "llm")
            if track in ["signal_processing", "llm"]:
                return track
        except json.JSONDecodeError:
            # Try to find track in response
            if "signal_processing" in response.lower():
                return "signal_processing"

        return "llm"

    async def evaluate_challenge_task(
        self,
        task_title: str,
        task_description: str,
        task_requirements: List[str],
        candidate_response: str,
        candidate_code: str,
        track: str,
        difficulty: str
    ) -> Dict[str, Any]:
        """Evaluate a candidate's response to a challenge task."""

        requirements_text = "\n".join(f"- {req}" for req in task_requirements)

        messages = [
            {
                "role": "system",
                "content": f"""You are an expert technical interviewer evaluating a candidate's challenge response.

Track: {track}
Difficulty Level: {difficulty}

Task: {task_title}
Description: {task_description}

Requirements:
{requirements_text}

Evaluate the candidate's response against each requirement. Consider:
- Technical accuracy and depth
- Completeness of the solution
- Quality of explanation
- Code quality (if applicable)
- Practical applicability
- Innovation and creativity

Return a JSON object:
{{
  "score": <number 0-100>,
  "feedback": "Detailed feedback",
  "requirement_scores": {{
    "requirement_1": <0-100>,
    ...
  }},
  "strengths": ["What was good"],
  "improvements": ["What could be better"]
}}

Be fair but rigorous. This is a real-world challenge that will be discussed in a presentation.

Return ONLY the JSON object."""
            },
            {
                "role": "user",
                "content": f"""Candidate's Response:
{candidate_response}

{"Candidate Code:" + chr(10) + candidate_code if candidate_code else ""}

Evaluate this response against the task requirements."""
            }
        ]

        response = await self._call_kimi_with_retry(messages, temperature=0.3)

        if not response:
            return {
                "score": 50,
                "feedback": "Unable to evaluate automatically. Manual review required.",
                "strengths": [],
                "improvements": []
            }

        try:
            evaluation = json.loads(response)
            return evaluation
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except:
                    pass
            return {
                "score": 50,
                "feedback": "Unable to evaluate automatically. Manual review required.",
                "strengths": [],
                "improvements": []
            }

    async def generate_challenge_presentation(
        self,
        candidate_name: str,
        track: str,
        challenge_spec: Any,
        task_responses: List[Any],
        deliverables: List[Any]
    ) -> Dict[str, Any]:
        """Generate a presentation from the candidate's challenge submission."""

        # Build context from task responses
        task_summaries = []
        for task in challenge_spec.tasks:
            response = next((r for r in task_responses if r.task_id == task.id), None)
            if response and response.response_text:
                task_summaries.append({
                    "task_id": task.id,
                    "task_title": task.title,
                    "response_preview": response.response_text[:1000],
                    "code_preview": response.response_code[:500] if response.response_code else None,
                    "score": response.score
                })

        # Build deliverable summaries
        deliverable_summaries = []
        for d in deliverables:
            content = d.inline_content or f"[File: {d.file_name}]"
            deliverable_summaries.append({
                "type": d.deliverable_type,
                "title": d.title,
                "content_preview": content[:500]
            })

        sections = challenge_spec.auto_presentation.sections

        messages = [
            {
                "role": "system",
                "content": f"""You are creating a presentation deck for a technical interview.

Candidate: {candidate_name}
Track: {track}
Challenge: {challenge_spec.title}

The presentation should have these sections:
{json.dumps(sections, indent=2)}

For each section, create a slide with:
- A clear title
- Key points (bullet points or short paragraphs)
- Speaker notes for the candidate

Base the content on the candidate's actual work. Be professional and highlight their approach.

Return a JSON object:
{{
  "title": "Presentation title",
  "slides": [
    {{
      "title": "Section title",
      "content": "Markdown formatted content",
      "notes": "Speaker notes"
    }}
  ]
}}

Return ONLY the JSON object."""
            },
            {
                "role": "user",
                "content": f"""Task Responses:
{json.dumps(task_summaries, indent=2)}

Deliverables:
{json.dumps(deliverable_summaries, indent=2)}

Generate the presentation slides."""
            }
        ]

        response = await self._call_kimi_with_retry(messages, temperature=0.5)

        if not response:
            # Return basic presentation structure
            return {
                "title": f"{challenge_spec.title} - {candidate_name}",
                "candidate_name": candidate_name,
                "track": track,
                "slides": [
                    {"title": section, "content": "Content to be filled in", "notes": ""}
                    for section in sections
                ],
                "generated_at": None
            }

        try:
            presentation = json.loads(response)
            presentation["candidate_name"] = candidate_name
            presentation["track"] = track
            return presentation
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    presentation = json.loads(match.group())
                    presentation["candidate_name"] = candidate_name
                    presentation["track"] = track
                    return presentation
                except:
                    pass

            return {
                "title": f"{challenge_spec.title} - {candidate_name}",
                "candidate_name": candidate_name,
                "track": track,
                "slides": [
                    {"title": section, "content": "Content to be filled in", "notes": ""}
                    for section in sections
                ],
                "generated_at": None
            }

    async def generate_live_feedback(
        self,
        question_text: str,
        question_code: Optional[str],
        expected_answer: str,
        candidate_answer: str,
        candidate_code: Optional[str],
        category: str
    ) -> Dict[str, Any]:
        """Generate lightweight, encouraging feedback for a candidate's in-progress answer.

        This is designed for real-time feedback while the candidate is typing.
        Uses a shorter, faster prompt focused on guidance rather than grading.
        """

        # Skip if answer is too short
        if len(candidate_answer.strip()) < 20 and not candidate_code:
            return {
                "hints": [],
                "missing_points": [],
                "strengths": [],
                "status": "too_short"
            }

        messages = [
            {
                "role": "system",
                "content": f"""You are a helpful mentor providing real-time feedback on a candidate's answer.
Your goal is to GUIDE, not GRADE. Be encouraging and constructive.

Category: {category}

IMPORTANT - UX 2 FIX: First assess the answer quality:
- EXCELLENT (80%+ of key concepts, deep understanding): Praise them! Return mostly STRENGTHS, minimal/no hints.
- GOOD (50-80% coverage): Balanced feedback with both strengths and gentle guidance.
- NEEDS WORK (<50%): Focus on constructive hints to guide improvement.

For EXCELLENT answers, say things like "Excellent coverage!", "Great approach!", "You've nailed the key concepts!"
Do NOT give unnecessary hints for already strong answers - it can be discouraging.

Provide quick, actionable feedback:
1. STRENGTHS: What's good about the answer (ALWAYS include if answer has any merit)
2. HINTS: Subtle suggestions to improve (ONLY if genuinely needed - skip for excellent answers)
3. MISSING: Key points to address (ONLY if significant gaps exist)

Keep feedback SHORT (1 sentence each). Be encouraging.
Do NOT give away the answer directly - just guide them.

Return a JSON object:
{{
  "hints": ["Short hint if needed"],
  "missing_points": ["Missing concept if any"],
  "strengths": ["Strength 1", "Strength 2"]
}}

Return ONLY the JSON object. Keep it brief and helpful."""
            },
            {
                "role": "user",
                "content": f"""Question: {question_text}
{f'Code Context: {question_code[:500]}' if question_code else ''}

Expected topics: {expected_answer[:300]}

Current Answer: {candidate_answer[:1000]}
{f'Current Code: {candidate_code[:500]}' if candidate_code else ''}

Provide brief, encouraging feedback."""
            }
        ]

        # Use lower temperature for more consistent feedback
        response = await self._call_kimi_with_retry(messages, temperature=0.4)

        if not response:
            return {
                "hints": [],
                "missing_points": [],
                "strengths": ["Keep going! Your answer is taking shape."],
                "status": "ai_unavailable"
            }

        try:
            feedback = json.loads(response)
            # Ensure all required fields exist
            feedback.setdefault("hints", [])
            feedback.setdefault("missing_points", [])
            feedback.setdefault("strengths", [])
            feedback["status"] = "success"

            # Limit to 2 items per category for cleaner UI
            feedback["hints"] = feedback["hints"][:2]
            feedback["missing_points"] = feedback["missing_points"][:2]
            feedback["strengths"] = feedback["strengths"][:2]

            return feedback
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    feedback = json.loads(match.group())
                    feedback.setdefault("hints", [])
                    feedback.setdefault("missing_points", [])
                    feedback.setdefault("strengths", [])
                    feedback["status"] = "success"
                    return feedback
                except:
                    pass

            return {
                "hints": [],
                "missing_points": [],
                "strengths": ["You're on the right track!"],
                "status": "parse_error"
            }

    async def analyze_improvement_suggestion(
        self,
        raw_feedback: str,
        candidate_track: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a candidate's improvement suggestion using Kimi2.

        Determines if the suggestion:
        - Makes sense technically
        - Can be auto-implemented (add to knowledge base)
        - Needs admin review (generates Claude Code command)

        Returns:
            Dict with analysis results
        """

        available_tracks = self.knowledge_base.get_available_tracks()
        track_list = ", ".join(available_tracks) if available_tracks else "ml_engineer, biomedical_engineer, electrical_engineer, firmware_engineer, mechanical_engineer"

        messages = [
            {
                "role": "system",
                "content": f"""You are an expert technical interview system analyst. Analyze candidate feedback to determine if it can improve our interview system.

Our interview knowledge base contains:
- Technical questions for tracks: {track_list}
- Brain teaser puzzles
- Technical terminology definitions
- Scoring rubrics

CATEGORIES of suggestions:
1. "new_question" - Candidate suggests adding a new interview question
2. "improve_question" - Candidate suggests improving an existing question
3. "new_terminology" - Candidate suggests adding a technical term definition
4. "ui_feedback" - Feedback about the interview UI/UX
5. "technical_issue" - Report of a bug or technical problem
6. "other" - Doesn't fit other categories

PRIORITY levels: "low", "medium", "high", "critical"

RULES for auto-implementation (can_auto_implement=true):
- Only for new_question, improve_question, or new_terminology categories
- The suggestion must be technically accurate and complete
- Must include enough detail to implement (question text, expected answer, etc.)
- Must be appropriate for KOS AI's technical interview focus

For suggestions that need admin review, generate a Claude Code command that an admin could run.

Analyze the feedback and return a JSON object:
{{
    "is_valid": true/false (is this a genuine, actionable suggestion?),
    "category": "new_question|improve_question|new_terminology|ui_feedback|technical_issue|other",
    "priority": "low|medium|high|critical",
    "can_auto_implement": true/false,
    "suggested_action": "Brief description of what action to take",
    "extracted_content": {{
        // For new_question:
        "question_text": "The question to add",
        "expected_answer": "What a good answer should include",
        "hints": ["Hint 1", "Hint 2"],
        "difficulty": "easy|medium|hard",
        "track_id": "which engineer track this belongs to",
        "category": "brain_teaser|coding|system_design|signal_processing|code_review",

        // For new_terminology:
        "term_key": "abbreviation or short form",
        "term_name": "Full term name",
        "term_definition": "Clear definition",
        "term_example": "Usage example",

        // For improve_question:
        "target_question": "Identify which existing question to improve",
        "improvement": "What to change"
    }},
    "reasoning": "Explain your analysis"
}}

Return ONLY the JSON object."""
            },
            {
                "role": "user",
                "content": f"""Candidate Feedback:
{raw_feedback}

{f'Candidate was on track: {candidate_track}' if candidate_track else ''}

Analyze this suggestion."""
            }
        ]

        response = await self._call_kimi_with_retry(messages, temperature=0.3)

        # Default fallback response
        fallback = {
            "is_valid": True,
            "category": "other",
            "priority": "medium",
            "can_auto_implement": False,
            "suggested_action": "Requires manual admin review",
            "extracted_content": None,
            "reasoning": "Unable to analyze automatically"
        }

        if not response:
            return fallback

        try:
            analysis = json.loads(response)
            # Validate required fields
            required = ["is_valid", "category", "priority", "can_auto_implement", "suggested_action"]
            for field in required:
                if field not in analysis:
                    analysis[field] = fallback[field]
            return analysis
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    analysis = json.loads(match.group())
                    for field in ["is_valid", "category", "priority", "can_auto_implement", "suggested_action"]:
                        if field not in analysis:
                            analysis[field] = fallback[field]
                    return analysis
                except:
                    pass
            return fallback

    def generate_claude_code_command(self, analysis: Dict[str, Any]) -> str:
        """
        Generate a Claude Code command for manual implementation of a suggestion.
        """
        category = analysis.get("category", "other")
        content = analysis.get("extracted_content", {}) or {}
        action = analysis.get("suggested_action", "Review this suggestion")

        if category == "new_question":
            question_text = content.get("question_text", "[Question text needed]")
            track = content.get("track_id", "ml_engineer")
            difficulty = content.get("difficulty", "medium")
            return f"""Add a new interview question to the knowledge base:

Track: {track}
Difficulty: {difficulty}
Question: {question_text}

Expected Answer: {content.get('expected_answer', '[Add expected answer]')}
Hints: {content.get('hints', [])}

Please edit /backend/data/interview_knowledge.json to add this question with appropriate rubric."""

        elif category == "improve_question":
            target = content.get("target_question", "[Identify question]")
            improvement = content.get("improvement", "[Describe improvement]")
            return f"""Improve an existing interview question:

Target Question: {target}
Improvement: {improvement}

Please find and update this question in /backend/data/interview_knowledge.json"""

        elif category == "new_terminology":
            term_key = content.get("term_key", "[TERM]")
            term_name = content.get("term_name", "[Full name]")
            definition = content.get("term_definition", "[Definition]")
            example = content.get("term_example", "[Example]")
            return f"""Add new terminology to the knowledge base:

Term Key: {term_key}
Full Name: {term_name}
Definition: {definition}
Example: {example}

Please add to the "terminology" section in /backend/data/interview_knowledge.json"""

        elif category == "ui_feedback":
            return f"""UI/UX Improvement Suggestion:

{action}

Feedback details: {analysis.get('reasoning', 'See raw feedback')}

Review and implement appropriate frontend changes."""

        elif category == "technical_issue":
            return f"""Technical Issue Report:

{action}

Details: {analysis.get('reasoning', 'See raw feedback')}

Investigate and fix the reported issue."""

        else:
            return f"""Review Suggestion:

Category: {category}
Action: {action}
Reasoning: {analysis.get('reasoning', 'Manual review required')}

Please review the original feedback and take appropriate action."""

    async def auto_implement_suggestion(
        self,
        analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Attempt to auto-implement a suggestion by updating the knowledge base.

        Returns:
            Dict with success status and details
        """
        if not analysis.get("can_auto_implement", False):
            return {
                "success": False,
                "message": "Suggestion not marked for auto-implementation",
                "changes_made": None
            }

        category = analysis.get("category", "")
        content = analysis.get("extracted_content", {})

        if not content:
            return {
                "success": False,
                "message": "No extracted content to implement",
                "changes_made": None
            }

        try:
            # Load current knowledge base
            kb_path = Path(__file__).parent.parent.parent / "data" / "interview_knowledge.json"
            if not kb_path.exists():
                return {
                    "success": False,
                    "message": "Knowledge base file not found",
                    "changes_made": None
                }

            with open(kb_path, 'r', encoding='utf-8') as f:
                kb_data = json.load(f)

            changes = []

            if category == "new_terminology":
                term_key = content.get("term_key", "").upper().replace(" ", "_")
                if not term_key:
                    return {"success": False, "message": "No term key provided", "changes_made": None}

                new_term = {
                    "term": content.get("term_name", term_key),
                    "definition": content.get("term_definition", ""),
                    "example": content.get("term_example", "")
                }

                if "terminology" not in kb_data:
                    kb_data["terminology"] = {}

                kb_data["terminology"][term_key] = new_term
                changes.append(f"Added terminology: {term_key}")

            elif category == "new_question":
                track_id = content.get("track_id", "ml_engineer")
                question_text = content.get("question_text", "")

                if not question_text:
                    return {"success": False, "message": "No question text provided", "changes_made": None}

                # Create new question object
                new_question = {
                    "id": f"{track_id}_auto_{int(datetime.now().timestamp())}",
                    "question_text": question_text,
                    "difficulty": [content.get("difficulty", "medium")],
                    "category": content.get("category", "general"),
                    "rubric": {
                        "correctness": {
                            "points": 5,
                            "criteria": [
                                {"description": "Correct understanding", "points": 3},
                                {"description": "Accurate details", "points": 2}
                            ]
                        },
                        "depth": {
                            "points": 5,
                            "criteria": [
                                {"description": "Thorough explanation", "points": 3},
                                {"description": "Practical examples", "points": 2}
                            ]
                        }
                    },
                    "sample_strong_answer": content.get("expected_answer", ""),
                    "hints": content.get("hints", []),
                    "auto_added": True,
                    "added_at": datetime.now().isoformat()
                }

                if "engineer_tracks" not in kb_data:
                    kb_data["engineer_tracks"] = {}
                if track_id not in kb_data["engineer_tracks"]:
                    kb_data["engineer_tracks"][track_id] = {"technical_questions": []}
                if "technical_questions" not in kb_data["engineer_tracks"][track_id]:
                    kb_data["engineer_tracks"][track_id]["technical_questions"] = []

                kb_data["engineer_tracks"][track_id]["technical_questions"].append(new_question)
                changes.append(f"Added question to {track_id}: {question_text[:50]}...")

            else:
                return {
                    "success": False,
                    "message": f"Auto-implementation not supported for category: {category}",
                    "changes_made": None
                }

            # Save updated knowledge base
            with open(kb_path, 'w', encoding='utf-8') as f:
                json.dump(kb_data, f, indent=2, ensure_ascii=False)

            # Reload knowledge base in memory
            self.knowledge_base._load_knowledge_base()

            return {
                "success": True,
                "message": "Successfully auto-implemented suggestion",
                "changes_made": changes
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error during auto-implementation: {str(e)}",
                "changes_made": None
            }

    async def generate_role_fit_recommendation(
        self,
        candidate_name: str,
        section_scores: Dict[str, float],
        strengths: List[str],
        weaknesses: List[str],
        skills: List[str] = None,
        current_role_id: str = None
    ) -> Dict[str, Any]:
        """
        Generate role fit recommendations based on assessment results.

        Returns recommended roles with fit scores and explanations.
        """
        from app.config.roles import ENGINEERING_ROLES, get_role_skill_dimensions

        # Calculate fit scores for each role
        role_fits = []

        for role_id, role_config in ENGINEERING_ROLES.items():
            fit_score = 0
            explanations = []

            # Map section scores to role categories
            category_mapping = {
                "brain_teaser": "brain_teaser",
                "coding": "coding",
                "code_review": "code_review",
                "system_design": "system_design",
                "signal_processing": "signal_processing",
            }

            total_weight = 0
            weighted_score = 0

            for category, config in role_config.get("categories", {}).items():
                weight = config.get("weight", 0.1)
                total_weight += weight

                # Find matching section score
                score = section_scores.get(category, 0)
                if score:
                    weighted_score += score * weight

            if total_weight > 0:
                fit_score = weighted_score / total_weight

            # Boost score if candidate has relevant skills
            if skills:
                focus_areas = role_config.get("focus_areas", [])
                skill_matches = 0
                for skill in skills:
                    for focus in focus_areas:
                        if skill.lower() in focus.lower() or focus.lower() in skill.lower():
                            skill_matches += 1
                            break

                if skill_matches > 0:
                    skill_boost = min(skill_matches * 2, 10)  # Max 10% boost
                    fit_score = min(100, fit_score + skill_boost)
                    explanations.append(f"{skill_matches} matching skills detected")

            # Generate explanation
            skill_dimensions = role_config.get("skill_dimensions", [])
            if fit_score >= 80:
                explanations.append("Strong alignment with role requirements")
            elif fit_score >= 60:
                explanations.append("Good potential for this role")
            elif fit_score >= 40:
                explanations.append("Some gaps in key areas")
            else:
                explanations.append("May need significant development")

            role_fits.append({
                "role_id": role_id,
                "role_title": role_config["title"],
                "fit_score": round(fit_score, 1),
                "explanation": ". ".join(explanations),
                "skill_dimensions": skill_dimensions,
                "is_current_role": role_id == current_role_id,
            })

        # Sort by fit score descending
        role_fits.sort(key=lambda x: x["fit_score"], reverse=True)

        # Generate AI-powered recommendations if available
        top_roles = role_fits[:3]
        ai_recommendation = None

        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are an expert career advisor providing role fit recommendations based on assessment results.

Return a JSON object with:
{
    "primary_recommendation": "role_id of best fit",
    "recommendation_summary": "2-3 sentence summary of the recommendation",
    "development_areas": ["Area 1", "Area 2"],
    "career_path_suggestions": ["Suggestion 1", "Suggestion 2"]
}"""
                },
                {
                    "role": "user",
                    "content": f"""Candidate: {candidate_name}

Assessment Scores:
{json.dumps(section_scores, indent=2)}

Strengths: {', '.join(strengths[:5]) if strengths else 'Not identified'}
Areas for Improvement: {', '.join(weaknesses[:5]) if weaknesses else 'Not identified'}
Skills: {', '.join(skills[:10]) if skills else 'Not specified'}

Top 3 Role Matches:
{json.dumps([{k: v for k, v in r.items() if k in ['role_id', 'role_title', 'fit_score']} for r in top_roles], indent=2)}

Provide a role fit recommendation."""
                }
            ]

            response = await self._call_kimi_with_retry(messages, temperature=0.5)

            if response:
                try:
                    ai_recommendation = json.loads(response)
                except json.JSONDecodeError:
                    match = re.search(r'\{.*\}', response, re.DOTALL)
                    if match:
                        try:
                            ai_recommendation = json.loads(match.group())
                        except:
                            pass
        except Exception as e:
            print(f"[AIService] Error generating AI role recommendation: {e}")

        return {
            "role_fits": role_fits,
            "top_recommendation": role_fits[0] if role_fits else None,
            "ai_recommendation": ai_recommendation,
        }

    async def close(self):
        await self.client.aclose()


# Singleton instance
ai_service = AIService()
