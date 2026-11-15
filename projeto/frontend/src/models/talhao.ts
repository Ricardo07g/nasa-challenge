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

/**
 * Chuva média de um mês na célula (mm): a média, entre os anos, da chuva total do mês (1 = janeiro).
 * `eto_media_mm` (tarefa 0042 do backend): o que a lavoura gasta no mês (ETo, a mesma do motor).
 */
export type ChuvaMes = { mes: number; media_mm: number; eto_media_mm?: number | null }

/** Chuva de cada mês da tela 3, de janeiro a junho, com o gasto da lavoura (ETo) desde a tarefa 0042. */
export type ChuvaMensal = {
  meses: ChuvaMes[]
  /** Anos que entraram na média, em ordem. */
  anos: number[]
  /** Fonte da chuva (ex.: `gpm_imerg`); mais de uma vem separada por `+`. */
  fonte: string
  /** Fonte da ETo (`nasa_power`); null ou ausente sem ETo. */
  fonte_eto?: string | null
  /** Primeiro mês (1 = janeiro) em que a chuva média fica menor que a ETo média; null se nunca fica. */
  mes_chuva_abaixo_eto?: number | null
}

/** Chuva de um dia de colheita até o fim de junho (mm): a mediana dos anos e a de um ano seco. */
export type ChuvaQueSobraDia = { dia: string; mediana_mm: number; seco_mm: number }

/** "Chuva que sobra depois da colheita" (tela 3, tarefa 0042 do backend): um item por dia da época. */
export type ChuvaQueSobra = {
  /** "MM-DD", inclusive (06-30). */
  fim: string
  /** O "ano seco" é este percentil dos anos (20). */
  percentil_seco: number
  /** De 15/jan a 31/mar ("MM-DD"), sem 29/fev. */
  dias: ChuvaQueSobraDia[]
  anos: number[]
  /** Fonte da chuva (ex.: `gpm_imerg`); mais de uma vem separada por `+`. */
  fonte: string
}

/** Um dia do calendário ("MM-DD") e o ano em que aconteceu. */
export type DiaDoAno = { dia: string; ano: number }

/** Fim das chuvas na célula (tela 3, tarefa 0042 do backend), com a regra do `regras.yaml`. */
export type FimDasChuvas = {
  /** Em metade dos anos, a chuva acabou até esse dia ("MM-DD"). */
  mediana: string
  mais_cedo: DiaDoAno
  mais_tarde: DiaDoAno
  anos: number[]
  fonte: string
  /** A regra: a partir de `inicio` ("MM-DD"), `dias` dias seguidos com menos de `chuva_max_mm` mm somados. */
  inicio: string
  dias: number
  chuva_max_mm: number
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
  /** `dia` ("MM-DD", tarefa 0042): o dia em que a soja costuma secar pelo NDVI; null sem NDVI. */
  colheita_sugerida: {
    faixa: Colheita
    fonte: 'ndvi_modis' | 'padrao'
    anos_usados: number
    dia?: string | null
  } | null
  historico: Historico | null
  dados: { fonte: string; periodo: string; cenario?: string; modelos?: number }[]
  /** null fora da área ou sem dado; ausente na API que ainda não manda o campo. */
  chuva_mensal?: ChuvaMensal | null
  /** null sem o dado ou fora da área medida; ausente na API que ainda não manda o campo. */
  soja_recente?: SojaRecente | null
  /** Entressafras que o produtor pode confirmar na tela 4 (as 3 últimas); ausente na API antiga. */
  anos_confirmaveis?: number[] | null
  /** Tela 3 (tarefa 0042): null sem dado; ausente na API antiga. */
  chuva_que_sobra?: ChuvaQueSobra | null
  /** Tela 3 (tarefa 0042): null sem dado (ou algum ano sem fim das chuvas); ausente na API antiga. */
  fim_das_chuvas?: FimDasChuvas | null
}
