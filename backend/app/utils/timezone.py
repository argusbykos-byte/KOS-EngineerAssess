"""Timezone utilities for KOS assessment platform.

All timestamps are stored in UTC in the database.
For display purposes, convert to Pacific Time (America/Los_Angeles).
KOS is based in Palo Alto, California.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# KOS headquarters timezone
PACIFIC_TZ = ZoneInfo("America/Los_Angeles")
UTC_TZ = timezone.utc


def utc_now() -> datetime:
    """Get current time in UTC with timezone info."""
    return datetime.now(UTC_TZ)


def to_pacific(dt: datetime) -> datetime:
    """Convert a datetime to Pacific Time.

    Args:
        dt: A datetime object. If naive (no tzinfo), assumes UTC.

    Returns:
        Datetime in Pacific Time.
    """
    if dt is None:
        return None

    # If naive datetime, assume it's UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC_TZ)

    return dt.astimezone(PACIFIC_TZ)


def format_pacific_date(dt: datetime, format_str: str = "%B %d, %Y") -> str:
    """Format a datetime as a string in Pacific Time.

    Args:
        dt: A datetime object (UTC or timezone-aware).
        format_str: strftime format string. Default: "January 11, 2026"

    Returns:
        Formatted date string in Pacific Time.
    """
    if dt is None:
        return ""

    pacific_dt = to_pacific(dt)
    return pacific_dt.strftime(format_str)


def format_pacific_datetime(dt: datetime) -> str:
    """Format a datetime as date and time string in Pacific Time.

    Args:
        dt: A datetime object (UTC or timezone-aware).

    Returns:
        Formatted datetime string like "January 11, 2026 at 3:45 PM PST"
    """
    if dt is None:
        return ""

    pacific_dt = to_pacific(dt)
    # Use %Z for timezone abbreviation (PST/PDT)
    return pacific_dt.strftime("%B %d, %Y at %I:%M %p %Z")


def get_pacific_date_iso(dt: datetime) -> str:
    """Get ISO format date in Pacific Time (YYYY-MM-DD).

    Args:
        dt: A datetime object (UTC or timezone-aware).

    Returns:
        ISO format date string.
    """
    if dt is None:
        return ""

    pacific_dt = to_pacific(dt)
    return pacific_dt.strftime("%Y-%m-%d")
