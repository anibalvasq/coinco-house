from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.domain.formatting import current_month_key
from coinco_rep.repositories import stays as repo

router = APIRouter(prefix="/stays", tags=["stays"])


class StaysUpdate(BaseModel):
    stays: dict[str, int]  # {person_id: days}


@router.get("")
def get_stays(
    month: str = Query(default=""),
    session: dict = Depends(get_current_session),
):
    month_key = month or current_month_key()
    return repo.get_stays(session["household_id"], month_key)


@router.put("")
def update_stays(
    body: StaysUpdate,
    month: str = Query(default=""),
    session: dict = Depends(get_current_session),
):
    month_key = month or current_month_key()
    repo.bulk_upsert_stays(session["household_id"], month_key, body.stays)
    return repo.get_stays(session["household_id"], month_key)
