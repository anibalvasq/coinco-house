"""CRUD operations for Web Push subscriptions (one per browser/device)."""

from coinco_rep.repositories.db import get_db


def upsert_subscription(
    household_id: str, person_id: str, endpoint: str, p256dh: str, auth: str
) -> dict:
    db = get_db()
    res = (
        db.table("push_subscriptions")
        .upsert(
            {
                "household_id": household_id,
                "person_id": person_id,
                "endpoint": endpoint,
                "p256dh": p256dh,
                "auth": auth,
            },
            on_conflict="endpoint",
        )
        .execute()
    )
    return res.data[0]


def delete_subscription(endpoint: str, household_id: str | None = None) -> None:
    db = get_db()
    query = db.table("push_subscriptions").delete().eq("endpoint", endpoint)
    if household_id:
        query = query.eq("household_id", household_id)
    query.execute()


def list_for_household(household_id: str) -> list[dict]:
    db = get_db()
    res = db.table("push_subscriptions").select("*").eq("household_id", household_id).execute()
    return res.data or []


def list_for_person(person_id: str, household_id: str) -> list[dict]:
    db = get_db()
    res = (
        db.table("push_subscriptions")
        .select("*")
        .eq("person_id", person_id)
        .eq("household_id", household_id)
        .execute()
    )
    return res.data or []
