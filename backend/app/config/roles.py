"""
Role-specific question bank configuration for KOS AI Engineering Assessment.

Each role has:
- A list of technical categories/sections to test
- Weighted importance for each category
- Role-specific question focus areas
"""

from typing import Dict, List, Any

# Role definitions with their associated question categories and weights
ENGINEERING_ROLES: Dict[str, Dict[str, Any]] = {
    "ml_engineer": {
        "title": "Machine Learning Engineer",
        "description": "Focus on ML/AI, model training, and deployment",
        "categories": {
            "brain_teaser": {"weight": 0.1, "count": 2},
            "coding": {"weight": 0.3, "count": 3},
            "system_design": {"weight": 0.2, "count": 2},
            "ml_fundamentals": {"weight": 0.25, "count": 3},
            "signal_processing": {"weight": 0.15, "count": 2},
        },
        "focus_areas": [
            "Deep learning architectures (CNN, RNN, Transformers)",
            "Model training and hyperparameter tuning",
            "Feature engineering and data preprocessing",
            "MLOps and model deployment",
            "Edge ML and model optimization",
            "Time-series prediction",
        ],
        "skill_dimensions": [
            "ML Algorithms",
            "Deep Learning",
            "Data Engineering",
            "Model Deployment",
            "Signal Processing",
            "Problem Solving",
        ],
    },
    "firmware_engineer": {
        "title": "Firmware Engineer",
        "description": "Focus on embedded systems, RTOS, and low-level programming",
        "categories": {
            "brain_teaser": {"weight": 0.1, "count": 2},
            "coding": {"weight": 0.35, "count": 4},
            "system_design": {"weight": 0.2, "count": 2},
            "embedded_systems": {"weight": 0.25, "count": 3},
            "signal_processing": {"weight": 0.1, "count": 1},
        },
        "focus_areas": [
            "RTOS concepts (FreeRTOS, Zephyr)",
            "Low-power optimization",
            "Interrupt handling and DMA",
            "Communication protocols (SPI, I2C, UART, BLE)",
            "Memory management in embedded systems",
            "Hardware abstraction layers",
        ],
        "skill_dimensions": [
            "C/C++",
            "RTOS",
            "Communication Protocols",
            "Power Optimization",
            "Hardware Interface",
            "Debugging",
        ],
    },
    "biomedical_engineer": {
        "title": "Biomedical Engineer",
        "description": "Focus on medical devices, biosignal processing, and regulatory",
        "categories": {
            "brain_teaser": {"weight": 0.1, "count": 2},
            "coding": {"weight": 0.2, "count": 2},
            "system_design": {"weight": 0.2, "count": 2},
            "signal_processing": {"weight": 0.3, "count": 4},
            "regulatory_compliance": {"weight": 0.2, "count": 2},
        },
        "focus_areas": [
            "Biosignal processing (PPG, ECG, EEG)",
            "Medical device regulations (FDA, ISO 13485)",
            "Clinical validation and verification",
            "Patient safety and risk management",
            "HIPAA compliance",
            "Biocompatibility considerations",
        ],
        "skill_dimensions": [
            "Signal Processing",
            "Medical Devices",
            "Regulatory Knowledge",
            "Clinical Understanding",
            "Data Analysis",
            "Risk Management",
        ],
    },
    "fullstack_engineer": {
        "title": "Full Stack Engineer",
        "description": "Focus on web development, APIs, and databases",
        "categories": {
            "brain_teaser": {"weight": 0.1, "count": 2},
            "coding": {"weight": 0.35, "count": 4},
            "code_review": {"weight": 0.15, "count": 2},
            "system_design": {"weight": 0.25, "count": 3},
            "general_engineering": {"weight": 0.15, "count": 2},
        },
        "focus_areas": [
            "REST API design and implementation",
            "Frontend frameworks (React, Vue, Next.js)",
            "Database design and optimization",
            "Authentication and authorization",
            "Cloud deployment (AWS, GCP)",
            "Performance optimization",
        ],
        "skill_dimensions": [
            "Frontend",
            "Backend",
            "Database",
            "API Design",
            "DevOps",
            "Security",
        ],
    },
    "backend_engineer": {
        "title": "Backend Engineer",
        "description": "Focus on server-side development, databases, and APIs",
        "categories": {
            "brain_teaser": {"weight": 0.1, "count": 2},
            "coding": {"weight": 0.35, "count": 4},
            "code_review": {"weight": 0.15, "count": 2},
            "system_design": {"weight": 0.3, "count": 3},
            "general_engineering": {"weight": 0.1, "count": 1},
        },
        "focus_areas": [
            "API design (REST, GraphQL)",
            "Database optimization and scaling",
            "Caching strategies",
            "Message queues and async processing",
            "Microservices architecture",
            "Security best practices",
        ],
        "skill_dimensions": [
            "API Design",
            "Database",
            "Scalability",
            "Security",
            "Architecture",
            "Performance",
        ],
    },
    "data_engineer": {
        "title": "Data Engineer",
        "description": "Focus on data pipelines, ETL, and data infrastructure",
        "categories": {
            "brain_teaser": {"weight": 0.1, "count": 2},
            "coding": {"weight": 0.3, "count": 3},
            "system_design": {"weight": 0.3, "count": 3},
            "data_engineering": {"weight": 0.2, "count": 2},
            "general_engineering": {"weight": 0.1, "count": 1},
        },
        "focus_areas": [
            "ETL/ELT pipelines",
            "Data warehousing",
            "Stream processing (Kafka, Spark)",
            "Data quality and governance",
            "SQL optimization",
            "Cloud data platforms",
        ],
        "skill_dimensions": [
            "ETL/ELT",
            "SQL",
            "Data Modeling",
            "Stream Processing",
            "Cloud Platforms",
            "Data Quality",
        ],
    },
    "devops_engineer": {
        "title": "DevOps Engineer",
        "description": "Focus on CI/CD, infrastructure, and automation",
        "categories": {
            "brain_teaser": {"weight": 0.1, "count": 2},
            "coding": {"weight": 0.25, "count": 3},
            "system_design": {"weight": 0.35, "count": 4},
            "devops": {"weight": 0.2, "count": 2},
            "general_engineering": {"weight": 0.1, "count": 1},
        },
        "focus_areas": [
            "CI/CD pipeline design",
            "Container orchestration (Kubernetes, Docker)",
            "Infrastructure as Code (Terraform, CloudFormation)",
            "Monitoring and observability",
            "Security automation",
            "Cloud architecture",
        ],
        "skill_dimensions": [
            "CI/CD",
            "Containers",
            "Infrastructure",
            "Monitoring",
            "Security",
            "Automation",
        ],
    },
    "qa_engineer": {
        "title": "QA Engineer",
        "description": "Focus on testing, quality assurance, and automation",
        "categories": {
            "brain_teaser": {"weight": 0.1, "count": 2},
            "coding": {"weight": 0.25, "count": 3},
            "code_review": {"weight": 0.25, "count": 3},
            "testing": {"weight": 0.3, "count": 3},
            "general_engineering": {"weight": 0.1, "count": 1},
        },
        "focus_areas": [
            "Test automation frameworks",
            "API testing",
            "Performance testing",
            "Security testing",
            "Test strategy and planning",
            "Bug tracking and management",
        ],
        "skill_dimensions": [
            "Test Automation",
            "API Testing",
            "Performance Testing",
            "Security Testing",
            "Test Strategy",
            "Bug Analysis",
        ],
    },
}

# Category prompts for AI question generation
CATEGORY_PROMPTS: Dict[str, str] = {
    "brain_teaser": "Logic puzzles and problem-solving questions that test analytical thinking",
    "coding": "Programming challenges that require writing code to solve problems",
    "code_review": "Buggy code snippets that need to be identified and fixed",
    "system_design": "Architecture and system design questions",
    "signal_processing": "Digital signal processing questions (filters, FFT, DSP algorithms)",
    "general_engineering": "General software engineering concepts: algorithms, data structures, design patterns",
    "ml_fundamentals": "Machine learning concepts: algorithms, model evaluation, feature engineering, deployment",
    "embedded_systems": "Embedded systems: RTOS, memory management, peripherals, low-power design",
    "regulatory_compliance": "Medical device regulations, FDA, ISO standards, HIPAA, risk management",
    "data_engineering": "Data pipelines, ETL/ELT, data warehousing, stream processing",
    "devops": "CI/CD, containers, infrastructure as code, monitoring, cloud architecture",
    "testing": "Testing strategies, automation frameworks, performance testing, security testing",
}


def get_role_config(role_id: str) -> Dict[str, Any]:
    """Get configuration for a specific role."""
    return ENGINEERING_ROLES.get(role_id, ENGINEERING_ROLES["fullstack_engineer"])


def get_all_roles() -> Dict[str, Dict[str, Any]]:
    """Get all available roles."""
    return ENGINEERING_ROLES


def get_role_categories(role_id: str) -> List[str]:
    """Get the list of categories for a role."""
    role = get_role_config(role_id)
    return list(role.get("categories", {}).keys())


def get_role_skill_dimensions(role_id: str) -> List[str]:
    """Get the skill dimensions for radar chart for a role."""
    role = get_role_config(role_id)
    return role.get("skill_dimensions", [])


def get_category_prompt(category: str) -> str:
    """Get the prompt description for a category."""
    return CATEGORY_PROMPTS.get(category, category)
