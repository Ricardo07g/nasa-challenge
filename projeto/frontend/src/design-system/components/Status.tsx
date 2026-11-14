import type { ReactNode } from 'react'
import styles from './Status.module.css'

export type Rotulo = 'bom' | 'medio' | 'fraco'

export function StatusPill({ rotulo, children }: { rotulo: Rotulo; children: ReactNode }) {
  return (
    <span className={styles.pill} data-rotulo={rotulo}>
      {children}
    </span>
  )
}

type MetricRowProps = {
  icon: ReactNode
  label: string
  value: string
  pill?: ReactNode
  children?: ReactNode
}

export function MetricRow({ icon, label, value, pill, children }: MetricRowProps) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricHead}>
        <span className={styles.metricIcon}>{icon}</span>
        <div className={styles.metricText}>
          <span className={styles.metricLabel}>{label}</span>
          <span className={styles.metricValue}>{value}</span>
        </div>
        {pill}
      </div>
      {children}
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
