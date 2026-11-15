/**
 * Frases de cada aviso da tela "Avisos" (tarefa 0046 do backend): o que o dado mostra e o que fazer, com
 * os números que vêm prontos da API. Só apresentação: a regra (o que vira aviso) fica no backend.
 */
import { formatDayMonth, formatDecimal, formatFullDate, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { Aviso, PeriodoComparado, ValorAviso } from '../models/avisos'
import { isWorse } from '../services/avisosService'

export type AlertText = { shows: string; todo: string }

type Context = { periodo: PeriodoComparado | null; raioKm: number }

const COMMON_YEAR = 2023

function n(value: ValorAviso): number {
  return typeof value === 'number' ? value : Number(value)
}

function s(value: ValorAviso): string {
  return value === null || value === undefined ? '' : String(value)
}

/** Número no jeito do idioma: inteiro sem casas, o resto com uma ("27,2" / "27.2"). */
export function amount(lang: Lang, value: ValorAviso): string {
  const number = n(value)
  return Number.isInteger(number) ? formatNumber(lang, number) : formatDecimal(lang, number, 1)
}

/** "04-19" → "19 de abril" / "April 19". */
function monthDay(lang: Lang, md: ValorAviso): string {
  return formatDayMonth(lang, `${COMMON_YEAR}-${s(md)}`)
}

/** Nome da cultura no meio da frase ("milho com braquiária"). */
function inSentence(name: ValorAviso): string {
  const text = s(name)
  return text.charAt(0).toLowerCase() + text.slice(1)
}

export function alertText(t: Messages, lang: Lang, aviso: Aviso, ctx: Context): AlertText {
  const a = t.alerts
  const k = a.kinds
  const v = aviso.valores
  const date = aviso.data ? formatDayMonth(lang, aviso.data) : ''
  const recent = ctx.periodo ? a.period(ctx.periodo.recente_inicio, ctx.periodo.recente_fim) : ''
  const before = ctx.periodo ? a.period(ctx.periodo.antes_inicio, ctx.periodo.antes_fim) : ''
  const changedTodo = isWorse(aviso) ? k.changedWorseTodo : k.changedBetterTodo
  const phases = a.phases as Record<string, string>
  const seasons = a.seasons as Record<string, string>
  const events = t.community.events as Record<string, string>

  switch (aviso.tipo) {
    case 'terra_seca':
      return { shows: k.dry(n(v.mais_seca_que_pct)), todo: k.dryTodo }
    case 'dias_sem_chuva':
      return { shows: k.noRain(n(v.dias), date, v.no_minimo === true), todo: k.noRainTodo }
    case 'calor':
      return { shows: k.heat(n(v.dias), n(v.janela_dias), n(v.temp_c)), todo: k.heatTodo }
    case 'enso': {
      const phase = phases[s(v.fase)] ?? s(v.fase)
      const forecast = k.ensoForecast(phase, seasons[s(v.estacao)] ?? s(v.estacao), n(v.ano), n(v.chance_pct))
      const history =
        v.anos_fase === null || v.anos_fase === undefined
          ? ''
          : ` ${k.ensoHistory(
              n(v.anos_fase),
              phase,
              n(v.ano_inicio),
              inSentence(v.nome),
              n(v.bons_fase),
              n(v.anos_outros),
              n(v.bons_outros),
            )}`
      return { shows: `${forecast}${history}`, todo: k.ensoTodo }
    }
    case 'safrinha_veranico':
      return { shows: k.safrinhaDry(s(v.nome), n(v.dias), date), todo: k.safrinhaTodo }
    case 'safrinha_calor':
      return { shows: k.safrinhaHeat(s(v.nome), n(v.dias), n(v.temp_c), date), todo: k.safrinhaTodo }
    case 'mudou_veranico':
      return { shows: k.changedDrySpell(amount(lang, v.recente), amount(lang, v.antes), recent, before), todo: changedTodo }
    case 'mudou_fim_chuvas': {
      const days = n(v.diferenca_dias)
      return {
        shows: k.changedRainEnd(monthDay(lang, v.recente), monthDay(lang, v.antes), recent, before, Math.abs(days), days < 0),
        todo: changedTodo,
      }
    }
    case 'mudou_calor':
      return {
        shows: k.changedHeat(amount(lang, v.recente), amount(lang, v.antes), n(v.temp_c), recent, before),
        todo: changedTodo,
      }
    case 'mudou_falta_agua':
      return {
        shows: k.changedShortage(inSentence(v.nome), amount(lang, v.recente), amount(lang, v.antes), recent, before),
        todo: changedTodo,
      }
    case 'mudou_deu_certo':
      return {
        shows: k.changedWorked(
          s(v.nome),
          n(v.recente_bons),
          n(v.recente_total),
          n(v.antes_bons),
          n(v.antes_total),
          recent,
          before,
        ),
        todo: changedTodo,
      }
    case 'recorde_veranico':
      return { shows: k.recordDrySpell(n(v.dias), monthDay(lang, v.inicio), n(v.ano)), todo: k.recordTodo }
    case 'recorde_outono_seco':
      return {
        shows: k.recordDryAutumn(amount(lang, v.chuva_mm), n(v.ano), amount(lang, v.media_mm)),
        todo: k.recordTodo,
      }
    case 'recorde_fim_chuvas':
      return { shows: k.recordRainEnd(monthDay(lang, v.dia), n(v.ano)), todo: k.recordTodo }
    case 'recorde_calor':
      return { shows: k.recordHeat(n(v.dias), n(v.temp_c), n(v.ano)), todo: k.recordTodo }
    case 'vizinho_evento':
      return {
        shows: k.neighbor(events[s(v.evento)] ?? s(v.evento), n(v.relatos), ctx.raioKm, date),
        todo: v.evento === 'fogo' ? k.neighborFireTodo : k.neighborTodo,
      }
    default:
      return { shows: '', todo: '' }
  }
}

/** "Fonte: NASA SMAP · leitura de 10 de novembro de 2026 · Leitura antiga". */
export function sourceLine(t: Messages, lang: Lang, aviso: Aviso, series: boolean): string {
  const a = t.alerts
  const names = a.sources as Record<string, string>
  const parts = [a.source(aviso.fontes.map((f) => names[f] ?? f).join(', '))]
  if (aviso.data) {
    const full = formatFullDate(lang, aviso.data)
    if (series) parts.push(a.dataUntil(full))
    else if (aviso.fontes.includes('comunidade')) parts.push(a.reportedOn(full))
    else parts.push(a.readingOn(full))
  }
  if (aviso.antiga) parts.push(a.oldReading)
  return parts.join(' · ')
}
