import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import styles from './AreaMap.module.css'

export type AreaPoint = { lat: number; lon: number; kind: 'gauge' | 'planted' | 'idle' }

type AreaMapProps = {
  label: string
  center: { lat: number; lon: number }
  points: readonly AreaPoint[]
  legend: { gauge: string; planted: string; idle: string }
  zoom?: number
}

/**
 * Mapa da região (tela 8): pluviômetros e vizinhos em pontos aproximados, nunca a posição exata das
 * fazendas (RNF-10). Mapa base: OpenStreetMap.
 */
export function AreaMap({ label, center, points, legend, zoom = 10 }: AreaMapProps) {
  return (
    <section aria-label={label} className={styles.wrapper}>
      <MapContainer center={[center.lat, center.lon]} zoom={zoom} className={styles.map} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((point, index) => (
          <CircleMarker
            key={index}
            center={[point.lat, point.lon]}
            radius={point.kind === 'gauge' ? 8 : 7}
            pathOptions={{ className: styles[point.kind], weight: 3, fillOpacity: 1 }}
          />
        ))}
      </MapContainer>
      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <span className={styles.legendDot} data-kind="gauge" aria-hidden="true" />
          {legend.gauge}
        </li>
        <li className={styles.legendItem}>
          <span className={styles.legendDot} data-kind="planted" aria-hidden="true" />
          {legend.planted}
        </li>
        <li className={styles.legendItem}>
          <span className={styles.legendDot} data-kind="idle" aria-hidden="true" />
          {legend.idle}
        </li>
      </ul>
    </section>
  )
}
