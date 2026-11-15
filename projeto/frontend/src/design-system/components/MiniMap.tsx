import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import styles from './MiniMap.module.css'

type MiniMapProps = { label: string; point: { lat: number; lon: number }; zoom?: number }

/**
 * Miniatura do mapa com o pin do ponto marcado (cabeçalho do raio-X, tela 4). Parada: sem arrastar,
 * sem zoom e sem teclado (o ponto se troca na tela "Onde fica a lavoura"). Mapa base: OpenStreetMap.
 */
export function MiniMap({ label, point, zoom = 11 }: MiniMapProps) {
  return (
    <div className={styles.wrapper} role="img" aria-label={label}>
      <MapContainer
        center={[point.lat, point.lon]}
        zoom={zoom}
        className={styles.map}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker center={[point.lat, point.lon]} radius={8} pathOptions={{ className: styles.pin, weight: 3, fillOpacity: 1 }} />
      </MapContainer>
    </div>
  )
}
