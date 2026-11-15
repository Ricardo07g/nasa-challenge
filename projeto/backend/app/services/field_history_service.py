"""Histórico do talhão pelo NDVI do MODIS e faixa de colheita sugerida (PRD 7.8 e 7.9).

A soja do ano (pico e colheita, grupo `regiao_ndvi` do `regras.yaml`) fica aqui, num lugar só:
o talhão e cada pixel da região pelo satélite (`RegionClassifier`) usam a mesma regra.
"""

from collections import defaultdict
from collections.abc import Iterable, Sequence
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


# Uma observação boa (qualidade 0 ou 1) do pixel: o dia e o NDVI (bruto ou físico).
Observation = tuple[date, float]


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
        self._soja = regras.regiao_ndvi

    def classify_entressafra(self, ndvi_records: Sequence[NdviRecord]) -> HistoricoTalhao:
        """Cada ano da janela: a soja do ano e a entressafra depois da colheita (tarefa 0039).

        As observações já chegam com qualidade 0 ou 1 (o repository descarta neve e nuvem).
        Os anos, os limites e o mínimo de observações vêm do `historico_ndvi` do `regras.yaml`;
        o pico, a colheita e o fim da entressafra, do `regiao_ndvi` (`classify_soy_year`).
        """
        regra = self._historico
        by_year: dict[int, list[Observation]] = defaultdict(list)
        for rec in ndvi_records:
            by_year[rec.data.year].append((rec.data, rec.ndvi))

        anos = tuple(
            self.classify_soy_year(ano, by_year.get(ano, []))
            for ano in range(regra.ano_inicio, regra.ano_fim + 1)
        )
        return HistoricoTalhao(
            anos=anos,
            parado=sum(1 for a in anos if a.situacao == "parado"),
            plantou=sum(1 for a in anos if a.situacao == "plantou"),
            sem_certeza=sum(1 for a in anos if a.situacao in ("incerto", "sem_dado")),
            total=len(anos),
            fonte=_source_label(ndvi_records),
            janela=f"{regra.janela_inicio} a {regra.janela_fim}",
            sem_soja=sum(1 for a in anos if a.situacao == "sem_soja"),
        )

    def classify_soy_year(self, ano: int, observations: Iterable[Observation]) -> HistoricoAno:
        """Um ano do talhão: só conta como entressafra depois da soja se o pixel mostrou a soja.

        Sem nenhuma observação boa na janela do pico (o satélite não viu o verão): `sem_dado`.
        Sem pico ou sem colheita (cidade, cana, pasto): `sem_soja`. Com a soja, a regra de hoje
        (`classify_year`) com as observações depois da colheita até o fim da entressafra.
        """
        do_ano = [(day, ndvi) for day, ndvi in observations if day.year == ano]
        if not any(self._in_soy_peak_window(day) for day, _ in do_ano):
            return HistoricoAno(ano=ano, situacao="sem_dado", ndvi_max=None, n_obs=0)
        valores = self.post_harvest_values(ano, do_ano)
        if valores is None:
            return HistoricoAno(ano=ano, situacao="sem_soja", ndvi_max=None, n_obs=0)
        return self.classify_year(ano, valores)

    def soy_harvest_date(self, ano: int, observations: Iterable[Observation]) -> date | None:
        """Data da colheita da soja do ano no pixel; None se o pixel não mostrou a soja.

        Pico: o maior NDVI de `pico_inicio` a `pico_fim` precisa chegar a `pico_min_ndvi` (com
        o mesmo valor em duas datas, vale a última). Colheita: a primeira observação depois do
        pico, até `colheita_fim`, com NDVI até `colheita_max_ndvi`. Sem pico ou sem colheita
        (cana, café, pasto, solo exposto), None. As observações já chegam boas (qualidade 0/1).
        """
        regra = self._soja
        serie = sorted((day, scaled_ndvi(ndvi)) for day, ndvi in observations if day.year == ano)
        janela = [(day, ndvi) for day, ndvi in serie if self._in_soy_peak_window(day)]
        if not janela:
            return None
        pico = max(ndvi for _, ndvi in janela)
        if pico < regra.pico_min_ndvi:
            return None
        dia_pico = max(day for day, ndvi in janela if ndvi == pico)
        limite = month_day(regra.colheita_fim)
        return next(
            (
                day
                for day, ndvi in serie
                if day > dia_pico
                and (day.month, day.day) <= limite
                and ndvi <= regra.colheita_max_ndvi
            ),
            None,
        )

    def post_harvest_values(
        self, ano: int, observations: Iterable[Observation]
    ) -> list[float] | None:
        """NDVI físico das observações depois da colheita até `entressafra_fim` (a observação da
        colheita fica de fora); None se o pixel não mostrou a soja do ano.
        """
        observations = list(observations)
        colheita = self.soy_harvest_date(ano, observations)
        if colheita is None:
            return None
        fim = month_day(self._soja.entressafra_fim)
        return [
            scaled_ndvi(ndvi)
            for day, ndvi in observations
            if day.year == ano and day > colheita and (day.month, day.day) <= fim
        ]

    def _in_soy_peak_window(self, day: date) -> bool:
        inicio, fim = month_day(self._soja.pico_inicio), month_day(self._soja.pico_fim)
        return inicio <= (day.month, day.day) <= fim

    def classify_year(self, ano: int, valores: Sequence[float]) -> HistoricoAno:
        """Uma entressafra pelas observações boas depois da colheita, já no NDVI físico (o talhão
        e cada pixel da região usam esta regra). Poucas observações: sem_dado;
        > limite_plantou: plantou; < limite_parado: parado; senão incerto.
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
