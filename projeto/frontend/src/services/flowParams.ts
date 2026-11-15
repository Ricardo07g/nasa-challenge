import { COLHEITAS, TEXTURAS, type Colheita, type Textura } from '../models/talhao'
import { formatConfirmadas, parseConfirmadas } from './confirmedSeasonsService'

/** O que a URL guarda entre as telas (RF-18): dá para recarregar ou compartilhar a mesma resposta. */
export type FlowParams = {
  lat: number
  lon: number
  colheita?: Colheita
  solo?: Textura
  exemplo?: boolean
  /** Safras confirmadas na tela 4, já no formato da URL e em ordem de ano ("2024:plantou,2025:parado"). */
  confirmadas?: string
}

function readNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function readFlowParams(search: URLSearchParams): (FlowParams & { exemplo: boolean }) | null {
  const lat = readNumber(search.get('lat'))
  const lon = readNumber(search.get('lon'))
  if (lat === null || lon === null) return null
  const colheita = search.get('colheita')
  const solo = search.get('solo')
  return {
    lat,
    lon,
    colheita: COLHEITAS.includes(colheita as Colheita) ? (colheita as Colheita) : undefined,
    solo: TEXTURAS.includes(solo as Textura) ? (solo as Textura) : undefined,
    exemplo: search.get('exemplo') === '1',
    confirmadas: formatConfirmadas(parseConfirmadas(search.get('confirmadas'))),
  }
}

const round = (value: number) => Number(value.toFixed(4))

export function buildFlowQuery(params: FlowParams): string {
  const query = new URLSearchParams()
  query.set('lat', String(round(params.lat)))
  query.set('lon', String(round(params.lon)))
  if (params.colheita) query.set('colheita', params.colheita)
  if (params.solo) query.set('solo', params.solo)
  if (params.exemplo) query.set('exemplo', '1')
  // No fim e sem codificar ":" e ",": o link fica legível para compartilhar (só dígitos, letras, ":" e ",").
  const confirmadas = params.confirmadas ? `&confirmadas=${params.confirmadas}` : ''
  return `?${query.toString()}${confirmadas}`
}

/** Query da URL atual que segue para o próximo link ("" se ainda não tem ponto marcado). */
export function keepFlowQuery(search: string): string {
  const params = readFlowParams(new URLSearchParams(search))
  return params ? buildFlowQuery(params) : ''
}
