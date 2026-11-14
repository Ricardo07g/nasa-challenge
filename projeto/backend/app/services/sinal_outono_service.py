"""Sinal para o outono e regra do dia de plantar (PRD 7.10, RF-20; plano de evolução, ajuste A2).

Regra (hipótese a calibrar com as previsões retrospectivas do GMAO, tarefa A2.5):
- seco: GEOS-S2S com chance de chuva abaixo do normal em março a maio >= 50%, OU terra seca agora
  (SMAP abaixo do percentil 20 E chuva dos últimos 30 dias abaixo de 60% da média);
- normal: chance < 33% E terra sem falta de água;
- incerto: qualquer outro caso.
Mostra chance, nunca certeza, e nunca inventa previsão: sem dado, não há sinal.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from app.models.recomendacao import PlanoRotacao, ResultadoOpcao
from app.models.regras import Regras, RegrasSinalOutono
from app.models.sinal_outono import (
    NivelSinal,
    RecentRain,
    RecentSoilMoisture,
    RegraDiaPlantar,
    SeasonalForecast,
    SinalOutono,
)
from app.repositories.rules_repository import load_default_rules
from app.repositories.sinal_outono_repository import (
    RecentRainRepository,
    RecentSoilMoistureRepository,
    SeasonalForecastRepository,
)

SECO: NivelSinal = "seco"
NORMAL: NivelSinal = "normal"
INCERTO: NivelSinal = "incerto"
SOURCE_FORECAST, SOURCE_SOIL, SOURCE_RAIN = "GEOS-S2S", "SMAP", "GPM IMERG"
FALLOW_NAME = {"pt": "pousio", "en": "fallow"}
MONTHS_PT = ("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")
MONTHS_EN = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
PERCENT = 100


def _pct(fraction: float) -> int:
    """Percentual inteiro para a frase, arredondado para baixo (49,9% não vira 50%)."""
    return math.floor(round(fraction * PERCENT, 6))


@dataclass(frozen=True)
class _Soil:
    """A terra agora: SMAP e chuva recente juntos (um sem o outro não diz se está seca)."""

    moisture: RecentSoilMoisture
    rain: RecentRain

    def is_dry(self, regras: RegrasSinalOutono) -> bool:
        """Terra seca (PRD 7.10): SMAP abaixo do percentil E chuva abaixo da fração da média."""
        return (
            self.moisture.sm_rootzone_pctl < regras.smap_percentil_seco
            and self.rain.fracao_da_media < regras.chuva_fracao_seco
        )

    def has_water(self, regras: RegrasSinalOutono) -> bool:
        """Terra sem falta de água: nenhum dos dois indicadores abaixo do limiar de seca."""
        return (
            self.moisture.sm_rootzone_pctl >= regras.smap_percentil_seco
            and self.rain.fracao_da_media >= regras.chuva_fracao_seco
        )


class SinalOutonoService:
    """Junta GEOS-S2S, SMAP e chuva recente num sinal `seco`, `normal` ou `incerto`."""

    def __init__(
        self,
        forecast_repo: SeasonalForecastRepository,
        soil_moisture_repo: RecentSoilMoistureRepository,
        rain_repo: RecentRainRepository,
        rules: Regras | None = None,
    ) -> None:
        self._forecast_repo = forecast_repo
        self._soil_moisture_repo = soil_moisture_repo
        self._rain_repo = rain_repo
        self._regras = (rules if rules is not None else load_default_rules()).sinal_outono

    def evaluate(
        self,
        lat: float,
        lon: float,
        plano_a: PlanoRotacao,
        plano_b: PlanoRotacao,
        opcoes: Sequence[ResultadoOpcao],
        semeadura: date,
        lang: str = "pt-BR",
    ) -> SinalOutono | None:
        """Sinal para o ponto, com a regra do dia de plantar entre o Plano A e o Plano B.

        O Plano A é o melhor plano do ano normal e o Plano B, o do ano seco (PRD 7.7 e 7.10).
        Devolve None quando não há previsão nem dado da terra (SMAP e chuva recente juntos).
        """
        forecast = self._forecast_repo.get_seasonal_forecast(lat, lon)
        moisture = self._soil_moisture_repo.get_recent_soil_moisture(lat, lon)
        rain = self._rain_repo.get_recent_rain(lat, lon)
        soil = _Soil(moisture, rain) if moisture is not None and rain is not None else None
        if forecast is not None:
            data = forecast.data
        elif soil is not None:
            data = max(soil.moisture.data, soil.rain.data)
        else:
            return None

        lang_key = "en" if lang.lower().startswith("en") else "pt"
        fonte = ((SOURCE_FORECAST,) if forecast else ()) + (
            (SOURCE_SOIL, SOURCE_RAIN) if soil else ()
        )
        return SinalOutono(
            nivel=self._level(forecast, soil),
            motivo=self._reason(forecast, soil, lang_key),
            fonte=fonte,
            data=data,
            regra_dia_plantar=self._planting_rule(plano_a, plano_b, opcoes, semeadura, lang_key),
        )

    def _level(self, forecast: SeasonalForecast | None, soil: _Soil | None) -> NivelSinal:
        regras = self._regras
        chance = forecast.chance_abaixo_normal if forecast else None
        if (chance is not None and chance >= regras.chance_seco_min) or (
            soil is not None and soil.is_dry(regras)
        ):
            return SECO
        if (
            chance is not None
            and chance < regras.chance_normal_max
            and soil is not None
            and soil.has_water(regras)
        ):
            return NORMAL
        return INCERTO

    def _reason(self, forecast: SeasonalForecast | None, soil: _Soil | None, lang: str) -> str:
        """O motivo em uma frase, com os números que levaram ao nível (chance, percentil, chuva)."""
        en = lang == "en"
        if forecast:
            chance = _pct(forecast.chance_abaixo_normal)
            forecast_part = (
                f"the NASA outlook ({SOURCE_FORECAST}) gives a {chance}% chance of below-normal "
                "rain from March to May"
                if en
                else f"a previsão da NASA ({SOURCE_FORECAST}) dá {chance}% de chance de chuva "
                "abaixo do normal de março a maio"
            )
        else:
            forecast_part = (
                f"no NASA outlook ({SOURCE_FORECAST}) for March to May yet"
                if en
                else f"ainda sem a previsão da NASA ({SOURCE_FORECAST}) para março a maio"
            )
        if soil:
            pctl = math.floor(soil.moisture.sm_rootzone_pctl)
            rain_pct = _pct(soil.rain.fracao_da_media)
            dias = soil.rain.dias
            soil_part = (
                f"root-zone moisture at percentile {pctl} ({SOURCE_SOIL}) and {rain_pct}% of the "
                f"average rain in the last {dias} days ({SOURCE_RAIN})"
                if en
                else f"umidade na raiz no percentil {pctl} ({SOURCE_SOIL}) e {rain_pct}% da chuva "
                f"média dos últimos {dias} dias ({SOURCE_RAIN})"
            )
            if soil.is_dry(self._regras):
                soil_part = (
                    "the soil is dry now: " if en else "a terra está seca agora: "
                ) + soil_part
        else:
            soil_part = (
                "no current soil data yet (SMAP and recent rain)"
                if en
                else "ainda sem o dado da terra agora (SMAP e chuva recente)"
            )
        sentence = f"{forecast_part}; {soil_part}."
        return sentence[0].upper() + sentence[1:]

    @staticmethod
    def _planting_rule(
        plano_a: PlanoRotacao,
        plano_b: PlanoRotacao,
        opcoes: Sequence[ResultadoOpcao],
        semeadura: date,
        lang: str,
    ) -> RegraDiaPlantar:
        """Regra do dia de plantar (PRD 7.10): até a data limite da cultura do 1º ano do Plano A
        (ou do Plano B, se o A começa sem data limite), terra seca no dia -> Plano B."""
        by_id = {o.id: o for o in opcoes}

        def deadline(crop_id: str) -> date | None:
            option = by_id.get(crop_id)
            return date.fromisoformat(option.data_limite) if option and option.data_limite else None

        def name(crop_id: str) -> str:
            option = by_id.get(crop_id)
            nome = option.nome if option else FALLOW_NAME[lang]
            return nome[:1].lower() + nome[1:]

        first_a, first_b = plano_a.anos[0], plano_b.anos[0]
        limite = deadline(first_a) or deadline(first_b) or semeadura
        en = lang == "en"
        dia = (
            f"{MONTHS_EN[limite.month - 1]} {limite.day}"
            if en
            else f"{limite.day}/{MONTHS_PT[limite.month - 1]}"
        )
        a, b = name(first_a), name(first_b)
        if plano_a.anos == plano_b.anos:
            texto = (
                f"Plans A and B are the same: plant {a} by {dia}, whether the soil is dry or not."
                if en
                else f"Os planos A e B são iguais: plante {a} até {dia}, com a terra seca ou não."
            )
        elif first_a == first_b:
            texto = (
                f"On sowing day (by {dia}), if the soil is dry, follow plan B; the 1st year stays "
                f"with {a}."
                if en
                else f"No dia de plantar (até {dia}), se a terra estiver seca, siga o plano B; "
                f"o 1º ano continua com {a}."
            )
        else:
            texto = (
                f"On sowing day (by {dia}), if the soil is dry, use plan B: {b} instead of {a}."
                if en
                else f"No dia de plantar (até {dia}), se a terra estiver seca, use o plano B: {b} "
                f"no lugar de {a}."
            )
        return RegraDiaPlantar(data_limite=limite, texto=texto)
