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
    """Complete agronomic, phenological, and economic parameters of a crop option."""

    id: str
    nome: str
    tipo: str
    funcao: str
    semeadura_limite_mes_dia: str | None
    dias_florescer: int
    ciclo_dias: int
    kc_pico: float
    palhada_score: int
    n_deixado_kg: int
    nematoide_efeito: int
    produtividade_padrao_sc_ha: float
    preco_padrao_saca: float
    custo_padrao_ha: float
    como_fazer: tuple[str, ...]
    nome_en: str = ""
