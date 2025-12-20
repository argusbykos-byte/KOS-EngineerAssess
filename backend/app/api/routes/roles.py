from fastapi import APIRouter
from typing import List, Dict, Any
from app.config.roles import (
    get_all_roles,
    get_role_config,
    get_role_categories,
    get_role_skill_dimensions,
    CATEGORY_PROMPTS,
)

router = APIRouter()


@router.get("/", response_model=Dict[str, Any])
async def list_roles():
    """List all available engineering roles."""
    roles = get_all_roles()
    return {
        "roles": [
            {
                "id": role_id,
                "title": role_data["title"],
                "description": role_data["description"],
                "categories": list(role_data["categories"].keys()),
                "skill_dimensions": role_data.get("skill_dimensions", []),
            }
            for role_id, role_data in roles.items()
        ]
    }


@router.get("/{role_id}")
async def get_role(role_id: str):
    """Get configuration for a specific role."""
    config = get_role_config(role_id)
    return {
        "id": role_id,
        **config,
    }


@router.get("/{role_id}/categories")
async def get_role_categories_endpoint(role_id: str):
    """Get the categories for a specific role."""
    categories = get_role_categories(role_id)
    return {
        "role_id": role_id,
        "categories": categories,
        "category_details": {
            cat: CATEGORY_PROMPTS.get(cat, cat) for cat in categories
        },
    }


@router.get("/{role_id}/skill-dimensions")
async def get_skill_dimensions(role_id: str):
    """Get the skill dimensions for radar chart for a role."""
    dimensions = get_role_skill_dimensions(role_id)
    return {
        "role_id": role_id,
        "dimensions": dimensions,
    }


@router.get("/categories/all")
async def get_all_categories():
    """Get all available categories and their descriptions."""
    return {
        "categories": CATEGORY_PROMPTS,
    }
