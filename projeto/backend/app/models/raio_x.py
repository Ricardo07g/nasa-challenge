"""Raio-X da sua terra (tela 4 "O que o satélite viu", remodelagem S4, tarefa 0043).

Cada bloco é `None` quando não há dado para o ponto: o elemento não aparece na tela. Os números
vêm do banco (`climate_season`, `soil_point`, `grid_cell`, `cmip6_delta`) e dos arquivos de
`data/baixados/` lidos pelos repositories; as frases ficam no front (pt e en).
"""

from dataclasses import dataclass
from datetime import date

from app.models.talhao import FimDasChuvas, SoloInfo


@dataclass(frozen=True)
class SoloVizinho:
    """O solo gravado mais perto do ponto (de qualquer célula) e a distância até ele."""

    soil: SoloInfo
    distancia_km: float


@dataclass(frozen=True)
class SoloRaioX:
    """Bloco 1: textura, argila e areia do SoilGrids. `vizinho_km` > 0 = ponto da célula vizinha."""

    textura: str
    argila_pct: float
    areia_pct: float
    cad_mm: float
    vizinho_km: float | None = None


@dataclass(frozen=True)
class AguaTerra:
    """Bloco 2: a água que a terra guarda (CAD) e quantos dias ela dura na floração.

    `dias` = CAD ÷ (ETo média na floração × Kc da cultura); `None` sem cultura (pousio).
    """

    cad_mm: float
    dias: int | None
    cultura: str | None
    nome: str | None
    floracao: str | None  # "MM-DD"
    eto_mm_dia: float | None
    kc: float | None
    consumo_mm_dia: float | None


@dataclass(frozen=True)
class UmidadeAgora:
    """Bloco 3: percentil do SMAP de agora na climatologia da mesma época (0 a 100)."""

    percentil: float
    data: date


@dataclass(frozen=True)
class VerdeLavoura:
    """Bloco 4: a última leitura do NDVI e o pico da soja na safra mais recente."""

    ultimo_ndvi: float | None
    ultimo_data: date | None
    pico_ndvi: float | None
    pico_data: date | None
    safra: str | None
    fonte: str


@dataclass(frozen=True)
class ChuvaTipica:
    """Bloco 5: total médio de janeiro a julho e o fim das chuvas (regra da tela 3)."""

    media_mm: float
    anos: tuple[int, ...]
    fonte: str
    fim_das_chuvas: FimDasChuvas | None


@dataclass(frozen=True)
class Veranico:
    """Bloco 6: a maior sequência de dias secos na janela, o ano e o dia em que começou."""

    dias: int
    ano: int
    inicio: str  # "MM-DD"
    total_anos: int
    fonte: str


@dataclass(frozen=True)
class CalorOutono:
    """Bloco 7: em quantos anos houve dia de calor (máxima ≥ limite) na janela."""

    anos_com_calor: int
    total_anos: int
    temp_c: float
    anos: tuple[int, ...]
    fonte: str


@dataclass(frozen=True)
class RegiaoChuva:
    """Bloco 8: a chuva média da célula na janela, comparada com as outras células da caixa."""

    chuva_mm: float
    mediana_regiao_mm: float
    celulas: int
    pct_mais_seca: int
    pct_mais_chuvosa: int
    fonte: str


@dataclass(frozen=True)
class FaixaNdviAno:
    """Uma linha da faixa de calor: o NDVI de cada coluna de 16 dias (`None` = sem leitura boa)."""

    ano: int
    valores: tuple[float | None, ...]


@dataclass(frozen=True)
class FaixaNdvi:
    """Histórico do talhão em faixa de calor: um ano por linha, uma leitura de 16 dias por coluna.

    A faixa de calor ("heatmap") vai de janeiro a julho.
    """

    colunas: tuple[str, ...]  # "MM-DD" do começo de cada coluna
    anos: tuple[FaixaNdviAno, ...]
    fonte: str
    colheita_dia: str | None  # "MM-DD": o dia em que a soja costuma secar (RF-16)


@dataclass(frozen=True)
class AlertaGeada:
    anos: tuple[int, ...]
    total_anos: int
    temp_c: float
    menor_temp_c: float
    fonte: str


@dataclass(frozen=True)
class AlertaChuvaForte:
    media_dias_ano: float
    dias: int
    total_anos: int
    limite_mm: float
    fonte: str


@dataclass(frozen=True)
class AlertaFogo:
    anos: tuple[int, ...]
    total_anos: int
    raio_km: float
    fonte: str


@dataclass(frozen=True)
class AlertasArea:
    geada: AlertaGeada | None = None
    chuva_forte: AlertaChuvaForte | None = None
    fogo: AlertaFogo | None = None


@dataclass(frozen=True)
class ChuvaVinteAnos:
    """Cartão: em quantos anos da série a melhor opção do motor deu certo."""

    cultura: str
    nome: str
    anos_bons: int
    total_anos: int


@dataclass(frozen=True)
class ClimaFuturo:
    """Cartão: variação da chuva (%) e da máxima (°C) de março a maio, média dos modelos."""

    chuva_pct: float
    tmax_c: float
    modelos: int
    modelos_menos_chuva: int
    modelos_mais_chuva: int
    modelos_mais_quente: int
    cenario: str
    periodo: str


@dataclass(frozen=True)
class CartoesRaioX:
    chuva_20_anos: ChuvaVinteAnos | None = None
    clima_futuro: ClimaFuturo | None = None


@dataclass(frozen=True)
class RaioX:
    lat: float
    lon: float
    celula_id: str
    leitura_recente: date | None
    # A altitude só entraria se existisse no `grid_cell` (pedido: não buscar fora). Hoje não existe.
    altitude_m: float | None
    solo: SoloRaioX | None
    agua: AguaTerra | None
    umidade: UmidadeAgora | None
    verde: VerdeLavoura | None
    chuva: ChuvaTipica | None
    veranico: Veranico | None
    calor: CalorOutono | None
    regiao: RegiaoChuva | None
    historico_ndvi: FaixaNdvi | None
    alertas: AlertasArea
    cartoes: CartoesRaioX
