from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from coinco_rep.api.routes import (
    auth,
    bills,
    categories,
    cron,
    dashboard,
    history,
    people,
    split,
    stays,
)
from coinco_rep.config import settings

app = FastAPI(title="Hogar Compartido API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


for router in [
    auth.router,
    people.router,
    categories.router,
    bills.router,
    stays.router,
    split.router,
    dashboard.router,
    history.router,
    cron.router,
]:
    app.include_router(router, prefix="/api/v1")
