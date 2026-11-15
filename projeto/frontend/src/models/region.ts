import type { BlockStatus } from './screenStatus'

/**
 * P3: área de soja parada depois da colheita num raio da região, ano a ano, pelo MODIS (NASA).
 * Contrato de `GET /api/regiao?lat&lon` (tarefas 0034 e 0036 do backend). `centro`,
 * `distancia_km` e `n_pixels_lavoura` são opcionais: a API antiga não manda.
 */
export type RegiaoSatelite = {
  raio_km: number
  anos: {
    ano: number
    pct_parado: number
    pct_plantou: number
    pct_incerto: number
    /** Pixels da máscara de lavoura no raio (a soja do ano sai deles). */
    n_pixels_lavoura?: number | null
  }[]
  fonte: string
  /** Centro do círculo medido pelo satélite (nem sempre a lavoura). */
  centro?: { lat: number; lon: number } | null
  /** Distância da lavoura até o centro do círculo, em km com 1 casa. */
  distancia_km?: number | null
}

/** Estado do bloco da região: "outside" = o satélite ainda não mediu a região desse ponto. */
export type RegionStatus = BlockStatus | 'outside'
