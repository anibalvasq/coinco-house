from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_expire_hours: int = 72
    household_id: str = ""
    cors_origins: str = "http://localhost:5173,http://localhost:4173"
    resend_api_key: str = ""
    from_email: str = "CoinCo House <onboarding@resend.dev>"
    cron_secret: str = ""  # must match CRON_SECRET in Vercel env vars
    cookie_secure: bool = False
    cookie_samesite: str = "lax"  # lax | none | strict — use "none" + secure for bundled iOS

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
