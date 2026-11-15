/**
 * Frases da tela 6 "Seu planejamento" (`/planejamento`, pacote 3): os passos de "O que fazer agora", os cartões
 * dos alertas, o "Como o plano ajuda a ganhar" e o "Ouvir resumo". As mesmas frases servem à tela e ao
 * relatório impresso. Só apresentação: as regras (datas, o que aparece) ficam em `services/planningService.ts`.
 */
import type { CropId } from '../models/recomendacao'
import type { PlanGain, PlanningAlert, TimelineStep } from '../services/planningService'
import { CURRENT_SEASON, seasonName } from '../services/seasonService'
import { formatDayMonth, formatFullDate, formatMonthRange, formatNumber, formatShortDayMonth, formatShortMonth } from './format'
import type { Lang } from './language'
import type { Messages } from './messages.pt'

/** Nome da cultura no meio da frase ("milho com braquiária", "pearl millet"). */
export function cropInSentence(t: Messages, crop: CropId): string {
  const name = t.crops.names[crop]
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/** "a, b e c" / "a, b and c". */
function joinList(t: Messages, items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${t.planning.and} ${items[items.length - 1]}`
}

/** O cenário do CMIP6 como a fonte escreve: `ssp245` → "SSP2-4.5". */
export function scenarioName(code: string): string {
  const match = /^ssp(\d)(\d)(\d)$/i.exec(code)
  return match ? `SSP${match[1]}-${match[2]}.${match[3]}` : code
}

export type StepTag = { kind: 'now' | 'planB'; label: string }

export type StepText = {
  /** A coluna "quando" (data ou meses) e a linha de baixo (ano, "colheita", "prazo ZARC"…). */
  when: string
  sub: string
  title: string
  text: string
  tag: StepTag | null
  /** Passou do prazo do ZARC: o texto fica em laranja. */
  late: boolean
}

function signalText(t: Messages, step: Extract<TimelineStep, { kind: 'signal' }>): string {
  const s = t.planning.timeline.signal
  const b = step.planB
  const plan =
    b?.kind === 'b'
      ? s.planB(cropInSentence(t, b.crop))
      : b?.kind === 'notNeeded'
        ? b.reason === 'pousio'
          ? s.notNeededFallow
          : s.notNeeded(cropInSentence(t, step.planA))
        : b?.kind === 'none'
          ? s.none(cropInSentence(t, step.planA))
          : ''
  return [step.forecast ?? s.check, plan].filter(Boolean).join(' ')
}

/** As frases de um passo da linha do tempo, no idioma da tela. */
export function stepText(t: Messages, lang: Lang, step: TimelineStep): StepText {
  const p = t.planning.timeline
  const base = { tag: null, late: false }
  switch (step.kind) {
    case 'now':
      return {
        ...base,
        when: p.now.when,
        sub: formatMonthRange(lang, step.from, step.to),
        title: p.now.title,
        text: p.now.text,
        tag: { kind: 'now', label: p.nowTag },
      }
    case 'signal':
      return {
        ...base,
        when: p.signal.when,
        sub: String(step.year),
        title: p.signal.title,
        text: signalText(t, step),
        tag: step.tag ? { kind: 'planB', label: p.signal.tag(cropInSentence(t, step.tag)) } : null,
      }
    case 'harvest':
      return { ...base, when: formatShortDayMonth(lang, step.date), sub: p.harvest.sub, title: p.harvest.title, text: p.harvest.text }
    case 'plant': {
      const title = p.plant.title(cropInSentence(t, step.crop))
      if (!step.deadline) {
        return {
          ...base,
          when: formatShortDayMonth(lang, step.sowing),
          sub: p.plant.soonSub,
          title,
          text: step.late ? p.plant.lateNoDate : p.plant.soon,
          late: step.late,
        }
      }
      const deadline = formatDayMonth(lang, step.deadline)
      return {
        ...base,
        when: p.plant.when(formatShortDayMonth(lang, step.deadline)),
        sub: p.plant.sub,
        title,
        text: step.late ? p.plant.late(deadline) : p.plant.text(deadline),
        late: step.late,
      }
    }
    case 'water':
      return {
        ...base,
        when: formatMonthRange(lang, step.from, step.to),
        sub: p.water.sub[step.phase],
        title: p.water.title,
        text: step.phase === 'pegamento' ? p.water.start(step.windowDays) : p.water.flower(step.flowerDays),
      }
    case 'cropHarvest':
      return {
        ...base,
        when: formatShortMonth(lang, step.date),
        sub: step.date.slice(0, 4),
        title: step.grain ? p.cropHarvest.grain : p.cropHarvest.cover,
        text: p.cropHarvest.text,
      }
    case 'next':
      return {
        ...base,
        when: p.next.when,
        sub: String(step.year),
        title: step.crop ? p.next.title(cropInSentence(t, step.crop)) : p.next.titleAlone,
        text: p.next.text(step.year + 1),
      }
  }
}

export type PlanningAlertText = { label: string; text: string; todo: string; source: string }

/** O cartão de um alerta da área: o rótulo, a frase com o número, "O que fazer" e a fonte. */
export function planningAlertText(t: Messages, lang: Lang, alert: PlanningAlert): PlanningAlertText {
  const a = t.planning.alerts
  switch (alert.kind) {
    case 'now':
      return { label: a.now.label, text: alert.forecast, todo: a.now.todo, source: `${alert.source}, ${formatFullDate(lang, alert.date)}` }
    case 'heavyRain':
      return {
        label: a.heavyRain.label,
        text: a.heavyRain.text(alert.data.dias, alert.data.total_anos, formatNumber(lang, alert.data.limite_mm)),
        todo: a.heavyRain.todo,
        source: a.heavyRain.source,
      }
    case 'fire':
      return {
        label: a.fire.label,
        text: a.fire.text(formatNumber(lang, alert.data.raio_km), alert.data.anos.length, alert.data.total_anos),
        todo: a.fire.todo,
        source: a.fire.source,
      }
  }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** "Como o plano ajuda a ganhar": quais anos dão renda, o que as coberturas devolvem e o Plano B. */
export function gainText(t: Messages, gain: PlanGain): string {
  const g = t.planning.report.gain
  const income = gain.income.length
    ? gain.income.map((item) => g.income(t.crops.names[item.crop], joinList(t, item.seasons.map(seasonName))))
    : [g.noIncome]
  const covers = gain.covers.map((cover) => {
    const gives = [cover.straw && g.straw, cover.nitrogen && g.nitrogen, cover.nematode && g.nematode].filter(
      (item): item is string => Boolean(item),
    )
    return g.cover(capitalize(t.crops.names[cover.crop]), seasonName(cover.season), joinList(t, gives))
  })
  const planB = gain.planB ? [g.planB(cropInSentence(t, gain.planB.from), cropInSentence(t, gain.planB.to))] : []
  return [...income, ...covers, ...planB].join(' ')
}

export type SummaryInput = {
  /** As 3 culturas do plano, na ordem dos anos. */
  crops: readonly CropId[]
  /** O dia da colheita da soja (ISO). */
  harvest: string
  /** O passo do plantio (prazo do ZARC); null sem lavoura no 1º ano. */
  plant: Extract<TimelineStep, { kind: 'plant' }> | null
  /** A cultura do Plano B; null sem ele. */
  planB: CropId | null
}

/** "Ouvir resumo" da tela 6: o plano, a colheita e o prazo, e o Plano B (2 ou 3 frases, com os números da tela). */
export function planningSummary(t: Messages, lang: Lang, input: SummaryInput): string {
  const s = t.planning.summary
  const crop = (index: number) => cropInSentence(t, input.crops[index])
  const date = formatDayMonth(lang, input.harvest)
  const plant = input.plant
  let harvest: string
  if (!plant) harvest = s.harvestOnly(date)
  else if (!plant.deadline) harvest = s.plantSoon(date, crop(0))
  else if (plant.late) harvest = s.plantLate(date, crop(0), formatDayMonth(lang, plant.deadline))
  else harvest = s.plant(date, crop(0), formatDayMonth(lang, plant.deadline))
  return [
    s.plan(crop(0), seasonName(CURRENT_SEASON), crop(1), seasonName(CURRENT_SEASON + 1), crop(2), seasonName(CURRENT_SEASON + 2)),
    harvest,
    input.planB ? s.planB(cropInSentence(t, input.planB)) : s.check,
  ].join(' ')
}
