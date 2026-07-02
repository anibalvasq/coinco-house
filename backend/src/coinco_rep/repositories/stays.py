"""CRUD operations for month_stays (days in residence per person per month)."""
from coinco_rep.repositories.db import get_db


def get_stays(household_id: str, month_key: str) -> dict[str, int]:
    """Return {person_id: days} for a given month."""
    db = get_db()
    res = (
        db.table("month_stays")
        .select("person_id, days")
        .eq("household_id", household_id)
        .eq("month_key", month_key)
        .execute()
    )
    return {row["person_id"]: row["days"] for row in (res.data or [])}


def upsert_stay(household_id: str, month_key: str, person_id: str, days: int) -> dict:
    """Insert or update a single person's days for a month. Days clamped 0–31."""
    days = max(0, min(31, days))
    db = get_db()
    res = db.table("month_stays").upsert({
        "household_id": household_id,
        "month_key": month_key,
        "person_id": person_id,
        "days": days,
    }).execute()
    return res.data[0]


def bulk_upsert_stays(household_id: str, month_key: str, stays: dict[str, int]) -> None:
    """Upsert all stays for a month at once."""
    records = [
        {"household_id": household_id, "month_key": month_key, "person_id": pid, "days": max(0, min(31, d))}
        for pid, d in stays.items()
    ]
    if records:
        db = get_db()
        db.table("month_stays").upsert(records).execute()
