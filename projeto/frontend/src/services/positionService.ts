import type { Ponto } from '../models/talhao'
import { geolocationRepository, type GeolocationRepository } from '../repositories/geolocationRepository'

export type PositionService = { current(): Promise<Ponto> }

/**
 * "Usar onde estou agora" procura por no máximo 10 s (tela "Onde fica a lavoura", tarefa 0053). O tempo do
 * próprio navegador só corre depois da permissão; este vale também com o pedido de permissão aberto.
 */
export const GPS_TIMEOUT_MS = 10_000

const round = (value: number) => Number(value.toFixed(4))

/** Posição do GPS arredondada (~10 m): basta para achar a célula de 0,1° e evita guardar demais (RNF-06). */
export function createPositionService(repository: GeolocationRepository = geolocationRepository): PositionService {
  return {
    async current() {
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('O GPS não respondeu em 10 s')), GPS_TIMEOUT_MS)
      })
      try {
        const point = await Promise.race([repository.current(), timeout])
        return { lat: round(point.lat), lon: round(point.lon) }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

export const positionService = createPositionService()
