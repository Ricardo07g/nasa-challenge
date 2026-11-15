"""Domain entities for field inspection (Talhao), SoilGrids texture, and MODIS NDVI history."""

from dataclasses import dataclass
from datetime import date
from typing import Final, Literal

from app.models.soja_recente import SojaRecente
from app.models.validation import require_between

# Contrato do NDVI (projeto/backend/AGENTS.md, "Contrato dos dados das fontes").
# Faixa válida do MOD13Q1 bruto (-2000 a 10000); o NDVI físico (-0,2 a 1) cabe dentro dela.
# O valor de preenchimento (-3000, pixel sem dado) fica de fora.
NDVI_VALID_MIN: Final[float] = -2000.0
NDVI_VALID_MAX: Final[float] = 10000.0
# pixel_reliability (ORNL/AppEEARS) ou SummaryQA (Earth Engine): 0 = bom, 1 = aceitável.
# 2 (neve) e 3 (nuvem) são descartados no script de dados e nunca chegam ao model.
NDVI_BEST_QUALITY: Final[int] = 0
NDVI_WORST_ACCEPTED_QUALITY: Final[int] = 1
# Terra (MOD13Q1) e Aqua (MYD13Q1), coleção 061, defasados em 8 dias.
NDVI_PRODUCTS: Final[frozenset[str]] = frozenset({"MOD13Q1", "MYD13Q1"})


@dataclass(frozen=True)
class SoloInfo:
    """Soil texture and available water capacity (CAD) derived from SoilGrids 250m."""

    argila_percentual: float
    areia_percentual: float
    textura_solo: str
    cad_capacidade_agua_mm: float
    fonte: str


@dataclass(frozen=True)
class NdviRecord:
    """Uma observação de 16 dias do MODIS no ponto, com a qualidade já filtrada (PRD 7.8).

    `ndvi` aceita o valor bruto (inteiro com fator 0,0001) ou o físico; os arquivos e a tabela
    novos gravam o físico. `qualidade` e `produto` são opcionais só porque o cache antigo traz
    apenas `data` e `ndvi`.
    """

    data: date
    ndvi: float
    qualidade: int | None = None
    produto: str | None = None

    def __post_init__(self) -> None:
        require_between("ndvi", self.ndvi, NDVI_VALID_MIN, NDVI_VALID_MAX)
        if self.qualidade is not None and not (
            NDVI_BEST_QUALITY <= self.qualidade <= NDVI_WORST_ACCEPTED_QUALITY
        ):
            raise ValueError(f"qualidade precisa ser 0 ou 1, veio {self.qualidade!r}")
        if self.produto is not None and self.produto not in NDVI_PRODUCTS:
            raise ValueError(f"produto precisa ser MOD13Q1 ou MYD13Q1, veio {self.produto!r}")


# Situação da entressafra de um ano (guia do histórico NDVI): a tela mostra plantou (verde),
# parado (laranja) e "sem certeza" (cinza, juntando incerto e sem_dado). `sem_soja` (decisão de
# 15/11/2026): o pixel não mostrou a soja e a colheita no verão; o ano não é entressafra depois
# da soja e não conta como parado, plantou nem sem certeza.
SituacaoAno = Literal["plantou", "parado", "incerto", "sem_dado", "sem_soja"]

# O que o produtor confirma numa das últimas entressafras (tarefa 0039): "Plantei" ou "Deixei
# parado". A resposta dele vale no lugar do satélite naquele ano.
Confirmacao = Literal["plantou", "parado"]
CONFIRMACOES: Final[tuple[Confirmacao, ...]] = ("plantou", "parado")
# De onde veio a situação de cada ano do histórico.
FonteAno = Literal["satelite", "produtor"]
PRODUCER_SOURCE: Final[str] = "produtor"


@dataclass(frozen=True)
class HistoricoAno:
    """Uso da entressafra de um ano pelo NDVI do MODIS (PRD 7.8).

    `n_obs` = observações boas da entressafra (depois da colheita da soja até 31/jul);
    `ndvi_max` é None quando o ano fica `sem_dado` ou `sem_soja` (aí `n_obs` é 0). No ano que o
    produtor confirmou, `situacao` é a dele e `fonte_ano` é "produtor"; `ndvi_max` e `n_obs`
    continuam os do satélite.
    """

    ano: int
    situacao: SituacaoAno
    ndvi_max: float | None
    n_obs: int
    fonte_ano: FonteAno = "satelite"


@dataclass(frozen=True)
class HistoricoTalhao:
    """Resumo das entressafras da janela de anos (guia do histórico NDVI, "Contrato da API").

    `sem_certeza` = incerto + sem_dado; `sem_soja` = anos sem a soja no verão; `total` = anos da
    janela (parado + plantou + sem_certeza + sem_soja); `janela` = "MM-DD a MM-DD". `fonte` lista
    os produtos do MODIS da série; sem série, só com as safras confirmadas, é "produtor".
    """

    anos: tuple[HistoricoAno, ...]
    parado: int
    plantou: int
    sem_certeza: int
    total: int
    fonte: str
    janela: str
    sem_soja: int = 0


@dataclass(frozen=True)
class ColheitaSugerida:
    """Satellite-derived suggested soybean harvest window.

    `dia` ("MM-DD"): o dia em que a soja costuma secar pelo NDVI (mediana dos anos, tarefa 0042);
    a `faixa` sai dele pela regra da data exata da tela 3. None sem NDVI suficiente (`padrao`).
    """

    faixa: str
    fonte: str
    anos_usados: int
    dia: str | None = None


@dataclass(frozen=True)
class ChuvaMes:
    """Chuva média de um mês na célula (mm): a média, entre os anos, do total daquele mês.

    `eto_media_mm`: a média da evapotranspiração de referência (ETo, o que a lavoura gasta) do mês,
    a mesma do motor (tarefa 0042); None sem ETo.
    """

    mes: int
    media_mm: float
    eto_media_mm: float | None = None


@dataclass(frozen=True)
class ChuvaMensal:
    """Chuva de cada mês na região, de janeiro a junho (gráfico da tela 3).

    `anos` = os anos que entraram na média, em ordem; `fonte` = a `rain_source` das temporadas
    (mais de uma: as chaves em ordem, separadas por `+`). Com ETo (tarefa 0042): `fonte_eto`
    (`nasa_power`: a ETo é calculada com o clima do POWER) e `mes_chuva_abaixo_eto`, o primeiro
    mês em que a chuva média fica menor que a ETo média (None se nunca fica).
    """

    meses: tuple[ChuvaMes, ...]
    anos: tuple[int, ...]
    fonte: str
    fonte_eto: str | None = None
    mes_chuva_abaixo_eto: int | None = None


@dataclass(frozen=True)
class ChuvaQueSobraDia:
    """Chuva de um dia de colheita até o fim (mm): a mediana dos anos e a de um ano seco."""

    dia: str  # "MM-DD" do dia da colheita
    mediana_mm: float
    seco_mm: float


@dataclass(frozen=True)
class ChuvaQueSobra:
    """Chuva que sobra depois da colheita (tela 3, tarefa 0042).

    Para cada dia da época da colheita (`regras.yaml`, grupo `colheita`), a chuva somada do dia
    até `fim` ("MM-DD", inclusive) em cada ano: a mediana e o ano seco (`percentil_seco`).
    `anos` = os anos usados; `fonte` = a `rain_source` deles (mais de uma, separadas por `+`).
    """

    fim: str
    percentil_seco: int
    dias: tuple[ChuvaQueSobraDia, ...]
    anos: tuple[int, ...]
    fonte: str


@dataclass(frozen=True)
class DiaDoAno:
    """Um dia do calendário ("MM-DD") e o ano em que aconteceu."""

    dia: str
    ano: int


@dataclass(frozen=True)
class FimDasChuvas:
    """Fim das chuvas na célula (tela 3, tarefa 0042; regras no grupo `fim_das_chuvas`).

    `mediana`: em metade dos anos, a chuva acabou até esse dia ("MM-DD"); `mais_cedo` e
    `mais_tarde`: o primeiro e o último fim da série, com o ano.
    """

    mediana: str
    mais_cedo: DiaDoAno
    mais_tarde: DiaDoAno
    anos: tuple[int, ...]
    fonte: str
    inicio: str
    dias: int
    chuva_max_mm: float


@dataclass(frozen=True)
class FonteDado:
    """Uma fonte de dado usada na conta, com o período (plano técnico §3.1, campo `dados`)."""

    fonte: str
    periodo: str
    cenario: str | None = None
    modelos: int | None = None


@dataclass(frozen=True)
class Talhao:
    """Consolidated spatial, soil, and satellite history inspection for a field coordinate."""

    lat: float
    lon: float
    celula_id: str | None
    dentro_da_area: bool
    solo: SoloInfo
    colheita_sugerida: ColheitaSugerida
    historico: HistoricoTalhao | None
    dados_fontes: tuple[FonteDado, ...]
    # None fora da área ou sem temporada de 1/jan a 30/jun (o front mostra "Ainda não conectado").
    chuva_mensal: ChuvaMensal | None = None
    # Soja vista no ponto na safra mais recente (RF-24); None sem o arquivo ou fora da grade.
    soja_recente: SojaRecente | None = None
    # Entressafras que o produtor pode confirmar (as últimas da janela, tarefa 0039).
    anos_confirmaveis: tuple[int, ...] = ()
    # Tela 3 (tarefa 0042): chuva que sobra depois de cada dia de colheita e o fim das chuvas na
    # célula; None fora da área, sem temporada completa ou (fim) com algum ano que não secou.
    chuva_que_sobra: ChuvaQueSobra | None = None
    fim_das_chuvas: FimDasChuvas | None = None
