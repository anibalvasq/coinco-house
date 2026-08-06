from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.auth.google import GoogleAuthError, verify_google_id_token
from coinco_rep.auth.service import create_session_token, verify_pin
from coinco_rep.repositories import people as people_repo

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    person_id: str
    pin: str


class GoogleLoginRequest(BaseModel):
    credential: str


def _set_session_cookie(response: Response, person_id: str, household_id: str) -> None:
    from coinco_rep.config import settings

    token = create_session_token(person_id, household_id)
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        samesite=settings.cookie_samesite,
        secure=settings.cookie_secure,
        max_age=settings.jwt_expire_hours * 3600,
        path="/",
    )


def _person_session(person: dict) -> dict:
    return {"id": person["id"], "name": person["name"], "color": person["color"]}


@router.get("/providers")
def providers():
    """Public: which login methods the frontend should show."""
    from coinco_rep.config import settings

    enabled = bool(settings.google_client_id.strip())
    return {
        "google": {
            "enabled": enabled,
            "client_id": settings.google_client_id.strip() if enabled else None,
        }
    }


@router.post("/login")
def login(body: LoginRequest, response: Response):
    from coinco_rep.config import settings

    person = people_repo.get_person(body.person_id, settings.household_id)
    if not person:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Person not found")
    if not verify_pin(body.pin, person["pin_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="PIN incorrecto")
    _set_session_cookie(response, person["id"], settings.household_id)
    return _person_session(person)


@router.post("/google")
def google_login(body: GoogleLoginRequest, response: Response):
    """Exchange a Google ID token for the same session cookie as PIN login."""
    from coinco_rep.config import settings

    try:
        claims = verify_google_id_token(body.credential)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    household_id = settings.household_id
    person = people_repo.get_person_by_google_sub(claims["sub"], household_id)
    if not person:
        person = people_repo.get_person_by_email(claims["email"], household_id)
        if person and not person.get("google_sub"):
            person = people_repo.update_person(
                person["id"], household_id, google_sub=claims["sub"]
            )

    if not person:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "No hay una persona con ese Gmail en este hogar. "
                "Pídele a alguien que agregue tu email en Personas."
            ),
        )

    if person.get("google_sub") and person["google_sub"] != claims["sub"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Este email ya está vinculado a otra cuenta de Google",
        )

    _set_session_cookie(response, person["id"], household_id)
    return _person_session(person)


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
    return _person_session(person)
