import type { Ponto } from '../models/talhao'
import { geolocationRepository, type GeolocationRepository } from '../repositories/geolocationRepository'

export type PositionService = { current(): Promise<Ponto> }

const round = (value: number) => Number(value.toFixed(4))

/** Posição do GPS arredondada (~10 m): basta para achar a célula de 0,1° e evita guardar demais (RNF-06). */
export function createPositionService(repository: GeolocationRepository = geolocationRepository): PositionService {
  return {
    async current() {
      const point = await repository.current()
      return { lat: round(point.lat), lon: round(point.lon) }
    },
  }
}

export const positionService = createPositionService()
