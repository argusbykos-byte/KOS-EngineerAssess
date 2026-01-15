"""
Skill Categories for Application Portal

All skills from the KOS Engineering Assessment application form.
Candidates rate themselves 1-10 on each skill.
"""

from typing import Dict, List, Tuple


SKILL_CATEGORIES: Dict[str, List[str]] = {
    "technical": [
        "Self-Improving AI Agents",
        "Deep Reinforcement Learning",
        "Machine Learning",
        "Computer Vision",
        "Natural Language Processing (NLP)",
        "Data Mining and Analysis",
        "Algorithm Design and Optimization",
        "Parallel and Distributed Computing",
        "Operating Systems",
        "Probability Theory",
        "Linear Algebra",
        "Time Series Analysis",
        "Statistical Inference",
        "Statistical Learning",
        "Linear Models",
        "Stochastic Processes",
        "Signal Processing",
        "Embedded Systems",
    ],
    "languages": [
        "Python",
        "C",
        "C++",
        "C#",
        "Java",
        "Swift",
        "JavaScript",
        "TypeScript",
        "HTML",
        "CSS",
        "PHP",
        "SQL",
        "MATLAB",
        "R",
    ],
    "frameworks": [
        "PyTorch",
        "TensorFlow",
        "Scikit-learn",
        "PyG (PyTorch Geometric)",
        "Hugging Face",
        "LangChain",
        "OpenCV",
        "FastAPI",
        "Flask",
        "Django",
        "CNNs",
        "RNNs",
        "GANs",
        "Transformers",
        "XGBoost / LightGBM",
    ],
    "tools": [
        "Linux",
        "Docker",
        "Git",
        "Jenkins",
        "Jupyter Notebook",
        "VS Code",
        "Unity",
        "Blender",
        "IsaacGym",
        "AWS",
        "Google Cloud Platform (GCP)",
        "Azure",
        "Kubernetes",
    ],
    "competencies": [
        "Machine Learning",
        "Deep Learning",
        "Reinforcement Learning",
        "Efficient / Green Machine Learning",
        "Cloud Infrastructure",
        "Computer Systems",
        "Full-Stack Development",
        "Signal & Sensor Data Processing",
        "Embedded Hardware Integration",
        "Model Optimization & Deployment",
        "MLOps",
    ],
}


SELF_DESCRIPTIONS: List[str] = [
    "AI Researcher",
    "Machine Learning Researcher",
    "Machine Learning Engineer",
    "Software Engineer",
    "Biomedical / Biomechanical Engineer",
    "Embedded Systems Engineer",
    "Algorithm Design Engineer",
    "Mathematical Engineer",
    "Full-Stack Developer",
    "Data Scientist",
]


def get_all_skills() -> List[Tuple[str, str]]:
    """
    Get all skills as a flat list of (category, skill_name) tuples.

    Returns:
        List of tuples containing (category, skill_name)
    """
    skills = []
    for category, skill_list in SKILL_CATEGORIES.items():
        for skill in skill_list:
            skills.append((category, skill))
    return skills


def get_skills_by_category(category: str) -> List[str]:
    """
    Get all skills for a specific category.

    Args:
        category: One of 'technical', 'languages', 'frameworks', 'tools', 'competencies'

    Returns:
        List of skill names in that category
    """
    return SKILL_CATEGORIES.get(category, [])


def get_category_count() -> Dict[str, int]:
    """
    Get the count of skills in each category.

    Returns:
        Dictionary mapping category to skill count
    """
    return {category: len(skills) for category, skills in SKILL_CATEGORIES.items()}


def get_total_skill_count() -> int:
    """
    Get the total number of skills across all categories.

    Returns:
        Total skill count
    """
    return sum(len(skills) for skills in SKILL_CATEGORIES.values())
