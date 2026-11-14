"""Contrato do JSON de /recomendacao que não aparece nas rotas com os dados falsos de sempre."""

from app.main import app
from app.schemas.recomendacao import DinheiroSchema


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
