import type { Lang } from '../i18n/language'
import type { Avisos, PontoAvisos } from '../models/avisos'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type AvisosRepository = {
  get(point: PontoAvisos, lang: Lang): Promise<Avisos>
}

function query(point: PontoAvisos): string {
  const colheita = point.colheita ? `&colheita=${point.colheita}` : ''
  const solo = point.solo ? `&solo=${point.solo}` : ''
  const confirmadas = point.confirmadas ? `&confirmadas=${point.confirmadas}` : ''
  return `lat=${point.lat}&lon=${point.lon}${colheita}${solo}${confirmadas}`
}

/** `GET /api/avisos?lat&lon[&colheita][&solo][&confirmadas]` (tela "Avisos", tarefa 0046 do backend). */
export function createHttpAvisosRepository(getJson: GetJson = defaultGetJson): AvisosRepository {
  return {
    get: (point, lang) => getJson<Avisos>(`/api/avisos?${query(point)}`, { lang }),
  }
}
