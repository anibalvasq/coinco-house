
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.auth.service import hash_pin
from coinco_rep.repositories import people as repo

router = APIRouter(prefix="/people", tags=["people"])


class PersonCreate(BaseModel):
    name: str
    color: str
    pin: str  # 4-digit plain PIN, will be hashed


class PersonUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    pin: str | None = None  # if provided, will be hashed


def _sanitize_pin(pin: str) -> str:
    digits = "".join(c for c in pin if c.isdigit())[:4]
    return digits.zfill(4)


def _public(person: dict) -> dict:
    return {k: v for k, v in person.items() if k != "pin_hash"}


@router.get("")
def list_people():
    # Public on purpose: the login screen needs to render the profile picker
    # (name + color only, never pin_hash) before a session exists. This app is
    # single-household per deployment, so settings.household_id is safe here.
    from coinco_rep.config import settings

    people = repo.list_people(settings.household_id)
    return [_public(p) for p in people]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_person(body: PersonCreate, session: dict = Depends(get_current_session)):
    pin = _sanitize_pin(body.pin)
    pin_hash = hash_pin(pin)
    person = repo.create_person(session["household_id"], body.name, body.color, pin_hash)
    return _public(person)


@router.patch("/{person_id}")
def update_person(person_id: str, body: PersonUpdate, session: dict = Depends(get_current_session)):
    fields: dict = {}
    if body.name is not None:
        fields["name"] = body.name
    if body.color is not None:
        fields["color"] = body.color
    if body.pin is not None:
        fields["pin_hash"] = hash_pin(_sanitize_pin(body.pin))
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    person = repo.update_person(person_id, session["household_id"], **fields)
    return _public(person)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person(person_id: str, session: dict = Depends(get_current_session)):
    count = repo.count_people(session["household_id"])
    if count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last person in the household")
    repo.delete_person(person_id, session["household_id"])
