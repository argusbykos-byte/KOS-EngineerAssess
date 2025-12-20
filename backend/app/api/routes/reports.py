from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
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


@router.get("/{report_id}/role-fit")
async def get_role_fit_recommendations(report_id: int, db: AsyncSession = Depends(get_db)):
    """Get AI-powered role fit recommendations for a report."""
    query = (
        select(Report)
        .options(selectinload(Report.test).selectinload(Test.candidate))
        .where(Report.id == report_id)
    )
    result = await db.execute(query)
    report = result.scalars().first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Build section scores dict
    section_scores = {}
    if report.brain_teaser_score is not None:
        section_scores["brain_teaser"] = report.brain_teaser_score
    if report.coding_score is not None:
        section_scores["coding"] = report.coding_score
    if report.code_review_score is not None:
        section_scores["code_review"] = report.code_review_score
    if report.system_design_score is not None:
        section_scores["system_design"] = report.system_design_score
    if report.signal_processing_score is not None:
        section_scores["signal_processing"] = report.signal_processing_score

    # Get role fit recommendations
    role_fit = await ai_service.generate_role_fit_recommendation(
        candidate_name=report.test.candidate.name,
        section_scores=section_scores,
        strengths=report.strengths or [],
        weaknesses=report.weaknesses or [],
        skills=report.test.candidate.extracted_skills or [],
    )

    return {
        "report_id": report_id,
        "candidate_name": report.test.candidate.name,
        **role_fit
    }


@router.get("/cheating-logs")
async def get_cheating_logs(
    skip: int = 0,
    limit: int = 100,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get all cheating/integrity violation logs across tests."""
    query = (
        select(Test)
        .options(selectinload(Test.candidate))
        .where(
            (Test.tab_switch_count > 0) |
            (Test.paste_attempt_count > 0) |
            (Test.copy_attempt_count > 0) |
            (Test.right_click_count > 0) |
            (Test.dev_tools_open_count > 0) |
            (Test.is_disqualified == True)
        )
        .offset(skip)
        .limit(limit)
        .order_by(Test.updated_at.desc())
    )
    result = await db.execute(query)
    tests = result.scalars().all()

    logs = []
    for test in tests:
        # Calculate total violations
        total_violations = (
            (test.tab_switch_count or 0) +
            (test.paste_attempt_count or 0) +
            (test.copy_attempt_count or 0) +
            (test.right_click_count or 0) +
            (test.dev_tools_open_count or 0)
        )

        # Determine severity
        if test.is_disqualified:
            test_severity = "critical"
        elif total_violations >= 5:
            test_severity = "high"
        elif total_violations >= 3:
            test_severity = "medium"
        else:
            test_severity = "low"

        # Filter by severity if specified
        if severity and test_severity != severity:
            continue

        logs.append({
            "test_id": test.id,
            "candidate_name": test.candidate.name,
            "candidate_email": test.candidate.email,
            "test_status": test.status,
            "tab_switch_count": test.tab_switch_count or 0,
            "paste_attempt_count": test.paste_attempt_count or 0,
            "copy_attempt_count": test.copy_attempt_count or 0,
            "right_click_count": test.right_click_count or 0,
            "dev_tools_open_count": test.dev_tools_open_count or 0,
            "focus_loss_count": test.focus_loss_count or 0,
            "total_violations": total_violations,
            "warning_count": test.warning_count or 0,
            "is_disqualified": test.is_disqualified or False,
            "disqualification_reason": test.disqualification_reason,
            "disqualified_at": test.disqualified_at.isoformat() if test.disqualified_at else None,
            "violation_events": test.violation_events or [],
            "severity": test_severity,
            "created_at": test.created_at.isoformat(),
            "updated_at": test.updated_at.isoformat(),
        })

    return {
        "total": len(logs),
        "logs": logs
    }
