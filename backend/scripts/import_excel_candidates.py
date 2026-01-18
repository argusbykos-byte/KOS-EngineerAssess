#!/usr/bin/env python3
"""
Import candidates from KOS Engineering Trial Day Application Form Excel file.
"""
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

import pandas as pd
import sqlite3
from datetime import datetime
import re
import pdfplumber

# Paths
EXCEL_PATH = Path.home() / "Downloads" / "Kos Engineering Trial Day Application Form (Responses).xlsx"
RESUME_FOLDER = Path.home() / "Downloads" / "Resume Trail Stanfor Engineers"
DB_PATH = backend_path / "kos_assess.db"

# Column mappings (index -> field name)
COLUMN_MAP = {
    1: "full_name",
    2: "email",
    3: "location",
    4: "graduation_date",
    5: "preferred_start_date",
    6: "self_description",
    7: "motivation",
    8: "admired_engineers",
    80: "overall_self_rating",
    81: "unique_trait",
    82: "resume_url",
    83: "availability",
    84: "preferred_trial_date",
}

# Skill mappings (column index -> (category, skill_name))
SKILL_COLUMNS = {
    # Technical Skills (column 9-26)
    9: ("Technical Skills", "Self-Improving AI Agents"),
    10: ("Technical Skills", "Deep Reinforcement Learning"),
    11: ("Technical Skills", "Machine Learning"),
    12: ("Technical Skills", "Computer Vision"),
    13: ("Technical Skills", "Natural Language Processing (NLP)"),
    14: ("Technical Skills", "Data Mining and Analysis"),
    15: ("Technical Skills", "Algorithm Design and Optimization"),
    16: ("Technical Skills", "Parallel and Distributed Computing"),
    17: ("Technical Skills", "Operating Systems"),
    18: ("Technical Skills", "Probability Theory"),
    19: ("Technical Skills", "Linear Algebra"),
    20: ("Technical Skills", "Time Series Analysis"),
    21: ("Technical Skills", "Statistical Inference"),
    22: ("Technical Skills", "Statistical Learning"),
    23: ("Technical Skills", "Linear Models"),
    24: ("Technical Skills", "Stochastic Processes"),
    25: ("Technical Skills", "Signal Processing"),
    26: ("Technical Skills", "Embedded Systems"),
    # Programming Languages (column 27-40)
    27: ("Programming Languages", "Python"),
    28: ("Programming Languages", "C"),
    29: ("Programming Languages", "C++"),
    30: ("Programming Languages", "C#"),
    31: ("Programming Languages", "Java"),
    32: ("Programming Languages", "Swift"),
    33: ("Programming Languages", "JavaScript"),
    34: ("Programming Languages", "TypeScript"),
    35: ("Programming Languages", "HTML"),
    36: ("Programming Languages", "CSS"),
    37: ("Programming Languages", "PHP"),
    38: ("Programming Languages", "SQL"),
    39: ("Programming Languages", "MATLAB"),
    40: ("Programming Languages", "R"),
    # Frameworks & Libraries (column 41-55)
    41: ("Frameworks & Libraries", "PyTorch"),
    42: ("Frameworks & Libraries", "TensorFlow"),
    43: ("Frameworks & Libraries", "Scikit-learn"),
    44: ("Frameworks & Libraries", "PyG (PyTorch Geometric)"),
    45: ("Frameworks & Libraries", "Hugging Face"),
    46: ("Frameworks & Libraries", "LangChain"),
    47: ("Frameworks & Libraries", "OpenCV"),
    48: ("Frameworks & Libraries", "FastAPI"),
    49: ("Frameworks & Libraries", "Flask"),
    50: ("Frameworks & Libraries", "Django"),
    51: ("Frameworks & Libraries", "CNNs"),
    52: ("Frameworks & Libraries", "RNNs"),
    53: ("Frameworks & Libraries", "GANs"),
    54: ("Frameworks & Libraries", "Transformers"),
    55: ("Frameworks & Libraries", "XGBoost / LightGBM"),
    # Tools & Platforms (column 56-68)
    56: ("Tools & Platforms", "Linux"),
    57: ("Tools & Platforms", "Docker"),
    58: ("Tools & Platforms", "Git"),
    59: ("Tools & Platforms", "Jenkins"),
    60: ("Tools & Platforms", "Jupyter Notebook"),
    61: ("Tools & Platforms", "VS Code"),
    62: ("Tools & Platforms", "Unity"),
    63: ("Tools & Platforms", "Blender"),
    64: ("Tools & Platforms", "IsaacGym"),
    65: ("Tools & Platforms", "AWS"),
    66: ("Tools & Platforms", "Google Cloud Platform (GCP)"),
    67: ("Tools & Platforms", "Azure"),
    68: ("Tools & Platforms", "Kubernetes"),
    # Core Competencies (column 69-79)
    69: ("Core Competencies", "Machine Learning"),
    70: ("Core Competencies", "Deep Learning"),
    71: ("Core Competencies", "Reinforcement Learning"),
    72: ("Core Competencies", "Efficient / Green Machine Learning"),
    73: ("Core Competencies", "Cloud Infrastructure"),
    74: ("Core Competencies", "Computer Systems"),
    75: ("Core Competencies", "Full-Stack Development"),
    76: ("Core Competencies", "Signal & Sensor Data Processing"),
    77: ("Core Competencies", "Embedded Hardware Integration"),
    78: ("Core Competencies", "Model Optimization & Deployment"),
    79: ("Core Competencies", "MLOps"),
}

def normalize_name(name):
    """Normalize name for matching."""
    if not name:
        return ""
    # Remove extra spaces, lowercase
    name = re.sub(r'\s+', ' ', str(name).strip().lower())
    return name

def find_resume(full_name, resume_folder):
    """Find resume PDF matching candidate name."""
    if not resume_folder.exists():
        return None, None
    
    name_lower = normalize_name(full_name)
    name_parts = name_lower.split()
    
    for pdf_file in resume_folder.glob("*.pdf"):
        pdf_name_lower = pdf_file.stem.lower()
        
        # Check if all name parts appear in filename
        if all(part in pdf_name_lower for part in name_parts):
            return pdf_file, extract_pdf_text(pdf_file)
        
        # Check first and last name
        if len(name_parts) >= 2:
            if name_parts[0] in pdf_name_lower and name_parts[-1] in pdf_name_lower:
                return pdf_file, extract_pdf_text(pdf_file)
    
    return None, None

def extract_pdf_text(pdf_path):
    """Extract text from PDF."""
    try:
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()
    except Exception as e:
        print(f"  Warning: Could not extract text from {pdf_path}: {e}")
        return ""

def main():
    print("=" * 60)
    print("KOS Engineering Trial Day - Excel Import")
    print("=" * 60)
    
    # Stats
    new_candidates = 0
    updated_candidates = 0
    resumes_matched = 0
    resumes_missing = 0
    skills_imported = 0
    errors = 0
    
    # Check files exist
    if not EXCEL_PATH.exists():
        print(f"ERROR: Excel file not found: {EXCEL_PATH}")
        sys.exit(1)
    
    print(f"Excel file: {EXCEL_PATH}")
    print(f"Resume folder: {RESUME_FOLDER}")
    print(f"Database: {DB_PATH}")
    print()
    
    # Read Excel
    df = pd.read_excel(EXCEL_PATH)
    print(f"Found {len(df)} rows in Excel")
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Process each row
    for idx, row in df.iterrows():
        full_name = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
        email = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ""
        
        if not full_name or not email or full_name == "nan":
            print(f"Row {idx + 1}: Skipping - missing name or email")
            continue
        
        # Skip test entries
        if "shaboshabo" in full_name.lower() or "madolmadol" in email.lower():
            print(f"Row {idx + 1}: Skipping test entry - {full_name}")
            continue
            
        print(f"\nRow {idx + 1}: Processing {full_name} ({email})")
        
        try:
            # Check if application exists
            cursor.execute("SELECT id FROM applications WHERE email = ?", (email,))
            existing = cursor.fetchone()
            
            # Find resume
            resume_path, resume_text = find_resume(full_name, RESUME_FOLDER)
            if resume_path:
                print(f"  Resume matched: {resume_path.name}")
                resumes_matched += 1
            else:
                print(f"  Resume NOT found")
                resumes_missing += 1
            
            # Prepare application data
            location = str(row.iloc[3]) if pd.notna(row.iloc[3]) else ""
            graduation_date = str(row.iloc[4]) if pd.notna(row.iloc[4]) else ""
            preferred_start_date = str(row.iloc[5]) if pd.notna(row.iloc[5]) else ""
            self_description = str(row.iloc[6]) if pd.notna(row.iloc[6]) else ""
            motivation = str(row.iloc[7]) if pd.notna(row.iloc[7]) else ""
            admired_engineers = str(row.iloc[8]) if pd.notna(row.iloc[8]) else ""
            overall_rating = int(row.iloc[80]) if pd.notna(row.iloc[80]) and str(row.iloc[80]).isdigit() else None
            unique_trait = str(row.iloc[81]) if pd.notna(row.iloc[81]) else ""
            availability = str(row.iloc[83]).lower().replace('need to discuss availability', 'need_to_discuss') if pd.notna(row.iloc[83]) else 'yes'
            preferred_trial_date = str(row.iloc[84]) if pd.notna(row.iloc[84]) else ""
            
            now = datetime.now().isoformat()
            token = f"import_{idx}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            if existing:
                app_id = existing[0]
                print(f"  Updating existing application ID {app_id}")
                cursor.execute("""
                    UPDATE applications SET
                        full_name = ?,
                        location = ?,
                        graduation_date = ?,
                        preferred_start_date = ?,
                        self_description = ?,
                        motivation = ?,
                        admired_engineers = ?,
                        overall_self_rating = ?,
                        unique_trait = ?,
                        availability = ?,
                        preferred_trial_date = ?,
                        resume_path = COALESCE(?, resume_path),
                        resume_text = COALESCE(?, resume_text),
                        resume_filename = COALESCE(?, resume_filename),
                        updated_at = ?,
                        skills_submitted_at = ?
                    WHERE id = ?
                """, (
                    full_name, location, graduation_date, preferred_start_date,
                    self_description, motivation, admired_engineers, overall_rating,
                    unique_trait, availability, preferred_trial_date,
                    str(resume_path) if resume_path else None,
                    resume_text if resume_text else None,
                    resume_path.name if resume_path else None,
                    now, now, app_id
                ))
                updated_candidates += 1
            else:
                print(f"  Creating new application")
                cursor.execute("""
                    INSERT INTO applications (
                        full_name, email, location, graduation_date, preferred_start_date,
                        self_description, motivation, admired_engineers, overall_self_rating,
                        unique_trait, availability, preferred_trial_date,
                        resume_path, resume_text, resume_filename,
                        application_token, status, created_at, updated_at, skills_submitted_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    full_name, email, location, graduation_date, preferred_start_date,
                    self_description, motivation, admired_engineers, overall_rating,
                    unique_trait, availability, preferred_trial_date,
                    str(resume_path) if resume_path else None,
                    resume_text if resume_text else None,
                    resume_path.name if resume_path else None,
                    token, "pending", now, now, now
                ))
                app_id = cursor.lastrowid
                new_candidates += 1
            
            # Delete existing skills for this application
            cursor.execute("DELETE FROM skill_assessments WHERE application_id = ?", (app_id,))
            
            # Import skills
            for col_idx, (category, skill_name) in SKILL_COLUMNS.items():
                try:
                    value = row.iloc[col_idx]
                    if pd.notna(value):
                        rating = int(float(value))
                        if 1 <= rating <= 10:
                            cursor.execute("""
                                INSERT INTO skill_assessments (
                                    application_id, category, skill_name, self_rating, created_at, updated_at
                                ) VALUES (?, ?, ?, ?, ?, ?)
                            """, (app_id, category, skill_name, rating, now, now))
                            skills_imported += 1
                except (ValueError, TypeError):
                    pass
            
            conn.commit()
            print(f"  Saved successfully")
            
        except Exception as e:
            print(f"  ERROR: {e}")
            errors += 1
            conn.rollback()
    
    conn.close()
    
    # Print summary
    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"New candidates created: {new_candidates}")
    print(f"Existing candidates updated: {updated_candidates}")
    print(f"Resumes matched: {resumes_matched}")
    print(f"Resumes missing: {resumes_missing}")
    print(f"Skills imported: {skills_imported}")
    print(f"Errors: {errors}")

if __name__ == "__main__":
    main()
