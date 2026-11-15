import type { Ponto } from '../models/talhao'

/**
 * O que a pessoa escreveu ou colou no campo "Buscar cidade, estrada ou endereço" (tarefa 0041):
 * coordenadas, link de mapa (Google Maps e outros com o mesmo formato) ou texto para a busca.
 */
export type LocationInput =
  | { kind: 'empty' }
  | { kind: 'point'; point: Ponto; source: 'coordinates' | 'link' }
  /** Link curto (maps.app.goo.gl, goo.gl/maps): só abre com rede, então a tela pede o link completo. */
  | { kind: 'short-link' }
  | { kind: 'link-without-point' }
  | { kind: 'invalid-coordinates' }
  /** Só números, ainda sem os dois valores: a pessoa está digitando, nada de busca nem aviso. */
  | { kind: 'incomplete-coordinates' }
  | { kind: 'search'; query: string }

/** Número com ponto ou vírgula decimal (ex.: -18.9543 ou -18,9543). */
const NUMBER = String.raw`[+-]?\d{1,3}(?:[.,]\d+)?`
/** Dois números separados por vírgula, ponto e vírgula ou espaço, com parênteses opcionais. */
const PAIR = new RegExp(String.raw`^\(?\s*(${NUMBER})\s*[,;\s]\s*(${NUMBER})\s*\)?$`)
const ONLY_NUMBERS = /^[\d\s.,;:+\-()°]+$/
/** CEP (38400-000): vai para a busca, não é coordenada pela metade. */
const CEP = /^\d{5}-?\d{3}$/
const LINK = /^(https?:\/\/|www\.|maps\.|goo\.gl\/)/i
const SHORT_LINK_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'share.google']
/** Pino do lugar no link do Google Maps (`!3d<lat>!4d<lon>`): mais exato que o centro do mapa. */
const PLACE_PIN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
/** Centro do mapa no link (`/@<lat>,<lon>,<zoom>`). */
const MAP_CENTER = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/
const QUERY_KEYS = ['q', 'query', 'll']

type RawPoint = { lat: number; lon: number }

const toNumber = (text: string) => Number(text.replace(',', '.'))

function parsePair(text: string): RawPoint | null {
  const match = PAIR.exec(text.trim())
  return match ? { lat: toNumber(match[1]), lon: toNumber(match[2]) } : null
}

function isOnEarth({ lat, lon }: RawPoint): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}

function toInput(raw: RawPoint, source: 'coordinates' | 'link'): LocationInput {
  return isOnEarth(raw) ? { kind: 'point', point: { lat: raw.lat, lon: raw.lon }, source } : { kind: 'invalid-coordinates' }
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

function readUrl(text: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
}

/** Coordenadas do link, na ordem do mais exato para o menos: pino, `q`/`query`/`ll`, caminho, centro. */
function pointFromLink(url: URL): RawPoint | null {
  const decoded = safeDecode(url.href)
  const pin = PLACE_PIN.exec(decoded)
  if (pin) return { lat: Number(pin[1]), lon: Number(pin[2]) }

  for (const key of QUERY_KEYS) {
    const value = url.searchParams.get(key)
    const point = value ? parsePair(value.replace(/^loc:/i, '')) : null
    if (point) return point
  }

  const path = /\/maps\/(?:search|place)\/([^/]+)/.exec(url.pathname)
  const fromPath = path ? parsePair(safeDecode(path[1].replace(/\+/g, ' '))) : null
  if (fromPath) return fromPath

  const center = MAP_CENTER.exec(safeDecode(url.pathname))
  return center ? { lat: Number(center[1]), lon: Number(center[2]) } : null
}

function parseLink(text: string): LocationInput {
  const url = readUrl(text)
  if (!url) return { kind: 'link-without-point' }
  if (SHORT_LINK_HOSTS.includes(url.hostname.toLowerCase())) return { kind: 'short-link' }
  const point = pointFromLink(url)
  return point ? toInput(point, 'link') : { kind: 'link-without-point' }
}

/** Lê o campo de busca da tela "Onde fica a lavoura" (função pura, sem rede). */
export function parseLocationInput(text: string): LocationInput {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  if (LINK.test(trimmed)) return parseLink(trimmed)

  const pair = parsePair(trimmed)
  if (pair) return toInput(pair, 'coordinates')
  if (ONLY_NUMBERS.test(trimmed) && !CEP.test(trimmed)) return { kind: 'incomplete-coordinates' }
  return { kind: 'search', query: trimmed }
}
