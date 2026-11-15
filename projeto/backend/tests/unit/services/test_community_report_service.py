"""Relatos da comunidade (seção 7 da remodelagem, tarefa 0047), com repository falso."""

import re
import uuid
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest

from app.models.community_report import ReportSubmission
from app.repositories.climate_repository import cell_id_for
from app.repositories.rules_repository import load_default_rules
from app.services.community_report_service import (
    CommunityReportService,
    cells_within_radius,
    hash_device_id,
)
from app.services.errors import (
    CommunityUnavailableError,
    NotFoundError,
    TooManyReportsError,
    ValidationDomainError,
)
from app.services.region_service import distance_m
from tests.community_fakes import CROP_IDS, FakeCropRepository, FakeReportRepository

# 15/11/2026 às 12:00 em Uberlândia (UTC-3).
NOW = datetime(2026, 11, 15, 15, 0, tzinfo=UTC)
TODAY = date(2026, 11, 15)
SALT = "sal-de-teste"
DEVICE = "a1b2c3d4-e5f6-4789-8abc-def012345678"
OTHER_DEVICE = "ffffffff-e5f6-4789-8abc-def012345678"
FARM = (-18.9543, -48.1993)


def _service(
    repository: FakeReportRepository | None = None, now: datetime = NOW
) -> CommunityReportService:
    return CommunityReportService(
        repository=FakeReportRepository() if repository is None else repository,
        crop_repo=FakeCropRepository(),
        rules=load_default_rules(),
        salt=SALT,
        now=lambda: now,
    )


def _rain(mm: object = 32, day: date | None = TODAY, **changes: object) -> ReportSubmission:
    submission = ReportSubmission(
        tipo="chuva",
        subtipo=None,
        valores={"mm": mm},
        lat=FARM[0],
        lon=FARM[1],
        data_fato=day,
        device_id=DEVICE,
    )
    return replace(submission, **changes)


def _event(subtipo: str = "fogo", **changes: object) -> ReportSubmission:
    submission = ReportSubmission(
        tipo="evento",
        subtipo=subtipo,
        valores={},
        lat=FARM[0],
        lon=FARM[1],
        data_fato=TODAY,
        device_id=DEVICE,
    )
    return replace(submission, **changes)


def _planting(
    subtipo: str = "milho_safrinha", valores: dict[str, object] | None = None, **changes: object
) -> ReportSubmission:
    submission = ReportSubmission(
        tipo="plantio",
        subtipo=subtipo,
        valores={"ano": 2026, "resultado": "bem"} if valores is None else valores,
        lat=FARM[0],
        lon=FARM[1],
        data_fato=None,
        device_id=DEVICE,
    )
    return replace(submission, **changes)


# --- hash do aparelho ------------------------------------------------------------------------


def test_device_hash_is_sha256_hex_with_the_salt_and_never_the_raw_id() -> None:
    digest = hash_device_id(DEVICE, SALT)

    assert re.fullmatch(r"[0-9a-f]{64}", digest)
    assert DEVICE not in digest
    assert digest == hash_device_id(DEVICE, SALT)
    assert digest != hash_device_id(DEVICE, "outro-sal")
    assert digest != hash_device_id(OTHER_DEVICE, SALT)


# --- enviar ----------------------------------------------------------------------------------


def test_rain_report_keeps_only_the_cell_never_the_exact_point() -> None:
    repository = FakeReportRepository()

    report = _service(repository).submit(_rain(mm=32.46))

    stored = repository.reports[0]
    assert stored.celula == cell_id_for(*FARM) == "-190_-482"
    assert stored.valores == {"mm": 32.5}
    assert stored.data_fato == TODAY
    assert stored.enviado_em == NOW
    assert stored.device_hash == hash_device_id(DEVICE, SALT)
    assert report.id == stored.id
    # A resposta é a do vizinho: o centro da célula, sem o hash do aparelho, marcada como minha.
    assert (report.lat, report.lon, report.meu) == (-18.95, -48.15, True)
    assert not hasattr(report, "device_hash")
    # Nada da coordenada exata no que foi guardado.
    assert "-18.9543" not in repr(stored)
    assert "-48.1993" not in repr(stored)


@pytest.mark.parametrize("mm", [0, 0.0, 300, 125.5])
def test_rain_accepts_zero_to_300_mm(mm: float) -> None:
    assert _service().submit(_rain(mm=mm)).valores == {"mm": float(mm)}


@pytest.mark.parametrize("mm", [-0.1, 300.1, "32", True, None, float("nan"), float("inf")])
def test_rain_refuses_values_outside_0_to_300_mm_or_not_numbers(mm: object) -> None:
    with pytest.raises(ValidationDomainError, match="mm"):
        _service().submit(_rain(mm=mm))


def test_rain_refuses_extra_fields_so_no_free_text_gets_in() -> None:
    with pytest.raises(ValidationDomainError, match="nota"):
        _service().submit(_rain(valores={"mm": 10, "nota": "meu nome é Zé"}))


def test_rain_refuses_a_subtype() -> None:
    with pytest.raises(ValidationDomainError, match="subtipo"):
        _service().submit(_rain(subtipo="forte"))


def test_rain_and_event_need_the_date() -> None:
    with pytest.raises(ValidationDomainError, match="data"):
        _service().submit(_rain(day=None))
    with pytest.raises(ValidationDomainError, match="data"):
        _service().submit(_event(data_fato=None))


def test_dates_cannot_be_in_the_future() -> None:
    with pytest.raises(ValidationDomainError, match="futura"):
        _service().submit(_rain(day=TODAY + timedelta(days=1)))
    with pytest.raises(ValidationDomainError, match="futura"):
        _service().submit(_event(data_fato=TODAY + timedelta(days=1)))


def test_dates_go_back_at_most_30_days() -> None:
    service = _service()

    assert service.submit(_rain(day=TODAY - timedelta(days=30))).data_fato == date(2026, 10, 16)
    with pytest.raises(ValidationDomainError, match="30 dias"):
        service.submit(_rain(day=TODAY - timedelta(days=31)))
    with pytest.raises(ValidationDomainError, match="30 dias"):
        service.submit(_event(data_fato=TODAY - timedelta(days=31)))


def test_today_is_the_day_in_brazil_not_in_utc() -> None:
    # 16/11 às 02:00 UTC ainda é 15/11 às 23:00 em Uberlândia: o dia 16 é futuro.
    late_night = datetime(2026, 11, 16, 2, 0, tzinfo=UTC)
    service = _service(now=late_night)

    assert service.submit(_rain(day=date(2026, 11, 15))).data_fato == date(2026, 11, 15)
    with pytest.raises(ValidationDomainError, match="futura"):
        service.submit(_rain(day=date(2026, 11, 16)))


@pytest.mark.parametrize(
    "subtipo", ["fogo", "granizo", "geada", "vendaval", "enxurrada_erosao", "praga_doenca"]
)
def test_event_accepts_the_closed_list(subtipo: str) -> None:
    report = _service().submit(_event(subtipo))

    assert (report.tipo, report.subtipo, report.valores) == ("evento", subtipo, {})


def test_event_refuses_other_subtypes_and_any_value() -> None:
    with pytest.raises(ValidationDomainError, match="subtipo"):
        _service().submit(_event("terremoto"))
    with pytest.raises(ValidationDomainError, match="subtipo"):
        _service().submit(_event(subtipo=None))
    with pytest.raises(ValidationDomainError, match="texto"):
        _service().submit(_event(valores={"texto": "pegou fogo no vizinho"}))


@pytest.mark.parametrize("crop", [*CROP_IDS, "outra"])
def test_planting_accepts_the_crops_of_culturas_yaml_and_other(crop: str) -> None:
    valores = {"ano": 2025} if crop == "pousio" else {"ano": 2025, "resultado": "mais_ou_menos"}

    report = _service().submit(_planting(crop, valores))

    assert (report.tipo, report.subtipo, report.valores) == ("plantio", crop, valores)
    assert report.data_fato is None


def test_planting_refuses_an_unknown_crop() -> None:
    with pytest.raises(ValidationDomainError, match="subtipo"):
        _service().submit(_planting("soja"))


@pytest.mark.parametrize("ano", [2024, 2025, 2026])
def test_planting_year_must_be_one_of_the_last_seasons(ano: int) -> None:
    assert (
        _service().submit(_planting(valores={"ano": ano, "resultado": "bem"})).valores["ano"] == ano
    )


@pytest.mark.parametrize("ano", [2023, 2027, "2025", True, None])
def test_planting_refuses_other_years(ano: object) -> None:
    with pytest.raises(ValidationDomainError, match="ano"):
        _service().submit(_planting(valores={"ano": ano, "resultado": "bem"}))


def test_planting_needs_how_it_went_from_the_closed_list() -> None:
    with pytest.raises(ValidationDomainError, match="resultado"):
        _service().submit(_planting(valores={"ano": 2026}))
    with pytest.raises(ValidationDomainError, match="resultado"):
        _service().submit(_planting(valores={"ano": 2026, "resultado": "ótimo"}))


@pytest.mark.parametrize("motivo", ["seca", "calor", "geada", "granizo", "praga", "outro"])
def test_lost_crop_needs_the_reason_from_the_closed_list(motivo: str) -> None:
    valores = {"ano": 2026, "resultado": "perdi", "motivo": motivo}

    assert _service().submit(_planting(valores=valores)).valores == valores


def test_lost_crop_refuses_a_missing_or_unknown_reason() -> None:
    with pytest.raises(ValidationDomainError, match="motivo"):
        _service().submit(_planting(valores={"ano": 2026, "resultado": "perdi"}))
    with pytest.raises(ValidationDomainError, match="motivo"):
        _service().submit(
            _planting(valores={"ano": 2026, "resultado": "perdi", "motivo": "o vizinho"})
        )


def test_reason_only_when_the_crop_was_lost() -> None:
    with pytest.raises(ValidationDomainError, match="motivo"):
        _service().submit(_planting(valores={"ano": 2026, "resultado": "bem", "motivo": "seca"}))


def test_idle_land_has_no_result() -> None:
    with pytest.raises(ValidationDomainError, match="resultado"):
        _service().submit(_planting("pousio", {"ano": 2026, "resultado": "bem"}))


def test_planting_has_no_fact_date() -> None:
    with pytest.raises(ValidationDomainError, match="data"):
        _service().submit(_planting(data_fato=TODAY))


def test_planting_refuses_extra_fields() -> None:
    with pytest.raises(ValidationDomainError, match="comentario"):
        _service().submit(
            _planting(valores={"ano": 2026, "resultado": "bem", "comentario": "deu muito bem"})
        )


def test_new_planting_of_the_same_year_replaces_the_old_one_from_the_same_device() -> None:
    repository = FakeReportRepository()
    service = _service(repository)
    service.submit(_planting("milho_safrinha", {"ano": 2025, "resultado": "bem"}))
    service.submit(_planting("sorgo", {"ano": 2026, "resultado": "bem"}))
    service.submit(
        _planting("milho_safrinha", {"ano": 2025, "resultado": "bem"}, device_id=OTHER_DEVICE)
    )

    service.submit(_planting("milheto", {"ano": 2025, "resultado": "perdi", "motivo": "seca"}))

    mine = [r for r in repository.reports if r.device_hash == hash_device_id(DEVICE, SALT)]
    assert sorted((r.valores["ano"], r.subtipo) for r in mine) == [
        (2025, "milheto"),
        (2026, "sorgo"),
    ]
    assert len(repository.reports) == 3


@pytest.mark.parametrize("tipo", ["oferta", "troca", "emprestimo", ""])
def test_types_for_later_are_not_accepted_now(tipo: str) -> None:
    with pytest.raises(ValidationDomainError, match="tipo"):
        _service().submit(_event(tipo=tipo))


def test_point_outside_the_pilot_area_is_refused() -> None:
    # Rio Verde (GO), fora da caixa do Triângulo Mineiro.
    with pytest.raises(ValidationDomainError, match="área piloto"):
        _service().submit(_rain(lat=-17.79, lon=-50.92))


def test_device_id_is_needed() -> None:
    with pytest.raises(ValidationDomainError, match="aparelho"):
        _service().submit(_rain(device_id="  "))


def test_at_most_10_reports_per_device_in_24_hours() -> None:
    repository = FakeReportRepository()
    yesterday = _service(repository, now=NOW - timedelta(hours=25))
    for _ in range(10):
        yesterday.submit(_rain(day=TODAY - timedelta(days=1)))  # há mais de 24 horas: não contam
    service = _service(repository)
    for _ in range(10):
        service.submit(_rain())

    with pytest.raises(TooManyReportsError, match="10"):
        service.submit(_rain())
    # Outro aparelho continua podendo enviar.
    assert service.submit(_rain(device_id=OTHER_DEVICE)).tipo == "chuva"


# --- listar ----------------------------------------------------------------------------------


def test_cells_within_radius_are_the_ones_whose_center_is_inside() -> None:
    cells = cells_within_radius(FARM[0], FARM[1], 30.0)

    assert cell_id_for(*FARM) in cells
    assert len(cells) == len(set(cells))
    for cell in cells:
        lat_idx, lon_idx = (int(part) for part in cell.split("_"))
        center = ((lat_idx + 0.5) / 10, (lon_idx + 0.5) / 10)
        assert distance_m(FARM[0], FARM[1], *center) <= 30_000
    # Uma célula a uns 40 km (0,36° ao norte) fica de fora.
    assert cell_id_for(FARM[0] + 0.36, FARM[1]) not in cells
    # O círculo de 30 km tem cerca de 28 células de ~11 km × 10,5 km.
    assert 20 <= len(cells) <= 36


def test_nearby_lists_reports_of_the_cells_in_the_radius_with_the_cell_center() -> None:
    repository = FakeReportRepository()
    service = _service(repository)
    near = service.submit(_rain(lat=FARM[0] + 0.15, lon=FARM[1]))  # ~17 km ao norte
    service.submit(_rain(lat=FARM[0] + 0.40, lon=FARM[1]))  # ~44 km ao norte

    nearby = service.nearby(lat=FARM[0], lon=FARM[1])

    assert nearby.raio_km == 30.0
    assert nearby.anos_safra == (2024, 2025, 2026)
    assert [r.id for r in nearby.relatos] == [near.id]
    item = nearby.relatos[0]
    assert item.celula == near.celula
    assert (item.lat, item.lon) == (-18.85, -48.15)


def test_nearby_radius_is_checked() -> None:
    service = _service()

    assert service.nearby(lat=FARM[0], lon=FARM[1], raio_km=10).raio_km == 10
    with pytest.raises(ValidationDomainError, match="raio"):
        service.nearby(lat=FARM[0], lon=FARM[1], raio_km=51)
    with pytest.raises(ValidationDomainError, match="raio"):
        service.nearby(lat=FARM[0], lon=FARM[1], raio_km=0)


def test_nearby_leaves_out_old_rain_and_events_and_plantings_of_other_seasons() -> None:
    repository = FakeReportRepository()
    old = _service(repository, now=NOW - timedelta(days=20))
    old.submit(_rain(day=(NOW - timedelta(days=40)).date()))  # 40 dias antes de hoje
    old_planting = old.submit(_planting(valores={"ano": 2024, "resultado": "bem"}))
    # O mesmo relato de plantio, com um ano que saiu da janela das últimas safras.
    repository.reports.append(replace(repository.reports[-1], id="velho", valores={"ano": 2021}))
    service = _service(repository)
    fresh = service.submit(_event("geada", data_fato=TODAY - timedelta(days=2)))

    ids = {r.id for r in service.nearby(lat=FARM[0], lon=FARM[1]).relatos}

    assert ids == {fresh.id, old_planting.id}


def test_nearby_marks_only_my_own_reports_and_never_shows_the_device() -> None:
    repository = FakeReportRepository()
    service = _service(repository)
    mine = service.submit(_rain())
    theirs = service.submit(_rain(device_id=OTHER_DEVICE))

    nearby = service.nearby(lat=FARM[0], lon=FARM[1], device_id=DEVICE)
    anonymous = service.nearby(lat=FARM[0], lon=FARM[1])

    assert {r.id: r.meu for r in nearby.relatos} == {mine.id: True, theirs.id: False}
    assert all(not r.meu for r in anonymous.relatos)
    assert not hasattr(nearby.relatos[0], "device_hash")


def test_nearby_newest_first() -> None:
    repository = FakeReportRepository()
    service = _service(repository)
    older = service.submit(_event("granizo", data_fato=TODAY - timedelta(days=5)))
    newer = service.submit(_event("vendaval", data_fato=TODAY - timedelta(days=1)))

    assert [r.id for r in service.nearby(lat=FARM[0], lon=FARM[1]).relatos] == [newer.id, older.id]


# --- apagar ----------------------------------------------------------------------------------


def test_delete_my_own_report() -> None:
    repository = FakeReportRepository()
    service = _service(repository)
    report = service.submit(_rain())

    service.delete(report.id, DEVICE)

    assert repository.reports == []


def test_cannot_delete_a_report_from_another_device_or_that_does_not_exist() -> None:
    repository = FakeReportRepository()
    service = _service(repository)
    report = service.submit(_rain())

    with pytest.raises(NotFoundError):
        service.delete(report.id, OTHER_DEVICE)
    with pytest.raises(NotFoundError):
        service.delete(str(uuid.uuid4()), DEVICE)
    assert len(repository.reports) == 1


# --- sem banco -------------------------------------------------------------------------------


def test_without_a_database_the_community_is_unavailable() -> None:
    service = CommunityReportService(
        repository=None,
        crop_repo=FakeCropRepository(),
        rules=load_default_rules(),
        salt=SALT,
        now=lambda: NOW,
    )

    with pytest.raises(CommunityUnavailableError):
        service.submit(_rain())
    with pytest.raises(CommunityUnavailableError):
        service.nearby(lat=FARM[0], lon=FARM[1])
    with pytest.raises(CommunityUnavailableError):
        service.delete(str(uuid.uuid4()), DEVICE)
