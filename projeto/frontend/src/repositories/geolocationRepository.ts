import type { Ponto } from '../models/talhao'

type GeolocationLike = Pick<Geolocation, 'getCurrentPosition'>

export type GeolocationRepository = {
  current(): Promise<Ponto>
}

/** "Usar onde estou agora" (RF-01): GPS do navegador, sem guardar nada (RNF-06). */
export function createGeolocationRepository(
  geolocation: GeolocationLike | undefined = globalThis.navigator?.geolocation,
): GeolocationRepository {
  return {
    current() {
      return new Promise((resolve, reject) => {
        if (!geolocation) {
          reject(new Error('GPS indisponível neste navegador'))
          return
        }
        geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
          (error) => reject(new Error(error.message)),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        )
      })
    },
  }
}

export const geolocationRepository = createGeolocationRepository()
