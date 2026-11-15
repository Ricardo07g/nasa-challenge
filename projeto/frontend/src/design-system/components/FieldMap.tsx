import 'leaflet/dist/leaflet.css'
import { divIcon, type LeafletEvent, type Marker as LeafletMarker } from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AttributionControl,
  MapContainer,
  Marker,
  Rectangle,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { ExpandIcon, TapIcon } from '../icons'
import styles from './FieldMap.module.css'

export type LatLon = { lat: number; lon: number }

/** Retângulo em graus (ex.: a área do MVP). */
export type MapBounds = { south: number; west: number; north: number; east: number }

/**
 * O que o mapa enquadra: a área inteira ou o ponto (de perto). Cada pedido novo da tela troca o `seq`
 * (GPS, lavoura de demonstração, ponto colado, "Ver a área inteira"); tocar e arrastar não mexem no enquadre.
 */
export type FieldMapView = { target: 'area' | 'point'; seq: number }

export type FieldMapProps = {
  /** Nome do mapa para o leitor de tela ("Mapa. Toque para marcar a lavoura."). */
  label: string
  point: LatLon | null
  /** Nome do alfinete (focável pelo teclado). */
  pinLabel: string
  /** Área do MVP, tracejada em azul. Chega da API: sem ela, o mapa espera para enquadrar. */
  bounds?: MapBounds
  /** Dica escura no topo ("Toque no mapa…" / "Arraste o alfinete…"). */
  hint: string
  /** Legenda da linha tracejada, no canto de baixo, e o link que abre o modal da área. */
  legend: string
  legendAction: string
  onLegendAction: () => void
  /** "Ver a área inteira", no canto de cima (some no celular, onde fica só no modal da área). */
  fitLabel: string
  onFit: () => void
  zoomInLabel: string
  zoomOutLabel: string
  view: FieldMapView
  /** Tocar no mapa ou soltar o alfinete arrastado. */
  onPick: (point: LatLon) => void
}

/** Zoom de quando o mapa chega perto do ponto (GPS, lavoura de demonstração, ponto colado). */
const POINT_ZOOM = 14
const AREA_PADDING: [number, number] = [24, 24]
/** Antes de a área chegar da API: o Triângulo Mineiro, de longe (o ApplyView enquadra quando ela chega). */
const FALLBACK_CENTER: [number, number] = [-19.15, -48.25]
const FALLBACK_ZOOM = 8
/** Crédito do Leaflet sem a bandeira que vem por padrão (regra do NASA Space Apps: nada de bandeiras). */
const LEAFLET_PREFIX = '<a href="https://leafletjs.com">Leaflet</a>'
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** Alfinete verde com borda branca; a ponta (embaixo, no meio) marca o ponto. */
const pinIcon = divIcon({
  className: styles.pin,
  iconSize: [36, 46],
  iconAnchor: [18, 44],
  html: `<svg viewBox="0 0 36 46" width="36" height="46" aria-hidden="true"><path class="${styles.pinShape}" d="M18 1C8.6 1 1 8.4 1 17.6 1 30 18 45 18 45s17-15 17-27.4C35 8.4 27.4 1 18 1Z"/><circle class="${styles.pinDot}" cx="18" cy="17.5" r="6"/></svg>`,
})

/** Enquadra a área ou o ponto quando a tela pede (troca do `seq`) e quando a área chega da API. */
function ApplyView({ view, point, bounds }: { view: FieldMapView; point: LatLon | null; bounds?: MapBounds }) {
  const map = useMap()
  // O ponto mais recente, sem fazer o mapa voltar para ele a cada arrasto.
  const pointRef = useRef(point)
  const { south, west, north, east } = bounds ?? {}

  // Antes do efeito de baixo, no mesmo desenho: ele já vê o ponto novo quando o `seq` muda junto.
  useEffect(() => {
    pointRef.current = point
  })

  useEffect(() => {
    const target = pointRef.current
    if (view.target === 'point' && target) {
      map.setView([target.lat, target.lon], Math.max(map.getZoom(), POINT_ZOOM))
    } else if (view.target === 'area' && south !== undefined && west !== undefined) {
      map.fitBounds(
        [
          [south, west],
          [north ?? south, east ?? west],
        ],
        { padding: AREA_PADDING },
      )
    }
  }, [map, view.seq, view.target, south, west, north, east])
  return null
}

function PickOnTap({ onPick }: { onPick: (point: LatLon) => void }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lon: event.latlng.lng })
    },
  })
  return null
}

/**
 * Mapa da tela "Onde fica a lavoura" (tarefa 0053), Leaflet + OpenStreetMap: tocar põe o alfinete,
 * arrastar o alfinete ajusta. Mostra a área do MVP tracejada, a dica no topo, "Ver a área inteira" e a
 * legenda com "Saiba mais". O "© OpenStreetMap" fica sempre visível no canto.
 */
export function FieldMap(props: FieldMapProps) {
  const { label, point, pinLabel, bounds, hint, legend, legendAction, onLegendAction, fitLabel, onFit, view, onPick } =
    props
  // Só o primeiro desenho (o Leaflet não aceita mapa sem centro): depois, quem enquadra é o ApplyView.
  const [initial] = useState(() => ({
    center: (point ? [point.lat, point.lon] : FALLBACK_CENTER) as [number, number],
    zoom: point ? POINT_ZOOM : FALLBACK_ZOOM,
  }))
  const markerHandlers = useMemo(
    () => ({
      dragend(event: LeafletEvent) {
        const { lat, lng } = (event.target as LeafletMarker).getLatLng()
        onPick({ lat, lon: lng })
      },
    }),
    [onPick],
  )

  return (
    <section aria-label={label} className={styles.wrapper}>
      <MapContainer
        center={initial.center}
        zoom={initial.zoom}
        className={styles.map}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer attribution={OSM_ATTRIBUTION} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {/* Os nomes do zoom só valem na criação: a chave recria os botões quando o idioma muda. */}
        <ZoomControl
          key={`${props.zoomInLabel}|${props.zoomOutLabel}`}
          position="topleft"
          zoomInTitle={props.zoomInLabel}
          zoomOutTitle={props.zoomOutLabel}
        />
        <AttributionControl position="bottomright" prefix={LEAFLET_PREFIX} />
        {bounds && (
          <Rectangle
            bounds={[
              [bounds.south, bounds.west],
              [bounds.north, bounds.east],
            ]}
            pathOptions={{ className: styles.area, dashArray: '8 7', weight: 2.5, fillOpacity: 0.04, interactive: false }}
          />
        )}
        {point && (
          <Marker
            key={pinLabel}
            position={[point.lat, point.lon]}
            icon={pinIcon}
            draggable
            keyboard
            title={pinLabel}
            eventHandlers={markerHandlers}
          />
        )}
        <ApplyView view={view} point={point} bounds={bounds} />
        <PickOnTap onPick={onPick} />
      </MapContainer>
      <p className={styles.hint}>
        <TapIcon size={15} />
        <span>{hint}</span>
      </p>
      <button type="button" className={styles.fit} onClick={onFit}>
        <ExpandIcon size={14} />
        <span>{fitLabel}</span>
      </button>
      <p className={styles.legend}>
        <span className={styles.legendLine} aria-hidden="true" />
        <span>{legend}</span>
        <button type="button" className={styles.legendAction} aria-haspopup="dialog" onClick={onLegendAction}>
          {legendAction}
        </button>
      </p>
    </section>
  )
}
