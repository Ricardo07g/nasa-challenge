import type { Ponto } from './talhao'

/** Fazenda de exemplo (RF-11): Uberlândia, -18,92 / -48,28. */
export const EXAMPLE_FARM: Ponto = { lat: -18.92, lon: -48.28 }

/** Caixa com dados preparados no hackathon (plano técnico §6): Uberlândia e Uberaba. */
export const PREPARED_AREA = { minLat: -19.9, maxLat: -18.4, minLon: -49.0, maxLon: -47.5 } as const
