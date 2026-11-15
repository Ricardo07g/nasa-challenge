"""Unit tests for RecommendationService (notas, rótulos, ranking, alternativas e frases)."""

from dataclasses import replace
from datetime import date, timedelta

import pytest

from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture
from app.models.crop_option import CropParams
from app.models.enso import OniYear
from app.models.enso_forecast import EnsoForecast, EnsoSeasonForecast
from app.models.recomendacao import Alternativa, NotasOpcao, Recomendacao, ResultadoOpcao
from app.models.regras import Regras
from app.models.sinal_outono import RecentSoilMoisture
from app.models.talhao import NdviRecord, SoloInfo
from app.repositories.rules_repository import load_default_rules
from app.services.climate_risk_service import ClimateRiskService
from app.services.errors import OutsideAreaError, ValidationDomainError
from app.services.plan_b_service import PlanBService
from app.services.raio_x_service import RaioXService
from app.services.recommendation_service import (
    RecommendationService,
    build_alternatives,
    soil_score,
)
from app.services.rotation_plan_service import RotationPlanService
from app.services.sinal_outono_service import SinalOutonoService
from app.services.water_balance_calculator import WaterBalanceCalculator
from app.services.year_detail_service import YearDetailService

DAYS = 212
CELL_ID = "-190_-482"


def _crop(
    crop_id: str,
    tipo: str,
    limite: str | None,
    solo: tuple[int, int, int],
    n_kg: int = 0,
    steps_en: tuple[str, ...] = ("Step 1",),
) -> CropParams:
    palhada, nitrogenio, pragas = solo
    return CropParams(
        id=crop_id,
        nome=crop_id.replace("_", " ").title(),
        nome_en=f"{crop_id} (en)",
        tipo=tipo,
        funcao="x",
        semeadura_limite_mes_dia=limite,
        dias_florescer=0 if tipo == "pousio" else 60,
        ciclo_dias=0 if tipo == "pousio" else 100,
        kc_pico=1.0,
        solo_palhada=palhada,
        solo_nitrogenio=nitrogenio,
        solo_pragas=pragas,
        n_deixado_kg=n_kg,
        como_fazer=("Passo 1",),
        como_fazer_en=steps_en,
    )


# Pontos de solo da tabela 7.4 do PRD (sem preço nem custo: a renda não usa reais, tarefa 0040)
CROPS = [
    _crop("pousio", "pousio", None, (0, 0, 0)),
    _crop("milho_safrinha", "grao", "02-28", (20, 0, 0)),
    _crop("sorgo", "grao", "03-20", (20, 0, 15)),
    _crop("milho_braquiaria", "consorcio", "02-28", (40, 0, 10)),
    # Milheto sem tradução dos passos: em inglês cai no português.
    _crop("milheto", "cobertura", "03-15", (35, 0, 20), steps_en=()),
    _crop("crotalaria", "cobertura", "02-28", (25, 30, 30), n_kg=80),
]


class FakeCropParamsRepository:
    def list_all(self) -> list[CropParams]:
        return list(CROPS)

    def get_by_id(self, crop_id: str) -> CropParams | None:
        return next((c for c in CROPS if c.id == crop_id), None)


def _season(year: int, dry_feb_to_jun: bool) -> ClimateSeason:
    start = date(year, 1, 1)
    rain = tuple(
        0.0 if dry_feb_to_jun and 2 <= (start + timedelta(days=i)).month <= 6 else 8.0
        for i in range(DAYS)
    )
    return ClimateSeason(
        cell_id=CELL_ID,
        year=year,
        start_date=start,
        lat=-18.95,
        rain_mm=rain,
        rain_source="nasa_power",
        tmax_c=tuple([30.0] * DAYS),
        tmin_c=tuple([18.0] * DAYS),
        eto_mm=tuple([4.0] * DAYS),
    )


class FakeClimateRepository:
    """20 anos (2005-2024); `dry_years` ficam sem chuva de fevereiro a junho."""

    def __init__(
        self,
        dry_years: tuple[int, ...] = (),
        deltas: list[Cmip6Delta] | None = None,
        inside: bool = True,
        years: tuple[int, ...] = tuple(range(2005, 2025)),
    ) -> None:
        self._dry_years = dry_years
        self._deltas = deltas or []
        self._inside = inside
        self._years = years

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        return CELL_ID if self._inside else None

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return [_season(y, y in self._dry_years) for y in self._years]

    def get_cmip6_deltas(self, cell_id: str) -> list[Cmip6Delta]:
        return list(self._deltas)


class FakeSoilRepository:
    def get_soil(self, lat: float, lon: float) -> SoloInfo:
        return SoloInfo(
            argila_percentual=42.5,
            areia_percentual=38.0,
            textura_solo="argiloso",
            cad_capacidade_agua_mm=60.0,
            fonte="soilgrids",
        )


class FakeIngestionService:
    def __init__(self, cell_id: str | None = CELL_ID) -> None:
        self.cell_id = cell_id
        self.calls: list[tuple[float, float]] = []

    def ingest_area(self, lat: float, lon: float) -> str | None:
        self.calls.append((lat, lon))
        return self.cell_id


class FakeNdviRepository:
    """Série de NDVI de teste: a soja (pico em 17/jan, colhida em 6/mar) e 3 observações boas por
    entressafra, com o maior valor em maio. Nos anos de `no_soy`, o verão não passa de 0,30.
    """

    def __init__(self, peaks: dict[int, float], no_soy: frozenset[int] = frozenset()) -> None:
        self._peaks = peaks
        self._no_soy = no_soy

    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        return [
            NdviRecord(data=date(year, month, day), ndvi=ndvi, qualidade=0, produto="MOD13Q1")
            for year, peak in self._peaks.items()
            for month, day, ndvi in (
                (1, 17, 0.30 if year in self._no_soy else 0.85),
                (3, 6, 0.30),
                (4, 7, 0.22),
                (5, 9, peak),
                (6, 10, 0.22),
            )
        ]


# 2017 a 2026: 3 parado, 5 plantou, 2021 incerto e 2019 sem dado -> 3 de 8 anos certos parados
PEAKS = {
    2017: 0.30,
    2018: 0.71,
    2020: 0.71,
    2021: 0.52,
    2022: 0.71,
    2023: 0.30,
    2024: 0.71,
    2025: 0.30,
    2026: 0.71,
}


class FakeSmapRepository:
    """Umidade de teste (não do SMAP) da célula, em alguns dias."""

    def __init__(self, wetness_by_day: dict[date, float]) -> None:
        self._wetness_by_day = wetness_by_day
        self.calls: list[str] = []

    def get_cell_smap_series(self, cell_id: str) -> list[SmapSoilMoisture]:
        self.calls.append(cell_id)
        return [
            SmapSoilMoisture(day, -18.95, -48.15, 0.3, wetness, "teste")
            for day, wetness in sorted(self._wetness_by_day.items())
        ]


def _service(
    climate: FakeClimateRepository | None = None,
    rules: Regras | None = None,
    ingestion: FakeIngestionService | None = None,
    sinal: SinalOutonoService | None = None,
    ndvi: FakeNdviRepository | None = None,
    year_detail: YearDetailService | None = None,
    smap: FakeSmapRepository | None = None,
) -> RecommendationService:
    return RecommendationService(
        crop_repo=FakeCropParamsRepository(),
        climate_repo=climate or FakeClimateRepository(),
        soil_repo=FakeSoilRepository(),
        risk_service=ClimateRiskService(WaterBalanceCalculator()),
        plan_service=RotationPlanService(),
        rules=rules,
        ingestion_service=ingestion,
        sinal_service=sinal,
        ndvi_repo=ndvi,
        year_detail_service=year_detail,
        smap_repo=smap,
    )


class FakeForecastOnly:
    """Previsão de teste do ENSO (70% de El Niño em FMA de 2027) e anos de El Niño; sem SMAP.

    Valores de teste (não são da NOAA).
    """

    def get_enso_forecast(self) -> EnsoForecast | None:
        season = EnsoSeasonForecast("FMA", 2027, la_nina=10, neutro=20, el_nino=70)
        return EnsoForecast(
            emitida_em=date(2026, 11, 14), fonte="Fonte de teste", estacoes=(season,)
        )

    def get_oni_years(self) -> list[OniYear]:
        el_nino = range(2005, 2025, 3)
        return [OniYear(y, 1.0 if y in el_nino else 0.0, "el_nino" if y in el_nino else None)
                for y in range(2005, 2025)]  # fmt: skip

    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None:
        return None


def _opcao(rec: Recomendacao, crop_id: str) -> ResultadoOpcao:
    return next(o for o in rec.opcoes if o.id == crop_id)


def test_should_keep_five_crops_and_never_rank_pousio_when_harvest_is_meio() -> None:
    # PRD §11: pousio nunca é a "melhor opção" nem alternativa
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert rec.semeadura == date(2027, 2, 18)
    assert rec.celula_id == CELL_ID
    assert {o.id for o in rec.opcoes} == {
        "milho_safrinha",
        "sorgo",
        "milho_braquiaria",
        "milheto",
        "crotalaria",
    }
    assert rec.melhor != "pousio"
    assert all(a.opcao not in ("pousio", rec.melhor) for a in rec.alternativas)


def test_should_move_early_deadline_crops_to_fora_da_janela_when_harvest_is_tarde() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="tarde")

    assert rec.semeadura == date(2027, 3, 3)
    assert {o.id for o in rec.opcoes} == {"sorgo", "milheto"}
    assert {o.id for o in rec.fora_da_janela} == {
        "milho_safrinha",
        "milho_braquiaria",
        "crotalaria",
    }


def test_should_explain_each_crop_out_of_window_with_its_name_and_the_harvest_in_words() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="tarde")

    textos = {o.id: o.texto for o in rec.fora_da_janela}
    nomes = {o.id: o.nome for o in rec.fora_da_janela}
    assert textos["milho_safrinha"] == (
        f"{nomes['milho_safrinha']}: o plantio vai só até 28/02 (ZARC), e com a colheita no fim de "
        "fevereiro ou em março não dá tempo."
    )
    assert len(set(textos.values())) == len(textos)  # uma frase por cultura, sem repetir
    assert all("'tarde'" not in t for t in textos.values())


def test_should_explain_out_of_window_crops_in_english() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="tarde", lang="en")

    texto = next(o.texto for o in rec.fora_da_janela if o.id == "milho_safrinha")
    assert texto.endswith(
        ": sowing only until Feb 28 (ZARC); with the soybean harvest in late February or March, "
        "there is no time."
    )
    assert "'tarde'" not in texto


def test_should_raise_outside_area_instead_of_using_other_region_data() -> None:
    service = _service(FakeClimateRepository(inside=False))

    with pytest.raises(OutsideAreaError):
        service.recommend(lat=-23.55, lon=-46.63, colheita="meio")


def test_should_fetch_new_point_on_demand_instead_of_outside_area_when_ingestion_is_on() -> None:
    # R1.1: com o PostGIS ligado, /recomendacao de um ponto novo não depende do /talhao antes.
    ingestion = FakeIngestionService()
    service = _service(FakeClimateRepository(inside=False), ingestion=ingestion)

    rec = service.recommend(lat=-17.78, lon=-50.92, colheita="meio")

    assert ingestion.calls == [(-17.78, -50.92)]
    assert rec.celula_id == CELL_ID
    assert len(rec.opcoes) == 5


def test_should_not_fetch_on_demand_when_point_already_has_data() -> None:
    ingestion = FakeIngestionService()

    _service(ingestion=ingestion).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert ingestion.calls == []


def test_should_raise_outside_area_when_on_demand_fetch_finds_no_climate() -> None:
    ingestion = FakeIngestionService(cell_id=None)
    service = _service(FakeClimateRepository(inside=False), ingestion=ingestion)

    with pytest.raises(OutsideAreaError):
        service.recommend(lat=-17.78, lon=-50.92, colheita="meio")


def test_should_reject_unknown_harvest_band() -> None:
    with pytest.raises(ValidationDomainError):
        _service().recommend(lat=-18.95, lon=-48.20, colheita="ontem")


def test_should_score_soil_with_prd_table_when_nematoide_not_informed() -> None:
    # PRD 7.4: crotalária 85, milheto 55, milho + braquiária 50, sorgo 35, milho 20
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert _opcao(rec, "crotalaria").notas.solo == 85.0
    assert _opcao(rec, "milheto").notas.solo == 55.0
    assert _opcao(rec, "milho_braquiaria").notas.solo == 50.0
    assert _opcao(rec, "sorgo").notas.solo == 35.0
    assert _opcao(rec, "milho_safrinha").notas.solo == 20.0
    assert _opcao(rec, "crotalaria").rotulo_terra == "bom"
    assert _opcao(rec, "sorgo").rotulo_terra == "medio"
    assert _opcao(rec, "milho_safrinha").rotulo_terra == "medio"


def test_should_weight_pests_one_and_half_times_when_nematoide_is_true() -> None:
    # PRD 7.4: pragas x 1,5 e total reescalado para 0 a 100 (máximo 40 + 30 + 45 = 115)
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", nematoide=True)

    assert _opcao(rec, "crotalaria").notas.solo == pytest.approx(round(100 * 100 / 115, 1))
    assert _opcao(rec, "milho_safrinha").notas.solo == pytest.approx(round(100 * 20 / 115, 1))


def test_should_rescale_soil_by_theoretical_maximum_when_nematoide_is_true() -> None:
    # Padrão a revisar com a agrônoma (R4.3, roteiro §5 "Reescala do nematoide"): com pragas x 1,5,
    # a nota volta a 0-100 dividindo pelo máximo teórico (40 + 30 + 30 x 1,5 = 115). Só a cultura
    # com todos os pontos no máximo chega a 100.
    regras = load_default_rules().solo
    topo = _crop("topo", "cobertura", None, (40, 30, 30))

    assert soil_score(topo, True, regras) == 100.0
    assert soil_score(topo, None, regras) == 100.0


# --- renda sem preço nem custo (tarefa 0040, seção 1 da remodelagem) --------------------------

FOUR_DRY_YEARS = (2006, 2009, 2012, 2015)


def test_should_score_income_of_grain_with_its_own_climate_safety() -> None:
    # Grão e consórcio: nota de renda = segurança climática da própria opção (anos bons / total).
    # Cobertura não dá grão: nota fixa do regras.yaml (renda.nota_sem_grao = 0).
    rec = _service(FakeClimateRepository(dry_years=FOUR_DRY_YEARS)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")
    braquiaria = _opcao(rec, "milho_braquiaria")

    assert milho.notas.seguranca == 80.0
    assert milho.notas.renda == 80.0
    assert braquiaria.notas.renda == braquiaria.notas.seguranca
    assert _opcao(rec, "sorgo").notas.renda == _opcao(rec, "sorgo").notas.seguranca
    assert _opcao(rec, "crotalaria").notas.renda == 0.0
    assert _opcao(rec, "milheto").notas.renda == 0.0
    assert milho.rotulo_renda == "bom"  # 80 >= 70 (rotulos.renda_bom)
    assert _opcao(rec, "crotalaria").rotulo_renda == "fraco"


def test_should_state_income_facts_without_any_money_value() -> None:
    rec = _service(FakeClimateRepository(dry_years=FOUR_DRY_YEARS)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")
    crotalaria = _opcao(rec, "crotalaria")

    assert (milho.da_grao, _opcao(rec, "milho_braquiaria").da_grao) == (True, True)
    assert crotalaria.da_grao is False
    assert milho.texto_renda == "Dá grão para vender"
    assert crotalaria.texto_renda == "Não dá grão: é investimento na terra"
    # O N vem do motor (anos com aperto) e o total, da série
    assert milho.texto_risco == (
        "Risco de perder a lavoura: faltou água ou fez calor em 4 de 20 anos."
    )
    textos = [rec.texto_pousio] + [
        texto
        for o in rec.opcoes
        for texto in (o.texto_chuva, o.texto_renda, o.texto_risco, o.texto_terra, *o.porque)
    ]
    assert not any("R$" in texto for texto in textos)


def test_should_state_income_facts_in_english() -> None:
    rec = _service(FakeClimateRepository(dry_years=FOUR_DRY_YEARS)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio", lang="en"
    )

    assert _opcao(rec, "sorgo").texto_renda == "Gives grain to sell"
    assert _opcao(rec, "milheto").texto_renda == "No grain: it is an investment in the soil"
    assert _opcao(rec, "milho_safrinha").texto_risco == (
        "Risk of losing the crop: water ran short or it was too hot in 4 of 20 years."
    )


def test_should_take_grain_types_and_no_grain_score_from_injected_rules() -> None:
    # Com só "grao" dando grão e nota 10 sem grão, o consórcio vira "sem grão" e a cobertura vale 10
    base = load_default_rules()
    renda = replace(base.renda, tipos_com_grao=frozenset({"grao"}), nota_sem_grao=10.0)

    rec = _service(rules=replace(base, renda=renda)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    braquiaria = _opcao(rec, "milho_braquiaria")

    assert (braquiaria.da_grao, braquiaria.notas.renda) == (False, 10.0)
    assert braquiaria.texto_renda == "Não dá grão: é investimento na terra"
    assert _opcao(rec, "crotalaria").notas.renda == 10.0
    assert _opcao(rec, "milho_safrinha").notas.renda == 100.0


@pytest.mark.parametrize(
    ("n_dry", "anos_bons", "rotulo"),
    [(3, 17, "bom"), (4, 16, "medio"), (9, 11, "fraco")],
)
def test_should_label_rain_axis_by_good_years_when_dry_years_vary(
    n_dry: int, anos_bons: int, rotulo: str
) -> None:
    # PRD §11: 17, 16 e 11 anos sem aperto -> Bom, Médio e Fraco
    dry_years = tuple(range(2005, 2005 + n_dry))
    rec = _service(FakeClimateRepository(dry_years=dry_years)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")

    assert milho.anos_bons_chuva == anos_bons
    assert milho.total_anos == 20
    assert milho.rotulo_chuva == rotulo
    assert milho.texto_chuva == f"Deu certo em {anos_bons} de 20 anos"


def test_should_count_only_the_years_with_data_when_some_years_were_dropped() -> None:
    # Tarefa 0005: anos descartados por dia sem dado no POWER não entram no "de N anos"
    years = tuple(y for y in range(2005, 2025) if y not in (2010, 2015, 2020))
    rec = _service(FakeClimateRepository(years=years)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")

    assert milho.total_anos == 17
    assert milho.texto_chuva == "Deu certo em 17 de 17 anos"


def test_should_cite_same_number_as_the_math_when_explaining_stress_years() -> None:
    # PRD §11: resultado com 6 anos de aperto -> a frase cita "6 dos últimos 20 anos"
    dry_years = (2006, 2009, 2012, 2015, 2018, 2021)
    rec = _service(FakeClimateRepository(dry_years=dry_years)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")

    assert milho.faixa_anos == tuple(year not in dry_years for year in range(2005, 2025))
    assert any("6 dos últimos 20 anos" in frase for frase in milho.porque)


def test_should_detail_each_year_of_the_rain_strip_with_the_same_result() -> None:
    # P1: a faixa sai de anos_detalhe[].bom; um item por ano simulado, na mesma ordem
    years = tuple(y for y in range(2005, 2025) if y != 2010)
    climate = FakeClimateRepository(dry_years=(2007, 2014), years=years)
    rec = _service(climate).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    for opcao in rec.opcoes:
        assert [d.ano for d in opcao.anos_detalhe] == list(years)
        assert tuple(d.bom for d in opcao.anos_detalhe) == opcao.faixa_anos
    milho = _opcao(rec, "milho_safrinha")
    seca = next(d for d in milho.anos_detalhe if d.ano == 2007)
    # Floração no dia 60 (18/fev + 60 = 19/abr); de fevereiro a junho sem chuva: os 30 dias da fase
    assert (seca.bom, seca.fase_critica, seca.dias_sem_chuva) == (False, date(2007, 4, 19), 30)
    assert seca.texto.endswith("ficou 30 dias sem chuva. Faltou água nessa fase.")
    # Sem o arquivo do ONI, nenhum ano tem marca
    assert {d.enso for d in milho.anos_detalhe} == {None}


class FakeEnsoRepository:
    def get_oni_years(self) -> list[OniYear]:
        return [OniYear(2007, 0.23, None), OniYear(2016, 2.13, "el_nino")]


def test_should_mark_enso_and_write_the_year_detail_in_the_requested_language() -> None:
    service = _service(year_detail=YearDetailService(enso_repo=FakeEnsoRepository()))

    rec = service.recommend(lat=-18.95, lon=-48.20, colheita="meio", lang="en")
    detalhe = next(d for d in _opcao(rec, "sorgo").anos_detalhe if d.ano == 2016)

    assert detalhe.enso == "el_nino"
    assert detalhe.texto == (
        "In 2016, sowing on February 18, the crop reached the stage that needs water most around "
        "April 18 and did not go a single day without rain. It worked. El Niño year."
    )


def test_should_leave_future_empty_and_reweight_final_score_when_no_cmip6_data() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")
    milho = _opcao(rec, "milho_safrinha")
    notas = milho.notas

    assert milho.futuro is None
    assert notas.futuro is None
    assert not any("2041" in frase for frase in milho.porque)
    expected = (0.30 * notas.seguranca + 0.25 * notas.solo + 0.30 * notas.renda) / 0.85
    assert notas.final == pytest.approx(round(expected, 1))


def test_should_include_future_range_and_weight_when_cmip6_deltas_exist() -> None:
    deltas = [
        Cmip6Delta(model=model, scenario="ssp245", month=m, rain_pct=pct, tmax_c=0.0)
        for model, pct in (("IGUAL", 0.0), ("SECO", -100.0))
        for m in range(1, 13)
    ]
    rec = _service(FakeClimateRepository(deltas=deltas)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")
    notas = milho.notas

    assert milho.futuro is not None
    assert (milho.futuro.anos_bons_min, milho.futuro.anos_bons_max) == (0, 20)
    assert notas.futuro == 50.0
    expected = 0.30 * notas.seguranca + 0.25 * notas.solo + 0.30 * notas.renda + 0.15 * 50.0
    assert notas.final == pytest.approx(round(expected, 1))
    assert any("2041" in frase for frase in milho.porque)


def test_should_score_dry_scenario_only_with_the_four_driest_years() -> None:
    dry_years = (2007, 2010, 2012, 2014)
    rec = _service(FakeClimateRepository(dry_years=dry_years)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )
    milho = _opcao(rec, "milho_safrinha")

    assert milho.notas.seguranca == 80.0
    assert milho.notas_seco.seguranca == 0.0
    # Tarefa 0040: no ano seco, a renda do grão também é a segurança dos 4 anos mais secos
    assert (milho.notas.renda, milho.notas_seco.renda) == (80.0, 0.0)
    assert "2007, 2010, 2012, 2014" in rec.plano_seco.descricao


def test_should_score_fallow_in_the_plan_with_safety_100_and_no_soil_or_income() -> None:
    # PRD 7.2 e 7.6: o pousio tem segurança 100, solo 0 e renda 0. Sem CMIP6, os pesos são
    # reescalados: 30 / 0,85 = 35,3. Colheita tarde: o milho sai da janela e o "hoje" é o pousio.
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="tarde")

    assert rec.plano_hoje.anos == ("pousio", "pousio", "pousio")
    assert rec.plano_hoje.nota == pytest.approx(round(0.30 * 100 / 0.85, 1))


def test_should_give_fallow_future_100_when_cmip6_deltas_exist() -> None:
    # PRD 7.6: o pousio tem segurança e futuro 100 -> 0,30 x 100 + 0,15 x 100 = 45
    deltas = [
        Cmip6Delta(model="IGUAL", scenario="ssp245", month=m, rain_pct=0.0, tmax_c=0.0)
        for m in range(1, 13)
    ]
    rec = _service(FakeClimateRepository(deltas=deltas)).recommend(
        lat=-18.95, lon=-48.20, colheita="tarde"
    )

    assert rec.plano_hoje.anos == ("pousio", "pousio", "pousio")
    assert rec.plano_hoje.nota == 45.0


def test_should_score_fallow_income_in_the_plan_with_the_no_grain_score_from_rules() -> None:
    # O pousio não dá grão: a renda dele no plano é a mesma nota fixa da cobertura (tarefa 0040).
    # Sem CMIP6: (0,30 x 100 + 0,30 x 10) / 0,85 = 38,8.
    base = load_default_rules()
    rules = replace(base, renda=replace(base.renda, nota_sem_grao=10.0))

    rec = _service(rules=rules).recommend(lat=-18.95, lon=-48.20, colheita="tarde")

    assert rec.plano_hoje.anos == ("pousio", "pousio", "pousio")
    assert rec.plano_hoje.nota == pytest.approx(round((0.30 * 100 + 0.30 * 10) / 0.85, 1))


def test_should_leave_autumn_signal_empty_without_signal_data() -> None:
    # Não inventa previsão: sem o service (ou sem dado), `sinal` fica nulo.
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert rec.sinal is None


def test_should_add_autumn_signal_with_plan_a_and_plan_b_of_the_recommendation() -> None:
    # PRD 7.10: o Plano A é o melhor plano do ano normal e o Plano B, o do ano seco. Tarefa 0038:
    # o sinal usa o histórico das opções (anos_detalhe) e a série de chuva da célula do motor.
    data = FakeForecastOnly()
    sinal_service = SinalOutonoService(data, data, data, today=lambda: date(2026, 11, 15))

    rec = _service(sinal=sinal_service).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert rec.sinal is not None
    assert rec.sinal.nivel == "normal"  # nenhum ano com aperto na série de teste
    assert rec.sinal.fonte == ("Fonte de teste", "NASA POWER")


class SpySinalService(SinalOutonoService):
    """Guarda o que o motor pede ao sinal (sem previsão: devolve None)."""

    def __init__(self) -> None:
        data = FakeForecastOnly()
        super().__init__(data, data, data, today=lambda: date(2026, 11, 15))
        self.calls: list[dict[str, object]] = []

    def evaluate(self, **kwargs: object) -> None:  # type: ignore[override]
        self.calls.append(kwargs)
        return None


def test_should_give_the_signal_the_plan_a_and_the_plan_b_shown_on_the_plan_screen() -> None:
    # S9 (tarefa 0049): o Plano B do sinal é o da tela do Plano (PlanBService: a cultura que mais
    # deu certo quando a do Plano A falhou), para o sinal e a tela falarem do mesmo Plano B.
    climate = FakeClimateRepository(dry_years=(2007, 2014))
    spy = SpySinalService()

    rec = _service(climate, sinal=spy).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    ab = PlanBService().plan_ab(
        rec.plano_normal.anos[0], list(rec.opcoes), climate.get_seasons(CELL_ID), rec.semeadura
    )
    assert ab is not None
    (call,) = spy.calls
    assert call["cultura_a"] == rec.plano_normal.anos[0] == rec.melhor
    assert call["cultura_b"] == ab.cultura_b


def test_should_say_only_the_suppressor_crops_of_prd_7_7_break_the_nematode_cycle() -> None:
    # S9 (tarefa 0049): a linha Terra dizia "ajuda a quebrar o ciclo" para sorgo e milho com
    # braquiária (pontos de pragas > 0), e os fatos do Plano contam só crotalária e milheto
    # (PRD 7.7).
    # Uma regra só: as supressoras do regras.yaml (rotacao.culturas_supressoras_nematoide).
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")
    en = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", lang="en")

    for crop_id in ("crotalaria", "milheto"):
        assert _opcao(rec, crop_id).texto_terra.endswith("; quebra o ciclo do nematoide.")
        assert _opcao(en, crop_id).texto_terra.endswith("; breaks the nematode cycle.")
    for crop_id in ("sorgo", "milho_braquiaria", "milho_safrinha"):
        assert _opcao(rec, crop_id).texto_terra.endswith("; não quebra o ciclo do nematoide.")
        assert _opcao(en, crop_id).texto_terra.endswith("; does not break the nematode cycle.")


def test_should_write_texts_in_english_when_language_is_en() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", lang="en-US,en;q=0.9")
    milho = _opcao(rec, "milho_safrinha")

    assert milho.nome == "milho_safrinha (en)"
    assert milho.texto_chuva == "Worked in 20 of 20 years"
    assert any("NASA POWER" in frase for frase in milho.porque)


class ImergRainClimateRepository(FakeClimateRepository):
    """Os anos de `imerg_years` têm a chuva do IMERG (carga da tarefa 0027); os outros, do POWER."""

    def __init__(self, imerg_years: tuple[int, ...]) -> None:
        super().__init__()
        self._imerg_years = imerg_years

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        return [
            replace(season, rain_source="gpm_imerg") if season.year in self._imerg_years else season
            for season in super().get_seasons(cell_id)
        ]


@pytest.mark.parametrize(
    "imerg_years",
    [tuple(range(2005, 2025)), (2006, 2010)],  # todos os anos, ou só alguns (2005 com o POWER)
)
def test_should_name_imerg_and_power_when_any_year_uses_imerg_rain(
    imerg_years: tuple[int, ...],
) -> None:
    service = _service(climate=ImergRainClimateRepository(imerg_years))

    for lang in ("pt-BR", "en"):
        milho = _opcao(
            service.recommend(-18.95, -48.20, colheita="meio", lang=lang), "milho_safrinha"
        )
        assert any("(GPM IMERG + NASA POWER)" in frase for frase in milho.porque)
        assert not any("(NASA POWER)" in frase for frase in milho.porque)


def test_should_name_only_nasa_power_when_no_year_uses_imerg_rain() -> None:
    milho = _opcao(_service().recommend(-18.95, -48.20, colheita="meio"), "milho_safrinha")

    assert any("(NASA POWER)" in frase for frase in milho.porque)
    assert not any("IMERG" in frase for frase in milho.porque)


def test_should_give_how_to_steps_in_the_requested_language() -> None:
    pt = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", lang="pt-BR")
    en = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", lang="en-US,en;q=0.9")

    assert _opcao(pt, "milho_safrinha").como_fazer == ("Passo 1",)
    assert _opcao(en, "milho_safrinha").como_fazer == ("Step 1",)
    # Sem tradução no culturas.yaml: mostra os passos em português em vez de nada.
    assert _opcao(en, "milheto").como_fazer == ("Passo 1",)


def test_should_use_soil_override_for_water_capacity() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", solo_override="arenoso")

    assert rec.solo == "arenoso"
    assert any("40 mm" in frase for frase in _opcao(rec, "milho_safrinha").porque)


def test_should_write_soil_texture_with_accent_in_portuguese_text() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio", solo_override="medio")

    assert any("solo médio" in frase for frase in _opcao(rec, "sorgo").porque)


def test_should_weight_final_score_with_injected_rules() -> None:
    # regras.yaml com peso só no solo: a nota final passa a ser a nota de solo
    base = load_default_rules()
    nota_final = replace(
        base.nota_final, peso_seguranca=0.0, peso_solo=1.0, peso_renda=0.0, peso_futuro=0.0
    )
    rec = _service(rules=replace(base, nota_final=nota_final)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )

    assert rec.melhor == "crotalaria"
    assert all(o.notas.final == o.notas.solo for o in rec.opcoes)


def test_should_label_income_with_thresholds_from_injected_rules() -> None:
    base = load_default_rules()
    rotulos = replace(base.rotulos, renda_bom=101.0)
    rec = _service(rules=replace(base, rotulos=rotulos)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )

    assert _opcao(rec, "milho_safrinha").notas.renda == 100.0
    assert _opcao(rec, "milho_safrinha").rotulo_renda == "medio"


def test_should_write_why_with_phrase_template_and_heat_number_from_injected_rules() -> None:
    # Plano técnico §4.8: a frase vem do modelo do regras.yaml e cita o mesmo número da conta
    base = load_default_rules()
    frases = {
        **base.frases,
        "pt": replace(base.frases["pt"], seguranca="{anos_aperto}/{total} {calor_c} °C"),
    }
    rules = replace(base, clima=replace(base.clima, calor_temp_c=33.0), frases=frases)

    rec = _service(rules=rules).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert _opcao(rec, "milho_safrinha").porque[0] == "0/20 33 °C"


def test_should_explain_the_field_history_in_every_option_when_ndvi_exists() -> None:
    # PRD 7.6: frase do histórico do talhão, contando só os anos que o satélite viu com certeza
    rec = _service(ndvi=FakeNdviRepository(PEAKS)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )

    assert {o.porque[-1] for o in rec.opcoes} == {
        "Seu talhão ficou em pousio em 3 de 8 entressafras vistas pelo satélite "
        "de 2017 a 2026 (NDVI do MODIS)."
    }


def test_should_explain_the_field_history_in_english() -> None:
    rec = _service(ndvi=FakeNdviRepository(PEAKS)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio", lang="en"
    )

    assert _opcao(rec, "milho_safrinha").porque[-1] == (
        "Your field was left fallow in 3 of 8 off-seasons seen by the satellite "
        "from 2017 to 2026 (MODIS NDVI)."
    )


@pytest.mark.parametrize(
    "ndvi",
    [
        None,
        FakeNdviRepository({}),
        FakeNdviRepository({2017: 0.52, 2018: 0.50}),
        FakeNdviRepository(PEAKS, no_soy=frozenset(PEAKS)),
    ],
    ids=["sem-repositorio", "sem-serie", "sem-ano-certo", "sem-soja"],
)
def test_should_not_explain_history_without_a_year_seen_with_certainty(
    ndvi: FakeNdviRepository | None,
) -> None:
    # Sem NDVI do ponto, ou só com anos incertos e sem dado: nada de frase inventada
    rec = _service(ndvi=ndvi).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert not any("NDVI" in frase for o in rec.opcoes for frase in o.porque)


def test_should_not_count_years_without_soybean_in_the_history_phrase() -> None:
    # 2017 e 2023 (parados) sem soja no verão: saem da conta -> 1 de 6 anos certos parados
    rec = _service(ndvi=FakeNdviRepository(PEAKS, no_soy=frozenset({2017, 2023}))).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )

    assert _opcao(rec, "sorgo").porque[-1] == (
        "Seu talhão ficou em pousio em 1 de 6 entressafras vistas pelo satélite "
        "de 2017 a 2026 (NDVI do MODIS)."
    )


def test_should_use_the_producer_confirmations_in_the_history_phrase() -> None:
    # Tarefa 0039: 2024 (satélite: plantou) e 2025 (satélite: parado) confirmados como parado e
    # plantou, 2026 (satélite: plantou) confirmado como parado. Fica parado em 4 de 8 anos certos:
    # 3 do produtor e 5 do satélite.
    rec = _service(ndvi=FakeNdviRepository(PEAKS)).recommend(
        lat=-18.95,
        lon=-48.20,
        colheita="meio",
        confirmadas=[(2024, "parado"), (2025, "plantou"), (2026, "parado")],
    )

    assert _opcao(rec, "sorgo").porque[-1] == (
        "Seu talhão ficou em pousio em 4 de 8 entressafras de 2017 a 2026 "
        "(você confirmou 3; o satélite viu 5, pelo NDVI do MODIS)."
    )


def test_should_explain_the_history_from_the_confirmations_alone_without_ndvi() -> None:
    rec = _service(ndvi=FakeNdviRepository({})).recommend(
        lat=-18.95, lon=-48.20, colheita="meio", lang="en", confirmadas=[(2025, "parado")]
    )

    assert _opcao(rec, "sorgo").porque[-1] == (
        "Your field was left fallow in 1 of 1 off-seasons from 2017 to 2026 "
        "(you confirmed 1; the satellite saw 0, with MODIS NDVI)."
    )


def test_should_refuse_confirmations_outside_the_last_three_off_seasons() -> None:
    with pytest.raises(ValidationDomainError, match="2019"):
        _service().recommend(
            lat=-18.95, lon=-48.20, colheita="meio", confirmadas=[(2019, "plantou")]
        )


def test_should_write_history_with_phrase_template_from_injected_rules() -> None:
    base = load_default_rules()
    modelo = "{parado}/{anos_certos} ({sem_certeza} sem certeza de {total}; {ano_inicio}-{ano_fim})"
    frases = {**base.frases, "pt": replace(base.frases["pt"], historico=modelo)}
    historico_ndvi = replace(base.historico_ndvi, ano_inicio=2018)

    rec = _service(
        rules=replace(base, frases=frases, historico_ndvi=historico_ndvi),
        ndvi=FakeNdviRepository(PEAKS),
    ).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert _opcao(rec, "sorgo").porque[-1] == "2/7 (2 sem certeza de 9; 2018-2026)"


def _option(
    crop_id: str, seguranca: float, renda: float, solo: float, final: float
) -> ResultadoOpcao:
    notas = NotasOpcao(seguranca=seguranca, futuro=None, solo=solo, renda=renda, final=final)
    return ResultadoOpcao(
        id=crop_id,
        nome=crop_id,
        na_janela=True,
        data_limite=None,
        anos_bons_chuva=0,
        total_anos=20,
        faixa_anos=(),
        rotulo_chuva="medio",
        texto_chuva="",
        futuro=None,
        da_grao=renda > 0,
        rotulo_renda="medio",
        texto_renda="",
        texto_risco="",
        rotulo_terra="medio",
        texto_terra="",
        notas=notas,
        notas_seco=notas,
        porque=(),
        como_fazer=(),
    )


def test_should_offer_more_income_when_an_option_gives_grain_and_the_best_does_not() -> None:
    # Tarefa 0040: o eixo da renda chama `mais_renda` (antes `mais_dinheiro`)
    opcoes = [
        _option("crotalaria", seguranca=95.0, renda=0.0, solo=85.0, final=64.0),
        _option("milho_braquiaria", seguranca=80.0, renda=80.0, solo=50.0, final=60.0),
    ]

    assert build_alternatives(opcoes, "crotalaria") == (
        Alternativa(motivo="mais_renda", opcao="milho_braquiaria"),
    )


def test_should_offer_alternative_only_when_better_than_best_on_its_axis() -> None:
    # Caso real (colheita meio): o milho já tem a maior renda, então não há "mais renda";
    # antes saía o sorgo, com renda 18 contra 100. A crotalária não se repete em dois eixos:
    # empata com o milheto na segurança (95) e é a única maior na terra (85), então fica na terra.
    opcoes = [
        _option("milho_safrinha", seguranca=65.0, renda=100.0, solo=20.0, final=64.1),
        _option("crotalaria", seguranca=95.0, renda=0.0, solo=85.0, final=58.5),
        _option("milheto", seguranca=95.0, renda=0.0, solo=55.0, final=49.7),
        _option("sorgo", seguranca=65.0, renda=18.0, solo=35.0, final=39.6),
    ]

    assert build_alternatives(opcoes, "milho_safrinha") == (
        Alternativa(motivo="menos_risco", opcao="milheto"),
        Alternativa(motivo="cuidar_da_terra", opcao="crotalaria"),
    )


def test_should_break_axis_tie_by_final_score_and_skip_ties_with_the_best() -> None:
    opcoes = [
        _option("milho_safrinha", seguranca=80.0, renda=100.0, solo=20.0, final=70.0),
        _option("milheto", seguranca=95.0, renda=0.0, solo=20.0, final=49.7),
        _option("crotalaria", seguranca=95.0, renda=0.0, solo=20.0, final=58.5),
        _option("sorgo", seguranca=80.0, renda=50.0, solo=20.0, final=45.0),
    ]

    # Empate em 95 na segurança: fica a de maior nota final. Solo empatado com a melhor (20): o eixo
    # some, porque empatar não é ser melhor.
    assert build_alternatives(opcoes, "milho_safrinha") == (
        Alternativa(motivo="menos_risco", opcao="crotalaria"),
    )


def test_should_drop_axis_when_its_only_better_option_was_used_by_another_axis() -> None:
    opcoes = [
        _option("milho_safrinha", seguranca=60.0, renda=100.0, solo=20.0, final=65.0),
        _option("crotalaria", seguranca=90.0, renda=0.0, solo=85.0, final=58.0),
    ]

    assert build_alternatives(opcoes, "milho_safrinha") == (
        Alternativa(motivo="menos_risco", opcao="crotalaria"),
    )


def test_should_return_no_alternatives_when_best_wins_every_axis() -> None:
    opcoes = [
        _option("milheto", seguranca=100.0, renda=0.0, solo=55.0, final=51.5),
        _option("sorgo", seguranca=40.0, renda=0.0, solo=35.0, final=24.4),
    ]

    assert build_alternatives(opcoes, "milheto") == ()
    assert build_alternatives(opcoes[:1], "milheto") == ()


# --- balde inicial pelo SMAP (PRD 7.2, R3.3) ---------------------------------------------------

YEAR_2020 = list(range(2005, 2025)).index(2020)


def test_should_start_each_year_with_the_smap_of_its_sowing_day() -> None:
    # 2020 sem chuva: com 50% da CAD a cobertura pega; com a terra seca do SMAP, não.
    climate = FakeClimateRepository(dry_years=(2020,))
    smap = FakeSmapRepository({date(2020, 2, 18): 0.05})

    sem = _opcao(_service(climate).recommend(lat=-18.95, lon=-48.20, colheita="meio"), "milheto")
    com = _opcao(
        _service(climate, smap=smap).recommend(lat=-18.95, lon=-48.20, colheita="meio"), "milheto"
    )

    assert sem.faixa_anos[YEAR_2020] is True
    assert com.faixa_anos[YEAR_2020] is False
    assert com.anos_bons_chuva == sem.anos_bons_chuva - 1
    assert smap.calls == [CELL_ID]


def test_should_ignore_smap_of_a_day_that_is_not_the_sowing_day() -> None:
    climate = FakeClimateRepository(dry_years=(2020,))
    smap = FakeSmapRepository({date(2020, 2, 8): 0.05})  # dia da faixa "cedo"

    sem = _service(climate).recommend(lat=-18.95, lon=-48.20, colheita="meio")
    com = _service(climate, smap=smap).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert [o.faixa_anos for o in com.opcoes] == [o.faixa_anos for o in sem.opcoes]
    assert all(len(o.porque) == len(s.porque) for o, s in zip(com.opcoes, sem.opcoes, strict=True))


SMAP_EVERY_YEAR = {date(year, 2, 18): 0.6 for year in range(2016, 2026)}


def test_should_explain_in_which_years_the_bucket_started_from_smap() -> None:
    rec = _service(smap=FakeSmapRepository(SMAP_EVERY_YEAR)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )

    frase = (
        "O balde de água começou com a umidade da terra medida pelo SMAP no dia de plantar em 9 "
        "dos 20 anos (2016 a 2024); nos outros, com 50% da água disponível."
    )
    assert all(o.porque[1] == frase for o in rec.opcoes)


def test_should_explain_the_smap_bucket_in_english() -> None:
    rec = _service(smap=FakeSmapRepository(SMAP_EVERY_YEAR)).recommend(
        lat=-18.95, lon=-48.20, colheita="meio", lang="en"
    )

    assert rec.opcoes[0].porque[1] == (
        "The water bucket started from the soil moisture measured by SMAP on sowing day in 9 of "
        "the 20 years (2016 to 2024); in the other years, at 50% of the available water."
    )


def test_should_not_explain_smap_when_no_year_has_it_on_the_sowing_day() -> None:
    smap = FakeSmapRepository({date(2020, 2, 8): 0.6})

    rec = _service(smap=smap).recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert not any("SMAP" in frase for o in rec.opcoes for frase in o.porque)


# --- aba Sugestão (tarefa 0044) -----------------------------------------------------------------

MODEL_DELTAS = [
    Cmip6Delta(model=model, scenario="ssp245", month=m, rain_pct=pct, tmax_c=tmax)
    for model, pct, tmax in (("A", -10.0, 1.0), ("B", -20.0, 2.0), ("C", 6.0, 3.0))
    for m in range(1, 13)
]


def test_should_give_each_option_its_water_line_from_the_motor_water_balance() -> None:
    # Chuva de 8 mm todo dia e ETo de 4 mm (valores de teste): a cultura de 100 dias com Kc até
    # 1,0 precisa de menos água do que chove. A mesma conta do "deu certo", nos dias do ciclo.
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")
    milho = _opcao(rec, "milho_safrinha")

    assert milho.agua is not None
    assert milho.agua.chove_mm == 800  # 8 mm x 100 dias
    assert 0 < milho.agua.precisa_mm < milho.agua.chove_mm
    assert milho.agua.falta_normal_mm == 0
    # ~4 mm x Kc médio de ~0,8 x 100 dias: entre os cortes de 280 e 325 mm do regras.yaml
    assert 280 <= milho.agua.precisa_mm < 325
    assert milho.agua.sede == "media"
    assert milho.agua.cad_mm == 60
    assert milho.agua.anos == 20
    assert milho.agua.futuro is None  # sem CMIP6


def test_should_change_the_future_shortage_with_the_cmip6_deltas_of_each_model() -> None:
    climate = FakeClimateRepository(dry_years=(2007, 2014), deltas=MODEL_DELTAS)

    rec = _service(climate).recommend(lat=-18.95, lon=-48.20, colheita="meio")
    milho = _opcao(rec, "milho_safrinha")

    assert milho.agua is not None and milho.agua.futuro is not None
    assert milho.agua.futuro.modelos == 3
    assert milho.agua.futuro.falta_min_mm <= milho.agua.futuro.falta_max_mm


def test_should_tell_the_real_criterion_and_the_crop_cycle_of_each_option() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")
    milho, milheto = _opcao(rec, "milho_safrinha"), _opcao(rec, "milheto")

    assert milho.criterio is not None and milheto.criterio is not None
    assert (milho.criterio.isna_min, milho.criterio.fase, milho.criterio.janela_dias) == (
        0.55,
        "floracao",
        15,
    )
    assert (milho.criterio.calor_temp_c, milho.criterio.calor_min_dias) == (35.0, 3)
    assert (milheto.criterio.isna_min, milheto.criterio.fase) == (0.50, "pegamento")
    assert milheto.criterio.janela_dias == 30
    assert milho.ciclo is not None
    assert (milho.ciclo.dias, milho.ciclo.floracao_dias) == (100, 60)


def test_should_give_the_isna_of_each_year_and_what_to_watch() -> None:
    climate = FakeClimateRepository(dry_years=(2007, 2014))

    rec = _service(climate).recommend(lat=-18.95, lon=-48.20, colheita="meio")
    milho = _opcao(rec, "milho_safrinha")
    seca = next(d for d in milho.anos_detalhe if d.ano == 2007)

    assert seca.isna < 0.55 and seca.falta_agua is True
    assert seca.semeadura == date(2007, 2, 18)
    assert milho.observar is not None
    assert milho.observar.total == 20
    assert milho.observar.veranico_dias == 0  # 18 anos com chuva todo dia


def test_should_rate_hits_by_enso_phase_only_with_the_oni_file() -> None:
    sem = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")
    com = _service(year_detail=YearDetailService(enso_repo=FakeEnsoRepository())).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )

    assert _opcao(sem, "sorgo").enso_acerto == ()
    [el_nino] = _opcao(com, "sorgo").enso_acerto
    assert (el_nino.fase, el_nino.anos, el_nino.anos_outros) == ("el_nino", 1, 19)
    assert el_nino.clara is False  # 1 ano só


def test_should_order_options_and_build_a_plan_for_each_producer_objective() -> None:
    # Tarefa 0044 (5.1): a reordenação é no motor, pronta para os 4 objetivos; o navegador só
    # escolhe. A ordem é a nota do eixo (desempate pela final); o plano começa pela 1ª da ordem.
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")
    notas = {o.id: o.notas for o in rec.opcoes}

    assert set(rec.objetivos) == {"equilibrio", "seguranca", "renda", "terra"}
    assert rec.objetivos["equilibrio"].ordem == tuple(o.id for o in rec.opcoes)
    terra = rec.objetivos["terra"].ordem
    assert [notas[i].solo for i in terra] == sorted((n.solo for n in notas.values()), reverse=True)
    for objetivo in rec.objetivos.values():
        assert objetivo.plano[0] == objetivo.ordem[0]
        assert len(objetivo.plano) == 3
    for chave in ("seguranca", "renda", "terra"):
        assert "pousio" not in rec.objetivos[chave].plano


def test_should_start_plan_a_with_the_best_option() -> None:
    # A sugestão é o ano 1 do Plano A (o Plano B, para ano seco, pode começar por outra).
    rec = _service(FakeClimateRepository(dry_years=(2007, 2014))).recommend(
        lat=-18.95, lon=-48.20, colheita="meio"
    )

    assert rec.plano_normal.anos[0] == rec.melhor
    assert rec.plano_normal.anos == rec.objetivos["equilibrio"].plano


class UnevenAutumnClimateRepository(FakeClimateRepository):
    """Março chove muito mais que abril e maio, e 2010 tem uma noite de 2 °C em junho.

    Valores de teste: com eles, a média simples dos meses e a média pesada pela chuva de cada mês
    dão sinais opostos (o erro da S5a, corrigido na S9).
    """

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        seasons = []
        for year in self._years:
            start = date(year, 1, 1)
            months = [(start + timedelta(days=i)).month for i in range(DAYS)]
            rain = tuple({3: 10.0, 4: 2.0, 5: 0.5}.get(m, 8.0) for m in months)
            tmin = tuple(2.0 if (year == 2010 and m == 6) else 18.0 for m in months)
            seasons.append(replace(_season(year, dry_feb_to_jun=False), rain_mm=rain, tmin_c=tmin))
        return seasons


UNEVEN_DELTAS = [
    Cmip6Delta(model=model, scenario="ssp245", month=month, rain_pct=pct, tmax_c=1.0)
    for model in ("A", "B", "C")
    for month, pct in ((3, 10.0), (4, -20.0), (5, -20.0))
]


class FakeRaioXNdvi:
    def get_ndvi_history(self, lat: float, lon: float) -> list[NdviRecord]:
        return []


class FakeNoRecentSmap:
    def get_recent_soil_moisture(self, lat: float, lon: float) -> RecentSoilMoisture | None:
        return None


def test_should_give_the_suggestion_the_same_2041_2060_climate_and_frost_as_the_x_ray() -> None:
    # S9 (tarefa 0049): a Sugestão dizia "-0,7%, 2 de 3 indicam menos chuva" e o raio-X "+2,2%,
    # 2 de 3 indicam mais chuva" na mesma célula. As duas telas usam agora a mesma conta (a do
    # raio-X, que pesa cada mês pela chuva média do mês) e o mesmo alerta de geada.
    climate = UnevenAutumnClimateRepository(deltas=UNEVEN_DELTAS)
    engine = _service(climate)
    raio_x = RaioXService(
        climate_repo=climate,
        soil_repo=FakeSoilRepository(),
        ndvi_repo=FakeRaioXNdvi(),
        crop_repo=FakeCropParamsRepository(),
        recommender=engine,
        reference_eto=lambda season: season.eto_mm,
        recent_soil_moisture_repo=FakeNoRecentSmap(),
    ).raio_x(lat=-18.95, lon=-48.20, colheita="meio")

    rec = engine.recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert rec.clima_futuro is not None
    assert rec.clima_futuro == raio_x.cartoes.clima_futuro
    assert rec.clima_futuro.chuva_pct > 0  # a média simples dos meses daria -10%
    assert (rec.clima_futuro.modelos_mais_chuva, rec.clima_futuro.modelos) == (3, 3)
    assert rec.geada is not None
    assert rec.geada == raio_x.alertas.geada
    assert rec.geada.anos == (2010,)


def test_should_leave_the_2041_2060_climate_and_frost_empty_without_data() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="meio")

    assert rec.clima_futuro is None
    assert rec.geada is None  # mínima de 18 °C todo dia: sem risco, sem alerta


def test_should_give_the_planting_deadline_of_each_crop_out_of_the_window() -> None:
    rec = _service().recommend(lat=-18.95, lon=-48.20, colheita="tarde")

    assert {f.id: f.data_limite for f in rec.fora_da_janela} == {
        "milho_safrinha": "2027-02-28",
        "milho_braquiaria": "2027-02-28",
        "crotalaria": "2027-02-28",
    }
