"""Primary agroclimatic recommendation service combining water balance, soil, and CMIP6."""

from datetime import date

from app.constants import (
    DATA_VERSION,
    EXAMPLE_CELL_ID,
    INCOME_SCORE_MAX_BRL,
    INCOME_SCORE_MIN_BRL,
    LABEL_GOOD_THRESHOLD,
    LABEL_MEDIUM_THRESHOLD,
    LIVESTOCK_INTERCROP_BONUS,
    MAX_NITROGEN_KG_REF,
    NEMATODE_BASE_OFFSET,
    NEMATODE_RANGE_SPAN,
    NITROGEN_CREDIT_BRL_PER_KG,
    PERCENT_DIVISOR,
    REFERENCE_SOWING_YEAR,
    SCORE_MAX,
    SCORE_MIN,
    SOIL_CAD_BY_TEXTURE,
    SOIL_ORGANIC_MATTER_CREDIT_PER_SCORE,
    SOWING_MONTH_DAY_BY_HARVEST,
    WEIGHT_FUTURE,
    WEIGHT_INCOME,
    WEIGHT_SAFETY,
    WEIGHT_SOIL,
)
from app.models.crop_option import CropParams
from app.models.recomendacao import (
    Alternativa,
    ForaDaJanelaOpcao,
    NotasOpcao,
    Recomendacao,
    ResultadoOpcao,
)
from app.repositories.climate_repository import ClimateRepository
from app.repositories.crop_params_repository import CropParamsRepository
from app.repositories.soil_repository import SoilRepository
from app.services.climate_risk_service import ClimateRiskService
from app.services.errors import ValidationDomainError
from app.services.rotation_plan_service import RotationPlanService


def _score_to_label(score: float) -> str:
    if score >= LABEL_GOOD_THRESHOLD:
        return "bom"
    if score >= LABEL_MEDIUM_THRESHOLD:
        return "medio"
    return "fraco"


class RecommendationService:
    """Orchestrates multi-criteria scoring, explanations, alternatives, and 3-year plans."""

    def __init__(
        self,
        crop_repo: CropParamsRepository,
        climate_repo: ClimateRepository,
        soil_repo: SoilRepository,
        risk_service: ClimateRiskService,
        plan_service: RotationPlanService,
    ) -> None:
        self._crop_repo = crop_repo
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._risk_service = risk_service
        self._plan_service = plan_service

    def recommend(
        self,
        lat: float,
        lon: float,
        colheita: str = "meio",
        solo_override: str | None = None,
        nematoide: bool | None = None,
        gado: bool | None = None,
        lang: str = "pt-BR",
    ) -> Recomendacao:
        """Computes the complete off-season crop recommendation for a field (US-03 to US-10)."""
        if colheita not in SOWING_MONTH_DAY_BY_HARVEST:
            raise ValidationDomainError(
                f"Invalid harvest window '{colheita}'. Must be 'cedo', 'meio', or 'tarde'."
            )
        if solo_override is not None and solo_override not in SOIL_CAD_BY_TEXTURE:
            raise ValidationDomainError(
                f"Invalid soil texture '{solo_override}'. "
                "Must be 'arenoso', 'medio', or 'argiloso'."
            )

        sow_month, sow_day = SOWING_MONTH_DAY_BY_HARVEST[colheita]
        semeadura = date(REFERENCE_SOWING_YEAR, sow_month, sow_day)

        cell_id = self._climate_repo.find_cell_id(lat, lon) or EXAMPLE_CELL_ID
        soil_info = self._soil_repo.get_soil(lat, lon)
        solo_textura = solo_override if solo_override is not None else soil_info.textura_solo
        cad_mm = SOIL_CAD_BY_TEXTURE.get(solo_textura, soil_info.cad_capacidade_agua_mm)

        seasons = self._climate_repo.get_seasons(cell_id)
        cmip6_delta = self._climate_repo.get_cmip6_delta(cell_id)
        smap = self._climate_repo.get_latest_smap(lat, lon)
        smap_wetness = smap.sm_rootzone_wetness if smap is not None else None

        is_en = lang.lower().startswith("en")
        all_crops = self._crop_repo.list_all()

        viable_options: list[ResultadoOpcao] = []
        out_of_window: list[ForaDaJanelaOpcao] = []

        for crop in all_crops:
            if crop.id == "pousio":
                continue

            display_name = crop.nome_en if (is_en and crop.nome_en) else crop.nome
            if not self._risk_service.is_within_window(crop, semeadura):
                limit_str = crop.semeadura_limite_mes_dia or "02-28"
                msg = (
                    f"Outside the ZARC sowing window for '{colheita}' harvest "
                    f"(deadline: {limit_str})."
                    if is_en
                    else (
                        f"Fora da janela de plantio para colheita '{colheita}' "
                        f"(limite ZARC: {limit_str})."
                    )
                )
                out_of_window.append(ForaDaJanelaOpcao(id=crop.id, nome=display_name, texto=msg))
                continue

            option_result = self._evaluate_crop(
                crop=crop,
                display_name=display_name,
                seasons=seasons,
                cmip6_delta=cmip6_delta,
                semeadura=semeadura,
                cad_mm=cad_mm,
                smap_wetness=smap_wetness,
                nematoide=nematoide,
                gado=gado,
                is_en=is_en,
            )
            viable_options.append(option_result)

        viable_options.sort(key=lambda o: o.notas.final, reverse=True)
        melhor_id = viable_options[0].id if viable_options else "pousio"

        alternativas = self._build_alternatives(viable_options, melhor_id)
        plano_normal, plano_seco, plano_hoje = self._plan_service.build_3_year_plans(
            opcoes=viable_options,
            seasons=seasons,
            nematoide=nematoide,
            lang=lang,
        )

        texto_pousio = (
            "Fallow leaves the soil exposed to erosion, weeds, and moisture loss "
            "without generating revenue."
            if is_en
            else (
                "Deixar a área em pousio expõe o solo à erosão, multiplica daninhas "
                "e gera custo de dessecação sem receita."
            )
        )
        aviso = (
            "Decision support tool based on NASA satellite reanalysis and Embrapa ZARC parameters."
            if is_en
            else (
                "Ferramenta de apoio à decisão baseada em séries históricas da NASA "
                "e parâmetros da Embrapa."
            )
        )

        return Recomendacao(
            lat=lat,
            lon=lon,
            celula_id=cell_id,
            colheita=colheita,
            semeadura=semeadura,
            solo=solo_textura,
            nematoide=nematoide,
            gado=gado,
            melhor=melhor_id,
            alternativas=alternativas,
            opcoes=tuple(viable_options),
            fora_da_janela=tuple(out_of_window),
            texto_pousio=texto_pousio,
            plano_normal=plano_normal,
            plano_seco=plano_seco,
            plano_hoje=plano_hoje,
            versao_dados=DATA_VERSION,
            aviso=aviso,
        )

    def _evaluate_crop(
        self,
        crop: CropParams,
        display_name: str,
        seasons: list,
        cmip6_delta: object,
        semeadura: date,
        cad_mm: float,
        smap_wetness: float | None,
        nematoide: bool | None,
        gado: bool | None,
        is_en: bool,
    ) -> ResultadoOpcao:
        hist_results = self._risk_service.simulate_historical(
            crop=crop,
            seasons=seasons,
            semeadura=semeadura,
            cad_mm=cad_mm,
            smap_wetness=smap_wetness,
        )
        total_anos = len(hist_results) or 20
        faixa_anos = tuple(not r.aperto for r in hist_results)
        anos_bons = sum(1 for ok in faixa_anos if ok)
        anos_aperto = total_anos - anos_bons

        fut_media, fut_min, fut_max = self._risk_service.simulate_future_cmip6(
            crop=crop,
            seasons=seasons,
            delta=cmip6_delta,  # type: ignore[arg-type]
            semeadura=semeadura,
            cad_mm=cad_mm,
        )

        nota_seguranca = round((anos_bons / total_anos) * PERCENT_DIVISOR, 1)
        nota_futuro = round((fut_media / total_anos) * PERCENT_DIVISOR, 1)

        n_score = min(PERCENT_DIVISOR, (crop.n_deixado_kg / MAX_NITROGEN_KG_REF) * PERCENT_DIVISOR)
        nema_norm = (
            (crop.nematoide_efeito + NEMATODE_BASE_OFFSET) / NEMATODE_RANGE_SPAN
        ) * PERCENT_DIVISOR
        if nematoide is True:
            nota_solo = round(0.35 * crop.palhada_score + 0.20 * n_score + 0.45 * nema_norm, 1)
        else:
            nota_solo = round(0.55 * crop.palhada_score + 0.25 * n_score + 0.20 * nema_norm, 1)
        nota_solo = max(SCORE_MIN, min(SCORE_MAX, nota_solo))

        avg_loss = sum(r.fator_perda for r in hist_results) / total_anos if hist_results else 0.0
        receita_bruta = crop.produtividade_padrao_sc_ha * (1.0 - avg_loss) * crop.preco_padrao_saca
        credito_indireto = (
            crop.n_deixado_kg * NITROGEN_CREDIT_BRL_PER_KG
            + crop.palhada_score * SOIL_ORGANIC_MATTER_CREDIT_PER_SCORE
        )
        margem_ha = round(receita_bruta + credito_indireto - crop.custo_padrao_ha, 2)

        nota_renda = round(
            ((margem_ha - INCOME_SCORE_MIN_BRL) / (INCOME_SCORE_MAX_BRL - INCOME_SCORE_MIN_BRL))
            * PERCENT_DIVISOR,
            1,
        )
        nota_renda = max(SCORE_MIN, min(SCORE_MAX, nota_renda))

        livestock_adj = (
            LIVESTOCK_INTERCROP_BONUS if (gado is True and crop.id == "milho_braquiaria") else 0.0
        )

        nota_final = round(
            WEIGHT_SAFETY * nota_seguranca
            + WEIGHT_SOIL * nota_solo
            + WEIGHT_INCOME * nota_renda
            + WEIGHT_FUTURE * nota_futuro
            + livestock_adj,
            1,
        )
        nota_final = max(SCORE_MIN, min(SCORE_MAX, nota_final))

        rotulo_chuva = _score_to_label(nota_seguranca)
        rotulo_dinheiro = _score_to_label(nota_renda)
        rotulo_terra = _score_to_label(nota_solo)

        if is_en:
            texto_chuva = (
                f"Favorable water balance in {anos_bons} of {total_anos} historical years."
            )
            texto_dinheiro = f"Estimated net margin + soil credit of R$ {margem_ha:.0f}/ha."
            texto_terra = (
                f"Straw score {crop.palhada_score}/100 and {crop.n_deixado_kg} kg/ha of N fixed."
            )
            porque = (
                (
                    f"In {anos_aperto} of the last {total_anos} years, water deficit or "
                    "heat >= 35°C occurred during the critical stage (NASA POWER + SMAP)."
                ),
                (
                    "2050 projection (NEX-GDDP-CMIP6 SSP2-4.5): "
                    f"maintains {fut_media}/{total_anos} favorable years."
                ),
                (
                    f"Soil impact (SoilGrids CAD {cad_mm:.0f} mm): leaves {crop.n_deixado_kg} "
                    f"kg/ha of N and nematode effect {crop.nematoide_efeito:+d}."
                ),
            )
        else:
            texto_chuva = f"Chuva suficiente em {anos_bons} de {total_anos} anos históricos."
            texto_dinheiro = (
                f"Retorno estimado (margem + benefício no solo) de R$ {margem_ha:.0f}/ha."
            )
            texto_terra = (
                f"Cobertura nota {crop.palhada_score}/100 e {crop.n_deixado_kg} kg/ha de N deixado."
            )
            porque = (
                (
                    f"Em {anos_aperto} dos últimos {total_anos} anos, faltou chuva ou "
                    "fez calor >= 35°C na fase crítica (NASA POWER + SMAP)."
                ),
                (
                    "Projeção 2050 (NEX-GDDP-CMIP6 SSP2-4.5): "
                    f"mantém {fut_media} de {total_anos} anos favoráveis."
                ),
                (
                    f"Impacto no solo (SoilGrids CAD {cad_mm:.0f} mm): deixa {crop.n_deixado_kg} "
                    f"kg/ha de N e efeito em nematoides {crop.nematoide_efeito:+d}."
                ),
            )

        data_limite = (
            f"{REFERENCE_SOWING_YEAR}-{crop.semeadura_limite_mes_dia}"
            if crop.semeadura_limite_mes_dia
            else None
        )

        return ResultadoOpcao(
            id=crop.id,
            nome=display_name,
            na_janela=True,
            data_limite=data_limite,
            anos_bons_chuva=anos_bons,
            total_anos=total_anos,
            faixa_anos=faixa_anos,
            rotulo_chuva=rotulo_chuva,
            texto_chuva=texto_chuva,
            futuro_anos_bons_media=fut_media,
            futuro_anos_bons_min=fut_min,
            futuro_anos_bons_max=fut_max,
            margem_ha=margem_ha,
            rotulo_dinheiro=rotulo_dinheiro,
            texto_dinheiro=texto_dinheiro,
            rotulo_terra=rotulo_terra,
            texto_terra=texto_terra,
            notas=NotasOpcao(
                seguranca=nota_seguranca,
                futuro=nota_futuro,
                solo=nota_solo,
                renda=nota_renda,
                final=nota_final,
            ),
            porque=porque,
            como_fazer=crop.como_fazer,
        )

    def _build_alternatives(
        self, opcoes: list[ResultadoOpcao], melhor_id: str
    ) -> tuple[Alternativa, ...]:
        others = [o for o in opcoes if o.id != melhor_id] or opcoes
        if not others:
            return ()

        menos_risco = max(others, key=lambda o: o.notas.seguranca)
        mais_dinheiro = max(others, key=lambda o: o.notas.renda)
        cuidar_terra = max(others, key=lambda o: o.notas.solo)

        return (
            Alternativa(motivo="menos_risco", opcao_id=menos_risco.id),
            Alternativa(motivo="mais_dinheiro", opcao_id=mais_dinheiro.id),
            Alternativa(motivo="cuidar_da_terra", opcao_id=cuidar_terra.id),
        )
