/** Tipos do contrato `GET /api/raio-x` (tela 4 "O que o satélite viu", tarefa 0043 do backend). */

import type { Colheita, FimDasChuvas, Ponto, Textura } from './talhao'

/** Bloco 1: SoilGrids. `vizinho_km` = solo do ponto gravado mais perto, de outra célula. */
export type SoloRaioX = { textura: Textura; argila_pct: number; areia_pct: number; cad_mm: number; vizinho_km: number | null }

/** Bloco 2: água que a terra guarda (CAD) e quantos dias ela dura na floração da cultura sugerida. */
export type AguaTerra = {
  cad_mm: number
  dias: number | null
  cultura: string | null
  nome: string | null
  /** "MM-DD" */
  floracao: string | null
  eto_mm_dia: number | null
  kc: number | null
  consumo_mm_dia: number | null
  fonte_eto: string
}

/** Bloco 3: percentil do SMAP de agora (0 a 100) e o dia da leitura (ISO). */
export type UmidadeAgora = { percentil: number; data: string }

/** Bloco 4: a última leitura do NDVI e o pico da soja na safra mais recente. */
export type VerdeLavoura = {
  ultimo_ndvi: number | null
  ultimo_data: string | null
  pico_ndvi: number | null
  pico_data: string | null
  safra: string | null
  fonte: string
  /** O satélite viu a soja no verão do pico? false = o pico é só o maior verde de jan–mar (tarefa 0049). */
  soja_vista?: boolean | null
}

/** Bloco 5: total médio de janeiro a julho e o fim das chuvas (regra da tela 3). */
export type ChuvaTipica = { media_mm: number; anos: number[]; fonte: string; fim_das_chuvas: FimDasChuvas | null }

/** Bloco 6: a maior sequência de dias com menos de 1 mm de março a maio. `inicio` = "MM-DD". */
export type Veranico = { dias: number; ano: number; inicio: string; total_anos: number; fonte: string }

/** Bloco 7: anos com dia de 35 °C ou mais de março a maio. */
export type CalorOutono = { anos_com_calor: number; total_anos: number; temp_c: number; anos: number[]; fonte: string }

/** Bloco 8: a chuva de março a maio da célula comparada com as outras células da caixa. */
export type RegiaoChuva = {
  chuva_mm: number
  mediana_regiao_mm: number
  celulas: number
  /** % das outras células com mais chuva (a sua área é mais seca que elas). */
  pct_mais_seca: number
  /** % das outras células com menos chuva. */
  pct_mais_chuvosa: number
  fonte: string
}

/** Uma linha da faixa de calor: o NDVI de cada coluna de 16 dias (null = sem leitura boa). */
export type FaixaNdviAno = { ano: number; valores: (number | null)[] }

export type FaixaNdvi = {
  /** "MM-DD" do começo de cada coluna, de janeiro a julho. */
  colunas: string[]
  anos: FaixaNdviAno[]
  fonte: string
  /** "MM-DD": o dia em que a soja costuma secar; null sem NDVI suficiente. */
  colheita_dia: string | null
}

export type AlertaGeada = { anos: number[]; total_anos: number; temp_c: number; menor_temp_c: number; fonte: string }
export type AlertaChuvaForte = { media_dias_ano: number; dias: number; total_anos: number; limite_mm: number; fonte: string }
export type AlertaFogo = { anos: number[]; total_anos: number; raio_km: number; fonte: string }

export type AlertasArea = { geada: AlertaGeada | null; chuva_forte: AlertaChuvaForte | null; fogo: AlertaFogo | null }

export type ChuvaVinteAnos = { cultura: string; nome: string; anos_bons: number; total_anos: number }

export type ClimaFuturo = {
  chuva_pct: number
  tmax_c: number
  modelos: number
  modelos_menos_chuva: number
  modelos_mais_chuva: number
  modelos_mais_quente: number
  cenario: string
  periodo: string
}

export type RaioX = {
  ponto: Ponto
  celula_id: string
  /** Dia da leitura mais recente (ISO), do SMAP ou do NDVI. */
  leitura_recente: string | null
  /** Só se existir no `grid_cell` (hoje não existe). */
  altitude_m: number | null
  solo: SoloRaioX | null
  agua: AguaTerra | null
  umidade: UmidadeAgora | null
  verde: VerdeLavoura | null
  chuva: ChuvaTipica | null
  veranico: Veranico | null
  calor: CalorOutono | null
  regiao: RegiaoChuva | null
  historico_ndvi: FaixaNdvi | null
  alertas: AlertasArea
  cartoes: { chuva_20_anos: ChuvaVinteAnos | null; clima_futuro: ClimaFuturo | null }
}

export type RaioXParams = { lat: number; lon: number; colheita: Colheita; solo?: Textura; confirmadas?: string }
