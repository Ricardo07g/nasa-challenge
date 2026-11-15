import type { Lang } from '../i18n/language'
import type {
  CulturaRelato,
  Evento,
  Motivo,
  NovoRelato,
  RelatoComunidade,
  RelatosVizinhos,
  Resultado,
  TipoRelato,
} from '../models/community'
import { CULTURAS_RELATO } from '../models/community'
import type { RegiaoSatelite } from '../models/region'
import type { Ponto } from '../models/talhao'
import {
  communityRepository as defaultRepository,
  deviceRepository as defaultDevice,
  regionRepository as defaultRegions,
} from '../repositories'
import type { CommunityRepository } from '../repositories/communityRepository'
import type { DeviceRepository } from '../repositories/deviceRepository'
import { ApiError, isNotConnected } from '../repositories/httpClient'
import type { RegionRepository } from '../repositories/regionRepository'

/**
 * Comunidade "em breve" (pacote 3, tarefa 0061): com `false`, a interface não mostra a comunidade. A rota
 * `/comunidade` mostra só o cartão "Em breve" com o "Abrir o Guia" (`CommunitySoonPage`), e a tela 4 não oferece
 * "Compartilhar com a comunidade". O backend, este service, o repository, os models e as views da comunidade
 * continuam prontos: para voltar, troque para `true` (e decida onde a Comunidade entra no cabeçalho).
 */
export const COMMUNITY_OPEN: boolean = false

/**
 * Relatos da comunidade sem cadastro (seção 7 da remodelagem, tarefa 0047 do backend). Os limites
 * repetem o grupo `comunidade` do `regras.yaml` só para a tela não deixar enviar o que o backend vai
 * recusar; quem decide é o backend.
 */
export const RAIN_MAX_MM = 300
export const DAYS_BACK = 30
/** "Perto de você": a chuva dos relatos dos últimos 7 dias (pedido da seção 7). */
export const RAIN_SUMMARY_DAYS = 7
/** "Perto de você": os eventos dos últimos 30 dias (pedido da seção 7). */
export const EVENTS_SUMMARY_DAYS = 30

export type CommunityService = {
  nearby(point: Ponto, lang: Lang): Promise<RelatosVizinhos>
  /** Envia o relato; depois do primeiro envio que deu certo, o aviso de privacidade já foi visto. */
  send(report: NovoRelato): Promise<RelatoComunidade>
  remove(id: string): Promise<void>
  /** "Seus vizinhos veem a região, não o seu ponto." já apareceu antes de um envio. */
  noticeSeen(): boolean
  /** P3: área parada na região, pelo satélite. */
  region(point: Ponto, lang: Lang): Promise<RegiaoSatelite>
}

export function createCommunityService(
  repository: CommunityRepository = defaultRepository,
  regions: RegionRepository = defaultRegions,
  device: DeviceRepository = defaultDevice,
): CommunityService {
  return {
    nearby: (point, lang) => repository.list(point, device.deviceId(), lang),
    send: async (report) => {
      const sent = await repository.send(report, device.deviceId())
      device.markNoticeSeen()
      return sent
    },
    remove: (id) => repository.remove(id, device.deviceId()),
    noticeSeen: () => device.noticeSeen(),
    region: (point, lang) => regions.get(point, lang),
  }
}

export const communityService = createCommunityService()

// --- datas ------------------------------------------------------------------------------------

/** O dia no relógio do aparelho, em "AAAA-MM-DD". */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, '0')}`
}

/** Soma (ou tira) dias de uma data "AAAA-MM-DD", sem depender do fuso. */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Chuva e evento: data de no máximo 30 dias atrás e nunca futura. */
export function dateBounds(today: string): { min: string; max: string } {
  return { min: addDays(today, -DAYS_BACK), max: today }
}

function dateInBounds(date: string, today: string): boolean {
  const { min, max } = dateBounds(today)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= min && date <= max
}

// --- rascunhos dos três relatos -----------------------------------------------------------------

export type PlantingDraft = {
  crop: CulturaRelato | null
  year: number | null
  outcome: Resultado | null
  reason: Motivo | null
}
export type RainDraft = { mm: string; date: string }
export type EventDraft = { event: Evento | null; date: string }

export const IDLE_CROP: CulturaRelato = 'pousio'

/** "O que plantei depois da soja"; `null` enquanto falta algo (o botão de enviar fica desligado). */
export function plantingReport(draft: PlantingDraft, point: Ponto): NovoRelato | null {
  if (!draft.crop || draft.year === null) return null
  const valores: Record<string, unknown> = { ano: draft.year }
  if (draft.crop !== IDLE_CROP) {
    if (!draft.outcome) return null
    valores.resultado = draft.outcome
    if (draft.outcome === 'perdi') {
      if (!draft.reason) return null
      valores.motivo = draft.reason
    }
  }
  return { tipo: 'plantio', subtipo: draft.crop, valores, lat: point.lat, lon: point.lon, data_fato: null }
}

/** Milímetros digitados ("12,5" ou "12.5"): só número de 0 a 300. */
function parseMm(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const mm = Number(normalized)
  return mm >= 0 && mm <= RAIN_MAX_MM ? mm : null
}

/** "Choveu aqui". */
export function rainReport(draft: RainDraft, point: Ponto, today: string): NovoRelato | null {
  const mm = parseMm(draft.mm)
  if (mm === null || !dateInBounds(draft.date, today)) return null
  return { tipo: 'chuva', subtipo: null, valores: { mm }, lat: point.lat, lon: point.lon, data_fato: draft.date }
}

/** "Aconteceu aqui". */
export function eventReport(draft: EventDraft, point: Ponto, today: string): NovoRelato | null {
  if (!draft.event || !dateInBounds(draft.date, today)) return null
  return { tipo: 'evento', subtipo: draft.event, valores: {}, lat: point.lat, lon: point.lon, data_fato: draft.date }
}

// --- "Perto de você" ----------------------------------------------------------------------------

export type PlantingSummary = {
  year: number
  total: number
  crops: { crop: string; count: number }[]
  wentWell: number
  /** Algum relato é dos dados de demonstração: a linha leva o selo "Exemplo". */
  example: boolean
}
export type RainSummary = { averageMm: number; count: number; example: boolean }
export type EventItem = { id: string; event: string; date: string; mine: boolean; example: boolean }
export type NearbySummary = {
  planting: PlantingSummary | null
  rain: RainSummary | null
  events: EventItem[]
  /** Os relatos deste aparelho, para apagar. */
  mine: RelatoComunidade[]
  empty: boolean
}

const KNOWN_TYPES: readonly string[] = ['plantio', 'chuva', 'evento'] satisfies TipoRelato[]

/** Os tipos de agora; os futuros (oferta, troca, empréstimo) a tela ainda ignora. */
function isKnownType(tipo: string): tipo is TipoRelato {
  return KNOWN_TYPES.includes(tipo)
}

function cropOrder(crop: string): number {
  const index = (CULTURAS_RELATO as readonly string[]).indexOf(crop)
  return index < 0 ? CULTURAS_RELATO.length : index
}

function plantingSummary(relatos: RelatoComunidade[], years: number[]): PlantingSummary | null {
  const plantings = relatos.filter((r) => r.tipo === 'plantio' && typeof r.valores.ano === 'number' && r.subtipo)
  const year = [...years].sort((a, b) => b - a).find((y) => plantings.some((r) => r.valores.ano === y))
  if (year === undefined) return null
  const ofYear = plantings.filter((r) => r.valores.ano === year)
  const counts = new Map<string, number>()
  for (const r of ofYear) counts.set(r.subtipo as string, (counts.get(r.subtipo as string) ?? 0) + 1)
  const crops = [...counts]
    .map(([crop, count]) => ({ crop, count }))
    .sort((a, b) => b.count - a.count || cropOrder(a.crop) - cropOrder(b.crop))
  return {
    year,
    total: ofYear.length,
    crops,
    wentWell: ofYear.filter((r) => r.valores.resultado === 'bem').length,
    example: ofYear.some((r) => r.exemplo === true),
  }
}

function rainSummary(relatos: RelatoComunidade[], today: string): RainSummary | null {
  const since = addDays(today, -(RAIN_SUMMARY_DAYS - 1))
  const rains = relatos.filter(
    (r) =>
      r.tipo === 'chuva' &&
      typeof r.valores.mm === 'number' &&
      r.data_fato !== null &&
      r.data_fato >= since &&
      r.data_fato <= today,
  )
  if (rains.length === 0) return null
  const total = rains.reduce((sum, r) => sum + (r.valores.mm as number), 0)
  return {
    averageMm: Math.round((total / rains.length) * 10) / 10,
    count: rains.length,
    example: rains.some((r) => r.exemplo === true),
  }
}

function eventItems(relatos: RelatoComunidade[], today: string): EventItem[] {
  const since = addDays(today, -EVENTS_SUMMARY_DAYS)
  return relatos
    .filter((r) => r.tipo === 'evento' && r.subtipo && r.data_fato && r.data_fato >= since && r.data_fato <= today)
    .map((r) => ({
      id: r.id,
      event: r.subtipo as string,
      date: r.data_fato as string,
      mine: r.meu,
      example: r.exemplo === true,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** O resumo "Perto de você": plantio da safra mais recente, chuva dos 7 dias e eventos dos 30. */
export function nearbySummary(data: RelatosVizinhos, today: string): NearbySummary {
  const relatos = data.relatos.filter((r) => isKnownType(r.tipo))
  return {
    planting: plantingSummary(relatos, data.anos_safra),
    rain: rainSummary(relatos, today),
    events: eventItems(relatos, today),
    mine: relatos.filter((r) => r.meu),
    empty: relatos.length === 0,
  }
}

export type CellMarker = {
  celula: string
  lat: number
  lon: number
  plantio: number
  chuva: number
  evento: number
  example: boolean
}

/** Mapa: um marcador por célula de 0,1° (no centro dela), com quantos relatos de cada tipo. */
export function cellMarkers(relatos: readonly RelatoComunidade[]): CellMarker[] {
  const byCell = new Map<string, CellMarker>()
  for (const r of relatos) {
    const tipo = r.tipo
    if (!isKnownType(tipo)) continue
    const marker = byCell.get(r.celula) ?? {
      celula: r.celula,
      lat: r.lat,
      lon: r.lon,
      plantio: 0,
      chuva: 0,
      evento: 0,
      example: false,
    }
    marker[tipo] += 1
    marker.example = marker.example || r.exemplo === true
    byCell.set(r.celula, marker)
  }
  return [...byCell.values()]
}

// --- erros --------------------------------------------------------------------------------------

export type ReportErrorKind = 'limit' | 'invalid' | 'unavailable' | 'other'

/** O resultado do último envio: enviado, o motivo da falha ou nada ainda. */
export type ReportResult = 'sent' | ReportErrorKind | null

/** O motivo da falha no envio, para a mensagem certa na tela. */
export function reportErrorKind(error: unknown): ReportErrorKind {
  if (!(error instanceof ApiError)) return 'other'
  if (error.status === 429) return 'limit'
  if (error.status === 422) return 'invalid'
  if (error.status === 503) return 'unavailable'
  return 'other'
}

/** A comunidade não está ligada (sem banco: 503; sem endpoint: 404 sem código): os blocos não aparecem. */
export function isCommunityUnavailable(error: unknown): boolean {
  if (isNotConnected(error)) return true
  return error instanceof ApiError && error.status === 503 && error.code === 'COMMUNITY_UNAVAILABLE'
}

// --- região pelo satélite (P3) ------------------------------------------------------------------

export type RegionSummary = {
  last: { ano: number; pct: number }
  /** Média da série (% da área parada), arredondada. */
  average: number
  /** % da área que o satélite não conseguiu dizer, no último ano. */
  uncertain: number
  bars: { ano: number; pct: number }[]
}

/** P3: o último ano em destaque, a média da série e as barras, ano a ano. */
export function regionSummary(region: RegiaoSatelite): RegionSummary | null {
  const last = region.anos.at(-1)
  if (!last) return null
  const total = region.anos.reduce((sum, ano) => sum + ano.pct_parado, 0)
  return {
    last: { ano: last.ano, pct: last.pct_parado },
    average: Math.round(total / region.anos.length),
    uncertain: last.pct_incerto,
    bars: region.anos.map((ano) => ({ ano: ano.ano, pct: ano.pct_parado })),
  }
}

/** Até 1 km do centro, o círculo medido é o da própria lavoura (a distância não ajuda o produtor). */
const NEAR_CENTER_KM = 1

export type RegionPlace = {
  radiusKm: number
  /** Distância da lavoura até o centro do círculo; null quando o círculo é em volta dela. */
  distanceKm: number | null
}

/**
 * P3: onde fica o círculo que o satélite mediu. A API usa a região mais perto que contém o ponto,
 * que pode estar centrada em outro lugar (até o raio). Sem `distancia_km` (API antiga), vale como
 * se o círculo fosse em volta da lavoura.
 */
export function regionPlace(region: RegiaoSatelite): RegionPlace {
  const distance = region.distancia_km ?? null
  return {
    radiusKm: region.raio_km,
    distanceKm: distance !== null && distance > NEAR_CENTER_KM ? distance : null,
  }
}

/** A API ainda não manda esse dado (sem endpoint ou sem versão http): o bloco não aparece (decisão D2). */
export { isNotConnected } from '../repositories/httpClient'
