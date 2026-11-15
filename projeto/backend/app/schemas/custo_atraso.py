"""JSON de GET /api/custo-atraso (tela 3 "Quando você colhe a soja?", tarefa 0042)."""

from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.custo_atraso import CustoAtraso


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class CustoFaixaSchema(_Frozen):
    colheita: str  # cedo, meio ou tarde
    semeadura: date  # dia de plantar do motor para a faixa (ano de referência)
    # A melhor opção do motor para a faixa; null quando nenhuma cabe na janela de plantio
    melhor: str | None
    nome: str | None
    anos_bons: int | None  # anos sem aperto (deu certo) da melhor opção
    total_anos: int | None  # anos simulados


class CustoAtrasoResponse(_Frozen):
    """As três faixas, em ordem; `mesma_cultura` = a melhor opção é a mesma nas três."""

    faixas: list[CustoFaixaSchema]
    mesma_cultura: bool

    @classmethod
    def from_model(cls, custo: CustoAtraso) -> "CustoAtrasoResponse":
        return cls(
            faixas=[
                CustoFaixaSchema(
                    colheita=f.colheita,
                    semeadura=f.semeadura,
                    melhor=f.melhor,
                    nome=f.nome,
                    anos_bons=f.anos_bons,
                    total_anos=f.total_anos,
                )
                for f in custo.faixas
            ],
            mesma_cultura=custo.mesma_cultura,
        )
