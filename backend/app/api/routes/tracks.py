"""API routes for specialization tracks."""
from fastapi import APIRouter
from typing import Dict, Any, List

from app.config.tracks import get_all_tracks, get_track_config, get_track_name

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def list_tracks():
    """List all available specialization tracks."""
    tracks = get_all_tracks()
    return {
        "tracks": [
            {
                "id": track_id,
                "name": config["name"],
                "description": config["description"],
                "question_topics": config["question_topics"],
            }
            for track_id, config in tracks.items()
        ]
    }


@router.get("/{track_id}", response_model=Dict[str, Any])
async def get_track(track_id: str):
    """Get details for a specific track."""
    config = get_track_config(track_id)
    if not config:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Track '{track_id}' not found")

    return {
        "id": track_id,
        "name": config["name"],
        "description": config["description"],
        "question_topics": config["question_topics"],
    }
