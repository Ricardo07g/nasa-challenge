"""Baixa a série de NDVI do MODIS (MOD13Q1 e MYD13Q1, coleção 061) por ponto, pelo AppEEARS.

Roteiro R2.2 (tarefa 0017). Grava o arquivo no formato do contrato (`AGENTS.md` do backend,
"Contrato dos dados das fontes" → NDVI), que o `CachedNdviRepository` lê (`NDVI_CACHE_PATH`).

Uso (a partir de projeto/backend; as credenciais vêm do `.env` pelo `Settings`):

    uv run python -m pipeline.fetch_ndvi                       # fazenda de exemplo
    uv run python -m pipeline.fetch_ndvi --pontos "-18.9543,-48.1993;-17.5,-47.25"
    uv run python -m pipeline.fetch_ndvi --dry-run             # mostra o pedido, sem rede
    uv run python -m pipeline.fetch_ndvi --tarefa-existente <id>   # retoma uma tarefa já criada
    uv run python -m pipeline.fetch_ndvi --csv <arquivo-results.csv>  # converte CSV já baixado

Autenticação, nesta ordem: `APPEEARS_TOKEN` (Bearer do próprio AppEEARS, vale ~48 h); se faltar ou
for recusado (401/403), `POST /api/login` com `EARTHDATA_USERNAME` e `EARTHDATA_PASSWORD`. O
`EARTHDATA_TOKEN` não serve (o AppEEARS devolve 403). Nenhuma mensagem mostra token ou senha.

Fluxo: tarefa `point` (todos os pontos numa tarefa) → consulta do status até `done` → lista do
bundle → download dos `*-results.csv` (guardados em `appeears_<tarefa>/`, ao lado da saída) →
filtro (qualidade 0 ou 1, jan–jul de 2016 a 2025, sem o valor de preenchimento) → JSON do contrato.
"""

import argparse
import base64
import csv
import io
import json
import re
import sys
import time
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
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

APPEEARS_API_URL: Final[str] = "https://appeears.earthdatacloud.nasa.gov/api"
SOURCE_KEY: Final[str] = "modis_mod13q1"
COLLECTION: Final[str] = "061"
# Terra e Aqua, defasados em 8 dias: juntos dão ~14 imagens em abr–jul em vez de 7 (guia NDVI).
PRODUCTS: Final[tuple[str, ...]] = ("MOD13Q1", "MYD13Q1")
# Nomes conferidos em GET /api/product/MOD13Q1.061 e /MYD13Q1.061.
NDVI_LAYER: Final[str] = "_250m_16_days_NDVI"
QUALITY_LAYER: Final[str] = "_250m_16_days_pixel_reliability"
# Decisão do time: 2016 a 2025, janeiro a julho (abr–jul é o histórico do talhão; jan–mar serve
# para a colheita sugerida da soja). O AppEEARS aceita a janela recorrente em MM-DD.
FIRST_YEAR: Final[int] = 2016
LAST_YEAR: Final[int] = 2025
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

_NDVI_COLUMN = re.compile(rf"^(?P<product>M[OY]D13Q1)_(?P<version>\d{{3}})_{NDVI_LAYER}$")
_TOKEN_REJECTED: Final[frozenset[int]] = frozenset({401, 403})


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


def build_ndvi_payload(
    observations: Sequence[Observation],
    points: Sequence[Point] | None,
    finished_at: datetime,
    task_id: str | None = None,
) -> dict[str, Any]:
    """Monta o JSON do contrato do NDVI. Sem `points` (CSV avulso), usa os pontos do próprio CSV."""
    records = _clean_records(observations)
    located: dict[str, Point] = {_point_id(i): p for i, p in enumerate(points or [])}
    for obs in observations:
        located.setdefault(obs.point_id, Point(obs.lat, obs.lon))

    params: dict[str, Any] = {
        "servico": "appeears",
        "produtos": list(PRODUCTS),
        "colecao": COLLECTION,
        "camadas": [NDVI_LAYER, QUALITY_LAYER],
        "anos": [FIRST_YEAR, LAST_YEAR],
        "meses": sorted(SEASON_MONTHS),
        "qualidade_aceita": sorted(ACCEPTED_QUALITY),
        "pontos": len(located),
    }
    if task_id:
        params["tarefa"] = task_id
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


def _default_output() -> Path:
    here = Path(__file__).resolve()
    root = here.parents[3] if len(here.parents) > 3 else Path.cwd()
    return root / "data" / "output" / OUTPUT_FILE_NAME


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
        description="NDVI do MODIS (MOD13Q1 + MYD13Q1, 061) por ponto, pelo AppEEARS.",
    )
    parser.add_argument(
        "--pontos",
        type=parse_points,
        default=[DEFAULT_POINT],
        help='"lat,lon;lat,lon" (padrão: a fazenda de exemplo, -18.9543,-48.1993)',
    )
    parser.add_argument("--saida", type=Path, default=_default_output(), help="arquivo JSON")
    parser.add_argument("--dry-run", action="store_true", help="só mostra o pedido, sem rede")
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
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = ", ".join(f"({p['lat']}, {p['lon']}): {len(p['serie'])}" for p in payload["pontos"])
    log(f"NDVI gravado em {output}. Observações por ponto: {counts}")
    if any(not p["serie"] for p in payload["pontos"]):
        log("Atenção: algum ponto ficou sem nenhuma observação boa.")


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
    """Executa o script. Devolve 0 (ok), 1 (erro) ou 2 (tarefa ainda rodando: retome depois)."""
    args = _parse_args(argv)
    points: list[Point] = args.pontos
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
