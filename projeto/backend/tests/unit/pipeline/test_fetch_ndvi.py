"""Testes do script do NDVI do MODIS pelo AppEEARS (R2.2), com HTTP falso (sem rede real).

Os números de NDVI aqui são valores de teste, não dados do MODIS.
"""

import base64
import json
import urllib.parse
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from app.models.data_run import DataRun
from app.models.talhao import NdviRecord
from app.repositories.external.http_client import HttpRequest, HttpResponse
from app.repositories.rules_repository import load_default_rules
from pipeline.fetch_ndvi import (
    DEFAULT_POINT,
    FIRST_YEAR,
    LAST_YEAR,
    AppeearsClient,
    AppeearsError,
    Credentials,
    MissingCredentialsError,
    Point,
    TaskTimeoutError,
    build_ndvi_payload,
    build_task_request,
    parse_appeears_csv,
    parse_points,
    run,
)

TEST_TOKEN = "token-de-teste"
NEW_TOKEN = "token-novo-de-teste"
TEST_USER = "usuario-de-teste"
TEST_PASSWORD = "senha-de-teste"
FINISHED_AT = datetime(2026, 11, 14, 13, 0, tzinfo=UTC)

# Cabeçalho no formato do CSV de amostra por ponto do AppEEARS (um arquivo por produto).
MOD_HEADER = (
    "ID,Latitude,Longitude,Date,MODIS_Tile,MOD13Q1_061_Line_Y_250m,MOD13Q1_061_Sample_X_250m,"
    "MOD13Q1_061__250m_16_days_NDVI,MOD13Q1_061__250m_16_days_pixel_reliability,"
    "MOD13Q1_061__250m_16_days_VI_Quality,MOD13Q1_061__250m_16_days_VI_Quality_MODLAND,"
    "MOD13Q1_061__250m_16_days_VI_Quality_MODLAND_Description"
)
MYD_HEADER = MOD_HEADER.replace("MOD13Q1", "MYD13Q1")


def _row(day: str, ndvi: str, quality: str, point_id: str = "p1") -> str:
    return f"{point_id},-18.9543,-48.1993,{day},h13v10,100,200,{ndvi},{quality},2116,0,teste"


def _response(status: int, payload: object = None, body: bytes | None = None) -> HttpResponse:
    if body is None:
        body = json.dumps(payload).encode("utf-8") if payload is not None else b""
    return HttpResponse(status=status, body=body)


class FakeTransport:
    """Responde por (método, caminho) com respostas prontas, na ordem, e guarda os pedidos."""

    def __init__(self, routes: dict[tuple[str, str], list[HttpResponse]]) -> None:
        self._routes = {key: list(value) for key, value in routes.items()}
        self.requests: list[HttpRequest] = []

    def __call__(self, request: HttpRequest, timeout: float) -> HttpResponse:
        self.requests.append(request)
        key = (request.method, urllib.parse.urlparse(request.url).path)
        if not self._routes.get(key):
            raise AssertionError(f"pedido inesperado: {key}")
        return self._routes[key].pop(0)

    def calls(self, method: str, path: str) -> list[HttpRequest]:
        return [
            r
            for r in self.requests
            if r.method == method and urllib.parse.urlparse(r.url).path == path
        ]


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def time(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def _client(transport: FakeTransport, credentials: Credentials) -> AppeearsClient:
    clock = FakeClock()
    return AppeearsClient(
        transport, credentials, sleep=clock.sleep, clock=clock.time, log=lambda _msg: None
    )


# --- autenticação -------------------------------------------------------------------------


def test_should_use_the_appeears_token_when_it_is_accepted() -> None:
    transport = FakeTransport({("GET", "/api/task"): [_response(200, [])]})
    client = _client(transport, Credentials(token=TEST_TOKEN))

    client.authenticate()

    assert transport.requests[0].authorization == f"Bearer {TEST_TOKEN}"
    assert transport.calls("POST", "/api/login") == []


def test_should_login_with_earthdata_user_when_the_token_is_rejected() -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(403, {"message": "sem permissao"})],
            ("POST", "/api/login"): [_response(200, {"token_type": "Bearer", "token": NEW_TOKEN})],
            ("POST", "/api/task"): [_response(202, {"task_id": "tarefa-1", "status": "pending"})],
        }
    )
    client = _client(transport, Credentials(TEST_TOKEN, TEST_USER, TEST_PASSWORD))

    client.authenticate()
    client.submit_task(build_task_request([DEFAULT_POINT], "teste"))

    basic = base64.b64encode(f"{TEST_USER}:{TEST_PASSWORD}".encode()).decode()
    assert transport.calls("POST", "/api/login")[0].authorization == f"Basic {basic}"
    assert transport.calls("POST", "/api/task")[0].authorization == f"Bearer {NEW_TOKEN}"


def test_should_login_directly_when_there_is_no_token() -> None:
    transport = FakeTransport(
        {("POST", "/api/login"): [_response(200, {"token_type": "Bearer", "token": NEW_TOKEN})]}
    )
    client = _client(transport, Credentials(username=TEST_USER, password=TEST_PASSWORD))

    client.authenticate()

    assert [r.method for r in transport.requests] == ["POST"]


def test_should_stop_with_a_clear_message_without_any_credential() -> None:
    client = _client(FakeTransport({}), Credentials())

    with pytest.raises(MissingCredentialsError, match="APPEEARS_TOKEN.*EARTHDATA_USERNAME"):
        client.authenticate()


def test_should_never_show_the_token_or_password_in_error_messages() -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(403, {"message": "sem permissao"})],
            ("POST", "/api/login"): [_response(401, {"message": "credencial errada"})],
        }
    )
    client = _client(transport, Credentials(TEST_TOKEN, TEST_USER, TEST_PASSWORD))

    with pytest.raises(AppeearsError) as excinfo:
        client.authenticate()

    message = str(excinfo.value)
    assert "401" in message
    assert TEST_TOKEN not in message
    assert TEST_PASSWORD not in message
    assert TEST_TOKEN not in repr(Credentials(TEST_TOKEN, TEST_USER, TEST_PASSWORD))


def test_should_ask_for_a_new_token_when_it_is_rejected_and_there_is_no_login() -> None:
    transport = FakeTransport({("GET", "/api/task"): [_response(403, {"message": "x"})]})
    client = _client(transport, Credentials(token=TEST_TOKEN))

    with pytest.raises(MissingCredentialsError, match="recusou o APPEEARS_TOKEN"):
        client.authenticate()


# --- tarefa -------------------------------------------------------------------------------


def test_should_take_the_default_years_from_the_field_history_rules() -> None:
    # Um lugar só para a janela de anos: o grupo historico_ndvi do regras.yaml (2017 a 2026).
    historico = load_default_rules().historico_ndvi

    assert (FIRST_YEAR, LAST_YEAR) == (historico.ano_inicio, historico.ano_fim) == (2017, 2026)


def test_should_build_a_point_task_for_both_products_from_january_to_july() -> None:
    points = [Point(-18.9543, -48.1993), Point(-17.5, -47.25)]

    request = build_task_request(points, "raiz-ndvi-teste")

    assert request["task_type"] == "point"
    assert request["task_name"] == "raiz-ndvi-teste"
    params = request["params"]
    assert params["dates"] == [
        {"startDate": "01-01", "endDate": "07-31", "recurring": True, "yearRange": [2017, 2026]}
    ]
    assert params["layers"] == [
        {"product": "MOD13Q1.061", "layer": "_250m_16_days_NDVI"},
        {"product": "MOD13Q1.061", "layer": "_250m_16_days_pixel_reliability"},
        {"product": "MYD13Q1.061", "layer": "_250m_16_days_NDVI"},
        {"product": "MYD13Q1.061", "layer": "_250m_16_days_pixel_reliability"},
    ]
    assert params["coordinates"] == [
        {"id": "p1", "latitude": -18.9543, "longitude": -48.1993},
        {"id": "p2", "latitude": -17.5, "longitude": -47.25},
    ]


def test_should_submit_the_task_and_return_its_id() -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("POST", "/api/task"): [_response(202, {"task_id": "tarefa-1", "status": "pending"})],
        }
    )
    client = _client(transport, Credentials(token=TEST_TOKEN))
    client.authenticate()
    task = build_task_request([DEFAULT_POINT], "teste")

    assert client.submit_task(task) == "tarefa-1"
    assert transport.calls("POST", "/api/task")[0].json_body == task


def test_should_explain_a_rejected_task_with_the_server_message() -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("POST", "/api/task"): [_response(400, {"message": "'task_name' is required"})],
        }
    )
    client = _client(transport, Credentials(token=TEST_TOKEN))
    client.authenticate()

    with pytest.raises(AppeearsError, match="400.*task_name"):
        client.submit_task(build_task_request([DEFAULT_POINT], "teste"))


def test_should_poll_the_task_until_it_is_done() -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("GET", "/api/task/tarefa-1"): [
                _response(200, {"status": "pending"}),
                _response(200, {"status": "processing"}),
                _response(200, {"status": "done"}),
            ],
        }
    )
    clock = FakeClock()
    client = AppeearsClient(
        transport,
        Credentials(token=TEST_TOKEN),
        sleep=clock.sleep,
        clock=clock.time,
        log=lambda _msg: None,
    )
    client.authenticate()

    client.wait_for_task("tarefa-1", poll_interval=30, timeout=600)

    assert clock.sleeps == [30, 30]


def test_should_fail_when_the_task_ends_with_error() -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("GET", "/api/task/tarefa-1"): [_response(200, {"status": "error", "error": "x"})],
        }
    )
    client = _client(transport, Credentials(token=TEST_TOKEN))
    client.authenticate()

    with pytest.raises(AppeearsError, match="tarefa-1"):
        client.wait_for_task("tarefa-1", poll_interval=30, timeout=600)


def test_should_give_up_waiting_after_the_time_limit_and_keep_the_task_id() -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("GET", "/api/task/tarefa-1"): [_response(200, {"status": "processing"})] * 5,
        }
    )
    client = _client(transport, Credentials(token=TEST_TOKEN))
    client.authenticate()

    with pytest.raises(TaskTimeoutError) as excinfo:
        client.wait_for_task("tarefa-1", poll_interval=30, timeout=60)

    assert excinfo.value.task_id == "tarefa-1"


def test_should_download_only_the_results_csv_files_of_the_bundle() -> None:
    bundle = {
        "files": [
            {"file_id": "f1", "file_name": "teste-MOD13Q1-061-results.csv", "file_type": "csv"},
            {"file_id": "f2", "file_name": "teste-granule-list.txt", "file_type": "txt"},
            {"file_id": "f3", "file_name": "teste-MYD13Q1-061-results.csv", "file_type": "csv"},
            {"file_id": "f4", "file_name": "README.md", "file_type": "txt"},
        ]
    }
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("GET", "/api/bundle/tarefa-1"): [_response(200, bundle)],
            ("GET", "/api/bundle/tarefa-1/f1"): [_response(200, body=b"mod")],
            ("GET", "/api/bundle/tarefa-1/f3"): [_response(200, body=b"myd")],
        }
    )
    client = _client(transport, Credentials(token=TEST_TOKEN))
    client.authenticate()

    files = client.download_results("tarefa-1")

    assert files == {
        "teste-MOD13Q1-061-results.csv": b"mod",
        "teste-MYD13Q1-061-results.csv": b"myd",
    }
    assert transport.calls("GET", "/api/bundle/tarefa-1/f1")[0].authorization == (
        f"Bearer {TEST_TOKEN}"
    )


def test_should_login_again_when_the_token_expires_in_the_middle() -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("GET", "/api/task/tarefa-1"): [
                _response(403, {"message": "expirou"}),
                _response(200, {"status": "done"}),
            ],
            ("POST", "/api/login"): [_response(200, {"token": NEW_TOKEN})],
        }
    )
    client = _client(transport, Credentials(TEST_TOKEN, TEST_USER, TEST_PASSWORD))
    client.authenticate()

    client.wait_for_task("tarefa-1", poll_interval=30, timeout=600)

    assert transport.calls("GET", "/api/task/tarefa-1")[1].authorization == f"Bearer {NEW_TOKEN}"


# --- CSV e conversão ----------------------------------------------------------------------


def test_should_parse_the_appeears_csv_by_column_name() -> None:
    text = "\n".join([MOD_HEADER, _row("2017-04-06", "0.6123", "0")])

    observations = parse_appeears_csv(text)

    assert len(observations) == 1
    obs = observations[0]
    assert (obs.point_id, obs.lat, obs.lon) == ("p1", -18.9543, -48.1993)
    assert (obs.day, obs.product, obs.ndvi, obs.quality) == (
        date(2017, 4, 6),
        "MOD13Q1",
        0.6123,
        0,
    )


def test_should_refuse_a_csv_without_the_ndvi_column() -> None:
    with pytest.raises(AppeearsError, match="NDVI"):
        parse_appeears_csv("ID,Latitude,Longitude,Date\np1,-18.9,-48.1,2017-04-06")


def test_should_keep_only_good_and_acceptable_quality() -> None:
    text = "\n".join(
        [
            MOD_HEADER,
            _row("2017-04-06", "0.6123", "0"),
            _row("2017-04-22", "0.5512", "1"),
            _row("2017-05-08", "0.3011", "2"),  # neve
            _row("2017-05-24", "0.2010", "3"),  # nuvem
            _row("2017-06-09", "0.4000", "-1"),  # sem dado
        ]
    )

    payload = build_ndvi_payload(parse_appeears_csv(text), [DEFAULT_POINT], FINISHED_AT)

    serie = payload["pontos"][0]["serie"]
    assert [(item["data"], item["qualidade"]) for item in serie] == [
        ("2017-04-06", 0),
        ("2017-04-22", 1),
    ]


def test_should_keep_only_january_to_july_from_2017_to_2026() -> None:
    text = "\n".join(
        [
            MOD_HEADER,
            _row("2016-04-07", "0.6000", "0"),
            _row("2017-01-01", "0.6100", "0"),
            _row("2017-07-27", "0.6200", "0"),
            _row("2017-08-12", "0.6300", "0"),
            _row("2026-07-28", "0.6400", "0"),
            _row("2027-01-01", "0.6500", "0"),
        ]
    )

    payload = build_ndvi_payload(parse_appeears_csv(text), [DEFAULT_POINT], FINISHED_AT)

    assert [item["data"] for item in payload["pontos"][0]["serie"]] == [
        "2017-01-01",
        "2017-07-27",
        "2026-07-28",
    ]


def test_should_apply_the_scale_factor_when_the_csv_brings_raw_values() -> None:
    text = "\n".join(
        [MOD_HEADER, _row("2017-04-06", "6123", "0"), _row("2017-04-22", "-3000", "1")]
    )

    payload = build_ndvi_payload(parse_appeears_csv(text), [DEFAULT_POINT], FINISHED_AT)

    assert payload["pontos"][0]["serie"] == [
        {"data": "2017-04-06", "ndvi": 0.6123, "qualidade": 0, "produto": "MOD13Q1"}
    ]


def test_should_refuse_the_fill_value_even_with_good_quality() -> None:
    # -3000 bruto vira -0,3 escalado: os dois são "sem dado", nunca NDVI.
    text = "\n".join(
        [
            MOD_HEADER,
            _row("2017-04-06", "-0.3", "0"),
            _row("2017-04-22", "-3000", "0"),
            _row("2017-05-08", "", "0"),
            _row("2017-05-24", "0.5000", "0"),
        ]
    )

    payload = build_ndvi_payload(parse_appeears_csv(text), [DEFAULT_POINT], FINISHED_AT)

    assert [item["ndvi"] for item in payload["pontos"][0]["serie"]] == [0.5]


def test_should_build_the_contract_file_validated_by_the_models() -> None:
    mod = "\n".join(
        [MOD_HEADER, _row("2017-04-06", "0.7100", "0"), _row("2017-04-06", "0.5", "0", "p2")]
    )
    myd = "\n".join([MYD_HEADER, _row("2017-04-14", "0.6900", "1")])
    points = [DEFAULT_POINT, Point(-17.5, -47.25)]
    observations = parse_appeears_csv(myd) + parse_appeears_csv(mod)

    payload = build_ndvi_payload(observations, points, FINISHED_AT, task_id="tarefa-1")

    versao = payload["versao_dados"]
    run_record = DataRun(
        source=versao["fonte"],
        params=versao["parametros"],
        finished_at=datetime.fromisoformat(versao["fim"]),
        version=versao["versao"],
    )
    assert run_record.source == "modis_mod13q1"
    assert versao["fim"] == "2026-11-14T13:00:00Z"
    assert versao["versao"] == "2026.11-modis-ndvi"
    assert versao["parametros"]["produtos"] == ["MOD13Q1", "MYD13Q1"]
    assert versao["parametros"]["tarefa"] == "tarefa-1"
    first, second = payload["pontos"]
    assert (first["lat"], first["lon"]) == (-18.9543, -48.1993)
    assert first["serie"] == [
        {"data": "2017-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"},
        {"data": "2017-04-14", "ndvi": 0.69, "qualidade": 1, "produto": "MYD13Q1"},
    ]
    assert (second["lat"], second["lon"]) == (-17.5, -47.25)
    for point in payload["pontos"]:
        for item in point["serie"]:
            NdviRecord(
                data=date.fromisoformat(item["data"]),
                ndvi=item["ndvi"],
                qualidade=item["qualidade"],
                produto=item["produto"],
            )
    json.dumps(payload)  # serializável


def test_should_drop_duplicated_observations_of_the_same_date_and_product() -> None:
    text = "\n".join([MOD_HEADER, _row("2017-04-06", "0.71", "0"), _row("2017-04-06", "0.71", "0")])

    payload = build_ndvi_payload(parse_appeears_csv(text), [DEFAULT_POINT], FINISHED_AT)

    assert len(payload["pontos"][0]["serie"]) == 1


# --- linha de comando ---------------------------------------------------------------------


def test_should_parse_points_from_the_command_line() -> None:
    assert parse_points("-18.9543,-48.1993; -17.5,-47.25") == [
        Point(-18.9543, -48.1993),
        Point(-17.5, -47.25),
    ]
    with pytest.raises(ValueError, match="lat,lon"):
        parse_points("-18.9543")
    with pytest.raises(ValueError, match="latitude"):
        parse_points("-98,-48")


def test_should_print_the_task_without_network_or_credentials_on_dry_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    def no_credentials() -> Credentials:
        raise AssertionError("dry-run não lê credencial")

    code = run(
        ["--dry-run", "--saida", str(tmp_path / "ndvi.json")],
        transport=FakeTransport({}),
        load_credentials=no_credentials,
    )

    assert code == 0
    printed = json.loads(capsys.readouterr().out)
    assert printed["task_type"] == "point"
    assert not (tmp_path / "ndvi.json").exists()


def test_should_resume_an_existing_task_and_write_the_contract_file(tmp_path: Path) -> None:
    csv_text = "\n".join([MOD_HEADER, _row("2017-04-06", "0.7100", "0")])
    bundle = {"files": [{"file_id": "f1", "file_name": "teste-MOD13Q1-061-results.csv"}]}
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("GET", "/api/task/tarefa-9"): [_response(200, {"status": "done"})],
            ("GET", "/api/bundle/tarefa-9"): [_response(200, bundle)],
            ("GET", "/api/bundle/tarefa-9/f1"): [_response(200, body=csv_text.encode())],
        }
    )
    output = tmp_path / "ndvi.json"

    code = run(
        ["--tarefa-existente", "tarefa-9", "--saida", str(output)],
        transport=transport,
        load_credentials=lambda: Credentials(token=TEST_TOKEN),
        now=lambda: FINISHED_AT,
    )

    assert code == 0
    assert transport.calls("POST", "/api/task") == []
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["pontos"][0]["serie"][0]["ndvi"] == 0.71
    assert (tmp_path / "appeears_tarefa-9" / "teste-MOD13Q1-061-results.csv").is_file()
    assert TEST_TOKEN not in output.read_text(encoding="utf-8")


def test_should_return_an_error_code_and_the_resume_hint_on_timeout(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("POST", "/api/task"): [_response(202, {"task_id": "tarefa-7"})],
            ("GET", "/api/task/tarefa-7"): [_response(200, {"status": "processing"})] * 3,
        }
    )
    clock = FakeClock()

    code = run(
        ["--saida", str(tmp_path / "ndvi.json"), "--intervalo", "30", "--limite-minutos", "1"],
        transport=transport,
        load_credentials=lambda: Credentials(token=TEST_TOKEN),
        sleep=clock.sleep,
        clock=clock.time,
    )

    assert code == 2
    assert "--tarefa-existente tarefa-7" in capsys.readouterr().err


def test_should_convert_local_csv_files_without_network(tmp_path: Path) -> None:
    csv_path = tmp_path / "teste-MOD13Q1-061-results.csv"
    csv_path.write_text("\n".join([MOD_HEADER, _row("2017-04-06", "0.7100", "0")]), "utf-8")
    output = tmp_path / "ndvi.json"

    code = run(
        ["--csv", str(csv_path), "--saida", str(output)],
        transport=FakeTransport({}),
        load_credentials=lambda: Credentials(),
        now=lambda: FINISHED_AT,
    )

    assert code == 0
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["pontos"][0]["serie"][0]["produto"] == "MOD13Q1"


def test_should_accept_negative_coordinates_after_the_points_flag(
    capsys: pytest.CaptureFixture[str],
) -> None:
    # No Brasil lat e lon são negativas: "--pontos -18.9,-48.1" não pode virar uma opção.
    code = run(
        ["--dry-run", "--pontos", "-18.9543,-48.1993;-17.5,-47.25"],
        transport=FakeTransport({}),
        load_credentials=Credentials,
    )

    assert code == 0
    coordinates = json.loads(capsys.readouterr().out)["params"]["coordinates"]
    assert [c["latitude"] for c in coordinates] == [-18.9543, -17.5]


def test_should_keep_waiting_when_the_status_check_fails_for_a_moment() -> None:
    transport = FakeTransport(
        {
            ("GET", "/api/task"): [_response(200, [])],
            ("GET", "/api/task/tarefa-1"): [
                _response(503, {"message": "fora do ar"}),
                _response(200, {"status": "done"}),
            ],
        }
    )
    client = _client(transport, Credentials(token=TEST_TOKEN))
    client.authenticate()

    assert client.wait_for_task("tarefa-1", poll_interval=30, timeout=600) == {"status": "done"}
