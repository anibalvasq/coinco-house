"""Household config lookup."""

from coinco_rep.repositories.db import get_db


def get_household(household_id: str) -> dict | None:
    db = get_db()
    res = db.table("households").select("*").eq("id", household_id).single().execute()
    return res.data
