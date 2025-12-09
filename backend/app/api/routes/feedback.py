from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import Test, Candidate, ImprovementSuggestion, SuggestionStatus
from app.schemas.feedback import (
    SuggestionSubmit,
    SuggestionResponse,
    SuggestionListResponse,
    SuggestionUpdate,
    SuggestionSubmitResponse,
    KimiAnalysis,
    AutoImplementResult
)
from app.services.ai_service import ai_service

router = APIRouter()


@router.post("/suggestion", response_model=SuggestionSubmitResponse)
async def submit_suggestion(
    request: SuggestionSubmit,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit an improvement suggestion from a candidate.

    The suggestion will be analyzed by Kimi2 to determine:
    - If it's valid and actionable
    - What category it falls into
    - If it can be auto-implemented
    """
    candidate_id = None
    test_id = None
    candidate_track = None

    # If test access token provided, link to candidate and test
    if request.test_access_token:
        query = (
            select(Test)
            .options(selectinload(Test.candidate))
            .where(Test.access_token == request.test_access_token)
        )
        result = await db.execute(query)
        test = result.scalar_one_or_none()

        if test:
            test_id = test.id
            candidate_id = test.candidate_id
            # Try to get track from candidate's categories
            if test.candidate and test.candidate.categories:
                # Map category to track
                category_to_track = {
                    "signal_processing": "ml_engineer",
                    "ml": "ml_engineer",
                    "biomedical": "biomedical_engineer",
                    "electrical": "electrical_engineer",
                    "firmware": "firmware_engineer",
                    "mechanical": "mechanical_engineer"
                }
                for cat in test.candidate.categories:
                    cat_lower = cat.lower()
                    for key, track in category_to_track.items():
                        if key in cat_lower:
                            candidate_track = track
                            break

    # Create suggestion record
    suggestion = ImprovementSuggestion(
        candidate_id=candidate_id,
        test_id=test_id,
        raw_feedback=request.raw_feedback,
        status=SuggestionStatus.PENDING.value
    )
    db.add(suggestion)
    await db.flush()

    # Analyze with Kimi2
    analysis = await ai_service.analyze_improvement_suggestion(
        raw_feedback=request.raw_feedback,
        candidate_track=candidate_track
    )

    suggestion.kimi2_analysis = analysis

    # Generate Claude Code command for non-auto-implementable suggestions
    if not analysis.get("can_auto_implement", False):
        suggestion.claude_code_command = ai_service.generate_claude_code_command(analysis)

    # Attempt auto-implementation if flagged
    auto_implemented = False
    auto_result = None

    if analysis.get("can_auto_implement", False) and analysis.get("is_valid", False):
        implement_result = await ai_service.auto_implement_suggestion(analysis)
        auto_result = AutoImplementResult(
            success=implement_result["success"],
            message=implement_result["message"],
            changes_made=implement_result.get("changes_made")
        )

        if implement_result["success"]:
            suggestion.status = SuggestionStatus.AUTO_IMPLEMENTED.value
            suggestion.implemented_at = datetime.utcnow()
            suggestion.implemented_by = "auto"
            suggestion.implementation_notes = "; ".join(implement_result.get("changes_made", []))
            auto_implemented = True
        else:
            # Failed auto-implementation - generate Claude Code command
            suggestion.status = SuggestionStatus.FAILED.value
            suggestion.claude_code_command = ai_service.generate_claude_code_command(analysis)
            suggestion.implementation_notes = f"Auto-implementation failed: {implement_result['message']}"

    await db.commit()
    await db.refresh(suggestion)

    return SuggestionSubmitResponse(
        id=suggestion.id,
        message="Thank you for your feedback! " + (
            "Your suggestion has been automatically implemented." if auto_implemented
            else "Your suggestion will be reviewed by our team."
        ),
        analysis=KimiAnalysis(**analysis) if analysis else None,
        auto_implemented=auto_implemented,
        auto_implement_result=auto_result
    )


@router.get("/admin/suggestions", response_model=SuggestionListResponse)
async def list_suggestions(
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    List all improvement suggestions for admin review.

    Supports filtering by status, category, and priority.
    """
    # Build base query
    query = select(ImprovementSuggestion).order_by(ImprovementSuggestion.created_at.desc())

    # Apply filters
    if status:
        query = query.where(ImprovementSuggestion.status == status)

    if category:
        # Filter by category in the JSON analysis field
        query = query.where(
            ImprovementSuggestion.kimi2_analysis["category"].astext == category
        )

    if priority:
        query = query.where(
            ImprovementSuggestion.kimi2_analysis["priority"].astext == priority
        )

    # Get total counts
    total_query = select(func.count(ImprovementSuggestion.id))
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0

    pending_query = select(func.count(ImprovementSuggestion.id)).where(
        ImprovementSuggestion.status == SuggestionStatus.PENDING.value
    )
    pending_result = await db.execute(pending_query)
    pending_count = pending_result.scalar() or 0

    auto_query = select(func.count(ImprovementSuggestion.id)).where(
        ImprovementSuggestion.status == SuggestionStatus.AUTO_IMPLEMENTED.value
    )
    auto_result = await db.execute(auto_query)
    auto_count = auto_result.scalar() or 0

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    suggestions = result.scalars().all()

    return SuggestionListResponse(
        suggestions=[
            SuggestionResponse(
                id=s.id,
                candidate_id=s.candidate_id,
                test_id=s.test_id,
                raw_feedback=s.raw_feedback,
                kimi2_analysis=KimiAnalysis(**s.kimi2_analysis) if s.kimi2_analysis else None,
                claude_code_command=s.claude_code_command,
                status=s.status,
                implemented_at=s.implemented_at,
                implemented_by=s.implemented_by,
                implementation_notes=s.implementation_notes,
                created_at=s.created_at,
                updated_at=s.updated_at
            )
            for s in suggestions
        ],
        total=total,
        pending_count=pending_count,
        auto_implemented_count=auto_count
    )


@router.get("/admin/suggestions/{suggestion_id}", response_model=SuggestionResponse)
async def get_suggestion(
    suggestion_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific suggestion by ID."""
    result = await db.execute(
        select(ImprovementSuggestion).where(ImprovementSuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()

    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    return SuggestionResponse(
        id=suggestion.id,
        candidate_id=suggestion.candidate_id,
        test_id=suggestion.test_id,
        raw_feedback=suggestion.raw_feedback,
        kimi2_analysis=KimiAnalysis(**suggestion.kimi2_analysis) if suggestion.kimi2_analysis else None,
        claude_code_command=suggestion.claude_code_command,
        status=suggestion.status,
        implemented_at=suggestion.implemented_at,
        implemented_by=suggestion.implemented_by,
        implementation_notes=suggestion.implementation_notes,
        created_at=suggestion.created_at,
        updated_at=suggestion.updated_at
    )


@router.put("/admin/suggestions/{suggestion_id}", response_model=SuggestionResponse)
async def update_suggestion(
    suggestion_id: int,
    update: SuggestionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a suggestion status (admin action).

    Use this to mark suggestions as reviewed, ignored, or manually implemented.
    """
    result = await db.execute(
        select(ImprovementSuggestion).where(ImprovementSuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()

    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    if update.status:
        suggestion.status = update.status
        if update.status == SuggestionStatus.ADMIN_REVIEWED.value:
            suggestion.implemented_at = datetime.utcnow()
            suggestion.implemented_by = "admin"

    if update.implementation_notes:
        suggestion.implementation_notes = update.implementation_notes

    await db.commit()
    await db.refresh(suggestion)

    return SuggestionResponse(
        id=suggestion.id,
        candidate_id=suggestion.candidate_id,
        test_id=suggestion.test_id,
        raw_feedback=suggestion.raw_feedback,
        kimi2_analysis=KimiAnalysis(**suggestion.kimi2_analysis) if suggestion.kimi2_analysis else None,
        claude_code_command=suggestion.claude_code_command,
        status=suggestion.status,
        implemented_at=suggestion.implemented_at,
        implemented_by=suggestion.implemented_by,
        implementation_notes=suggestion.implementation_notes,
        created_at=suggestion.created_at,
        updated_at=suggestion.updated_at
    )


@router.post("/admin/suggestions/{suggestion_id}/retry-auto-implement")
async def retry_auto_implement(
    suggestion_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Retry auto-implementation for a failed suggestion.
    """
    result = await db.execute(
        select(ImprovementSuggestion).where(ImprovementSuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()

    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    if not suggestion.kimi2_analysis:
        raise HTTPException(status_code=400, detail="No analysis available for this suggestion")

    analysis = suggestion.kimi2_analysis

    if not analysis.get("can_auto_implement", False):
        raise HTTPException(status_code=400, detail="This suggestion is not marked for auto-implementation")

    implement_result = await ai_service.auto_implement_suggestion(analysis)

    if implement_result["success"]:
        suggestion.status = SuggestionStatus.AUTO_IMPLEMENTED.value
        suggestion.implemented_at = datetime.utcnow()
        suggestion.implemented_by = "auto_retry"
        suggestion.implementation_notes = "; ".join(implement_result.get("changes_made", []))
        await db.commit()

        return {
            "success": True,
            "message": "Successfully auto-implemented suggestion",
            "changes_made": implement_result.get("changes_made")
        }
    else:
        suggestion.implementation_notes = f"Retry failed: {implement_result['message']}"
        await db.commit()

        return {
            "success": False,
            "message": implement_result["message"]
        }


@router.delete("/admin/suggestions/{suggestion_id}")
async def delete_suggestion(
    suggestion_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a suggestion."""
    result = await db.execute(
        select(ImprovementSuggestion).where(ImprovementSuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()

    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    await db.delete(suggestion)
    await db.commit()

    return {"message": "Suggestion deleted"}
