"""CRUD operations for bills, scoped to a specific month."""

from coinco_rep.repositories.db import get_db


def list_bills(household_id: str, month_key: str) -> list[dict]:
    db = get_db()
    res = (
        db.table("bills")
        .select("*")
        .eq("household_id", household_id)
        .eq("month_key", month_key)
        .order("date", desc=True)
        .execute()
    )
    return res.data or []


def get_bill(bill_id: str, household_id: str) -> dict | None:
    db = get_db()
    res = db.table("bills").select("*").eq("id", bill_id).eq("household_id", household_id).single().execute()
    return res.data


def create_bill(
    household_id: str,
    month_key: str,
    category_id: str,
    name: str,
    amount: float,
    date: str,
    note: str = "",
) -> dict:
    db = get_db()
    res = db.table("bills").insert({
        "household_id": household_id,
        "month_key": month_key,
        "category_id": category_id,
        "name": name,
        "amount": amount,
        "date": date,
        "note": note,
    }).execute()
    return res.data[0]


def update_bill(bill_id: str, household_id: str, **fields) -> dict:
    db = get_db()
    res = (
        db.table("bills")
        .update(fields)
        .eq("id", bill_id)
        .eq("household_id", household_id)
        .execute()
    )
    return res.data[0]


def delete_bill(bill_id: str, household_id: str) -> None:
    db = get_db()
    db.table("bills").delete().eq("id", bill_id).eq("household_id", household_id).execute()


def list_months_with_bills(household_id: str) -> list[str]:
    """Return distinct month_keys that have at least one bill, newest first."""
    db = get_db()
    res = (
        db.table("bills")
        .select("month_key")
        .eq("household_id", household_id)
        .execute()
    )
    keys = sorted({r["month_key"] for r in (res.data or [])}, reverse=True)
    return keys
