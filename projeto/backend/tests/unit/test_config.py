import pytest

from app.config import Settings


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Isola os testes das variáveis reais da máquina ou do container."""
    for name in ("CORS_ORIGINS", "DATABASE_URL"):
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
