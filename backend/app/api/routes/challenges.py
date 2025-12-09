from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import Optional
import os
import uuid

from app.database import get_db
from app.models import Test, ChallengeSubmission, TaskResponse, Deliverable
from app.models.test import TestStatus
from app.challenges import Track, build_challenge_spec, get_track_display_name
from app.schemas.challenge import (
    TaskResponseDraft,
    TaskResponseSubmit,
    TaskResponseResponse,
    TaskDraftSaveResponse,
    DeliverableCreate,
    DeliverableResponse,
    ChallengeSubmissionResponse,
    ChallengeSpecResponse,
    ChallengeTaskSpec,
    AutoPresentationSpec,
)
from app.services.ai_service import ai_service

router = APIRouter()

# Upload directory for deliverables
UPLOAD_DIR = "uploads/deliverables"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/spec/{track}", response_model=ChallengeSpecResponse)
async def get_challenge_spec(track: str):
    """Get the challenge specification for a track."""
    try:
        track_enum = Track(track)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid track: {track}")

    spec = build_challenge_spec(track_enum)

    return ChallengeSpecResponse(
        track=spec.track.value,
        title=spec.title,
        short_summary=spec.short_summary,
        tasks=[
            ChallengeTaskSpec(
                id=t.id,
                title=t.title,
                description=t.description,
                requirements=t.requirements,
            )
            for t in spec.tasks
        ],
        deliverables=spec.deliverables,
        auto_presentation=AutoPresentationSpec(
            enabled=spec.auto_presentation.enabled,
            sections=spec.auto_presentation.sections,
        ),
        estimated_time_hours=spec.estimated_time_hours,
    )


@router.get("/submission/{test_id}", response_model=ChallengeSubmissionResponse)
async def get_challenge_submission(
    test_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get the challenge submission for a test."""
    query = (
        select(ChallengeSubmission)
        .options(
            selectinload(ChallengeSubmission.task_responses),
            selectinload(ChallengeSubmission.deliverables),
        )
        .where(ChallengeSubmission.test_id == test_id)
    )
    result = await db.execute(query)
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=404, detail="Challenge submission not found")

    return submission


@router.post("/task/draft", response_model=TaskDraftSaveResponse)
async def save_task_draft(
    test_id: int,
    draft_data: TaskResponseDraft,
    db: AsyncSession = Depends(get_db)
):
    """Auto-save a draft task response without AI evaluation."""
    # Get test with challenge submission
    query = (
        select(Test)
        .options(selectinload(Test.challenge_submission))
        .where(Test.id == test_id)
    )
    result = await db.execute(query)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    # Get or create challenge submission
    submission = test.challenge_submission
    if not submission:
        raise HTTPException(status_code=400, detail="No challenge submission found")

    # Get or create task response
    task_query = select(TaskResponse).where(
        TaskResponse.challenge_submission_id == submission.id,
        TaskResponse.task_id == draft_data.task_id
    )
    task_result = await db.execute(task_query)
    task_response = task_result.scalar_one_or_none()

    if not task_response:
        task_response = TaskResponse(
            challenge_submission_id=submission.id,
            task_id=draft_data.task_id,
            version=1
        )
        db.add(task_response)

    # Track edits to submitted responses
    if task_response.is_submitted:
        if not task_response.previous_response and task_response.response_text:
            task_response.previous_response = task_response.response_text
            task_response.previous_code = task_response.response_code
            task_response.previous_score = task_response.score

        task_response.edit_count = (task_response.edit_count or 0) + 1
        task_response.version = (task_response.version or 1) + 1
        task_response.last_edited_at = datetime.utcnow()

        # Clear evaluation since content changed
        task_response.score = None
        task_response.feedback = None
        task_response.ai_evaluation = None
        task_response.evaluated_at = None

    # Update content
    task_response.response_text = draft_data.response_text
    task_response.response_code = draft_data.response_code
    task_response.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task_response)

    return TaskDraftSaveResponse(
        success=True,
        task_id=draft_data.task_id,
        saved_at=datetime.utcnow(),
        version=task_response.version or 1
    )


@router.post("/task/submit", response_model=TaskResponseResponse)
async def submit_task_response(
    test_id: int,
    submit_data: TaskResponseSubmit,
    db: AsyncSession = Depends(get_db)
):
    """Submit a task response for AI evaluation."""
    # Get test with challenge submission and candidate
    query = (
        select(Test)
        .options(
            selectinload(Test.challenge_submission),
            selectinload(Test.candidate),
        )
        .where(Test.id == test_id)
    )
    result = await db.execute(query)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    submission = test.challenge_submission
    if not submission:
        raise HTTPException(status_code=400, detail="No challenge submission found")

    # Get challenge spec for context
    try:
        track_enum = Track(submission.track)
        challenge_spec = build_challenge_spec(track_enum)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid track")

    # Find the task in the spec
    task_spec = next((t for t in challenge_spec.tasks if t.id == submit_data.task_id), None)
    if not task_spec:
        raise HTTPException(status_code=400, detail=f"Unknown task: {submit_data.task_id}")

    # Get or create task response
    task_query = select(TaskResponse).where(
        TaskResponse.challenge_submission_id == submission.id,
        TaskResponse.task_id == submit_data.task_id
    )
    task_result = await db.execute(task_query)
    task_response = task_result.scalar_one_or_none()

    if not task_response:
        task_response = TaskResponse(
            challenge_submission_id=submission.id,
            task_id=submit_data.task_id,
            version=1
        )
        db.add(task_response)

    is_resubmission = task_response.is_submitted

    if is_resubmission:
        if (task_response.response_text != submit_data.response_text or
            task_response.response_code != submit_data.response_code):
            if not task_response.previous_response:
                task_response.previous_response = task_response.response_text
                task_response.previous_code = task_response.response_code
            task_response.previous_score = task_response.score
            task_response.version = (task_response.version or 1) + 1
            task_response.edit_count = (task_response.edit_count or 0) + 1
            task_response.last_edited_at = datetime.utcnow()

    # Update content
    task_response.response_text = submit_data.response_text
    task_response.response_code = submit_data.response_code
    task_response.is_submitted = True
    task_response.submitted_at = datetime.utcnow()

    # Evaluate with AI
    evaluation = await ai_service.evaluate_challenge_task(
        task_title=task_spec.title,
        task_description=task_spec.description,
        task_requirements=task_spec.requirements,
        candidate_response=submit_data.response_text or "",
        candidate_code=submit_data.response_code or "",
        track=submission.track,
        difficulty=test.candidate.difficulty
    )

    task_response.score = evaluation.get("score", 0)
    task_response.feedback = evaluation.get("feedback", "")
    task_response.ai_evaluation = evaluation
    task_response.evaluated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task_response)

    response = TaskResponseResponse.model_validate(task_response)
    response.needs_resubmit = False
    return response


@router.post("/deliverable/upload")
async def upload_deliverable(
    test_id: int,
    deliverable_type: str,
    file: UploadFile = File(...),
    title: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Upload a deliverable file."""
    # Get test and submission
    query = (
        select(Test)
        .options(selectinload(Test.challenge_submission))
        .where(Test.id == test_id)
    )
    result = await db.execute(query)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    submission = test.challenge_submission
    if not submission:
        raise HTTPException(status_code=400, detail="No challenge submission found")

    # Save file
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Create deliverable record
    deliverable = Deliverable(
        challenge_submission_id=submission.id,
        deliverable_type=deliverable_type,
        title=title or file.filename,
        file_path=file_path,
        file_name=file.filename,
        content_type=file.content_type,
        file_size_bytes=len(content),
    )
    db.add(deliverable)
    await db.commit()
    await db.refresh(deliverable)

    return DeliverableResponse.model_validate(deliverable)


@router.post("/deliverable/text", response_model=DeliverableResponse)
async def save_text_deliverable(
    test_id: int,
    data: DeliverableCreate,
    db: AsyncSession = Depends(get_db)
):
    """Save a text-based deliverable (inline content)."""
    query = (
        select(Test)
        .options(selectinload(Test.challenge_submission))
        .where(Test.id == test_id)
    )
    result = await db.execute(query)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    submission = test.challenge_submission
    if not submission:
        raise HTTPException(status_code=400, detail="No challenge submission found")

    # Check if deliverable of this type already exists
    existing_query = select(Deliverable).where(
        Deliverable.challenge_submission_id == submission.id,
        Deliverable.deliverable_type == data.deliverable_type
    )
    existing_result = await db.execute(existing_query)
    deliverable = existing_result.scalar_one_or_none()

    if deliverable:
        # Update existing
        deliverable.inline_content = data.inline_content
        deliverable.title = data.title
        deliverable.updated_at = datetime.utcnow()
    else:
        # Create new
        deliverable = Deliverable(
            challenge_submission_id=submission.id,
            deliverable_type=data.deliverable_type,
            title=data.title,
            inline_content=data.inline_content,
        )
        db.add(deliverable)

    await db.commit()
    await db.refresh(deliverable)

    return deliverable


@router.delete("/deliverable/{deliverable_id}")
async def delete_deliverable(
    deliverable_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a deliverable."""
    result = await db.execute(
        select(Deliverable).where(Deliverable.id == deliverable_id)
    )
    deliverable = result.scalar_one_or_none()

    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    # Delete file if exists
    if deliverable.file_path and os.path.exists(deliverable.file_path):
        os.remove(deliverable.file_path)

    await db.delete(deliverable)
    await db.commit()

    return {"success": True}


@router.post("/submit/{test_id}")
async def submit_challenge(
    test_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Submit the entire challenge for final evaluation."""
    query = (
        select(Test)
        .options(
            selectinload(Test.challenge_submission)
            .selectinload(ChallengeSubmission.task_responses),
            selectinload(Test.challenge_submission)
            .selectinload(ChallengeSubmission.deliverables),
            selectinload(Test.candidate),
        )
        .where(Test.id == test_id)
    )
    result = await db.execute(query)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.status != TestStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Test is not in progress")

    submission = test.challenge_submission
    if not submission:
        raise HTTPException(status_code=400, detail="No challenge submission found")

    # Calculate overall score from task responses
    submitted_tasks = [t for t in submission.task_responses if t.is_submitted and t.score is not None]
    if submitted_tasks:
        overall_score = sum(t.score for t in submitted_tasks) / len(submitted_tasks)
    else:
        overall_score = 0

    submission.is_submitted = True
    submission.submitted_at = datetime.utcnow()
    submission.overall_score = overall_score

    # Generate presentation data
    try:
        track_enum = Track(submission.track)
        challenge_spec = build_challenge_spec(track_enum)

        presentation_data = await ai_service.generate_challenge_presentation(
            candidate_name=test.candidate.name,
            track=submission.track,
            challenge_spec=challenge_spec,
            task_responses=submission.task_responses,
            deliverables=submission.deliverables
        )
        submission.presentation_data = presentation_data
        submission.presentation_generated_at = datetime.utcnow()
    except Exception as e:
        print(f"Error generating presentation: {e}")

    await db.commit()
    await db.refresh(submission)

    return {
        "success": True,
        "overall_score": overall_score,
        "presentation_generated": submission.presentation_data is not None
    }


@router.get("/presentation/{test_id}")
async def get_presentation(
    test_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get the auto-generated presentation for a challenge."""
    query = (
        select(ChallengeSubmission)
        .where(ChallengeSubmission.test_id == test_id)
    )
    result = await db.execute(query)
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=404, detail="Challenge submission not found")

    if not submission.presentation_data:
        raise HTTPException(status_code=404, detail="Presentation not generated yet")

    return submission.presentation_data
