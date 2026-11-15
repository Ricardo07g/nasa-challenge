import type { GuideSlug } from '../content/guia/slugs'
import type { Lang } from '../i18n/language'
import type { PlanoAB, PlanoAvaliado, PlanoParams, PlanoSugestaoParams } from '../models/plano'
import type { CropId, Recomendacao, Sede, SinalOutono } from '../models/recomendacao'
import type { SeasonAnswers } from '../models/seasonAnswers'
import { planoRepository as defaultRepository } from '../repositories'
import type { PlanoRepository } from '../repositories/planoRepository'
import type { FlowParams } from './flowParams'
import { todayCrops } from './seasonAnswersService'
import { LAST_SEASONS } from './seasonService'

/**
 * Aba "2. Plano de 3 anos" da tela 5 (pacote 2, tarefa 0056 do backend). O 1º ano é a escolha da aba 1; os
 * outros dois vêm da sugestão em cadeia do motor (`GET /api/plano/sugestao`), que considera o ano anterior
 * (rotação, nematoide, terra parada, prazo) e escreve o porquê. O produtor pode mudar o 2º ou o 3º ano (`ano2`,
 * `ano3` na URL): mudar o 2º refaz o 3º; mudar o 3º pede o plano inteiro ao `GET /api/plano`. A nossa sugestão de
 * cada ano fica sempre à vista (`suggestedFor`, pacote 3, tarefa 0064): "Você mudou" só quando o ano é outra
 * cultura, e escolher de novo a sugestão tira o ano da URL. As notas, a chuva aproveitada, o Plano A/B e o sinal do
 * outono vêm sempre da avaliação do plano que a tela mostra.
 */

/** Artigos do Guia da aba: rotação, a conta de água e o veranico (a seca). */
export const PLAN_ARTICLES = {
  rotation: 'rotacao-de-culturas',
  water: 'conta-de-agua',
  dry: 'veranico',
} as const satisfies Record<string, GuideSlug>

export type PlanEdits = { year2: CropId | null; year3: CropId | null }

/** Os anos que o produtor mudou (o 1º ano é sempre a escolha). */
export function planEdits(params: Pick<FlowParams, 'ano2' | 'ano3'>): PlanEdits {
  return { year2: params.ano2 ?? null, year3: params.ano3 ?? null }
}

/**
 * O que fixar no `/api/plano/sugestao` do plano que a tela mostra: o 1º ano e, se o produtor mudou o 2º para outra
 * cultura que não a sugestão dele (`second`, quando já se sabe), o 2º.
 */
export function suggestionFixos(choice: CropId, edits: PlanEdits, second: CropId | null = null): CropId[] {
  return edits.year2 && edits.year2 !== second ? [choice, edits.year2] : [choice]
}

/**
 * Com o 3º ano mudado, nada a sugerir: o plano inteiro vai para o `/api/plano`. O 2º ano é o mudado ou, sem ele,
 * o que a sugestão com o 1º ano fixo mostrava (precisa dela carregada). Sem o 3º ano mudado, null: a sugestão já é
 * o plano final.
 */
export function finalCrops(choice: CropId, edits: PlanEdits, fromChoice: PlanoAvaliado | null): CropId[] | null {
  if (!edits.year3) return null
  const second = edits.year2 ?? fromChoice?.anos[1]?.cultura
  return second ? [choice, second, edits.year3] : null
}

/** As respostas do motor que a aba usa para montar os cartões e saber a sugestão de cada ano. */
export type PlanSources = {
  /** O 1º ano: a escolha da aba 1. */
  choice: CropId
  /** A sugestão da aba Escolher (`suggestionOf`): a sugestão do 1º ano. */
  suggestion: CropId
  edits: PlanEdits
  /** `/api/plano/sugestao?fixos=<1º ano>`: a sugestão do 2º ano e, com o 2º sugerido, a do 3º. */
  fromChoice: PlanoAvaliado | null
  /** `/api/plano/sugestao?fixos=<1º ano>,<2º ano>`: com o 2º ano mudado para outra cultura, a sugestão do 3º. */
  fromYear2: PlanoAvaliado | null
  /** `/api/plano` do plano inteiro, com o 3º ano mudado. */
  final: PlanoAvaliado | null
}

/** A nossa sugestão para um ano: a cultura e o "Por quê:" do motor (null no 1º ano, que é a sugestão da aba 1). */
export type YearSuggestion = { crop: CropId; motivo: string | null }

/** A resposta só vale se é do plano pedido agora (o `useAsync` guarda a anterior enquanto a nova carrega). */
function answerFor(answer: PlanoAvaliado | null, fixed: readonly CropId[]): PlanoAvaliado | null {
  return answer && fixed.every((crop, index) => answer.anos[index]?.cultura === crop) ? answer : null
}

function suggestionAt(answer: PlanoAvaliado | null, index: number): YearSuggestion | null {
  const year = answer?.anos[index]
  return year ? { crop: year.cultura, motivo: year.motivo ?? null } : null
}

/**
 * A nossa sugestão de cada ano (uma regra só para a etiqueta, o select e a linha "Nossa sugestão"):
 * - 1º ano: a sugestão da aba Escolher;
 * - 2º ano: o `anos[1]` da sugestão com o 1º ano fixo;
 * - 3º ano: com o 2º ano sugerido, o `anos[2]` dessa mesma resposta; com o 2º mudado, o `anos[2]` da sugestão com
 *   os dois fixos.
 * O porquê vem da mesma resposta. null enquanto ela não chegou (ou ainda é a de um pedido anterior).
 */
export function suggestedFor(index: number, sources: PlanSources): YearSuggestion | null {
  if (index === 0) return { crop: sources.suggestion, motivo: null }
  const fromChoice = answerFor(sources.fromChoice, [sources.choice])
  if (index === 1) return suggestionAt(fromChoice, 1)
  const second = fromChoice?.anos[1]?.cultura
  if (!second) return null
  const year2 = sources.edits.year2
  if (!year2 || year2 === second) return suggestionAt(fromChoice, 2)
  return suggestionAt(answerFor(sources.fromYear2, [sources.choice, year2]), 2)
}

/** Etiqueta do cartão: "Sua escolha" (1º ano), "Nossa sugestão" ou "Você mudou". */
export type PlanTag = 'choice' | 'suggested' | 'changed'

export type PlanCard = {
  /** Ano da colheita da soja (2027 = "Depois da soja 2026/27"). */
  season: number
  crop: CropId
  tag: PlanTag
  /** A nossa sugestão para o ano (no select e na linha "Nossa sugestão"); null enquanto ela carrega. */
  suggested: YearSuggestion | null
  /** Deu certo em `good` de `total` anos; null no pousio. */
  good: number | null
  total: number | null
  sede: Sede | null
  /** "Por quê:" do ano sugerido (frase do motor, sem o nome da cultura); null nos anos escolhidos. */
  motivo: string | null
  /** A cultura passou do prazo do ZARC. */
  late: boolean
}

/**
 * Os 3 cartões do plano. As culturas e os números vêm do plano que a tela mostra: o final (com o 3º ano mudado; enquanto
 * ele carrega, o sugerido), a sugestão com os dois anos fixos (com o 2º mudado) ou a sugestão com o 1º ano fixo. "Você mudou" só quando a
 * cultura do ano é diferente da sugestão dele (sem a sugestão ainda, vale a URL); o porquê, só nos anos sugeridos.
 * null enquanto o plano não chegou.
 */
export function planCards(sources: PlanSources, firstSeason: number): PlanCard[] | null {
  const { choice, edits } = sources
  const second = suggestedFor(1, sources)?.crop ?? null
  const suggestedPlan = suggestionFixos(choice, edits, second).length > 1 ? sources.fromYear2 : sources.fromChoice
  // Com o 3º ano mudado, enquanto o plano final carrega, ficam os cartões da sugestão (a tela não pisca).
  const shown = (edits.year3 ? sources.final : null) ?? suggestedPlan
  if (!shown || shown.anos.length < 3) return null
  return shown.anos.slice(0, 3).map((ano, index) => {
    const crop = index === 0 ? choice : ano.cultura
    const suggested = suggestedFor(index, sources)
    const edited = index === 1 ? edits.year2 : index === 2 ? edits.year3 : null
    const tag: PlanTag = index === 0 ? 'choice' : (suggested ? crop !== suggested.crop : Boolean(edited)) ? 'changed' : 'suggested'
    return {
      season: firstSeason + index,
      crop,
      tag,
      suggested,
      good: ano.anos_bons,
      total: ano.total_anos,
      sede: ano.sede,
      motivo: tag === 'suggested' ? (suggested?.motivo ?? ano.motivo ?? null) : null,
      late: ano.fora_do_prazo ?? !ano.na_janela,
    }
  })
}

/** O plano foi mudado (alerta e "Voltar ao plano sugerido"): algum ano diz "Você mudou"; sem cartões, a URL. */
export function planEdited(cards: readonly PlanCard[] | null, edits: PlanEdits): boolean {
  return cards ? cards.some((card) => card.tag === 'changed') : Boolean(edits.year2 || edits.year3)
}

/**
 * Trocar a cultura de um ano: o 1º muda a escolha (e solta os outros); o 2º solta o 3º; o 3º só ele. Escolher de
 * novo a sugestão do ano (`suggested`) tira o ano da URL, para ele voltar a ser sugerido de verdade.
 */
export function yearFlow<T extends FlowParams>(params: T, index: number, crop: CropId, suggested: CropId | null = null): T {
  if (index === 0) return { ...params, escolha: crop, ano2: undefined, ano3: undefined }
  const value = crop === suggested ? undefined : crop
  if (index === 1) return { ...params, ano2: value, ano3: undefined }
  return { ...params, ano3: value }
}

/** "Voltar ao plano sugerido": a escolha fica, os anos 2 e 3 voltam para a sugestão em cadeia. */
export function resetPlanFlow<T extends FlowParams>(params: T): T {
  return { ...params, ano2: undefined, ano3: undefined }
}

export type TodayState =
  | { kind: 'crops'; crops: CropId[] }
  /** Respondeu "Não plantei" (sem soja) nessas safras: não dá para comparar, mas não é resposta que faltou. */
  | { kind: 'noSoy'; seasons: number[] }
  /** Faltou resposta (ou só "Plantei", sem dizer o quê): "não preenchido", com o aviso e o "Preencher agora". */
  | { kind: 'missing' }

/** "Como é hoje" das notas do plano: as culturas das 3 últimas safras, sem soja numa delas, ou não preenchido. */
export function todayState(answers: SeasonAnswers, years: readonly number[] = LAST_SEASONS): TodayState {
  const crops = todayCrops(answers, years)
  if (crops) return { kind: 'crops', crops }
  const noSoy = years.filter((year) => answers[year] === 'sem_soja')
  return noSoy.length ? { kind: 'noSoy', seasons: noSoy } : { kind: 'missing' }
}

/**
 * O `sinal.motivo` do motor tem duas frases: a previsão do El Niño / La Niña e como a cultura do 1º ano (e a do
 * Plano B) se saiu nos anos daquela fase. A tela mostra a 1ª em destaque e a 2ª no texto.
 */
export function signalParts(motivo: string): { forecast: string; history: string | null } {
  const match = /^(.*?\)\.)\s+(.+)$/.exec(motivo.trim())
  return match ? { forecast: match[1], history: match[2] } : { forecast: motivo.trim(), history: null }
}

export type PlanBState =
  | { kind: 'b'; crop: CropId; name: string; good: number | null; fails: number }
  | { kind: 'notNeeded'; reason: 'pousio' | 'nunca_falhou' }
  | { kind: 'none' }

/** O Plano B do motor: a cultura que mais deu certo nos anos em que a do Plano A falhou (nunca uma fixa). */
export function planBState(ab: PlanoAB): PlanBState {
  if (ab.cultura_b && ab.nome_b) {
    return { kind: 'b', crop: ab.cultura_b, name: ab.nome_b, good: ab.b_bons_nas_falhas, fails: ab.falhas_a }
  }
  if (ab.motivo === 'pousio' || ab.motivo === 'nunca_falhou') return { kind: 'notNeeded', reason: ab.motivo }
  return { kind: 'none' }
}

export type RainRow = { season: number; crop: CropId; mm: number }

/** "Chuva aproveitada": a chuva que cai com a terra parada e o que a lavoura usa em cada ano (pousio = 0). */
export function rainRows(evaluation: PlanoAvaliado, firstSeason: number): { rain: number; rows: RainRow[] } | null {
  if (!evaluation.chuva) return null
  return {
    rain: evaluation.chuva.chuva_mm,
    rows: evaluation.anos.map((ano, index) => ({
      season: firstSeason + index,
      crop: ano.cultura,
      mm: ano.cultura === 'pousio' ? 0 : (ano.usa_mm ?? 0),
    })),
  }
}

/**
 * Sinal do outono da tela (tarefa 0049): o da avaliação do plano (o Plano A e o Plano B que a tela mostra).
 * Sem o campo (API antiga) ou enquanto a avaliação carrega, o da recomendação, mas só no plano sugerido:
 * com o plano editado, o sinal da recomendação falaria de outro Plano A.
 */
export function planSignal(
  evaluation: Pick<PlanoAvaliado, 'sinal'> | null,
  recomendacao: Recomendacao | null,
  edited: boolean,
): SinalOutono | null {
  if (evaluation && evaluation.sinal !== undefined) return evaluation.sinal
  return edited ? null : (recomendacao?.sinal ?? null)
}

const RAIN_SOURCE_NAMES: Record<string, string> = { gpm_imerg: 'GPM IMERG', nasa_power: 'NASA POWER' }

/** Nome das fontes da chuva da série (`gpm_imerg+nasa_power` → "GPM IMERG + NASA POWER"), para citar a fonte certa. */
export function rainSourceName(fonte: string): string {
  return fonte
    .split('+')
    .map((key) => RAIN_SOURCE_NAMES[key] ?? key)
    .join(' + ')
}

export type PlanService = {
  evaluate(params: PlanoParams, lang: Lang): Promise<PlanoAvaliado>
  suggest(params: PlanoSugestaoParams, lang: Lang): Promise<PlanoAvaliado>
}

/** Pede a avaliação e a sugestão em cadeia, com cache em memória (voltar a um plano já visto não pede de novo). */
export function createPlanService(repository: PlanoRepository = defaultRepository): PlanService {
  const cache = new Map<string, Promise<PlanoAvaliado>>()
  function cached(key: string, load: () => Promise<PlanoAvaliado>): Promise<PlanoAvaliado> {
    const hit = cache.get(key)
    if (hit) return hit
    const promise = load().catch((error: unknown) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, promise)
    return promise
  }
  const place = (params: { lat: number; lon: number; colheita: string; solo?: string }) =>
    `${params.lat},${params.lon},${params.colheita},${params.solo ?? ''}`
  return {
    evaluate: (params, lang) => cached(`plano:${place(params)}:${params.anos.join(',')}:${lang}`, () => repository.get(params, lang)),
    suggest: (params, lang) =>
      cached(`sugestao:${place(params)}:${params.fixos.join(',')}:${lang}`, () => repository.suggest(params, lang)),
  }
}

export const planService = createPlanService()
