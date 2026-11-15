import type { PlanoAB, PlanoAvaliado } from '../models/plano'
import type { AlertaChuvaForte, AlertaFogo, RaioX } from '../models/raioX'
import type { CropId, Opcao, SinalOutono } from '../models/recomendacao'
import type { SeasonAnswer, SeasonAnswers, SeasonRow } from '../models/seasonAnswers'
import type { Colheita } from '../models/talhao'
import { isLate } from './choiceService'
import { bandDate, harvestDateWindow } from './harvestService'
import { planBState, signalParts, type PlanBState } from './planService'
import { CURRENT_SEASON } from './seasonService'

/**
 * Tela 6 "Seu planejamento" (`/planejamento`, pacote 3): as regras que montam a linha do tempo "O que fazer
 * agora", os alertas da área, a tabela "Deu certo em quantos anos", as últimas safras e o "Como o plano ajuda a
 * ganhar" do relatório. Tudo sai do plano da tela 5 (o mesmo `usePlanFlow`), do `/recomendacao` (prazo do ZARC,
 * ciclo, critério e se dá grão), do `/api/plano` (Plano A/B, sinal, palhada, nitrogênio e nematoide) e do
 * `/raio-x` (chuva forte e fogo). Nenhum número novo: o front só junta as datas.
 */

/** "AAAA-MM-DD" + n dias (n pode ser negativo), sem depender do fuso do navegador. */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * O dia da colheita da soja: a data escolhida na tela 2 (`data`) ou, só com a época (`colheita`), o dia da época
 * no motor (`bandDate`, a colheita que a semeadura do backend usa).
 */
export function harvestDay(data: string | null | undefined, band: Colheita, season: number = CURRENT_SEASON): string {
  return data ?? bandDate(band, harvestDateWindow(season))
}

/**
 * O dia de plantar a cultura do 1º ano: logo depois de colher (a data da tela 2) ou, sem ela, a semeadura do
 * motor (`entrada.semeadura` do `/recomendacao`). É o mesmo "Plantando em" da tela 5.
 */
export function sowingDay(data: string | null | undefined, semeadura: string): string {
  return data ?? semeadura
}

export type TimelineStep =
  /** Agora: cuide da soja e fique de olho nos avisos (de hoje até a colheita). */
  | { kind: 'now'; from: string; to: string }
  /** Fevereiro do ano da colheita: o sinal do outono (a previsão da NOAA) e o Plano B do motor. */
  | {
      kind: 'signal'
      year: number
      /** A frase da previsão (fase e %), a 1ª do `sinal.motivo`; null sem a previsão. */
      forecast: string | null
      planA: CropId
      /** O Plano B do motor (`plano_ab`); null sem ele. */
      planB: PlanBState | null
      /** A etiqueta "Plano B: X"; null sem Plano B ou quando o 1º ano já é o Plano B. */
      tag: CropId | null
    }
  /** A colheita da soja. */
  | { kind: 'harvest'; date: string }
  /**
   * Plantar a cultura do 1º ano até o prazo (`late` = passou do prazo). `zarc` = o prazo vem do ZARC; `false` na
   * cultura sem ZARC (a crotalária, tarefa 0066 do backend), em que a data é sugestão do app.
   */
  | { kind: 'plant'; crop: CropId; sowing: string; deadline: string | null; late: boolean; zarc: boolean }
  /**
   * A fase em que a planta mais precisa de água, pelo critério do motor: na floração, os dias até a floração com a
   * janela antes e depois; no pegamento (as coberturas), do plantio até o fim da janela.
   */
  | {
      kind: 'water'
      crop: CropId
      phase: 'floracao' | 'pegamento'
      from: string
      to: string
      flowerDays: number
      windowDays: number
    }
  /** O fim do ciclo: colher (se dá grão) ou só deixar a palha no chão (as coberturas). */
  | { kind: 'cropHarvest'; crop: CropId; grain: boolean; date: string }
  /**
   * Out–nov: a próxima soja e, depois dela, a cultura do 2º ano, com o prazo do ZARC dela (`deadline`, tarefa 0065;
   * null sem ele) e `late` quando ela passou do prazo.
   */
  | { kind: 'next'; year: number; crop: CropId | null; deadline: string | null; late: boolean; zarc: boolean }

export type TimelineInput = {
  /** Hoje (ISO). */
  today: string
  /** O dia da colheita da soja (`harvestDay`). */
  harvest: string
  /** O dia de plantar (`sowingDay`). */
  sowing: string
  /** Ano da colheita da safra atual (2027 = safra 2026/27). */
  season: number
  firstCrop: CropId
  /** A opção do motor da cultura do 1º ano (prazo, ciclo, critério, grão); null no pousio. */
  first: Opcao | null
  secondCrop: CropId | null
  /** O prazo do ZARC do 2º ano (`data_limite` do /api/plano) e se ele passou do prazo. */
  secondDeadline?: string | null
  secondLate?: boolean
  /** O prazo do 2º ano vem do ZARC (`prazo_zarc` da opção; tarefa 0066 do backend). Sem o dado, vem. */
  secondZarc?: boolean
  signal: SinalOutono | null
  planAB: PlanoAB | null
}

/** "O que fazer agora": os passos do fim desta soja até a próxima safra, montados por regra. */
export function planTimeline(input: TimelineInput): TimelineStep[] {
  const { first, firstCrop, sowing } = input
  const planB = input.planAB ? planBState(input.planAB) : null
  const steps: TimelineStep[] = [
    { kind: 'now', from: input.today, to: input.harvest },
    {
      kind: 'signal',
      year: input.season,
      forecast: input.signal ? signalParts(input.signal.motivo).forecast : null,
      planA: firstCrop,
      planB,
      tag: planB?.kind === 'b' && planB.crop !== firstCrop ? planB.crop : null,
    },
    { kind: 'harvest', date: input.harvest },
  ]
  if (first) {
    steps.push({
      kind: 'plant',
      crop: firstCrop,
      sowing,
      deadline: first.data_limite,
      late: isLate(first),
      zarc: first.prazo_zarc !== false,
    })
    if (first.ciclo) {
      const windowDays = first.criterio?.janela_dias ?? 0
      if (first.criterio?.fase === 'pegamento') {
        steps.push({
          kind: 'water',
          crop: firstCrop,
          phase: 'pegamento',
          from: sowing,
          to: addDays(sowing, windowDays),
          flowerDays: first.ciclo.floracao_dias,
          windowDays,
        })
      } else {
        const flower = addDays(sowing, first.ciclo.floracao_dias)
        steps.push({
          kind: 'water',
          crop: firstCrop,
          phase: 'floracao',
          from: addDays(flower, -windowDays),
          to: addDays(flower, windowDays),
          flowerDays: first.ciclo.floracao_dias,
          windowDays,
        })
      }
      steps.push({ kind: 'cropHarvest', crop: firstCrop, grain: first.renda.da_grao, date: addDays(sowing, first.ciclo.dias) })
    }
  }
  steps.push({
    kind: 'next',
    year: input.season,
    crop: input.secondCrop,
    deadline: input.secondDeadline ?? null,
    late: input.secondLate ?? false,
    zarc: input.secondZarc ?? true,
  })
  return steps
}

export type PlanningAlert =
  /** Agora: a previsão da NOAA para o outono (a 1ª frase do `sinal`). */
  | { kind: 'now'; forecast: string; source: string; date: string }
  /** Chuva forte em fevereiro e março (GPM IMERG), do raio-X. */
  | { kind: 'heavyRain'; data: AlertaChuvaForte }
  /** Fogo perto do ponto (MODIS), do raio-X. */
  | { kind: 'fire'; data: AlertaFogo }

/** "Alertas da sua área": até 3 (Agora, chuva forte e fogo), cada um só com dado para o ponto. */
export function planningAlerts(signal: SinalOutono | null, raio: RaioX | null): PlanningAlert[] {
  const alerts: PlanningAlert[] = []
  if (signal) {
    alerts.push({ kind: 'now', forecast: signalParts(signal.motivo).forecast, source: signal.fonte[0] ?? 'NOAA', date: signal.data })
  }
  if (raio?.alertas.chuva_forte) alerts.push({ kind: 'heavyRain', data: raio.alertas.chuva_forte })
  if (raio?.alertas.fogo) alerts.push({ kind: 'fire', data: raio.alertas.fogo })
  return alerts
}

export type PastFutureRow = {
  season: number
  crop: CropId
  /** Deu certo em 2005–2024; null no pousio. */
  good: number | null
  /** 2041–2060, média dos modelos; null sem o CMIP6 ou no pousio. */
  future: number | null
  total: number | null
}

/** "Deu certo em quantos anos": uma linha por ano do plano, com os números do motor. */
export function pastFutureRows(evaluation: PlanoAvaliado, firstSeason: number): PastFutureRow[] {
  return evaluation.anos.slice(0, 3).map((ano, index) => ({
    season: firstSeason + index,
    crop: ano.cultura,
    good: ano.anos_bons,
    future: ano.futuro_anos_bons,
    total: ano.total_anos,
  }))
}

export type PlanGain = {
  /** As culturas que dão grão para vender e as safras em que entram. */
  income: { crop: CropId; seasons: number[] }[]
  /** As coberturas (não dão grão) e o que devolvem para a terra e para a soja seguinte (do motor). */
  covers: { crop: CropId; season: number; straw: boolean; nitrogen: boolean; nematode: boolean }[]
  /** O Plano B do motor para o 1º ano; null sem ele. */
  planB: { from: CropId; to: CropId } | null
}

/**
 * "Como o plano ajuda a ganhar" (relatório): quais anos dão renda (a cultura dá grão, `renda.da_grao`), o que
 * as coberturas devolvem (palhada, nitrogênio e nematoide, os fatos do `/api/plano`) e o Plano B. `grainOf`
 * devolve null quando não se sabe (a cultura não veio no `/recomendacao`): ela fica de fora.
 */
export function planGain(evaluation: PlanoAvaliado, grainOf: (crop: CropId) => boolean | null, firstSeason: number): PlanGain {
  const income: PlanGain['income'] = []
  const covers: PlanGain['covers'] = []
  evaluation.anos.slice(0, 3).forEach((ano, index) => {
    const season = firstSeason + index
    if (ano.cultura === 'pousio') return
    const grain = grainOf(ano.cultura)
    if (grain === true) {
      const found = income.find((item) => item.crop === ano.cultura)
      if (found) found.seasons.push(season)
      else income.push({ crop: ano.cultura, seasons: [season] })
    } else if (grain === false && (ano.cobre_terra || ano.deixa_nitrogenio || ano.quebra_nematoide)) {
      covers.push({ crop: ano.cultura, season, straw: ano.cobre_terra, nitrogen: ano.deixa_nitrogenio, nematode: ano.quebra_nematoide })
    }
  })
  const b = evaluation.plano_ab ? planBState(evaluation.plano_ab) : null
  return {
    income,
    covers,
    planB: b?.kind === 'b' && evaluation.plano_ab ? { from: evaluation.plano_ab.cultura_a, to: b.crop } : null,
  }
}

export type LastSeason =
  | { year: number; kind: 'answer'; answer: SeasonAnswer }
  | { year: number; kind: 'satellite'; seen: 'plantou' | 'parado' | 'sem_soja' }
  | { year: number; kind: 'missing' }

/**
 * "Últimas safras" do relatório: o que foi feito depois da soja em cada uma das 3 últimas safras, pela resposta
 * do produtor ou, sem ela, pelo que o satélite viu. Sem os dois (ou com o satélite sem certeza), "não preenchido".
 */
export function lastSeasons(answers: SeasonAnswers, rows: readonly SeasonRow[]): LastSeason[] {
  return rows.map(({ year, satellite }): LastSeason => {
    const answer = answers[year]
    if (answer !== undefined) return { year, kind: 'answer', answer }
    if (satellite && !satellite.soy) return { year, kind: 'satellite', seen: 'sem_soja' }
    if (satellite?.after) return { year, kind: 'satellite', seen: satellite.after }
    return { year, kind: 'missing' }
  })
}
