import type { Lang } from '../i18n/language'
import type { PhotonFeature, PhotonProperties, PlaceSuggestion } from '../models/place'
import type { Ponto } from '../models/talhao'
import { geocodingRepository as defaultRepository } from '../repositories'
import type { GeocodingRepository } from '../repositories/geocodingRepository'

/** Uso justo do Photon público: espera entre teclas (e depois de parar o mapa) e mínimo de letras. */
export const SEARCH_DELAY_MS = 400
export const MIN_SEARCH_LENGTH = 3

export type GeocodingService = {
  canSearch(query: string): boolean
  search(query: string, lang: Lang, options?: { near?: Ponto; signal?: AbortSignal }): Promise<PlaceSuggestion[]>
  /** Endereço aproximado do ponto, numa linha; `null` se o Photon não achar nada perto. */
  reverse(point: Ponto, lang: Lang, options?: { signal?: AbortSignal }): Promise<string | null>
}

const present = (value: string | undefined): value is string => value !== undefined && value.trim() !== ''

function unique(parts: (string | undefined)[], skip?: string): string[] {
  return [...new Set(parts.filter(present))].filter((part) => part !== skip)
}

/** Nome do lugar; sem nome, rua e número; sem rua, a cidade ou o estado. */
function placeName(p: PhotonProperties): string | undefined {
  if (present(p.name)) return p.name
  if (present(p.street)) return unique([p.street, p.housenumber]).join(', ')
  return [p.city, p.county, p.state].find(present)
}

const abroad = (p: PhotonProperties) => (present(p.countrycode) && p.countrycode !== 'BR' ? p.country : undefined)

/** Onde fica: bairro, cidade, estado (e o país, fora do Brasil), sem repetir o nome. */
function placeDetail(p: PhotonProperties, name: string): string {
  return unique([p.district ?? p.locality, p.city, present(p.city) ? undefined : p.county, p.state, abroad(p)], name).join(', ')
}

function toSuggestion(feature: PhotonFeature, index: number): PlaceSuggestion | null {
  const name = placeName(feature.properties)
  const [lon, lat] = feature.geometry?.coordinates ?? []
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const { osm_type: type, osm_id: id } = feature.properties
  return {
    id: present(type) && id !== undefined ? `${type}${id}` : `lugar-${index}`,
    label: name,
    detail: placeDetail(feature.properties, name),
    point: { lat, lon },
  }
}

/** Busca de endereço (autocompletar) e endereço aproximado do pino, pelo Photon (tarefa 0041). */
export function createGeocodingService(repository: GeocodingRepository = defaultRepository): GeocodingService {
  const canSearch = (query: string) => query.trim().length >= MIN_SEARCH_LENGTH

  return {
    canSearch,
    async search(query, lang, options = {}) {
      if (!canSearch(query)) return []
      const data = await repository.search(query.trim(), { lang, ...options })
      const seen = new Set<string>()
      return data.features.flatMap((feature, index) => {
        const place = toSuggestion(feature, index)
        const key = place && `${place.label}|${place.detail}`
        if (!place || !key || seen.has(key)) return []
        seen.add(key)
        return [place]
      })
    },
    async reverse(point, lang, options = {}) {
      const data = await repository.reverse(point, { lang, ...options })
      const first = data.features[0]
      const name = first && placeName(first.properties)
      if (!first || !name) return null
      const p = first.properties
      return unique([name, p.district ?? p.locality, p.city, p.state, abroad(p)]).join(', ')
    },
  }
}

export const geocodingService = createGeocodingService()
