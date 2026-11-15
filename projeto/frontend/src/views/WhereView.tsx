import { useId, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import type { AreaInfoState, OtherWaysState } from '../controllers/useWhereController'
import { FieldMap, type FieldMapView, type LatLon } from '../design-system/components/FieldMap'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { Modal } from '../design-system/components/Modal'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  CrosshairIcon,
  HouseIcon,
  PinIcon,
} from '../design-system/icons'
import { formatCoordinates } from '../i18n/format'
import type { Messages } from '../i18n/messages.pt'
import type { PilotArea } from '../models/area'
import type { Ponto } from '../models/talhao'
import type { WhereStatus } from '../services/locationService'
import styles from './WhereView.module.css'

export type WhereViewProps = {
  t: Messages
  point: Ponto | null
  /** O ponto é a lavoura de demonstração (o título é o nome dela, não o endereço). */
  demo: boolean
  /** Endereço aproximado do ponto (Photon) ou a cidade de referência. */
  place: string
  area: PilotArea | null
  status: WhereStatus
  canConfirm: boolean
  gps: 'idle' | 'locating' | 'error'
  view: FieldMapView
  listen: ListenSummaryState
  other: OtherWaysState
  areaInfo: AreaInfoState
  onPick: (point: LatLon) => void
  onUseDemo: () => void
  onUseLocation: () => void
  onShowArea: () => void
  onConfirm: () => void
}

/**
 * Tela "Onde fica a lavoura?" (tarefa 0053). Computador: mapa à esquerda e painel de 380 px à direita
 * (cartão do local, atalhos e "Confirmar local"). Celular: atalhos, mapa e cartão, com o Confirmar numa
 * barra fixa no fim da tela. Coordenadas e link do Google Maps ficam no modal "Outras formas de marcar".
 */
export function WhereView(props: WhereViewProps) {
  const { t, point, demo, place, area, status, canConfirm, gps, view, listen, other, areaInfo } = props
  const w = t.where
  const ids = useId()
  const labelId = `${ids}-rotulo`
  const fieldId = `${ids}-campo`
  const exampleId = `${ids}-exemplo`
  const errorId = `${ids}-erro`

  const title = demo ? w.demoName : w.near(place)
  const cardLabel = status === 'outside' ? w.outsideLabel : status === 'marked' ? w.chosenLabel : w.emptyLabel
  const reason = status === 'empty' ? w.needPoint : status === 'outside' ? w.needInside : ''
  const barText = status === 'empty' ? w.needPoint : status === 'outside' ? w.outsideShort : title
  const bounds = area ? { south: area.min_lat, west: area.min_lon, north: area.max_lat, east: area.max_lon } : undefined

  function submitOther(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    other.onSubmit()
  }

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        <ArrowLeftIcon size={18} />
        {t.nav.back}
      </Link>
      <h1 className={styles.title}>{w.title}</h1>
      <div className={styles.sub}>
        <p>{w.lead}</p>
        <ListenSummary
          supported={listen.supported}
          speaking={listen.speaking}
          onToggle={listen.toggle}
          label={w.listenSummary}
          stopLabel={w.stopListening}
        />
      </div>

      <div className={styles.grid}>
        <div className={styles.mapBlock}>
          <FieldMap
            label={w.mapLabel}
            point={point}
            pinLabel={w.pinLabel}
            bounds={bounds}
            hint={point ? w.hintMarked : w.hintEmpty}
            legend={w.areaLegend}
            legendAction={w.learnMore}
            onLegendAction={areaInfo.onOpen}
            fitLabel={w.showArea}
            onFit={props.onShowArea}
            zoomInLabel={w.zoomIn}
            zoomOutLabel={w.zoomOut}
            view={view}
            onPick={props.onPick}
          />
        </div>

        <section className={styles.card} data-status={status} aria-labelledby={labelId} aria-live="polite">
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>
              <PinIcon size={20} />
            </span>
            <span id={labelId} className={styles.cardLabel}>
              {cardLabel}
            </span>
          </div>
          {point ? (
            <>
              <h2 className={styles.cardTitle}>{title}</h2>
              <p className={styles.coordinates}>{formatCoordinates(point)}</p>
            </>
          ) : (
            <>
              <h2 className={styles.cardTitle}>{w.emptyTitle}</h2>
              <p className={styles.cardText}>{w.emptyText}</p>
            </>
          )}
          {status === 'outside' && (
            <div className={styles.outside}>
              <b>{w.outsideTitle}</b>
              <span>{w.outsideNotice}</span>
            </div>
          )}
          {gps === 'error' && <p className={styles.gpsError}>{w.gpsError}</p>}
        </section>

        <div className={styles.shortcuts}>
          <button
            type="button"
            className={styles.gps}
            aria-busy={gps === 'locating'}
            onClick={props.onUseLocation}
          >
            <CrosshairIcon size={19} />
            <span>{gps === 'locating' ? w.locating : w.useLocation}</span>
          </button>
          <button type="button" className={styles.demo} onClick={props.onUseDemo}>
            <span className={styles.demoIcon}>
              <HouseIcon size={20} />
            </span>
            <span className={styles.demoText}>
              <span className={styles.demoName}>{w.useDemo}</span>{' '}
              <span className={styles.demoNear}>{w.demoNear}</span>
            </span>
            <span className={styles.demoArrow}>
              <ChevronRightIcon size={16} />
            </span>
          </button>
          <button type="button" className={styles.otherWays} aria-haspopup="dialog" onClick={other.onOpen}>
            {w.otherWays}
          </button>
        </div>

        <div className={styles.confirmBlock}>
          <p className={styles.barLine} data-bar-line data-status={status} aria-hidden="true">
            <PinIcon size={16} />
            <span>{barText}</span>
          </p>
          <button type="button" className={styles.confirm} disabled={!canConfirm} onClick={props.onConfirm}>
            <span>{w.confirm}</span>
            <ArrowRightIcon size={18} />
          </button>
          <p className={styles.reason}>{reason}</p>
        </div>
      </div>

      <Modal open={other.open} onClose={other.onClose} title={w.other.title} subtitle={w.other.subtitle} closeLabel={w.close}>
        <form className={styles.form} noValidate onSubmit={submitOther}>
          <label htmlFor={fieldId} className={styles.fieldLabel}>
            {w.other.field}
          </label>
          <input
            id={fieldId}
            className={styles.field}
            value={other.text}
            onChange={(event) => other.onChange(event.target.value)}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="-18.9543, -48.1993"
            aria-invalid={other.error}
            aria-describedby={other.error ? `${exampleId} ${errorId}` : exampleId}
          />
          <p id={exampleId} className={styles.example}>
            {w.other.example}
          </p>
          {other.error && (
            <p id={errorId} className={styles.error} role="alert">
              {w.other.error}
            </p>
          )}
          <button type="submit" className={styles.submit}>
            {w.other.submit}
          </button>
        </form>
      </Modal>

      <Modal open={areaInfo.open} onClose={areaInfo.onClose} title={w.area.title} closeLabel={w.close}>
        <p className={styles.areaText}>{w.area.text}</p>
        <p className={styles.areaLine}>
          <span className={styles.areaDash} aria-hidden="true" />
          <span>{w.area.line}</span>
        </p>
        <button type="button" className={styles.showArea} onClick={areaInfo.onShowArea}>
          {w.showArea}
        </button>
      </Modal>
    </div>
  )
}
