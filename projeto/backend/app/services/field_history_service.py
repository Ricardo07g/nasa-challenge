"""Histórico do talhão pelo NDVI do MODIS e faixa de colheita sugerida (PRD 7.8 e 7.9)."""

from collections import defaultdict
from collections.abc import Sequence
from datetime import date
from statistics import median

from app.constants import (
    EARLY_HARVEST_DOY_LIMIT,
    MID_HARVEST_DOY_LIMIT,
    MIN_NDVI_YEARS_FOR_SUGGESTION,
    NDVI_DECIMALS,
    NDVI_SCALE_FACTOR,
)
from app.models.regras import Regras
from app.models.talhao import (
    ColheitaSugerida,
    HistoricoAno,
    HistoricoTalhao,
    NdviRecord,
    SituacaoAno,
)
from app.repositories.rules_repository import load_default_rules


def scaled_ndvi(value: float) -> float:
    """NDVI físico (-1 a 1) na precisão do MOD13Q1. O bruto vem inteiro com fator 0,0001."""
    physical = value * NDVI_SCALE_FACTOR if abs(value) > 1.0 else value
    return round(physical, NDVI_DECIMALS)


def month_day(text: str) -> tuple[int, int]:
    """'04-01' -> (4, 1), para comparar datas de anos diferentes sem montar `date`."""
    month, day = text.split("-")
    return int(month), int(day)


def _source_label(records: Sequence[NdviRecord]) -> str:
    """'MODIS MOD13Q1 + MYD13Q1' com os produtos da série; o cache antigo não diz o produto."""
    produtos = sorted({rec.produto for rec in records if rec.produto})
    return " ".join(["MODIS", " + ".join(produtos)]) if produtos else "MODIS"


class FieldHistoryService:
    """Lê a série de NDVI do talhão: uso na entressafra e quando a soja seca."""

    def __init__(self, rules: Regras | None = None) -> None:
        regras = rules if rules is not None else load_default_rules()
        self._ndvi = regras.ndvi
        self._historico = regras.historico_ndvi

    def classify_entressafra(self, ndvi_records: Sequence[NdviRecord]) -> HistoricoTalhao:
        """Cada ano da janela pelo maior NDVI de 1/abr a 31/jul (guia NDVI, "Regra do talhão").

        As observações já chegam com qualidade 0 ou 1 (o repository descarta neve e nuvem).
        Os anos, a janela, os limites e o mínimo de observações vêm do `regras.yaml`.
        """
        regra = self._historico
        by_year: dict[int, list[float]] = defaultdict(list)
        for rec in ndvi_records:
            if self.in_entressafra(rec.data):
                by_year[rec.data.year].append(scaled_ndvi(rec.ndvi))

        anos = tuple(
            self.classify_year(ano, by_year.get(ano, []))
            for ano in range(regra.ano_inicio, regra.ano_fim + 1)
        )
        parado = sum(1 for a in anos if a.situacao == "parado")
        plantou = sum(1 for a in anos if a.situacao == "plantou")
        return HistoricoTalhao(
            anos=anos,
            parado=parado,
            plantou=plantou,
            sem_certeza=len(anos) - parado - plantou,
            total=len(anos),
            fonte=_source_label(ndvi_records),
            janela=f"{regra.janela_inicio} a {regra.janela_fim}",
        )

    def in_entressafra(self, day: date) -> bool:
        """O dia cai na janela da entressafra (`janela_inicio` a `janela_fim`, inclusive)?"""
        regra = self._historico
        inicio, fim = month_day(regra.janela_inicio), month_day(regra.janela_fim)
        return inicio <= (day.month, day.day) <= fim

    def classify_year(self, ano: int, valores: Sequence[float]) -> HistoricoAno:
        """Um ano pelas observações boas da janela, já no NDVI físico (o talhão e cada pixel da
        região usam esta regra). Poucas observações: sem_dado; > limite_plantou: plantou;
        < limite_parado: parado; senão incerto.
        """
        regra = self._historico
        if len(valores) < regra.min_observacoes:
            return HistoricoAno(ano=ano, situacao="sem_dado", ndvi_max=None, n_obs=len(valores))
        maior = max(valores)
        situacao: SituacaoAno
        if maior > regra.limite_plantou:
            situacao = "plantou"
        elif maior < regra.limite_parado:
            situacao = "parado"
        else:
            situacao = "incerto"
        return HistoricoAno(ano=ano, situacao=situacao, ndvi_max=maior, n_obs=len(valores))

    def suggest_harvest_band(self, ndvi_records: Sequence[NdviRecord]) -> ColheitaSugerida:
        """Primeira imagem de jan a mar abaixo de 50% do pico; mediana dos anos vira a faixa."""
        by_year: dict[int, list[tuple[date, float]]] = defaultdict(list)
        for rec in ndvi_records:
            if 1 <= rec.data.month <= 3:
                by_year[rec.data.year].append((rec.data, scaled_ndvi(rec.ndvi)))

        drop_doys: list[int] = []
        for year in sorted(by_year):
            pts = sorted(by_year[year])
            threshold = max(val for _, val in pts) * self._ndvi.queda_colheita
            harvest_day = next(
                (day for day, val in pts if day.month >= 2 and val <= threshold), None
            )
            if harvest_day is not None:
                drop_doys.append(harvest_day.timetuple().tm_yday)

        if len(drop_doys) < MIN_NDVI_YEARS_FOR_SUGGESTION:
            return ColheitaSugerida(faixa="meio", fonte="padrao", anos_usados=0)

        med_doy = median(drop_doys)
        if med_doy <= EARLY_HARVEST_DOY_LIMIT:
            faixa = "cedo"
        elif med_doy <= MID_HARVEST_DOY_LIMIT:
            faixa = "meio"
        else:
            faixa = "tarde"
        return ColheitaSugerida(faixa=faixa, fonte="ndvi_modis", anos_usados=len(drop_doys))
