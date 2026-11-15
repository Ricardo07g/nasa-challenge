"""Ligação dos relatos da comunidade (tarefa 0047): só com banco, e o sal vem do ambiente.

Nenhum teste aqui conecta no banco: o repository do PostGIS só abre conexão quando consultado.
"""

from collections.abc import Iterator

import pytest

from app import dependencies
from app.config import Settings
from app.repositories.community_report_repository import PostgisCommunityReportRepository

DATABASE_URL = "postgresql://db.invalid/raiz_orbital"


@pytest.fixture(autouse=True)
def _clear_caches() -> Iterator[None]:
    dependencies.get_community_report_repository.cache_clear()
    dependencies.get_community_device_salt.cache_clear()
    yield
    dependencies.get_community_report_repository.cache_clear()
    dependencies.get_community_device_salt.cache_clear()


def _use(monkeypatch: pytest.MonkeyPatch, **values: object) -> None:
    settings = Settings(_env_file=None, **values)  # type: ignore[call-arg]
    monkeypatch.setattr(dependencies, "get_settings", lambda: settings)


def test_without_database_there_is_no_report_repository(monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, database_url="")

    assert dependencies.get_community_report_repository() is None


def test_with_database_reports_go_to_postgis(monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, database_url=DATABASE_URL)

    assert isinstance(
        dependencies.get_community_report_repository(), PostgisCommunityReportRepository
    )


def test_salt_comes_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, community_device_salt="sal-do-servidor")

    assert dependencies.get_community_device_salt() == "sal-do-servidor"


def test_without_salt_a_random_one_is_kept_for_the_whole_process(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _use(monkeypatch, community_device_salt=None)

    first = dependencies.get_community_device_salt()

    assert len(first) == 64
    assert dependencies.get_community_device_salt() == first
    dependencies.get_community_device_salt.cache_clear()
    assert dependencies.get_community_device_salt() != first
