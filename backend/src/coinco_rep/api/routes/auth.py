from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.auth.service import create_session_token, verify_pin
from coinco_rep.repositories import people as people_repo

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    person_id: str
    pin: str


@router.post("/login")
def login(body: LoginRequest, response: Response):
    from coinco_rep.config import settings
    person = people_repo.get_person(body.person_id, settings.household_id)
    if not person:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Person not found")
    if not verify_pin(body.pin, person["pin_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="PIN incorrecto")
    token = create_session_token(person["id"], settings.household_id)
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # set True in prod via env check
        max_age=72 * 3600,
        path="/",
    )
    return {"id": person["id"], "name": person["name"], "color": person["color"]}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("session", path="/")
    return {"ok": True}


@router.get("/me")
def me(session: dict = Depends(get_current_session)):
    from coinco_rep.config import settings
    person = people_repo.get_person(session["person_id"], settings.household_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return {"id": person["id"], "name": person["name"], "color": person["color"]}
