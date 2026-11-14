from pathlib import Path

import pytest

from app.config import Settings

DATA_ENV_VARS = (
    "CULTURAS_PATH",
    "REGRAS_PATH",
    "CLIMA_PATH",
    "SOLO_CACHE_PATH",
    "NDVI_CACHE_PATH",
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Isola os testes das variáveis reais da máquina ou do container."""
    for name in ("CORS_ORIGINS", "DATABASE_URL", *DATA_ENV_VARS):
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


def test_rules_path_defaults_to_file_shipped_with_the_app() -> None:
    settings = Settings(_env_file=None)
    app_dir = Path(__file__).resolve().parents[2] / "app"

    assert settings.regras_path == app_dir / "config_data" / "regras.yaml"
    assert settings.regras_path.is_file()


def test_rules_path_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("REGRAS_PATH", str(tmp_path / "regras.yaml"))

    settings = Settings(_env_file=None)

    assert settings.regras_path == tmp_path / "regras.yaml"
