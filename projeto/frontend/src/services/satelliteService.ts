import type { SituacaoAno, Talhao, Textura } from '../models/talhao'

export type HistorySummary = {
  idle: number
  planted: number
  /** Anos em que o satélite não teve certeza (`incerto` + `sem_dado`). */
  uncertain: number
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
 * certos ("parada em 5 de 9 anos (1 sem certeza)"). As contas saem dos próprios anos da faixa, para a
 * frase nunca discordar dos quadrinhos. Sem dado, ou sem nenhum ano certo, o cartão some.
 */
export function historySummary(historico: Talhao['historico']): HistorySummary | null {
  if (!historico) return null
  const count = (situacao: SituacaoAno) => historico.anos.filter((ano) => ano.situacao === situacao).length
  const idle = count('parado')
  const planted = count('plantou')
  const known = idle + planted
  if (known === 0) return null
  return {
    idle,
    planted,
    uncertain: historico.anos.length - known,
    known,
    total: historico.anos.length,
    situations: historico.anos.map((ano) => ano.situacao),
    years: historico.anos.map((ano) => String(ano.ano)),
    window: historyWindow(historico.janela),
  }
}

/**
 * Tela 4, cartão 2: período da chuva ("2006-2025"). Vale o IMERG; sem ele, o NASA POWER (que também
 * traz a chuva diária); sem nenhum dos dois, os 20 anos do PRD.
 */
export function rainPeriod(dados: Talhao['dados']): { start: string; end: string } {
  const source = dados.find((dado) => dado.fonte === 'gpm_imerg') ?? dados.find((dado) => dado.fonte === 'nasa_power')
  const match = source?.periodo.match(/^(\d{4})-(\d{4})$/)
  return match ? { start: match[1], end: match[2] } : { start: '2006', end: '2025' }
}

export type SoilSummary = { textura: Textura; source: 'map' | 'user' | 'default' }

/** Tela 4, cartão 3: a escolha da pessoa (URL) vale mais que o SoilGrids; sem mapa, terra média. */
export function soilSummary(solo: Talhao['solo'], fromUrl: Textura | undefined): SoilSummary {
  if (fromUrl) return { textura: fromUrl, source: 'user' }
  if (!solo || solo.fonte === 'padrao') return { textura: solo?.textura ?? 'medio', source: 'default' }
  return { textura: solo.textura, source: solo.fonte === 'usuario' ? 'user' : 'map' }
}
