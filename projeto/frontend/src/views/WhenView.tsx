import { Button } from '../design-system/components/Button'
import { Card, InfoBanner } from '../design-system/components/Card'
import { RainBarChart } from '../design-system/components/Charts'
import { DateField, RadioCard } from '../design-system/components/Choice'
import { PageHeading } from '../design-system/components/Content'
import { BackLink, QuestionStepper } from '../design-system/components/Navigation'
import { formatDayMonth } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { COLHEITAS, type Colheita } from '../models/talhao'
import type { HarvestWindow } from '../services/harvestService'
import layout from './layout.module.css'

export type WhenViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  /** null enquanto o talhão carrega. */
  suggestion: { faixa: Colheita; fromSatellite: boolean } | null
  selected: Colheita
  dateOpen: boolean
  date: string
  dateBand: Colheita | null
  window: HarvestWindow
  onSelect: (value: Colheita) => void
  onOpenDate: () => void
  onDateChange: (value: string) => void
  onConfirm: () => void
}

/** Chuva média por mês na região (desenho de exemplo): muita em janeiro, quase nada em junho. */
const RAIN_BARS = [100, 83, 70, 35, 15, 7] as const
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const

/** Tela 3 "Quando você colhe a soja?" (pergunta 2 de 2). */
export function WhenView({
  t,
  lang,
  backTo,
  suggestion,
  selected,
  dateOpen,
  date,
  dateBand,
  window,
  onSelect,
  onOpenDate,
  onDateChange,
  onConfirm,
}: WhenViewProps) {
  const w = t.when
  return (
    <div className={layout.page}>
      <div className={layout.topLine}>
        <BackLink to={backTo}>{t.nav.back}</BackLink>
        <QuestionStepper current={2} total={2} label={t.stepper.label(2, 2)} />
      </div>
      <PageHeading title={w.title} />
      {suggestion && (
        <InfoBanner>
          {suggestion.fromSatellite ? (
            <>
              {w.suggestionPrefix} <strong>{t.harvest[suggestion.faixa].inline}</strong>. {w.suggestionSuffix}
            </>
          ) : (
            w.defaultSuggestion
          )}
        </InfoBanner>
      )}
      <div className={layout.pageGrid}>
        <div className={layout.stack}>
          {COLHEITAS.map((band) => (
            <RadioCard
              key={band}
              title={t.harvest[band].title}
              sub={t.harvest[band].sub}
              selected={dateBand === null && selected === band}
              onSelect={() => onSelect(band)}
            />
          ))}
          <RadioCard
            title={w.dateOption}
            sub={w.dateOptionHint}
            selected={dateBand !== null}
            expanded={dateOpen}
            onSelect={onOpenDate}
          />
          {dateOpen && (
            <Card tone="blue">
              <DateField
                label={w.dateLabel}
                value={date}
                min={window.min}
                max={window.max}
                onChange={onDateChange}
                status={dateBand ? w.dateBand(formatDayMonth(lang, date), t.harvest[dateBand].inline) : w.dateNeed}
              />
            </Card>
          )}
          <p className={layout.muted}>{w.hint}</p>
          <Button onClick={onConfirm} arrow detail={w.cta}>
            {w.nextStep}
          </Button>
        </div>
        <Card as="aside" aria-label={w.whyTitle}>
          <h2 className={layout.cardTitle}>{w.whyTitle}</h2>
          <p>{w.whyText}</p>
          <RainBarChart
            label={w.chartLabel}
            caption={w.chartCaption}
            bars={MONTHS.map((month, index) => ({ label: w.months[month], value: RAIN_BARS[index], tone: 'strong' }))}
          />
        </Card>
      </div>
    </div>
  )
}
