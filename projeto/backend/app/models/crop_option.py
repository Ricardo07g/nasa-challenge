"""Domain entities for off-season crop options and agronomic parameters."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CropOption:
    """Off-season crop option summary."""

    id: str
    name: str
    role: str


@dataclass(frozen=True)
class CropParams:
    """Parâmetros agronômicos, de solo e de dinheiro de uma opção de entressafra."""

    id: str
    nome: str
    tipo: str
    funcao: str
    semeadura_limite_mes_dia: str | None
    dias_florescer: int
    ciclo_dias: int
    kc_pico: float
    # Nota de solo do PRD 7.4: palhada (até 40) + nitrogênio (até 30) + quebra de pragas (até 30)
    solo_palhada: int
    solo_nitrogenio: int
    solo_pragas: int
    n_deixado_kg: int
    # Coberturas não dão grão: produtividade e preço zero, só o custo da semente.
    produtividade_padrao_sc_ha: float = 0.0
    preco_padrao_saca: float = 0.0
    custo_padrao_ha: float = 0.0
    como_fazer: tuple[str, ...] = ()
    nome_en: str = ""
