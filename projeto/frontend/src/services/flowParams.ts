import { OBJETIVOS, type CropId, type Objetivo } from '../models/recomendacao'
import type { CurrentChoice } from '../models/seasonAnswers'
import { COLHEITAS, TEXTURAS, type Colheita, type Textura } from '../models/talhao'
import { formatConfirmadas, parseConfirmadas } from './confirmedSeasonsService'
import { formatToday, parseCompared, parseCrop, parsePlan, parseToday } from './cropListParams'
import { formatSeasonAnswers, parseCurrentChoice, parseSeasonAnswers } from './seasonAnswersService'

/** O que a URL guarda entre as telas (RF-18): dá para recarregar ou compartilhar a mesma resposta. */
export type FlowParams = {
  lat: number
  lon: number
  colheita?: Colheita
  solo?: Textura
  exemplo?: boolean
  /** "O que você quer mais?" (tarefa 0044): vale nas três abas da resposta; sem ele, o equilíbrio do motor. */
  objetivo?: Objetivo
  /** Safras confirmadas na tela 4, já no formato da URL e em ordem de ano ("2024:plantou,2025:parado"). */
  confirmadas?: string
  /** Aba Comparar (tarefa 0045): até 3 culturas escolhidas; sem elas, as 3 melhores do objetivo. */
  comparar?: CropId[]
  /** Aba Plano (tarefa 0045): os 3 anos do plano editado; sem ele, o plano sugerido do objetivo. */
  plano?: CropId[]
  /** "Como é hoje" (tarefa 0045): o que o produtor plantou nas últimas safras ("2024:pousio,2025:sorgo"). */
  hoje?: string
  /** Pacote 2 (tarefa 0054): a data da colheita escolhida na tela 2, "AAAA-MM-DD". */
  data?: string
  /**
   * Pacote 2 (tarefa 0054): as respostas das últimas safras, no formato da URL e em ordem de ano
   * ("2024:milho_braquiaria,2025:pousio,2026:sem_soja"). Regras em `seasonAnswersService`.
   */
  safras?: string
  /** Pacote 2 (tarefa 0054): o que o produtor pensa plantar depois da soja 2026/27 (uma cultura ou "nao_sei"). */
  pensa?: CurrentChoice
  /**
   * Tela 5 do pacote 2: a cultura escolhida para o plano (o 1º ano). Sem ela, vale a escolha atual (`pensa`) ou,
   * com "Ainda não sei", a sugestão.
   */
  escolha?: CropId
  /** Tela 5: o 2º e o 3º ano que o produtor mudou no plano; sem eles, a sugestão em cadeia do motor. */
  ano2?: CropId
  ano3?: CropId
}

function readNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function readFlowParams(search: URLSearchParams): (FlowParams & { exemplo: boolean }) | null {
  const lat = readNumber(search.get('lat'))
  const lon = readNumber(search.get('lon'))
  if (lat === null || lon === null) return null
  const colheita = search.get('colheita')
  const solo = search.get('solo')
  const objetivo = search.get('objetivo')
  return {
    lat,
    lon,
    colheita: COLHEITAS.includes(colheita as Colheita) ? (colheita as Colheita) : undefined,
    solo: TEXTURAS.includes(solo as Textura) ? (solo as Textura) : undefined,
    exemplo: search.get('exemplo') === '1',
    objetivo: OBJETIVOS.includes(objetivo as Objetivo) ? (objetivo as Objetivo) : undefined,
    confirmadas: formatConfirmadas(parseConfirmadas(search.get('confirmadas'))),
    comparar: parseCompared(search.get('comparar')),
    plano: parsePlan(search.get('plano')),
    hoje: formatToday(parseToday(search.get('hoje'))),
    data: readDate(search.get('data')),
    safras: formatSeasonAnswers(parseSeasonAnswers(search.get('safras'))),
    pensa: parseCurrentChoice(search.get('pensa')),
    escolha: parseCrop(search.get('escolha')),
    ano2: parseCrop(search.get('ano2')),
    ano3: parseCrop(search.get('ano3')),
  }
}

/** "AAAA-MM-DD" que existe no calendário (2027-02-30 não passa). */
function readDate(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : undefined
}

const round = (value: number) => Number(value.toFixed(4))

export function buildFlowQuery(params: FlowParams): string {
  const query = new URLSearchParams()
  query.set('lat', String(round(params.lat)))
  query.set('lon', String(round(params.lon)))
  if (params.colheita) query.set('colheita', params.colheita)
  if (params.data) query.set('data', params.data)
  if (params.solo) query.set('solo', params.solo)
  if (params.exemplo) query.set('exemplo', '1')
  if (params.objetivo) query.set('objetivo', params.objetivo)
  // No fim e sem codificar ":" e ",": o link fica legível para compartilhar (só dígitos, letras, ":" e ",").
  const confirmadas = params.confirmadas ? `&confirmadas=${params.confirmadas}` : ''
  // Tarefa 0045: as listas de culturas também vão sem codificar (só letras, "_", ":" e ",").
  const comparar = params.comparar?.length ? `&comparar=${params.comparar.join(',')}` : ''
  const plano = params.plano?.length ? `&plano=${params.plano.join(',')}` : ''
  const hoje = params.hoje ? `&hoje=${params.hoje}` : ''
  // Pacote 2 (tarefa 0054): as respostas das últimas safras e a escolha atual, também legíveis.
  const safras = params.safras ? `&safras=${params.safras}` : ''
  const pensa = params.pensa ? `&pensa=${params.pensa}` : ''
  // Tela 5: a escolha do plano e os anos mudados (só letras e "_").
  const plan = (['escolha', 'ano2', 'ano3'] as const).map((key) => (params[key] ? `&${key}=${params[key]}` : '')).join('')
  return `?${query.toString()}${confirmadas}${comparar}${plano}${hoje}${safras}${pensa}${plan}`
}

/** Query da URL atual que segue para o próximo link ("" se ainda não tem ponto marcado). */
export function keepFlowQuery(search: string): string {
  const params = readFlowParams(new URLSearchParams(search))
  return params ? buildFlowQuery(params) : ''
}
