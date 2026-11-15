import type { Ponto } from './talhao'

/**
 * Fazenda de exemplo (RF-11): campo de soja de 48 ha da Fazenda Experimental do Glória (UFU), Uberlândia.
 * 18°57'15.6"S 48°11'57.4"O, segundo TCC do ICIAG-UFU (2026). Área pública, sem dado de produtor.
 */
export const EXAMPLE_FARM: Ponto = { lat: -18.9543, lon: -48.1993 }

/**
 * Área piloto, com dados preparados (Uberlândia e Uberaba), como vem de `GET /api/area-piloto`. Os
 * números ficam só no backend (`PILOT_*` do `app/constants.py`): o front não os repete (tarefa 0041).
 */
export type PilotArea = { min_lat: number; max_lat: number; min_lon: number; max_lon: number }
