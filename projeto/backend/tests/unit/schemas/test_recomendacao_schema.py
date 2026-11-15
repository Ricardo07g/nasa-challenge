"""Contrato do JSON de /recomendacao que não aparece nas rotas com os dados falsos de sempre."""

from datetime import date

from app.main import app
from app.models.recomendacao import AnoDetalhe
from app.schemas.recomendacao import AnoDetalheSchema, OpcaoSchema


def test_should_describe_income_only_with_facts_in_openapi_docs() -> None:
    # Tarefa 0040: o bloco `renda` (antes `dinheiro`) não tem margem, custo nem pior ano em reais.
    schemas = app.openapi()["components"]["schemas"]

    assert set(schemas["RendaSchema"]["properties"]) == {
        "da_grao",
        "anos_aperto",
        "rotulo",
        "texto",
        "risco",
    }
    assert "renda" in schemas["OpcaoSchema"]["properties"]
    assert "dinheiro" not in schemas["OpcaoSchema"]["properties"]
    assert "DinheiroSchema" not in schemas


def test_should_send_each_year_detail_in_the_front_contract() -> None:
    # P1: `AnoDetalhe` do front (projeto/frontend/src/models/recomendacao.ts), data em ISO
    detalhe = AnoDetalhe(
        ano=2019,
        bom=False,
        fase_critica=date(2019, 4, 19),
        dias_sem_chuva=12,
        enso="el_nino",
        texto="Em 2019, ...",
    )

    assert AnoDetalheSchema.from_model(detalhe).model_dump(mode="json") == {
        "ano": 2019,
        "bom": False,
        "fase_critica": "2019-04-19",
        "dias_sem_chuva": 12,
        "enso": "el_nino",
        "texto": "Em 2019, ...",
        # Explorador ano a ano (tarefa 0044): os padrões do model quando o motor não preenche
        "isna": 1.0,
        "dias_calor": 0,
        "falta_agua": False,
        "calor": False,
        "semeadura": None,
        "umidade_inicial": None,
    }


def test_should_keep_year_detail_optional_in_the_option_contract() -> None:
    # O front tem `anos_detalhe?: AnoDetalhe[]`: o campo é opcional e a fase do ENSO pode ser nula
    schemas = app.openapi()["components"]["schemas"]
    opcao = schemas["OpcaoSchema"]
    ano = schemas["AnoDetalheSchema"]

    assert "anos_detalhe" in opcao["properties"]
    assert "anos_detalhe" not in opcao.get("required", [])
    assert set(ano["properties"]) == {
        "ano",
        "bom",
        "fase_critica",
        "dias_sem_chuva",
        "enso",
        "texto",
        "isna",
        "dias_calor",
        "falta_agua",
        "calor",
        "semeadura",
        "umidade_inicial",
    }
    # Os campos da tarefa 0044 são opcionais (o front lê `campo?`)
    assert set(ano.get("required", [])) == {
        "ano",
        "bom",
        "fase_critica",
        "dias_sem_chuva",
        "enso",
        "texto",
    }
    enso_types = ano["properties"]["enso"]["anyOf"]
    assert {"enum": ["el_nino", "la_nina"], "type": "string"} in enso_types
    assert {"type": "null"} in enso_types
    assert OpcaoSchema.model_fields["anos_detalhe"].is_required() is False
