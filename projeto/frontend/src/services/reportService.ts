import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'

const NAMES: Record<string, string> = {
  gpm_imerg: 'GPM IMERG',
  nasa_power: 'NASA POWER',
  nex_gddp_cmip6: 'NEX-GDDP-CMIP6',
  smap: 'SMAP',
}

/**
 * Relatório (P2): só as fontes que a conta usou de fato, para o documento não prometer dado que não
 * entrou (ex.: com a API de hoje, só o NASA POWER).
 */
export function reportSources(talhao: Talhao, recomendacao: Recomendacao): string[] {
  const sources = [
    ...talhao.dados.map((dado) => NAMES[dado.fonte] ?? dado.fonte),
    ...(talhao.historico ? ['MODIS'] : []),
    ...(talhao.solo?.fonte === 'soilgrids' ? ['SoilGrids'] : []),
    ...(recomendacao.sinal?.fonte ?? []),
  ]
  return [...new Set(sources)]
}
