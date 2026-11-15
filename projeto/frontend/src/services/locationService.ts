import { EXAMPLE_FARM, type PilotArea } from '../models/area'
import type { Ponto } from '../models/talhao'

export { EXAMPLE_FARM }

/** O ponto está na área piloto (a borda conta)? A área vem de `GET /api/area-piloto`. */
export function isInsideArea({ lat, lon }: Ponto, area: PilotArea): boolean {
  return lat >= area.min_lat && lat <= area.max_lat && lon >= area.min_lon && lon <= area.max_lon
}

/** Estado do cartão do local na tela "Onde fica a lavoura" (tarefa 0053). */
export type WhereStatus = 'empty' | 'marked' | 'outside'

/**
 * Sem ponto, marcado ou fora da área do MVP. Sem a área (carregando ou fora do ar), o ponto conta como
 * marcado: o aviso de fora só aparece com os limites da API na mão.
 */
export function whereStatus(point: Ponto | null, area: PilotArea | null): WhereStatus {
  if (!point) return 'empty'
  if (area && !isInsideArea(point, area)) return 'outside'
  return 'marked'
}

/**
 * "Confirmar local" liga só com o ponto marcado dentro da área. Enquanto a área carrega, espera; se ela não
 * carregar, deixa seguir (o backend ainda responde `OUTSIDE_AREA` nas telas seguintes).
 */
export function canConfirm(status: WhereStatus, area: 'loading' | 'ready' | 'error'): boolean {
  return status === 'marked' && area !== 'loading'
}

/** Cidades de referência do Triângulo Mineiro (sem serviço externo de endereço). */
const PLACES: { name: string; lat: number; lon: number }[] = [
  { name: 'Uberlândia (MG)', lat: -18.918, lon: -48.277 },
  { name: 'Uberaba (MG)', lat: -19.748, lon: -47.932 },
  { name: 'Araguari (MG)', lat: -18.647, lon: -48.187 },
  { name: 'Monte Alegre de Minas (MG)', lat: -18.871, lon: -48.881 },
  { name: 'Prata (MG)', lat: -19.308, lon: -48.924 },
  { name: 'Nova Ponte (MG)', lat: -19.146, lon: -47.677 },
  { name: 'Indianópolis (MG)', lat: -19.039, lon: -47.917 },
  { name: 'Tupaciguara (MG)', lat: -18.592, lon: -48.705 },
  { name: 'Conceição das Alagoas (MG)', lat: -19.917, lon: -48.383 },
  { name: 'Sacramento (MG)', lat: -19.865, lon: -47.44 },
  { name: 'Ituiutaba (MG)', lat: -18.974, lon: -49.464 },
  { name: 'Araxá (MG)', lat: -19.593, lon: -46.94 },
  { name: 'Patos de Minas (MG)', lat: -18.579, lon: -46.518 },
]

export function nearestPlace({ lat, lon }: Ponto): string {
  const cosLat = Math.cos((lat * Math.PI) / 180)
  let best = PLACES[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const place of PLACES) {
    const dLat = place.lat - lat
    const dLon = (place.lon - lon) * cosLat
    const distance = dLat * dLat + dLon * dLon
    if (distance < bestDistance) {
      best = place
      bestDistance = distance
    }
  }
  return best.name
}
