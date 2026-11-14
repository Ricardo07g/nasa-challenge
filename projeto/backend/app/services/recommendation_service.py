"""Motor de recomendação: notas, rótulos, ranking, alternativas, frases e planos (PRD 7)."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from operator import attrgetter
from statistics import mean

from app.constants import (
    DATA_VERSION,
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
    Alternativa,
    ForaDaJanelaOpcao,
    FuturoResultado,
    NotasOpcao,
    Recomendacao,
    ResultadoAno,
    ResultadoOpcao,
)
from app.models.regras import Regras, RegrasNotaFinal, RegrasRotulos, RegrasSolo
from app.repositories.climate_repository import ClimateRepository
from app.repositories.crop_params_repository import CropParamsRepository
from app.repositories.rules_repository import load_default_rules
from app.repositories.soil_repository import SoilRepository
from app.services.cell_lookup import IngestionServiceProtocol, find_or_ingest_cell
from app.services.climate_risk_service import ClimateRiskService
from app.services.errors import OutsideAreaError, ValidationDomainError
from app.services.rotation_plan_service import FALLOW_ID, RotationPlanService

RAIN_SOURCE_NAMES = {"nasa_power": "NASA POWER", "imerg_final": "GPM IMERG + NASA POWER"}
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
    ("mais_dinheiro", attrgetter("renda")),
    ("cuidar_da_terra", attrgetter("solo")),
)


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


def expected_margin(crop: CropParams, anos: list[ResultadoAno]) -> float:
    """Margem (PRD 7.5): produtividade x (1 - perda média dos anos) x preço - custo."""
    perda_media = mean(r.fator_perda for r in anos) if anos else 0.0
    receita = crop.produtividade_padrao_sc_ha * (1.0 - perda_media) * crop.preco_padrao_saca
    return round(receita - crop.custo_padrao_ha, 2)


def income_score(margem: float, maior_margem: float) -> float:
    """Nota de renda (PRD 7.5): 100 x margem / maior margem; margem negativa vale 0."""
    if maior_margem <= 0.0 or margem <= 0.0:
        return 0.0
    return round(_clamp(PERCENT_DIVISOR * margem / maior_margem), 1)


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

    Os eixos seguem a ordem da tela (risco, dinheiro, terra). Cada eixo pega, entre as opções ainda
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
    """Contas de uma opção antes da nota de renda (que depende da maior margem entre todas)."""

    crop: CropParams
    nome: str
    anos: list[ResultadoAno]
    anos_secos: list[ResultadoAno]
    futuro: FuturoResultado | None
    solo: float
    margem: float
    margem_seco: float


class RecommendationService:
    """Junta clima, solo e dinheiro numa resposta: melhor opção, alternativas e plano de 3 anos."""

    def __init__(
        self,
        crop_repo: CropParamsRepository,
        climate_repo: ClimateRepository,
        soil_repo: SoilRepository,
        risk_service: ClimateRiskService,
        plan_service: RotationPlanService,
        rules: Regras | None = None,
        ingestion_service: IngestionServiceProtocol | None = None,
    ) -> None:
        self._crop_repo = crop_repo
        self._climate_repo = climate_repo
        self._soil_repo = soil_repo
        self._risk_service = risk_service
        self._plan_service = plan_service
        self._rules = rules if rules is not None else load_default_rules()
        self._ingestion_service = ingestion_service

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
        """Recomendação completa para o ponto e a faixa de colheita (PRD 7.1 a 7.7)."""
        if colheita not in SOWING_MONTH_DAY_BY_HARVEST:
            raise ValidationDomainError(
                f"Faixa de colheita inválida: '{colheita}'. Use 'cedo', 'meio' ou 'tarde'."
            )
        if solo_override is not None and solo_override not in SOIL_CAD_BY_TEXTURE:
            raise ValidationDomainError(
                f"Textura de solo inválida: '{solo_override}'. "
                "Use 'arenoso', 'medio' ou 'argiloso'."
            )

        cell_id = find_or_ingest_cell(self._climate_repo, self._ingestion_service, lat, lon)
        seasons = self._climate_repo.get_seasons(cell_id) if cell_id is not None else []
        if cell_id is None or not seasons:
            raise OutsideAreaError(
                "Ainda não temos dados preparados para esse ponto. Veja a fazenda de exemplo."
            )
        deltas = self._climate_repo.get_cmip6_deltas(cell_id)

        sow_month, sow_day = SOWING_MONTH_DAY_BY_HARVEST[colheita]
        semeadura = date(REFERENCE_SOWING_YEAR, sow_month, sow_day)

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
                fora_da_janela.append(
                    ForaDaJanelaOpcao(
                        id=crop.id, nome=nome, texto=self._out_of_window_text(crop, colheita, is_en)
                    )
                )
                continue
            avaliacoes.append(
                self._evaluate(
                    crop, nome, seasons, deltas, semeadura, cad_mm, anos_secos, nematoide
                )
            )

        maior_margem = max((a.margem for a in avaliacoes), default=0.0)
        maior_margem_seco = max((a.margem_seco for a in avaliacoes), default=0.0)
        fonte_chuva = RAIN_SOURCE_NAMES.get(seasons[0].rain_source, seasons[0].rain_source)
        opcoes = [
            self._build_option(
                a,
                maior_margem=maior_margem,
                maior_margem_seco=maior_margem_seco,
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
        opcoes.sort(key=lambda o: o.notas.final, reverse=True)
        melhor_id = opcoes[0].id if opcoes else FALLOW_ID

        plano_normal, plano_seco, plano_hoje = self._plan_service.build_3_year_plans(
            opcoes=opcoes,
            anos_secos=anos_secos,
            pousio=self._fallow_scores(crops, nematoide, has_future=bool(deltas)),
            nematoide=nematoide,
            lang=lang,
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
        )

    def _fallow_scores(
        self, crops: list[CropParams], nematoide: bool | None, has_future: bool
    ) -> NotasOpcao:
        """Notas do pousio para o plano de 3 anos: fora do ranking, mas nas combinações (PRD 7.7).

        Segurança 100 (PRD 7.2: não tem o que perder) e futuro 100 quando há CMIP6 (PRD 7.6); renda
        0 (PRD 5) e a nota de solo da tabela 7.4 (0). Iguais no ano normal e no ano seco.
        """
        crop = next((c for c in crops if c.id == FALLOW_ID), None)
        solo = soil_score(crop, nematoide, self._rules.solo) if crop else SCORE_MIN
        futuro = SCORE_MAX if has_future else None
        final = final_score(SCORE_MAX, solo, SCORE_MIN, futuro, self._rules.nota_final)
        return NotasOpcao(
            seguranca=SCORE_MAX, futuro=futuro, solo=solo, renda=SCORE_MIN, final=final
        )

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
    ) -> _Avaliacao:
        anos = self._risk_service.simulate_historical(
            crop=crop, seasons=seasons, semeadura=semeadura, cad_mm=cad_mm
        )
        secos = [r for r in anos if r.ano in set(anos_secos)]
        futuro = self._risk_service.simulate_future_cmip6(
            crop=crop, seasons=seasons, deltas=deltas, semeadura=semeadura, cad_mm=cad_mm
        )
        return _Avaliacao(
            crop=crop,
            nome=nome,
            anos=anos,
            anos_secos=secos,
            futuro=futuro,
            solo=soil_score(crop, nematoide, self._rules.solo),
            margem=expected_margin(crop, anos),
            margem_seco=expected_margin(crop, secos),
        )

    def _build_option(
        self,
        a: _Avaliacao,
        maior_margem: float,
        maior_margem_seco: float,
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
        renda = income_score(a.margem, maior_margem)
        seguranca_seco = _pct(anos_bons_secos, len(a.anos_secos))
        renda_seco = income_score(a.margem_seco, maior_margem_seco)

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
            margem_ha=a.margem,
            rotulo_dinheiro=_label(renda, rotulos.dinheiro_bom, rotulos.dinheiro_medio),
            texto_dinheiro=self._money_text(a.margem, is_en),
            rotulo_terra=_label(a.solo, rotulos.terra_bom, rotulos.terra_medio),
            texto_terra=self._soil_text(a.crop, is_en),
            notas=notas,
            notas_seco=notas_seco,
            porque=self._why(a, total - anos_bons, total, semeadura, solo, fonte_chuva, is_en),
            como_fazer=(
                a.crop.como_fazer_en if (is_en and a.crop.como_fazer_en) else a.crop.como_fazer
            ),
        )

    @staticmethod
    def _money_text(margem: float, is_en: bool) -> str:
        valor = int(round(abs(margem), -1))
        if is_en:
            return (
                f"About R$ {valor:,} per hectare left over"
                if margem >= 0
                else f"Costs about R$ {valor:,} per hectare"
            )
        valor_br = f"{valor:,}".replace(",", ".")
        verbo = "Sobra" if margem >= 0 else "Custa"
        return f"{verbo} perto de R$ {valor_br} por hectare"

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

    @staticmethod
    def _out_of_window_text(crop: CropParams, colheita: str, is_en: bool) -> str:
        limite = crop.semeadura_limite_mes_dia or ""
        mes, _, dia = limite.partition("-")
        if is_en:
            return (
                f"Outside the sowing window for the '{colheita}' harvest (ZARC deadline {limite})."
            )
        return f"Fora da janela de plantio para a colheita '{colheita}' (limite ZARC {dia}/{mes})."
