import type { Colheita, Talhao, Textura } from './talhao'

/** Tipos do contrato `GET /api/recomendacao` (plano técnico do backend, §3.2). */

export type Rotulo = 'bom' | 'medio' | 'fraco'

export type Eixo = 'chuva' | 'renda' | 'terra'

export type Motivo = 'menos_risco' | 'mais_renda' | 'cuidar_da_terra'

export type CropId = 'milho_braquiaria' | 'milho_safrinha' | 'sorgo' | 'milheto' | 'crotalaria' | 'pousio'

/** P1 (RF-22): o que aconteceu em cada ano da série; vem de `/api/recomendacao` (tarefa 0035 do backend). */
export type AnoDetalhe = {
  ano: number
  bom: boolean
  /** Data em que a planta chega na fase que mais precisa de água (ISO). */
  fase_critica: string
  dias_sem_chuva: number
  enso: 'el_nino' | 'la_nina' | null
  texto: string
}

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
  /**
   * Renda só com fatos (tarefa 0040 do backend, antes `dinheiro`): nenhum valor em reais.
   * `texto`: "Dá grão para vender" ou "Não dá grão: é investimento na terra"; `risco`: "Risco de perder a
   * lavoura: faltou água ou fez calor em N de 20 anos." (N = `anos_aperto`, os anos com aperto do motor).
   */
  renda: { da_grao: boolean; anos_aperto: number; rotulo: Rotulo; texto: string; risco: string }
  terra: { nota: number; rotulo: Rotulo; texto: string }
  /** Notas de 0 a 100 (só na tela 9). `futuro` é null sem o CMIP6. */
  notas: { seguranca: number; futuro: number | null; solo: number; renda: number; final: number }
  porque: string[]
  como_fazer: string[]
  /** P1: um item por ano da faixa de chuva, para tocar e ver o que aconteceu. */
  anos_detalhe?: AnoDetalhe[]
}

export type Plano = { anos: CropId[]; nota: number; descricao: string }

export type NivelSinal = 'normal' | 'seco' | 'incerto'

/** Regra da data (tarefa 0038): chuva de `inicio` à véspera de `data_limite` abaixo de `chuva_min_mm` → Plano B. */
export type RegraData = {
  data_limite: string
  inicio: string
  dias: number
  chuva_min_mm: number
  /** Média desses dias na série de chuva guardada da célula. */
  media_mm: number
}

/** A umidade da terra agora pelo SMAP (tarefa 0038): só informa, não decide o plano. */
export type SmapAgora = { percentil: number; data: string; texto: string }

/**
 * Sinal para o outono (RF-20, tarefa 0038): previsão do El Niño / La Niña da NOAA + como a opção do 1º ano do
 * Plano A se saiu nos anos daquela fase. Chance, nunca certeza.
 */
export type SinalOutono = {
  nivel: NivelSinal
  motivo: string
  /** Fontes usadas; a 1ª é a da previsão do ENSO (ex.: "NOAA"). */
  fonte: string[]
  /** Dia em que a previsão do ENSO foi publicada (ISO). */
  data: string
  /** Com a série de chuva, o texto é a regra da data. */
  regra_dia_plantar: { data_limite: string; texto: string }
  regra_data?: RegraData | null
  smap_agora?: SmapAgora | null
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
  /** RF-20: null (ou ausente) sem a previsão do ENSO na API: o bloco do sinal não aparece. */
  sinal?: SinalOutono | null
}

export type RecomendacaoParams = {
  lat: number
  lon: number
  colheita: Colheita
  solo?: Textura
  /** Safras confirmadas pelo produtor na tela 4, no formato da URL (ex.: "2024:plantou,2025:parado"). */
  confirmadas?: string
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
