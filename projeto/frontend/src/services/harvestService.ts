import type { Colheita, Talhao } from '../models/talhao'

/** Época em que a soja é colhida (datas ISO, inclusivas). */
export type HarvestWindow = { min: string; max: string }

/**
 * Próxima colheita da soja a partir de hoje: de 15/jan a 31/mar. De abril em diante, já vale a do
 * ano que vem (a decisão acontece de dezembro a março, PRD §3). O backend usa a mesma época
 * (`regras.yaml`, grupo `colheita`) na tabela da chuva que sobra.
 */
export function harvestWindow(today: Date): HarvestWindow {
  const year = today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear()
  return { min: `${year}-01-15`, max: `${year}-03-31` }
}

/**
 * A data exata vira uma das 3 faixas do motor: a resposta depende da faixa, não do dia.
 * Até 10/fev = cedo (janeiro também); 11 a 20/fev = meio; depois do dia 20 ou março = tarde.
 * É a mesma regra do backend (`regras.yaml`, grupo `colheita`) para a faixa sugerida pelo NDVI.
 */
export function harvestFromDate(iso: string, window: HarvestWindow): Colheita | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < window.min || iso > window.max) return null
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  if (month === 1) return 'cedo'
  if (month === 2) return day <= 10 ? 'cedo' : day <= 20 ? 'meio' : 'tarde'
  return 'tarde'
}

export type HarvestSuggestion = {
  faixa: Colheita
  fromSatellite: boolean
  /** O dia em que a soja costuma secar pelo NDVI, no ano da época da colheita; null sem o dia. */
  date: string | null
}

/**
 * O que a tela 3 já traz preenchido: o dia que o satélite viu (NDVI, `colheita_sugerida.dia`) no ano
 * da época da colheita. A faixa sai desse dia pela regra da data exata (`harvestFromDate`), para a
 * sugestão e a seleção serem sempre a mesma (tarefa 0042). Sem o dia (API antiga ou dia fora da
 * época), fica a faixa do satélite; sem dado do satélite, "meio" (RF-16).
 */
export function harvestSuggestion(talhao: Talhao | undefined, window: HarvestWindow): HarvestSuggestion {
  const sugerida = talhao?.colheita_sugerida
  if (!sugerida || sugerida.fonte !== 'ndvi_modis') return { faixa: 'meio', fromSatellite: false, date: null }
  const date = sugerida.dia ? `${window.min.slice(0, 4)}-${sugerida.dia}` : null
  const band = date ? harvestFromDate(date, window) : null
  return band ? { faixa: band, fromSatellite: true, date } : { faixa: sugerida.faixa, fromSatellite: true, date: null }
}

/**
 * O dia de colheita de cada faixa no motor: a semeadura do backend é a colheita + 3 dias
 * (`SOWING_MONTH_DAY_BY_HARVEST`: 08/02, 18/02 e 03/03). Serve para a chuva que sobra quando o
 * produtor escolhe só a faixa ("Não sei o dia exato").
 */
const BAND_DAY: Record<Colheita, string> = { cedo: '02-05', meio: '02-15', tarde: '02-28' }

export function bandDate(band: Colheita, window: HarvestWindow): string {
  return `${window.min.slice(0, 4)}-${BAND_DAY[band]}`
}
