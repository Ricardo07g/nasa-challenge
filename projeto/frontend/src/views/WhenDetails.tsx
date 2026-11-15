import { useId, type ReactNode } from 'react'
import { RainEndTimeline, RainEtoChart, RainLeftChart } from '../design-system/components/Charts'
import { GuideLink } from '../design-system/components/GuideLink'
import { formatDayMonth, formatMonth, formatNumber, formatShortDayMonth } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { Colheita } from '../models/talhao'
import type { GuideSlug } from '../content/guia/slugs'
import type { HarvestBand } from '../services/harvestBandsService'
import type { HarvestChoice } from '../services/harvestService'
import type { RainChart, RainMonth } from '../services/monthlyRainService'
import type { RainEnd, RainLeft, RainLeftCurve } from '../services/rainLeftService'
import { parseInline } from '../services/markdownService'
import { CURRENT_SEASON } from '../services/seasonService'
import styles from './WhenDetails.module.css'

export type WhenDetailsProps = {
  t: Messages
  lang: Lang
  choice: HarvestChoice | null
  bands: readonly HarvestBand[]
  rainCurve: RainLeftCurve | null
  rainLeft: RainLeft | null
  rainChart: RainChart | null
  rainEnd: RainEnd | null
  heatC: number | null
  onUseBand: (band: Colheita) => void
}

const MONTH_NUMBER: Record<RainMonth, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6 }
/** Ano comum só para escrever as datas "MM-DD" da API. */
const COMMON_YEAR = 2023

/** Nome da fonte como a tela "Como a conta é feita" escreve; chave desconhecida sai como veio. */
function sourceLabel(t: Messages, key: string): string {
  const sources = t.method.sources
  return Object.hasOwn(sources, key) ? sources[key as keyof typeof sources].source : key
}

const sourcesLabel = (t: Messages, keys: readonly string[]) => keys.map((key) => sourceLabel(t, key)).join(' + ')

function cropName(t: Messages, id: string): string {
  const names: Record<string, string> = t.crops.names
  return names[id] ?? id
}

/** Texto com **negrito** (o parseInline do Guia): nunca HTML. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) =>
        part.type === 'strong' ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>,
      )}
    </>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className={styles.block} aria-labelledby={id}>
      <h3 id={id} className={styles.heading}>
        {title}
      </h3>
      {children}
    </section>
  )
}

function LearnMore({ t, slug, children }: { t: Messages; slug: GuideSlug; children: string }) {
  return (
    <div className={styles.learn}>
      <GuideLink slug={slug} newTabLabel={t.common.newTab}>
        {children}
      </GuideLink>
    </div>
  )
}

/** 1. Compare as épocas: chuva que sobra, melhor opção e "deu certo" de cada época, com a do produtor destacada. */
function CompareBlock({ t, lang, bands, rainCurve, heatC, onUseBand }: WhenDetailsProps) {
  const w = t.when
  const withCost = bands.some((band) => band.best)
  const rain = rainCurve ? sourcesLabel(t, rainCurve.sources) : sourceLabel(t, 'gpm_imerg')
  const years = rainCurve ? w.years(rainCurve.firstYear, rainCurve.lastYear) : null
  return (
    <Block title={w.compareTitle}>
      <p className={styles.text}>{w.compareText}</p>
      <div className={styles.bands}>
        {bands.map((band) => (
          <div key={band.band} className={styles.band} data-band={band.band} data-yours={band.yours}>
            <div className={styles.bandTop}>
              <b>
                {t.harvest[band.band].title}
                {band.yours && <span className={styles.yourTag}>{w.yourBand}</span>}
              </b>
              {band.rainMm !== null && (
                <span className={styles.bandRain}>
                  <span>{`${formatNumber(lang, band.rainMm)} mm`}</span> <small>{w.onAverage}</small>
                </span>
              )}
            </div>
            {band.best ? (
              <p>{w.worked(cropName(t, band.best.crop), band.best.good, band.best.total)}</p>
            ) : (
              withCost && <p>{w.noOption}</p>
            )}
            {!band.yours && (
              <button type="button" className={styles.useBand} onClick={() => onUseBand(band.band)}>
                {w.useBand}
              </button>
            )}
          </div>
        ))}
      </div>
      {withCost && <p className={styles.source}>{w.workedMeans(heatC, rain, years)}</p>}
      <LearnMore t={t} slug="deu-certo">
        {w.learnWorked}
      </LearnMore>
    </Block>
  )
}

/** 2. Chuva que sobra para a próxima planta: a frase com os números do dia escolhido e a curva. */
function RainBlock({ t, lang, choice, rainLeft, curve }: WhenDetailsProps & { curve: RainLeftCurve }) {
  const w = t.when
  const end = formatDayMonth(lang, `${CURRENT_SEASON}-${curve.endDay}`)
  const median = rainLeft ? formatNumber(lang, rainLeft.medianMm) : ''
  const dry = rainLeft ? formatNumber(lang, rainLeft.dryMm) : ''
  const leftDay = rainLeft ? formatDayMonth(lang, rainLeft.date) : ''
  const first = curve.points[0]?.day ?? '01-15'
  const last = curve.points[curve.points.length - 1]?.day ?? '03-31'
  let lead = w.rainEmpty(end)
  if (choice && rainLeft) {
    lead = choice.date
      ? w.rainDate(leftDay, end, median, dry)
      : w.rainBand(t.harvest[choice.band].inline, leftDay, end, median, dry)
  } else if (choice?.date) {
    lead = w.rainOutside(
      formatDayMonth(lang, choice.date),
      formatDayMonth(lang, `${COMMON_YEAR}-${first}`),
      formatDayMonth(lang, `${COMMON_YEAR}-${last}`),
    )
  }
  const lastIndex = curve.points.length - 1
  const ticks = curve.points.flatMap((point, index) =>
    index === 0 || index === lastIndex || point.day.endsWith('-01')
      ? [{ index, label: formatShortDayMonth(lang, `${COMMON_YEAR}-${point.day}`) }]
      : [],
  )
  return (
    <Block title={w.rainTitle}>
      <p className={styles.text}>
        <Rich text={lead} />
      </p>
      <div className={styles.chart}>
        <RainLeftChart
          label={rainLeft ? w.rainChartLabelDay(leftDay, median, dry) : w.rainChartLabel}
          points={curve.points}
          max={curve.maxMm}
          unit="mm"
          selectedIndex={rainLeft ? rainLeft.selectedIndex : null}
          selectedLabels={rainLeft ? { median: `${median} mm`, dry: `${dry} mm` } : undefined}
          ticks={ticks}
          legend={{ median: w.legendMedian, dry: w.legendDry }}
        />
      </div>
      <p className={styles.text}>
        <Rich text={w.rainLines(curve.firstYear, curve.lastYear, curve.percentile)} />
      </p>
      <p className={styles.source}>{w.rainSource(sourcesLabel(t, curve.sources), curve.firstYear, curve.lastYear)}</p>
      <LearnMore t={t} slug="plantar-logo-depois-da-colheita">
        {w.learnRain}
      </LearnMore>
    </Block>
  )
}

/** 3. Chuva e o que a lavoura gasta, mês a mês: só o primeiro mês com chuva menor que o gasto fica em destaque. */
function MonthBlock({ t, lang, chart }: { t: Messages; lang: Lang; chart: RainChart & { eto: NonNullable<RainChart['eto']> } }) {
  const w = t.when
  const deficit = chart.eto.deficitMonth
  const deficitNumber = deficit ? MONTH_NUMBER[deficit] : null
  const turn =
    deficitNumber === null
      ? w.monthNoTurn
      : w.monthTurn(
          deficitNumber > 1 ? w.monthRange(formatMonth(lang, 1), formatMonth(lang, deficitNumber - 1)) : null,
          formatMonth(lang, deficitNumber),
        )
  return (
    <Block title={w.monthTitle}>
      <p className={styles.text}>{w.monthText}</p>
      <div className={styles.chart}>
        <RainEtoChart
          label={w.etoChartLabel(
            chart.bars
              .map((bar) => w.etoMonthValue(w.months[bar.month], formatNumber(lang, bar.mm), formatNumber(lang, bar.etoMm ?? 0)))
              .join('; '),
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
      </div>
      <p className={styles.text}>
        <Rich text={turn} />
      </p>
      <p className={styles.source}>
        {w.etoCaption(chart.firstYear, chart.lastYear, chart.years, sourcesLabel(t, chart.sources), sourceLabel(t, chart.eto.source))}
      </p>
      <LearnMore t={t} slug="conta-de-agua">
        {w.learnWater}
      </LearnMore>
    </Block>
  )
}

/** 4. Quando a chuva acaba: a linha do tempo (mais cedo, metade dos anos, mais tarde) e a regra da conta. */
function EndBlock({ t, lang, end }: { t: Messages; lang: Lang; end: RainEnd }) {
  const w = t.when
  const lastDay = end.latest.date.slice(5)
  const axisEnd = lastDay > '06-30' ? '07-31' : '06-30'
  const tickDays = ['03-01', '04-01', '05-01', '06-01', ...(axisEnd === '07-31' ? ['07-01'] : [])]
  return (
    <Block title={w.endTitle}>
      <p className={styles.text}>
        <Rich
          text={w.endText(
            formatDayMonth(lang, end.median),
            end.earliest.year,
            formatDayMonth(lang, end.earliest.date),
            end.latest.year,
            formatDayMonth(lang, end.latest.date),
          )}
        />
      </p>
      <div className={styles.timeline}>
        <RainEndTimeline
          label={w.endChartLabel(
            formatDayMonth(lang, end.median),
            w.endYear(formatDayMonth(lang, end.earliest.date), end.earliest.year),
            w.endYear(formatDayMonth(lang, end.latest.date), end.latest.year),
          )}
          start={end.startDate.slice(5)}
          end={axisEnd}
          ticks={tickDays.map((day) => ({ day, label: formatShortDayMonth(lang, `${COMMON_YEAR}-${day}`) }))}
          points={[
            { day: end.earliest.date.slice(5), label: w.endYear(formatShortDayMonth(lang, end.earliest.date), end.earliest.year), tone: 'early' },
            { day: end.median.slice(5), label: w.endHalf(formatShortDayMonth(lang, end.median)), tone: 'median' },
            { day: lastDay, label: w.endYear(formatShortDayMonth(lang, end.latest.date), end.latest.year), tone: 'late' },
          ]}
        />
      </div>
      <p className={styles.text}>
        <Rich text={w.endRule(formatDayMonth(lang, end.startDate), end.days, formatNumber(lang, end.maxMm))} />
      </p>
      <p className={styles.source}>{w.endSource(sourcesLabel(t, end.sources), end.firstYear, end.lastYear)}</p>
      <LearnMore t={t} slug="quando-a-chuva-acaba">
        {w.learnEnd}
      </LearnMore>
    </Block>
  )
}

/**
 * Miolo do modal grande "Nossas sugestões para a data da colheita" (tela 2, tarefa 0057): 4 blocos com os
 * textos sempre abertos, em 2 colunas no computador e 1 no celular. Bloco sem dado não aparece (decisão D2).
 */
export function WhenDetails(props: WhenDetailsProps) {
  const { t, lang, bands, rainCurve, rainChart, rainEnd } = props
  const compare = bands.some((band) => band.rainMm !== null || band.best !== null)
  const eto = rainChart?.eto ? { ...rainChart, eto: rainChart.eto } : null
  return (
    <div className={styles.grid}>
      {compare && <CompareBlock {...props} />}
      {rainCurve && <RainBlock {...props} curve={rainCurve} />}
      {eto && <MonthBlock t={t} lang={lang} chart={eto} />}
      {rainEnd && <EndBlock t={t} lang={lang} end={rainEnd} />}
    </div>
  )
}
