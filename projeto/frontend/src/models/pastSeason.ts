import type { CropId } from './recomendacao'

export type TipoEvento =
  | 'semeadura'
  | 'sem_chuva'
  | 'aviso_veranico'
  | 'fase_critica'
  | 'voltou_chuva'
  | 'aviso_calor'
  | 'colheita'

/**
 * P4: replay de uma safrinha passada com a chuva e o calor reais daquele ano e os avisos que o
 * produtor teria recebido. Contrato proposto para `GET /api/safra-passada?lat&lon&ano`.
 */
export type SafraPassada = {
  ano: number
  opcao: CropId
  eventos: { data: string; tipo: TipoEvento; texto: string }[]
}
