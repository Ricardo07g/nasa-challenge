import { Link } from 'react-router'
import { Button } from '../design-system/components/Button'
import { Card } from '../design-system/components/Card'
import { RainBarChart } from '../design-system/components/Charts'
import { ChipGroup } from '../design-system/components/Choice'
import { PageHeading } from '../design-system/components/Content'
import { ErrorState } from '../design-system/components/Feedback'
import { BackLink } from '../design-system/components/Navigation'
import { ReportsMap, type ReportCell } from '../design-system/components/ReportsMap'
import { SendIcon } from '../design-system/icons'
import type { CommunityFormState } from '../controllers/useCommunityController'
import { formatDayMonth } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { RelatoComunidade, TipoRelato } from '../models/community'
import type { RegionStatus } from '../models/region'
import type { BlockStatus } from '../models/screenStatus'
import type { Ponto } from '../models/talhao'
import type {
  CellMarker,
  EventDraft,
  NearbySummary,
  PlantingDraft,
  PlantingSummary,
  RainDraft,
  RegionSummary,
} from '../services/communityService'
import { EventFields, PlantingFields, PrivacyNotice, RainFields, ReportBadges, SendResult } from './CommunityForms'
import styles from './CommunityView.module.css'
import { FlowLoading } from './FlowStates'
import layout from './layout.module.css'

export type CommunityViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  center: Ponto
  radiusKm: number
  /** Relatos: "not-connected" sem banco no servidor (os blocos não aparecem). */
  status: BlockStatus
  onRetry: () => void
  summary: NearbySummary | null
  markers: CellMarker[]
  /** Só conta quem marcou a própria lavoura (não a fazenda de exemplo). */
  canTell: boolean
  markTo: string
  years: number[]
  form: CommunityFormState
  onOpenForm: (kind: TipoRelato | null) => void
  onPlanting: (change: Partial<PlantingDraft>) => void
  onRain: (change: Partial<RainDraft>) => void
  onEvent: (change: Partial<EventDraft>) => void
  onSend: () => void
  onRemove: (id: string) => void
  removing: string | null
  /** P3: área de soja parada na região pelo satélite (escondida sem o arquivo da região). */
  region: RegionSummary | null
  regionStatus: RegionStatus
  onRegionRetry: () => void
  regionRadius: number | null
  regionDistance: number | null
  history: { idle: number; known: number; uncertain: number } | null
}

/**
 * Tela "Na sua região" (seção 7 da remodelagem): contar (plantio, chuva, evento) e ver a redondeza de
 * 30 km, com cada relato marcado como "relato de vizinho, não confirmado". Sem cadastro, sem texto
 * livre e sem dado pessoal. O que a API não manda não aparece (decisão D2).
 */
export function CommunityView(props: CommunityViewProps) {
  const { t, backTo, status, region, regionStatus, regionRadius, regionDistance } = props
  const c = t.community
  const subtitle =
    region && regionRadius
      ? regionDistance
        ? c.regionSubtitleAway(regionRadius, regionDistance)
        : c.regionSubtitle(regionRadius)
      : status !== 'not-connected'
        ? c.reportsSubtitle(props.radiusKm)
        : undefined
  return (
    <div className={layout.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <PageHeading title={c.title} subtitle={subtitle} />
      {regionStatus === 'ready' && region && <SatelliteRegion {...props} region={region} />}
      {regionStatus === 'error' && (
        <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={props.onRegionRetry} />
      )}
      {status !== 'not-connected' && <Tell {...props} />}
      {status === 'loading' && !props.summary && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={props.onRetry} />}
      {status !== 'not-connected' && props.summary && <Nearby {...props} summary={props.summary} />}
      {status !== 'not-connected' && props.summary && props.summary.mine.length > 0 && (
        <Mine {...props} mine={props.summary.mine} />
      )}
      <p>
        <Link to="/guia">{t.guide.communityLink}</Link>
      </p>
    </div>
  )
}

function SatelliteRegion({ t, region, history }: CommunityViewProps & { region: RegionSummary }) {
  const c = t.community
  return (
    <>
      <div className={layout.pageGrid}>
        <div className={layout.stack}>
          <Card tone="orange">
            <p className={layout.bigStat}>{c.regionBig(region.last.ano, region.last.pct)}</p>
          </Card>
          <p>
            {history
              ? c.regionCompare(history.idle, history.known, history.uncertain, region.average)
              : c.regionAverage(region.average)}
          </p>
        </div>
        <Card>
          <RainBarChart
            label={c.regionChart}
            caption={c.regionChart}
            bars={region.bars.map((bar) => ({
              label: String(bar.ano).slice(2),
              value: bar.pct,
              tone: 'earth',
              display: c.regionPct(bar.pct),
            }))}
          />
        </Card>
      </div>
      <p className={layout.muted}>{c.regionNote(region.uncertain)}</p>
      <p className={layout.bridge}>{c.bridge}</p>
    </>
  )
}

/** "Conte o que aconteceu aí": três relatos, um aberto por vez. */
function Tell(props: CommunityViewProps) {
  const { t, canTell, markTo, form, years, onOpenForm, onPlanting, onRain, onEvent, onSend } = props
  const c = t.community
  return (
    <Card as="section" aria-label={c.tellTitle}>
      <h2 className={layout.cardTitle}>{c.tellTitle}</h2>
      {!canTell ? (
        <div className={layout.stack}>
          <p>{c.needPoint}</p>
          <div className={layout.cta}>
            <Button to={markTo} variant="outline">
              {c.markField}
            </Button>
          </div>
        </div>
      ) : (
        <div className={layout.stack}>
          <p className={layout.muted}>{c.tellHint}</p>
          <div className={styles.tellChoices}>
            <ChipGroup
              label={c.tellTitle}
              options={[
                { value: 'plantio', label: c.tellPlanting },
                { value: 'chuva', label: c.tellRain },
                { value: 'evento', label: c.tellEvent },
              ]}
              value={form.open}
              onChange={onOpenForm}
              allowDeselect
            />
          </div>
          {form.open && (
            <div className={styles.form}>
              {form.open === 'plantio' && <PlantingFields t={t} draft={form.planting} years={years} onChange={onPlanting} />}
              {form.open === 'chuva' && <RainFields t={t} draft={form.rain} bounds={form.bounds} onChange={onRain} />}
              {form.open === 'evento' && (
                <EventFields t={t} draft={form.event} bounds={form.bounds} fireCall={form.fireCall} onChange={onEvent} />
              )}
              {form.showNotice && <PrivacyNotice t={t} />}
              <div className={layout.cta}>
                <Button onClick={onSend} disabled={!form.ready || form.sending} icon={<SendIcon />}>
                  {form.sending ? c.sending : c.send}
                </Button>
              </div>
            </div>
          )}
          <SendResult t={t} result={form.result} />
        </div>
      )}
    </Card>
  )
}

function plantingList(t: Messages, crops: PlantingSummary['crops']) {
  const names = t.community.reportCropsInList as Record<string, string>
  return crops.map(({ crop, count }) => `${count} ${names[crop] ?? crop}`).join(', ')
}

/** "Perto de você": plantio da safra mais recente, chuva dos 7 dias, eventos dos 30 e o mapa. */
function Nearby({ t, lang, summary, markers, center, radiusKm }: CommunityViewProps & { summary: NearbySummary }) {
  const c = t.community
  const events = c.events as Record<string, string>
  const cells: ReportCell[] = markers.map((marker) => ({
    id: marker.celula,
    lat: marker.lat,
    lon: marker.lon,
    items: [
      ...(marker.plantio > 0
        ? [{ kind: 'plantio' as const, count: marker.plantio, text: c.mapPlanting(marker.plantio) }]
        : []),
      ...(marker.chuva > 0 ? [{ kind: 'chuva' as const, count: marker.chuva, text: c.mapRain(marker.chuva) }] : []),
      ...(marker.evento > 0 ? [{ kind: 'evento' as const, count: marker.evento, text: c.mapEvent(marker.evento) }] : []),
    ],
  }))
  return (
    <Card as="section" aria-label={c.nearbyTitle}>
      <h2 className={layout.cardTitle}>{c.nearbyTitle}</h2>
      {summary.empty ? (
        <p>{c.empty}</p>
      ) : (
        <div className={layout.stack}>
          {summary.planting && (
            <div className={styles.line}>
              <p>
                {c.plantingLine(summary.planting.total, summary.planting.year, plantingList(t, summary.planting.crops))}{' '}
                {c.wentWell(summary.planting.wentWell, summary.planting.total)}
              </p>
              <ReportBadges t={t} example={summary.planting.example} />
            </div>
          )}
          {summary.rain && (
            <div className={styles.line}>
              <p>{c.rainLine(summary.rain.averageMm, summary.rain.count)}</p>
              <ReportBadges t={t} example={summary.rain.example} />
            </div>
          )}
          {summary.events.length > 0 && (
            <section className={styles.events}>
              <h3 className={styles.subTitle}>{c.eventsTitle}</h3>
              <ul aria-label={c.eventsTitle} className={styles.list}>
                {summary.events.map((event) => (
                  <li key={event.id} className={styles.line}>
                    <span>{c.eventLine(events[event.event] ?? event.event, formatDayMonth(lang, event.date))}</span>
                    <ReportBadges t={t} example={event.example} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {cells.length > 0 && (
            <ReportsMap
              label={c.reportsMapLabel(radiusKm)}
              center={center}
              radiusKm={radiusKm}
              circleLabel={c.circleLabel(radiusKm)}
              cells={cells}
              note={c.mapNote}
              legend={{ label: c.mapLegend, plantio: c.mapLegendPlanting, chuva: c.mapLegendRain, evento: c.mapLegendEvent }}
            />
          )}
        </div>
      )}
    </Card>
  )
}

function describeMine(t: Messages, lang: Lang, report: RelatoComunidade): string {
  const c = t.community
  if (report.tipo === 'plantio') {
    const crops = c.reportCrops as Record<string, string>
    return c.myPlanting(crops[report.subtipo ?? ''] ?? String(report.subtipo), Number(report.valores.ano))
  }
  const date = report.data_fato ? formatDayMonth(lang, report.data_fato) : ''
  if (report.tipo === 'chuva') return c.myRain(Number(report.valores.mm), date)
  const events = c.events as Record<string, string>
  return c.eventLine(events[report.subtipo ?? ''] ?? String(report.subtipo), date)
}

/** "Seus relatos": só este aparelho pode apagar. */
function Mine({ t, lang, mine, onRemove, removing }: CommunityViewProps & { mine: RelatoComunidade[] }) {
  const c = t.community
  return (
    <Card as="section" aria-label={c.mineTitle}>
      <h2 className={layout.cardTitle}>{c.mineTitle}</h2>
      <p className={layout.muted}>{c.mineHint}</p>
      <ul className={styles.list}>
        {mine.map((report) => {
          const text = describeMine(t, lang, report)
          return (
            <li key={report.id} className={styles.mineItem}>
              <span>{text}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={c.removeLabel(text)}
                disabled={removing === report.id}
                onClick={() => onRemove(report.id)}
              >
                {c.remove}
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
