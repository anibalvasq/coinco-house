from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from coinco_rep.auth.dependencies import get_current_session
from coinco_rep.config import settings
from coinco_rep.push import push_enabled, send_to_subscriptions
from coinco_rep.repositories import push_subscriptions as subs_repo

router = APIRouter(prefix="/push", tags=["push"])


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    # Shape of PushSubscription.toJSON() in the browser
    endpoint: str
    keys: SubscriptionKeys


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/public-key")
def public_key():
    return {"enabled": push_enabled(), "public_key": settings.vapid_public_key or None}


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def subscribe(body: SubscribeRequest, session: dict = Depends(get_current_session)):
    if not push_enabled():
        raise HTTPException(status_code=503, detail="Notificaciones no configuradas")
    if not body.endpoint.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid endpoint")
    subs_repo.upsert_subscription(
        session["household_id"], session["person_id"], body.endpoint, body.keys.p256dh, body.keys.auth
    )


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(body: UnsubscribeRequest, session: dict = Depends(get_current_session)):
    subs_repo.delete_subscription(body.endpoint, session["household_id"])


@router.post("/test")
def send_test(session: dict = Depends(get_current_session)):
    """Send a test notification to the current person's devices."""
    subs = subs_repo.list_for_person(session["person_id"], session["household_id"])
    delivered = send_to_subscriptions(subs, {
        "title": "CoinCo House",
        "body": "Las notificaciones están activadas ✅",
        "tag": "test",
        "url": "/",
    })
    return {"delivered": delivered}
