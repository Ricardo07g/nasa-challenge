import { Button } from '../design-system/components/Button'
import { Card, InfoBanner } from '../design-system/components/Card'
import { RainBarChart } from '../design-system/components/Charts'
import { DateField, RadioCard } from '../design-system/components/Choice'
import { PageHeading } from '../design-system/components/Content'
import { BackLink, QuestionStepper } from '../design-system/components/Navigation'
import { formatDayMonth, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { COLHEITAS, type Colheita } from '../models/talhao'
import type { HarvestWindow } from '../services/harvestService'
import type { RainChart } from '../services/monthlyRainService'
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
  /** Chuva de cada mês na região (`chuva_mensal` do talhão): null = sem gráfico (decisão D2); 'loading' = carregando. */
  rainChart: RainChart | null | 'loading'
  /** RF-24: o satélite não viu soja no ponto na última safra; null = nenhum aviso. */
  soyWarning: { safra: string } | null
  /** "Seguir mesmo assim": fecha o aviso ("Ajustar no mapa" é um link para `backTo`). */
  onDismissSoyWarning: () => void
}

/** Nome da fonte como a tela "Como a conta é feita" escreve; chave desconhecida sai como veio. */
function sourceLabel(t: Messages, key: string): string {
  const sources = t.method.sources
  return Object.hasOwn(sources, key) ? sources[key as keyof typeof sources].source : key
}

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
  rainChart,
  soyWarning,
  onDismissSoyWarning,
}: WhenViewProps) {
  const w = t.when
  return (
    <div className={layout.page}>
      <div className={layout.topLine}>
        <BackLink to={backTo}>{t.nav.back}</BackLink>
        <QuestionStepper current={2} total={2} label={t.stepper.label(2, 2)} />
      </div>
      <PageHeading title={w.title} />
      {soyWarning && (
        <Card tone="orange">
          <p role="alert">{w.soyWarning(soyWarning.safra)}</p>
          <div className={layout.stack}>
            <Button to={backTo} variant="outline">
              {w.soyAdjust}
            </Button>
            <Button onClick={onDismissSoyWarning} variant="outline">
              {w.soyContinue}
            </Button>
          </div>
        </Card>
      )}
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
          {rainChart && rainChart !== 'loading' && (
            <RainBarChart
              label={w.chartDataLabel(
                rainChart.bars.map((bar) => w.chartMonthValue(w.months[bar.month], formatNumber(lang, bar.mm))).join(', '),
              )}
              caption={w.chartSource(
                rainChart.firstYear,
                rainChart.lastYear,
                rainChart.years,
                rainChart.sources.map((key) => sourceLabel(t, key)).join(' + '),
              )}
              bars={rainChart.bars.map((bar) => ({
                label: w.months[bar.month],
                value: bar.heightPct,
                tone: 'strong',
                display: formatNumber(lang, bar.mm),
              }))}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
