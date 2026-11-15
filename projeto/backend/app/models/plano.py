"""Avaliação de um plano de 3 anos qualquer (aba "Plano de 3 anos", seção 5.6, tarefa 0045)."""

from dataclasses import dataclass
from datetime import date

from app.models.sinal_outono import SinalOutono


@dataclass(frozen=True)
class AnoPlano:
    """Um ano do plano: a cultura e os fatos do motor para ela na faixa de colheita.

    Fora da janela de plantio (ZARC), o motor não avalia a cultura: os números saem None, mas os
    fatos da terra (do `culturas.yaml`) continuam. No pousio, `anos_bons` e `usa_mm` são None.
    """

    cultura: str
    nome: str
    na_janela: bool
    anos_bons: int | None
    total_anos: int | None
    futuro_anos_bons: int | None
    sede: str | None
    # Saúde da terra (fatos do culturas.yaml e do regras.yaml)
    cobre_terra: bool
    deixa_nitrogenio: bool
    quebra_nematoide: bool
    # Chuva aproveitada: a mediana do que a planta usou no ciclo (ETr do balanço), em mm
    usa_mm: int | None


@dataclass(frozen=True)
class NotasPlano:
    """Notas do plano, de 0 a 100 (None quando nenhum ano tem o dado).

    `seguranca` e `futuro`: média das notas do motor nos anos com lavoura na janela (o pousio não
    tem lavoura para proteger). `solo`: média da nota de solo dos 3 anos (PRD 7.4; pousio = 0) mais
    o bônus de diversidade da rotação (PRD 7.7), até 100.
    """

    seguranca: float | None
    solo: float
    futuro: float | None


@dataclass(frozen=True)
class TerraPlano:
    """Saúde da terra da rotação inteira, com fatos: anos cobertos, com nitrogênio, que quebram o
    ciclo do nematoide, as culturas repetidas e o bônus de diversidade (PRD 7.7)."""

    anos_cobertos: int
    anos_nitrogenio: int
    anos_nematoide: int
    repetidas: tuple[str, ...]
    total: int
    bonus_diversidade: float


@dataclass(frozen=True)
class ChuvaAproveitada:
    """A chuva da semeadura ao fim de julho (mediana dos anos) e o que o plano usa dela.

    `usa_media_mm`: média, nos 3 anos do plano, do que a planta usou (o pousio usa 0); None se algum
    ano não tem o número (cultura fora da janela).
    """

    inicio: date
    fim: str
    chuva_mm: int
    usa_media_mm: int | None
    anos: int
    fonte: str


@dataclass(frozen=True)
class LimiteChuva:
    """O limite de chuva antes da semeadura que mais acerta os anos de falha da cultura do Plano A.

    "Secou" = menos de `chuva_mm` mm nos `dias` dias antes da semeadura. `anos_marcados` anos
    da série ficaram abaixo e `falhas_marcadas` deles foram de falha (de `falhas` falhas em
    `total` anos). `chance_pct`: a chance de pegar tantas falhas marcando o mesmo número de anos
    ao acaso. `separa` diz se o número pode ir para a tela (critério do grupo `plano_b`); senão,
    `motivo` diz por quê: `poucas_falhas` ou `nao_separa`.
    """

    dias: int
    chuva_mm: int
    anos_marcados: int
    falhas_marcadas: int
    falhas: int
    total: int
    chance_pct: float
    separa: bool
    motivo: str | None


@dataclass(frozen=True)
class PlanoAB:
    """Plano A (a cultura do 1º ano) e Plano B (a cultura se secar), numa frase cada.

    B = a cultura na janela que mais deu certo nos anos em que A falhou (desempate pela nota
    final do motor). Sem B, `motivo`: `pousio` (A é deixar parado), `nunca_falhou` (A deu certo
    em todos os anos) ou `nenhuma_melhor` (nenhuma outra deu certo nesses anos).
    """

    cultura_a: str
    nome_a: str
    falhas_a: int
    total: int
    cultura_b: str | None
    nome_b: str | None
    b_bons_nas_falhas: int | None
    limite: LimiteChuva | None
    motivo: str | None


@dataclass(frozen=True)
class PlanoAvaliado:
    """Resposta de `GET /api/plano`: os 3 anos, as notas, a terra, a chuva, o Plano A/B, o sinal."""

    colheita: str
    semeadura: date
    anos: tuple[AnoPlano, ...]
    notas: NotasPlano
    terra: TerraPlano
    chuva: ChuvaAproveitada | None
    plano_ab: PlanoAB | None
    # Sinal do outono com o Plano A e o Plano B desta tela (tarefa 0049); None sem a previsão do
    # ENSO, no pousio ou com o 1º ano fora da janela
    sinal: SinalOutono | None = None
