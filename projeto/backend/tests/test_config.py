import pytest

from app.config import Settings


def test_cors_origins_default() -> None:
    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["http://localhost:5173"]


def test_cors_origins_from_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173, https://exemplo.vercel.app")

    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["http://localhost:5173", "https://exemplo.vercel.app"]
