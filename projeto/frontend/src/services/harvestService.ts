import type { Colheita } from '../models/talhao'
import { CURRENT_SEASON } from './seasonService'

/** Dias em que a colheita pode cair (datas ISO, inclusivas). */
export type HarvestWindow = { min: string; max: string }

/**
 * O campo de data da tela 2 "Quando você colhe a soja?" (pacote 2, tarefa 0057): de 1/jan a 30/abr do ano
 * da colheita da safra atual (2027, safra 2026/27). O satélite não vê o dia da colheita: o produtor sempre
 * escolhe, e a tela abre sem data.
 */
export function harvestDateWindow(season: number = CURRENT_SEASON): HarvestWindow {
  return { min: `${season}-01-01`, max: `${season}-04-30` }
}

/**
 * A data exata vira uma das 3 faixas do motor: a resposta depende da faixa, não do dia.
 * Até 10/fev = cedo (janeiro também); 11 a 20/fev = meio; do dia 21 em diante (março e abril também) =
 * tarde. É a mesma regra do backend (`regras.yaml`, grupo `colheita`: `cedo_ate` 02-10, `meio_ate` 02-20).
 */
export function harvestFromDate(iso: string, window: HarvestWindow): Colheita | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < window.min || iso > window.max) return null
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  if (month === 1) return 'cedo'
  if (month === 2) return day <= 10 ? 'cedo' : day <= 20 ? 'meio' : 'tarde'
  return 'tarde'
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

/** O que o produtor escolheu: a data (e a faixa dela) ou só a faixa ("Não sei o dia exato"). */
export type HarvestChoice = { band: Colheita; date: string | null }

/**
 * A escolha guardada na URL (`data=AAAA-MM-DD`, `colheita=cedo|meio|tarde`): a data dentro do campo vale
 * mais, e a faixa sai dela; sem data, só a faixa; sem nada, null (a tela abre sem data).
 */
export function harvestChoice(
  params: { data?: string; colheita?: Colheita } | null,
  window: HarvestWindow,
): HarvestChoice | null {
  if (!params) return null
  const fromDate = params.data ? harvestFromDate(params.data, window) : null
  if (fromDate && params.data) return { band: fromDate, date: params.data }
  return params.colheita ? { band: params.colheita, date: null } : null
}

/** O dia usado na chuva que sobra: a data escolhida ou, só com a faixa, o dia de colheita da faixa no motor. */
export function choiceDay(choice: HarvestChoice, window: HarvestWindow): string {
  return choice.date ?? bandDate(choice.band, window)
}
