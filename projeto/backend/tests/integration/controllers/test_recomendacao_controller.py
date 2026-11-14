"""Integration tests for GET /api/recomendacao and GET /api/exemplo (contrato do plano §3.2)."""

from dataclasses import replace

from fastapi.testclient import TestClient

from app.dependencies import get_rules_repository
from app.main import app
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules

UFU = {"lat": -18.9543, "lon": -48.1993}


class FakeRulesRepository:
    def __init__(self, regras: Regras) -> None:
        self._regras = regras

    def get_rules(self) -> Regras:
        return self._regras


def test_should_return_recommendation_in_the_contract_shape_used_by_the_front(
    client: TestClient,
) -> None:
    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    assert body["entrada"] == {
        "celula_id": "-190_-482",
        "colheita": "meio",
        "semeadura": "2027-02-18",
        "solo": "argiloso",
        "nematoide": None,
        "gado": None,
    }
    assert len(body["opcoes"]) == 5
    assert body["melhor"] in {o["id"] for o in body["opcoes"]}
    # Só os eixos em que alguma opção supera a melhor (R4.2): aqui todas têm 18 anos bons e o milho
    # tem a maior renda, então sobra só "cuidar da terra".
    assert body["alternativas"] == [{"motivo": "cuidar_da_terra", "opcao": "crotalaria"}]

    milho = next(o for o in body["opcoes"] if o["id"] == "milho_safrinha")
    assert milho["chuva"] == {
        "anos_bons": 18,
        "anos": 20,
        "faixa": [year not in (2007, 2014) for year in range(2005, 2025)],
        "rotulo": "bom",
        "texto": "Deu certo em 18 de 20 anos",
    }
    assert milho["futuro"] is None
    assert set(milho["dinheiro"]) == {"margem_ha", "rotulo", "texto"}
    assert milho["terra"] == {
        "nota": 20.0,
        "rotulo": "medio",
        "texto": "Deixa palhada média e nenhum nitrogênio; não quebra o ciclo do nematoide.",
    }
    assert set(milho["notas"]) == {"seguranca", "futuro", "solo", "renda", "final"}
    assert milho["porque"] and milho["como_fazer"] == ["Passo 1"]
    assert set(body["plano_3_anos"]) == {"normal", "seco", "hoje"}
    assert {"anos", "nota"} <= set(body["plano_3_anos"]["normal"])
    assert {"descricao", "nota"} <= set(body["plano_3_anos"]["hoje"])
    assert body["pousio"]["texto"]
    assert body["aviso"]


def test_should_move_crops_out_of_window_and_parse_nematoide_when_harvest_is_tarde(
    client: TestClient,
) -> None:
    params = {**UFU, "colheita": "tarde", "solo": "arenoso", "nematoide": "sim", "gado": "nao"}
    response = client.get("/api/recomendacao", params=params)

    assert response.status_code == 200
    body = response.json()
    assert body["entrada"]["solo"] == "arenoso"
    assert body["entrada"]["nematoide"] is True
    assert body["entrada"]["gado"] is False
    assert {o["id"] for o in body["opcoes"]} == {"sorgo", "milheto"}
    assert {o["id"] for o in body["fora_da_janela"]} == {
        "milho_safrinha",
        "milho_braquiaria",
        "crotalaria",
    }


def test_should_return_404_outside_area_instead_of_another_region_answer(
    client: TestClient,
) -> None:
    response = client.get("/api/recomendacao", params={"lat": -23.55, "lon": -46.63})

    assert response.status_code == 404
    assert response.json()["code"] == "OUTSIDE_AREA"


def test_should_return_422_when_invalid_colheita_passed(client: TestClient) -> None:
    response = client.get("/api/recomendacao", params={**UFU, "colheita": "invalida"})

    assert response.status_code == 422


def test_should_return_422_instead_of_ignoring_invalid_nematoide(client: TestClient) -> None:
    response = client.get("/api/recomendacao", params={**UFU, "nematoide": "talvez"})

    assert response.status_code == 422


def test_should_return_example_farm_at_ufu_point_when_get_exemplo_called(
    client: TestClient,
) -> None:
    response = client.get("/api/exemplo", headers={"Accept-Language": "en"})

    assert response.status_code == 200
    body = response.json()
    assert body["talhao"]["ponto"] == UFU
    assert body["talhao"]["dentro_da_area"] is True
    assert body["recomendacao"]["entrada"]["colheita"] == "meio"
    assert body["recomendacao"]["opcoes"][0]["chuva"]["texto"].startswith("Worked in")


def test_should_use_rules_from_the_injected_rules_repository(client: TestClient) -> None:
    # dependencies.py entrega as regras do repository a todos os services do motor
    base = load_default_rules()
    regras = replace(
        base,
        clima=replace(base.clima, calor_temp_c=29.0),
        rotulos=replace(base.rotulos, dinheiro_bom=101.0),
        rotacao=replace(base.rotacao, anos_secos=2),
    )
    app.dependency_overrides[get_rules_repository] = lambda: FakeRulesRepository(regras)

    response = client.get("/api/recomendacao", params={**UFU, "colheita": "meio"})

    assert response.status_code == 200
    body = response.json()
    milho = next(o for o in body["opcoes"] if o["id"] == "milho_safrinha")
    assert milho["chuva"]["anos_bons"] == 0  # máxima de 30 °C já é calor com o limiar de 29 °C
    assert milho["dinheiro"]["rotulo"] == "medio"  # renda 100 abaixo do "bom" de 101
    assert "(2007, 2014)" in body["plano_3_anos"]["seco"]["descricao"]
