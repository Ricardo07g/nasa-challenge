import 'leaflet/dist/leaflet.css'
import { latLngBounds, point, type Map as LeafletMap } from 'leaflet'
import { useEffect, useState } from 'react'
import { MapContainer, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { PinIcon } from '../icons'
import styles from './MapPicker.module.css'

export type LatLon = { lat: number; lon: number }

/** Retângulo em graus (ex.: a área com dados). */
export type MapBounds = { south: number; west: number; north: number; east: number }

type MapPickerProps = {
  label: string
  center: LatLon
  /** Endereço aproximado, mostrado logo abaixo do alfinete. */
  placeLabel?: string
  /** Limite desenhado com linha tracejada (ex.: a área piloto). */
  bounds?: MapBounds
  /** Legenda em texto do limite (a linha nunca fala só pela cor). */
  boundsLabel?: string
  /** Texto do botão que afasta o mapa até o limite aparecer inteiro, sem tirar o alfinete do ponto. */
  boundsAction?: string
  onMove: (point: LatLon) => void
}

/** Segue o centro vindo de fora (ex.: GPS) sem brigar com o arrasto do usuário. */
function FollowCenter({ center }: { center: LatLon }) {
  const map = useMap()
  useEffect(() => {
    const current = map.getCenter()
    if (Math.abs(current.lat - center.lat) > 1e-6 || Math.abs(current.lng - center.lon) > 1e-6) {
      map.setView([center.lat, center.lon], map.getZoom())
    }
  }, [map, center.lat, center.lon])
  return null
}

function ReportMoves({ onMove }: { onMove: (point: LatLon) => void }) {
  useMapEvents({
    moveend(event) {
      const { lat, lng } = event.target.getCenter()
      onMove({ lat, lon: lng })
    },
  })
  return null
}

/**
 * Afasta o mapa até o limite caber inteiro, sem mudar o centro (o alfinete fica no mesmo ponto):
 * o limite é espelhado em volta do centro e o zoom só diminui.
 */
function zoomOutToShow(map: LeafletMap, bounds: MapBounds) {
  const center = map.getCenter()
  const view = latLngBounds([bounds.south, bounds.west], [bounds.north, bounds.east])
    .extend([2 * center.lat - bounds.south, 2 * center.lng - bounds.west])
    .extend([2 * center.lat - bounds.north, 2 * center.lng - bounds.east])
  // Folga total em px (metade de cada lado): em cima e embaixo, a legenda e o crédito do mapa.
  const zoom = map.getBoundsZoom(view, false, point(48, 180))
  if (Number.isFinite(zoom) && zoom < map.getZoom()) map.setZoom(zoom)
}

/**
 * Mapa para marcar a lavoura (tela "Onde fica a lavoura"): o alfinete fica fixo no centro e a pessoa
 * arrasta o mapa até ele ficar em cima da lavoura. O endereço aproximado aparece logo abaixo do
 * alfinete e o limite da área com dados, tracejado, com legenda. Mapa base: OpenStreetMap.
 */
export function MapPicker({ label, center, placeLabel, bounds, boundsLabel, boundsAction, onMove }: MapPickerProps) {
  const [map, setMap] = useState<LeafletMap | null>(null)
  return (
    <section aria-label={label} className={styles.wrapper}>
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={12}
        className={styles.map}
        scrollWheelZoom={false}
        attributionControl
        ref={setMap}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bounds && (
          <Rectangle
            bounds={[
              [bounds.south, bounds.west],
              [bounds.north, bounds.east],
            ]}
            pathOptions={{ className: styles.area, dashArray: '10 8', weight: 3, fill: false, interactive: false }}
          />
        )}
        <FollowCenter center={center} />
        <ReportMoves onMove={onMove} />
      </MapContainer>
      <span className={styles.pin} aria-hidden="true" />
      {placeLabel && (
        <span className={styles.place}>
          <PinIcon size={16} />
          {placeLabel}
        </span>
      )}
      {bounds && boundsLabel && (
        <span className={styles.legend}>
          <span className={styles.legendLine} aria-hidden="true" />
          {boundsLabel}
          {boundsAction && (
            <button type="button" className={styles.legendAction} onClick={() => map && zoomOutToShow(map, bounds)}>
              {boundsAction}
            </button>
          )}
        </span>
      )}
    </section>
  )
}
