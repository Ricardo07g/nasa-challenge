"""GET /api/metodo: as regras da tela "Como a conta é feita" (tarefa 0049), lidas do regras.yaml."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_should_send_the_rules_of_the_method_screen(client: TestClient) -> None:
    response = client.get("/api/metodo")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "deu_certo",
        "pesos",
        "renda",
        "agua",
        "rotacao",
        "plano_b",
        "alertas",
        "avisos",
        "sinal",
        "fontes",
    }
    assert body["deu_certo"] == {
        "isna_grao_pct": 55,
        "isna_cobertura_pct": 50,
        "isna_por_cultura_pct": {"milho_braquiaria": 50, "milheto": 60, "sorgo": 45},
        "janela_grao_meia_dias": 15,
        "janela_cobertura_dias": 30,
        "calor_temp_c": 35.0,
        "calor_min_dias": 3,
    }
    assert body["agua"]["sede_pouca_ate_mm"] == 280.0
    assert body["rotacao"]["culturas_supressoras_nematoide"] == ["crotalaria"]
    assert body["alertas"]["geada_temp_c"] == 3.0
    assert "R$" not in response.text


def test_should_send_the_source_of_each_rule(client: TestClient) -> None:
    # Tarefa 0066: campo opcional `fontes` (o front antigo ignora): citação curta, link e se a regra
    # continua hipótese do time.
    fontes = client.get("/api/metodo").json()["fontes"]

    assert fontes["geada"]["hipotese"] == "nao"
    assert fontes["fogo"] == {"citacoes": [], "hipotese": "sim"}
    (citacao,) = [c for c in fontes["geada"]["citacoes"] if "Wrege" in c["citacao"]]
    assert citacao["url"].startswith("https://")
