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
    # Deltas mensais do NEX-GDDP-CMIP6 por célula do POWER (saída do
    # pipeline/fetch_cmip6_deltas.py). Sem arquivo: a nota de futuro fica de fora (`futuro: null`),
    # a não ser que o banco tenha os deltas da célula (tabela `cmip6_delta`).
    cmip6_path: Path | None = None
    # Fase do El Niño / La Niña de cada safrinha pelo ONI da NOAA (saída do pipeline/fetch_oni.py).
    # Sem arquivo: o detalhe de cada ano (P1) sai com `enso: null`.
    oni_path: Path | None = None
    # Região pelo satélite (P3): percentuais da lavoura parada na entressafra num raio em volta
    # de um ponto (saída do pipeline/fetch_regiao_ndvi.py). Sem arquivo: /api/regiao responde
    # 404 OUTSIDE_AREA.
    regiao_path: Path | None = None
    # Chuva dos últimos 30 dias por célula de 0,1° pelo IMERG Late, com a média dos mesmos dias
    # (saída do pipeline/fetch_imerg_late.py, A2.3). Sem arquivo: o sinal para o outono fica sem
    # o dado da terra agora.
    imerg_late_path: Path | None = None
    # Umidade do SMAP L4 nos dias de semeadura por célula de 0,1° (saída do pipeline/fetch_smap.py).
    # Sem arquivo (e sem linhas na tabela `smap_point`): o balde começa em 50% da CAD (PRD 7.2).
    smap_path: Path | None = None
    # SMAP recente com o percentil na climatologia (saída do pipeline/fetch_smap.py --recente),
    # para o sinal para o outono (A2.2). Sem arquivo: sem o dado da terra agora.
    smap_recente_path: Path | None = None
    # Pico do NDVI do MODIS de cada pixel de 250 m na safra mais recente (saída do
    # pipeline/fetch_soja_recente.py, RF-24): a checagem da soja no começo do fluxo. Sem arquivo:
    # o /talhao responde soja_recente: null e o front não avisa.
    soja_recente_path: Path | None = None

    # Credenciais dos dados da NASA. Só via ambiente, nunca no código. Só os scripts de dados
    # usam; a API não precisa de nenhuma (ADR-0005).
    # Token da Earthdata Login (urs.earthdata.nasa.gov, vale 60 dias): NSIDC (SMAP) e GES DISC
    # (IMERG). O AppEEARS recusa esse token.
    earthdata_token: str | None = None
    # Token do AppEEARS (POST /api/login, vale cerca de 48 h). Sem ele, o script de dados faz o
    # login com o usuário e a senha da Earthdata.
    appeears_token: str | None = None
    earthdata_username: str | None = None
    earthdata_password: str | None = None
    # Legado: projeto do Google Earth Engine (fora do MVP). Sai quando a ADR-0005 for aceita.
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
