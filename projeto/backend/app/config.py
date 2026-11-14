from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente (ou do arquivo .env, que nunca é commitado)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Raiz Orbital API"
    environment: str = "development"
    # Lista separada por vírgula, ex.: CORS_ORIGINS=http://localhost:5173,https://meu-front.vercel.app
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # Credenciais dos dados da NASA / Google. Só via ambiente, nunca no código.
    earthdata_username: str | None = None
    earthdata_password: str | None = None
    ee_project: str | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
