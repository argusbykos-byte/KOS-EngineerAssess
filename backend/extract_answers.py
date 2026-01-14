#!/usr/bin/env python3
"""Extract all answers to JSON for manual evaluation"""

import sqlite3
import os
import json

DB_PATH = os.path.expanduser("~/Projects/KOS-EngineerAssess/backend/kos_assess.db")
OUTPUT_PATH = os.path.expanduser("~/Projects/KOS-EngineerAssess/backend/answers_for_evaluation.json")

def extract_all_answers():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    query = """
    SELECT
        a.id as answer_id,
        c.id as candidate_id,
        c.name as candidate_name,
        q.category,
        q.question_text,
        q.expected_answer,
        a.candidate_answer,
        a.score as kimi2_score,
        a.feedback as kimi2_feedback
    FROM answers a
    JOIN questions q ON a.question_id = q.id
    JOIN tests t ON q.test_id = t.id
    JOIN candidates c ON t.candidate_id = c.id
    WHERE a.score IS NOT NULL
      AND a.candidate_answer IS NOT NULL
      AND a.candidate_answer != ''
    ORDER BY c.name, q.category, a.id
    """

    cursor.execute(query)
    rows = cursor.fetchall()

    answers = []
    for row in rows:
        answers.append({
            'answer_id': row[0],
            'candidate_id': row[1],
            'candidate_name': row[2],
            'category': row[3],
            'question_text': row[4],
            'expected_answer': row[5] or "",
            'candidate_answer': row[6],
            'kimi2_score': row[7],
            'kimi2_feedback': row[8] or ""
        })

    conn.close()
    return answers

if __name__ == "__main__":
    answers = extract_all_answers()
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(answers, f, indent=2)
    print(f"Extracted {len(answers)} answers to {OUTPUT_PATH}")
