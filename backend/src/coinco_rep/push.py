"""
Web Push notifications for the PWA.

- New, edited or deleted bill: notify every household member's devices, including the author's.
- Month close (last day): each person gets their own share of the month.

Requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (see scripts/generate_vapid_keys.py).
Without them, every send is a silent no-op so the rest of the app keeps working.
"""
import json
import logging

from pywebpush import WebPushException, webpush

from coinco_rep.config import settings
from coinco_rep.domain.formatting import fmt_clp, month_label
from coinco_rep.repositories import categories as cat_repo
from coinco_rep.repositories import people as people_repo
from coinco_rep.repositories import push_subscriptions as subs_repo

logger = logging.getLogger(__name__)

# Push services answer 404/410 when the browser dropped the subscription
# (app uninstalled, permission revoked). Those rows are deleted.
_GONE = {404, 410}


def push_enabled() -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def send_to_subscriptions(subs: list[dict], payload: dict) -> int:
    """Send one payload to many devices. Returns how many were delivered."""
    if not push_enabled() or not subs:
        return 0
    data = json.dumps(payload, ensure_ascii=False)
    delivered = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=data,
                vapid_private_key=settings.vapid_private_key,
                # Fresh dict per call: pywebpush writes the per-endpoint "aud" into it.
                vapid_claims={"sub": settings.vapid_subject},
                ttl=60 * 60 * 24,
                timeout=5,
            )
            delivered += 1
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in _GONE:
                subs_repo.delete_subscription(sub["endpoint"])
            else:
                logger.warning("Web push failed (%s): %s", status, exc)
        except Exception:  # network errors must never break the caller
            logger.exception("Web push failed")
    return delivered


def _bill_label(household_id: str, bill: dict) -> str:
    """'Luz · Factura julio', or just the category / name when only one is set."""
    category = next(
        (c["name"] for c in cat_repo.list_categories(household_id) if c["id"] == bill.get("category_id")),
        "",
    )
    name = (bill.get("name") or "").strip()
    parts = [category] + ([name] if name and name.lower() != category.lower() else [])
    return " · ".join(p for p in parts if p) or "Gasto"


def _notify_household(household_id: str, actor_person_id: str, bill: dict, verb: str, body: str | None = None) -> int:
    """Notify every household member (the actor too) about a bill change."""
    subs = subs_repo.list_for_household(household_id)
    if not subs:
        return 0

    actor = people_repo.get_person(actor_person_id, household_id) or {}
    return send_to_subscriptions(subs, {
        "title": f"{actor.get('name', 'Alguien')} {verb} un gasto",
        "body": body or f"{_bill_label(household_id, bill)} · {fmt_clp(float(bill['amount']))}",
        "tag": f"bill-{bill['id']}",
        "url": "/",
    })


def notify_new_bill(household_id: str, actor_person_id: str, bill: dict) -> int:
    """Tell the household that a bill was added."""
    return _notify_household(household_id, actor_person_id, bill, "agregó")


# Fields compared to tell a real edit from saving the form unchanged
_VISIBLE_FIELDS = ("category_id", "name", "amount", "date", "note", "split_mode", "fixed")


def notify_bill_updated(household_id: str, actor_person_id: str, before: dict | None, after: dict) -> int:
    """Tell the household a bill was edited. Saving without changes sends nothing."""
    if before is not None:
        changed = [
            f for f in _VISIBLE_FIELDS
            if (float(before[f]) != float(after[f]) if f == "amount" else before.get(f) != after.get(f))
        ]
        if not changed:
            return 0
    body = None
    if before is not None and float(before["amount"]) != float(after["amount"]):
        body = (
            f"{_bill_label(household_id, after)} · "
            f"{fmt_clp(float(before['amount']))} → {fmt_clp(float(after['amount']))}"
        )
    return _notify_household(household_id, actor_person_id, after, "editó", body)


def notify_bill_deleted(household_id: str, actor_person_id: str, bill: dict) -> int:
    """Tell the household that a bill was deleted."""
    return _notify_household(household_id, actor_person_id, bill, "eliminó")


def notify_monthly_closeout(household_id: str, month_key: str, preview: list[dict], total: float) -> int:
    """Send each person their own share. `preview` comes from the email split calculation."""
    if not push_enabled():
        return 0
    mon = month_label(month_key)
    delivered = 0
    for p in preview:
        subs = subs_repo.list_for_person(p["id"], household_id)
        if not subs:
            continue
        delivered += send_to_subscriptions(subs, {
            "title": f"Cierre de {mon}",
            "body": f"Tu parte: {p['amount_fmt']} (total del hogar {fmt_clp(total)})",
            "tag": f"closeout-{month_key}",
            "url": "/",
        })
    return delivered
