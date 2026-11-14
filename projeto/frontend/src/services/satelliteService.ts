import type { SituacaoAno, Talhao, Textura } from '../models/talhao'

export type HistorySummary = {
  idle: number
  planted: number
  total: number
  situations: SituacaoAno[]
  years: string[]
}

/** Tela 4, cartão 1: o que cresceu depois da soja, ano a ano (NDVI do MODIS). Sem dado, o cartão some. */
export function historySummary(historico: Talhao['historico']): HistorySummary | null {
  if (!historico) return null
  return {
    idle: historico.parado,
    planted: historico.anos.filter((ano) => ano.situacao === 'plantou').length,
    total: historico.total,
    situations: historico.anos.map((ano) => ano.situacao),
    years: historico.anos.map((ano) => String(ano.ano)),
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
