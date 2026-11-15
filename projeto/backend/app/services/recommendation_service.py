"""Motor de recomendação: notas, rótulos, ranking, alternativas, frases e planos (PRD 7)."""

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, replace
from datetime import date
from operator import attrgetter

from app.constants import (
    DATA_VERSION,
    DEFAULT_INITIAL_ARM_FRACTION,
    IMERG_RAIN_SOURCE,
    PERCENT_DIVISOR,
    REFERENCE_SOWING_YEAR,
    SCORE_MAX,
    SCORE_MIN,
    SOIL_CAD_BY_TEXTURE,
    SOWING_MONTH_DAY_BY_HARVEST,
)
from app.models.climate import ClimateSeason, Cmip6Delta
from app.models.crop_option import CropParams
from app.models.recomendacao import (
    AguaOpcao,
    Alternativa,
    AnoDetalhe,
    CicloOpcao,
    CriterioDeuCerto,
    ForaDaJanelaOpcao,
    FuturoResultado,
    NotasOpcao,
    ObjetivoResultado,
    PlanoRotacao,
    Recomendacao,
    ResultadoAno,
    ResultadoOpcao,
)
from app.models.regras import Regras, RegrasNotaFinal, RegrasRenda, RegrasRotulos, RegrasSolo
from app.models.sinal_outono import SinalOutono
from app.models.talhao import Confirmacao
from app.repositories.climate_repository import ClimateRepository
from app.repositories.crop_params_repository import CropParamsRepository
from app.repositories.ndvi_repository import NdviRepository
from app.repositories.rules_repository import load_default_rules
from app.repositories.smap_repository import CellSmapRepository
from app.repositories.soil_repository import SoilRepository
from app.services.cell_lookup import IngestionServiceProtocol, find_or_ingest_cell
from app.services.climate_risk_service import ClimateRiskService
from app.services.crop_alert_service import COVER_CROP_TYPE
from app.services.errors import OutsideAreaError, ValidationDomainError
from app.services.field_history_service import FieldHistoryService
from app.services.future_climate_service import FutureClimateService
from app.services.plan_b_service import PlanBService
from app.services.raio_x_climate_service import RaioXClimateService
from app.services.rotation_plan_service import FALLOW_ID, RotationPlanService
from app.services.sinal_outono_service import SinalOutonoService
from app.services.suggestion_facts_service import SuggestionFactsService
from app.services.water_need_service import WaterNeedService
from app.services.year_detail_service import YearDetailService

# Nome da chuva no "Por quê?": com algum ano do IMERG (tarefa 0027), a série mistura as duas fontes.
RAIN_SOURCE_NAMES = {"nasa_power": "NASA POWER", IMERG_RAIN_SOURCE: "GPM IMERG + NASA POWER"}
SOIL_SOURCE_PT = {
    "soilgrids": "SoilGrids",
    "padrao": "padrão, sem dado do SoilGrids",
    "usuario": "informado por você",
}
SOIL_SOURCE_EN = {
    "soilgrids": "SoilGrids",
    "padrao": "default, no SoilGrids data",
    "usuario": "set by you",
}
TEXTURE_PT = {"arenoso": "arenoso", "medio": "médio", "argiloso": "argiloso"}
TEXTURE_EN = {"arenoso": "sandy", "medio": "medium", "argiloso": "clayey"}
MONTHS_EN = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
# "Se você prefere…": motivo e eixo de cada alternativa, na ordem em que a tela mostra.
ALTERNATIVE_AXES: tuple[tuple[str, Callable[[NotasOpcao], float]], ...] = (
    ("menos_risco", attrgetter("seguranca")),
    ("mais_renda", attrgetter("renda")),
    ("cuidar_da_terra", attrgetter("solo")),
)
# "O que você quer mais?" (seção 5.1, tarefa 0044): o eixo de cada objetivo do produtor. Sem
# objetivo ("equilibrio"), vale a nota final com os pesos padrão (RF-05).
OBJECTIVE_AXES: tuple[tuple[str, Callable[[NotasOpcao], float] | None], ...] = (
    ("equilibrio", None),
    ("seguranca", attrgetter("seguranca")),
    ("renda", attrgetter("renda")),
    ("terra", attrgetter("solo")),
)
CRITICAL_STAGE_FLOWERING = "floracao"
CRITICAL_STAGE_ESTABLISHMENT = "pegamento"


def _clamp(score: float) -> float:
    return max(SCORE_MIN, min(SCORE_MAX, score))


def rain_label(anos_bons: int, total: int, rotulos: RegrasRotulos) -> str:
    """Bom >= 17 de 20 anos; Médio 12 a 16; Fraco < 12 (plano técnico §4.4)."""
    if anos_bons * PERCENT_DIVISOR >= rotulos.chuva_bom_pct * total:
        return "bom"
    if anos_bons * PERCENT_DIVISOR >= rotulos.chuva_medio_pct * total:
        return "medio"
    return "fraco"


def _label(score: float, good: float, medium: float) -> str:
    if score >= good:
        return "bom"
    if score >= medium:
        return "medio"
    return "fraco"


def soil_score(crop: CropParams, nematoide: bool | None, regras: RegrasSolo) -> float:
    """Nota de solo do PRD 7.4; com nematoide = sim, pragas valem 1,5 e o total é reescalado."""
    if nematoide is True:
        peso = regras.peso_pragas_nematoide
        pragas = crop.solo_pragas * peso
        maximo = regras.palhada_max + regras.nitrogenio_max + regras.pragas_max * peso
        total = (crop.solo_palhada + crop.solo_nitrogenio + pragas) / maximo * PERCENT_DIVISOR
    else:
        total = crop.solo_palhada + crop.solo_nitrogenio + crop.solo_pragas
    return round(_clamp(total), 1)


def gives_grain(crop: CropParams, regras: RegrasRenda) -> bool:
    """A cultura dá grão para vender? Pelo `tipo` do culturas.yaml (grupo `renda`, tarefa 0040)."""
    return crop.tipo in regras.tipos_com_grao


def income_score(crop: CropParams, seguranca: float, regras: RegrasRenda) -> float:
    """Nota de renda sem preço nem custo (PRD 7.5, tarefa 0040).

    Quem dá grão tem a renda que o clima deixa colher: a segurança climática da própria opção.
    Quem não dá grão (cobertura, pousio) fica com a nota fixa `nota_sem_grao`.
    """
    if gives_grain(crop, regras):
        return round(_clamp(seguranca), 1)
    return round(_clamp(regras.nota_sem_grao), 1)


def final_score(
    seguranca: float,
    solo: float,
    renda: float,
    futuro: float | None,
    pesos: RegrasNotaFinal,
    bonus: float = 0.0,
) -> float:
    """Pesos 30/25/30/15. Sem dado do CMIP6, o futuro sai e os outros pesos são reescalados."""
    soma = pesos.peso_seguranca * seguranca + pesos.peso_solo * solo + pesos.peso_renda * renda
    if futuro is None:
        soma /= pesos.peso_seguranca + pesos.peso_solo + pesos.peso_renda
    else:
        soma += pesos.peso_futuro * futuro
    return round(_clamp(soma + bonus), 1)


def _pct(anos_bons: int, total: int) -> float:
    return round(anos_bons / total * PERCENT_DIVISOR, 1) if total else 0.0


def _better_than_best(
    opcoes: list[ResultadoOpcao],
    melhor: ResultadoOpcao,
    usadas: set[str],
    nota_do_eixo: Callable[[NotasOpcao], float],
) -> list[ResultadoOpcao]:
    piso = nota_do_eixo(melhor.notas)
    return [o for o in opcoes if o.id not in usadas and nota_do_eixo(o.notas) > piso]


def _single_top(
    candidatas: list[ResultadoOpcao], nota_do_eixo: Callable[[NotasOpcao], float]
) -> str | None:
    """Id da única opção com a maior nota no eixo; None se não houver candidata ou se empatar."""
    if not candidatas:
        return None
    topo = max(nota_do_eixo(o.notas) for o in candidatas)
    no_topo = [o.id for o in candidatas if nota_do_eixo(o.notas) == topo]
    return no_topo[0] if len(no_topo) == 1 else None


def build_alternatives(opcoes: list[ResultadoOpcao], melhor_id: str) -> tuple[Alternativa, ...]:
    """Uma alternativa por eixo, só se superar a `melhor` nesse eixo e sem repetir cultura (R4.2).

    Os eixos seguem a ordem da tela (risco, renda, terra). Cada eixo pega, entre as opções ainda
    não usadas com nota maior que a da `melhor` naquele eixo, a de maior nota no eixo. No empate,
    a opção que é a única maior de um eixo seguinte fica para ele; depois, vale a maior nota final.
    Sem candidata, o eixo não aparece.
    """
    melhor = next((o for o in opcoes if o.id == melhor_id), None)
    if melhor is None:
        return ()
    usadas = {melhor_id}
    alternativas: list[Alternativa] = []
    for idx, (motivo, nota_do_eixo) in enumerate(ALTERNATIVE_AXES):
        candidatas = _better_than_best(opcoes, melhor, usadas, nota_do_eixo)
        if not candidatas:
            continue
        reservadas = {
            _single_top(_better_than_best(opcoes, melhor, usadas, nota), nota)
            for _, nota in ALTERNATIVE_AXES[idx + 1 :]
        }
        escolhida = max(
            candidatas,
            key=lambda o: (nota_do_eixo(o.notas), o.id not in reservadas, o.notas.final),
        )
        usadas.add(escolhida.id)
        alternativas.append(Alternativa(motivo=motivo, opcao=escolhida.id))
    return tuple(alternativas)


@dataclass(frozen=True)
class _Avaliacao:
    """Contas de uma opção antes das notas (clima de hoje e do futuro, solo e anos detalhados)."""

    crop: CropParams
    nome: str
    anos: list[ResultadoAno]
    anos_secos: list[ResultadoAno]
    futuro: FuturoResultado | None
    solo: float
    anos_detalhe: tuple[AnoDetalhe, ...]
    agua: AguaOpcao | None


class RecommendationService:
    """Junta clima, solo e renda numa resposta: melhor opção, alternativas e plano de 3 anos."""

    def __init__(
        self,
        crop_repo: CropParamsRepository,
        climate_repo: ClimateRepository,
        soil_repo: SoilRepository,
        risk_service: ClimateRiskService,
        plan_service: RotationPlanService,
        rules: Regras | None = None,
        ingestion_service: IngestionServiceProtocol | None = None,
        sinal_service: SinalOutonoService | None = None,
        ndvi_repo: NdviRepository | None = None,
        history_service: FieldHistoryService | None = None,
        year_detail_service: YearDetailService | None = None,
        smap_repo: CellSmapRepository | None = None,
    ) -> None:
        self._crop_repo = crop_repo
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._risk_service = risk_service
        self._plan_service = plan_service
        self._rules = rules if rules is not None else load_default_rules()
        self._ingestion_service = ingestion_service
        self._sinal_service = sinal_service
        # Histórico do talhão pelo NDVI, só para a frase do "Por quê?" (PRD 7.6)
        self._ndvi_repo = ndvi_repo
        self._history_service = history_service or FieldHistoryService(self._rules)
        # Detalhe de cada ano da faixa de chuva (P1); sem o ONI injetado, `enso` sai nulo
        self._year_detail_service = year_detail_service or YearDetailService(rules=self._rules)
        # Umidade do SMAP no dia de plantar de cada ano: balde inicial (PRD 7.2, R3.3)
        self._smap_repo = smap_repo
        # Aba Sugestão (tarefa 0044): linha "Água", El Niño / La Niña e o que observar. Clima de
        # 2041-2060 e geada na célula com as contas do raio-X (tarefa 0049: as duas telas dizem o
        # mesmo número). Só leem as regras: montados aqui, sem injeção
        self._water_service = WaterNeedService(self._rules)
        self._facts_service = SuggestionFactsService(self._rules)
        self._future_service = FutureClimateService(self._rules)
        self._cell_climate_service = RaioXClimateService(self._rules)
        # Plano B do sinal do outono: o mesmo da tela do Plano (tarefa 0049)
        self._plan_b_service = PlanBService(self._rules)

    def recommend(
        self,
        lat: float,
        lon: float,
        colheita: str = "meio",
        solo_override: str | None = None,
        nematoide: bool | None = None,
        gado: bool | None = None,
        lang: str = "pt-BR",
        confirmadas: Iterable[tuple[int, str]] = (),
    ) -> Recomendacao:
        """Recomendação completa para o ponto e a faixa de colheita (PRD 7.1 a 7.7).

        `confirmadas`: as últimas safras que o produtor confirmou (ano, "plantou" ou "parado");
        valem no lugar do satélite em tudo o que lê o histórico do talhão (tarefa 0039).
        """
        if colheita not in SOWING_MONTH_DAY_BY_HARVEST:
            raise ValidationDomainError(
                f"Faixa de colheita inválida: '{colheita}'. Use 'cedo', 'meio' ou 'tarde'."
            )
        if solo_override is not None and solo_override not in SOIL_CAD_BY_TEXTURE:
            raise ValidationDomainError(
                f"Textura de solo inválida: '{solo_override}'. "
                "Use 'arenoso', 'medio' ou 'argiloso'."
            )
        confirmadas_por_ano = self._history_service.check_confirmations(confirmadas)

        cell_id = find_or_ingest_cell(self._climate_repo, self._ingestion_service, lat, lon)
        seasons = self._climate_repo.get_seasons(cell_id) if cell_id is not None else []
        if cell_id is None or not seasons:
            raise OutsideAreaError(
                "Ainda não temos dados preparados para esse ponto. Veja a fazenda de exemplo."
            )
        deltas = self._climate_repo.get_cmip6_deltas(cell_id)

        sow_month, sow_day = SOWING_MONTH_DAY_BY_HARVEST[colheita]
        semeadura = date(REFERENCE_SOWING_YEAR, sow_month, sow_day)
        smap_por_ano = (
            self._risk_service.sowing_day_wetness(
                self._smap_repo.get_cell_smap_series(cell_id), semeadura
            )
            if self._smap_repo is not None
            else {}
        )

        soil_info = self._soil_repo.get_soil(lat, lon)
        solo_textura = solo_override or soil_info.textura_solo
        solo_fonte = "usuario" if solo_override else soil_info.fonte
        cad_mm = SOIL_CAD_BY_TEXTURE.get(solo_textura, soil_info.cad_capacidade_agua_mm)

        is_en = lang.lower().startswith("en")
        anos_secos = self._plan_service.select_driest_years(seasons)

        crops = self._crop_repo.list_all()
        avaliacoes: list[_Avaliacao] = []
        fora_da_janela: list[ForaDaJanelaOpcao] = []
        for crop in crops:
            if crop.id == FALLOW_ID:
                continue  # linha de base, fora do ranking (PRD 7.6)
            nome = crop.nome_en if (is_en and crop.nome_en) else crop.nome
            if not self._risk_service.is_within_window(crop, semeadura):
                limite = crop.semeadura_limite_mes_dia
                fora_da_janela.append(
                    ForaDaJanelaOpcao(
                        id=crop.id,
                        nome=nome,
                        texto=self._out_of_window_text(crop, nome, colheita, is_en),
                        data_limite=f"{REFERENCE_SOWING_YEAR}-{limite}" if limite else None,
                    )
                )
                continue
            avaliacoes.append(
                self._evaluate(
                    crop,
                    nome,
                    seasons,
                    deltas,
                    semeadura,
                    cad_mm,
                    anos_secos,
                    nematoide,
                    smap_por_ano,
                    lang,
                )
            )

        fonte_chuva = self._rain_source_name(seasons)
        opcoes = [
            self._build_option(
                a,
                bonus=self._rules.nota_final.bonus_gado_milho_braquiaria
                if (gado is True and a.crop.id == "milho_braquiaria")
                else 0.0,
                semeadura=semeadura,
                solo=(solo_textura, cad_mm, solo_fonte),
                fonte_chuva=fonte_chuva,
                is_en=is_en,
            )
            for a in avaliacoes
        ]
        frase_balde = self._bucket_phrase(seasons, smap_por_ano, is_en)
        if frase_balde:
            # Logo depois da frase da chuva: as duas falam da mesma conta de água.
            opcoes = [replace(o, porque=(o.porque[0], frase_balde, *o.porque[1:])) for o in opcoes]
        frase_historico = self._history_phrase(lat, lon, is_en, confirmadas_por_ano)
        if frase_historico:
            opcoes = [replace(o, porque=(*o.porque, frase_historico)) for o in opcoes]
        opcoes.sort(key=lambda o: o.notas.final, reverse=True)
        melhor_id = opcoes[0].id if opcoes else FALLOW_ID

        pousio_notas = self._fallow_scores(crops, nematoide, has_future=bool(deltas))
        plano_normal, plano_seco, plano_hoje = self._plan_service.build_3_year_plans(
            opcoes=opcoes,
            anos_secos=anos_secos,
            pousio=pousio_notas,
            nematoide=nematoide,
            lang=lang,
        )
        objetivos = self._objectives(opcoes, pousio_notas, nematoide)
        if "equilibrio" in objetivos:
            # Tarefa 0044: a sugestão é o ano 1 da rotação. O Plano A começa pela melhor opção (o
            # Plano B, do ano seco, continua livre para começar por outra).
            equilibrio = objetivos["equilibrio"]
            plano_normal = PlanoRotacao(
                anos=equilibrio.plano,
                nota=equilibrio.nota_plano,
                descricao=plano_normal.descricao,
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
            alternativas=build_alternatives(opcoes, melhor_id),
            opcoes=tuple(opcoes),
            fora_da_janela=tuple(fora_da_janela),
            texto_pousio=(
                "Fallow leaves the soil exposed to erosion, weeds, and moisture loss "
                "without generating revenue."
                if is_en
                else (
                    "Deixar a área em pousio expõe o solo à erosão, multiplica daninhas "
                    "e gera custo de dessecação sem receita."
                )
            ),
            plano_normal=plano_normal,
            plano_seco=plano_seco,
            plano_hoje=plano_hoje,
            versao_dados=DATA_VERSION,
            aviso=(
                "Decision support only. It does not replace an agronomist."
                if is_en
                else "Ajuda a decidir. Não substitui o agrônomo."
            ),
            sinal=self._autumn_signal(
                lat, lon, plano_normal.anos[0], opcoes, seasons, semeadura, lang
            ),
            objetivos=objetivos,
            clima_futuro=self._future_service.summarize(deltas, seasons),
            geada=self._cell_climate_service.frost(seasons),
        )

    def _autumn_signal(
        self,
        lat: float,
        lon: float,
        cultura_a: str,
        opcoes: list[ResultadoOpcao],
        seasons: list[ClimateSeason],
        semeadura: date,
        lang: str,
    ) -> SinalOutono | None:
        """Sinal do outono com o Plano A (o 1º ano do plano sugerido) e o Plano B da tela do Plano.

        O Plano B é o do `PlanBService` (a cultura que mais deu certo quando a do Plano A falhou),
        o mesmo do cartão "Plano A e Plano B" (tarefa 0049): o sinal e a tela falam do mesmo plano.
        """
        if self._sinal_service is None:
            return None
        ab = self._plan_b_service.plan_ab(cultura_a, opcoes, seasons, semeadura)
        return self._sinal_service.evaluate(
            lat=lat,
            lon=lon,
            cultura_a=cultura_a,
            cultura_b=ab.cultura_b if ab else None,
            opcoes=opcoes,
            seasons=seasons,
            lang=lang,
        )

    def _objectives(
        self, opcoes: list[ResultadoOpcao], pousio: NotasOpcao, nematoide: bool | None
    ) -> dict[str, ObjetivoResultado]:
        """Ordem das opções e plano para cada objetivo do produtor (seção 5.1, tarefa 0044).

        A ordem é a nota do eixo do objetivo, com o desempate pela nota final (a mesma regra da
        tela 6, RF-05); sem objetivo ("equilibrio"), a nota final. O plano começa pela 1ª da ordem
        e escolhe os anos 2 e 3 pela nota do mesmo eixo. Sem opção na janela: nenhum objetivo.
        """
        if not opcoes:
            return {}
        finals = {o.id: o.notas.final for o in opcoes} | {FALLOW_ID: pousio.final}
        objetivos: dict[str, ObjetivoResultado] = {}
        for objetivo, eixo in OBJECTIVE_AXES:
            nota = eixo or attrgetter("final")
            ordem = tuple(
                o.id for o in sorted(opcoes, key=lambda o: (-nota(o.notas), -o.notas.final))
            )
            # O plano de um objetivo usa só as culturas; o do equilíbrio é o Plano A do PRD 7.7,
            # com o pousio nas combinações.
            plano = tuple(
                self._plan_service.best_plan_starting_with(
                    ordem[0],
                    opcoes,
                    pousio,
                    axis=eixo,
                    nematoide=nematoide,
                    allow_fallow=eixo is None,
                )
            )
            objetivos[objetivo] = ObjetivoResultado(
                ordem=ordem, plano=plano, nota_plano=self._plan_service.plan_score(plano, finals)
            )
        return objetivos

    def _criterion(self, crop: CropParams) -> CriterioDeuCerto:
        """O critério de "deu certo" do motor para a cultura (PRD 7.2), com os números do YAML."""
        clima = self._rules.clima
        cobertura = crop.tipo == COVER_CROP_TYPE
        return CriterioDeuCerto(
            isna_min=clima.isna_cobertura if cobertura else clima.isna_grao,
            calor_temp_c=clima.calor_temp_c,
            calor_min_dias=clima.calor_min_dias,
            fase=CRITICAL_STAGE_ESTABLISHMENT if cobertura else CRITICAL_STAGE_FLOWERING,
            janela_dias=clima.janela_cobertura_dias if cobertura else clima.janela_grao_meia_dias,
        )

    def _fallow_scores(
        self, crops: list[CropParams], nematoide: bool | None, has_future: bool
    ) -> NotasOpcao:
        """Notas do pousio para o plano de 3 anos: fora do ranking, mas nas combinações (PRD 7.7).

        Segurança 100 (PRD 7.2: não tem o que perder) e futuro 100 quando há CMIP6 (PRD 7.6); renda
        de quem não dá grão (`renda.nota_sem_grao`, tarefa 0040) e a nota de solo da tabela 7.4 (0).
        Iguais no ano normal e no ano seco.
        """
        crop = next((c for c in crops if c.id == FALLOW_ID), None)
        solo = soil_score(crop, nematoide, self._rules.solo) if crop else SCORE_MIN
        futuro = SCORE_MAX if has_future else None
        renda = round(_clamp(self._rules.renda.nota_sem_grao), 1)
        final = final_score(SCORE_MAX, solo, renda, futuro, self._rules.nota_final)
        return NotasOpcao(seguranca=SCORE_MAX, futuro=futuro, solo=solo, renda=renda, final=final)

    def _evaluate(
        self,
        crop: CropParams,
        nome: str,
        seasons: list[ClimateSeason],
        deltas: list[Cmip6Delta],
        semeadura: date,
        cad_mm: float,
        anos_secos: list[int],
        nematoide: bool | None,
        smap_por_ano: dict[int, float],
        lang: str,
    ) -> _Avaliacao:
        anos = self._risk_service.simulate_historical(
            crop=crop,
            seasons=seasons,
            semeadura=semeadura,
            cad_mm=cad_mm,
            smap_wetness_by_year=smap_por_ano,
        )
        secos = [r for r in anos if r.ano in set(anos_secos)]
        futuro_por_modelo = self._risk_service.simulate_future_by_model(
            crop=crop,
            seasons=seasons,
            deltas=deltas,
            semeadura=semeadura,
            cad_mm=cad_mm,
            smap_wetness_by_year=smap_por_ano,
        )
        futuro = self._risk_service.summarize_future(
            futuro_por_modelo, scenario=deltas[0].scenario if deltas else ""
        )
        return _Avaliacao(
            crop=crop,
            nome=nome,
            anos=anos,
            anos_secos=secos,
            futuro=futuro,
            solo=soil_score(crop, nematoide, self._rules.solo),
            anos_detalhe=self._year_detail_service.year_details(
                crop=crop,
                semeadura=semeadura,
                seasons=seasons,
                resultados=anos,
                lang=lang,
                smap_wetness_by_year=smap_por_ano,
            ),
            agua=self._water_service.summarize(anos, cad_mm, futuro_por_modelo),
        )

    def _build_option(
        self,
        a: _Avaliacao,
        bonus: float,
        semeadura: date,
        solo: tuple[str, float, str],
        fonte_chuva: str,
        is_en: bool,
    ) -> ResultadoOpcao:
        total = len(a.anos)
        anos_bons = sum(1 for r in a.anos if not r.aperto)
        anos_bons_secos = sum(1 for r in a.anos_secos if not r.aperto)
        nota_futuro = _pct(a.futuro.anos_bons_media, total) if a.futuro else None

        seguranca = _pct(anos_bons, total)
        seguranca_seco = _pct(anos_bons_secos, len(a.anos_secos))
        regras_renda = self._rules.renda
        renda = income_score(a.crop, seguranca, regras_renda)
        renda_seco = income_score(a.crop, seguranca_seco, regras_renda)
        da_grao = gives_grain(a.crop, regras_renda)
        frases = self._rules.frases["en" if is_en else "pt"]

        pesos = self._rules.nota_final
        rotulos = self._rules.rotulos
        notas = NotasOpcao(
            seguranca=seguranca,
            futuro=nota_futuro,
            solo=a.solo,
            renda=renda,
            final=final_score(seguranca, a.solo, renda, nota_futuro, pesos, bonus),
        )
        notas_seco = NotasOpcao(
            seguranca=seguranca_seco,
            futuro=nota_futuro,
            solo=a.solo,
            renda=renda_seco,
            final=final_score(seguranca_seco, a.solo, renda_seco, nota_futuro, pesos, bonus),
        )

        limite = a.crop.semeadura_limite_mes_dia
        return ResultadoOpcao(
            id=a.crop.id,
            nome=a.nome,
            na_janela=True,
            data_limite=f"{REFERENCE_SOWING_YEAR}-{limite}" if limite else None,
            anos_bons_chuva=anos_bons,
            total_anos=total,
            faixa_anos=tuple(not r.aperto for r in a.anos),
            rotulo_chuva=rain_label(anos_bons, total, rotulos),
            texto_chuva=(
                f"Worked in {anos_bons} of {total} years"
                if is_en
                else f"Deu certo em {anos_bons} de {total} anos"
            ),
            futuro=a.futuro,
            da_grao=da_grao,
            rotulo_renda=_label(renda, rotulos.renda_bom, rotulos.renda_medio),
            texto_renda=frases.renda_com_grao if da_grao else frases.renda_sem_grao,
            texto_risco=frases.renda_risco.format(anos_aperto=total - anos_bons, total=total),
            rotulo_terra=_label(a.solo, rotulos.terra_bom, rotulos.terra_medio),
            texto_terra=self._soil_text(a.crop, is_en),
            notas=notas,
            notas_seco=notas_seco,
            porque=self._why(a, total - anos_bons, total, semeadura, solo, fonte_chuva, is_en),
            como_fazer=(
                a.crop.como_fazer_en if (is_en and a.crop.como_fazer_en) else a.crop.como_fazer
            ),
            anos_detalhe=a.anos_detalhe,
            agua=a.agua,
            criterio=self._criterion(a.crop),
            ciclo=CicloOpcao(dias=a.crop.ciclo_dias, floracao_dias=a.crop.dias_florescer),
            observar=self._facts_service.watch_facts(a.anos_detalhe),
            enso_acerto=self._facts_service.enso_hit_rates(a.anos_detalhe),
        )

    @staticmethod
    def _rain_source_name(seasons: list[ClimateSeason]) -> str:
        """Nome da chuva da série: um ano com o IMERG basta para "GPM IMERG + NASA POWER"."""
        if any(season.rain_source == IMERG_RAIN_SOURCE for season in seasons):
            return RAIN_SOURCE_NAMES[IMERG_RAIN_SOURCE]
        source = seasons[0].rain_source
        return RAIN_SOURCE_NAMES.get(source, source)

    @staticmethod
    def _soil_text(crop: CropParams, is_en: bool) -> str:
        """Frase de solo do PRD 7.6: palhada, nitrogênio e ciclo do nematoide."""
        if crop.solo_palhada >= 35:
            nivel, level = "alta", "high"
        elif crop.solo_palhada >= 20:
            nivel, level = "média", "medium"
        else:
            nivel, level = "pouca", "little"
        quebra = crop.solo_pragas > 0
        if is_en:
            nitrogen = (
                f"{crop.n_deixado_kg} kg/ha of nitrogen" if crop.n_deixado_kg else "no nitrogen"
            )
            ciclo = "helps break" if quebra else "does not break"
            return f"Leaves {level} straw and {nitrogen}; {ciclo} the nematode cycle."
        nitrogenio = (
            f"{crop.n_deixado_kg} kg/ha de nitrogênio" if crop.n_deixado_kg else "nenhum nitrogênio"
        )
        ciclo = "ajuda a quebrar" if quebra else "não quebra"
        return f"Deixa palhada {nivel} e {nitrogenio}; {ciclo} o ciclo do nematoide."

    def _why(
        self,
        a: _Avaliacao,
        anos_aperto: int,
        total: int,
        semeadura: date,
        solo: tuple[str, float, str],
        fonte_chuva: str,
        is_en: bool,
    ) -> tuple[str, ...]:
        """Frases do "Por quê?" pelos modelos do regras.yaml, com os mesmos números da conta."""
        textura, cad_mm, solo_fonte = solo
        modelos = self._rules.frases["en" if is_en else "pt"]
        clima = self._rules.clima
        fase = (
            modelos.fase_cobertura.format(dias=clima.janela_cobertura_dias)
            if a.crop.tipo == "cobertura"
            else modelos.fase_grao
        )
        if is_en:
            data = f"{MONTHS_EN[semeadura.month - 1]} {semeadura.day}"
            texturas, fontes_solo = TEXTURE_EN, SOIL_SOURCE_EN
        else:
            data = f"{semeadura:%d/%m}"
            texturas, fontes_solo = TEXTURE_PT, SOIL_SOURCE_PT
        frases = [
            modelos.seguranca.format(
                data=data,
                anos_aperto=anos_aperto,
                total=total,
                calor_c=f"{clima.calor_temp_c:g}",
                fase=fase,
                fonte_chuva=fonte_chuva,
            )
        ]
        if a.futuro:
            frases.append(
                modelos.futuro.format(
                    cenario=a.futuro.cenario,
                    modelos=a.futuro.modelos,
                    anos_bons=a.futuro.anos_bons_media,
                    total=total,
                    minimo=a.futuro.anos_bons_min,
                    maximo=a.futuro.anos_bons_max,
                )
            )
        frases.append(
            modelos.solo.format(
                textura=texturas.get(textura, textura),
                cad_mm=f"{cad_mm:.0f}",
                fonte_solo=fontes_solo.get(solo_fonte, solo_fonte),
            )
        )
        return tuple(frases)

    def _bucket_phrase(
        self, seasons: list[ClimateSeason], smap_por_ano: dict[int, float], is_en: bool
    ) -> str | None:
        """Em quantos anos da série o balde começou pelo SMAP (PRD 7.2). Nenhum: sem frase."""
        anos_smap = sorted({s.year for s in seasons if s.year in smap_por_ano})
        if not anos_smap:
            return None
        return self._rules.frases["en" if is_en else "pt"].balde_smap.format(
            anos_smap=len(anos_smap),
            total=len(seasons),
            ano_inicio=anos_smap[0],
            ano_fim=anos_smap[-1],
            padrao_pct=f"{DEFAULT_INITIAL_ARM_FRACTION * PERCENT_DIVISOR:.0f}",
        )

    def _history_phrase(
        self, lat: float, lon: float, is_en: bool, confirmadas: Mapping[int, Confirmacao]
    ) -> str | None:
        """Frase do histórico do talhão (PRD 7.6), a mesma em todas as opções.

        Conta só os anos certos (parado + plantou), como o cartão da tela: sem soja, incerto e
        sem dado ficam de fora. As safras que o produtor confirmou valem no lugar do satélite e a
        frase diz quantas foram (`historico_confirmado`). Sem série de NDVI do ponto e sem
        confirmação, ou sem nenhum ano certo, não há frase.
        """
        serie = self._ndvi_repo.get_ndvi_history(lat, lon) if self._ndvi_repo is not None else []
        if not serie and not confirmadas:
            return None
        historico = self._history_service.classify_entressafra(serie, confirmadas)
        anos_certos = historico.parado + historico.plantou
        if anos_certos == 0:
            return None
        janela = self._rules.historico_ndvi
        frases = self._rules.frases["en" if is_en else "pt"]
        do_produtor = sum(1 for a in historico.anos if a.fonte_ano == "produtor")
        modelo = frases.historico_confirmado if do_produtor else frases.historico
        return modelo.format(
            parado=historico.parado,
            plantou=historico.plantou,
            anos_certos=anos_certos,
            sem_certeza=historico.sem_certeza,
            total=historico.total,
            ano_inicio=janela.ano_inicio,
            ano_fim=janela.ano_fim,
            confirmadas=do_produtor,
            vistas=anos_certos - do_produtor,
        )

    def _out_of_window_text(self, crop: CropParams, nome: str, colheita: str, is_en: bool) -> str:
        """Uma frase por cultura fora da janela: o nome, o limite do ZARC e a faixa por extenso."""
        frases = self._rules.frases["en" if is_en else "pt"]
        mes, _, dia = (crop.semeadura_limite_mes_dia or "").partition("-")
        if is_en and mes.isdigit():
            limite = f"{MONTHS_EN[int(mes) - 1]} {int(dia)}"
        else:
            limite = f"{dia}/{mes}"
        faixa = {
            "cedo": frases.colheita_cedo,
            "meio": frases.colheita_meio,
            "tarde": frases.colheita_tarde,
        }.get(colheita, colheita)
        return frases.fora_da_janela.format(cultura=nome, limite=limite, faixa=faixa)
