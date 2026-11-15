"""Integration tests for GET /api/talhao (plano técnico §3.1 e guia do histórico NDVI)."""

import json
from dataclasses import replace
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.dependencies import get_ndvi_repository, get_rules_repository
from app.main import app
from app.models.regras import Regras
from app.repositories.ndvi_repository import CachedNdviRepository
from app.repositories.rules_repository import load_default_rules

UFU = {"lat": -18.9543, "lon": -48.1993}
SITUACOES = {"plantou", "parado", "incerto", "sem_dado"}


def test_should_return_field_inspection_in_the_contract_shape(client: TestClient) -> None:
    response = client.get("/api/talhao", params=UFU)

    assert response.status_code == 200
    body = response.json()
    assert body["ponto"] == UFU
    assert body["celula_id"] == "-190_-482"
    assert body["dentro_da_area"] is True
    assert body["solo"] == {"textura": "argiloso", "cad_mm": 60.0, "fonte": "soilgrids"}
    assert body["colheita_sugerida"] == {"faixa": "meio", "fonte": "ndvi_modis", "anos_usados": 10}
    assert body["dados"] == [
        {"fonte": "nasa_power", "periodo": "2005-2024", "cenario": None, "modelos": None}
    ]


def test_should_return_the_full_ndvi_history_contract(client: TestClient) -> None:
    # Formato completo do guia NDVI (decisão do time no R3.2), anos de 2016 a 2025
    historico = client.get("/api/talhao", params=UFU).json()["historico"]

    assert {k: v for k, v in historico.items() if k != "anos"} == {
        "parado": 3,
        "plantou": 5,
        "sem_certeza": 2,
        "total": 10,
        "fonte": "MODIS MOD13Q1 + MYD13Q1",
        "janela": "04-01 a 07-31",
    }
    assert len(historico["anos"]) == 10
    assert all(set(a) == {"ano", "situacao", "ndvi_max", "n_obs"} for a in historico["anos"])
    assert all(a["situacao"] in SITUACOES for a in historico["anos"])
    assert historico["anos"][:5] == [
        {"ano": 2016, "situacao": "parado", "ndvi_max": 0.3, "n_obs": 3},
        {"ano": 2017, "situacao": "plantou", "ndvi_max": 0.71, "n_obs": 3},
        {"ano": 2018, "situacao": "sem_dado", "ndvi_max": None, "n_obs": 1},
        {"ano": 2019, "situacao": "plantou", "ndvi_max": 0.71, "n_obs": 3},
        {"ano": 2020, "situacao": "incerto", "ndvi_max": 0.52, "n_obs": 3},
    ]


def test_should_return_dentro_da_area_false_when_point_has_no_data(client: TestClient) -> None:
    response = client.get("/api/talhao", params={"lat": -23.55, "lon": -46.63})

    assert response.status_code == 200
    body = response.json()
    assert body["dentro_da_area"] is False
    assert body["celula_id"] is None
    assert body["dados"] == []
    assert body["chuva_mensal"] is None


def test_should_return_the_rain_of_each_month_from_january_to_june(client: TestClient) -> None:
    # Clima falso do conftest: 8 mm/dia, sem chuva de fevereiro a junho em 2007 e 2014.
    # Fevereiro = (13 anos x 224 + 5 bissextos x 232 + 2 secos x 0) / 20 = 203,6
    body = client.get("/api/talhao", params=UFU).json()

    assert body["chuva_mensal"] == {
        "meses": [
            {"mes": 1, "media_mm": 248.0},
            {"mes": 2, "media_mm": 203.6},
            {"mes": 3, "media_mm": 223.2},
            {"mes": 4, "media_mm": 216.0},
            {"mes": 5, "media_mm": 223.2},
            {"mes": 6, "media_mm": 216.0},
        ],
        "anos": list(range(2005, 2025)),
        "fonte": "nasa_power",
    }


class FakeRulesRepository:
    def __init__(self, regras: Regras) -> None:
        self._regras = regras

    def get_rules(self) -> Regras:
        return self._regras


def test_should_classify_history_with_rules_from_the_injected_repository(
    client: TestClient,
) -> None:
    base = load_default_rules()
    regras = replace(base, historico_ndvi=replace(base.historico_ndvi, limite_plantou=0.80))
    app.dependency_overrides[get_rules_repository] = lambda: FakeRulesRepository(regras)

    response = client.get("/api/talhao", params=UFU)

    assert response.status_code == 200
    assert response.json()["historico"]["anos"][1]["situacao"] == "incerto"  # 0,71 < 0,80


# Arquivo no formato do contrato do NDVI (AGENTS.md do backend) com valores de teste: o
# `versao_dados` não usa a chave `modis_mod13q1`, porque não é dado do MODIS.
TEST_RUN = {"fonte": "teste", "parametros": {}, "fim": "2026-11-14T13:00:00Z", "versao": "teste"}


def _obs(day: str, ndvi: float, qualidade: int = 0, produto: str = "MOD13Q1") -> dict[str, Any]:
    return {"data": day, "ndvi": ndvi, "qualidade": qualidade, "produto": produto}


def _ndvi_file(tmp_path: Path) -> Path:
    """Soja seca em 10/fev (Aqua); entressafra parada nos anos pares e plantada nos ímpares.

    Os anos pares têm uma imagem com nuvem (qualidade 3) e NDVI alto, que não pode contar.
    """
    serie: list[dict[str, Any]] = []
    for year in range(2016, 2026):
        peak = 0.74 if year % 2 else 0.31
        serie += [
            _obs(f"{year}-01-17", 0.84),
            _obs(f"{year}-02-02", 0.70),
            _obs(f"{year}-02-10", 0.38, produto="MYD13Q1"),
            _obs(f"{year}-04-07", 0.26),
            _obs(f"{year}-04-15", 0.24, qualidade=1, produto="MYD13Q1"),
            _obs(f"{year}-05-09", peak),
        ]
        if year % 2 == 0:
            serie.append(_obs(f"{year}-06-10", 0.88, qualidade=3, produto="MYD13Q1"))
    payload = {
        "versao_dados": TEST_RUN,
        "pontos": [{"lat": UFU["lat"], "lon": UFU["lon"], "serie": serie}],
    }
    path = tmp_path / "ndvi.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_should_read_history_and_harvest_band_from_the_ndvi_file(
    client: TestClient, tmp_path: Path
) -> None:
    path = _ndvi_file(tmp_path)
    app.dependency_overrides[get_ndvi_repository] = lambda: CachedNdviRepository(path)

    body = client.get("/api/talhao", params=UFU).json()

    historico = body["historico"]
    assert (historico["parado"], historico["plantou"], historico["sem_certeza"]) == (5, 5, 0)
    assert historico["total"] == 10
    assert historico["fonte"] == "MODIS MOD13Q1 + MYD13Q1"
    assert historico["anos"][:2] == [
        {"ano": 2016, "situacao": "parado", "ndvi_max": 0.31, "n_obs": 3},
        {"ano": 2017, "situacao": "plantou", "ndvi_max": 0.74, "n_obs": 3},
    ]
    # Mesma série, de janeiro a março: a soja seca no dia 41 (10/fev) -> colheita "cedo"
    assert body["colheita_sugerida"] == {"faixa": "cedo", "fonte": "ndvi_modis", "anos_usados": 10}


def test_should_return_null_history_when_the_ndvi_file_has_no_point_near_the_field(
    client: TestClient, tmp_path: Path
) -> None:
    path = _ndvi_file(tmp_path)
    app.dependency_overrides[get_ndvi_repository] = lambda: CachedNdviRepository(path)

    # ~1,1 km ao sul do ponto do arquivo, ainda dentro da área com clima: não usa o vizinho.
    body = client.get("/api/talhao", params={"lat": -18.9643, "lon": -48.1993}).json()

    assert body["dentro_da_area"] is True
    assert body["historico"] is None
    assert body["colheita_sugerida"] == {"faixa": "meio", "fonte": "padrao", "anos_usados": 0}
