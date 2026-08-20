from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "客户订单中心"
    database_url: str = "sqlite:///./customer_orders.db"
    cors_origins: str = "http://localhost:5173"
    current_operator: str = "本地管理员"
    seed_demo: bool = False
    secret_key: str = "khzx-dev-secret-change-in-production-2026"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
