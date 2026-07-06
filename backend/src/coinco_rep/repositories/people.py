"""CRUD operations for people (household members)."""

from coinco_rep.repositories.db import get_db


def list_people(household_id: str) -> list[dict]:
    db = get_db()
    res = db.table("people").select("*").eq("household_id", household_id).order("created_at").execute()
    return res.data or []


def get_person(person_id: str, household_id: str) -> dict | None:
    db = get_db()
    res = db.table("people").select("*").eq("id", person_id).eq("household_id", household_id).single().execute()
    return res.data


def create_person(
    household_id: str, name: str, color: str, pin_hash: str, email: str | None = None
) -> dict:
    db = get_db()
    payload: dict = {
        "household_id": household_id,
        "name": name,
        "color": color,
        "pin_hash": pin_hash,
    }
    if email:
        payload["email"] = email
    res = db.table("people").insert(payload).execute()
    return res.data[0]


def update_person(person_id: str, household_id: str, **fields) -> dict:
    db = get_db()
    res = (
        db.table("people")
        .update(fields)
        .eq("id", person_id)
        .eq("household_id", household_id)
        .execute()
    )
    return res.data[0]


def delete_person(person_id: str, household_id: str) -> None:
    db = get_db()
    db.table("people").delete().eq("id", person_id).eq("household_id", household_id).execute()


def count_people(household_id: str) -> int:
    db = get_db()
    res = db.table("people").select("id", count="exact").eq("household_id", household_id).execute()
    return res.count or 0
