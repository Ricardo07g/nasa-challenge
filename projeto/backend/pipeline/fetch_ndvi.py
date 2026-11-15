"""Baixa a série de NDVI do MODIS (MOD13Q1 e MYD13Q1, coleção 061) por ponto.

Roteiro R2.2 (tarefas 0017 e 0024). Grava o arquivo no formato do contrato (`AGENTS.md` do backend,
"Contrato dos dados das fontes" → NDVI), que o `CachedNdviRepository` lê (`NDVI_CACHE_PATH`). Duas
fontes, com o mesmo arquivo de saída (o `versao_dados.parametros.servico` diz de qual veio):

- `--fonte appeears` (padrão): uma tarefa no AppEEARS, que pode esperar na fila por horas;
- `--fonte ornl`: o serviço de recortes do MODIS da ORNL DAAC, sem login e sem fila, mas lento
  (dezenas de segundos por pedido, no máximo 10 datas cada) e instável (502 quando passa de ~60 s).

Uso (a partir de projeto/backend; as credenciais do AppEEARS vêm do `.env` pelo `Settings`):

    uv run python -m pipeline.fetch_ndvi                       # fazenda de exemplo, AppEEARS
    uv run python -m pipeline.fetch_ndvi --pontos "-18.9543,-48.1993;-17.5,-47.25"
    uv run python -m pipeline.fetch_ndvi --dry-run             # mostra o pedido, sem rede
    uv run python -m pipeline.fetch_ndvi --tarefa-existente <id>   # retoma uma tarefa já criada
    uv run python -m pipeline.fetch_ndvi --csv <arquivo-results.csv>  # converte CSV já baixado
    uv run python -m pipeline.fetch_ndvi --fonte ornl --dry-run    # pedidos e tempo pela ORNL
    uv run python -m pipeline.fetch_ndvi --fonte ornl              # fazenda de exemplo, ORNL

Saída padrão `data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json` a partir da raiz do
repositório (o nome é o que o compose procura, para as duas fontes). Os brutos ficam ao lado:
`appeears_<tarefa>/` (CSVs do AppEEARS) e `cache_ornl/` (respostas da ORNL, que permitem retomar).

AppEEARS. Autenticação, nesta ordem: `APPEEARS_TOKEN` (Bearer do próprio AppEEARS, vale ~48 h); se
faltar ou for recusado (401/403), `POST /api/login` com `EARTHDATA_USERNAME` e
`EARTHDATA_PASSWORD`. O `EARTHDATA_TOKEN` não serve (o AppEEARS devolve 403). Nenhuma mensagem
mostra token ou senha. Fluxo: tarefa `point` (todos os pontos numa tarefa) → consulta do status até
`done` → lista do bundle → download dos `*-results.csv` → filtro (qualidade 0 ou 1, jan–jul dos anos
do `historico_ndvi` do regras.yaml, sem o valor de preenchimento) → JSON do contrato.

ORNL. Sem credencial. Fluxo: metadados das bandas de cada produto (fator de escala e valor de
preenchimento do NDVI) → lista de datas de cada ponto e produto → recortes de um pixel com até
`--datas-por-pedido` datas, sem cruzar o ano, com retentativa e pausa entre os pedidos → mesmo
filtro e mesmo JSON. Cada resposta é conferida antes de entrar no cache; parou no meio (código 2),
rode de novo que continua do cache.
"""

import argparse
import base64
import csv
import io
import json
import os
import re
import sys
import time
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Final

from app.config import get_settings
from app.models.data_run import DataRun
from app.models.talhao import NdviRecord
from app.repositories.external.http_client import (
    HttpRequest,
    HttpResponse,
    HttpTransport,
    default_http_request,
)
from app.repositories.rules_repository import load_default_rules

APPEEARS_API_URL: Final[str] = "https://appeears.earthdatacloud.nasa.gov/api"
SOURCE_KEY: Final[str] = "modis_mod13q1"
COLLECTION: Final[str] = "061"
# Terra e Aqua, defasados em 8 dias: juntos dão ~14 imagens em abr–jul em vez de 7 (guia NDVI).
PRODUCTS: Final[tuple[str, ...]] = ("MOD13Q1", "MYD13Q1")
# Nomes conferidos em GET /api/product/MOD13Q1.061 e /MYD13Q1.061.
NDVI_LAYER: Final[str] = "_250m_16_days_NDVI"
QUALITY_LAYER: Final[str] = "_250m_16_days_pixel_reliability"
# Anos do histórico do talhão (grupo historico_ndvi do regras.yaml: 2017 a 2026, decisão de
# 15/11/2026), de janeiro a julho (jan–mar: o pico e a colheita da soja e a colheita sugerida;
# depois, a entressafra). O AppEEARS aceita a janela recorrente em MM-DD.
FIRST_YEAR: Final[int] = load_default_rules().historico_ndvi.ano_inicio
LAST_YEAR: Final[int] = load_default_rules().historico_ndvi.ano_fim
SEASON_START_MMDD: Final[str] = "01-01"
SEASON_END_MMDD: Final[str] = "07-31"
SEASON_MONTHS: Final[frozenset[int]] = frozenset(range(1, 8))
# pixel_reliability: 0 bom, 1 aceitável, 2 neve, 3 nuvem, -1 sem dado. Só 0 e 1 entram.
ACCEPTED_QUALITY: Final[frozenset[int]] = frozenset({0, 1})
NDVI_SCALE_FACTOR: Final[float] = 0.0001
RAW_FILL_VALUE: Final[float] = -3000.0
NDVI_PHYSICAL_MIN: Final[float] = -0.2
NDVI_PHYSICAL_MAX: Final[float] = 1.0
NDVI_DECIMALS: Final[int] = 4
SCALED_FILL_VALUE: Final[float] = round(RAW_FILL_VALUE * NDVI_SCALE_FACTOR, NDVI_DECIMALS)

REQUEST_TIMEOUT_SECONDS: Final[float] = 60.0
DEFAULT_POLL_SECONDS: Final[float] = 30.0
DEFAULT_LIMIT_MINUTES: Final[float] = 120.0
OUTPUT_FILE_NAME: Final[str] = "ndvi_modis_appeears.json"

APPEEARS_SERVICE: Final[str] = "appeears"
ORNL_SERVICE: Final[str] = "ornl"
ORNL_API_URL: Final[str] = "https://modis.ornl.gov/rst/api/v1"
# Nomes conferidos em GET /rst/api/v1/MOD13Q1/bands (sem o "_" inicial dos nomes do AppEEARS).
# A coleção é a 061: o `proc_date` dos recortes é de 2021, o reprocessamento da coleção 6.1.
ORNL_NDVI_BAND: Final[str] = "250m_16_days_NDVI"
ORNL_QUALITY_BAND: Final[str] = "250m_16_days_pixel_reliability"
ORNL_BANDS: Final[tuple[str, str]] = (ORNL_NDVI_BAND, ORNL_QUALITY_BAND)
# Limite do serviço: no máximo 10 datas por recorte.
ORNL_MAX_DATES_PER_REQUEST: Final[int] = 10
# Medido em 14/11/2026 (fazenda de exemplo, um pixel, todas as bandas num pedido): 4 e 5 datas em
# 19 a 29 s; 6, 7 e 10 datas entre 55 s e o corte do proxy (502 aos ~60 s). Jan–jul tem 14
# composições do Terra e 13 do Aqua por ano: 3 recortes de até 5 datas por ano e produto.
ORNL_DEFAULT_DATES_PER_REQUEST: Final[int] = 5
# Só para a estimativa do --dry-run, sem a pausa. Rodada real da fazenda de exemplo (14/11/2026):
# 65 pedidos certos em ~99 min, ou ~85 s por pedido contando os 28 que deram 502, as retentativas e
# a divisão; os que deram certo levaram de 23 a 60 s (média 45 s).
ORNL_MEASURED_SECONDS_PER_REQUEST: Final[float] = 85.0
ORNL_TIMEOUT_SECONDS: Final[float] = 120.0
ORNL_PAUSE_SECONDS: Final[float] = 5.0
ORNL_MAX_RETRIES: Final[int] = 3
ORNL_BACKOFF_SECONDS: Final[float] = 20.0
# Bloco de várias datas: 1 retentativa e depois divide em duas metades (na rodada real de
# 14/11/2026, os de 5 datas do Aqua deram 502 na 1ª tentativa quase sempre, a ~50–58 s por pedido).
ORNL_RETRIES_BEFORE_SPLIT: Final[int] = 1
# Recortes seguidos sem resposta (já depois das retentativas) para desistir: a ORNL caiu.
ORNL_MAX_CONSECUTIVE_FAILURES: Final[int] = 3
ORNL_CACHE_DIR_NAME: Final[str] = "cache_ornl"
# Dia juliano da primeira composição de 16 dias do ano: Terra no dia 1, Aqua no dia 9.
COMPOSITE_FIRST_DAY: Final[dict[str, int]] = {"MOD13Q1": 1, "MYD13Q1": 9}
COMPOSITE_STEP_DAYS: Final[int] = 16

_NDVI_COLUMN = re.compile(rf"^(?P<product>M[OY]D13Q1)_(?P<version>\d{{3}})_{NDVI_LAYER}$")
_MODIS_DATE = re.compile(r"^A(?P<year>\d{4})(?P<doy>\d{3})$")
_TOKEN_REJECTED: Final[frozenset[int]] = frozenset({401, 403})
_RETRY_STATUS: Final[frozenset[int]] = frozenset({429})


def repo_root(script: Path = Path(__file__)) -> Path:
    """Raiz do repositório, achada pelo caminho do script (`<raiz>/projeto/backend/pipeline/`).

    Mesma regra do `repo_root` do `fetch_cmip6_deltas`: não depende da pasta de onde o script roda.
    No container (`/app/pipeline/`) não há `projeto/backend` acima: a raiz fica a pasta do backend.
    """
    backend = script.resolve().parent.parent
    if backend.name == "backend" and backend.parent.name == "projeto":
        return backend.parent.parent
    return backend


# Pasta organizada do time (fora do git): o compose monta `data/baixados` no backend e aponta o
# `NDVI_CACHE_PATH` para este arquivo.
DOWNLOADS_DIR: Final[Path] = repo_root() / "data" / "baixados" / "nasa_modis_ndvi"
DEFAULT_OUTPUT: Final[Path] = DOWNLOADS_DIR / OUTPUT_FILE_NAME


@dataclass(frozen=True)
class Point:
    lat: float
    lon: float


# Fazenda Experimental do Glória (UFU), Uberlândia: a fazenda de exemplo.
DEFAULT_POINT: Final[Point] = Point(-18.9543, -48.1993)


@dataclass(frozen=True)
class Credentials:
    """Credenciais do AppEEARS. Token e senha ficam fora do `repr` (nunca aparecem em log)."""

    token: str | None = field(default=None, repr=False)
    username: str | None = None
    password: str | None = field(default=None, repr=False)


@dataclass(frozen=True)
class Observation:
    """Uma linha do CSV do AppEEARS, ainda sem filtro."""

    point_id: str
    lat: float
    lon: float
    day: date
    product: str
    ndvi: float | None
    quality: int | None


class AppeearsError(RuntimeError):
    """Falha ao falar com o AppEEARS ou ao ler o que ele devolveu."""


class MissingCredentialsError(AppeearsError):
    """Sem credencial que o AppEEARS aceite."""


class OrnlError(RuntimeError):
    """A ORNL recusou o pedido (4xx) ou devolveu algo fora do formato esperado."""


class OrnlUnavailableError(OrnlError):
    """Sem resposta válida da ORNL depois das retentativas: tente de novo mais tarde."""


class TaskTimeoutError(AppeearsError):
    """A tarefa não terminou no tempo dado (ela continua no AppEEARS e pode ser retomada)."""

    def __init__(self, task_id: str, waited_seconds: float) -> None:
        super().__init__(
            f"A tarefa {task_id} não terminou em {waited_seconds / 60:.0f} min. Ela continua no "
            f"AppEEARS: rode de novo com --tarefa-existente {task_id}"
        )
        self.task_id = task_id


def _log(message: str) -> None:
    print(message, file=sys.stderr)


def _server_message(response: HttpResponse) -> str:
    try:
        payload = response.json()
    except (ValueError, UnicodeDecodeError):
        return response.body[:200].decode("utf-8", errors="replace")
    if isinstance(payload, dict) and payload.get("message"):
        return str(payload["message"])
    return str(payload)[:200]


class AppeearsClient:
    """Cliente mínimo da API do AppEEARS para tarefas por ponto."""

    def __init__(
        self,
        transport: HttpTransport,
        credentials: Credentials,
        *,
        base_url: str = APPEEARS_API_URL,
        timeout: float = REQUEST_TIMEOUT_SECONDS,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        log: Callable[[str], None] = _log,
    ) -> None:
        self._transport = transport
        self._credentials = credentials
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._sleep = sleep
        self._clock = clock
        self._log = log
        self._token: str | None = None

    # --- autenticação ---------------------------------------------------------------------

    def _can_login(self) -> bool:
        return bool(self._credentials.username and self._credentials.password)

    def authenticate(self) -> None:
        token = self._credentials.token
        if token:
            check = self._send("GET", "/task", params={"limit": 1}, authorization=f"Bearer {token}")
            if check.status == 200:
                self._token = token
                return
            if check.status not in _TOKEN_REJECTED:
                raise AppeearsError(
                    f"O AppEEARS respondeu {check.status} ao conferir o APPEEARS_TOKEN: "
                    f"{_server_message(check)}"
                )
            if not self._can_login():
                raise MissingCredentialsError(
                    f"O AppEEARS recusou o APPEEARS_TOKEN (HTTP {check.status}; ele vale ~48 h). "
                    "Gere outro em POST /api/login ou defina EARTHDATA_USERNAME e "
                    "EARTHDATA_PASSWORD no .env do backend."
                )
            self._log("APPEEARS_TOKEN recusado; fazendo o login com o usuário da Earthdata.")
        elif not self._can_login():
            raise MissingCredentialsError(
                "Sem credencial do AppEEARS: defina APPEEARS_TOKEN, ou EARTHDATA_USERNAME e "
                "EARTHDATA_PASSWORD, no .env do backend. O EARTHDATA_TOKEN não serve para o "
                "AppEEARS."
            )
        self._token = self._login()

    def _login(self) -> str:
        user_pass = f"{self._credentials.username}:{self._credentials.password}"
        basic = base64.b64encode(user_pass.encode("utf-8")).decode("ascii")
        response = self._send("POST", "/login", authorization=f"Basic {basic}")
        if response.status != 200:
            raise AppeearsError(
                f"O login no AppEEARS falhou (HTTP {response.status}): {_server_message(response)}"
            )
        payload = response.json()
        token = payload.get("token") if isinstance(payload, dict) else None
        if not token:
            raise AppeearsError("O login no AppEEARS não devolveu token.")
        return str(token)

    # --- pedidos --------------------------------------------------------------------------

    def _send(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: Any = None,
        authorization: str | None = None,
    ) -> HttpResponse:
        request = HttpRequest(
            method=method,
            url=f"{self._base_url}{path}",
            params=params or {},
            json_body=json_body,
            authorization=authorization,
        )
        return self._transport(request, self._timeout)

    def _authorized(
        self, method: str, path: str, *, params: dict[str, Any] | None = None, json_body: Any = None
    ) -> HttpResponse:
        if self._token is None:
            raise AppeearsError("Chame authenticate() antes de falar com o AppEEARS.")
        response = self._send(
            method, path, params=params, json_body=json_body, authorization=f"Bearer {self._token}"
        )
        if response.status in _TOKEN_REJECTED and self._can_login():
            self._log("Token do AppEEARS recusado no meio do caminho; fazendo o login de novo.")
            self._token = self._login()
            response = self._send(
                method,
                path,
                params=params,
                json_body=json_body,
                authorization=f"Bearer {self._token}",
            )
        return response

    def submit_task(self, task: dict[str, Any]) -> str:
        response = self._authorized("POST", "/task", json_body=task)
        if response.status not in (200, 201, 202):
            raise AppeearsError(
                f"O AppEEARS recusou a tarefa (HTTP {response.status}): {_server_message(response)}"
            )
        payload = response.json()
        task_id = payload.get("task_id") if isinstance(payload, dict) else None
        if not task_id:
            raise AppeearsError("O AppEEARS aceitou a tarefa mas não devolveu o task_id.")
        return str(task_id)

    def wait_for_task(
        self,
        task_id: str,
        poll_interval: float = DEFAULT_POLL_SECONDS,
        timeout: float = DEFAULT_LIMIT_MINUTES * 60,
    ) -> dict[str, Any]:
        start = self._clock()
        while True:
            elapsed = self._clock() - start
            status = self._task_status(task_id)
            if status is not None:
                if status.get("status") == "done":
                    return status
                if status.get("status") == "error":
                    detail = status.get("error") or status.get("message") or "sem detalhe"
                    raise AppeearsError(f"A tarefa {task_id} falhou no AppEEARS: {detail}")
                self._log(f"Tarefa {task_id}: {status.get('status')} ({elapsed:.0f} s)")
            if elapsed + poll_interval > timeout:
                raise TaskTimeoutError(task_id, timeout)
            self._sleep(poll_interval)

    def _task_status(self, task_id: str) -> dict[str, Any] | None:
        """Status da tarefa; falha passageira (rede ou 5xx) devolve None e a espera continua."""
        try:
            response = self._authorized("GET", f"/task/{task_id}")
        except OSError as exc:
            self._log(f"Tarefa {task_id}: falha de rede ao consultar ({exc}); tento de novo.")
            return None
        if response.status >= 500:
            self._log(f"Tarefa {task_id}: AppEEARS respondeu {response.status}; tento de novo.")
            return None
        if response.status != 200:
            raise AppeearsError(
                f"Não consegui consultar a tarefa {task_id} (HTTP {response.status}): "
                f"{_server_message(response)}"
            )
        payload = response.json()
        return payload if isinstance(payload, dict) else {}

    def download_results(self, task_id: str) -> dict[str, bytes]:
        """Baixa só os `*-results.csv` do bundle (um por produto). Devolve nome → conteúdo."""
        response = self._authorized("GET", f"/bundle/{task_id}")
        if response.status != 200:
            raise AppeearsError(
                f"Não consegui listar o bundle da tarefa {task_id} (HTTP {response.status}): "
                f"{_server_message(response)}"
            )
        files = (response.json() or {}).get("files", [])
        results: dict[str, bytes] = {}
        for item in files:
            name = str(item.get("file_name") or "")
            if not name.endswith("-results.csv"):
                continue
            download = self._authorized("GET", f"/bundle/{task_id}/{item['file_id']}")
            if download.status != 200:
                raise AppeearsError(
                    f"Não consegui baixar {name} (HTTP {download.status}): "
                    f"{_server_message(download)}"
                )
            results[name] = download.body
        if not results:
            raise AppeearsError(f"O bundle da tarefa {task_id} não tem nenhum *-results.csv.")
        return results


# --- pedido da tarefa ---------------------------------------------------------------------


def _point_id(index: int) -> str:
    return f"p{index + 1}"


def build_task_request(points: Sequence[Point], task_name: str) -> dict[str, Any]:
    """Tarefa `point` do AppEEARS: NDVI + pixel_reliability dos dois produtos, jan–jul."""
    return {
        "task_type": "point",
        "task_name": task_name,
        "params": {
            "dates": [
                {
                    "startDate": SEASON_START_MMDD,
                    "endDate": SEASON_END_MMDD,
                    "recurring": True,
                    "yearRange": [FIRST_YEAR, LAST_YEAR],
                }
            ],
            "layers": [
                {"product": f"{product}.{COLLECTION}", "layer": layer}
                for product in PRODUCTS
                for layer in (NDVI_LAYER, QUALITY_LAYER)
            ],
            "coordinates": [
                {"id": _point_id(i), "latitude": p.lat, "longitude": p.lon}
                for i, p in enumerate(points)
            ],
        },
    }


# --- CSV do AppEEARS ----------------------------------------------------------------------


def _optional_float(raw: str | None) -> float | None:
    text = (raw or "").strip()
    return float(text) if text else None


def _optional_int(raw: str | None) -> int | None:
    value = _optional_float(raw)
    return int(value) if value is not None else None


def _quality_column(headers: Sequence[str], prefix: str) -> str:
    reliability = f"{prefix}_{QUALITY_LAYER}"
    if reliability in headers:
        return reliability
    summary = [h for h in headers if h.startswith(prefix) and h.endswith("SummaryQA")]
    if summary:
        return summary[0]
    raise AppeearsError(f"O CSV não tem a coluna de qualidade ({reliability} ou SummaryQA).")


def parse_appeears_csv(text: str) -> list[Observation]:
    """Lê o CSV de amostra por ponto do AppEEARS pelos nomes das colunas."""
    reader = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    headers = list(reader.fieldnames or [])
    pairs: list[tuple[str, str, str]] = []
    for header in headers:
        match = _NDVI_COLUMN.match(header)
        if match:
            prefix = f"{match['product']}_{match['version']}"
            pairs.append((match["product"], header, _quality_column(headers, prefix)))
    if not pairs:
        raise AppeearsError(f"O CSV não tem a coluna de NDVI (*_{NDVI_LAYER}).")
    missing = [c for c in ("ID", "Latitude", "Longitude", "Date") if c not in headers]
    if missing:
        raise AppeearsError(f"O CSV não tem as colunas {', '.join(missing)}.")

    observations: list[Observation] = []
    for row in reader:
        for product, ndvi_column, quality_column in pairs:
            observations.append(
                Observation(
                    point_id=str(row["ID"]),
                    lat=float(row["Latitude"]),
                    lon=float(row["Longitude"]),
                    day=date.fromisoformat(str(row["Date"])[:10]),
                    product=product,
                    ndvi=_optional_float(row.get(ndvi_column)),
                    quality=_optional_int(row.get(quality_column)),
                )
            )
    return observations


# --- conversão para o contrato ------------------------------------------------------------


def _is_fill(value: float) -> bool:
    """−3000 bruto ou −0,3 já escalado: os dois são "sem dado"."""
    return value == RAW_FILL_VALUE or round(value, NDVI_DECIMALS) == SCALED_FILL_VALUE


def _raw_products(observations: Iterable[Observation]) -> set[str]:
    """Produtos cujo CSV veio no inteiro bruto (|NDVI| > 1): esses recebem o fator 0,0001.

    O AppEEARS entrega o NDVI já escalado (float32), mas a decisão é por arquivo para não depender
    disso: um valor bruto entre −0,2 e 1 (0 ou 1) não existe na prática.
    """
    return {
        obs.product
        for obs in observations
        if obs.ndvi is not None and not _is_fill(obs.ndvi) and abs(obs.ndvi) > 1.0
    }


def _physical_ndvi(value: float | None, raw: bool) -> float | None:
    if value is None or _is_fill(value):
        return None
    physical = round(value * NDVI_SCALE_FACTOR if raw else value, NDVI_DECIMALS)
    if not NDVI_PHYSICAL_MIN <= physical <= NDVI_PHYSICAL_MAX:
        return None
    return physical


def _in_window(day: date) -> bool:
    return FIRST_YEAR <= day.year <= LAST_YEAR and day.month in SEASON_MONTHS


def _clean_records(observations: Sequence[Observation]) -> dict[str, list[NdviRecord]]:
    raw = _raw_products(observations)
    seen: set[tuple[str, date, str]] = set()
    by_point: dict[str, list[NdviRecord]] = {}
    for obs in observations:
        if obs.quality not in ACCEPTED_QUALITY or not _in_window(obs.day):
            continue
        ndvi = _physical_ndvi(obs.ndvi, obs.product in raw)
        key = (obs.point_id, obs.day, obs.product)
        if ndvi is None or key in seen:
            continue
        seen.add(key)
        record = NdviRecord(data=obs.day, ndvi=ndvi, qualidade=obs.quality, produto=obs.product)
        by_point.setdefault(obs.point_id, []).append(record)
    return by_point


def _serie(records: Iterable[NdviRecord]) -> list[dict[str, Any]]:
    ordered = sorted(records, key=lambda r: (r.data, r.produto or ""))
    return [
        {"data": r.data.isoformat(), "ndvi": r.ndvi, "qualidade": r.qualidade, "produto": r.produto}
        for r in ordered
    ]


def _service_params(service: str) -> dict[str, Any]:
    if service == ORNL_SERVICE:
        return {"servico": ORNL_SERVICE, "url": ORNL_API_URL, "camadas": list(ORNL_BANDS)}
    return {"servico": APPEEARS_SERVICE, "camadas": [NDVI_LAYER, QUALITY_LAYER]}


def build_ndvi_payload(
    observations: Sequence[Observation],
    points: Sequence[Point] | None,
    finished_at: datetime,
    task_id: str | None = None,
    *,
    service: str = APPEEARS_SERVICE,
    extra_params: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Monta o JSON do contrato do NDVI. Sem `points` (CSV avulso), usa os pontos do próprio CSV.

    `service` (`appeears` ou `ornl`) vai em `versao_dados.parametros.servico`; a `fonte` é sempre
    `modis_mod13q1`, porque o dado é o mesmo.
    """
    records = _clean_records(observations)
    located: dict[str, Point] = {_point_id(i): p for i, p in enumerate(points or [])}
    for obs in observations:
        located.setdefault(obs.point_id, Point(obs.lat, obs.lon))

    source = _service_params(service)
    params: dict[str, Any] = {
        "servico": source["servico"],
        **({"url": source["url"]} if "url" in source else {}),
        "produtos": list(PRODUCTS),
        "colecao": COLLECTION,
        "camadas": source["camadas"],
        "anos": [FIRST_YEAR, LAST_YEAR],
        "meses": sorted(SEASON_MONTHS),
        "qualidade_aceita": sorted(ACCEPTED_QUALITY),
        "pontos": len(located),
    }
    if task_id:
        params["tarefa"] = task_id
    params.update(extra_params or {})
    data_run = DataRun(
        source=SOURCE_KEY,
        params=params,
        finished_at=finished_at,
        version=f"{finished_at:%Y.%m}-modis-ndvi",
    )
    return {
        "versao_dados": {
            "fonte": data_run.source,
            "parametros": dict(data_run.params),
            "fim": data_run.finished_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "versao": data_run.version,
        },
        "pontos": [
            {"lat": p.lat, "lon": p.lon, "serie": _serie(records.get(point_id, []))}
            for point_id, p in located.items()
        ],
    }


# --- ORNL DAAC: calendário, blocos e respostas --------------------------------------------


def _modis_date(year: int, day_of_year: int) -> str:
    return f"A{year}{day_of_year:03d}"


def _modis_day(modis_date: str) -> date:
    """`A2016097` (ano + dia juliano) → 2016-04-06."""
    match = _MODIS_DATE.match(modis_date)
    if not match:
        raise OrnlError(f"Data do MODIS fora do formato AAAAADDD: {modis_date!r}")
    return date(int(match["year"]), 1, 1) + timedelta(days=int(match["doy"]) - 1)


def modis_calendar(product: str) -> list[str]:
    """Composições de 16 dias do produto em jan–jul dos anos do histórico, no formato da ORNL.

    Só para o plano do `--dry-run`: a extração usa a lista de datas que a própria ORNL devolve
    (conferida em 14/11/2026: as 140 do MOD13Q1 são as mesmas deste calendário).
    """
    first_day = COMPOSITE_FIRST_DAY[product]
    dates: list[str] = []
    for year in range(FIRST_YEAR, LAST_YEAR + 1):
        for day_of_year in range(first_day, 367, COMPOSITE_STEP_DAYS):
            day = date(year, 1, 1) + timedelta(days=day_of_year - 1)
            if day.year == year and day.month in SEASON_MONTHS:
                dates.append(_modis_date(year, day_of_year))
    return dates


def plan_blocks(
    modis_dates: Sequence[str], dates_per_request: int, skip: Iterable[str] = ()
) -> list[tuple[str, ...]]:
    """Agrupa as datas que faltam em blocos de até `dates_per_request`, sem cruzar o ano.

    Um recorte da ORNL vai do `startDate` ao `endDate`, então cada bloco é um trecho de datas
    seguidas: nunca cruza o ano (as datas de jan–jul de um ano são seguidas) nem passa por cima de
    uma data de `skip` (já no cache). Assim o recorte não traz data de fora da janela nem repetida.
    """
    if not 1 <= dates_per_request <= ORNL_MAX_DATES_PER_REQUEST:
        raise ValueError(
            f"datas por pedido: de 1 a {ORNL_MAX_DATES_PER_REQUEST} (limite da ORNL), "
            f"veio {dates_per_request}"
        )
    skipped = set(skip)
    runs: list[list[str]] = []
    previous_year = None
    for modis_date in sorted(set(modis_dates)):
        year = modis_date[1:5]
        if modis_date in skipped:
            previous_year = None  # fecha o trecho
            continue
        if year != previous_year:
            runs.append([])
            previous_year = year
        runs[-1].append(modis_date)
    return [
        tuple(run[i : i + dates_per_request])
        for run in runs
        for i in range(0, len(run), dates_per_request)
    ]


@dataclass(frozen=True)
class NdviBand:
    """Fator de escala e valor de preenchimento do NDVI, como a ORNL declara (`/bands`)."""

    scale: float
    fill: float


@dataclass(frozen=True)
class OrnlBlock:
    """Um recorte: um ponto, um produto e até 10 datas seguidas do mesmo ano."""

    point: Point
    product: str
    dates: tuple[str, ...]

    @property
    def start(self) -> str:
        return self.dates[0]

    @property
    def end(self) -> str:
        return self.dates[-1]

    @property
    def label(self) -> str:
        return f"{self.product} {self.start}–{self.end} ({self.point.lat}, {self.point.lon})"


def parse_ornl_bands(payload: Any) -> NdviBand:
    """Confere a lista de bandas do produto e devolve a escala e o preenchimento do NDVI."""
    bands = payload.get("bands") if isinstance(payload, dict) else None
    if not isinstance(bands, list):
        raise OrnlError("A lista de bandas da ORNL veio sem 'bands'.")
    by_name = {str(item.get("band")): item for item in bands if isinstance(item, dict)}
    missing = [band for band in ORNL_BANDS if band not in by_name]
    if missing:
        raise OrnlError(f"A ORNL não lista a banda {', '.join(missing)}.")
    ndvi = by_name[ORNL_NDVI_BAND]
    try:
        scale = float(ndvi["scale_factor"])
        fill = float(ndvi["fill_value"])
        offset = float(ndvi.get("add_offset", 0))
    except (KeyError, TypeError, ValueError) as exc:
        raise OrnlError(
            f"A banda {ORNL_NDVI_BAND} veio sem escala ou preenchimento: {exc}"
        ) from exc
    if scale <= 0 or offset != 0:
        raise OrnlError(f"Escala ({scale}) ou deslocamento ({offset}) inesperado no NDVI da ORNL.")
    return NdviBand(scale=scale, fill=fill)


def parse_ornl_dates(payload: Any) -> list[str]:
    """Confere a lista de datas e devolve só as composições de jan–jul dos anos do histórico."""
    dates = payload.get("dates") if isinstance(payload, dict) else None
    if not isinstance(dates, list):
        raise OrnlError("A lista de datas da ORNL veio sem 'dates'.")
    season: list[str] = []
    for item in dates:
        modis_date = item.get("modis_date") if isinstance(item, dict) else None
        day = _modis_day(str(modis_date))
        if _in_window(day):
            season.append(str(modis_date))
    return season


def _band_values(payload: Any) -> dict[tuple[str, str], float]:
    """(data, banda) → valor do pixel, só do NDVI e da qualidade; recusa valor fora do formato."""
    items = payload.get("subset") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        raise OrnlError("O recorte da ORNL veio sem 'subset'.")
    values: dict[tuple[str, str], float] = {}
    for item in items:
        if not isinstance(item, dict) or item.get("band") not in ORNL_BANDS:
            continue  # as outras bandas do produto (EVI, refletâncias...) não interessam
        band, modis_date, data = str(item["band"]), str(item.get("modis_date")), item.get("data")
        is_number = (
            isinstance(data, list)
            and len(data) == 1
            and isinstance(data[0], int | float)
            and not isinstance(data[0], bool)
        )
        if not is_number:
            raise OrnlError(
                f"O recorte da ORNL trouxe {band} de {modis_date} sem um pixel: {data!r}"
            )
        value = float(data[0])
        if not value.is_integer():
            # A ORNL entrega o inteiro bruto; um valor já escalado levaria a escala duas vezes.
            raise OrnlError(f"O recorte trouxe {band} de {modis_date} fora do bruto: {value}")
        values[(modis_date, band)] = value
    return values


def _has_both_bands(values: Mapping[tuple[str, str], float], modis_date: str) -> bool:
    return all((modis_date, band) in values for band in ORNL_BANDS)


def _subset_values(payload: Any, block: OrnlBlock) -> dict[tuple[str, str], float]:
    """Como `_band_values`, exigindo NDVI e qualidade em todas as datas do bloco."""
    values = _band_values(payload)
    missing = [f"{d} {b}" for d in block.dates for b in ORNL_BANDS if (d, b) not in values]
    if missing:
        raise OrnlError(f"O recorte {block.label} veio sem {', '.join(missing)}.")
    return values


def check_ornl_subset(payload: Any, block: OrnlBlock) -> None:
    """Levanta `OrnlError` se o recorte não trouxer as duas bandas, num pixel, em cada data."""
    _subset_values(payload, block)


def _observations(
    values: Mapping[tuple[str, str], float],
    modis_dates: Iterable[str],
    point: Point,
    product: str,
    point_id: str,
    band: NdviBand,
) -> list[Observation]:
    """Valores brutos → observações, com o NDVI multiplicado pela escala da ORNL.

    O valor de preenchimento vira `None` (sem dado); o filtro de qualidade e de faixa é o mesmo do
    AppEEARS (`build_ndvi_payload`). Data sem as duas bandas fica de fora.
    """
    observations: list[Observation] = []
    for modis_date in modis_dates:
        if not _has_both_bands(values, modis_date):
            continue
        raw = values[(modis_date, ORNL_NDVI_BAND)]
        ndvi = None if raw == band.fill else round(raw * band.scale, NDVI_DECIMALS)
        observations.append(
            Observation(
                point_id=point_id,
                lat=point.lat,
                lon=point.lon,
                day=_modis_day(modis_date),
                product=product,
                ndvi=ndvi,
                quality=int(values[(modis_date, ORNL_QUALITY_BAND)]),
            )
        )
    return observations


def parse_ornl_subset(
    payload: Any, block: OrnlBlock, point_id: str, band: NdviBand
) -> list[Observation]:
    """Recorte conferido → observações das datas do bloco, com a escala aplicada."""
    values = _subset_values(payload, block)
    return _observations(values, block.dates, block.point, block.product, point_id, band)


# --- ORNL DAAC: cliente, cache e extração -------------------------------------------------


class OrnlClient:
    """GET na API da ORNL com retentativa: rede, 5xx, 429 e corpo fora do formato tentam de novo.

    `fetch` devolve o corpo como veio (para o cache), já conferido pelo `check`.
    """

    def __init__(
        self,
        transport: HttpTransport,
        *,
        base_url: str = ORNL_API_URL,
        timeout: float = ORNL_TIMEOUT_SECONDS,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        log: Callable[[str], None] = _log,
        max_retries: int = ORNL_MAX_RETRIES,
        backoff_seconds: float = ORNL_BACKOFF_SECONDS,
    ) -> None:
        self._transport = transport
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._sleep = sleep
        self._clock = clock
        self._log = log
        self._max_retries = max_retries
        self._backoff_seconds = backoff_seconds
        self.last_seconds = 0.0

    def fetch(
        self,
        path: str,
        params: dict[str, Any],
        check: Callable[[Any], object],
        label: str,
        max_retries: int | None = None,
    ) -> str:
        request = HttpRequest(method="GET", url=f"{self._base_url}/{path}", params=params)
        attempts = (self._max_retries if max_retries is None else max_retries) + 1
        problem = ""
        for attempt in range(attempts):
            if attempt:
                wait = self._backoff_seconds * 2 ** (attempt - 1)
                self._log(f"{label}: {problem}; tento de novo em {wait:g} s.")
                self._sleep(wait)
            started = self._clock()
            try:
                response = self._transport(request, self._timeout)
            except OSError as exc:
                problem = f"falha de rede ({exc})"
                continue
            elapsed = self._clock() - started
            if response.status == 200:
                try:
                    text = response.text()
                    check(json.loads(text))
                except (ValueError, OrnlError) as exc:
                    problem = f"resposta fora do formato ({exc})"
                    continue
                self.last_seconds = elapsed
                return text
            if response.status >= 500 or response.status in _RETRY_STATUS:
                problem = f"HTTP {response.status} em {elapsed:.0f} s"
                continue
            raise OrnlError(
                f"A ORNL recusou o pedido de {label} (HTTP {response.status}): "
                f"{_server_message(response)}"
            )
        raise OrnlUnavailableError(
            f"{label}: a ORNL não deu resposta válida em {attempts} tentativas ({problem})."
        )


class CachedOrnlFetcher:
    """Pede cada resposta à ORNL uma vez só e guarda no cache (é o que permite a retomada).

    Só entra no cache resposta conferida, gravada num arquivo provisório e renomeada no fim: um
    arquivo pela metade nunca fica com o nome final. Pasta: `<cache>/<produto>_bandas.json` e
    `<cache>/lat<lat>_lon<lon>/<produto>/` (`datas.json` e `<início>_<fim>.json`).
    """

    def __init__(
        self,
        client: OrnlClient,
        cache_dir: Path,
        *,
        pause_seconds: float = ORNL_PAUSE_SECONDS,
        sleep: Callable[[float], None] = time.sleep,
        log: Callable[[str], None] = _log,
    ) -> None:
        self._client = client
        self._cache_dir = cache_dir
        self._pause_seconds = pause_seconds
        self._sleep = sleep
        self._log = log
        self.downloads = 0

    # --- caminhos ---

    def _point_dir(self, point: Point) -> Path:
        return self._cache_dir / f"lat{point.lat:.4f}_lon{point.lon:.4f}"

    def _bands_path(self, product: str) -> Path:
        return self._cache_dir / f"{product}_bandas.json"

    def _dates_path(self, point: Point, product: str) -> Path:
        return self._point_dir(point) / product / "datas.json"

    def _subset_path(self, block: OrnlBlock) -> Path:
        return self._point_dir(block.point) / block.product / f"{block.start}_{block.end}.json"

    # --- leitura com cache ---

    def _read_cached(self, path: Path, check: Callable[[Any], object]) -> Any | None:
        if not path.is_file():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            check(payload)
        except (ValueError, OrnlError):
            self._log(f"Cache fora do formato em {path}; pedindo de novo.")
            return None
        return payload

    def _get(
        self,
        path: Path,
        endpoint: str,
        params: dict[str, Any],
        check: Callable[[Any], object],
        label: str,
        max_retries: int | None = None,
    ) -> Any:
        cached = self._read_cached(path, check)
        if cached is not None:
            return cached
        text = self._client.fetch(endpoint, params, check, label, max_retries)
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(f"{path.name}.{os.getpid()}.part")
        partial.write_text(text, encoding="utf-8")
        partial.replace(path)
        self.downloads += 1
        self._log(f"[{self.downloads}] {label} ({self._client.last_seconds:.0f} s)")
        self._sleep(self._pause_seconds)
        return json.loads(text)

    def ndvi_band(self, product: str) -> NdviBand:
        payload = self._get(
            self._bands_path(product),
            f"{product}/bands",
            {},
            parse_ornl_bands,
            f"bandas do {product}",
        )
        return parse_ornl_bands(payload)

    def season_dates(self, point: Point, product: str) -> list[str]:
        payload = self._get(
            self._dates_path(point, product),
            f"{product}/dates",
            {"latitude": point.lat, "longitude": point.lon},
            parse_ornl_dates,
            f"datas do {product} ({point.lat}, {point.lon})",
        )
        return parse_ornl_dates(payload)

    def subset_params(self, block: OrnlBlock) -> dict[str, Any]:
        """Um pixel (0 km para os lados), todas as bandas: NDVI e qualidade num pedido só."""
        return {
            "latitude": block.point.lat,
            "longitude": block.point.lon,
            "startDate": block.start,
            "endDate": block.end,
            "kmAboveBelow": 0,
            "kmLeftRight": 0,
        }

    def subset(self, block: OrnlBlock, max_retries: int | None = None) -> Any:
        return self._get(
            self._subset_path(block),
            f"{block.product}/subset",
            self.subset_params(block),
            lambda payload: check_ornl_subset(payload, block),
            f"recorte {block.label}",
            max_retries,
        )

    def cached_values(self, point: Point, product: str) -> dict[tuple[str, str], float]:
        """(data, banda) → valor de todos os recortes guardados do ponto e produto.

        Lê por data, não pelo nome do bloco: mudar o `--datas-por-pedido` (ou dividir um bloco que
        falhou) não perde o que já veio. Arquivo fora do formato é ignorado (pedido de novo).
        """
        values: dict[tuple[str, str], float] = {}
        folder = self._point_dir(point) / product
        for path in sorted(folder.glob("A*_A*.json")):
            try:
                values.update(_band_values(json.loads(path.read_text(encoding="utf-8"))))
            except (ValueError, OrnlError):
                self._log(f"Cache fora do formato em {path}; essas datas serão pedidas de novo.")
        return values

    # --- só para o plano do --dry-run ---

    def is_bands_cached(self, product: str) -> bool:
        return self._read_cached(self._bands_path(product), parse_ornl_bands) is not None

    def cached_season_dates(self, point: Point, product: str) -> list[str] | None:
        payload = self._read_cached(self._dates_path(point, product), parse_ornl_dates)
        return None if payload is None else parse_ornl_dates(payload)


@dataclass(frozen=True)
class OrnlFetchResult:
    observations: list[Observation]
    failed_blocks: list[str]
    scales: dict[str, float]


class _FailureTracker:
    """Guarda os recortes que falharam e desiste depois de `limit` seguidos (a ORNL caiu)."""

    def __init__(self, limit: int, log: Callable[[str], None]) -> None:
        self._limit = limit
        self._log = log
        self._consecutive = 0
        self.failed: list[str] = []

    def success(self) -> None:
        self._consecutive = 0

    def failure(self, block: OrnlBlock, exc: OrnlUnavailableError) -> None:
        self._log(str(exc))
        self.failed.append(block.label)
        self._consecutive += 1
        if self._consecutive >= self._limit:
            raise OrnlUnavailableError(
                f"{self._consecutive} recortes seguidos sem resposta: a ORNL parece fora do ar."
            ) from exc


def _fetch_block(
    fetcher: CachedOrnlFetcher,
    block: OrnlBlock,
    tracker: _FailureTracker,
    log: Callable[[str], None],
) -> dict[tuple[str, str], float]:
    """Pede o recorte; se falhar e tiver mais de uma data, divide em duas metades e pede cada uma.

    Bloco de várias datas tenta `ORNL_RETRIES_BEFORE_SPLIT` vez(es) a mais antes de dividir (um
    recorte menor cabe melhor nos ~60 s do proxy); bloco de uma data usa todas as retentativas e,
    se ainda falhar, conta como falha.
    """
    single = len(block.dates) == 1
    try:
        payload = fetcher.subset(block, None if single else ORNL_RETRIES_BEFORE_SPLIT)
    except OrnlUnavailableError as exc:
        if single:
            tracker.failure(block, exc)
            return {}
        half = (len(block.dates) + 1) // 2
        log(f"{block.label}: sem resposta; divido em {half} + {len(block.dates) - half} datas.")
        values = _fetch_block(fetcher, replace(block, dates=block.dates[:half]), tracker, log)
        values.update(_fetch_block(fetcher, replace(block, dates=block.dates[half:]), tracker, log))
        return values
    tracker.success()
    return _subset_values(payload, block)


def fetch_ornl_observations(
    points: Sequence[Point],
    fetcher: CachedOrnlFetcher,
    dates_per_request: int,
    log: Callable[[str], None] = _log,
) -> OrnlFetchResult:
    """Todas as composições de jan–jul dos dois produtos, ponto a ponto.

    Pede só as datas que ainda não estão no cache. Data sem resposta depois das retentativas e da
    divisão fica de fora (o recorte vai em `failed_blocks`); após `ORNL_MAX_CONSECUTIVE_FAILURES`
    seguidos, desiste com `OrnlUnavailableError`.
    """
    bands = {product: fetcher.ndvi_band(product) for product in PRODUCTS}
    tracker = _FailureTracker(ORNL_MAX_CONSECUTIVE_FAILURES, log)
    observations: list[Observation] = []
    for index, point in enumerate(points):
        for product in PRODUCTS:
            dates = fetcher.season_dates(point, product)
            values = fetcher.cached_values(point, product)
            cached = [d for d in dates if _has_both_bands(values, d)]
            for block_dates in plan_blocks(dates, dates_per_request, skip=cached):
                block = OrnlBlock(point, product, block_dates)
                values.update(_fetch_block(fetcher, block, tracker, log))
            observations.extend(
                _observations(values, dates, point, product, _point_id(index), bands[product])
            )
    return OrnlFetchResult(
        observations=observations,
        failed_blocks=tracker.failed,
        scales={product: band.scale for product, band in bands.items()},
    )


def _duration(seconds: float) -> str:
    if seconds < 3600:
        return f"{max(1, round(seconds / 60))} min"
    return f"{seconds / 3600:.1f} h".replace(".", ",")


def ornl_plan_text(
    points: Sequence[Point],
    fetcher: CachedOrnlFetcher,
    dates_per_request: int,
    pause_seconds: float,
) -> str:
    """Plano do `--dry-run`: quantos pedidos faltam, o que já está no cache e o tempo estimado.

    Sem a lista de datas no cache, conta pelo calendário do MODIS (`modis_calendar`). Não conta as
    retentativas nem as divisões de bloco.
    """
    bands = sum(1 for product in PRODUCTS if not fetcher.is_bands_cached(product))
    dates_lists = subsets = composites = cached_composites = 0
    for point in points:
        for product in PRODUCTS:
            dates = fetcher.cached_season_dates(point, product)
            if dates is None:
                dates_lists += 1
                dates = modis_calendar(product)
            values = fetcher.cached_values(point, product)
            cached = [d for d in dates if _has_both_bands(values, d)]
            subsets += len(plan_blocks(dates, dates_per_request, skip=cached))
            composites += len(dates)
            cached_composites += len(cached)
    pending = bands + dates_lists + subsets
    seconds = pending * (ORNL_MEASURED_SECONDS_PER_REQUEST + pause_seconds)
    pause = f"{pause_seconds:g}".replace(".", ",")
    return "\n".join(
        [
            f"NDVI pela ORNL DAAC ({ORNL_API_URL}), sem credencial.",
            f"Pontos: {len(points)} | produtos: {', '.join(PRODUCTS)} | {FIRST_YEAR} a "
            f"{LAST_YEAR}, janeiro a julho | até {dates_per_request} datas por pedido",
            f"Pedidos que faltam: {pending} ({bands} de bandas, {dates_lists} de datas, "
            f"{subsets} recortes) | composições já no cache: {cached_composites} de {composites}",
            f"Tempo estimado: ~{_duration(seconds)} (~{ORNL_MEASURED_SECONDS_PER_REQUEST:g} s por "
            f"pedido, como na rodada real com os 502 e as retentativas, mais {pause} s de pausa; "
            "os que dão certo levam de 23 a 60 s)",
        ]
    )


# --- linha de comando ---------------------------------------------------------------------


def parse_points(text: str) -> list[Point]:
    """`"lat,lon;lat,lon"` → pontos (WGS 84, graus decimais)."""
    points: list[Point] = []
    for chunk in text.split(";"):
        if not chunk.strip():
            continue
        parts = [part.strip() for part in chunk.split(",")]
        if len(parts) != 2:
            raise ValueError(f"Ponto inválido {chunk.strip()!r}: use lat,lon")
        lat, lon = float(parts[0]), float(parts[1])
        if not -90 <= lat <= 90:
            raise ValueError(f"latitude fora de −90 a 90: {lat}")
        if not -180 <= lon <= 180:
            raise ValueError(f"longitude fora de −180 a 180: {lon}")
        points.append(Point(lat, lon))
    if not points:
        raise ValueError("Nenhum ponto informado: use lat,lon;lat,lon")
    return points


def _dates_per_request(text: str) -> int:
    value = int(text)
    if not 1 <= value <= ORNL_MAX_DATES_PER_REQUEST:
        raise argparse.ArgumentTypeError(
            f"de 1 a {ORNL_MAX_DATES_PER_REQUEST} (limite da ORNL), veio {value}"
        )
    return value


def _join_points_flag(argv: Sequence[str]) -> list[str]:
    """`--pontos -18.9,-48.1` → `--pontos=-18.9,-48.1`: o argparse leria o valor como opção."""
    joined: list[str] = []
    items = iter(argv)
    for item in items:
        if item == "--pontos":
            value = next(items, None)
            joined.append(item if value is None else f"--pontos={value}")
        else:
            joined.append(item)
    return joined


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    argv = _join_points_flag(sys.argv[1:] if argv is None else argv)
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.fetch_ndvi",
        description="NDVI do MODIS (MOD13Q1 + MYD13Q1, 061) por ponto, pelo AppEEARS ou pela ORNL.",
    )
    parser.add_argument(
        "--fonte",
        choices=(APPEEARS_SERVICE, ORNL_SERVICE),
        default=APPEEARS_SERVICE,
        help="appeears (padrão; tarefa na fila, com credencial) ou ornl (sem credencial e sem "
        "fila, mas lento)",
    )
    parser.add_argument(
        "--pontos",
        type=parse_points,
        default=[DEFAULT_POINT],
        help='"lat,lon;lat,lon" (padrão: a fazenda de exemplo, -18.9543,-48.1993)',
    )
    parser.add_argument(
        "--saida",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="arquivo JSON (padrão: data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json)",
    )
    parser.add_argument("--dry-run", action="store_true", help="só mostra o pedido, sem rede")
    parser.add_argument(
        "--cache",
        type=Path,
        help=f"ornl: pasta das respostas guardadas (padrão: {ORNL_CACHE_DIR_NAME}/ ao lado da "
        "saída)",
    )
    parser.add_argument(
        "--datas-por-pedido",
        type=_dates_per_request,
        default=ORNL_DEFAULT_DATES_PER_REQUEST,
        help=f"ornl: datas por recorte, de 1 a {ORNL_MAX_DATES_PER_REQUEST} "
        f"(padrão {ORNL_DEFAULT_DATES_PER_REQUEST})",
    )
    parser.add_argument(
        "--pausa",
        type=float,
        default=ORNL_PAUSE_SECONDS,
        help=f"ornl: segundos entre os pedidos (padrão {ORNL_PAUSE_SECONDS:g})",
    )
    parser.add_argument("--tarefa-existente", help="id de uma tarefa já criada, para retomar")
    parser.add_argument(
        "--csv",
        type=Path,
        action="append",
        help="converte um *-results.csv já baixado, sem rede (pode repetir)",
    )
    parser.add_argument("--nome-tarefa", help="nome da tarefa no AppEEARS")
    parser.add_argument("--intervalo", type=float, default=DEFAULT_POLL_SECONDS, help="segundos")
    parser.add_argument(
        "--limite-minutos", type=float, default=DEFAULT_LIMIT_MINUTES, help="espera máxima"
    )
    return parser.parse_args(argv)


def credentials_from_settings() -> Credentials:
    settings = get_settings()

    def clean(value: str | None) -> str | None:
        return value.strip() or None if value else None

    return Credentials(
        token=clean(settings.appeears_token),
        username=clean(settings.earthdata_username),
        password=clean(settings.earthdata_password),
    )


def _save_raw_csvs(files: dict[str, bytes], folder: Path, log: Callable[[str], None]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        safe_name = Path(name).name  # o nome vem do servidor: nunca um caminho
        if safe_name in ("", ".", ".."):
            continue
        (folder / safe_name).write_bytes(content)
    log(f"CSVs brutos guardados em {folder}")


def _write_payload(payload: dict[str, Any], output: Path, log: Callable[[str], None]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    partial = output.with_name(f"{output.name}.{os.getpid()}.part")
    partial.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    partial.replace(output)  # a API nunca lê um arquivo pela metade
    counts = ", ".join(f"({p['lat']}, {p['lon']}): {len(p['serie'])}" for p in payload["pontos"])
    log(f"NDVI gravado em {output}. Observações por ponto: {counts}")
    if any(not p["serie"] for p in payload["pontos"]):
        log("Atenção: algum ponto ficou sem nenhuma observação boa.")


def _run_ornl(
    args: argparse.Namespace,
    *,
    transport: HttpTransport,
    sleep: Callable[[float], None],
    clock: Callable[[], float],
    now: Callable[[], datetime],
    log: Callable[[str], None],
) -> int:
    points: list[Point] = args.pontos
    cache_dir: Path = args.cache or args.saida.parent / ORNL_CACHE_DIR_NAME
    client = OrnlClient(transport, sleep=sleep, clock=clock, log=log)
    fetcher = CachedOrnlFetcher(client, cache_dir, pause_seconds=args.pausa, sleep=sleep, log=log)

    if args.dry_run:
        print(ornl_plan_text(points, fetcher, args.datas_por_pedido, args.pausa))
        print(f"Saída: {args.saida}\nCache: {cache_dir}")
        log("(dry-run) nada foi pedido à ORNL.")
        return 0

    resume_hint = f"O que já veio está em {cache_dir}: rode de novo que continua de onde parou."
    try:
        result = fetch_ornl_observations(points, fetcher, args.datas_por_pedido, log)
    except OrnlUnavailableError as exc:
        log(f"{exc} Nada foi gravado em {args.saida}. {resume_hint}")
        return 2
    except (OrnlError, OSError, ValueError) as exc:
        log(f"Erro: {exc}")
        return 1
    if result.failed_blocks:
        log(
            f"{len(result.failed_blocks)} recorte(s) sem resposta da ORNL: "
            f"{'; '.join(result.failed_blocks)}. Nada foi gravado em {args.saida}. {resume_hint}"
        )
        return 2

    scales = sorted(set(result.scales.values()))
    payload = build_ndvi_payload(
        result.observations,
        points,
        now(),
        service=ORNL_SERVICE,
        extra_params={"fator_escala": scales[0] if len(scales) == 1 else result.scales},
    )
    _write_payload(payload, args.saida, log)
    return 0


def run(
    argv: Sequence[str] | None = None,
    *,
    transport: HttpTransport = default_http_request,
    load_credentials: Callable[[], Credentials] = credentials_from_settings,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    log: Callable[[str], None] = _log,
) -> int:
    """Executa o script. Devolve 0 (ok), 1 (erro) ou 2 (incompleto: rode ou retome depois)."""
    args = _parse_args(argv)
    points: list[Point] = args.pontos
    if args.fonte == ORNL_SERVICE:
        return _run_ornl(args, transport=transport, sleep=sleep, clock=clock, now=now, log=log)
    task_name = args.nome_tarefa or f"raiz-orbital-ndvi-{now():%Y%m%d-%H%M%S}"

    if args.dry_run:
        print(json.dumps(build_task_request(points, task_name), ensure_ascii=False, indent=2))
        log(f"(dry-run) nada foi pedido ao AppEEARS. A saída iria para {args.saida}")
        return 0

    try:
        if args.csv:
            observations = [
                obs for path in args.csv for obs in parse_appeears_csv(path.read_text("utf-8-sig"))
            ]
            _write_payload(build_ndvi_payload(observations, None, now()), args.saida, log)
            return 0

        client = AppeearsClient(transport, load_credentials(), sleep=sleep, clock=clock, log=log)
        client.authenticate()
        task_id = args.tarefa_existente
        if not task_id:
            task_id = client.submit_task(build_task_request(points, task_name))
            log(
                f"Tarefa criada no AppEEARS: {task_id} (para retomar: --tarefa-existente {task_id})"
            )
        client.wait_for_task(task_id, args.intervalo, args.limite_minutos * 60)
        files = client.download_results(task_id)
        _save_raw_csvs(files, args.saida.parent / f"appeears_{task_id}", log)
        observations = [
            obs
            for content in files.values()
            for obs in parse_appeears_csv(content.decode("utf-8-sig"))
        ]
        payload = build_ndvi_payload(observations, points, now(), task_id=task_id)
        _write_payload(payload, args.saida, log)
        return 0
    except TaskTimeoutError as exc:
        log(str(exc))
        return 2
    except (AppeearsError, OSError, ValueError) as exc:
        log(f"Erro: {exc}")
        return 1


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
