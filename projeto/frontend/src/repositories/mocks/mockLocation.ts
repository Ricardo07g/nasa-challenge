/**
 * Endereço aproximado e área piloto de EXEMPLO (VITE_API_MODE=mock): sem rede, no mesmo contrato do
 * `/reverse` do Photon e do `GET /api/area-piloto`. Só `repositories/index.ts` (e as fixtures) importam daqui.
 */
import type { PilotArea } from '../../models/area'
import type { PhotonFeature } from '../../models/place'
import type { Ponto } from '../../models/talhao'
import type { GeocodingRepository } from '../geocodingRepository'
import type { PilotAreaRepository } from '../pilotAreaRepository'
import { delay } from './delay'

/** Cópia do que a API responde (os limites de verdade ficam só no backend). */
export const MOCK_PILOT_AREA: PilotArea = { min_lat: -19.9, max_lat: -18.4, min_lon: -49.0, max_lon: -47.5 }

export function createMockPilotAreaRepository(delayMs = 100): PilotAreaRepository {
  return {
    async get() {
      await delay(delayMs)
      return MOCK_PILOT_AREA
    },
  }
}

/** Cidades de exemplo (Brasília fica fora da área, para ver o aviso). */
const PLACES: { name: string; state: string; lat: number; lon: number }[] = [
  { name: 'Uberlândia', state: 'Minas Gerais', lat: -18.918, lon: -48.277 },
  { name: 'Uberaba', state: 'Minas Gerais', lat: -19.748, lon: -47.932 },
  { name: 'Araguari', state: 'Minas Gerais', lat: -18.647, lon: -48.187 },
  { name: 'Monte Alegre de Minas', state: 'Minas Gerais', lat: -18.871, lon: -48.881 },
  { name: 'Nova Ponte', state: 'Minas Gerais', lat: -19.146, lon: -47.677 },
  { name: 'Brasília', state: 'Distrito Federal', lat: -15.794, lon: -47.882 },
]

function toFeature(place: (typeof PLACES)[number], index: number): PhotonFeature {
  return {
    type: 'Feature',
    properties: {
      osm_type: 'N',
      osm_id: index + 1,
      type: 'city',
      name: place.name,
      state: place.state,
      country: 'Brasil',
      countrycode: 'BR',
    },
    geometry: { type: 'Point', coordinates: [place.lon, place.lat] },
  }
}

function nearest({ lat, lon }: Ponto): number {
  const distances = PLACES.map((place) => (place.lat - lat) ** 2 + (place.lon - lon) ** 2)
  return distances.indexOf(Math.min(...distances))
}

export function createMockGeocodingRepository(delayMs = 150): GeocodingRepository {
  return {
    async reverse(point) {
      await delay(delayMs)
      const index = nearest(point)
      return { type: 'FeatureCollection', features: [toFeature(PLACES[index], index)] }
    },
  }
}
