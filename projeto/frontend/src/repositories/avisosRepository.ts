import type { Lang } from '../i18n/language'
import type { Avisos, PontoAvisos } from '../models/avisos'
import type { CropId } from '../models/recomendacao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type AvisosRepository = {
  /** `cultura`: a do 1º ano do plano (tarefa 0065 do backend); sem ela, a API usa a melhor opção do motor. */
  get(point: PontoAvisos, lang: Lang, cultura?: CropId | null): Promise<Avisos>
}

function query(point: PontoAvisos, cultura: CropId | null | undefined): string {
  const colheita = point.colheita ? `&colheita=${point.colheita}` : ''
  const solo = point.solo ? `&solo=${point.solo}` : ''
  const confirmadas = point.confirmadas ? `&confirmadas=${point.confirmadas}` : ''
  const crop = cultura ? `&cultura=${cultura}` : ''
  return `lat=${point.lat}&lon=${point.lon}${colheita}${solo}${confirmadas}${crop}`
}

/** `GET /api/avisos?lat&lon[&colheita][&solo][&confirmadas][&cultura]` (tela "Avisos", tarefas 0046 e 0065 do backend). */
export function createHttpAvisosRepository(getJson: GetJson = defaultGetJson): AvisosRepository {
  return {
    get: (point, lang, cultura) => getJson<Avisos>(`/api/avisos?${query(point, cultura)}`, { lang }),
  }
}
