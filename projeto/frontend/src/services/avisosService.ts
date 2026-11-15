import type { Lang } from '../i18n/language'
import type { Aviso, Avisos, GrupoAvisos, GrupoAvisosChave, PontoAvisos } from '../models/avisos'
import { avisosRepository as defaultRepository, savedPointRepository as defaultSaved } from '../repositories'
import type { AvisosRepository } from '../repositories/avisosRepository'
import type { SavedPointRepository } from '../repositories/savedPointRepository'
import { buildFlowQuery, type FlowParams } from './flowParams'
import { confirmadasFromAnswers, parseSeasonAnswers } from './seasonAnswersService'

export type AvisosService = {
  /** Os avisos do ponto; o mesmo pedido serve o botão do cabeçalho e a tela (um por visita). */
  get(point: PontoAvisos, lang: Lang): Promise<Avisos>
  savedPoint(): PontoAvisos | null
  savePoint(point: PontoAvisos): void
}

function cacheKey(point: PontoAvisos, lang: Lang): string {
  return `${lang}|${point.lat}|${point.lon}|${point.colheita ?? ''}|${point.solo ?? ''}|${point.confirmadas ?? ''}`
}

/**
 * Tela "Avisos" (tarefa 0046 do backend, RF-31): as regras ficam no backend (`/api/avisos`); aqui só o
 * ponto salvo no aparelho e um pedido por ponto e idioma na visita.
 */
export function createAvisosService(
  repository: AvisosRepository = defaultRepository,
  saved: SavedPointRepository = defaultSaved,
): AvisosService {
  const cache = new Map<string, Promise<Avisos>>()
  return {
    get(point, lang) {
      const key = cacheKey(point, lang)
      const cached = cache.get(key)
      if (cached) return cached
      const request = repository.get(point, lang)
      cache.set(key, request)
      request.catch(() => cache.delete(key))
      return request
    },
    savedPoint: () => saved.get(),
    savePoint: (point) => saved.save(point),
  }
}

export const avisosService = createAvisosService()

/** O ponto do fluxo que vale para os avisos: o marcado pelo produtor, nunca a fazenda de exemplo. */
export function pointFromFlow(params: (FlowParams & { exemplo: boolean }) | null): PontoAvisos | null {
  if (!params || params.exemplo) return null
  const point: PontoAvisos = { lat: params.lat, lon: params.lon }
  if (params.colheita) point.colheita = params.colheita
  if (params.solo) point.solo = params.solo
  // Pacote 2 (tarefa 0054): com as respostas das safras, o `confirmadas` dos avisos sai delas.
  const confirmadas = params.safras ? confirmadasFromAnswers(parseSeasonAnswers(params.safras)) : params.confirmadas
  if (confirmadas) point.confirmadas = confirmadas
  if (params.data) point.data = params.data
  if (params.safras) point.safras = params.safras
  if (params.pensa) point.pensa = params.pensa
  return point
}

/** O ponto da URL (o que a pessoa está olhando) vem antes do salvo no aparelho. */
export function alertsPoint(flow: PontoAvisos | null, saved: PontoAvisos | null): PontoAvisos | null {
  return flow ?? saved
}

const GROUP_ORDER: readonly GrupoAvisosChave[] = ['agora', 'mudou', 'recordes', 'perto']

/** Os grupos na ordem do pedido (seção 6); o grupo sem dado (`null`) não aparece. */
export function alertGroups(avisos: Avisos): { key: GrupoAvisosChave; group: GrupoAvisos }[] {
  return GROUP_ORDER.flatMap((key) => {
    const group = avisos[key]
    return group ? [{ key, group }] : []
  })
}

/** "Ver como teriam sido os avisos em <ano>": o detalhe do ano na resposta, com o ponto e a colheita. */
export function explorerLink(point: PontoAvisos, year: number): string {
  return `/resposta${buildFlowQuery(point)}&ano=${year}`
}

/** Número do botão "Avisos" do cabeçalho: só com aviso ativo (sem aviso, o botão fica sem número). */
export function headerCount(avisos: Avisos | null | undefined): number | null {
  return avisos && avisos.contador > 0 ? avisos.contador : null
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
