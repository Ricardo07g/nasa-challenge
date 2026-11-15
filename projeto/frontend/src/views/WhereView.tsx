import { Button } from '../design-system/components/Button'
import { Card, IconBubble } from '../design-system/components/Card'
import { PageHeading } from '../design-system/components/Content'
import { MapPicker } from '../design-system/components/MapPicker'
import { BackLink, QuestionStepper } from '../design-system/components/Navigation'
import { PlaceSearch, type PlaceSearchOption } from '../design-system/components/PlaceSearch'
import { CrosshairIcon, PinIcon } from '../design-system/icons'
import { formatCoordinates } from '../i18n/format'
import type { Messages } from '../i18n/messages.pt'
import type { PilotArea } from '../models/area'
import type { LocationNotice, LocationOption } from '../models/place'
import type { Ponto } from '../models/talhao'
import layout from './layout.module.css'
import styles from './WhereView.module.css'

/** Página de direitos do OpenStreetMap (dados da busca de endereço do Photon). */
const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright'

export type WhereViewProps = {
  t: Messages
  center: Ponto
  place: string
  area: PilotArea | null
  outside: boolean
  canConfirm: boolean
  locating: boolean
  locationError: boolean
  query: string
  options: LocationOption[]
  searchStatus: 'idle' | 'loading' | 'ready' | 'error'
  notice: LocationNotice | null
  onMove: (point: Ponto) => void
  onUseLocation: () => void
  onConfirm: () => void
  onQueryChange: (text: string) => void
  onSelectOption: (option: LocationOption) => void
}

function optionView(w: Messages['where'], option: LocationOption): PlaceSearchOption {
  if (option.kind === 'place') return { id: option.id, label: option.label, detail: option.detail }
  const label = option.source === 'link' ? w.goToLink : w.goToCoordinates
  return { id: option.id, label, detail: formatCoordinates(option.point) }
}

function statusText(w: Messages['where'], status: WhereViewProps['searchStatus'], found: number): string | null {
  if (status === 'loading') return w.searching
  if (status === 'error') return w.searchError
  if (status === 'ready') return found === 0 ? w.searchEmpty : w.searchFound(found)
  return null
}

const NOTICE_TEXT = {
  'short-link': 'shortLink',
  'link-without-point': 'linkWithoutPoint',
  'invalid-coordinates': 'invalidCoordinates',
} as const satisfies Record<LocationNotice, keyof Messages['where']>

/**
 * Tela "Onde fica a lavoura?" (pergunta 1 de 2): busca de endereço (ou coordenadas e link colados),
 * mapa grande com o limite da área piloto e o endereço perto do alfinete, e o painel do ponto ao lado.
 */
export function WhereView({
  t,
  center,
  place,
  area,
  outside,
  canConfirm,
  locating,
  locationError,
  query,
  options,
  searchStatus,
  notice,
  onMove,
  onUseLocation,
  onConfirm,
  onQueryChange,
  onSelectOption,
}: WhereViewProps) {
  const w = t.where
  const bounds = area ? { south: area.min_lat, west: area.min_lon, north: area.max_lat, east: area.max_lon } : undefined
  return (
    <div className={layout.page}>
      <div className={layout.topLine}>
        <BackLink to="/">{t.nav.back}</BackLink>
        <QuestionStepper current={1} total={2} label={t.stepper.label(1, 2)} />
      </div>
      <PageHeading title={w.title} />
      <div className={styles.search}>
        <PlaceSearch
          label={w.searchLabel}
          hint={w.searchHint}
          listLabel={w.searchList}
          value={query}
          onChange={onQueryChange}
          options={options.map((option) => optionView(w, option))}
          onSelect={(id) => {
            const option = options.find((item) => item.id === id)
            if (option) onSelectOption(option)
          }}
          status={statusText(w, searchStatus, options.length)}
          notice={notice ? w[NOTICE_TEXT[notice]] : null}
          attribution={{ text: w.attribution, href: OSM_COPYRIGHT }}
        />
      </div>
      <div className={layout.mapGrid}>
        <MapPicker
          label={w.mapLabel}
          center={center}
          placeLabel={w.near(place)}
          bounds={bounds}
          boundsLabel={w.areaLegend}
          boundsAction={w.showArea}
          onMove={onMove}
        />
        <div className={layout.stack}>
          <Card>
            <IconBubble tone="blue">
              <PinIcon />
            </IconBubble>
            <h2 className={layout.cardTitle} aria-live="polite">
              {w.near(place)}
            </h2>
            <p className={layout.muted}>{w.selected(formatCoordinates(center))}</p>
            <Button variant="outline-blue" icon={<CrosshairIcon />} onClick={onUseLocation} disabled={locating}>
              {locating ? w.locating : w.useLocation}
            </Button>
            <p className={layout.muted}>{w.help}</p>
            {locationError && (
              <p role="alert" className={layout.notice}>
                {w.locationError}
              </p>
            )}
          </Card>
          {outside && (
            <Card tone="orange" as="section" aria-label={w.outsideTitle}>
              <h2 className={layout.cardTitle}>{w.outsideTitle}</h2>
              <p>{w.outsideNotice}</p>
              <Button to="/exemplo" variant="outline">
                {w.seeExample}
              </Button>
            </Card>
          )}
          <Button onClick={onConfirm} disabled={!canConfirm} icon={<PinIcon size={20} />}>
            {w.confirm}
          </Button>
        </div>
      </div>
    </div>
  )
}
