import type { AlertaGeada, ClimaFuturo } from './raioX'
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
  /**
   * Explorador ano a ano da aba Sugestão (tarefa 0044 do backend): a água na fase crítica em fração do
   * que a planta precisa (o ISNA do motor, 0 a 1), os dias de 35 °C nessa fase, o porquê do aperto, o dia
   * de plantar (ISO) e a umidade da terra no dia de plantar pelo SMAP (0 a 1; só de 2016 em diante).
   * Opcionais: sem eles (API antiga), o explorador não aparece.
   */
  isna?: number
  dias_calor?: number
  falta_agua?: boolean
  calor?: boolean
  semeadura?: string | null
  umidade_inicial?: number | null
}

/** Sede da cultura pelo consumo no ciclo (cortes do `regras.yaml`, grupo `agua`). */
export type Sede = 'pouca' | 'media' | 'muita'

/**
 * Linha "Água" da opção para a data de plantio escolhida (tarefa 0044 do backend): medianas do balanço
 * hídrico do motor nos dias do ciclo, em mm. `falta_seco_mm` é o ano seco (só 20% dos anos piores).
 */
export type AguaOpcao = {
  precisa_mm: number
  chove_mm: number
  falta_normal_mm: number
  falta_seco_mm: number
  sede: Sede
  /** Água que a terra guarda na conta (mm). */
  cad_mm: number
  anos: number
  /** Falta de água em ano normal em 2041–2060: média dos modelos, faixa e a mudança contra hoje. */
  futuro: { falta_normal_mm: number; falta_min_mm: number; falta_max_mm: number; mudanca_mm: number; modelos: number } | null
}

/** O critério real de "deu certo" do motor (PRD 7.2), para a tela explicar sem número fixo. */
export type CriterioDeuCerto = {
  /** ISNA mínimo (0 a 1) na fase crítica. */
  isna_min: number
  calor_temp_c: number
  /** Com esse número de dias de calor ou mais na fase, o ano apertou. */
  calor_min_dias: number
  /** `floracao`: `janela_dias` antes e depois da floração; `pegamento`: os primeiros `janela_dias`. */
  fase: 'floracao' | 'pegamento'
  janela_dias: number
}

/** Taxa de acerto nos anos de uma fase do ENSO e nos outros; `clara` = a diferença passa do critério. */
export type EnsoAcerto = {
  fase: 'el_nino' | 'la_nina'
  anos: number
  bons: number
  anos_outros: number
  bons_outros: number
  clara: boolean
}

export type Objetivo = 'seguranca' | 'renda' | 'terra'

/** "O que você quer mais?" (tarefa 0044): sem objetivo, `equilibrio` (pesos padrão do motor). */
export type ObjetivoChave = Objetivo | 'equilibrio'

export const OBJETIVOS: readonly Objetivo[] = ['seguranca', 'renda', 'terra']

/**
 * Ordem das opções e plano sugerido para um objetivo, prontos no motor. `motivos` (tarefa 0065 do backend): o porquê
 * de cada ano do plano em cadeia, na ordem do `plano` (null no 1º ano); ausente na API antiga.
 */
export type ObjetivoResultado = { ordem: CropId[]; plano: CropId[]; nota_plano: number; motivos?: (string | null)[] }

export type Opcao = {
  id: CropId
  nome: string
  na_janela: boolean
  /**
   * Passou do prazo do ZARC (tarefa 0056 do backend): a cultura vem com a conta inteira (plantio logo depois da
   * colheita), depois das que estão no prazo, para ser comparada e escolhida com o aviso. Nunca é a sugestão.
   * Ausente (API antiga) = `!na_janela`.
   */
  fora_do_prazo?: boolean
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
  /** Aba Sugestão (tarefa 0044 do backend); opcionais: sem o campo, o elemento não aparece. */
  agua?: AguaOpcao | null
  criterio?: CriterioDeuCerto | null
  /** Ciclo e dias até a floração (`culturas.yaml`). */
  ciclo?: { dias: number; floracao_dias: number } | null
  /** Veranico típico da fase crítica (mediana, dias) e anos com calor nela. */
  observar?: { veranico_dias: number; anos_calor: number; total: number } | null
  enso_acerto?: EnsoAcerto[]
}

/**
 * Um plano de 3 anos do motor. `motivos` (tarefa 0065 do backend): só no Plano A (`normal`), o porquê de cada ano da
 * sugestão em cadeia (null no 1º ano); null no `seco` e no `hoje`, ausente na API antiga.
 */
export type Plano = { anos: CropId[]; nota: number; descricao: string; motivos?: (string | null)[] | null }

export type NivelSinal = 'normal' | 'seco' | 'incerto'

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
  /** `data_limite` (ISO, tarefa 0044): o aviso único da colheita tarde junta as culturas por data. */
  fora_da_janela: { id: CropId; nome: string; texto: string; data_limite?: string | null }[]
  pousio: { texto: string }
  plano_3_anos: { normal: Plano; seco: Plano; hoje: Plano }
  versao_dados: string
  aviso: string
  /** RF-20: null (ou ausente) sem a previsão do ENSO na API: o bloco do sinal não aparece. */
  sinal?: SinalOutono | null
  /** Tarefa 0044: ordem e plano por objetivo do produtor (o navegador só escolhe). */
  objetivos?: Partial<Record<ObjetivoChave, ObjetivoResultado>>
  /**
   * Clima de 2041–2060 na célula: o mesmo do cartão do raio-X (tarefa 0049), para as duas telas dizerem o
   * mesmo número; null sem o CMIP6.
   */
  clima_futuro?: ClimaFuturo | null
  /** Alerta de geada da célula, o mesmo do raio-X: null sem nenhum ano com geada. */
  geada?: AlertaGeada | null
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
export const COVER_CROPS: ReadonlySet<CropId> = new Set([
  'milho_braquiaria',
  'milho_safrinha',
  'sorgo',
  'milheto',
  'crotalaria',
])
