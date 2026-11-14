from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent
# Regras do motor (limiares, pesos e frases) que vão junto com o código.
DEFAULT_REGRAS_PATH = APP_DIR / "config_data" / "regras.yaml"


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente (ou do arquivo .env, que nunca é commitado)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Raiz Orbital API"
    environment: str = "development"
    # Lista separada por vírgula, ex.: CORS_ORIGINS=http://localhost:5173,https://meu-front.vercel.app
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # PostgreSQL + PostGIS. No docker compose: postgresql://<user>:<senha>@db:5432/<banco>
    database_url: str | None = None

    # Dados que a API lê. Os padrões vêm junto com o código (pasta app/), então funcionam no
    # Docker, no uv e nos testes. Para usar outro arquivo, aponte a variável de ambiente.
    culturas_path: Path = APP_DIR / "config_data" / "culturas.yaml"
    regras_path: Path = DEFAULT_REGRAS_PATH
    clima_path: Path = APP_DIR / "fixtures" / "clima_fazenda_exemplo.json"
    # Caches opcionais por ponto (SoilGrids e NDVI do MODIS). Sem arquivo: solo padrão e sem NDVI.
    solo_cache_path: Path | None = None
    ndvi_cache_path: Path | None = None

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
