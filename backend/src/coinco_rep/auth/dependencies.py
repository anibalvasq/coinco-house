"""FastAPI dependency for authenticated requests."""

from fastapi import Cookie, HTTPException, status

from coinco_rep.auth.service import decode_session_token


def get_current_session(session: str | None = Cookie(default=None)) -> dict:
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_session_token(session)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    return {"person_id": payload["sub"], "household_id": payload["household_id"]}
