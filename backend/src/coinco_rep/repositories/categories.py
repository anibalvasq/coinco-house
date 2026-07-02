"""CRUD operations for bill categories."""
from coinco_rep.repositories.db import get_db


def list_categories(household_id: str) -> list[dict]:
    db = get_db()
    res = db.table("categories").select("*").eq("household_id", household_id).order("sort_order").execute()
    return res.data or []


def create_category(household_id: str, name: str) -> dict:
    db = get_db()
    # place new category last
    existing = list_categories(household_id)
    sort_order = len(existing)
    res = db.table("categories").insert({
        "household_id": household_id,
        "name": name,
        "sort_order": sort_order,
    }).execute()
    return res.data[0]


def delete_category(category_id: str, household_id: str) -> None:
    db = get_db()
    db.table("categories").delete().eq("id", category_id).eq("household_id", household_id).execute()
