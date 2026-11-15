import { Link } from 'react-router'
import { Button, TextButton } from '../design-system/components/Button'
import { Card, InfoBanner } from '../design-system/components/Card'
import { RainEtoChart, RainLeftChart } from '../design-system/components/Charts'
import { DateField, RadioCard } from '../design-system/components/Choice'
import { PageHeading } from '../design-system/components/Content'
import { BackLink, QuestionStepper } from '../design-system/components/Navigation'
import type { RainLeftState } from '../controllers/useWhenController'
import { formatDayMonth, formatMonth, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { COLHEITAS, type Colheita } from '../models/talhao'
import type { DelayCost } from '../services/delayCostService'
import type { HarvestSuggestion, HarvestWindow } from '../services/harvestService'
import type { RainChart, RainMonth } from '../services/monthlyRainService'
import type { RainEnd } from '../services/rainLeftService'
import layout from './layout.module.css'

export type WhenViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  /** O que o satélite viu; null enquanto o talhão carrega. */
  suggestion: HarvestSuggestion | null
  /** O dia no campo é o do satélite. */
  suggestionApplied: boolean
  onUseSuggestion: () => void
  selected: Colheita
  date: string
  dateBand: Colheita | null
  window: HarvestWindow
  onDateChange: (value: string) => void
  /** "Não sei o dia exato": as 3 faixas abertas. */
  bandsOpen: boolean
  onToggleBands: () => void
  onSelect: (value: Colheita) => void
  onConfirm: () => void
  /** Chuva e gasto (ETo) de cada mês: null = sem bloco (decisão D2); 'loading' = carregando. */
  rainChart: RainChart | null | 'loading'
  rainLeft: RainLeftState
  rainEnd: RainEnd | null | 'loading'
  delayCost: DelayCost | null | 'loading'
  /** RF-24: o satélite não viu soja no ponto na última safra; null = nenhum aviso. */
  soyWarning: { safra: string } | null
  /** "Seguir mesmo assim": fecha o aviso ("Ajustar no mapa" é um link para `backTo`). */
  onDismissSoyWarning: () => void
}

/** Artigos do Guia ligados a esta tela (seção 8 da remodelagem). */
const ARTICLE = {
  rainEnd: '/guia/quando-a-chuva-acaba',
  sowSoon: '/guia/plantar-logo-depois-da-colheita',
  water: '/guia/conta-de-agua',
  worked: '/guia/deu-certo',
}

const MONTH_NUMBER: Record<RainMonth, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6 }
const MONTH_KEY: Record<number, RainMonth> = { 1: 'jan', 2: 'feb', 3: 'mar' }

/** Nome da fonte como a tela "Como a conta é feita" escreve; chave desconhecida sai como veio. */
function sourceLabel(t: Messages, key: string): string {
  const sources = t.method.sources
  return Object.hasOwn(sources, key) ? sources[key as keyof typeof sources].source : key
}

const sourcesLabel = (t: Messages, keys: readonly string[]) => keys.map((key) => sourceLabel(t, key)).join(' + ')

/** Nome da cultura no meio da frase ("milho com braquiária"). */
function cropName(t: Messages, id: string): string {
  const names: Record<string, string> = t.crops.names
  const name = names[id] ?? id
  return name.charAt(0).toLowerCase() + name.slice(1)
}

function LearnMore({ to, title, t }: { to: string; title: string; t: Messages }) {
  return (
    <Link to={to} className={layout.iconLink}>
      {t.when.learnMore(title)}
    </Link>
  )
}

/** Faixa azul: o que o satélite viu. Só diz "já deixamos" quando é isso mesmo que está marcado. */
function SuggestionBanner(props: Pick<WhenViewProps, 't' | 'lang' | 'suggestion' | 'suggestionApplied' | 'selected' | 'date' | 'onUseSuggestion'>) {
  const { t, lang, suggestion, suggestionApplied, selected, date, onUseSuggestion } = props
  const w = t.when
  if (!suggestion) return null
  if (!suggestion.fromSatellite) {
    const marked = selected === 'meio' && date === ''
    return <InfoBanner>{marked ? `${w.noSatellite} ${w.defaultMarked}` : w.noSatellite}</InfoBanner>
  }
  if (!suggestion.date) {
    const text = `${w.suggestionPrefix} ${t.harvest[suggestion.faixa].inline}.`
    return <InfoBanner>{selected === suggestion.faixa ? `${text} ${w.suggestionSuffix}` : text}</InfoBanner>
  }
  const text = w.suggestionDate(formatDayMonth(lang, suggestion.date), t.harvest[suggestion.faixa].inline)
  return (
    <>
      <InfoBanner>{suggestionApplied ? `${text} ${w.suggestionApplied}` : text}</InfoBanner>
      {!suggestionApplied && <TextButton onClick={onUseSuggestion}>{w.useSuggestion}</TextButton>}
    </>
  )
}

/** "Chuva que sobra depois da colheita" e o fim das chuvas na célula. */
function RainLeftSection({ t, lang, left, end }: { t: Messages; lang: Lang; left: RainLeftState; end: RainEnd | null | 'loading' }) {
  const w = t.when
  const hasLeft = left !== null && left !== 'loading'
  const hasEnd = end !== null && end !== 'loading'
  if (!hasLeft && !hasEnd) return null
  return (
    <section aria-label={w.leftTitle} className={layout.stack}>
      <h3 className={layout.cardTitle}>{w.leftTitle}</h3>
      {hasLeft && <RainLeftBlock t={t} lang={lang} left={left} />}
      {hasEnd && (
        <>
          <h3 className={layout.cardTitle}>{w.endTitle}</h3>
          <p>
            {w.endText(
              formatDayMonth(lang, end.median),
              w.endYear(formatDayMonth(lang, end.earliest.date), end.earliest.year),
              w.endYear(formatDayMonth(lang, end.latest.date), end.latest.year),
            )}
          </p>
          <p className={layout.muted}>
            {w.endRule(
              formatDayMonth(lang, end.startDate),
              end.days,
              formatNumber(lang, end.maxMm),
              sourcesLabel(t, end.sources),
              end.firstYear,
              end.lastYear,
            )}
          </p>
        </>
      )}
      <LearnMore to={ARTICLE.rainEnd} title={w.articles.rainEnd} t={t} />
    </section>
  )
}

function RainLeftBlock({ t, lang, left }: { t: Messages; lang: Lang; left: Exclude<RainLeftState, null | 'loading'> }) {
  const w = t.when
  const day = formatDayMonth(lang, left.date)
  const median = formatNumber(lang, left.medianMm)
  const dry = formatNumber(lang, left.dryMm)
  const sentence = left.exact
    ? w.leftExact(day, median, dry)
    : w.leftBand(t.harvest[left.band].inline, day, median, dry)
  const last = left.points.length - 1
  const ticks = left.points.flatMap((point, index) =>
    index === 0 || index === last || point.day.endsWith('-01')
      ? [{ index, label: `${Number(point.day.slice(3))} ${w.months[MONTH_KEY[Number(point.day.slice(0, 2))] ?? 'jan']}` }]
      : [],
  )
  return (
    <>
      <p className={layout.lead}>{sentence}</p>
      <RainLeftChart
        label={w.leftChartLabel(day, median, dry)}
        caption={w.leftCaption(
          formatDayMonth(lang, `${left.date.slice(0, 4)}-${left.endDay}`),
          left.firstYear,
          left.lastYear,
          sourcesLabel(t, left.sources),
          left.percentile,
        )}
        points={left.points}
        max={left.maxMm}
        topLabel={`${formatNumber(lang, left.maxMm)} mm`}
        selectedIndex={left.selectedIndex}
        ticks={ticks}
        legend={{ median: w.leftLegendMedian, dry: w.leftLegendDry }}
      />
    </>
  )
}

/** Chuva e o que a lavoura gasta (ETo), mês a mês, com o mês em que a chuva fica abaixo escrito. */
function RainEtoSection({ t, lang, chart }: { t: Messages; lang: Lang; chart: RainChart }) {
  const w = t.when
  const eto = chart.eto
  if (!eto) return null
  const deficit = eto.deficitMonth
  return (
    <Card as="section" aria-label={w.etoTitle}>
      <div className={layout.stack}>
        <h2 className={layout.cardTitle}>{w.etoTitle}</h2>
        <p>{deficit ? w.etoDeficit(formatMonth(lang, MONTH_NUMBER[deficit])) : w.etoNoDeficit}</p>
        <RainEtoChart
          label={w.etoChartLabel(
            chart.bars
              .map((bar) => w.etoMonthValue(w.months[bar.month], formatNumber(lang, bar.mm), formatNumber(lang, bar.etoMm ?? 0)))
              .join('; '),
          )}
          caption={w.etoCaption(
            chart.firstYear,
            chart.lastYear,
            chart.years,
            sourcesLabel(t, chart.sources),
            sourceLabel(t, eto.source),
          )}
          legend={{ rain: w.etoLegendRain, eto: w.etoLegendEto }}
          bars={chart.bars.map((bar) => ({
            label: w.months[bar.month],
            rainPct: bar.heightPct,
            etoPct: bar.etoHeightPct ?? 0,
            rainDisplay: formatNumber(lang, bar.mm),
            etoDisplay: formatNumber(lang, bar.etoMm ?? 0),
            tag: bar.month === deficit ? w.etoTag : undefined,
          }))}
        />
        <LearnMore to={ARTICLE.water} title={w.articles.water} t={t} />
      </div>
    </Card>
  )
}

/** Custo do atraso: "Colhendo cedo, deu certo em A de 20 anos; no meio, B de 20; tarde, C de 20." */
function DelayCostSection({ t, cost, selected }: { t: Messages; cost: DelayCost; selected: Colheita }) {
  const w = t.when
  const sentence = `${cost.bands
    .map((band, index) => {
      const crop = cost.sameCrop ? null : cropName(t, band.crop)
      const name = w.delayBand[band.band]
      return index === 0 ? w.delayFirst(name, band.good, band.total, crop) : w.delayNext(name, band.good, band.total, crop)
    })
    .join('; ')}.`
  return (
    <Card as="section" aria-label={w.delayTitle}>
      <div className={layout.stack}>
        <h2 className={layout.cardTitle}>{w.delayTitle}</h2>
        <p className={layout.lead}>{sentence}</p>
        <p>{cost.sameCrop ? w.delaySame(cropName(t, cost.bands[0].crop)) : w.delayDiffers}</p>
        <ul className={layout.stack}>
          {cost.bands.map((band) => (
            <li key={band.band}>
              <strong>{t.harvest[band.band].title}</strong> {w.delayRow(cropName(t, band.crop), band.good, band.total)}
              {band.band === selected && <span> ({w.delayYours})</span>}
            </li>
          ))}
        </ul>
        <p className={layout.muted}>{w.delayNote}</p>
        <LearnMore to={ARTICLE.sowSoon} title={w.articles.sowSoon} t={t} />
        <LearnMore to={ARTICLE.worked} title={w.articles.worked} t={t} />
      </div>
    </Card>
  )
}

/** Tela 3 "Quando você colhe a soja?" (pergunta 2 de 2, tarefa 0042). */
export function WhenView(props: WhenViewProps) {
  const { t, lang, backTo, selected, date, dateBand, window, bandsOpen, rainChart, rainLeft, rainEnd, delayCost } = props
  const w = t.when
  const status = date === '' ? w.dateEmpty : dateBand ? w.dateBand(formatDayMonth(lang, date), t.harvest[dateBand].inline) : w.dateNeed
  const chart = rainChart !== null && rainChart !== 'loading' ? rainChart : null
  const cost = delayCost !== null && delayCost !== 'loading' ? delayCost : null
  return (
    <div className={layout.page}>
      <div className={layout.topLine}>
        <BackLink to={backTo}>{t.nav.back}</BackLink>
        <QuestionStepper current={2} total={2} label={t.stepper.label(2, 2)} />
      </div>
      <PageHeading title={w.title} />
      {props.soyWarning && (
        <Card tone="orange">
          <p role="alert">{w.soyWarning(props.soyWarning.safra)}</p>
          <div className={layout.stack}>
            <Button to={backTo} variant="outline">
              {w.soyAdjust}
            </Button>
            <Button onClick={props.onDismissSoyWarning} variant="outline">
              {w.soyContinue}
            </Button>
          </div>
        </Card>
      )}
      <div className={layout.pageGrid}>
        <div className={layout.stack}>
          <Card tone="blue">
            <DateField
              label={w.dateLabel}
              value={date}
              min={window.min}
              max={window.max}
              onChange={props.onDateChange}
              status={status}
            />
          </Card>
          <SuggestionBanner {...props} />
          <TextButton onClick={props.onToggleBands} expanded={bandsOpen}>
            {w.dontKnow}
          </TextButton>
          {bandsOpen &&
            COLHEITAS.map((band) => (
              <RadioCard
                key={band}
                title={t.harvest[band].title}
                sub={t.harvest[band].sub}
                selected={selected === band}
                onSelect={() => props.onSelect(band)}
              />
            ))}
          <p className={layout.muted}>{w.hint}</p>
          <Button onClick={props.onConfirm} arrow detail={w.cta}>
            {w.nextStep}
          </Button>
        </div>
        <Card as="aside" aria-label={w.whyTitle}>
          <div className={layout.stack}>
            <h2 className={layout.cardTitle}>{w.whyTitle}</h2>
            <p>{w.whyText}</p>
            <RainLeftSection t={t} lang={lang} left={rainLeft} end={rainEnd} />
          </div>
        </Card>
      </div>
      {(cost || chart?.eto) && (
        <div className={layout.columns}>
          {cost && (
            <div className={layout.column}>
              <DelayCostSection t={t} cost={cost} selected={selected} />
            </div>
          )}
          {chart?.eto && (
            <div className={layout.column}>
              <RainEtoSection t={t} lang={lang} chart={chart} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
