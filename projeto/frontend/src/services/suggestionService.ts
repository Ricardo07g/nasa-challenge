import type { AlertaGeada, ClimaFuturo } from '../models/raioX'
import type {
  AnoDetalhe,
  CropId,
  Eixo,
  EnsoAcerto,
  Objetivo,
  Opcao,
  Recomendacao,
  Sede,
} from '../models/recomendacao'
import {
  alternativeSummary,
  findOption,
  futureSummary,
  harvestYear,
  sortOptions,
  type FutureSummary,
  type LateSummary,
} from './recomendacaoRules'

/**
 * Aba Sugestão (seção 5.4 da remodelagem, tarefa 0044). A ordem das opções e o plano de cada objetivo
 * vêm prontos do motor (`objetivos`); o navegador só escolhe (RNF-02: trocar o objetivo não pede nada à
 * API). Sem o campo (API antiga), reordena pelo eixo como a tela 6 fazia (RF-05).
 */

/** Artigo de cada cultura no Guia (selo de sede, "Passo a passo completo"; seção 8 da remodelagem). */
const CROP_ARTICLE: Record<CropId, string> = {
  milho_safrinha: '/guia/milho-safrinha',
  milho_braquiaria: '/guia/milho-braquiaria',
  sorgo: '/guia/sorgo',
  milheto: '/guia/milheto',
  crotalaria: '/guia/crotalaria',
  pousio: '/guia/terra-parada',
}

export function cropArticle(crop: CropId): string {
  return CROP_ARTICLE[crop]
}

/** Artigos do Guia ligados à aba Sugestão (tabela "Links nas telas" da seção 8). */
export const SUGGESTION_ARTICLES = {
  worked: '/guia/deu-certo',
  water: '/guia/conta-de-agua',
  enso: '/guia/el-nino-la-nina',
  future: '/guia/clima-2041-2060',
  zarc: '/guia/prazo-de-plantio-zarc',
  frost: '/guia/geada-na-safrinha',
} as const

/** Eixo da regra antiga do navegador para cada objetivo (só sem os `objetivos` da API). */
const AXIS_OF: Record<Objetivo, Eixo> = { seguranca: 'chuva', renda: 'renda', terra: 'terra' }

const PERCENT = 100

/** As opções na janela, da melhor para a pior no objetivo (null = equilíbrio, pesos padrão do motor). */
export function rankForObjective(recomendacao: Recomendacao, objetivo: Objetivo | null): Opcao[] {
  const inWindow = recomendacao.opcoes.filter((option) => option.na_janela)
  const ordem = recomendacao.objetivos?.[objetivo ?? 'equilibrio']?.ordem
  if (!ordem) return sortOptions(inWindow, objetivo ? AXIS_OF[objetivo] : null)
  return ordem.flatMap((id) => findOption(inWindow, id) ?? [])
}

/**
 * Aba Comparar (a S5b refaz o conteúdo): as que cabem na janela na ordem do objetivo; as que não cabem vão
 * para o fim, como na tela 6.
 */
export function optionsForObjective(recomendacao: Recomendacao, objetivo: Objetivo | null): { options: Opcao[]; late: LateSummary } {
  const outOfWindow = recomendacao.opcoes.filter((option) => !option.na_janela)
  return {
    options: [...rankForObjective(recomendacao, objetivo), ...outOfWindow],
    late: {
      names: recomendacao.fora_da_janela.map((item) => item.nome),
      texts: recomendacao.fora_da_janela.map((item) => item.texto),
    },
  }
}

/** Sede de cada cultura que tem a linha "Água" (para o selo nos anos do Plano). */
export function thirstByCrop(recomendacao: Recomendacao): Partial<Record<CropId, Sede>> {
  return Object.fromEntries(recomendacao.opcoes.flatMap((option) => (option.agua ? [[option.id, option.agua.sede]] : [])))
}

/** Os 3 anos do plano sugerido para o objetivo (começa pela sugestão); sem o campo, o Plano A. */
export function suggestedPlan(recomendacao: Recomendacao, objetivo: Objetivo | null): CropId[] {
  return recomendacao.objetivos?.[objetivo ?? 'equilibrio']?.plano ?? recomendacao.plano_3_anos.normal.anos
}

export type LateNotice = {
  /** As culturas fora da janela, juntas pela data limite do ZARC (ISO; null sem a data na API). */
  groups: { date: string | null; names: string[] }[]
  count: number
}

/** Colheita tarde: um aviso só, com a lista das culturas que já passaram do prazo; null sem nenhuma. */
export function lateNotice(recomendacao: Recomendacao): LateNotice | null {
  const items = recomendacao.fora_da_janela
  if (items.length === 0) return null
  const groups: LateNotice['groups'] = []
  for (const item of items) {
    const date = item.data_limite ?? null
    const group = groups.find((g) => g.date === date)
    if (group) group.names.push(item.nome)
    else groups.push({ date, names: [item.nome] })
  }
  return { groups, count: items.length }
}

export type YearBar = {
  year: number
  /** Água na fase crítica em % do que a planta precisa (o ISNA do motor). */
  pct: number
  good: boolean
  /** Por que o ano apertou (null quando deu certo). */
  reason: 'agua' | 'calor' | 'ambos' | null
  enso: 'el_nino' | 'la_nina' | null
}

function reasonOf(detail: AnoDetalhe): YearBar['reason'] {
  if (detail.bom) return null
  if (detail.falta_agua && detail.calor) return 'ambos'
  return detail.calor ? 'calor' : 'agua'
}

/** Explorador ano a ano: uma barra por ano e a linha de corte do motor; null sem o ISNA ou o critério. */
export function yearBars(option: Opcao): { bars: YearBar[]; cutPct: number } | null {
  const details = option.anos_detalhe ?? []
  if (!option.criterio || details.length === 0 || details.some((d) => d.isna === undefined)) return null
  return {
    cutPct: Math.round(option.criterio.isna_min * PERCENT),
    bars: details.map((detail) => ({
      year: detail.ano,
      pct: Math.round((detail.isna ?? 0) * PERCENT),
      good: detail.bom,
      reason: reasonOf(detail),
      enso: detail.enso,
    })),
  }
}

/** O ano tocado no explorador, se está na série da opção. */
export function selectedYear(option: Opcao, year: number | null): AnoDetalhe | null {
  if (year === null) return null
  return option.anos_detalhe?.find((detail) => detail.ano === year) ?? null
}

/** El Niño / La Niña: só as fases em que a diferença para os outros anos é clara (critério do motor). */
export function clearEnsoNotes(option: Opcao): EnsoAcerto[] {
  return (option.enso_acerto ?? []).filter((item) => item.clara)
}

export type Suggestion = {
  /** Ano da soja que vem antes da entressafra. */
  year: number
  /** A melhor opção para o objetivo: o ano 1 do plano. */
  best: Opcao
  plan: { year: number; crop: CropId }[]
  future: FutureSummary | null
  /** O mesmo clima 2041–2060 do cartão do raio-X (tarefa 0049). */
  climate: ClimaFuturo | null
  late: LateNotice | null
  /** O alerta de geada do raio-X: só vem quando algum ano teve geada. */
  frost: AlertaGeada | null
  alternatives: { motivo: Recomendacao['alternativas'][number]['motivo']; option: Opcao; text: string }[]
}

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

/** Aba Sugestão: a melhor opção do objetivo como ano 1 do plano; null sem opção na janela. */
export function buildSuggestion(recomendacao: Recomendacao, objetivo: Objetivo | null): Suggestion | null {
  const [best] = rankForObjective(recomendacao, objetivo)
  if (!best) return null
  const year = harvestYear(recomendacao.entrada.semeadura)
  return {
    year,
    best,
    plan: suggestedPlan(recomendacao, objetivo).map((crop, index) => ({ year: year + index, crop })),
    future: futureSummary(best),
    climate: recomendacao.clima_futuro ?? null,
    late: lateNotice(recomendacao),
    frost: recomendacao.geada ?? null,
    alternatives: recomendacao.alternativas.flatMap(({ motivo, opcao }) => {
      const option = findOption(recomendacao.opcoes, opcao)
      return option && option.id !== best.id
        ? [{ motivo, option, text: alternativeSummary(motivo, option).map(sentence).join(' ') }]
        : []
    }),
  }
}
