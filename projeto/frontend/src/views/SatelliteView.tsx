import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import type { SeasonsModel, XRayModel } from '../controllers/useSatelliteController'
import { BackButton } from '../design-system/components/BackButton'
import { GuideLink } from '../design-system/components/GuideLink'
import { CountUp, InstrumentBlock, InstrumentPanel, LiveBadge, MoistureBar, SoilBar } from '../design-system/components/Instrument'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { MiniMap } from '../design-system/components/MiniMap'
import { Modal } from '../design-system/components/Modal'
import { SeasonChart as SeasonChartFigure, type SeasonChartRowProps } from '../design-system/components/SeasonChart'
import { ArrowRightIcon, CheckIcon, SatelliteIcon, WarningIcon } from '../design-system/icons'
import { formatDayMonth, formatDecimal, formatFullDate, formatMonth, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { xrayText, type XRayText } from '../i18n/xrayTexts'
import type { CurrentChoice, SeasonAnswer } from '../models/seasonAnswers'
import type { ScreenStatus } from '../models/screenStatus'
import { TEXTURAS, type Textura } from '../models/talhao'
import { parseInline } from '../services/markdownService'
import type { XRayBlock } from '../services/raioXService'
import type { SoilSummary } from '../services/satelliteService'
import type { SeasonChart, SeasonChartStatus } from '../services/seasonChartService'
import { satellitePeriod, seasonName } from '../services/seasonService'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import { SeasonAnswersForm } from './SeasonAnswersForm'
import { ShareSeasons, type ShareSeasonsProps } from './ShareSeasons'
import styles from './SatelliteView.module.css'

export type SatelliteViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  status: ScreenStatus
  onRetry: () => void
  listen: ListenSummaryState
  /** Raio-X da sua terra; null sem o dado (o painel não aparece). */
  xray: XRayModel | null
  /** O bloco com o modal aberto. */
  detail: XRayBlock['kind'] | null
  onOpenDetail: (kind: XRayBlock['kind']) => void
  onCloseDetail: () => void
  soil: SoilSummary
  /** "Sua terra é diferente?": grava a terra na URL, sem rolar. */
  onChooseSoil: (value: Textura) => void
  chart: SeasonChart
  seasons: SeasonsModel
  onAnswerSeason: (year: number, answer: SeasonAnswer | null) => void
  onChooseCurrent: (choice: CurrentChoice | null) => void
  /** O satélite não viu soja no ponto em nenhum ano: "Não parece uma lavoura de soja". */
  noSoy: boolean
  adjustTo: string
  /** "Compartilhar com a comunidade" das safras respondidas (tarefa 0047); null = não oferece. */
  share?: Omit<ShareSeasonsProps, 't'> | null
  onConfirm: () => void
}

/** Texto do modal com o negrito (`**…**`) do dicionário, sem HTML. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) =>
        part.type === 'strong' ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>,
      )}
    </>
  )
}

/**
 * Tela 4 "Pronto. O satélite já viu o resto." (pacote 2, tarefa 0058): o raio-X da sua terra (blocos enxutos
 * que abrem o detalhe num modal), "Suas últimas safras" (o gráfico do satélite e as confirmações por safra) e
 * "Ver o que plantar". No celular, o botão fica preso embaixo, com quantas safras estão confirmadas.
 */
export function SatelliteView(props: SatelliteViewProps) {
  const { t, backTo, status, listen } = props
  const s = t.satellite
  return (
    <div className={styles.page}>
      <BackButton to={backTo}>{t.nav.back}</BackButton>
      <h1 className={styles.title}>{s.title}</h1>
      {(status === 'ready' || status === 'loading') && (
        <div className={styles.sub}>
          <p>{s.subtitle}</p>
          {status === 'ready' && (
            <ListenSummary
              supported={listen.supported}
              speaking={listen.speaking}
              onToggle={listen.toggle}
              label={t.listen.summary}
              stopLabel={t.listen.stop}
            />
          )}
        </div>
      )}
      {status === 'loading' && (
        <div className={styles.state}>
          <FlowLoading label={s.loading} />
        </div>
      )}
      {status === 'error' && (
        <div className={styles.state}>
          <FlowError t={t} message={s.error} onRetry={props.onRetry} />
        </div>
      )}
      {status === 'outside' && (
        <div className={styles.state}>
          <FlowOutside t={t} />
        </div>
      )}
      {status === 'ready' && (
        <>
          {props.xray ? <XRayPanel {...props} xray={props.xray} /> : <SoilCard {...props} />}
          <SeasonsSection {...props} />
          <Action {...props} />
        </>
      )}
    </div>
  )
}

function coordinates(lang: Lang, point: { lat: number; lon: number }): string {
  return `${formatDecimal(lang, point.lat, 4)} · ${formatDecimal(lang, point.lon, 4)}`
}

function blockBar(text: XRayText): ReactNode {
  if (text.bar?.kind === 'soil') return <SoilBar clay={text.bar.clay} silt={text.bar.silt} sand={text.bar.sand} />
  if (text.bar?.kind === 'moisture') return <MoistureBar pct={text.bar.pct} />
  return undefined
}

/** O painel escuro: o lugar, os 8 blocos (cada um abre o seu modal) e a nota. */
function XRayPanel(props: SatelliteViewProps & { xray: XRayModel }) {
  const { t, lang, xray, soil, detail, onOpenDetail, onCloseDetail } = props
  const x = t.xray
  const texts = xray.blocks.map((block) => xrayText(t, lang, block, soil))
  const open = texts.find((text) => text.kind === detail) ?? null
  const meta = [
    coordinates(lang, xray.point),
    xray.raio.altitude_m !== null ? x.altitude(formatNumber(lang, xray.raio.altitude_m)) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      <InstrumentPanel
        eyebrow={x.eyebrow}
        title={xray.demo ? t.where.demoName : x.place(xray.place)}
        media={<MiniMap label={x.mapLabel(xray.place)} point={xray.point} />}
        meta={meta}
        aside={xray.raio.leitura_recente && <LiveBadge>{x.latestReading(formatFullDate(lang, xray.raio.leitura_recente))}</LiveBadge>}
        note={x.note}
      >
        {texts.map((text, index) => (
          <InstrumentBlock
            key={text.kind}
            index={index}
            label={text.label}
            value={<CountUp value={text.amount} format={text.format} />}
            unit={text.unit}
            line={text.line}
            badge={text.badge}
            detailsLabel={x.details}
            onOpen={() => onOpenDetail(text.kind)}
            bar={blockBar(text)}
          />
        ))}
      </InstrumentPanel>
      <Modal open={open !== null} onClose={onCloseDetail} title={open?.title ?? ''} closeLabel={t.common.close}>
        {open && (
          <div className={styles.detail}>
            <p className={styles.detailLabel}>{open.label}</p>
            <p className={styles.detailValue}>
              <span>{open.value}</span> <small>{open.unit}</small>
            </p>
            <p className={styles.detailText}>
              <Rich text={open.text} />
            </p>
            {open.kind === 'soil' && <SoilChooser {...props} />}
            <p className={styles.detailSource}>{open.source}</p>
            {open.guide && (
              <GuideLink slug={open.guide.slug} newTabLabel={t.common.newTab} className={styles.detailGuide}>
                {open.guide.label}
              </GuideLink>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

/** "Sua terra é diferente?": arenosa, média ou argilosa (a marcada é a que vale na conta). */
function SoilChooser({ t, soil, onChooseSoil }: SatelliteViewProps) {
  const titleId = useId()
  const x = t.xray.soil
  return (
    <div className={styles.soilChooser} role="group" aria-labelledby={titleId}>
      <p id={titleId} className={styles.soilChooserTitle}>
        {x.change}
      </p>
      <div className={styles.chips}>
        {TEXTURAS.map((textura) => (
          <button
            key={textura}
            type="button"
            className={styles.chip}
            aria-pressed={soil.textura === textura}
            onClick={() => onChooseSoil(textura)}
          >
            {x.options[textura]}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Sem o raio-X (falha ou API antiga): a terra num cartão claro, com a troca. */
function SoilCard(props: SatelliteViewProps) {
  const { t, soil } = props
  const s = t.satellite
  const titleId = useId()
  const source = { map: s.soilFromMap, user: s.soilFromUser, default: s.soilDefault }[soil.source]
  return (
    <section className={styles.soilCard} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.soilCardTitle}>
        {s.soilFallback(t.xray.textures[soil.textura])}
      </h2>
      <p className={styles.soilCardText}>{source}</p>
      <SoilChooser {...props} />
    </section>
  )
}

function seenText(t: Messages, seasons: SeasonsModel): string {
  const ss = t.satellite.seasons
  switch (seasons.seen.kind) {
    case 'all':
      return ss.seenAll
    case 'some':
      return ss.seenSome(seasons.seen.count)
    case 'none':
      return ss.seenNone
    case 'no-reading':
      return ss.noReading
  }
}

/** Nome da cultura no meio da frase ("pensa em milho sozinho"). */
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

function pastStatus(t: Messages, status: SeasonChartStatus): ReactNode {
  const ss = t.satellite.seasons
  if (status.kind === 'answer') {
    const label = status.answer === 'sem_soja' ? ss.noSoy : t.seasons.options[status.answer]
    return (
      <b className={styles.answer} data-tone={status.answer === 'pousio' ? 'fallow' : undefined}>
        <CheckIcon size={13} />
        <span>{label}</span>
      </b>
    )
  }
  return <span>{status.kind === 'satellite' ? ss.satellite[status.situation] : ss.missing}</span>
}

function currentStatus(t: Messages, choice: CurrentChoice | null): ReactNode {
  const ss = t.satellite.seasons
  if (choice === null) return <span>{ss.toPlan}</span>
  if (choice === 'nao_sei') return <b className={styles.plan}>{ss.notSure}</b>
  const name = choice === 'pousio' ? t.seasons.fallowFuture : t.seasons.options[choice]
  return <b className={styles.plan}>{ss.plans(lower(name))}</b>
}

/** Um ano comum só para escrever o "MM-DD" da coluna como "17 de janeiro". */
const dayMonth = (lang: Lang, mmdd: string) => formatDayMonth(lang, `2023-${mmdd}`)

function ChartFigure({ t, lang, chart }: SatelliteViewProps) {
  const ss = t.satellite.seasons
  const ndvi = (value: number) => formatDecimal(lang, value, 2)
  const title = !chart.readings ? ss.chartTitleNoReading : chart.total > 0 ? ss.chartTitle(chart.idle, chart.total) : ss.chartTitleNoSoy
  const { soy, harvest, offseason } = chart.marks
  const marks = [
    { key: 'soy' as const, label: ss.marks.soy, from: soy[0], to: soy[1] },
    ...(harvest !== null ? [{ key: 'harvest' as const, label: ss.marks.harvest, from: harvest, to: harvest + 1 }] : []),
    { key: 'after' as const, label: ss.marks.after, from: offseason[0], to: offseason[1] },
  ]
  const months = chart.months.map((month) => ({ label: formatMonth(lang, month.month).slice(0, 3), from: month.from, span: month.span }))
  const rows: SeasonChartRowProps[] = [
    ...chart.rows.map(
      (row): SeasonChartRowProps => ({
        key: row.year,
        season: seasonName(row.year),
        period: satellitePeriod(row.year, lang),
        tone: row.confirmable ? 'confirmable' : 'plain',
        cells:
          row.cells?.map((cell, index) => ({
            level: cell.level,
            title:
              cell.value === null
                ? ss.cellEmpty(dayMonth(lang, chart.columns[index]))
                : ss.cell(dayMonth(lang, chart.columns[index]), ndvi(cell.value)),
          })) ?? null,
        status: pastStatus(t, row.status),
      }),
    ),
    {
      key: chart.current.year,
      season: seasonName(chart.current.year),
      period: satellitePeriod(chart.current.year, lang),
      tone: 'current',
      cells: null,
      status: currentStatus(t, chart.current.choice),
    },
  ]
  const someEmpty = chart.rows.some((row) => row.cells === null || row.cells.some((cell) => cell.level === 0))
  return (
    <SeasonChartFigure
      title={title}
      seasonLabel={ss.colSeason}
      afterLabel={ss.colAfter}
      columns={chart.columns.length}
      marks={marks}
      months={months}
      rows={rows}
      legend={
        chart.readings
          ? { title: ss.legendTitle, levels: ss.legend, noReading: someEmpty ? ss.legendNoReading : null, current: ss.legendCurrent, source: ss.chartSource }
          : { title: null, levels: [], noReading: ss.legendNoReading, current: ss.legendCurrent, source: null }
      }
    />
  )
}

/** "Não parece uma lavoura de soja": um aviso, sem selo de "pronto". */
function SoyWarning({ t, adjustTo }: SatelliteViewProps) {
  const s = t.satellite
  return (
    <div className={styles.soyWarning}>
      <WarningIcon size={20} />
      <div>
        <p className={styles.soyWarningTitle}>{s.noSoyTitle}</p>
        <p>{s.noSoyDetail}</p>
        <Link to={adjustTo} className={styles.soyWarningLink}>
          {s.adjustMap}
        </Link>
      </div>
    </div>
  )
}

/** "Suas últimas safras": o gráfico do satélite em cima e as confirmações embaixo. */
function SeasonsSection(props: SatelliteViewProps) {
  const { t, lang, chart, seasons, onAnswerSeason, onChooseCurrent, noSoy, share } = props
  const s = t.satellite
  const ss = s.seasons
  const titleId = useId()
  const confirmId = useId()
  const reading = seasons.seen.kind !== 'no-reading'
  const first = chart.rows[0]?.year
  return (
    <section className={styles.seasons} aria-labelledby={titleId}>
      <div className={styles.seasonsTop}>
        <div>
          <h2 id={titleId} className={styles.seasonsTitle}>
            {ss.title}
          </h2>
          <p className={styles.seasonsSub}>{chart.readings && first ? ss.subtitle(seasonName(first)) : ss.subtitleNoReading}</p>
        </div>
        <p className={styles.satStatus} data-reading={reading}>
          <SatelliteIcon size={15} />
          <span>{seenText(t, seasons)}</span>
        </p>
      </div>
      {noSoy && <SoyWarning {...props} />}
      <div className={styles.chart}>
        <ChartFigure {...props} />
      </div>
      <section className={styles.confirm} aria-labelledby={confirmId}>
        <h3 id={confirmId} className={styles.confirmTitle}>
          {s.confirmTitle}
        </h3>
        <p className={styles.confirmSub}>{reading ? ss.confirmSub : ss.confirmSubNoReading}</p>
        <SeasonAnswersForm
          t={t}
          lang={lang}
          seasons={seasons.rows}
          answers={seasons.answers}
          onAnswer={onAnswerSeason}
          current={{
            choice: seasons.current.choice,
            onChoose: onChooseCurrent,
            harvestDate: seasons.current.harvestDate,
            changeDateTo: seasons.current.changeDateTo,
          }}
        />
      </section>
      {share && (
        <div className={styles.share}>
          <ShareSeasons t={t} {...share} />
        </div>
      )}
      <div className={styles.seasonsFoot}>
        <span>{ss.note}</span>
        <GuideLink slug="rotacao-de-culturas" newTabLabel={t.common.newTab}>
          {ss.rotation}
        </GuideLink>
      </div>
    </section>
  )
}

/** "Ver o que plantar →": no computador, com o que falta ao lado; no celular, preso embaixo com a contagem. */
function Action({ t, seasons, onConfirm }: SatelliteViewProps) {
  const ss = t.satellite.seasons
  const missing = 3 - seasons.answered
  const reading = seasons.seen.kind !== 'no-reading'
  const text = missing === 0 ? ss.done : reading ? ss.missingAction(missing) : ss.missingActionNoReading(missing)
  return (
    <div className={styles.action} data-action-bar="">
      <p className={styles.actionText}>{text}</p>
      <p className={styles.barStatus}>
        <CheckIcon size={16} />
        <span>{missing === 0 ? ss.barDone : ss.barCount(seasons.answered)}</span>
      </p>
      <button type="button" className={styles.cta} onClick={onConfirm}>
        <span>{t.satellite.cta}</span>
        <ArrowRightIcon size={18} />
      </button>
    </div>
  )
}
