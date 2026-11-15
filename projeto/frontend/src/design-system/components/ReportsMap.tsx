import 'leaflet/dist/leaflet.css'
import type { ReactNode } from 'react'
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { RainIcon, SproutIcon, WarningIcon } from '../icons'
import styles from './ReportsMap.module.css'

export type ReportKind = 'plantio' | 'chuva' | 'evento'

export type ReportCell = {
  id: string
  /** Centro da célula de 0,1° (nunca a posição de uma fazenda). */
  lat: number
  lon: number
  /** Por tipo de relato na célula: a contagem (na etiqueta do mapa, com o ícone) e o texto (ex.: "2 de chuva"). */
  items: { kind: ReportKind; count: number; text: string }[]
}

type ReportsMapProps = {
  label: string
  center: { lat: number; lon: number }
  radiusKm: number
  /** O círculo explicado em texto (ex.: "Círculo de 30 km em volta da sua lavoura"). */
  circleLabel: string
  cells: readonly ReportCell[]
  note: string
  /** O nome de cada tipo, ao lado do ícone, embaixo do mapa. */
  legend: { label: string } & Record<ReportKind, string>
}

const ICON: Record<ReportKind, ReactNode> = {
  plantio: <SproutIcon size={14} />,
  chuva: <RainIcon size={14} />,
  evento: <WarningIcon size={14} />,
}

const KINDS: ReportKind[] = ['plantio', 'chuva', 'evento']
const KM_PER_DEGREE = 111

/** O quadrado em volta do círculo: o mapa abre já enquadrando os 30 km. */
function circleBounds(center: { lat: number; lon: number }, radiusKm: number): [[number, number], [number, number]] {
  const dLat = radiusKm / KM_PER_DEGREE
  const dLon = radiusKm / (KM_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180))
  return [
    [center.lat - dLat, center.lon - dLon],
    [center.lat + dLat, center.lon + dLon],
  ]
}

/** Etiqueta do mapa: ícone e número de cada tipo, numa linha só (os nomes estão na legenda). */
function CellBadge({ items }: { items: ReportCell['items'] }) {
  return (
    <>
      {items.map((item) => (
        <span key={item.kind} className={styles.item} data-kind={item.kind}>
          {ICON[item.kind]}
          {item.count}
        </span>
      ))}
    </>
  )
}

/**
 * Mapa da redondeza (tela "Na sua região", tarefa 0047): o círculo em volta da lavoura e um marcador
 * por célula de 0,1° com relatos. Cada etiqueta mostra o ícone e o número de cada tipo, e a legenda
 * embaixo dá o nome de cada ícone (nada só por cor). A lista completa vai em texto para o leitor de
 * tela. Mapa base: OpenStreetMap.
 */
export function ReportsMap({ label, center, radiusKm, circleLabel, cells, note, legend }: ReportsMapProps) {
  return (
    <section aria-label={label} className={styles.wrapper}>
      <MapContainer bounds={circleBounds(center, radiusKm)} zoomSnap={0.25} className={styles.map} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={[center.lat, center.lon]}
          radius={radiusKm * 1000}
          pathOptions={{ className: styles.circle, weight: 2, fillOpacity: 0.06 }}
        />
        {cells.map((cell) => (
          <CircleMarker
            key={cell.id}
            center={[cell.lat, cell.lon]}
            radius={6}
            pathOptions={{ className: styles.marker, weight: 2, fillOpacity: 1 }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]} className={styles.tooltip}>
              <CellBadge items={cell.items} />
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <ul aria-label={label} className={styles.srOnly}>
        {cells.map((cell) => (
          <li key={cell.id}>{cell.items.map((item) => item.text).join(', ')}</li>
        ))}
      </ul>
      <div className={styles.caption}>
        <ul aria-label={legend.label} className={styles.legend}>
          {KINDS.map((kind) => (
            <li key={kind} className={styles.item} data-kind={kind}>
              {ICON[kind]}
              {legend[kind]}
            </li>
          ))}
        </ul>
        <p className={styles.circleLabel}>
          <span className={styles.circleSwatch} aria-hidden="true" />
          {circleLabel}
        </p>
        <p>{note}</p>
      </div>
    </section>
  )
}
