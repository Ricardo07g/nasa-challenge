/** Tipos do contrato `GET /api/custo-atraso` (tela 3, tarefa 0042 do backend). */

import type { Colheita, Textura } from './talhao'

/** A melhor opção do motor para uma faixa de colheita; os campos são null sem opção na janela de plantio. */
export type CustoFaixa = {
  colheita: Colheita
  /** Dia de plantar do motor para a faixa (ISO, ano de referência). */
  semeadura: string
  melhor: string | null
  nome: string | null
  /** Anos em que a melhor opção deu certo (sem aperto de água nem calor). */
  anos_bons: number | null
  total_anos: number | null
}

export type CustoAtraso = {
  /** Cedo, meio e tarde, nessa ordem. */
  faixas: CustoFaixa[]
  /** A melhor opção é a mesma nas três faixas. */
  mesma_cultura: boolean
}

export type CustoAtrasoParams = { lat: number; lon: number; solo?: Textura; confirmadas?: string }
