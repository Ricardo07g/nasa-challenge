import type { Opcao } from '../models/recomendacao'
import type { SituacaoAno, Talhao, Textura } from '../models/talhao'

export type HistorySummary = {
  idle: number
  planted: number
  /** Anos em que o satélite não teve certeza (`incerto` + `sem_dado`). */
  uncertain: number
  /** Anos em que o satélite não viu a soja (`sem_soja`): à parte, com legenda própria. */
  noSoy: number
  /** Anos que o produtor confirmou (valem no lugar do satélite). */
  confirmed: number
  /** Anos certos (parado + plantou): a frase do cartão conta só esses. */
  known: number
  total: number
  situations: SituacaoAno[]
  years: string[]
  /** Meses olhados em cada ano (1 = janeiro), para a linha da fonte embaixo da faixa. */
  window: { from: number; to: number }
}

/** Janela do guia do NDVI (1º de abril a 31 de julho), para quando a API não manda a dela. */
const DEFAULT_WINDOW = { from: 4, to: 7 }

function historyWindow(janela: string | undefined): HistorySummary['window'] {
  const match = /^(\d{2})-\d{2} a (\d{2})-\d{2}$/.exec(janela ?? '')
  return match ? { from: Number(match[1]), to: Number(match[2]) } : DEFAULT_WINDOW
}

/**
 * Tela 4, cartão 1: o que cresceu depois da soja, ano a ano (NDVI do MODIS). A frase conta só os anos
 * certos ("parada em 5 de 9 anos (1 sem certeza)"); o ano sem soja fica à parte. As contas saem dos
 * próprios anos da faixa, para a frase nunca discordar dos quadrinhos. Sem dado, ou sem nenhum ano
 * certo, o cartão some.
 */
export function historySummary(historico: Talhao['historico']): HistorySummary | null {
  if (!historico) return null
  const count = (...which: SituacaoAno[]) => historico.anos.filter((ano) => which.includes(ano.situacao)).length
  const idle = count('parado')
  const planted = count('plantou')
  const known = idle + planted
  if (known === 0) return null
  return {
    idle,
    planted,
    uncertain: count('incerto', 'sem_dado'),
    noSoy: count('sem_soja'),
    confirmed: historico.anos.filter((ano) => ano.fonte_ano === 'produtor').length,
    known,
    total: historico.anos.length,
    situations: historico.anos.map((ano) => ano.situacao),
    years: historico.anos.map((ano) => String(ano.ano)),
    window: historyWindow(historico.janela),
  }
}

export type RainSummary = {
  /** Anos de chuva que a conta usou de fato. */
  years: number
  /** Período da série ("2005" a "2024"); null quando o talhão não diz. */
  period: { start: string; end: string } | null
  /** Anos do período que ficaram de fora (o backend descarta ano com dia faltando). */
  skipped: number
}

/** Período da série de chuva diária: vale o IMERG; sem ele, o NASA POWER (que também traz a chuva). */
function rainPeriod(dados: Talhao['dados']): RainSummary['period'] {
  const source = dados.find((dado) => dado.fonte === 'gpm_imerg') ?? dados.find((dado) => dado.fonte === 'nasa_power')
  const match = source?.periodo.match(/^(\d{4})-(\d{4})$/)
  return match ? { start: match[1], end: match[2] } : null
}

/**
 * Tela 4, cartão 2: quantos anos de chuva a conta leu, sem número fixo. Prefere `chuva.anos` das opções
 * da recomendação (anos usados de fato; a série é a mesma para todas, vale o maior); sem ela, conta pelo
 * período de `dados[]`. Sem nenhum dos dois, null (a tela não inventa os 20 anos do PRD).
 */
export function rainSummary(dados: Talhao['dados'], opcoes: readonly Opcao[] | null): RainSummary | null {
  const period = rainPeriod(dados)
  const span = period ? Number(period.end) - Number(period.start) + 1 : null
  const used = opcoes?.length ? Math.max(...opcoes.map((opcao) => opcao.chuva.anos)) : null
  const years = used ?? span
  if (years === null) return null
  return { years, period, skipped: span === null ? 0 : Math.max(0, span - years) }
}

export type ClimateSummary = {
  /** Período do NEX-GDDP-CMIP6 ("2041" a "2060"); null quando o talhão não diz. */
  period: { start: string; end: string } | null
}

/** Tela 4, cartão 4: o clima dos próximos anos só existe com o NEX-GDDP-CMIP6 no talhão (senão, null). */
export function climateSummary(dados: Talhao['dados']): ClimateSummary | null {
  const source = dados.find((dado) => dado.fonte === 'nex_gddp_cmip6')
  if (!source) return null
  const match = source.periodo.match(/^(\d{4})-(\d{4})$/)
  return { period: match ? { start: match[1], end: match[2] } : null }
}

export type SoilSummary = { textura: Textura; source: 'map' | 'user' | 'default' }

/** Tela 4, cartão 3: a escolha da pessoa (URL) vale mais que o SoilGrids; sem mapa, terra média. */
export function soilSummary(solo: Talhao['solo'], fromUrl: Textura | undefined): SoilSummary {
  if (fromUrl) return { textura: fromUrl, source: 'user' }
  if (!solo || solo.fonte === 'padrao') return { textura: solo?.textura ?? 'medio', source: 'default' }
  return { textura: solo.textura, source: solo.fonte === 'usuario' ? 'user' : 'map' }
}
