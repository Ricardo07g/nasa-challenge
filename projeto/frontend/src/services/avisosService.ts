import type { Lang } from '../i18n/language'
import type { Aviso, Avisos, NivelAviso, PontoAvisos } from '../models/avisos'
import type { SafraPassada } from '../models/pastSeason'
import type { CropId, Recomendacao } from '../models/recomendacao'
import { avisosRepository as defaultRepository, savedPointRepository as defaultSaved } from '../repositories'
import type { AvisosRepository } from '../repositories/avisosRepository'
import type { SavedPointRepository } from '../repositories/savedPointRepository'
import { isLate, planChoice } from './choiceService'
import { CROP_IDS } from './cropListParams'
import type { FlowParams } from './flowParams'
import { confirmadasFromAnswers, currentChoiceCrop, parseSeasonAnswers } from './seasonAnswersService'

export type AvisosService = {
  /**
   * Os avisos do ponto; o mesmo pedido serve o botão do cabeçalho e a tela (um por ponto, idioma e cultura na
   * visita). `cultura`: a do 1º ano do plano (tarefa 0065 do backend), para a falta de água e o "deu certo".
   */
  get(point: PontoAvisos, lang: Lang, cultura?: CropId | null): Promise<Avisos>
  savedPoint(): PontoAvisos | null
  savePoint(point: PontoAvisos): void
}

function cacheKey(point: PontoAvisos, lang: Lang, cultura: CropId | null): string {
  return `${lang}|${point.lat}|${point.lon}|${point.colheita ?? ''}|${point.solo ?? ''}|${point.confirmadas ?? ''}|${cultura ?? ''}`
}

/**
 * Tela "Avisos" (tarefa 0046 do backend, RF-31; refeita no pacote 3, tarefa 0062): as regras do que vira aviso
 * ficam no backend (`/api/avisos`); aqui só o ponto salvo no aparelho, um pedido por ponto e idioma na visita e
 * como a tela arruma os dados (resumo, ordem, quadros, a linha do plano e o exemplo de um ano).
 */
export function createAvisosService(
  repository: AvisosRepository = defaultRepository,
  saved: SavedPointRepository = defaultSaved,
): AvisosService {
  const cache = new Map<string, Promise<Avisos>>()
  return {
    get(point, lang, cultura = null) {
      const key = cacheKey(point, lang, cultura)
      const cached = cache.get(key)
      if (cached) return cached
      const request = repository.get(point, lang, cultura)
      cache.set(key, request)
      request.catch(() => cache.delete(key))
      return request
    },
    savedPoint: () => saved.get(),
    savePoint: (point) => saved.save(point),
  }
}

export const avisosService = createAvisosService()

/** O ponto do fluxo que o aparelho guarda para os avisos: o marcado pelo produtor, nunca a fazenda de exemplo. */
export function pointFromFlow(params: (FlowParams & { exemplo: boolean }) | null): PontoAvisos | null {
  if (!params || params.exemplo) return null
  return flowPoint(params)
}

/**
 * O ponto que a tela (e o número do sino) mostra (pacote 3, tela 7): o da URL, inclusive a lavoura de
 * demonstração, marcada com `exemplo` para a tela dizer o nome dela. Guardar continua com o `pointFromFlow`.
 */
export function viewPointFromFlow(params: (FlowParams & { exemplo: boolean }) | null): PontoAvisos | null {
  if (!params) return null
  const point = flowPoint(params)
  if (params.exemplo) point.exemplo = true
  return point
}

function flowPoint(params: FlowParams): PontoAvisos {
  const point: PontoAvisos = { lat: params.lat, lon: params.lon }
  if (params.colheita) point.colheita = params.colheita
  if (params.solo) point.solo = params.solo
  // Pacote 2 (tarefa 0054): com as respostas das safras, o `confirmadas` dos avisos sai delas.
  const confirmadas = params.safras ? confirmadasFromAnswers(parseSeasonAnswers(params.safras)) : params.confirmadas
  if (confirmadas) point.confirmadas = confirmadas
  if (params.data) point.data = params.data
  if (params.safras) point.safras = params.safras
  if (params.pensa) point.pensa = params.pensa
  // Pacote 3 (tela 7): o plano da tela 5, para a linha "Seu plano".
  if (params.escolha) point.escolha = params.escolha
  if (params.objetivo) point.objetivo = params.objetivo
  return point
}

/** O ponto da URL (o que a pessoa está olhando) vem antes do salvo no aparelho. */
export function alertsPoint(flow: PontoAvisos | null, saved: PontoAvisos | null): PontoAvisos | null {
  return flow ?? saved
}

/**
 * Quantos avisos ativos (pacote 3, tela 7): só os que a tela mostra, os cartões de "Agora". Desde a tarefa 0065 do
 * backend, o `contador` da API também conta só o "Agora", mas inclui tipos que a tela não sabe escrever; contado
 * aqui, o sino e o resumo dizem o mesmo número que os cartões.
 */
export function activeCount(avisos: Avisos): number {
  return nowAlerts(avisos).length
}

/** Número do botão "Avisos" do cabeçalho: só com aviso ativo (sem aviso, o botão fica sem número). */
export function headerCount(avisos: Avisos | null | undefined): number | null {
  const count = avisos ? activeCount(avisos) : 0
  return count > 0 ? count : null
}

export type AlertsTone = 'ok' | 'watch' | 'attention'

/** O cartão do resumo (pacote 3, tela 7): quantos avisos, quantos pedem atenção e a cor. */
export type AlertsSummary = { count: number; attention: number; tone: AlertsTone }

/**
 * O resumo do topo: o número é o mesmo do sino (`activeCount`); verde sem aviso, laranja com algum "Atenção" e
 * azul só com "Fique de olho".
 */
export function alertsSummary(avisos: Avisos): AlertsSummary {
  const shown = nowAlerts(avisos)
  const count = shown.length
  const attention = shown.filter((aviso) => aviso.nivel === 'atencao').length
  const tone: AlertsTone = count === 0 ? 'ok' : attention > 0 ? 'attention' : 'watch'
  return { count, attention, tone }
}

/** Os tipos de "Agora" que a tela sabe escrever (os outros não aparecem). */
const NOW_TYPES: readonly string[] = ['terra_seca', 'dias_sem_chuva', 'calor', 'enso', 'safrinha_veranico', 'safrinha_calor']

const LEVEL_ORDER: Record<NivelAviso, number> = { atencao: 0, fique_de_olho: 1 }

/** Os cartões de "Agora": "Atenção" primeiro, na ordem da API dentro de cada nível. "Perto de você" saiu da tela. */
export function nowAlerts(avisos: Avisos): Aviso[] {
  return avisos.agora.avisos
    .filter((aviso) => NOW_TYPES.includes(aviso.tipo))
    .map((aviso, index) => ({ aviso, index }))
    .sort((a, b) => LEVEL_ORDER[a.aviso.nivel] - LEVEL_ORDER[b.aviso.nivel] || a.index - b.index)
    .map(({ aviso }) => aviso)
}

const WEEK_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/** "Leituras de satélite e previsão desta semana" só com a última leitura até 7 dias antes de hoje. */
export function recentReadings(today: string, lastReading: string | null): boolean {
  if (!lastReading) return false
  return (Date.parse(today) - Date.parse(lastReading)) / DAY_MS <= WEEK_DAYS
}

/** "Como a sua área está mudando": a ordem do pedido e, se sobrar lugar, o calor. */
const CHANGE_ORDER: readonly string[] = [
  'mudou_veranico',
  'mudou_fim_chuvas',
  'mudou_falta_agua',
  'mudou_deu_certo',
  'mudou_calor',
]
/** Os quadros que dependem da cultura (a falta de água e o "deu certo"). */
const CROP_CHANGES: readonly string[] = ['mudou_falta_agua', 'mudou_deu_certo']
const MAX_TILES = 4

function inOrder(avisos: readonly Aviso[], order: readonly string[]): Aviso[] {
  return order.flatMap((tipo) => avisos.filter((aviso) => aviso.tipo === tipo))
}

/**
 * Os quadros de "Como a sua área está mudando" (até 4). Os da cultura valem só para a cultura do 1º ano do plano
 * (`planCrop`): a tela manda essa cultura à API (tarefa 0065 do backend), e um quadro de outra cultura (resposta
 * antiga ou pedido sem a cultura) não aparece. Sem a cultura do plano, ficam os da API.
 */
export function changeTiles(avisos: Avisos, planCrop: string | null): Aviso[] {
  const list = inOrder(avisos.mudou?.avisos ?? [], CHANGE_ORDER).filter(
    (aviso) => !planCrop || !CROP_CHANGES.includes(aviso.tipo) || aviso.valores.cultura === planCrop,
  )
  return list.slice(0, MAX_TILES)
}

const RECORD_ORDER: readonly string[] = ['recorde_veranico', 'recorde_outono_seco', 'recorde_fim_chuvas', 'recorde_calor']

/** Os quadros de "Já aconteceu aqui": maior veranico, outono mais seco, chuva que acabou mais cedo e mais calor. */
export function recordTiles(avisos: Avisos): Aviso[] {
  return inOrder(avisos.recordes?.avisos ?? [], RECORD_ORDER).slice(0, MAX_TILES)
}

const isCrop = (value: string | null | undefined): value is CropId => !!value && (CROP_IDS as readonly string[]).includes(value)

/**
 * A cultura do 1º ano do plano, como na tela 5: a escolha (`escolha`), senão o que o produtor pensa plantar
 * (`pensa`), senão a sugestão. Com a recomendação na mão, a regra é a da tela 5 (`planChoice`, com o objetivo);
 * sem ela, a sugestão é a dos avisos (`safrinha.cultura`).
 */
export function planCropOf(point: PontoAvisos, recomendacao: Recomendacao | null, suggestion: string | null): CropId | null {
  if (recomendacao) return planChoice(recomendacao, point.objetivo ?? null, point)
  return point.escolha ?? currentChoiceCrop(point.pensa) ?? (isCrop(suggestion) ? suggestion : null)
}

/** "Seu plano: {cultura}, plantio até {prazo}": o prazo é o "Prazo para plantar" da tela 5 (`data_limite`). */
export type PlanLine = { crop: CropId; deadline: string | null; late: boolean }

export function planLine(crop: CropId | null, recomendacao: Recomendacao | null): PlanLine | null {
  if (!crop) return null
  const option = recomendacao?.opcoes.find((opcao) => opcao.id === crop)
  if (!option) return { crop, deadline: null, late: false }
  return { crop, deadline: option.data_limite ?? null, late: isLate(option) }
}

/** "Ver exemplo: avisos de <ano>": o último ano da série, só fora da safrinha (como o link antigo). */
export function exampleYear(avisos: Avisos): number | null {
  const safrinha = avisos.safrinha
  return safrinha && !safrinha.em_andamento ? safrinha.explorar_ano : null
}

/** Uma linha do exemplo: um aviso do replay daquele ano ou um recorde da área no mesmo ano. */
export type ExampleRow =
  | { kind: 'replay'; tipo: 'aviso_veranico' | 'aviso_calor'; date: string; texto: string; since: string | null }
  | { kind: 'record'; aviso: Aviso }

/**
 * O exemplo de um ano, com dado real (pacote 3, tela 7): os avisos que o produtor teria recebido no replay
 * (`GET /api/safra-passada`, as regras do `CropAlertService`), com o dia em que parou de chover no veranico, e os
 * recordes da área (`recordes` do `/api/avisos`) que caíram naquele ano.
 */
export function exampleRows(year: number, replay: SafraPassada | null, avisos: Avisos): ExampleRow[] {
  const replayRows: ExampleRow[] = []
  let dryStart: string | null = null
  for (const event of replay?.eventos ?? []) {
    if (event.tipo === 'sem_chuva') dryStart = event.data
    if (event.tipo === 'voltou_chuva') dryStart = null
    if (event.tipo === 'aviso_veranico' || event.tipo === 'aviso_calor') {
      replayRows.push({
        kind: 'replay',
        tipo: event.tipo,
        date: event.data,
        texto: event.texto,
        since: event.tipo === 'aviso_veranico' ? dryStart : null,
      })
    }
  }
  const records: ExampleRow[] = recordTiles(avisos)
    .filter((aviso) => Number(aviso.valores.ano) === year)
    .map((aviso) => ({ kind: 'record', aviso }))
  return [...replayRows, ...records]
}

function num(value: Aviso['valores'][string]): number {
  return typeof value === 'number' ? value : Number(value)
}

/**
 * A mudança dos anos recentes foi para pior? Veranico, calor e falta de água maiores, chuva acabando
 * antes ou menos anos em que a opção deu certo. `null` para o que não é mudança.
 */
export function isWorse(aviso: Aviso): boolean | null {
  const v = aviso.valores
  switch (aviso.tipo) {
    case 'mudou_veranico':
    case 'mudou_calor':
    case 'mudou_falta_agua':
      return num(v.recente) > num(v.antes)
    case 'mudou_fim_chuvas':
      return num(v.diferenca_dias) < 0
    case 'mudou_deu_certo':
      return num(v.recente_bons) / num(v.recente_total) < num(v.antes_bons) / num(v.antes_total)
    default:
      return null
  }
}
