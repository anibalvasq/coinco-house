"""
Vercel Cron Job endpoints.

Vercel calls these HTTP endpoints on the configured schedule and sends
  Authorization: Bearer <CRON_SECRET>
in the request header. We verify the secret before executing any work.

Schedules are declared in vercel.json under the "crons" key.
"""
from fastapi import APIRouter, Header, HTTPException, status

from coinco_rep.config import settings
from coinco_rep.email_reports import send_monthly_closeout, send_weekly_summary

router = APIRouter(prefix="/cron", tags=["cron"])


def _verify(authorization: str | None) -> None:
    """Raise 401 if the bearer token does not match CRON_SECRET."""
    if not settings.cron_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CRON_SECRET not configured",
        )
    expected = f"Bearer {settings.cron_secret}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )


@router.get("/weekly")
def run_weekly(authorization: str | None = Header(default=None)):
    """Weekly summary email — runs every Sunday at 18:00 UTC."""
    _verify(authorization)
    if not settings.household_id:
        raise HTTPException(status_code=500, detail="HOUSEHOLD_ID not set")
    sent = send_weekly_summary(settings.household_id)
    return {"status": "ok", "sent_to": sent, "count": len(sent)}


@router.get("/monthly")
def run_monthly(authorization: str | None = Header(default=None)):
    """Monthly close-out email — runs daily, skips unless it is the last day of the month."""
    _verify(authorization)
    if not settings.household_id:
        raise HTTPException(status_code=500, detail="HOUSEHOLD_ID not set")
    sent = send_monthly_closeout(settings.household_id)
    return {"status": "ok", "sent_to": sent, "count": len(sent)}
