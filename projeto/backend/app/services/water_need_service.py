"""Linha "Água" e selo "Sede da cultura" de cada opção (seção 5.3 da remodelagem, tarefa 0044).

Tudo sai do balanço hídrico diário que o motor já faz (`ClimateRiskService.simulate_historical`):
em cada ano, o consumo da cultura no ciclo (ETc = ETo x Kc), o que ela conseguiu usar (ETr) e a
chuva. Aqui ficam só as medianas, o ano seco e os cortes da sede (grupo `agua` do `regras.yaml`).
Não há número para a palhada, a enxurrada nem a água guardada para a próxima safra: não temos dado.
"""

from collections.abc import Mapping, Sequence
from statistics import mean, median
from typing import Final

from app.constants import PERCENT_DIVISOR
from app.models.recomendacao import AguaFuturo, AguaOpcao, ResultadoAno
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules
from app.services.remaining_rain_service import percentile

THIRST_LOW: Final[str] = "pouca"
THIRST_MEDIUM: Final[str] = "media"
THIRST_HIGH: Final[str] = "muita"


def shortage_mm(resultado: ResultadoAno) -> float:
    """Falta de água no ciclo: o que a cultura queria (ETc) menos o que ela usou (ETr)."""
    return max(0.0, resultado.etc_mm - resultado.etr_mm)


class WaterNeedService:
    """Resume a conta de água de uma opção: precisa, costuma chover, falta e sede."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._agua = (rules if rules is not None else load_default_rules()).agua

    def thirst(self, precisa_mm: float) -> str:
        """Sede da cultura pelo consumo no ciclo: pouca, media ou muita (cortes do regras.yaml)."""
        if precisa_mm < self._agua.sede_pouca_ate_mm:
            return THIRST_LOW
        if precisa_mm < self._agua.sede_muita_desde_mm:
            return THIRST_MEDIUM
        return THIRST_HIGH

    def summarize(
        self,
        resultados: Sequence[ResultadoAno],
        cad_mm: float,
        futuro_por_modelo: Mapping[str, Sequence[ResultadoAno]] | None = None,
    ) -> AguaOpcao | None:
        """A linha "Água" da opção; None sem nenhum ano simulado.

        Args:
            resultados: Os anos simulados hoje (mesma conta do "deu certo").
            cad_mm: Água disponível do solo usada na conta.
            futuro_por_modelo: Os anos simulados em 2041-2060, por modelo do CMIP6
                (`ClimateRiskService.simulate_future_by_model`). Vazio ou None: sem futuro.
        """
        if not resultados:
            return None
        precisa = median(r.etc_mm for r in resultados)
        falta_normal = self._normal_shortage(resultados)
        return AguaOpcao(
            precisa_mm=round(precisa),
            chove_mm=round(median(r.chuva_mm for r in resultados)),
            falta_normal_mm=round(falta_normal),
            falta_seco_mm=round(self._dry_year_shortage(resultados)),
            sede=self.thirst(precisa),
            cad_mm=round(cad_mm),
            anos=len(resultados),
            futuro=self._future(falta_normal, futuro_por_modelo or {}),
        )

    @staticmethod
    def _normal_shortage(resultados: Sequence[ResultadoAno]) -> float:
        return median(shortage_mm(r) for r in resultados)

    def _dry_year_shortage(self, resultados: Sequence[ResultadoAno]) -> float:
        """Ano seco: só `percentil_seco`% dos anos com falta maior (percentil 100 - 20 da falta)."""
        pct = PERCENT_DIVISOR - self._agua.percentil_seco
        return percentile([shortage_mm(r) for r in resultados], pct)

    def _future(
        self, falta_hoje: float, por_modelo: Mapping[str, Sequence[ResultadoAno]]
    ) -> AguaFuturo | None:
        faltas = [self._normal_shortage(anos) for anos in por_modelo.values() if anos]
        if not faltas:
            return None
        media = mean(faltas)
        return AguaFuturo(
            falta_normal_mm=round(media),
            falta_min_mm=round(min(faltas)),
            falta_max_mm=round(max(faltas)),
            mudanca_mm=round(media) - round(falta_hoje),
            modelos=len(faltas),
        )
