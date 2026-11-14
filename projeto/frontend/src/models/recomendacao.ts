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
  /** Data limite de plantio do ZARC (ADR 0002); null quando não houver. */
  data_limite: string | null
  chuva: { anos_bons: number; anos: number; faixa: boolean[]; rotulo: Rotulo; texto: string }
  /** Clima de 2041–2060 (NEX-GDDP-CMIP6); null enquanto não houver o dado. */
  futuro: {
    anos_bons_media: number
    anos_bons_min: number
    anos_bons_max: number
    modelos: number
    cenario: string
  } | null
  dinheiro: { margem_ha: number; rotulo: Rotulo; texto: string }
  terra: { nota: number; rotulo: Rotulo; texto: string }
  /** Notas de 0 a 100 (só na tela 9). `futuro` é null sem o CMIP6. */
  notas: { seguranca: number; futuro: number | null; solo: number; renda: number; final: number }
  porque: string[]
  como_fazer: string[]
}

export type Plano = { anos: CropId[]; nota: number; descricao: string }

export type NivelSinal = 'normal' | 'seco' | 'incerto'

/** Sinal para o outono (RF-20, PRD §7.10): GEOS-S2S + SMAP + IMERG. Chance, nunca certeza. */
export type SinalOutono = {
  nivel: NivelSinal
  motivo: string
  fonte: string[]
  /** Data da previsão usada (ISO). */
  data: string
  regra_dia_plantar: { data_limite: string; texto: string }
}

export type Recomendacao = {
  entrada: {
    celula_id: string | null
    colheita: Colheita
    semeadura: string
    solo: Textura
    nematoide: boolean | null
    gado?: boolean | null
  }
  melhor: CropId
  alternativas: { motivo: Motivo; opcao: CropId }[]
  opcoes: Opcao[]
  fora_da_janela: { id: CropId; nome: string; texto: string }[]
  pousio: { texto: string }
  plano_3_anos: { normal: Plano; seco: Plano; hoje: Plano }
  versao_dados: string
  aviso: string
  /** RF-20: ainda não vem da API (contrato proposto); só os dados de exemplo trazem. */
  sinal?: SinalOutono
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
