/** Tipos do contrato `GET /api/talhao` (plano técnico do backend, §3.1). */

export type Colheita = 'cedo' | 'meio' | 'tarde'

export const COLHEITAS: readonly Colheita[] = ['cedo', 'meio', 'tarde']

export type Textura = 'arenoso' | 'medio' | 'argiloso'

export const TEXTURAS: readonly Textura[] = ['arenoso', 'medio', 'argiloso']

export type Ponto = { lat: number; lon: number }

/**
 * Entressafra de um ano pelo NDVI do MODIS (guia do NDVI, regra do talhão): `incerto` = NDVI entre os
 * limites; `sem_dado` = poucas imagens sem nuvem na janela. Na tela, os dois viram "sem certeza".
 * `sem_soja` (tarefa 0039 do backend): o satélite não viu a soja e a colheita no verão; o ano não conta
 * como parado, plantou nem sem certeza.
 */
export type SituacaoAno = 'plantou' | 'parado' | 'incerto' | 'sem_dado' | 'sem_soja'

/** De onde veio a situação do ano: do satélite ou da resposta do produtor. */
export type FonteAno = 'satelite' | 'produtor'

export type HistoricoAno = {
  ano: number
  situacao: SituacaoAno
  /** Maior NDVI da janela; null quando não houve observação boa (ou sem soja). */
  ndvi_max: number | null
  /** Observações boas (sem nuvem) na janela. */
  n_obs: number
  /** Ausente na API antiga (= satélite). */
  fonte_ano?: FonteAno
}

export type Historico = {
  anos: HistoricoAno[]
  parado: number
  plantou: number
  /** `incerto` + `sem_dado`. */
  sem_certeza: number
  /** Anos sem a soja no verão; ausente na API antiga. */
  sem_soja?: number
  total: number
  fonte: string
  /** Janela olhada em cada ano, "MM-DD a MM-DD" (ex.: "04-01 a 07-31"). */
  janela: string
}

/** O que o produtor confirma numa das últimas entressafras: "Plantei" ou "Deixei parado". */
export type Confirmacao = 'plantou' | 'parado'

export const CONFIRMACOES: readonly Confirmacao[] = ['plantou', 'parado']

/** Safras confirmadas pelo produtor: ano → resposta (vale no lugar do satélite naquele ano). */
export type Confirmadas = Readonly<Partial<Record<number, Confirmacao>>>

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

/**
 * Soja vista no ponto na safra mais recente (RF-24): o maior NDVI do MODIS de 1/jan a 15/mar no pixel
 * de 250 m. `vista` e `ndvi_pico` são null quando o pixel não teve imagens boas suficientes.
 */
export type SojaRecente = {
  /** Ex.: "2025/26" (soja colhida em fevereiro de 2026). */
  safra: string
  vista: boolean | null
  ndvi_pico: number | null
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
  /** null sem o dado ou fora da área medida; ausente na API que ainda não manda o campo. */
  soja_recente?: SojaRecente | null
  /** Entressafras que o produtor pode confirmar na tela 4 (as 3 últimas); ausente na API antiga. */
  anos_confirmaveis?: number[] | null
}
