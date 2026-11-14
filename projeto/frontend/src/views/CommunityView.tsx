import { Button } from '../design-system/components/Button'
import { AreaMap, type AreaPoint } from '../design-system/components/AreaMap'
import { Card } from '../design-system/components/Card'
import { NeighborRow, RainReadingRow } from '../design-system/components/Charts'
import { PageHeading } from '../design-system/components/Content'
import { BackLink } from '../design-system/components/Navigation'
import { RainIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import type { Community } from '../models/community'
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
}

/** Tela 8 "Perto de você" (simulada): vizinhos à esquerda; mapa da região e "Choveu aqui" à direita. */
export function CommunityView(props: CommunityViewProps) {
  const { t, backTo, status, onRetry, community } = props
  const c = t.community
  return (
    <div className={layout.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <PageHeading
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={community ? c.subtitle(community.raio_km, community.lugar, community.participantes) : undefined}
      />
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'ready' && community && <Region {...props} community={community} />}
    </div>
  )
}

function Region({ t, community, center, points, demo, onDemo }: CommunityViewProps & { community: Community }) {
  const c = t.community
  const notice = <p role="status" className={layout.notice}>{c.demoOnly}</p>
  return (
    <>
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
    </>
  )
}
