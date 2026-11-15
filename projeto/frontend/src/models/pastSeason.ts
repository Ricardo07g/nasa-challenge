import type { CropId } from './recomendacao'
import type { Colheita } from './talhao'

/** Detalhe de um ano do explorador (tarefa 0044): a faixa de colheita e a opção que a aba Sugestão mostra. */
export type PastSeasonOptions = { colheita?: Colheita; opcao?: CropId }

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
