import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { PinIcon } from '../icons'
import styles from './MapPicker.module.css'

export type LatLon = { lat: number; lon: number }

type MapPickerProps = {
  label: string
  center: LatLon
  placeLabel?: string
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
 * Mapa para marcar a lavoura (tela 2): o alfinete fica fixo no centro e a pessoa arrasta o mapa
 * até ele ficar em cima da lavoura. Mapa base: OpenStreetMap.
 */
export function MapPicker({ label, center, placeLabel, onMove }: MapPickerProps) {
  return (
    <section aria-label={label} className={styles.wrapper}>
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={12}
        className={styles.map}
        scrollWheelZoom={false}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FollowCenter center={center} />
        <ReportMoves onMove={onMove} />
      </MapContainer>
      <span className={styles.pin} aria-hidden="true">
        <PinIcon size={44} />
      </span>
      {placeLabel && <span className={styles.place}>{placeLabel}</span>}
    </section>
  )
}
