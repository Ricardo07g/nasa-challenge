import type { Lang } from '../i18n/language'
import type { PhotonProperties } from '../models/place'
import type { Ponto } from '../models/talhao'
import { geocodingRepository as defaultRepository } from '../repositories'
import type { GeocodingRepository } from '../repositories/geocodingRepository'

/** Uso justo do Photon público: espera 400 ms depois de o ponto parar (tocar ou arrastar o alfinete). */
export const SEARCH_DELAY_MS = 400

export type GeocodingService = {
  /** Endereço aproximado do ponto, numa linha; `null` se o Photon não achar nada perto. */
  reverse(point: Ponto, lang: Lang, options?: { signal?: AbortSignal }): Promise<string | null>
}

const present = (value: string | undefined): value is string => value !== undefined && value.trim() !== ''

function unique(parts: (string | undefined)[]): string[] {
  return [...new Set(parts.filter(present))]
}

/** Nome do lugar; sem nome, rua e número; sem rua, a cidade ou o estado. */
function placeName(p: PhotonProperties): string | undefined {
  if (present(p.name)) return p.name
  if (present(p.street)) return unique([p.street, p.housenumber]).join(', ')
  return [p.city, p.county, p.state].find(present)
}

const abroad = (p: PhotonProperties) => (present(p.countrycode) && p.countrycode !== 'BR' ? p.country : undefined)

/**
 * Endereço aproximado do alfinete ("Perto de {lugar}"), pela busca reversa do Photon (tarefa 0053). A busca
 * por endereço saiu da tela "Onde fica a lavoura": o produtor toca no mapa, usa o GPS ou cola as coordenadas.
 */
export function createGeocodingService(repository: GeocodingRepository = defaultRepository): GeocodingService {
  return {
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
