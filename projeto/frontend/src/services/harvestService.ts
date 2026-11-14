import type { Colheita, Talhao } from '../models/talhao'

/** Época em que a soja é colhida (datas ISO, inclusivas). */
export type HarvestWindow = { min: string; max: string }

/**
 * Próxima colheita da soja a partir de hoje: de 15/jan a 31/mar. De abril em diante, já vale a do
 * ano que vem (a decisão acontece de dezembro a março, PRD §3).
 */
export function harvestWindow(today: Date): HarvestWindow {
  const year = today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear()
  return { min: `${year}-01-15`, max: `${year}-03-31` }
}

/**
 * "Colocar a data exata" é só um atalho para as 3 faixas: a resposta nunca depende do dia exato.
 * Até 10/fev = cedo (janeiro também); 11 a 20/fev = meio; depois do dia 20 ou março = tarde.
 */
export function harvestFromDate(iso: string, window: HarvestWindow): Colheita | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < window.min || iso > window.max) return null
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  if (month === 1) return 'cedo'
  if (month === 2) return day <= 10 ? 'cedo' : day <= 20 ? 'meio' : 'tarde'
  return 'tarde'
}

/** Faixa já marcada na tela 3: a do satélite (NDVI); sem dado, "meio" (RF-16). */
export function harvestSuggestion(talhao: Talhao | undefined): { faixa: Colheita; fromSatellite: boolean } {
  const sugerida = talhao?.colheita_sugerida
  if (!sugerida || sugerida.fonte !== 'ndvi_modis') return { faixa: 'meio', fromSatellite: false }
  return { faixa: sugerida.faixa, fromSatellite: true }
}
