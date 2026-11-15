import { Button } from '../design-system/components/Button'
import { AreaMap, type AreaPoint } from '../design-system/components/AreaMap'
import { Card, NotConnectedCard } from '../design-system/components/Card'
import { NeighborRow, RainBarChart, RainReadingRow } from '../design-system/components/Charts'
import { PageHeading } from '../design-system/components/Content'
import { ErrorState } from '../design-system/components/Feedback'
import { BackLink } from '../design-system/components/Navigation'
import { ToneBadge } from '../design-system/components/Status'
import { CommunityIcon, RainIcon, SatelliteIcon, UncertainIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import type { Community } from '../models/community'
import type { RegionStatus } from '../models/region'
import type { BlockStatus } from '../models/screenStatus'
import type { RegionSummary } from '../services/communityService'
import { FlowError, FlowLoading } from './FlowStates'
import layout from './layout.module.css'

export type CommunityViewProps = {
  t: Messages
  backTo: string
  /** Comunidade: "not-connected" com a API real (ainda não há endpoint). */
  status: BlockStatus
  onRetry: () => void
  community: Community | null
  center: { lat: number; lon: number }
  points: readonly AreaPoint[]
  demo: 'tell' | 'rain' | null
  onDemo: (kind: 'tell' | 'rain') => void
  /** P3: área de soja parada na região pelo satélite (null sem o dado na API). */
  region: RegionSummary | null
  /**
   * P3: "not-connected" sem /api/regiao no backend; "outside" se o satélite não mediu a região do
   * ponto. Fora das regiões medidas, o bloco não aparece: o produto resolve com as perguntas.
   */
  regionStatus: RegionStatus
  onRegionRetry: () => void
  regionRadius: number | null
  /** P3: distância da lavoura ao centro do círculo medido; null quando o círculo é em volta dela. */
  regionDistance: number | null
  /** Histórico da própria lavoura, para comparar com a região (só os anos certos; os sem certeza à parte). */
  history: { idle: number; known: number; uncertain: number } | null
}

/**
 * Tela 8 "Na sua região": em cima, a área parada na região pelo satélite (P3); embaixo, o que os
 * vizinhos contam: vizinhos, mapa da região e "Choveu aqui" (ilustrativos, só com os dados de exemplo).
 * O que a API ainda não manda aparece como "Ainda não conectado", sem sumir.
 */
export function CommunityView(props: CommunityViewProps) {
  const { t, backTo, status, onRetry, community, region, regionStatus, regionRadius, regionDistance } = props
  const c = t.community
  const subtitle =
    region && regionRadius
      ? regionDistance
        ? c.regionSubtitleAway(regionRadius, regionDistance)
        : c.regionSubtitle(regionRadius)
      : undefined
  return (
    <div className={layout.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <PageHeading title={c.title} subtitle={subtitle} />
      {regionStatus === 'ready' && region && <SatelliteRegion {...props} region={region} />}
      {regionStatus === 'not-connected' && (
        <NotConnectedCard icon={<SatelliteIcon />} iconTone="soil" title={c.regionTitle} label={t.common.notConnected} />
      )}
      {regionStatus === 'error' && (
        <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={props.onRegionRetry} />
      )}
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'not-connected' && <CommunityNotConnected t={t} />}
      {status === 'ready' && community && <Region {...props} community={community} />}
    </div>
  )
}

/** Comunidade sem endpoint na API: os blocos ficam, com "Ainda não conectado" (sem vizinho simulado). */
function CommunityNotConnected({ t }: { t: Messages }) {
  const c = t.community
  return (
    <section aria-label={c.communityTitle} className={layout.stack}>
      <h2 className={layout.sectionTitle}>{c.communityTitle}</h2>
      <div className={layout.pageGrid}>
        <NotConnectedCard icon={<CommunityIcon />} title={c.neighborsTitleGeneric} label={t.common.notConnected} level={3} />
        <NotConnectedCard
          icon={<RainIcon />}
          iconTone="blue"
          title={c.rainTitle}
          label={t.common.notConnected}
          level={3}
        />
      </div>
    </section>
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
              display: `${bar.pct}%`,
            }))}
          />
        </Card>
      </div>
      <p className={layout.muted}>{c.regionNote(region.uncertain)}</p>
      <p className={layout.bridge}>{c.bridge}</p>
    </>
  )
}

function Region({ t, community, center, points, demo, onDemo }: CommunityViewProps & { community: Community }) {
  const c = t.community
  const notice = <p role="status" className={layout.notice}>{c.demoOnly}</p>
  return (
    <section aria-label={c.communityTitle} className={layout.stack}>
      <div className={layout.sectionHead}>
        <h2 className={layout.sectionTitle}>{c.communityTitle}</h2>
        <ToneBadge tone="orange" icon={<UncertainIcon size={18} />}>
          {c.illustrative}
        </ToneBadge>
      </div>
      <p className={layout.muted}>{c.subtitle(community.raio_km, community.lugar, community.participantes)}</p>
      <div className={layout.pageGrid}>
        <Card as="section" aria-label={c.neighborsTitle(community.ano)}>
          <h2 className={layout.cardTitle}>{c.neighborsTitle(community.ano)}</h2>
          <div>
            {community.vizinhos.map((neighbor) => (
              <NeighborRow
                key={neighbor.opcao}
                name={neighbor.opcao}
                liked={neighbor.gostaram}
                total={neighbor.total}
                dotsLabel={c.dotsLabel(neighbor.gostaram, neighbor.total)}
                likedText={c.liked(neighbor.gostaram, neighbor.total)}
              />
            ))}
          </div>
          <p className={layout.muted}>{c.dotsCaption}</p>
          <Button variant="outline" onClick={() => onDemo('tell')}>
            {c.tellMine}
          </Button>
          {demo === 'tell' && notice}
        </Card>
        <div className={layout.stack}>
          <AreaMap
            label={c.mapLabel}
            center={center}
            points={points}
            legend={{ gauge: c.legendGauge, planted: c.legendPlanted, idle: c.legendIdle }}
          />
          <Card tone="blue" as="section" aria-label={c.rainTitle}>
            <h2 className={layout.iconTitle} data-tone="blue">
              <RainIcon />
              {c.rainTitle}
            </h2>
            <p className={layout.muted}>{c.yesterday}</p>
            <div>
              {community.leituras.map((reading) => (
                <RainReadingRow
                  key={reading.lugar}
                  place={reading.lugar}
                  reading={c.reading(reading.pluviometro_mm, reading.satelite_mm)}
                />
              ))}
            </div>
            <p className={layout.muted}>{c.rainNote}</p>
            <Button variant="outline-blue" onClick={() => onDemo('rain')}>
              {c.registerRain}
            </Button>
            {demo === 'rain' && notice}
          </Card>
        </div>
      </div>
      <p className={layout.muted}>{c.privacy}</p>
    </section>
  )
}
