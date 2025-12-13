from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import Report, Test, Question, Answer, Candidate
from app.models.test import TestStatus
from app.schemas.report import ReportResponse, ReportWithCandidate, BreakHistoryEntry
from app.services.ai_service import ai_service

router = APIRouter()


@router.get("/", response_model=List[ReportWithCandidate])
async def list_reports(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List all reports."""
    query = (
        select(Report)
        .options(selectinload(Report.test).selectinload(Test.candidate))
        .offset(skip)
        .limit(limit)
        .order_by(Report.generated_at.desc())
    )
    result = await db.execute(query)
    reports = result.scalars().all()

    response = []
    for report in reports:
        # Build break history entries
        break_history = []
        for entry in (report.test.break_history or []):
            break_history.append(BreakHistoryEntry(
                start=entry.get("start", ""),
                end=entry.get("end"),
                duration_seconds=entry.get("duration_seconds", 0)
            ))

        response.append(ReportWithCandidate(
            id=report.id,
            test_id=report.test_id,
            overall_score=report.overall_score,
            recommendation=report.recommendation,
            brain_teaser_score=report.brain_teaser_score,
            coding_score=report.coding_score,
            code_review_score=report.code_review_score,
            system_design_score=report.system_design_score,
            signal_processing_score=report.signal_processing_score,
            strengths=report.strengths,
            weaknesses=report.weaknesses,
            detailed_feedback=report.detailed_feedback,
            ai_summary=report.ai_summary,
            generated_at=report.generated_at,
            candidate_name=report.test.candidate.name,
            candidate_email=report.test.candidate.email,
            test_duration_hours=report.test.candidate.test_duration_hours,
            categories=report.test.candidate.categories or [],
            difficulty=report.test.candidate.difficulty,
            tab_switch_count=report.test.tab_switch_count,
            tab_switch_timestamps=report.test.tab_switch_timestamps,
            paste_attempt_count=report.test.paste_attempt_count,
            total_break_time_seconds=report.test.total_break_time_seconds,
            used_break_time_seconds=report.test.used_break_time_seconds,
            break_count=report.test.break_count,
            break_history=break_history
        ))

    return response


@router.post("/generate/{test_id}", response_model=ReportResponse)
async def generate_report(test_id: int, db: AsyncSession = Depends(get_db)):
    """Generate assessment report for a completed test."""
    # Get test with all related data
    query = (
        select(Test)
        .options(
            selectinload(Test.candidate),
            selectinload(Test.questions).selectinload(Question.answer),
            selectinload(Test.report)
        )
        .where(Test.id == test_id)
    )
    result = await db.execute(query)
    test = result.scalars().first()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status not in [TestStatus.COMPLETED.value, TestStatus.EXPIRED.value]:
        raise HTTPException(status_code=400, detail="Test not completed yet")

    # Check if report already exists
    if test.report:
        return test.report

    # Calculate section scores
    section_scores = {}
    section_questions = {}

    for question in test.questions:
        category = question.category
        if category not in section_questions:
            section_questions[category] = []
            section_scores[category] = []

        if question.answer and question.answer.score is not None:
            section_scores[category].append(question.answer.score)

        section_questions[category].append({
            "question": question.question_text,
            "answer": question.answer.candidate_answer if question.answer else None,
            "score": question.answer.score if question.answer else None,
            "feedback": question.answer.feedback if question.answer else None
        })

    # Calculate average scores per section
    avg_section_scores = {}
    for category, scores in section_scores.items():
        if scores:
            avg_section_scores[category] = sum(scores) / len(scores)
        else:
            avg_section_scores[category] = 0

    # Calculate overall score
    if avg_section_scores:
        overall_score = sum(avg_section_scores.values()) / len(avg_section_scores)
    else:
        overall_score = 0

    # Generate AI report
    ai_report = await ai_service.generate_report(
        candidate_name=test.candidate.name,
        categories=test.candidate.categories or [],
        difficulty=test.candidate.difficulty,
        section_scores=avg_section_scores,
        question_details=[q for questions in section_questions.values() for q in questions]
    )

    # Create report
    report = Report(
        test_id=test.id,
        overall_score=overall_score,
        recommendation=ai_report.get("recommendation", "maybe"),
        brain_teaser_score=avg_section_scores.get("brain_teaser"),
        coding_score=avg_section_scores.get("coding"),
        code_review_score=avg_section_scores.get("code_review"),
        system_design_score=avg_section_scores.get("system_design"),
        signal_processing_score=avg_section_scores.get("signal_processing"),
        strengths=ai_report.get("strengths", []),
        weaknesses=ai_report.get("weaknesses", []),
        detailed_feedback=ai_report.get("detailed_feedback", ""),
        ai_summary=ai_report.get("summary", ""),
        generated_at=datetime.utcnow()
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    return report


@router.get("/{report_id}", response_model=ReportWithCandidate)
async def get_report(report_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific report."""
    query = (
        select(Report)
        .options(selectinload(Report.test).selectinload(Test.candidate))
        .where(Report.id == report_id)
    )
    result = await db.execute(query)
    report = result.scalars().first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Build break history entries
    break_history = []
    for entry in (report.test.break_history or []):
        break_history.append(BreakHistoryEntry(
            start=entry.get("start", ""),
            end=entry.get("end"),
            duration_seconds=entry.get("duration_seconds", 0)
        ))

    return ReportWithCandidate(
        id=report.id,
        test_id=report.test_id,
        overall_score=report.overall_score,
        recommendation=report.recommendation,
        brain_teaser_score=report.brain_teaser_score,
        coding_score=report.coding_score,
        code_review_score=report.code_review_score,
        system_design_score=report.system_design_score,
        signal_processing_score=report.signal_processing_score,
        strengths=report.strengths,
        weaknesses=report.weaknesses,
        detailed_feedback=report.detailed_feedback,
        ai_summary=report.ai_summary,
        generated_at=report.generated_at,
        candidate_name=report.test.candidate.name,
        candidate_email=report.test.candidate.email,
        test_duration_hours=report.test.candidate.test_duration_hours,
        categories=report.test.candidate.categories or [],
        difficulty=report.test.candidate.difficulty,
        tab_switch_count=report.test.tab_switch_count,
        tab_switch_timestamps=report.test.tab_switch_timestamps,
        paste_attempt_count=report.test.paste_attempt_count,
        total_break_time_seconds=report.test.total_break_time_seconds,
        used_break_time_seconds=report.test.used_break_time_seconds,
        break_count=report.test.break_count,
        break_history=break_history
    )


@router.post("/regenerate/{test_id}", response_model=ReportResponse)
async def regenerate_report(test_id: int, db: AsyncSession = Depends(get_db)):
    """Regenerate assessment report for a test, replacing any existing report.

    Use this after re-evaluating answers to update the report with new scores.
    """
    # Get test with all related data
    query = (
        select(Test)
        .options(
            selectinload(Test.candidate),
            selectinload(Test.questions).selectinload(Question.answer),
            selectinload(Test.report)
        )
        .where(Test.id == test_id)
    )
    result = await db.execute(query)
    test = result.scalars().first()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status not in [TestStatus.COMPLETED.value, TestStatus.EXPIRED.value]:
        raise HTTPException(status_code=400, detail="Test not completed yet")

    # Delete existing report if present
    if test.report:
        await db.delete(test.report)
        await db.flush()

    # Calculate section scores
    section_scores = {}
    section_questions = {}

    for question in test.questions:
        category = question.category
        if category not in section_questions:
            section_questions[category] = []
            section_scores[category] = []

        if question.answer and question.answer.score is not None:
            section_scores[category].append(question.answer.score)

        section_questions[category].append({
            "question": question.question_text,
            "answer": question.answer.candidate_answer if question.answer else None,
            "score": question.answer.score if question.answer else None,
            "feedback": question.answer.feedback if question.answer else None
        })

    # Calculate average scores per section
    avg_section_scores = {}
    for category, scores in section_scores.items():
        if scores:
            avg_section_scores[category] = sum(scores) / len(scores)
        else:
            avg_section_scores[category] = 0

    # Calculate overall score
    if avg_section_scores:
        overall_score = sum(avg_section_scores.values()) / len(avg_section_scores)
    else:
        overall_score = 0

    # Generate AI report
    ai_report = await ai_service.generate_report(
        candidate_name=test.candidate.name,
        categories=test.candidate.categories or [],
        difficulty=test.candidate.difficulty,
        section_scores=avg_section_scores,
        question_details=[q for questions in section_questions.values() for q in questions]
    )

    # Create new report
    report = Report(
        test_id=test.id,
        overall_score=overall_score,
        recommendation=ai_report.get("recommendation", "maybe"),
        brain_teaser_score=avg_section_scores.get("brain_teaser"),
        coding_score=avg_section_scores.get("coding"),
        code_review_score=avg_section_scores.get("code_review"),
        system_design_score=avg_section_scores.get("system_design"),
        signal_processing_score=avg_section_scores.get("signal_processing"),
        strengths=ai_report.get("strengths", []),
        weaknesses=ai_report.get("weaknesses", []),
        detailed_feedback=ai_report.get("detailed_feedback", ""),
        ai_summary=ai_report.get("summary", ""),
        generated_at=datetime.utcnow()
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    return report


@router.get("/test/{test_id}", response_model=ReportWithCandidate)
async def get_report_by_test(test_id: int, db: AsyncSession = Depends(get_db)):
    """Get report by test ID."""
    query = (
        select(Report)
        .options(selectinload(Report.test).selectinload(Test.candidate))
        .where(Report.test_id == test_id)
    )
    result = await db.execute(query)
    report = result.scalars().first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Build break history entries
    break_history = []
    for entry in (report.test.break_history or []):
        break_history.append(BreakHistoryEntry(
            start=entry.get("start", ""),
            end=entry.get("end"),
            duration_seconds=entry.get("duration_seconds", 0)
        ))

    return ReportWithCandidate(
        id=report.id,
        test_id=report.test_id,
        overall_score=report.overall_score,
        recommendation=report.recommendation,
        brain_teaser_score=report.brain_teaser_score,
        coding_score=report.coding_score,
        code_review_score=report.code_review_score,
        system_design_score=report.system_design_score,
        signal_processing_score=report.signal_processing_score,
        strengths=report.strengths,
        weaknesses=report.weaknesses,
        detailed_feedback=report.detailed_feedback,
        ai_summary=report.ai_summary,
        generated_at=report.generated_at,
        candidate_name=report.test.candidate.name,
        candidate_email=report.test.candidate.email,
        test_duration_hours=report.test.candidate.test_duration_hours,
        categories=report.test.candidate.categories or [],
        difficulty=report.test.candidate.difficulty,
        tab_switch_count=report.test.tab_switch_count,
        tab_switch_timestamps=report.test.tab_switch_timestamps,
        paste_attempt_count=report.test.paste_attempt_count,
        total_break_time_seconds=report.test.total_break_time_seconds,
        used_break_time_seconds=report.test.used_break_time_seconds,
        break_count=report.test.break_count,
        break_history=break_history
    )
