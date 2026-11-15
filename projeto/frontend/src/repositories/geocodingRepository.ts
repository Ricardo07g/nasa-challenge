import type { Lang } from '../i18n/language'
import type { PhotonResponse } from '../models/place'
import type { Ponto } from '../models/talhao'
import { getExternalJson as defaultGetExternalJson, type GetExternalJson } from './httpClient'

export type SearchOptions = { lang: Lang; near?: Ponto; signal?: AbortSignal }
export type ReverseOptions = { lang: Lang; signal?: AbortSignal }

export type GeocodingRepository = {
  search(query: string, options: SearchOptions): Promise<PhotonResponse>
  reverse(point: Ponto, options: ReverseOptions): Promise<PhotonResponse>
}

/** Instância pública do Photon (komoot): OpenStreetMap, sem chave nem cadastro. Uso justo: ver o AGENTS do front. */
export const PHOTON_URL = 'https://photon.komoot.io'
export const SEARCH_LIMIT = 5

/** O Photon só aceita default, de, en e fr (conferido em 15/11/2026): em pt, os nomes locais. */
const photonLang = (lang: Lang) => (lang === 'en' ? 'en' : 'default')

/** Busca de endereço e endereço aproximado do ponto pelo Photon (tarefa 0041). Só monta o pedido. */
export function createPhotonGeocodingRepository(
  getExternalJson: GetExternalJson = defaultGetExternalJson,
): GeocodingRepository {
  return {
    search(query, { lang, near, signal }) {
      const params = new URLSearchParams({ q: query, limit: String(SEARCH_LIMIT), lang: photonLang(lang) })
      if (near) {
        params.set('lat', String(near.lat))
        params.set('lon', String(near.lon))
      }
      return getExternalJson<PhotonResponse>(`${PHOTON_URL}/api/?${params}`, { signal })
    },
    reverse(point, { lang, signal }) {
      const params = new URLSearchParams({
        lat: String(point.lat),
        lon: String(point.lon),
        lang: photonLang(lang),
        limit: '1',
      })
      return getExternalJson<PhotonResponse>(`${PHOTON_URL}/reverse?${params}`, { signal })
    },
  }
}
