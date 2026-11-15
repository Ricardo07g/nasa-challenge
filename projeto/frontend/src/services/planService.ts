import type { Lang } from '../i18n/language'
import type { PlanoAvaliado, PlanoParams } from '../models/plano'
import type { CropId, Objetivo, Recomendacao, SinalOutono } from '../models/recomendacao'
import type { Confirmadas, Historico, SituacaoAno } from '../models/talhao'
import { planoRepository as defaultRepository } from '../repositories'
import type { PlanoRepository } from '../repositories/planoRepository'
import { applyConfirmations } from './confirmedSeasonsService'
import { PLAN_YEARS, type TodayAnswers } from './cropListParams'
import { rankForObjective, suggestedPlan } from './suggestionService'

/**
 * Aba "Plano de 3 anos" (seção 5.6 da remodelagem, tarefa 0045). O produtor troca a cultura de cada ano e
 * as notas recalculam na hora pelo `GET /api/plano` (as contas ficam no backend: segurança climática, saúde
 * da terra, clima 2041–2060, chuva aproveitada e Plano A/B). Aqui só as escolhas: as culturas de cada ano,
 * o plano da URL contra o sugerido e o "Como é hoje" com o NDVI e a resposta do produtor.
 */

const FALLOW: CropId = 'pousio'

/** Artigos do Guia da aba (tabela "Links nas telas" da seção 8): título, chuva aproveitada e Plano B. */
export const PLAN_ARTICLES = {
  rotation: '/guia/rotacao-de-culturas',
  water: '/guia/conta-de-agua',
  dry: '/guia/veranico',
} as const

/** As culturas de cada ano: as que cabem na janela, na ordem do objetivo, e o "Deixar parado". */
export function planChoices(recomendacao: Recomendacao, objetivo: Objetivo | null): CropId[] {
  return [...rankForObjective(recomendacao, objetivo).map((option) => option.id), FALLOW]
}

/** O plano da tela: o da URL (se todas as culturas cabem na janela) ou o sugerido do objetivo. */
export function currentPlan(
  recomendacao: Recomendacao,
  objetivo: Objetivo | null,
  fromUrl: readonly CropId[] | undefined,
): { years: CropId[]; suggested: CropId[]; edited: boolean } {
  const suggested = suggestedPlan(recomendacao, objetivo)
  const choices = planChoices(recomendacao, objetivo)
  const valid = fromUrl?.length === PLAN_YEARS && fromUrl.every((crop) => choices.includes(crop))
  const years = valid ? [...fromUrl] : [...suggested]
  return { years, suggested: [...suggested], edited: years.some((crop, index) => crop !== suggested[index]) }
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

/** Troca a cultura de um ano (0, 1 ou 2). */
export function withYearCrop(plan: readonly CropId[], index: number, crop: CropId): CropId[] {
  return plan.map((current, i) => (i === index ? crop : current))
}

/** "Usar no meu plano" (aba Comparar): a cultura vai para o ano 1; os anos 2 e 3 ficam. */
export function planStartingWith(plan: readonly CropId[], crop: CropId): CropId[] {
  return withYearCrop(plan, 0, crop)
}

/** O que o satélite viu na entressafra (sem dado = null: aí a tela pergunta direto). */
export type SeenSeason = Exclude<SituacaoAno, 'sem_dado'>

export type TodayRow = {
  year: number
  seen: SeenSeason | null
  /** Maior NDVI da janela (MODIS); null sem leitura. */
  ndvi: number | null
  /** A situação veio da confirmação do produtor na tela 4. */
  byProducer: boolean
  /** A resposta do "O que foi?". */
  answer: CropId | null
  /** O que vale para o "Como é hoje": a resposta ou, com a terra parada, o "Deixar parado". */
  value: CropId | null
}

/**
 * Uma linha por safra confirmável (`anos_confirmaveis` do talhão), com o NDVI e as safras confirmadas na
 * tela 4 no lugar do satélite. O satélite mostra se plantou, não o quê: o produtor responde "O que foi?".
 */
export function todayRows(
  historico: Historico | null,
  anosConfirmaveis: readonly number[] | null | undefined,
  confirmadas: Confirmadas,
  answers: TodayAnswers,
): TodayRow[] {
  const seen = applyConfirmations(historico, confirmadas)
  return (anosConfirmaveis ?? []).map((year) => {
    const ano = seen?.anos.find((item) => item.ano === year)
    const situacao = ano && ano.situacao !== 'sem_dado' ? ano.situacao : null
    const answer = answers[year] ?? null
    return {
      year,
      seen: situacao,
      ndvi: ano?.ndvi_max ?? null,
      byProducer: ano?.fonte_ano === 'produtor',
      answer,
      value: answer ?? (situacao === 'parado' ? FALLOW : null),
    }
  })
}

/** "Como é hoje": as 3 últimas safras, se todas são conhecidas; senão, a sequência de referência do motor. */
export function todayPlan(rows: readonly TodayRow[], recomendacao: Recomendacao): { crops: CropId[]; reference: boolean } {
  const values = rows.map((row) => row.value)
  if (rows.length === PLAN_YEARS && values.every((value): value is CropId => value !== null)) {
    return { crops: values, reference: false }
  }
  return { crops: [...recomendacao.plano_3_anos.hoje.anos], reference: true }
}

/** Marca a resposta do ano; `null` (tocar de novo na marcada) tira a resposta. */
export function withTodayAnswer(answers: TodayAnswers, year: number, crop: CropId | null): TodayAnswers {
  const next: Partial<Record<number, CropId>> = { ...answers }
  if (crop === null) delete next[year]
  else next[year] = crop
  return next
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
}

/** Pede a avaliação do plano, com cache em memória (voltar a um plano já visto não pede de novo). */
export function createPlanService(repository: PlanoRepository = defaultRepository): PlanService {
  const cache = new Map<string, Promise<PlanoAvaliado>>()
  return {
    evaluate(params, lang) {
      const key = `${params.lat},${params.lon},${params.colheita},${params.solo ?? ''},${params.anos.join(',')}:${lang}`
      const hit = cache.get(key)
      if (hit) return hit
      const promise = repository.get(params, lang).catch((error: unknown) => {
        cache.delete(key)
        throw error
      })
      cache.set(key, promise)
      return promise
    },
  }
}

export const planService = createPlanService()
