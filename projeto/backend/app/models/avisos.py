"""Tela "Avisos" do ponto marcado (/avisos, remodelagem S6, tarefa 0046, RF-31).

Quatro grupos: Agora (terra seca, dias sem chuva, calor, El Niño / La Niña e os avisos da safrinha
em andamento), O que mudou (2020–2024 contra 2005–2019), Fora do comum (recordes dos 20 anos) e
Perto de você (relatos de vizinhos). Cada aviso traz o nível, o tipo, os números da frase, as
fontes e a data da leitura; as frases ficam no front, em pt e en.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date
from typing import Final, Literal

NivelAviso = Literal["atencao", "fique_de_olho"]
ATENCAO: Final[NivelAviso] = "atencao"
FIQUE_DE_OLHO: Final[NivelAviso] = "fique_de_olho"

# Chaves das fontes (o front escreve o nome): os satélites e modelos da NASA, a NOAA e os vizinhos.
FONTE_SMAP: Final[str] = "smap"
FONTE_POWER: Final[str] = "nasa_power"
FONTE_NOAA: Final[str] = "noaa"
FONTE_COMUNIDADE: Final[str] = "comunidade"

ValorAviso = float | int | str | None


@dataclass(frozen=True)
class RecentDay:
    """Um dia recente do NASA POWER na célula; `None` quando a API ainda não tem o valor."""

    data: date
    chuva_mm: float | None
    tmax_c: float | None


@dataclass(frozen=True)
class Aviso:
    """Um aviso: o tipo diz a frase; `valores` são os números dela; `data` é a da leitura."""

    tipo: str
    nivel: NivelAviso
    fontes: tuple[str, ...]
    data: date | None
    valores: Mapping[str, ValorAviso] = field(default_factory=dict)
    # Leitura com mais dias que o limite do `regras.yaml` (hoje, só o SMAP)
    antiga: bool = False


@dataclass(frozen=True)
class GrupoAvisos:
    """Os avisos de um grupo e a data da leitura mais recente (para o "Nada fora do normal")."""

    avisos: tuple[Aviso, ...]
    ultima_leitura: date | None


@dataclass(frozen=True)
class SafrinhaAviso:
    """A safrinha deste ano no ponto: a melhor opção do motor, a semeadura e a colheita.

    `em_andamento` = hoje entre a semeadura e a colheita (aí os avisos do replay valem para os dados
    recentes); fora dela, `explorar_ano` é o ano da série para "Ver como teriam sido os avisos".
    """

    em_andamento: bool
    cultura: str | None
    nome: str | None
    semeadura: date | None
    colheita: date | None
    explorar_ano: int | None


@dataclass(frozen=True)
class PeriodoComparado:
    """Os anos recentes e os de antes, como estão na série da célula."""

    recente_inicio: int
    recente_fim: int
    antes_inicio: int
    antes_fim: int


@dataclass(frozen=True)
class Avisos:
    """A tela inteira para o ponto; grupo `None` = sem dado (o front não desenha o grupo)."""

    lat: float
    lon: float
    celula_id: str
    hoje: date
    agora: GrupoAvisos
    mudou: GrupoAvisos | None
    periodo: PeriodoComparado | None
    recordes: GrupoAvisos | None
    perto: GrupoAvisos | None
    raio_km: float
    vizinhos_dias: int
    safrinha: SafrinhaAviso | None
    # Avisos ativos do botão "Avisos" do cabeçalho: só os de "Agora" (tarefa 0065)
    contador: int
