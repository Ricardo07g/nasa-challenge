import type { Ponto } from './talhao'

/**
 * Fazenda de exemplo (RF-11): na tela, "Lavoura de demonstração, perto de Uberlândia (MG)" (tarefa 0053).
 * Um dos 4 pontos com histórico de NDVI; fica perto da Fazenda do Glória, mas não garantidamente dentro
 * dela (por isso o nome não cita a dona da área). Sem nome nem dado de produtor.
 */
export const EXAMPLE_FARM: Ponto = { lat: -18.9543, lon: -48.1993 }

/**
 * Área piloto, com dados preparados (Uberlândia e Uberaba), como vem de `GET /api/area-piloto`. Os
 * números ficam só no backend (`PILOT_*` do `app/constants.py`): o front não os repete (tarefa 0041).
 */
export type PilotArea = { min_lat: number; max_lat: number; min_lon: number; max_lon: number }
