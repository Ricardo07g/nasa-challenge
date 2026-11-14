import type { Ponto } from './talhao'

/**
 * Fazenda de exemplo (RF-11): campo de soja de 48 ha da Fazenda Experimental do Glória (UFU), Uberlândia.
 * 18°57'15.6"S 48°11'57.4"O, segundo TCC do ICIAG-UFU (2026). Área pública, sem dado de produtor.
 */
export const EXAMPLE_FARM: Ponto = { lat: -18.9543, lon: -48.1993 }

/** Caixa com dados preparados no hackathon (plano técnico §6): Uberlândia e Uberaba. */
export const PREPARED_AREA = { minLat: -19.9, maxLat: -18.4, minLon: -49.0, maxLon: -47.5 } as const
