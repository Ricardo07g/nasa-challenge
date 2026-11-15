from pathlib import Path

import pytest

from app.config import Settings

DATA_ENV_VARS = (
    "CULTURAS_PATH",
    "REGRAS_PATH",
    "CLIMA_PATH",
    "SOLO_CACHE_PATH",
    "NDVI_CACHE_PATH",
    "CMIP6_PATH",
    "ONI_PATH",
    "REGIAO_PATH",
    "IMERG_LATE_PATH",
    "SMAP_PATH",
    "SMAP_RECENTE_PATH",
    "SOJA_RECENTE_PATH",
)
CREDENTIAL_ENV_VARS = (
    "EARTHDATA_TOKEN",
    "APPEEARS_TOKEN",
    "EARTHDATA_USERNAME",
    "EARTHDATA_PASSWORD",
    "EE_PROJECT",
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Isola os testes das variáveis reais da máquina ou do container."""
    for name in ("CORS_ORIGINS", "DATABASE_URL", *DATA_ENV_VARS, *CREDENTIAL_ENV_VARS):
        monkeypatch.delenv(name, raising=False)


def test_cors_origins_default() -> None:
    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["http://localhost:5173"]


def test_database_url_defaults_to_none() -> None:
    settings = Settings(_env_file=None)

    assert settings.database_url is None


def test_database_url_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    url = "postgresql://usuario:senha@db:5432/raiz_orbital"
    monkeypatch.setenv("DATABASE_URL", url)

    settings = Settings(_env_file=None)

    assert settings.database_url == url


def test_cors_origins_from_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173, https://exemplo.vercel.app")

    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["http://localhost:5173", "https://exemplo.vercel.app"]


def test_data_paths_default_to_files_shipped_with_the_app() -> None:
    settings = Settings(_env_file=None)
    app_dir = Path(__file__).resolve().parents[2] / "app"

    assert settings.culturas_path == app_dir / "config_data" / "culturas.yaml"
    assert settings.clima_path == app_dir / "fixtures" / "clima_fazenda_exemplo.json"
    assert settings.culturas_path.is_file()
    assert settings.clima_path.is_file()
    assert settings.solo_cache_path is None
    assert settings.ndvi_cache_path is None


def test_data_paths_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("CLIMA_PATH", str(tmp_path / "clima.json"))
    monkeypatch.setenv("NDVI_CACHE_PATH", str(tmp_path / "ndvi.json"))

    settings = Settings(_env_file=None)

    assert settings.clima_path == tmp_path / "clima.json"
    assert settings.ndvi_cache_path == tmp_path / "ndvi.json"


def test_cmip6_path_defaults_to_none_so_there_is_no_future_without_the_file() -> None:
    # Sem o arquivo dos deltas do NEX-GDDP-CMIP6, a API responde `futuro: null` (nada inventado).
    settings = Settings(_env_file=None)

    assert settings.cmip6_path is None


def test_cmip6_path_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("CMIP6_PATH", str(tmp_path / "cmip6.json"))

    settings = Settings(_env_file=None)

    assert settings.cmip6_path == tmp_path / "cmip6.json"


def test_regiao_path_defaults_to_none_so_there_is_no_region_without_the_file() -> None:
    # Sem o arquivo da região pelo satélite (P3), /api/regiao responde 404 OUTSIDE_AREA.
    settings = Settings(_env_file=None)

    assert settings.regiao_path is None


def test_regiao_path_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("REGIAO_PATH", str(tmp_path / "regiao.json"))

    settings = Settings(_env_file=None)

    assert settings.regiao_path == tmp_path / "regiao.json"


def test_imerg_late_path_defaults_to_none_so_there_is_no_recent_rain_without_the_file() -> None:
    # Sem o arquivo da chuva recente (IMERG Late, A2.3), o sinal para o outono fica sem a terra.
    settings = Settings(_env_file=None)

    assert settings.imerg_late_path is None


def test_imerg_late_path_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("IMERG_LATE_PATH", str(tmp_path / "chuva_30d.json"))

    settings = Settings(_env_file=None)

    assert settings.imerg_late_path == tmp_path / "chuva_30d.json"


def test_smap_path_defaults_to_none_so_the_bucket_starts_at_half_without_the_file() -> None:
    # Sem o arquivo do SMAP (e sem a tabela smap_point), o balde começa em 50% da CAD (PRD 7.2).
    assert Settings(_env_file=None).smap_path is None


def test_smap_path_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("SMAP_PATH", str(tmp_path / "smap.json"))

    assert Settings(_env_file=None).smap_path == tmp_path / "smap.json"


def test_smap_recente_path_defaults_to_none_so_there_is_no_soil_signal_without_the_file() -> None:
    assert Settings(_env_file=None).smap_recente_path is None


def test_smap_recente_path_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("SMAP_RECENTE_PATH", str(tmp_path / "smap_recente.json"))

    assert Settings(_env_file=None).smap_recente_path == tmp_path / "smap_recente.json"


def test_soja_recente_path_defaults_to_none_so_there_is_no_soybean_check_without_the_file() -> None:
    # Sem o arquivo da soja recente (RF-24), o /talhao responde soja_recente: null (nenhum aviso).
    assert Settings(_env_file=None).soja_recente_path is None


def test_soja_recente_path_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("SOJA_RECENTE_PATH", str(tmp_path / "soja_recente_2026.json"))

    assert Settings(_env_file=None).soja_recente_path == tmp_path / "soja_recente_2026.json"


def test_rules_path_defaults_to_file_shipped_with_the_app() -> None:
    settings = Settings(_env_file=None)
    app_dir = Path(__file__).resolve().parents[2] / "app"

    assert settings.regras_path == app_dir / "config_data" / "regras.yaml"
    assert settings.regras_path.is_file()


def test_rules_path_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("REGRAS_PATH", str(tmp_path / "regras.yaml"))

    settings = Settings(_env_file=None)

    assert settings.regras_path == tmp_path / "regras.yaml"


def test_earthdata_token_defaults_to_none() -> None:
    # A API não precisa de credencial da NASA: só os scripts de dados usam o token.
    settings = Settings(_env_file=None)

    assert settings.earthdata_token is None


def test_earthdata_token_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EARTHDATA_TOKEN", "token-de-teste")

    settings = Settings(_env_file=None)

    assert settings.earthdata_token == "token-de-teste"


def test_appeears_token_defaults_to_none() -> None:
    # O AppEEARS recusa o token da Earthdata: ele tem o próprio, que só os scripts de dados usam.
    settings = Settings(_env_file=None)

    assert settings.appeears_token is None


def test_appeears_token_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APPEEARS_TOKEN", "token-de-teste")

    settings = Settings(_env_file=None)

    assert settings.appeears_token == "token-de-teste"


def test_oni_path_defaults_to_none_and_comes_from_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # P1: sem o arquivo do ONI da NOAA, o detalhe de cada ano sai com `enso: null`
    assert Settings(_env_file=None).oni_path is None

    monkeypatch.setenv("ONI_PATH", str(tmp_path / "oni.json"))

    assert Settings(_env_file=None).oni_path == tmp_path / "oni.json"


def test_enso_previsao_path_defaults_to_none_and_comes_from_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # Tarefa 0038: sem o arquivo da previsão do ENSO, o sinal para o outono sai nulo
    assert Settings(_env_file=None).enso_previsao_path is None

    monkeypatch.setenv("ENSO_PREVISAO_PATH", str(tmp_path / "enso_previsao.json"))

    assert Settings(_env_file=None).enso_previsao_path == tmp_path / "enso_previsao.json"
