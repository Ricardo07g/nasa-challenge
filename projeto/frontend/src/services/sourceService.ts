import type { Talhao } from '../models/talhao'

/** As fontes de dado do produto (PRD): cada uma aparece na tela 9 como conectada ou não. */
export type SourceKey = 'nasa_power' | 'gpm_imerg' | 'smap' | 'modis' | 'modis_mcd64a1' | 'nex_gddp_cmip6' | 'soilgrids'

export type SourceStatus = { key: SourceKey; connected: boolean }

const ORDER: readonly SourceKey[] = ['nasa_power', 'gpm_imerg', 'smap', 'modis', 'modis_mcd64a1', 'nex_gddp_cmip6', 'soilgrids']

/** Fontes que chegam em `dados[]` do talhão com o mesmo nome. */
const FROM_DADOS: ReadonlySet<SourceKey> = new Set(['nasa_power', 'gpm_imerg', 'smap', 'modis_mcd64a1', 'nex_gddp_cmip6'])

function isConnected(key: SourceKey, talhao: Talhao): boolean {
  if (FROM_DADOS.has(key)) return talhao.dados.some((dado) => dado.fonte === key)
  if (key === 'modis') return talhao.historico !== null
  return talhao.solo?.fonte === 'soilgrids'
}

/**
 * Tela 9, "De onde vem cada dado": quais fontes a API manda de fato para este talhão. Vale `dados[]`;
 * o SoilGrids conta pelo `solo.fonte` e o MODIS pelo `historico` (o talhão não os lista em `dados[]`).
 * As conectadas vêm primeiro, na ordem do produto; a tela mostra só elas (decisão D2).
 */
export function sourceStatuses(talhao: Talhao): SourceStatus[] {
  const all = ORDER.map((key) => ({ key, connected: isConnected(key, talhao) }))
  return [...all.filter((source) => source.connected), ...all.filter((source) => !source.connected)]
}

/** Tamanho do quadrado da chuva usada na conta: IMERG (10 km) ou, sem ele, NASA POWER (~50 km). */
export function rainResolutionKm(talhao: Talhao): number | null {
  if (talhao.dados.some((dado) => dado.fonte === 'gpm_imerg')) return 10
  if (talhao.dados.some((dado) => dado.fonte === 'nasa_power')) return 50
  return null
}
