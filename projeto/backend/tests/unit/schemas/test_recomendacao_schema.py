"""Contrato do JSON de /recomendacao que não aparece nas rotas com os dados falsos de sempre."""

from datetime import date

from app.main import app
from app.models.recomendacao import AnoDetalhe
from app.schemas.recomendacao import AnoDetalheSchema, DinheiroSchema, OpcaoSchema


def test_should_keep_money_fields_in_openapi_docs() -> None:
    # O serializador que tira a chave vazia não pode apagar os campos do `dinheiro` no /docs.
    schema = app.openapi()["components"]["schemas"]["DinheiroSchema"]

    assert {"margem_ha", "rotulo", "texto", "pior_ano_seco_ha"} <= set(schema["properties"])


def test_should_send_worst_dry_year_margin_in_money_block() -> None:
    dinheiro = DinheiroSchema(margem_ha=1460.0, rotulo="bom", texto="x", pior_ano_seco_ha=-1516.0)

    assert dinheiro.model_dump()["pior_ano_seco_ha"] == -1516.0


def test_should_omit_worst_dry_year_margin_instead_of_sending_null() -> None:
    # O front faz `pior_ano_seco_ha === undefined ? null : valor x hectares`: um null viraria
    # "R$ 0" no pior caso (null x 50 = 0 no JavaScript). Sem valor, a chave não vai.
    dinheiro = DinheiroSchema(margem_ha=1460.0, rotulo="bom", texto="x")

    assert "pior_ano_seco_ha" not in dinheiro.model_dump()
    assert "pior_ano_seco_ha" not in dinheiro.model_dump_json()


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
    }
    enso_types = ano["properties"]["enso"]["anyOf"]
    assert {"enum": ["el_nino", "la_nina"], "type": "string"} in enso_types
    assert {"type": "null"} in enso_types
    assert OpcaoSchema.model_fields["anos_detalhe"].is_required() is False
