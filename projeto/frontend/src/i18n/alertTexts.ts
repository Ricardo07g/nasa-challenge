/**
 * Frases da tela "Avisos" (tarefa 0046 do backend; refeita no pacote 3, tela 7, tarefa 0062): o título curto, o
 * número, o que fazer, o que significa e o "Saiba mais" de cada aviso, quadro e linha do exemplo, com os números que
 * vêm prontos da API. Só apresentação: a regra (o que vira aviso, o nível e o contador) fica no backend e a arrumação
 * da tela no `avisosService`. Fica em `i18n/` (como o `xrayTexts`) porque a view e o "Ouvir resumo" do controller
 * usam as mesmas frases.
 */
import type { GuideSlug } from '../content/guia/slugs'
import type { Aviso, NivelAviso, PeriodoComparado, ValorAviso } from '../models/avisos'
import type { AlertsSummary, ExampleRow, PlanLine } from '../services/avisosService'
import { isWorse } from '../services/avisosService'
import { formatDayMonth, formatDecimal, formatFullDate, formatNumber } from './format'
import { htmlLang, type Lang } from './language'
import type { Messages } from './messages.pt'

/** O que o modal de detalhe mostra (cartão de "Agora", quadro de mudança ou recorde). */
export type DetailText = {
  title: string
  number: string
  meaning: string
  todo: string
  guide: GuideSlug
  guideLabel: string
}

export type NowText = DetailText & { short: string }
export type ChangeText = DetailText & { label: string; before: string; after: string; worse: boolean }
export type RecordText = DetailText & { label: string; value: string; caption: string }

/** Ano qualquer para escrever um "MM-DD" da série (dia e mês, sem o ano). */
const COMMON_YEAR = 2023

function n(value: ValorAviso | undefined): number {
  return typeof value === 'number' ? value : Number(value)
}

function s(value: ValorAviso | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

/** Número no jeito do idioma: inteiro sem casas, o resto com uma ("27,2" / "27.2"). */
export function amount(lang: Lang, value: ValorAviso): string {
  const number = n(value)
  return Number.isInteger(number) ? formatNumber(lang, number) : formatDecimal(lang, number, 1)
}

/** Data curta dos quadros e da linha do plano: "24 de abr" / "Apr 24", sem depender do fuso do navegador. */
export function shortDate(lang: Lang, isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const shortMonth = new Intl.DateTimeFormat(htmlLang(lang), { month: 'short', timeZone: 'UTC' }).format(date).replace('.', '')
  return lang === 'pt' ? `${day} de ${shortMonth}` : `${shortMonth} ${day}`
}

/** "04-19" (da série) → "19 de abr" / "Apr 19". */
function monthDay(lang: Lang, md: ValorAviso | undefined): string {
  return shortDate(lang, `${COMMON_YEAR}-${s(md)}`)
}

/** O nome da cultura no meio da frase: o do dicionário (ou o da API), com a primeira letra minúscula. */
function cropName(t: Messages, lang: Lang, id: ValorAviso | undefined, name?: ValorAviso): string {
  const names: Record<string, string> = t.crops.names
  const text = names[s(id)] ?? s(name)
  return text.toLocaleLowerCase(htmlLang(lang))
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** O cartão de "Agora" e o seu modal; `null` para um tipo que a tela não sabe escrever (não aparece). */
export function nowText(t: Messages, lang: Lang, aviso: Aviso): NowText | null {
  const k = t.alerts.kinds
  const v = aviso.valores
  const date = aviso.data ? formatDayMonth(lang, aviso.data) : ''
  switch (aviso.tipo) {
    case 'terra_seca': {
      const pct = n(v.mais_seca_que_pct)
      return {
        title: k.dryTitle,
        number: k.dryNumber(pct),
        short: k.dryShort,
        meaning: k.dryMeaning(pct),
        todo: k.dryTodo,
        guide: 'conta-de-agua',
        guideLabel: k.dryGuide,
      }
    }
    case 'dias_sem_chuva': {
      const atLeast = v.no_minimo === true
      return {
        title: k.noRainTitle,
        number: k.noRainNumber(n(v.dias), atLeast),
        short: k.noRainShort,
        meaning: k.noRainMeaning(n(v.dias), date, atLeast),
        todo: k.noRainTodo,
        guide: 'veranico',
        guideLabel: k.noRainGuide,
      }
    }
    case 'calor':
      return {
        title: k.heatTitle(n(v.janela_dias)),
        number: k.heatNumber(n(v.dias), n(v.temp_c)),
        short: k.heatShort,
        meaning: k.heatMeaning(n(v.dias), n(v.temp_c), n(v.janela_dias)),
        todo: k.heatTodo,
        guide: 'calor-35-graus',
        guideLabel: k.heatGuide,
      }
    case 'enso':
      return ensoText(t, lang, aviso)
    case 'safrinha_veranico': {
      const crop = cropName(t, lang, v.cultura, v.nome)
      return {
        title: k.safrinhaDryTitle(crop),
        number: k.safrinhaDryNumber(n(v.dias)),
        short: k.safrinhaShort,
        meaning: k.safrinhaDryMeaning(crop, n(v.dias), date),
        todo: k.safrinhaTodo,
        guide: 'veranico',
        guideLabel: k.noRainGuide,
      }
    }
    case 'safrinha_calor': {
      const crop = cropName(t, lang, v.cultura, v.nome)
      return {
        title: k.safrinhaHeatTitle(crop),
        number: k.safrinhaHeatNumber(n(v.dias), n(v.temp_c)),
        short: k.safrinhaShort,
        meaning: k.safrinhaHeatMeaning(crop, n(v.dias), n(v.temp_c), date),
        todo: k.safrinhaTodo,
        guide: 'calor-35-graus',
        guideLabel: k.heatGuide,
      }
    }
    default:
      return null
  }
}

/** El Niño / La Niña: a previsão da NOAA, o histórico da célula (sem o ONI, não aparece) e o conselho do sinal. */
function ensoText(t: Messages, lang: Lang, aviso: Aviso): NowText {
  const a = t.alerts
  const k = a.kinds
  const v = aviso.valores
  const phases: Record<string, string> = a.phases
  const seasons: Record<string, string> = a.seasons
  const titles: Record<string, (months: string, year: number) => string> = k.ensoTitle
  const phase = phases[s(v.fase)] ?? s(v.fase)
  const months = seasons[s(v.estacao)] ?? s(v.estacao)
  const forecast = k.ensoForecast(phase, months, n(v.ano), n(v.chance_pct))
  const history =
    v.anos_fase === null || v.anos_fase === undefined
      ? ''
      : ` ${k.ensoHistory(
          n(v.anos_fase),
          phase,
          n(v.ano_inicio),
          cropName(t, lang, v.cultura, v.nome),
          n(v.bons_fase),
          n(v.anos_outros),
          n(v.bons_outros),
        )}`
  const title = titles[s(v.fase)]?.(months, n(v.ano)) ?? `${phase}: ${months} ${n(v.ano)}`
  return {
    title,
    number: k.ensoNumber(n(v.chance_pct)),
    short: k.ensoShort,
    meaning: `${forecast}${history}`,
    todo: k.ensoTodo[s(v.sinal) as keyof typeof k.ensoTodo] ?? k.ensoTodo.incerto,
    guide: 'el-nino-la-nina',
    guideLabel: k.ensoGuide,
  }
}

/** "2005–19 → 2020–24": os dois períodos comparados, com o fim de cada um em dois dígitos. */
export function periodsLabel(periodo: PeriodoComparado): string {
  const short = (year: number) => String(year).slice(2)
  return `${periodo.antes_inicio}–${short(periodo.antes_fim)} → ${periodo.recente_inicio}–${short(periodo.recente_fim)}`
}

/** Um quadro de "Como a sua área está mudando" e o seu modal; `null` para um tipo que a tela não sabe escrever. */
export function changeText(t: Messages, lang: Lang, aviso: Aviso, periodo: PeriodoComparado | null): ChangeText | null {
  const a = t.alerts
  const c = a.changed
  const g = a.guides
  const v = aviso.valores
  const recent = periodo ? a.period(periodo.recente_inicio, periodo.recente_fim) : ''
  const before = periodo ? a.period(periodo.antes_inicio, periodo.antes_fim) : ''
  const worse = isWorse(aviso) === true
  const todo = (worseTodo: string) => (worse ? worseTodo : c.betterTodo)
  const make = (
    label: string,
    values: [string, string],
    meaning: string,
    worseTodo: string,
    guide: GuideSlug,
    guideLabel: string,
  ): ChangeText => ({
    label,
    before: values[0],
    after: values[1],
    worse,
    title: label,
    number: `${values[0]} → ${values[1]}`,
    meaning,
    todo: todo(worseTodo),
    guide,
    guideLabel,
  })
  switch (aviso.tipo) {
    case 'mudou_veranico':
      return make(
        c.drySpellLabel,
        [c.days(amount(lang, v.antes)), c.days(amount(lang, v.recente))],
        c.drySpell(amount(lang, v.recente), amount(lang, v.antes), recent, before, n(v.recente) > n(v.antes)),
        c.drySpellTodo,
        'veranico',
        g.drySpell,
      )
    case 'mudou_fim_chuvas': {
      const days = n(v.diferenca_dias)
      return make(
        c.rainEndLabel,
        [monthDay(lang, v.antes), monthDay(lang, v.recente)],
        c.rainEnd(Math.abs(days), days < 0, recent, before),
        c.rainEndTodo,
        'quando-a-chuva-acaba',
        g.rainEnd,
      )
    }
    case 'mudou_calor':
      return make(
        c.heatLabel(n(v.temp_c)),
        [c.days(amount(lang, v.antes)), c.days(amount(lang, v.recente))],
        c.heat(amount(lang, v.recente), amount(lang, v.antes), n(v.temp_c), recent, before),
        c.heatTodo,
        'calor-35-graus',
        g.heat,
      )
    case 'mudou_falta_agua': {
      const crop = cropName(t, lang, v.cultura, v.nome)
      return make(
        c.shortageLabel(crop),
        [c.mm(amount(lang, v.antes)), c.mm(amount(lang, v.recente))],
        c.shortage(crop, amount(lang, v.recente), amount(lang, v.antes), recent, before),
        c.shortageTodo,
        'conta-de-agua',
        g.water,
      )
    }
    case 'mudou_deu_certo': {
      const crop = cropName(t, lang, v.cultura, v.nome)
      return make(
        c.workedLabel(crop),
        [c.workedValue(n(v.antes_bons), n(v.antes_total)), c.workedValue(n(v.recente_bons), n(v.recente_total))],
        c.worked(capitalize(crop), n(v.recente_bons), n(v.recente_total), n(v.antes_bons), n(v.antes_total), recent, before),
        c.workedTodo,
        'deu-certo',
        g.worked,
      )
    }
    default:
      return null
  }
}

/** Um quadro de "Já aconteceu aqui" e o seu modal; `null` para um tipo que a tela não sabe escrever. */
export function recordText(t: Messages, lang: Lang, aviso: Aviso, periodo: PeriodoComparado | null): RecordText | null {
  const a = t.alerts
  const r = a.records
  const g = a.guides
  const v = aviso.valores
  const make = (label: string, value: string, caption: string, guide: GuideSlug, guideLabel: string): RecordText => ({
    label,
    value,
    caption,
    title: label,
    number: value,
    meaning: periodo ? `${value} ${caption}. ${r.extreme(periodo.antes_inicio, periodo.recente_fim)}` : `${value} ${caption}.`,
    todo: r.todo,
    guide,
    guideLabel,
  })
  switch (aviso.tipo) {
    case 'recorde_veranico':
      return make(
        r.drySpellLabel,
        r.days(amount(lang, v.dias)),
        r.drySpell(monthDay(lang, v.inicio), n(v.ano)),
        'veranico',
        g.drySpell,
      )
    case 'recorde_outono_seco':
      return make(
        r.dryAutumnLabel,
        r.mm(amount(lang, v.chuva_mm)),
        r.dryAutumn(n(v.ano), amount(lang, v.media_mm)),
        'quando-a-chuva-acaba',
        g.rainEnd,
      )
    case 'recorde_fim_chuvas':
      return make(r.rainEndLabel, monthDay(lang, v.dia), r.rainEnd(n(v.ano)), 'quando-a-chuva-acaba', g.rainEnd)
    case 'recorde_calor':
      return make(r.heatLabel, r.days(amount(lang, v.dias)), r.heat(n(v.temp_c), n(v.ano)), 'calor-35-graus', g.heat)
    default:
      return null
  }
}

/** "Fonte: NASA SMAP · leitura de 10 de novembro de 2026 · Leitura antiga" (série: "dados até …"). */
export function sourceLine(t: Messages, lang: Lang, aviso: Aviso, series: boolean): string {
  const a = t.alerts
  const names: Record<string, string> = a.sources
  const parts = [a.source(aviso.fontes.map((f) => names[f] ?? f).join(', '))]
  if (aviso.data) {
    const full = formatFullDate(lang, aviso.data)
    parts.push(series ? a.dataUntil(full) : a.readingOn(full))
  }
  if (aviso.antiga) parts.push(a.oldReading)
  return parts.join(' · ')
}

/** O lugar do topo: a lavoura de demonstração tem nome; as outras, "Lavoura perto de {cidade}". */
export function placeLabel(t: Messages, place: string | null, demo: boolean): string | null {
  if (!place) return null
  return demo ? t.alerts.demoPlace(place) : t.alerts.place(place)
}

/** "Seu plano: **sorgo**, plantio até 20 de mar. …" (negrito com `**…**`, lido pelo `parseInline`). */
export function planText(t: Messages, lang: Lang, plan: PlanLine): string {
  const p = t.alerts.plan
  if (plan.crop === 'pousio') return p.fallow
  const crop = cropName(t, lang, plan.crop)
  if (plan.deadline && plan.late) return p.late(crop, shortDate(lang, plan.deadline))
  return p.line(crop, plan.deadline ? shortDate(lang, plan.deadline) : null)
}

/** Uma linha do exemplo de um ano: quando, o nível e a frase. */
export function exampleRowText(
  t: Messages,
  lang: Lang,
  row: ExampleRow,
  periodo: PeriodoComparado | null,
): { when: string; level: NivelAviso; text: string } {
  const e = t.alerts.example
  if (row.kind === 'replay') {
    const since = row.since ? ` ${e.drySince(formatDayMonth(lang, row.since))}` : ''
    return { when: shortDate(lang, row.date), level: 'atencao', text: `${row.texto}${since}` }
  }
  const v = row.aviso.valores
  const first = periodo?.antes_inicio ?? null
  const level = row.aviso.nivel
  switch (row.aviso.tipo) {
    case 'recorde_veranico':
      return { when: monthDay(lang, v.inicio), level, text: e.dryRecord(n(v.dias), first) }
    case 'recorde_calor':
      return { when: e.autumn, level, text: e.heatRecord(n(v.dias), n(v.temp_c), first) }
    case 'recorde_outono_seco':
      return { when: e.autumn, level, text: e.dryAutumnRecord(amount(lang, v.chuva_mm), amount(lang, v.media_mm), first) }
    default:
      return { when: monthDay(lang, v.dia), level, text: e.rainEndRecord(formatDayMonth(lang, `${COMMON_YEAR}-${s(v.dia)}`), first) }
  }
}

/** Tira o ponto final, para juntar frases com ". ". */
function trimDot(text: string): string {
  return text.replace(/\.\s*$/, '')
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/**
 * "Ouvir resumo" (regra geral 9 do pacote 2): sem aviso, "Nada fora do normal…"; com avisos, quantos (o mesmo
 * número do sino) e o título com o que fazer de cada cartão; sem os avisos na mão, o que a tela mostra.
 */
export function alertsListen(t: Messages, lang: Lang, summary: AlertsSummary | null, now: readonly Aviso[]): string {
  const l = t.alerts.listen
  if (!summary) return l.waiting
  if (summary.count === 0) return l.none
  const list = now
    .map((aviso) => nowText(t, lang, aviso))
    .flatMap((text) => (text ? [`${text.title}: ${lowerFirst(trimDot(text.short))}`] : []))
    .join('. ')
  return l.some(summary.count, list)
}
