"""Verify Google ID tokens for Sign in with Google."""

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from coinco_rep.config import settings


class GoogleAuthError(Exception):
    """Raised when a Google ID token is missing, invalid, or incomplete."""


def verify_google_id_token(credential: str) -> dict:
    """Validate a GIS credential and return claims (sub, email, name, …)."""
    if not settings.google_client_id:
        raise GoogleAuthError("Google Sign-In is not configured")
    if not credential or not credential.strip():
        raise GoogleAuthError("Missing Google credential")

    try:
        info = id_token.verify_oauth2_token(
            credential.strip(),
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as exc:
        raise GoogleAuthError("Invalid Google credential") from exc

    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise GoogleAuthError("Invalid token issuer")

    email = (info.get("email") or "").strip().lower()
    if not email:
        raise GoogleAuthError("Google account has no email")
    if not info.get("email_verified"):
        raise GoogleAuthError("Google email is not verified")

    sub = info.get("sub")
    if not sub:
        raise GoogleAuthError("Google account has no subject")

    return {
        "sub": sub,
        "email": email,
        "name": (info.get("name") or "").strip(),
        "picture": info.get("picture"),
    }
