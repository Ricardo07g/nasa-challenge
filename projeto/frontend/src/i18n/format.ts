import { htmlLang, type Lang } from './language'

export function formatNumber(lang: Lang, value: number): string {
  return new Intl.NumberFormat(htmlLang(lang), { maximumFractionDigits: 0 }).format(value)
}

/** Número com casas decimais fixas no jeito do idioma ("-18,95" / "-18.95"). */
export function formatDecimal(lang: Lang, value: number, digits: number): string {
  return new Intl.NumberFormat(htmlLang(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

/** Valores em reais, sem centavos (o produtor pensa em "R$ 700 por hectare"). */
export function formatCurrency(lang: Lang, value: number): string {
  return new Intl.NumberFormat(htmlLang(lang), {
    style: 'currency',
    currency: 'BRL',
    currencyDisplay: 'symbol',
    maximumFractionDigits: 0,
  }).format(value)
}

/** "2027-02-18" → "18 de fevereiro" / "February 18", sem depender do fuso do navegador. */
export function formatDayMonth(lang: Lang, isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat(htmlLang(lang), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date)
}

/** Mês por extenso (1 = janeiro): "abril" / "April", sem depender do fuso do navegador. */
export function formatMonth(lang: Lang, month: number): string {
  return new Intl.DateTimeFormat(htmlLang(lang), { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, month - 1, 1)),
  )
}

/** Ponto escolhido no mapa: "-18.9200, -48.2800" (latitude, longitude), igual em PT e EN. */
export function formatCoordinates(point: { lat: number; lon: number }): string {
  return `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`
}

/**
 * Valor aproximado em reais, sem sinal (PRD §7.11): centenas até 10 mil ("3.400"); daí para cima,
 * milhares por extenso ("26 mil" / "26 thousand").
 */
export function formatApproxMoney(lang: Lang, value: number): string {
  const abs = Math.abs(value)
  if (abs < 10000) return formatNumber(lang, Math.round(abs / 100) * 100)
  return new Intl.NumberFormat(htmlLang(lang), { notation: 'compact', compactDisplay: 'long' }).format(
    Math.round(abs / 1000) * 1000,
  )
}

/** "2026-11-14" → "14 de novembro de 2026" / "November 14, 2026", sem depender do fuso do navegador. */
export function formatFullDate(lang: Lang, isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(htmlLang(lang), { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}
