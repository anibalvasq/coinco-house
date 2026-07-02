from fastapi import APIRouter, Depends, Query

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.domain.formatting import current_month_key, fmt_clp
from coinco_rep.domain.split import BillInput, PersonInput, compute_split
from coinco_rep.repositories import bills as bills_repo
from coinco_rep.repositories import categories as cat_repo
from coinco_rep.repositories import households as hh_repo
from coinco_rep.repositories import people as people_repo
from coinco_rep.repositories import stays as stays_repo

router = APIRouter(prefix="/split", tags=["split"])


def _build_split_response(household_id: str, month_key: str):
    household = hh_repo.get_household(household_id) or {}
    rounding = household.get("split_rounding", "exact")

    all_people = people_repo.list_people(household_id)
    raw_bills = bills_repo.list_bills(household_id, month_key)
    stays = stays_repo.get_stays(household_id, month_key)
    categories = {c["id"]: c for c in cat_repo.list_categories(household_id)}

    people = [PersonInput(id=p["id"], name=p["name"], color=p["color"], days=stays.get(p["id"], 0)) for p in all_people]
    bills = [
        BillInput(
            id=b["id"],
            category_name=categories.get(b["category_id"], {}).get("name", ""),
            name=b["name"],
            amount=float(b["amount"]),
            date=b["date"],
        )
        for b in raw_bills
    ]

    result = compute_split(people, bills, stays, rounding)

    return {
        "month_key": month_key,
        "total_amount": result.total_amount,
        "total_amount_fmt": fmt_clp(result.total_amount),
        "total_days": result.total_days,
        "equal_split_warning": result.equal_split_warning,
        "per_person": [
            {
                "id": p.id,
                "name": p.name,
                "color": p.color,
                "days": p.days,
                "pct": round(p.pct * 100, 1),
                "amount": p.amount,
                "amount_fmt": fmt_clp(p.amount),
            }
            for p in result.per_person
        ],
        "bill_details": [
            {
                "id": b.id,
                "name": b.name,
                "category_name": b.category_name,
                "amount": b.amount,
                "amount_fmt": fmt_clp(b.amount),
                "per_person": [
                    {**pp, "amount_fmt": fmt_clp(pp["amount"])}
                    for pp in b.per_person
                ],
            }
            for b in result.bill_details
        ],
    }


@router.get("")
def get_split(
    month: str = Query(default=""),
    session: dict = Depends(get_current_session),
):
    month_key = month or current_month_key()
    return _build_split_response(session["household_id"], month_key)
