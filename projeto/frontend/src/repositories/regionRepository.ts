import type { Lang } from '../i18n/language'
import type { RegiaoSatelite } from '../models/region'
import type { Ponto } from '../models/talhao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'
import { delay } from './mocks/delay'

export type RegionRepository = {
  get(point: Ponto, lang: Lang): Promise<RegiaoSatelite>
}

/** `GET /api/regiao?lat&lon` (P3, contrato proposto; o backend ainda não tem). */
export function createHttpRegionRepository(getJson: GetJson = defaultGetJson): RegionRepository {
  return {
    get: (point, lang) => getJson<RegiaoSatelite>(`/api/regiao?lat=${point.lat}&lon=${point.lon}`, { lang }),
  }
}

/** % parado de 2015 a 2025 (dados de exemplo, na ordem de grandeza da região). */
const IDLE: [number, number][] = [
  [2015, 70],
  [2016, 69],
  [2017, 67],
  [2018, 68],
  [2019, 66],
  [2020, 65],
  [2021, 63],
  [2022, 61],
  [2023, 64],
  [2024, 63],
  [2025, 62],
]

export function createMockRegionRepository(delayMs = 300): RegionRepository {
  return {
    async get() {
      await delay(delayMs)
      return {
        raio_km: 30,
        fonte: 'modis_mod13q1',
        anos: IDLE.map(([ano, parado]) => ({ ano, pct_parado: parado, pct_incerto: 9, pct_plantou: 100 - parado - 9 })),
      }
    },
  }
}
