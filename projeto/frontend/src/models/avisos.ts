/**
 * Tela "Avisos" (`/avisos`, tarefa 0046 do backend, RF-31): contrato de `GET /api/avisos`.
 *
 * Quatro grupos: Agora, O que mudou na sua área, Fora do comum e Perto de você. Grupo `null` = sem dado
 * para o ponto (não aparece); grupo com `avisos: []` = "Nada fora do normal" com a última leitura. Cada
 * aviso traz o nível, o tipo, os números da frase, as fontes e a data da leitura; as frases ficam no
 * bloco `alerts` das mensagens (pt e en).
 */
import type { CropId, Objetivo } from './recomendacao'
import type { CurrentChoice } from './seasonAnswers'
import type { Colheita, Ponto, Textura } from './talhao'

export type NivelAviso = 'atencao' | 'fique_de_olho'

export type ValorAviso = boolean | number | string | null

/**
 * Tipos de aviso e os números de cada um (`valores`):
 * - `terra_seca`: percentil, mais_seca_que_pct (SMAP)
 * - `dias_sem_chuva`: dias, desde, no_minimo (NASA POWER)
 * - `calor`: dias, janela_dias, temp_c (NASA POWER)
 * - `enso`: fase, chance_pct, estacao, ano, cultura, nome, anos_fase, bons_fase, anos_outros, bons_outros,
 *   ano_inicio, ano_fim (NOAA e a série da célula; o histórico é `null` sem o ONI) e sinal (o veredito do
 *   sinal do outono, `normal`, `seco` ou `incerto`, o mesmo do Plano de 3 anos; `null` sem ele)
 * - `safrinha_veranico`, `safrinha_calor`: dias, cultura, nome (NASA POWER, só durante a safrinha)
 * - `mudou_veranico`, `mudou_calor` (com temp_c), `mudou_falta_agua` (com cultura e nome): antes, recente
 * - `mudou_fim_chuvas`: antes, recente ("MM-DD"), diferenca_dias
 * - `mudou_deu_certo`: antes_bons, antes_total, recente_bons, recente_total, cultura, nome
 * - `recorde_veranico`: dias, ano, inicio; `recorde_outono_seco`: chuva_mm, ano, media_mm;
 *   `recorde_fim_chuvas`: dia, ano; `recorde_calor`: dias, ano, temp_c
 * - `vizinho_evento`: evento (fogo, granizo, geada, vendaval, enxurrada_erosao, praga_doenca), relatos
 */
export type TipoAviso =
  | 'terra_seca'
  | 'dias_sem_chuva'
  | 'calor'
  | 'enso'
  | 'safrinha_veranico'
  | 'safrinha_calor'
  | 'mudou_veranico'
  | 'mudou_fim_chuvas'
  | 'mudou_calor'
  | 'mudou_falta_agua'
  | 'mudou_deu_certo'
  | 'recorde_veranico'
  | 'recorde_outono_seco'
  | 'recorde_fim_chuvas'
  | 'recorde_calor'
  | 'vizinho_evento'

export type Aviso = {
  tipo: TipoAviso | string
  nivel: NivelAviso
  /** smap, nasa_power, gpm_imerg, noaa, comunidade */
  fontes: string[]
  /** Data da leitura ("AAAA-MM-DD"). */
  data: string | null
  /** Leitura com mais dias que o limite (hoje, só o SMAP com mais de 15 dias). */
  antiga: boolean
  valores: Record<string, ValorAviso>
}

export type GrupoAvisos = { avisos: Aviso[]; ultima_leitura: string | null }

export type PeriodoComparado = {
  recente_inicio: number
  recente_fim: number
  antes_inicio: number
  antes_fim: number
}

export type SafrinhaAviso = {
  em_andamento: boolean
  cultura: string | null
  nome: string | null
  semeadura: string | null
  colheita: string | null
  /** "Ver como teriam sido os avisos em <ano>" (o último ano da série). */
  explorar_ano: number | null
}

export type Avisos = {
  ponto: Ponto
  celula_id: string
  hoje: string
  /** Avisos ativos do botão "Avisos" do cabeçalho: os de Agora e os de Perto de você. */
  contador: number
  agora: GrupoAvisos
  mudou: GrupoAvisos | null
  periodo: PeriodoComparado | null
  recordes: GrupoAvisos | null
  perto: GrupoAvisos | null
  raio_km: number
  vizinhos_dias: number
  safrinha: SafrinhaAviso | null
}

/**
 * O ponto dos avisos: o último marcado no fluxo, guardado no aparelho (sem cadastro). Desde o pacote 2 (tarefa
 * 0054), guarda junto a data da colheita (`data`), as respostas das últimas safras (`safras`) e a escolha atual
 * (`pensa`), no formato da URL. Pacote 3 (tela 7, tarefa 0062): também a cultura do 1º ano do plano (`escolha`)
 * e o objetivo da tela 5 (`objetivo`), para a linha "Seu plano" dos avisos.
 */
export type PontoAvisos = Ponto & {
  colheita?: Colheita
  solo?: Textura
  confirmadas?: string
  data?: string
  safras?: string
  pensa?: CurrentChoice
  escolha?: CropId
  objetivo?: Objetivo
  /** A lavoura de demonstração (`exemplo=1`): a tela de avisos mostra, mas o aparelho nunca guarda. */
  exemplo?: boolean
}

export type GrupoAvisosChave = 'agora' | 'mudou' | 'recordes' | 'perto'
