import type { Colheita, Talhao, Textura } from './talhao'

/** Tipos do contrato `GET /api/recomendacao` (plano técnico do backend, §3.2). */

export type Rotulo = 'bom' | 'medio' | 'fraco'

export type Eixo = 'chuva' | 'dinheiro' | 'terra'

export type Motivo = 'menos_risco' | 'mais_dinheiro' | 'cuidar_da_terra'

export type CropId = 'milho_braquiaria' | 'milho_safrinha' | 'sorgo' | 'milheto' | 'crotalaria' | 'pousio'

export type Opcao = {
  id: CropId
  nome: string
  na_janela: boolean
  /** Proposta do front para o backend: data limite de plantio (ZARC). Opcional. */
  data_limite?: string
  chuva: { anos_bons: number; anos: number; faixa: boolean[]; rotulo: Rotulo; texto: string }
  futuro: { anos_bons_media: number; anos_bons_min: number; anos_bons_max: number }
  dinheiro: { margem_ha: number; rotulo: Rotulo; texto: string }
  terra: { nota: number; rotulo: Rotulo; texto: string }
  notas: { seguranca: number; futuro: number; solo: number; renda: number; final: number }
  porque: string[]
  como_fazer: string[]
}

export type Plano = { anos: CropId[]; nota: number }

export type Recomendacao = {
  entrada: {
    celula_id: string | null
    colheita: Colheita
    semeadura: string
    solo: Textura
    nematoide: boolean | null
  }
  melhor: CropId
  alternativas: { motivo: Motivo; opcao: CropId }[]
  opcoes: Opcao[]
  fora_da_janela: { id: CropId; nome: string; texto: string }[]
  pousio: { texto: string }
  plano_3_anos: { normal: Plano; seco: Plano; hoje: { descricao: string; nota: number } }
  versao_dados: string
  aviso: string
}

export type RecomendacaoParams = {
  lat: number
  lon: number
  colheita: Colheita
  solo?: Textura
}

/** `GET /api/exemplo`: talhão + recomendação da fazenda de exemplo (§3.3). Formato a confirmar no PR. */
export type Exemplo = {
  talhao: Talhao
  recomendacao: Recomendacao
}

/** Tipo de cada cultura (PRD §5): quais dão grão e quais deixam a terra coberta. */
export const GRAIN_CROPS: ReadonlySet<CropId> = new Set(['milho_braquiaria', 'milho_safrinha', 'sorgo'])
export const COVER_CROPS: ReadonlySet<CropId> = new Set([
  'milho_braquiaria',
  'milho_safrinha',
  'sorgo',
  'milheto',
  'crotalaria',
])
