"""Relatos da comunidade sem cadastro (seção 7 da remodelagem, tarefa 0047).

Regras (números no grupo `comunidade` do `regras.yaml`):

- **Tipos de agora:** `plantio` (o que plantou depois da soja), `chuva` e `evento`. Os tipos
  futuros (oferta, troca, empréstimo) cabem na tabela, mas o service ainda recusa.
- **Privacidade:** o ponto vira a célula de 0,1° (`cell_id_for`) e só ela é guardada; o
  identificador do aparelho vira HMAC-SHA-256 com o sal do `Settings` e nunca sai na resposta.
- **Sem texto livre:** cada tipo aceita só os campos dele, e todo valor vem de uma lista fechada
  ou é um número conferido. Campo a mais é recusado.
- **Datas:** chuva e evento precisam da data do fato, não futura e de no máximo `dias_atras_max`
  dias atrás, no dia de Uberlândia (UTC-3). O plantio não tem data: o ano da safra vai em
  `valores` e precisa ser uma das últimas safras (as que o produtor confirma na tela 4, tarefa
  0039).
- **Limite:** no máximo `max_relatos_por_dia` relatos por aparelho nas últimas 24 horas. Um novo
  relato de plantio do mesmo aparelho e do mesmo ano substitui o anterior.
- **Redondeza:** as células cujo centro fica a até `raio_km` do ponto (haversine), com a chuva e
  os eventos dos últimos `dias_atras_max` dias e o plantio das últimas safras, do mais novo ao
  mais velho.
"""

import hashlib
import hmac
import math
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, date, datetime, timedelta, timezone

from app.constants import (
    PILOT_MAX_LAT,
    PILOT_MAX_LON,
    PILOT_MIN_LAT,
    PILOT_MIN_LON,
    PILOT_UTC_OFFSET_HOURS,
)
from app.models.community_report import (
    EVENT_TYPES,
    IDLE_CROP,
    LOSS_REASONS,
    LOST_OUTCOME,
    OTHER_CROP,
    PLANTING_OUTCOMES,
    REPORT_TYPES,
    TIPO_CHUVA,
    TIPO_EVENTO,
    TIPO_PLANTIO,
    CommunityReport,
    NearbyReport,
    NearbyReports,
    NewCommunityReport,
    ReportSubmission,
)
from app.models.regras import Regras
from app.repositories.climate_repository import cell_center, cell_id_for
from app.repositories.community_report_repository import CommunityReportRepository
from app.repositories.crop_params_repository import CropParamsRepository
from app.services.errors import (
    CommunityUnavailableError,
    NotFoundError,
    TooManyReportsError,
    ValidationDomainError,
)
from app.services.field_history_service import FieldHistoryService
from app.services.region_service import distance_m

LOCAL_TZ = timezone(timedelta(hours=PILOT_UTC_OFFSET_HOURS))
# Graus de latitude por km (para a caixa em volta do círculo; a conta final é a haversine).
KM_PER_DEGREE = 111.0
RAIN_DECIMALS = 1
RATE_WINDOW = timedelta(days=1)


def utc_now() -> datetime:
    return datetime.now(UTC)


def hash_device_id(device_id: str, salt: str) -> str:
    """HMAC-SHA-256 do identificador do aparelho com o sal: 64 dígitos hexadecimais."""
    return hmac.new(salt.encode("utf-8"), device_id.encode("utf-8"), hashlib.sha256).hexdigest()


def cells_within_radius(lat: float, lon: float, radius_km: float) -> list[str]:
    """Ids das células de 0,1° cujo centro fica a até `radius_km` do ponto (haversine)."""
    margin_deg = 0.1
    dlat = radius_km / KM_PER_DEGREE + margin_deg
    dlon = radius_km / (KM_PER_DEGREE * math.cos(math.radians(lat))) + margin_deg
    lat_lo, lat_hi = math.floor((lat - dlat) * 10), math.floor((lat + dlat) * 10)
    lon_lo, lon_hi = math.floor((lon - dlon) * 10), math.floor((lon + dlon) * 10)
    cells: list[str] = []
    for lat_idx in range(lat_lo, lat_hi + 1):
        for lon_idx in range(lon_lo, lon_hi + 1):
            cell_id = f"{lat_idx}_{lon_idx}"
            if distance_m(lat, lon, *cell_center(cell_id)) <= radius_km * 1000:
                cells.append(cell_id)
    return cells


def _as_number(value: object) -> float | None:
    """O número de um campo (int ou float finito); None para texto, booleano, nulo, NaN ou ∞."""
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _check_fields(valores: Mapping[str, object], allowed: Sequence[str], tipo: str) -> None:
    extra = sorted(set(valores) - set(allowed))
    if extra:
        raise ValidationDomainError(
            f"Campo não aceito no relato de {tipo}: {', '.join(extra)}. "
            "Os relatos não têm texto livre."
        )


class CommunityReportService:
    """Envia, lista e apaga os relatos da comunidade (tarefa 0047)."""

    def __init__(
        self,
        repository: CommunityReportRepository | None,
        crop_repo: CropParamsRepository,
        rules: Regras,
        salt: str,
        now: Callable[[], datetime] = utc_now,
    ) -> None:
        self._repository = repository
        self._crop_repo = crop_repo
        self._rules = rules.comunidade
        self._salt = salt
        self._now = now
        self._season_years = FieldHistoryService(rules).confirmable_years()

    # --- casos de uso --------------------------------------------------------------------------

    def submit(self, submission: ReportSubmission) -> NearbyReport:
        """Confere e guarda o relato; devolve como os vizinhos o veem (marcado como meu)."""
        repository = self._require_repository()
        device_hash = self._device_hash(submission.device_id)
        if submission.tipo not in REPORT_TYPES:
            raise ValidationDomainError(
                f"O tipo de relato '{submission.tipo}' não é aceito. "
                "Agora só plantio, chuva e evento."
            )
        self._check_point(submission.lat, submission.lon)
        valores = self._checked_values(submission)

        now = self._now()
        sent = repository.count_sent_since(device_hash, now - RATE_WINDOW)
        if sent >= self._rules.max_relatos_por_dia:
            raise TooManyReportsError(
                f"Este aparelho já enviou {self._rules.max_relatos_por_dia} relatos nas últimas "
                "24 horas. Tente de novo amanhã."
            )
        if submission.tipo == TIPO_PLANTIO:
            self._drop_same_season(repository, device_hash, valores["ano"])
        stored = repository.add(
            NewCommunityReport(
                tipo=submission.tipo,
                subtipo=submission.subtipo,
                valores=valores,
                celula=cell_id_for(submission.lat, submission.lon),
                data_fato=submission.data_fato,
                device_hash=device_hash,
            ),
            sent_at=now,
        )
        return self._to_nearby(stored, device_hash)

    def nearby(
        self,
        lat: float,
        lon: float,
        raio_km: float | None = None,
        device_id: str | None = None,
    ) -> NearbyReports:
        repository = self._require_repository()
        radius = self._rules.raio_km if raio_km is None else float(raio_km)
        if not 0 < radius <= self._rules.raio_max_km:
            raise ValidationDomainError(
                f"O raio precisa ser maior que 0 e de no máximo {self._rules.raio_max_km:g} km."
            )
        mine = self._device_hash(device_id) if device_id and device_id.strip() else None
        fact_since = self._today() - timedelta(days=self._rules.dias_atras_max)
        reports = [
            report
            for report in repository.list_in_cells(
                cells_within_radius(lat, lon, radius), fact_since
            )
            if report.tipo != TIPO_PLANTIO or report.valores.get("ano") in self._season_years
        ]
        reports.sort(
            key=lambda r: (r.data_fato or r.enviado_em.astimezone(LOCAL_TZ).date(), r.enviado_em),
            reverse=True,
        )
        return NearbyReports(
            raio_km=radius,
            anos_safra=self._season_years,
            relatos=tuple(self._to_nearby(report, mine) for report in reports),
        )

    def delete(self, report_id: str, device_id: str) -> None:
        repository = self._require_repository()
        if not repository.delete(report_id, self._device_hash(device_id)):
            raise NotFoundError("Relato não encontrado entre os enviados por este aparelho.")

    # --- regras --------------------------------------------------------------------------------

    def _require_repository(self) -> CommunityReportRepository:
        if self._repository is None:
            raise CommunityUnavailableError(
                "A comunidade não está ligada neste servidor (sem banco de dados)."
            )
        return self._repository

    def _device_hash(self, device_id: str) -> str:
        if not device_id or not device_id.strip():
            raise ValidationDomainError("Falta o identificador do aparelho.")
        return hash_device_id(device_id.strip(), self._salt)

    def _today(self) -> date:
        return self._now().astimezone(LOCAL_TZ).date()

    @staticmethod
    def _check_point(lat: float, lon: float) -> None:
        if not (PILOT_MIN_LAT <= lat <= PILOT_MAX_LAT and PILOT_MIN_LON <= lon <= PILOT_MAX_LON):
            raise ValidationDomainError(
                "O ponto fica fora da área piloto (região de Uberlândia e Uberaba)."
            )

    def _checked_values(self, submission: ReportSubmission) -> dict[str, object]:
        if submission.tipo == TIPO_CHUVA:
            return self._checked_rain(submission)
        if submission.tipo == TIPO_EVENTO:
            return self._checked_event(submission)
        return self._checked_planting(submission)

    def _check_fact_date(self, fact_date: date | None, tipo: str) -> None:
        if fact_date is None:
            raise ValidationDomainError(f"O relato de {tipo} precisa da data.")
        today = self._today()
        if fact_date > today:
            raise ValidationDomainError("A data não pode ser futura.")
        if fact_date < today - timedelta(days=self._rules.dias_atras_max):
            raise ValidationDomainError(
                f"A data pode ser de no máximo {self._rules.dias_atras_max} dias atrás."
            )

    def _checked_rain(self, submission: ReportSubmission) -> dict[str, object]:
        if submission.subtipo is not None:
            raise ValidationDomainError("O relato de chuva não tem subtipo.")
        _check_fields(submission.valores, ("mm",), TIPO_CHUVA)
        mm = _as_number(submission.valores.get("mm"))
        if mm is None or not 0 <= mm <= self._rules.chuva_max_mm:
            raise ValidationDomainError(
                f"A chuva vai de 0 a {self._rules.chuva_max_mm:g} mm por dia."
            )
        self._check_fact_date(submission.data_fato, TIPO_CHUVA)
        return {"mm": round(mm, RAIN_DECIMALS)}

    def _checked_event(self, submission: ReportSubmission) -> dict[str, object]:
        if submission.subtipo not in EVENT_TYPES:
            raise ValidationDomainError(
                f"O subtipo do evento precisa ser um destes: {', '.join(EVENT_TYPES)}."
            )
        _check_fields(submission.valores, (), TIPO_EVENTO)
        self._check_fact_date(submission.data_fato, TIPO_EVENTO)
        return {}

    def _checked_planting(self, submission: ReportSubmission) -> dict[str, object]:
        crops = [*(crop.id for crop in self._crop_repo.list_all()), OTHER_CROP]
        if submission.subtipo not in crops:
            raise ValidationDomainError(
                f"O subtipo do plantio precisa ser uma destas culturas: {', '.join(crops)}."
            )
        if submission.data_fato is not None:
            raise ValidationDomainError(
                "O relato de plantio não tem data do fato: o ano da safra vai em valores."
            )
        valores = submission.valores
        _check_fields(valores, ("ano", "resultado", "motivo"), TIPO_PLANTIO)
        ano = valores.get("ano")
        if isinstance(ano, bool) or not isinstance(ano, int) or ano not in self._season_years:
            years = ", ".join(str(year) for year in self._season_years)
            raise ValidationDomainError(f"O ano da safra precisa ser uma das últimas: {years}.")
        if submission.subtipo == IDLE_CROP:
            if "resultado" in valores or "motivo" in valores:
                raise ValidationDomainError(
                    "Quem deixou a terra parada não informa resultado nem motivo."
                )
            return {"ano": ano}
        resultado = valores.get("resultado")
        if resultado not in PLANTING_OUTCOMES:
            raise ValidationDomainError(
                f"Diga como foi (resultado): {', '.join(PLANTING_OUTCOMES)}."
            )
        checked: dict[str, object] = {"ano": ano, "resultado": resultado}
        motivo = valores.get("motivo")
        if resultado == LOST_OUTCOME:
            if motivo not in LOSS_REASONS:
                raise ValidationDomainError(f"Se perdeu, diga o motivo: {', '.join(LOSS_REASONS)}.")
            checked["motivo"] = motivo
        elif "motivo" in valores:
            raise ValidationDomainError("O motivo só vale quando a lavoura foi perdida.")
        return checked

    @staticmethod
    def _drop_same_season(
        repository: CommunityReportRepository, device_hash: str, ano: object
    ) -> None:
        for old in repository.list_by_device(device_hash, TIPO_PLANTIO):
            if old.valores.get("ano") == ano:
                repository.delete(old.id, device_hash)

    @staticmethod
    def _to_nearby(report: CommunityReport, mine: str | None) -> NearbyReport:
        lat, lon = cell_center(report.celula)
        return NearbyReport(
            id=report.id,
            tipo=report.tipo,
            subtipo=report.subtipo,
            valores=dict(report.valores),
            celula=report.celula,
            lat=lat,
            lon=lon,
            data_fato=report.data_fato,
            meu=mine is not None and report.device_hash == mine,
        )
