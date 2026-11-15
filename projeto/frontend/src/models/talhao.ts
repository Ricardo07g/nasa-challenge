/** Tipos do contrato `GET /api/talhao` (plano técnico do backend, §3.1). */

export type Colheita = 'cedo' | 'meio' | 'tarde'

export const COLHEITAS: readonly Colheita[] = ['cedo', 'meio', 'tarde']

export type Textura = 'arenoso' | 'medio' | 'argiloso'

export const TEXTURAS: readonly Textura[] = ['arenoso', 'medio', 'argiloso']

export type Ponto = { lat: number; lon: number }

/**
 * Entressafra de um ano pelo NDVI do MODIS (guia do NDVI, regra do talhão): `incerto` = NDVI entre os
 * limites; `sem_dado` = poucas imagens sem nuvem na janela. Na tela, os dois viram "sem certeza".
 */
export type SituacaoAno = 'plantou' | 'parado' | 'incerto' | 'sem_dado'

export type HistoricoAno = {
  ano: number
  situacao: SituacaoAno
  /** Maior NDVI da janela; null quando não houve observação boa. */
  ndvi_max: number | null
  /** Observações boas (sem nuvem) na janela. */
  n_obs: number
}

export type Historico = {
  anos: HistoricoAno[]
  parado: number
  plantou: number
  /** `incerto` + `sem_dado`. */
  sem_certeza: number
  total: number
  fonte: string
  /** Janela olhada em cada ano, "MM-DD a MM-DD" (ex.: "04-01 a 07-31"). */
  janela: string
}

/** Chuva média de um mês na célula (mm): a média, entre os anos, da chuva total do mês (1 = janeiro). */
export type ChuvaMes = { mes: number; media_mm: number }

/** Gráfico "Chuva de cada mês na região" da tela 3: janeiro a junho. */
export type ChuvaMensal = {
  meses: ChuvaMes[]
  /** Anos que entraram na média, em ordem. */
  anos: number[]
  /** Fonte da chuva (ex.: `nasa_power`); mais de uma vem separada por `+`. */
  fonte: string
}

export type Talhao = {
  ponto: Ponto
  celula_id: string | null
  dentro_da_area: boolean
  solo: { textura: Textura; cad_mm: number; fonte: 'soilgrids' | 'padrao' | 'usuario' } | null
  colheita_sugerida: { faixa: Colheita; fonte: 'ndvi_modis' | 'padrao'; anos_usados: number } | null
  historico: Historico | null
  dados: { fonte: string; periodo: string; cenario?: string; modelos?: number }[]
  /** null fora da área ou sem dado; ausente na API que ainda não manda o campo. */
  chuva_mensal?: ChuvaMensal | null
}
