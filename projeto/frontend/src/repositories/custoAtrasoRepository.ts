import type { Lang } from '../i18n/language'
import type { CustoAtraso, CustoAtrasoParams } from '../models/custoAtraso'
import { getJson as defaultGetJson, type GetJson } from './httpClient'

export type CustoAtrasoRepository = {
  get(params: CustoAtrasoParams, lang: Lang): Promise<CustoAtraso>
}

function query(params: CustoAtrasoParams): string {
  const solo = params.solo ? `&solo=${params.solo}` : ''
  const confirmadas = params.confirmadas ? `&confirmadas=${params.confirmadas}` : ''
  return `lat=${params.lat}&lon=${params.lon}${solo}${confirmadas}`
}

/** `GET /api/custo-atraso?lat&lon[&solo][&confirmadas]` (tela 3, tarefa 0042 do backend). */
export function createHttpCustoAtrasoRepository(getJson: GetJson = defaultGetJson): CustoAtrasoRepository {
  return {
    get: (params, lang) => getJson<CustoAtraso>(`/api/custo-atraso?${query(params)}`, { lang }),
  }
}
