from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from app.config import settings
import asyncio
import random


# Check if using PostgreSQL or SQLite
is_postgres = settings.DATABASE_URL.startswith("postgresql")

if is_postgres:
    # PostgreSQL connection settings
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
    )
else:
    # SQLite connection settings
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        connect_args={
            "timeout": 120,
            "check_same_thread": False,
        },
        pool_pre_ping=True,
    )

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def retry_on_lock(func, max_retries=5, base_delay=0.5):
    """Retry a database operation with exponential backoff on lock errors."""
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
