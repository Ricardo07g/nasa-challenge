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
 * `ano3` na URL): mudar o 2º refaz o 3º; mudar o 3º pede o plano inteiro ao `GET /api/plano`. As notas, a chuva
 * aproveitada, o Plano A/B e o sinal do outono vêm sempre da avaliação do plano que a tela mostra.
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

/** O que fixar no `/api/plano/sugestao`: o 1º ano e, se o produtor mudou, o 2º. */
export function suggestionFixos(choice: CropId, edits: PlanEdits): CropId[] {
  return edits.year2 ? [choice, edits.year2] : [choice]
}

/**
 * Com o 3º ano mudado, nada a sugerir: o plano inteiro vai para o `/api/plano`. O 2º ano é o mudado ou, sem ele,
 * o que a sugestão mostrava (precisa dela carregada). Sem o 3º ano mudado, null: a sugestão já é o plano final.
 */
export function finalCrops(choice: CropId, edits: PlanEdits, base: PlanoAvaliado | null): CropId[] | null {
  if (!edits.year3) return null
  const second = edits.year2 ?? base?.anos[1]?.cultura
  return second ? [choice, second, edits.year3] : null
}

/** Etiqueta do cartão: "Sua escolha" (1º ano), "Nossa sugestão" ou "Você mudou". */
export type PlanTag = 'choice' | 'suggested' | 'changed'

export type PlanCard = {
  /** Ano da colheita da soja (2027 = "Depois da soja 2026/27"). */
  season: number
  crop: CropId
  tag: PlanTag
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
 * Os 3 cartões do plano. As culturas e os números vêm do plano final (com o 3º ano mudado) ou da sugestão; o
 * porquê, só nos anos sugeridos, vem sempre da sugestão. null enquanto a sugestão não chegou.
 */
export function planCards(
  choice: CropId,
  edits: PlanEdits,
  base: PlanoAvaliado | null,
  final: PlanoAvaliado | null,
  firstSeason: number,
): PlanCard[] | null {
  const shown = edits.year3 ? final : base
  if (!base || !shown || shown.anos.length < 3) return null
  return shown.anos.slice(0, 3).map((ano, index) => {
    const tag: PlanTag =
      index === 0 ? 'choice' : (index === 1 ? edits.year2 : edits.year3) ? 'changed' : 'suggested'
    return {
      season: firstSeason + index,
      crop: index === 0 ? choice : ano.cultura,
      tag,
      good: ano.anos_bons,
      total: ano.total_anos,
      sede: ano.sede,
      motivo: tag === 'suggested' ? (base.anos[index]?.motivo ?? null) : null,
      late: ano.fora_do_prazo ?? !ano.na_janela,
    }
  })
}

/** Trocar a cultura de um ano: o 1º muda a escolha (e solta os outros); o 2º solta o 3º; o 3º só ele. */
export function yearFlow<T extends FlowParams>(params: T, index: number, crop: CropId): T {
  if (index === 0) return { ...params, escolha: crop, ano2: undefined, ano3: undefined }
  if (index === 1) return { ...params, ano2: crop, ano3: undefined }
  return { ...params, ano3: crop }
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
