import type { Lang } from '../i18n/language'
import type { PhotonResponse } from '../models/place'
import type { Ponto } from '../models/talhao'
import { getExternalJson as defaultGetExternalJson, type GetExternalJson } from './httpClient'

export type ReverseOptions = { lang: Lang; signal?: AbortSignal }

export type GeocodingRepository = {
  reverse(point: Ponto, options: ReverseOptions): Promise<PhotonResponse>
}

/** Instância pública do Photon (komoot): OpenStreetMap, sem chave nem cadastro. Uso justo: ver o AGENTS do front. */
export const PHOTON_URL = 'https://photon.komoot.io'

/** O Photon só aceita default, de, en e fr (conferido em 15/11/2026): em pt, os nomes locais. */
const photonLang = (lang: Lang) => (lang === 'en' ? 'en' : 'default')

/** Endereço aproximado do ponto pelo Photon (`/reverse`, tarefa 0053). Só monta o pedido. */
export function createPhotonGeocodingRepository(
  getExternalJson: GetExternalJson = defaultGetExternalJson,
): GeocodingRepository {
  return {
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
