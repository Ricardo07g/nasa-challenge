import { htmlLang, type Lang } from './language'

export function formatNumber(lang: Lang, value: number): string {
  return new Intl.NumberFormat(htmlLang(lang), { maximumFractionDigits: 0 }).format(value)
}

/** Número com casas decimais fixas no jeito do idioma ("-18,95" / "-18.95"). */
export function formatDecimal(lang: Lang, value: number, digits: number): string {
  return new Intl.NumberFormat(htmlLang(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
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

function utcDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Mês curto, sem o ponto do português: "mar" / "Mar". */
function shortMonth(lang: Lang, isoDate: string): string {
  return new Intl.DateTimeFormat(htmlLang(lang), { month: 'short', timeZone: 'UTC' })
    .format(utcDate(isoDate))
    .replace('.', '')
}

/** Mês curto, sem o ponto do português: "fev" / "Feb". */
export function formatShortMonth(lang: Lang, isoDate: string): string {
  return shortMonth(lang, isoDate)
}

/** Faixa de meses da linha do tempo (tela 6): "abr–mai" / "Apr–May"; no mesmo mês e ano, só "jun". */
export function formatMonthRange(lang: Lang, from: string, to: string): string {
  const start = shortMonth(lang, from)
  return from.slice(0, 7) === to.slice(0, 7) ? start : `${start}–${shortMonth(lang, to)}`
}

/** Mês do calendário do cartão "Dia da colheita" (tela 2): "MAR" / "FEB", sem depender do fuso. */
export function formatCalendarMonth(lang: Lang, isoDate: string): string {
  return shortMonth(lang, isoDate).toUpperCase()
}

/** Dia da semana por extenso, com a primeira letra maiúscula: "Quarta-feira" / "Wednesday". */
export function formatWeekday(lang: Lang, isoDate: string): string {
  const weekday = new Intl.DateTimeFormat(htmlLang(lang), { weekday: 'long', timeZone: 'UTC' }).format(utcDate(isoDate))
  return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}

/** Dia e mês curtos, para os rótulos dos gráficos: "16 mar" / "Mar 16". */
export function formatShortDayMonth(lang: Lang, isoDate: string): string {
  const day = Number(isoDate.slice(8, 10))
  const month = shortMonth(lang, isoDate)
  return lang === 'pt' ? `${day} ${month}` : `${month} ${day}`
}

/** "2026-11-14" → "14 de novembro de 2026" / "November 14, 2026", sem depender do fuso do navegador. */
export function formatFullDate(lang: Lang, isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(htmlLang(lang), { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}
