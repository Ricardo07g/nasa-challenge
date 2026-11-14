import { Button } from '../design-system/components/Button'
import { AreaMap, type AreaPoint } from '../design-system/components/AreaMap'
import { Card } from '../design-system/components/Card'
import { NeighborRow, RainBarChart, RainReadingRow } from '../design-system/components/Charts'
import { PageHeading } from '../design-system/components/Content'
import { BackLink } from '../design-system/components/Navigation'
import { ToneBadge } from '../design-system/components/Status'
import { RainIcon, UncertainIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import type { Community } from '../models/community'
import type { RegionSummary } from '../services/communityService'
import { FlowError, FlowLoading } from './FlowStates'
import layout from './layout.module.css'

export type CommunityViewProps = {
  t: Messages
  backTo: string
  status: 'loading' | 'ready' | 'error'
  onRetry: () => void
  community: Community | null
  center: { lat: number; lon: number }
  points: readonly AreaPoint[]
  demo: 'tell' | 'rain' | null
  onDemo: (kind: 'tell' | 'rain') => void
  /** P3: área parada na região pelo satélite (null sem o dado na API). */
  region: RegionSummary | null
  regionRadius: number | null
  /** Histórico da própria lavoura, para comparar com a região (só os anos certos; os sem certeza à parte). */
  history: { idle: number; known: number; uncertain: number } | null
}

/**
 * Tela 8 "Na sua região": em cima, a área parada na região pelo satélite (P3); embaixo, o que os
 * vizinhos contam (comunidade ilustrativa): vizinhos, mapa da região e "Choveu aqui".
 */
export function CommunityView(props: CommunityViewProps) {
  const { t, backTo, status, onRetry, community, region, regionRadius } = props
  const c = t.community
  return (
    <div className={layout.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <PageHeading title={c.title} subtitle={region && regionRadius ? c.regionSubtitle(regionRadius) : undefined} />
      {region && <SatelliteRegion {...props} region={region} />}
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'ready' && community && <Region {...props} community={community} />}
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
