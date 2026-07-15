
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.domain.formatting import current_month_key
from coinco_rep.repositories import bills as repo

router = APIRouter(prefix="/bills", tags=["bills"])


class BillCreate(BaseModel):
    category_id: str
    name: str = ""
    amount: float
    date: str  # YYYY-MM-DD
    note: str = ""
    split_mode: str = "proportional"  # "proportional" | "equal"
    fixed: bool = False


class BillUpdate(BaseModel):
    category_id: str | None = None
    name: str | None = None
    amount: float | None = None
    date: str | None = None
    note: str | None = None
    split_mode: str | None = None
    fixed: bool | None = None


@router.get("")
def list_bills(
    month: str = Query(default=""),
    session: dict = Depends(get_current_session),
):
    month_key = month or current_month_key()
    return repo.list_bills(session["household_id"], month_key)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_bill(
    body: BillCreate,
    month: str = Query(default=""),
    session: dict = Depends(get_current_session),
):
    month_key = month or current_month_key()
    return repo.create_bill(
        session["household_id"],
        month_key,
        body.category_id,
        body.name,
        body.amount,
        body.date,
        body.note,
        body.split_mode,
        body.fixed,
    )


@router.patch("/{bill_id}")
def update_bill(
    bill_id: str,
    body: BillUpdate,
    session: dict = Depends(get_current_session),
):
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    return repo.update_bill(bill_id, session["household_id"], **fields)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(bill_id: str, session: dict = Depends(get_current_session)):
    repo.delete_bill(bill_id, session["household_id"])
