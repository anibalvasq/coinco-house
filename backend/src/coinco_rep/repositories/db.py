"""Supabase client singleton."""
from functools import lru_cache

from supabase import Client, create_client

from coinco_rep.config import settings


@lru_cache(maxsize=1)
def get_db() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
