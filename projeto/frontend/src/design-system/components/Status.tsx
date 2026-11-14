import type { ReactNode } from 'react'
import { CheckIcon, MinusIcon, ShieldIcon } from '../icons'
import styles from './Status.module.css'

export type Rotulo = 'bom' | 'medio' | 'fraco'

/** Ícone de cada rótulo: o significado não depende só da cor. */
const PILL_ICON: Record<Rotulo, ReactNode> = {
  bom: <CheckIcon size={14} />,
  medio: <MinusIcon size={14} />,
  fraco: <ShieldIcon size={14} />,
}

export function StatusPill({ rotulo, children }: { rotulo: Rotulo; children: ReactNode }) {
  return (
    <span className={styles.pill} data-rotulo={rotulo}>
      {PILL_ICON[rotulo]}
      {children}
    </span>
  )
}

type MetricRowProps = {
  icon: ReactNode
  /** Azul para dado de satélite (chuva); verde para o resto. */
  iconTone?: 'green' | 'blue'
  label: string
  value: string
  pill?: ReactNode
  children?: ReactNode
}

export function MetricRow({ icon, iconTone = 'green', label, value, pill, children }: MetricRowProps) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricIcon} data-tone={iconTone}>
        {icon}
      </span>
      <div className={styles.metricText}>
        <span className={styles.metricLabel}>{label}</span>
        <span className={styles.metricValue}>{value}</span>
        {children}
      </div>
      {pill && <span className={styles.metricPill}>{pill}</span>}
    </div>
  )
}

export type CellState = 'good' | 'bad' | 'unknown'

type YearStripProps = {
  label: string
  cells: readonly CellState[]
  size?: 'sm' | 'lg'
  years?: readonly string[]
}

/** Um quadrinho por ano: cheio = deu certo / plantou; contorno laranja = faltou água / ficou parado. */
export function YearStrip({ label, cells, size = 'sm', years }: YearStripProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={styles.strip}
      data-size={size}
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((state, index) => (
        <span key={index} className={styles.cellWrap}>
          <span className={styles.cell} data-state={state} />
          {years && <span className={styles.year}>{years[index]}</span>}
        </span>
      ))}
    </div>
  )
}

/** Legenda dos quadrinhos (ex.: cheio = Plantou, contorno = Ficou parado). */
type StripLegendProps = {
  items: readonly { state: CellState; label: string }[]
  /** Nota no fim da legenda (ex.: o período "2006–2025"). */
  note?: string
}

export function StripLegend({ items, note }: StripLegendProps) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.state} className={styles.legendItem}>
          <span className={styles.legendCell} data-state={item.state} aria-hidden="true" />
          {item.label}
        </li>
      ))}
      {note && <li>{note}</li>}
    </ul>
  )
}
