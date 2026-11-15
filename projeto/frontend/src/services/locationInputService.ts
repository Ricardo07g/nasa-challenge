import type { Ponto } from '../models/talhao'

/**
 * O que a pessoa colou no modal "Outras formas de marcar" da tela "Onde fica a lavoura" (tarefa 0053):
 * latitude e longitude (com ponto ou vírgula decimal) ou um link do Google Maps com `@lat,lon`, `?q=`,
 * `ll=`, `query=` ou `!3d…!4d…`. Função pura, sem rede. O que não der para ler vira `null` (a tela diz
 * "Não entendi"): nome de lugar, link curto (só abre com rede) e coordenadas fora do mundo.
 */

/** Número com ponto ou vírgula decimal (ex.: -18.9543 ou -18,9543). */
const NUMBER = String.raw`[+-]?\d{1,3}(?:[.,]\d+)?`
/** Dois números separados por vírgula, ponto e vírgula ou espaço, com parênteses opcionais. */
const PAIR = new RegExp(String.raw`^\(?\s*(${NUMBER})\s*[,;\s]\s*(${NUMBER})\s*\)?$`)
const LINK = /^(https?:\/\/|www\.|maps\.|goo\.gl\/)/i
/** Alfinete do lugar no link do Google Maps (`!3d<lat>!4d<lon>`): mais exato que o centro do mapa. */
const PLACE_PIN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
/** Centro do mapa no link (`/@<lat>,<lon>,<zoom>`). */
const MAP_CENTER = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/
const QUERY_KEYS = ['q', 'query', 'll']

const toNumber = (text: string) => Number(text.replace(',', '.'))

function parsePair(text: string): Ponto | null {
  const match = PAIR.exec(text.trim())
  return match ? { lat: toNumber(match[1]), lon: toNumber(match[2]) } : null
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

/** Coordenadas do link, do mais exato para o menos: alfinete, `q`/`query`/`ll`, caminho da busca, centro. */
function pointFromLink(text: string): Ponto | null {
  const url = readUrl(text)
  if (!url) return null
  const pin = PLACE_PIN.exec(safeDecode(url.href))
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

const isOnEarth = ({ lat, lon }: Ponto) => Math.abs(lat) <= 90 && Math.abs(lon) <= 180

/** Lê o campo do modal "Outras formas de marcar": o ponto, ou `null` se não der para entender. */
export function parseLocationInput(text: string): Ponto | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const point = LINK.test(trimmed) ? pointFromLink(trimmed) : parsePair(trimmed)
  return point && isOnEarth(point) ? point : null
}
