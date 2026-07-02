from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.repositories import categories as repo

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str


@router.get("")
def list_categories(session: dict = Depends(get_current_session)):
    return repo.list_categories(session["household_id"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryCreate, session: dict = Depends(get_current_session)):
    return repo.create_category(session["household_id"], body.name)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: str, session: dict = Depends(get_current_session)):
    repo.delete_category(category_id, session["household_id"])
