from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app

client = TestClient(app)


@pytest.fixture
def settings_override() -> Iterator[None]:
    yield
    app.dependency_overrides.pop(get_settings, None)


def test_health_returns_ok_and_local_commit_without_deploy(settings_override: None) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "commit": "local"}


def test_health_returns_the_deployed_commit(settings_override: None) -> None:
    # No deploy, o CI grava COMMIT_SHA na Railway antes do railway up
    # (.github/scripts/railway-deploy.sh).
    commit = "8c701db0a1b2c3d4e5f60718293a4b5c6d7e8f90"
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None, commit_sha=commit)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "commit": commit}
