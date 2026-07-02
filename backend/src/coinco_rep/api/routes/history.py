from fastapi import APIRouter, Depends

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.domain.formatting import fmt_clp, month_label
from coinco_rep.repositories import bills as bills_repo

router = APIRouter(prefix="/history", tags=["history"])


@router.get("")
def get_history(session: dict = Depends(get_current_session)):
    household_id = session["household_id"]
    month_keys = bills_repo.list_months_with_bills(household_id)

    rows = []
    for key in month_keys:
        month_bills = bills_repo.list_bills(household_id, key)
        total = sum(float(b["amount"]) for b in month_bills)
        rows.append({
            "month_key": key,
            "month_label": month_label(key),
            "bills_count": len(month_bills),
            "total_amount": total,
            "total_amount_fmt": fmt_clp(total),
        })
    return rows
