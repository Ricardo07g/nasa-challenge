/**
 * P3: área de lavoura parada depois da soja num raio da região, ano a ano, pelo MODIS (NASA).
 * Contrato proposto para `GET /api/regiao?lat&lon` (ainda não existe no backend).
 */
export type RegiaoSatelite = {
  raio_km: number
  anos: { ano: number; pct_parado: number; pct_plantou: number; pct_incerto: number }[]
  fonte: string
}
