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
    """Parâmetros agronômicos e de solo de uma opção de entressafra (sem preço nem custo)."""

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
    como_fazer: tuple[str, ...] = ()
    nome_en: str = ""
    como_fazer_en: tuple[str, ...] = ()  # vazio = sem tradução (o service usa o português)
    # O prazo vem de uma portaria do ZARC (tarefa 0066). Falso na crotalária (não há ZARC de plantas
    # de cobertura): a data dela é sugestão do app, e o texto não pode chamá-la de prazo do ZARC.
    prazo_zarc: bool = True
