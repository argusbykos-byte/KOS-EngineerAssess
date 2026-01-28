from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import asyncpg
import uuid
from datetime import datetime

router = APIRouter(prefix="/sync", tags=["sync"])

NEON_URL = "postgresql://neondb_owner:npg_HPuWRDVC50JB@ep-square-night-ahsa22li-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

@router.post("/cloud-applications")
async def sync_cloud_applications(db: AsyncSession = Depends(get_db)):
    """
    Sync applications from Neon cloud database to local SQLite.
    Skips applications that already exist (by email).
    """
    try:
        pg_conn = await asyncpg.connect(NEON_URL)

        cloud_apps = await pg_conn.fetch("""
            SELECT full_name, email, phone, location, primary_role,
                   motivation, engineers_admired, self_rating, unique_qualities,
                   resume_filename, skills, created_at, status
            FROM cloud_applications ORDER BY id
        """)

        synced = 0
        skipped = 0

        for app in cloud_apps:
            # Check if already exists
            result = await db.execute(
                text("SELECT id FROM applications WHERE email = :email"),
                {"email": app['email']}
            )
            if result.fetchone():
                skipped += 1
                continue

            # Generate token and timestamps
            token = uuid.uuid4().hex + uuid.uuid4().hex[:32]
            now = datetime.utcnow()

            # Insert into local database
            await db.execute(
                text("""
                    INSERT INTO applications (
                        full_name, email, phone, location, self_description,
                        motivation, admired_engineers, overall_self_rating, unique_trait,
                        resume_filename, application_token, status, created_at, updated_at
                    ) VALUES (
                        :full_name, :email, :phone, :location, :primary_role,
                        :motivation, :engineers_admired, :self_rating, :unique_qualities,
                        :resume_filename, :token, :status, :created_at, :updated_at
                    )
                """),
                {
                    "full_name": app['full_name'],
                    "email": app['email'],
                    "phone": app['phone'],
                    "location": app['location'],
                    "primary_role": app['primary_role'],
                    "motivation": app['motivation'],
                    "engineers_admired": app['engineers_admired'],
                    "self_rating": app['self_rating'],
                    "unique_qualities": app['unique_qualities'],
                    "resume_filename": app['resume_filename'],
                    "token": token,
                    "status": app['status'] or 'pending',
                    "created_at": app['created_at'] or now,
                    "updated_at": now
                }
            )
            synced += 1

        await db.commit()
        await pg_conn.close()

        return {"success": True, "synced": synced, "skipped": skipped}

    except Exception as e:
        return {"success": False, "error": str(e)}
