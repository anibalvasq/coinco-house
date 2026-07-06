from fastapi import APIRouter, Depends, Query

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.domain.formatting import current_month_key, fmt_clp, format_date_short
from coinco_rep.domain.split import BillInput, PersonInput, compute_split
from coinco_rep.repositories import bills as bills_repo
from coinco_rep.repositories import categories as cat_repo
from coinco_rep.repositories import households as hh_repo
from coinco_rep.repositories import people as people_repo
from coinco_rep.repositories import stays as stays_repo

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(
    month: str = Query(default=""),
    session: dict = Depends(get_current_session),
):
    household_id = session["household_id"]
    month_key = month or current_month_key()

    household = hh_repo.get_household(household_id) or {}
    rounding = household.get("split_rounding", "exact")

    all_people = people_repo.list_people(household_id)
    raw_bills = bills_repo.list_bills(household_id, month_key)
    stays = stays_repo.get_stays(household_id, month_key)
    categories = {c["id"]: c for c in cat_repo.list_categories(household_id)}

    has_bills = len(raw_bills) > 0
    total_amount = sum(float(b["amount"]) for b in raw_bills)

    people = [PersonInput(id=p["id"], name=p["name"], color=p["color"], days=stays.get(p["id"], 0)) for p in all_people]
    bills = [
        BillInput(
            id=b["id"],
            category_name=categories.get(b["category_id"], {}).get("name", ""),
            name=b["name"],
            amount=float(b["amount"]),
            date=b["date"],
            split_mode=b.get("split_mode", "proportional"),
        )
        for b in raw_bills
    ]

    split = compute_split(people, bills, stays, rounding)

    split_preview = [
        {
            "id": p.id,
            "name": p.name,
            "color": p.color,
            "amount": p.amount,
            "amount_fmt": fmt_clp(p.amount),
            "pct": round(p.pct * 100, 1),
        }
        for p in split.per_person
    ]

    recent_bills = [
        {
            "id": b["id"],
            "name": b["name"] or categories.get(b["category_id"], {}).get("name", ""),
            "category_name": categories.get(b["category_id"], {}).get("name", ""),
            "amount": float(b["amount"]),
            "amount_fmt": fmt_clp(float(b["amount"])),
            "date": b["date"],
            "date_label": format_date_short(b["date"]),
        }
        for b in raw_bills[:3]
    ]

    bills_count = len(raw_bills)
    bills_count_label = f"{bills_count} cuenta{'s' if bills_count != 1 else ''}"

    return {
        "month_key": month_key,
        "has_bills": has_bills,
        "total_amount": total_amount,
        "total_amount_fmt": fmt_clp(total_amount),
        "bills_count": bills_count,
        "bills_count_label": bills_count_label,
        "split_preview": split_preview,
        "equal_split_warning": split.equal_split_warning,
        "recent_bills": recent_bills,
    }
