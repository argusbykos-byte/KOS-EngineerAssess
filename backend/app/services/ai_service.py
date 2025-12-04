import httpx
import json
import asyncio
import re
from typing import List, Optional, Dict, Any
from app.config import settings


# Default questions for each category when AI fails
DEFAULT_QUESTIONS = {
    "brain_teaser": [
        {
            "question_text": "You have 8 balls, all identical in appearance. One of them is slightly heavier than the others. Using a balance scale only twice, how can you identify the heavier ball?",
            "question_code": None,
            "expected_answer": "Divide balls into groups of 3, 3, and 2. Weigh two groups of 3. If balanced, weigh the remaining 2. If unbalanced, take the heavier group of 3, pick any 2 and weigh them.",
            "hints": ["Think about dividing the balls into groups", "You can eliminate multiple balls with each weighing"]
        },
        {
            "question_text": "A farmer needs to cross a river with a wolf, a goat, and a cabbage. The boat can only carry the farmer and one item at a time. If left alone, the wolf will eat the goat, and the goat will eat the cabbage. How can the farmer get everything across safely?",
            "question_code": None,
            "expected_answer": "Take goat across, return alone. Take wolf across, bring goat back. Take cabbage across, return alone. Take goat across.",
            "hints": ["The goat is the problem - it conflicts with both other items", "You may need to bring something back"]
        },
        {
            "question_text": "You have two ropes, each takes exactly 60 minutes to burn completely, but they burn at inconsistent rates. How can you measure exactly 45 minutes?",
            "question_code": None,
            "expected_answer": "Light first rope from both ends and second rope from one end. When first rope burns out (30 min), light the other end of second rope. When it burns out, 45 minutes have passed.",
            "hints": ["A rope lit from both ends burns in half the time", "You can light ropes at different times"]
        },
        {
            "question_text": "There are 100 lockers in a row, all closed. 100 students walk by. The first student opens every locker. The second student toggles every 2nd locker. The third toggles every 3rd, and so on. After all students pass, which lockers are open?",
            "question_code": None,
            "expected_answer": "Lockers 1, 4, 9, 16, 25, 36, 49, 64, 81, 100 are open - the perfect squares. A locker is toggled once for each of its factors, and only perfect squares have an odd number of factors.",
            "hints": ["Think about how many times each locker is toggled", "Consider the factors of each locker number"]
        }
    ],
    "coding": [
        {
            "question_text": "Write a function that finds the first non-repeating character in a string. Return the character, or None if all characters repeat.",
            "question_code": "# Example:\n# Input: 'aabbcdeeff'\n# Output: 'c'\n\ndef first_non_repeating(s: str) -> str | None:\n    # Your code here\n    pass",
            "expected_answer": "Use a dictionary to count character occurrences, then iterate through string to find first character with count 1. Time: O(n), Space: O(k) where k is alphabet size.",
            "hints": ["Consider using a hash map to count occurrences", "You need to preserve order when finding the first one"]
        },
        {
            "question_text": "Implement a function that checks if a binary tree is balanced. A balanced tree has the property that the heights of the two subtrees of any node never differ by more than one.",
            "question_code": "class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\ndef is_balanced(root: TreeNode) -> bool:\n    # Your code here\n    pass",
            "expected_answer": "Use recursion to calculate height while checking balance. Return -1 to indicate unbalanced subtree. Time: O(n), Space: O(h) where h is height.",
            "hints": ["Think about what information you need from subtrees", "Can you combine height calculation with balance checking?"]
        },
        {
            "question_text": "Write a function that merges two sorted arrays into one sorted array without using extra space proportional to the total size (in-place merge). Assume the first array has enough space at the end to hold all elements.",
            "question_code": "def merge_in_place(nums1: list, m: int, nums2: list, n: int) -> None:\n    '''\n    nums1 has length m + n, with first m elements being valid\n    nums2 has length n\n    Merge nums2 into nums1 in-place\n    '''\n    # Your code here\n    pass",
            "expected_answer": "Start from the end of both arrays and work backwards, placing larger elements at the end of nums1. This avoids overwriting elements we haven't processed yet.",
            "hints": ["Consider starting from the end rather than the beginning", "Which direction avoids overwriting unprocessed elements?"]
        }
    ],
    "code_review": [
        {
            "question_text": "Review the following code and identify all bugs. Explain what's wrong and how to fix each issue.",
            "question_code": "def calculate_average(numbers):\n    total = 0\n    for i in range(len(numbers)):\n        total += numbers[i]\n    return total / len(numbers)\n\ndef find_duplicates(lst):\n    duplicates = []\n    for i in range(len(lst)):\n        for j in range(len(lst)):\n            if lst[i] == lst[j]:\n                duplicates.append(lst[i])\n    return duplicates\n\ndef reverse_string(s):\n    reversed = ''\n    for i in range(len(s), 0, -1):\n        reversed += s[i]\n    return reversed",
            "expected_answer": "1) calculate_average: Division by zero if empty list. 2) find_duplicates: Compares element with itself (j should start at i+1), adds duplicates multiple times. 3) reverse_string: Index out of range (should be len(s)-1), uses reserved keyword 'reversed'.",
            "hints": ["Check edge cases", "Look at loop boundaries carefully", "Consider variable naming"]
        },
        {
            "question_text": "This code has performance issues. Identify them and suggest improvements.",
            "question_code": "def find_common_elements(list1, list2):\n    common = []\n    for item in list1:\n        if item in list2:\n            if item not in common:\n                common.append(item)\n    return common\n\ndef count_words(text):\n    words = text.split()\n    word_count = {}\n    for word in words:\n        found = False\n        for key in word_count:\n            if key == word:\n                word_count[key] += 1\n                found = True\n                break\n        if not found:\n            word_count[word] = 1\n    return word_count",
            "expected_answer": "1) find_common_elements: O(n*m) due to 'in' on list. Use sets for O(n+m). 2) count_words: Manual dictionary lookup is O(n) per word. Use dict.get() or collections.Counter.",
            "hints": ["Think about the time complexity of 'in' operator for different data structures", "Python has built-in methods that are more efficient"]
        },
        {
            "question_text": "Identify the security vulnerabilities in this code and explain how to fix them.",
            "question_code": "import sqlite3\nimport os\n\ndef get_user(username):\n    conn = sqlite3.connect('users.db')\n    cursor = conn.cursor()\n    query = f\"SELECT * FROM users WHERE username = '{username}'\"\n    cursor.execute(query)\n    return cursor.fetchone()\n\ndef run_command(user_input):\n    os.system(f'echo {user_input}')\n\ndef read_file(filename):\n    with open(f'/data/{filename}', 'r') as f:\n        return f.read()",
            "expected_answer": "1) SQL Injection: Use parameterized queries. 2) Command Injection: Use subprocess with shell=False or escape input. 3) Path Traversal: Validate filename doesn't contain '..' or absolute paths.",
            "hints": ["Consider what happens if user provides malicious input", "Look up OWASP Top 10 vulnerabilities"]
        }
    ],
    "system_design": [
        {
            "question_text": "Design a URL shortening service like bit.ly. Describe the system architecture, data model, and key algorithms. Consider scalability for millions of URLs and high read traffic.",
            "question_code": None,
            "expected_answer": "Components: Web servers, application servers, database, cache. Data model: short_code, original_url, created_at, user_id. Algorithm: Base62 encoding of auto-increment ID or hash. Caching with Redis. Database sharding by short_code. CDN for redirection.",
            "hints": ["Consider read vs write ratio", "How will you generate unique short codes?", "What about analytics?"]
        },
        {
            "question_text": "Design a real-time chat application that supports one-on-one messaging, group chats, and message history. The system should handle millions of concurrent users.",
            "question_code": None,
            "expected_answer": "WebSocket connections for real-time. Message queue for async processing. Database for persistence. Redis for presence/sessions. Horizontal scaling with sticky sessions or connection routing. Message fan-out for groups. Pagination for history.",
            "hints": ["How do you handle users being offline?", "Consider message ordering guarantees", "How do you scale WebSocket connections?"]
        },
        {
            "question_text": "Design a rate limiter that can be used to protect APIs. It should support different rate limits per user/API key and handle distributed systems.",
            "question_code": None,
            "expected_answer": "Algorithms: Token bucket, sliding window, fixed window. Storage: Redis for distributed state. Key design: user_id:endpoint. Handle race conditions with Lua scripts or Redis transactions. Consider grace periods and burst handling.",
            "hints": ["Compare different rate limiting algorithms", "How do you handle distributed systems?", "What happens when limit is exceeded?"]
        }
    ],
    "signal_processing": [
        {
            "question_text": "Explain the Nyquist-Shannon sampling theorem. A signal contains frequencies up to 4 kHz. What is the minimum sampling rate required to avoid aliasing? What happens if you sample at a lower rate?",
            "question_code": None,
            "expected_answer": "Nyquist theorem: sampling rate must be at least 2x the highest frequency. For 4 kHz signal, minimum rate is 8 kHz. Below this, aliasing occurs - high frequencies appear as lower frequencies, causing distortion that cannot be removed.",
            "hints": ["Think about what information is lost when sampling", "Consider what happens to frequencies above Nyquist"]
        },
        {
            "question_text": "Design a simple low-pass FIR filter in Python. Explain your design choices for filter order and cutoff frequency. The filter should pass frequencies below 1000 Hz and attenuate higher frequencies, with a sampling rate of 8000 Hz.",
            "question_code": "import numpy as np\n\ndef design_lowpass_filter(cutoff_hz, sample_rate, num_taps):\n    '''\n    Design a FIR low-pass filter using the window method\n    \n    Args:\n        cutoff_hz: Cutoff frequency in Hz\n        sample_rate: Sampling rate in Hz\n        num_taps: Number of filter coefficients\n    \n    Returns:\n        Filter coefficients (numpy array)\n    '''\n    # Your code here\n    pass",
            "expected_answer": "Normalize cutoff to Nyquist (1000/4000 = 0.25). Use sinc function for ideal lowpass, multiply by window (Hamming, Hann). More taps = sharper transition but more delay. Typical: 51-101 taps for good tradeoff.",
            "hints": ["Research the window method for FIR filter design", "Consider the tradeoff between filter sharpness and computational cost"]
        },
        {
            "question_text": "Explain the difference between DFT and FFT. Given a signal of length N=1024, how many complex multiplications does each require? Why is FFT preferred for real-time applications?",
            "question_code": None,
            "expected_answer": "DFT: O(N²) = ~1 million operations. FFT: O(N log N) = ~10,000 operations. FFT uses divide-and-conquer (Cooley-Tukey). For real-time, FFT enables faster processing, lower latency, and less power consumption.",
            "hints": ["Calculate the actual numbers for N=1024", "Think about practical implications for embedded systems"]
        }
    ]
}


class AIService:
    def __init__(self):
        self.api_url = settings.KIMI_API_URL
        self.client = httpx.AsyncClient(timeout=120.0)
        self.max_retries = 3
        self.retry_delay = 2  # seconds

    async def _call_kimi_with_retry(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
        """Make a call to the Kimi2 LLM API with retry logic."""
        last_error = None

        for attempt in range(self.max_retries):
            try:
                response = await self.client.post(
                    self.api_url,
                    json={
                        "model": "kimi",
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": 4096
                    },
                    timeout=120.0
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.TimeoutException as e:
                last_error = e
                print(f"Kimi API timeout (attempt {attempt + 1}/{self.max_retries}): {e}")
            except httpx.HTTPStatusError as e:
                last_error = e
                print(f"Kimi API HTTP error (attempt {attempt + 1}/{self.max_retries}): {e}")
            except Exception as e:
                last_error = e
                print(f"Kimi API error (attempt {attempt + 1}/{self.max_retries}): {e}")

            if attempt < self.max_retries - 1:
                await asyncio.sleep(self.retry_delay * (attempt + 1))

        print(f"All {self.max_retries} retries failed. Last error: {last_error}")
        return ""

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
            # Return empty list if AI fails
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
        resume_text: Optional[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Generate personalized test questions based on candidate profile."""

        category_prompts = {
            "brain_teaser": "Logic puzzles and problem-solving questions that test analytical thinking",
            "coding": "Programming challenges that require writing code to solve problems",
            "code_review": "Buggy code snippets that need to be identified and fixed",
            "system_design": "Architecture and system design questions",
            "signal_processing": "Digital signal processing questions (filters, FFT, DSP algorithms)"
        }

        difficulty_guidance = {
            "junior": "Entry-level questions suitable for 0-2 years experience. Focus on fundamentals.",
            "mid": "Intermediate questions for 2-5 years experience. Include some complexity.",
            "senior": "Advanced questions for 5+ years experience. Focus on architecture, optimization, and edge cases."
        }

        questions_by_category = {}

        for category in categories:
            if category not in category_prompts:
                continue

            num_questions = 3 if category in ["coding", "system_design"] else 4

            messages = [
                {
                    "role": "system",
                    "content": f"""You are an expert technical interviewer creating assessment questions.

Category: {category_prompts.get(category, category)}
Difficulty: {difficulty_guidance.get(difficulty, difficulty)}
Candidate Skills: {', '.join(skills) if skills else 'General'}

Generate {num_questions} questions for this category. Each question should be relevant to the candidate's skills when possible.

Return a JSON array of question objects with this structure:
{{
  "question_text": "The question prompt",
  "question_code": "Code snippet if applicable (for coding/code_review), null otherwise",
  "expected_answer": "Brief description of expected answer or solution approach",
  "hints": ["Optional hint 1", "Optional hint 2"]
}}

For coding questions, provide a clear problem statement.
For code_review questions, include buggy code that candidates need to fix.
For system_design questions, ask about designing real systems.
For signal_processing questions, include DSP-specific problems.

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
                # Use default questions if AI fails
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
                    # Use defaults if parsing succeeded but result is empty
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

                # Use default questions as fallback
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
        difficulty: str
    ) -> Dict[str, Any]:
        """Evaluate a candidate's answer using AI."""

        messages = [
            {
                "role": "system",
                "content": f"""You are an expert technical interviewer evaluating candidate responses.

Category: {category}
Difficulty Level: {difficulty}

Evaluate the candidate's answer and provide:
1. A score from 0-100
2. Detailed feedback explaining the score
3. What was good about the answer
4. What could be improved

Return a JSON object:
{{
  "score": <number 0-100>,
  "feedback": "Detailed feedback",
  "strengths": ["What was good"],
  "improvements": ["What could be better"]
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

    async def generate_report(
        self,
        candidate_name: str,
        categories: List[str],
        difficulty: str,
        section_scores: Dict[str, float],
        question_details: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate a comprehensive assessment report."""

        messages = [
            {
                "role": "system",
                "content": """You are an expert technical hiring manager creating a comprehensive candidate assessment report.

Based on the candidate's performance, generate a detailed report with:
1. Overall recommendation (strong_hire, hire, maybe, no_hire)
2. Summary of performance
3. Key strengths
4. Areas for improvement
5. Detailed analysis

Return a JSON object:
{
  "recommendation": "strong_hire|hire|maybe|no_hire",
  "summary": "Brief overall summary",
  "strengths": ["Key strength 1", "Key strength 2"],
  "weaknesses": ["Area for improvement 1"],
  "detailed_feedback": "Comprehensive analysis of the candidate's performance"
}

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

        # Calculate fallback recommendation based on average score
        avg_score = sum(section_scores.values()) / len(section_scores) if section_scores else 0
        if avg_score >= 85:
            rec = "strong_hire"
        elif avg_score >= 70:
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
            "detailed_feedback": "Automated report generation. Manual review recommended."
        }

        if not response:
            return fallback_report

        try:
            report = json.loads(response)
            return report
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except:
                    pass
            return fallback_report

    async def close(self):
        await self.client.aclose()


# Singleton instance
ai_service = AIService()
