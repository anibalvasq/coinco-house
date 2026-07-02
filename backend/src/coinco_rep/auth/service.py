"""PIN verification and JWT session management."""
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from coinco_rep.config import settings


def hash_pin(pin: str) -> str:
    """Hash a 4-digit PIN with bcrypt."""
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def verify_pin(pin: str, pin_hash: str) -> bool:
    """Compare a plain PIN against its stored bcrypt hash."""
    try:
        return bcrypt.checkpw(pin.encode(), pin_hash.encode())
    except Exception:
        return False


def create_session_token(person_id: str, household_id: str) -> str:
    payload = {
        "sub": person_id,
        "household_id": household_id,
        "exp": datetime.now(UTC) + timedelta(hours=settings.jwt_expire_hours),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_session_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
