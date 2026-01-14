#!/usr/bin/env python3
"""
Score Comparison Tool: Compares Kimi2 AI ratings with Claude AI ratings
Reads from SQLite database and generates a comparison report
"""

import sqlite3
import os
import json
import anthropic
from dataclasses import dataclass
from typing import Optional
import statistics

# Database path
DB_PATH = os.path.expanduser("~/Projects/KOS-EngineerAssess/backend/kos_assess.db")
REPORT_PATH = os.path.expanduser("~/Projects/KOS-EngineerAssess/backend/score_comparison_report.md")

@dataclass
class AnswerData:
    answer_id: int
    candidate_id: int
    candidate_name: str
    category: str
    question_text: str
    expected_answer: str
    candidate_answer: str
    kimi2_score: float
    kimi2_feedback: str


def connect_db():
    """Connect to SQLite database"""
    return sqlite3.connect(DB_PATH)


def extract_all_answers(conn) -> list[AnswerData]:
    """Extract all answered questions with scores from database"""
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
        answers.append(AnswerData(
            answer_id=row[0],
            candidate_id=row[1],
            candidate_name=row[2],
            category=row[3],
            question_text=row[4],
            expected_answer=row[5] or "",
            candidate_answer=row[6],
            kimi2_score=row[7],
            kimi2_feedback=row[8] or ""
        ))

    return answers


def get_claude_evaluation(client: anthropic.Anthropic, answer: AnswerData) -> tuple[float, str]:
    """Use Claude to evaluate the answer and provide score + feedback"""

    prompt = f"""You are an expert technical interviewer evaluating a candidate's answer.

QUESTION ({answer.category}):
{answer.question_text}

EXPECTED/IDEAL ANSWER:
{answer.expected_answer}

CANDIDATE'S ANSWER:
{answer.candidate_answer}

Evaluate the candidate's answer against the expected answer. Consider:
1. Correctness and accuracy of the response
2. Completeness - did they address all aspects?
3. Understanding demonstrated
4. Quality of explanation

Provide your evaluation in this exact format:
SCORE: [0-100]
FEEDBACK: [Your detailed feedback explaining the score]

Be fair but rigorous. A perfect answer matching or exceeding expectations should get 90-100.
A good answer with minor issues should get 70-89.
A partial answer with significant gaps should get 50-69.
An incorrect or very incomplete answer should get below 50."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text

        # Parse score and feedback
        lines = response_text.strip().split('\n')
        score = 50.0  # default
        feedback = ""

        for i, line in enumerate(lines):
            if line.startswith("SCORE:"):
                try:
                    score_str = line.replace("SCORE:", "").strip()
                    # Handle formats like "85" or "85/100" or "85%"
                    score_str = score_str.replace("/100", "").replace("%", "").strip()
                    score = float(score_str)
                    score = max(0, min(100, score))  # Clamp to 0-100
                except:
                    pass
            elif line.startswith("FEEDBACK:"):
                feedback = line.replace("FEEDBACK:", "").strip()
                # Get rest of lines as feedback
                feedback += " " + " ".join(lines[i+1:])
                break

        return score, feedback.strip()

    except Exception as e:
        print(f"Error evaluating answer {answer.answer_id}: {e}")
        return answer.kimi2_score, f"[Error: Could not evaluate - {str(e)}]"


def truncate_text(text: str, max_len: int = 60) -> str:
    """Truncate text for display"""
    if not text:
        return ""
    text = text.replace('\n', ' ').strip()
    if len(text) <= max_len:
        return text
    return text[:max_len-3] + "..."


def generate_report(answers: list[AnswerData], claude_scores: dict[int, tuple[float, str]]) -> str:
    """Generate markdown comparison report"""

    report = []
    report.append("# AI Score Comparison Report: Kimi2 vs Claude")
    report.append("")
    report.append(f"**Total Answers Evaluated:** {len(answers)}")
    report.append(f"**Generated:** {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("")

    # Detailed comparison table
    report.append("## Detailed Score Comparison")
    report.append("")
    report.append("| Candidate | Category | Question (truncated) | Kimi2 | Claude | Diff | Flag |")
    report.append("|-----------|----------|---------------------|-------|--------|------|------|")

    flagged_answers = []

    for answer in answers:
        claude_score, claude_feedback = claude_scores.get(answer.answer_id, (answer.kimi2_score, ""))
        diff = claude_score - answer.kimi2_score
        flag = "⚠️" if abs(diff) > 20 else ""

        if abs(diff) > 20:
            flagged_answers.append({
                'candidate': answer.candidate_name,
                'question': answer.question_text[:100],
                'expected': answer.expected_answer[:200] if answer.expected_answer else "",
                'answer': answer.candidate_answer[:200] if answer.candidate_answer else "",
                'kimi2_score': answer.kimi2_score,
                'kimi2_feedback': answer.kimi2_feedback,
                'claude_score': claude_score,
                'claude_feedback': claude_feedback,
                'diff': diff
            })

        report.append(
            f"| {answer.candidate_name[:15]} | {answer.category[:12]} | "
            f"{truncate_text(answer.question_text, 40)} | "
            f"{answer.kimi2_score:.0f} | {claude_score:.0f} | {diff:+.0f} | {flag} |"
        )

    # Flagged answers section
    report.append("")
    report.append("## Flagged Answers (>20 point difference)")
    report.append("")

    if flagged_answers:
        for i, fa in enumerate(flagged_answers, 1):
            report.append(f"### {i}. {fa['candidate']} - Diff: {fa['diff']:+.0f}")
            report.append("")
            report.append(f"**Question:** {fa['question']}")
            report.append("")
            report.append(f"**Expected Answer:** {fa['expected']}")
            report.append("")
            report.append(f"**Candidate Answer:** {fa['answer']}")
            report.append("")
            report.append(f"**Kimi2 Score:** {fa['kimi2_score']:.0f}")
            report.append(f"**Kimi2 Feedback:** {fa['kimi2_feedback'][:300]}...")
            report.append("")
            report.append(f"**Claude Score:** {fa['claude_score']:.0f}")
            report.append(f"**Claude Feedback:** {fa['claude_feedback'][:300]}...")
            report.append("")
            report.append("---")
            report.append("")
    else:
        report.append("No answers flagged with >20 point difference.")

    # Per-candidate summary
    report.append("")
    report.append("## Per-Candidate Summary")
    report.append("")
    report.append("| Candidate | # Answers | Avg Kimi2 | Avg Claude | Avg Diff |")
    report.append("|-----------|-----------|-----------|------------|----------|")

    candidates = {}
    for answer in answers:
        if answer.candidate_name not in candidates:
            candidates[answer.candidate_name] = {'kimi2': [], 'claude': []}

        claude_score, _ = claude_scores.get(answer.answer_id, (answer.kimi2_score, ""))
        candidates[answer.candidate_name]['kimi2'].append(answer.kimi2_score)
        candidates[answer.candidate_name]['claude'].append(claude_score)

    candidate_stats = []
    for name, scores in sorted(candidates.items()):
        avg_kimi2 = statistics.mean(scores['kimi2'])
        avg_claude = statistics.mean(scores['claude'])
        avg_diff = avg_claude - avg_kimi2
        candidate_stats.append((name, len(scores['kimi2']), avg_kimi2, avg_claude, avg_diff))
        report.append(f"| {name[:20]} | {len(scores['kimi2'])} | {avg_kimi2:.1f} | {avg_claude:.1f} | {avg_diff:+.1f} |")

    # Overall statistics
    report.append("")
    report.append("## Overall Statistics")
    report.append("")

    all_kimi2 = [a.kimi2_score for a in answers]
    all_claude = [claude_scores.get(a.answer_id, (a.kimi2_score, ""))[0] for a in answers]
    all_diffs = [c - k for k, c in zip(all_kimi2, all_claude)]

    report.append(f"- **Total Answers:** {len(answers)}")
    report.append(f"- **Overall Kimi2 Average:** {statistics.mean(all_kimi2):.1f}")
    report.append(f"- **Overall Claude Average:** {statistics.mean(all_claude):.1f}")
    report.append(f"- **Average Score Difference:** {statistics.mean(all_diffs):+.1f}")
    report.append(f"- **Std Dev of Differences:** {statistics.stdev(all_diffs):.1f}")
    report.append(f"- **Max Difference:** {max(all_diffs):+.1f}")
    report.append(f"- **Min Difference:** {min(all_diffs):+.1f}")

    # Calculate correlation
    if len(all_kimi2) > 1:
        mean_k = statistics.mean(all_kimi2)
        mean_c = statistics.mean(all_claude)

        numerator = sum((k - mean_k) * (c - mean_c) for k, c in zip(all_kimi2, all_claude))
        denom_k = sum((k - mean_k) ** 2 for k in all_kimi2) ** 0.5
        denom_c = sum((c - mean_c) ** 2 for c in all_claude) ** 0.5

        if denom_k > 0 and denom_c > 0:
            correlation = numerator / (denom_k * denom_c)
            report.append(f"- **Pearson Correlation:** {correlation:.3f}")

    # Bias analysis
    report.append("")
    report.append("## Bias Analysis")
    report.append("")

    avg_diff = statistics.mean(all_diffs)
    if avg_diff > 5:
        report.append(f"**Claude appears MORE LENIENT** than Kimi2 (avg +{avg_diff:.1f} points)")
    elif avg_diff < -5:
        report.append(f"**Claude appears STRICTER** than Kimi2 (avg {avg_diff:.1f} points)")
    else:
        report.append(f"**Scores are generally aligned** (avg diff: {avg_diff:+.1f} points)")

    # Category analysis
    report.append("")
    report.append("### By Category")
    report.append("")

    categories = {}
    for answer in answers:
        if answer.category not in categories:
            categories[answer.category] = {'kimi2': [], 'claude': []}

        claude_score, _ = claude_scores.get(answer.answer_id, (answer.kimi2_score, ""))
        categories[answer.category]['kimi2'].append(answer.kimi2_score)
        categories[answer.category]['claude'].append(claude_score)

    report.append("| Category | Avg Kimi2 | Avg Claude | Bias |")
    report.append("|----------|-----------|------------|------|")

    for cat, scores in sorted(categories.items()):
        avg_k = statistics.mean(scores['kimi2'])
        avg_c = statistics.mean(scores['claude'])
        bias = avg_c - avg_k
        bias_str = f"+{bias:.1f}" if bias > 0 else f"{bias:.1f}"
        report.append(f"| {cat} | {avg_k:.1f} | {avg_c:.1f} | {bias_str} |")

    report.append("")
    report.append("---")
    report.append("*Report generated by Claude Code score comparison tool*")

    return "\n".join(report)


def main():
    print("=" * 60)
    print("AI Score Comparison: Kimi2 vs Claude")
    print("=" * 60)

    # Initialize Anthropic client
    client = anthropic.Anthropic()

    # Connect to database
    print("\n[1/4] Connecting to database...")
    conn = connect_db()

    # Extract answers
    print("[2/4] Extracting answers from database...")
    answers = extract_all_answers(conn)
    print(f"      Found {len(answers)} scored answers")

    # Get unique candidates
    candidates = set(a.candidate_name for a in answers)
    print(f"      From {len(candidates)} candidates")

    # Evaluate with Claude
    print("[3/4] Evaluating answers with Claude...")
    claude_scores = {}

    for i, answer in enumerate(answers, 1):
        print(f"      Evaluating {i}/{len(answers)}: {answer.candidate_name[:15]} - {answer.category}...", end=" ", flush=True)
        score, feedback = get_claude_evaluation(client, answer)
        claude_scores[answer.answer_id] = (score, feedback)
        diff = score - answer.kimi2_score
        print(f"Kimi2={answer.kimi2_score:.0f}, Claude={score:.0f}, Diff={diff:+.0f}")

    # Generate report
    print("[4/4] Generating comparison report...")
    report = generate_report(answers, claude_scores)

    # Save report
    with open(REPORT_PATH, 'w') as f:
        f.write(report)

    print(f"\n{'=' * 60}")
    print(f"Report saved to: {REPORT_PATH}")
    print("=" * 60)

    # Quick summary
    all_kimi2 = [a.kimi2_score for a in answers]
    all_claude = [claude_scores[a.answer_id][0] for a in answers]

    print(f"\nQuick Summary:")
    print(f"  - Kimi2 Average: {statistics.mean(all_kimi2):.1f}")
    print(f"  - Claude Average: {statistics.mean(all_claude):.1f}")
    print(f"  - Average Difference: {statistics.mean([c-k for k,c in zip(all_kimi2, all_claude)]):+.1f}")

    flagged = sum(1 for a in answers if abs(claude_scores[a.answer_id][0] - a.kimi2_score) > 20)
    print(f"  - Flagged (>20 diff): {flagged} answers")

    conn.close()


if __name__ == "__main__":
    main()
