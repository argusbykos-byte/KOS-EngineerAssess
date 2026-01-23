from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from app.config import settings
import asyncio
import random


# SQLite connection settings to prevent "database is locked" errors
# when AI generation takes a long time (2-4 minutes for test creation)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args={
        "timeout": 120,  # Wait up to 120 seconds for lock (AI can take 2-4 min)
        "check_same_thread": False,  # Required for async
    },
    pool_pre_ping=True,  # Verify connections before use
)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def retry_on_lock(func, max_retries=5, base_delay=0.5):
    """
    Retry a database operation with exponential backoff on lock errors.
    Use this for critical write operations that might fail due to database locks.
    
    Usage:
        result = await retry_on_lock(lambda: db.commit())
    """
    last_error = None
    for attempt in range(max_retries):
        try:
            return await func()
        except OperationalError as e:
            if "database is locked" in str(e).lower():
                last_error = e
                delay = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
                print(f"[Database] Lock detected, retry {attempt + 1}/{max_retries} after {delay:.2f}s")
                await asyncio.sleep(delay)
            else:
                raise
    raise last_error


# CRITICAL: Enable WAL mode for SQLite to prevent "database is locked" errors
# WAL (Write-Ahead Logging) allows concurrent reads during writes
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Set SQLite pragmas for better concurrency and reliability."""
    cursor = dbapi_connection.cursor()
    # WAL mode allows readers to proceed while a writer is active
    cursor.execute("PRAGMA journal_mode=WAL")
    # Wait up to 60 seconds if database is locked
    cursor.execute("PRAGMA busy_timeout=60000")
    # Synchronous NORMAL is a good balance between safety and speed
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
