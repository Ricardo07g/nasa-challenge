import { useId, useState, type ReactNode } from 'react'
import { CheckIcon, CloseIcon, MinusIcon, ShieldIcon } from '../icons'
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
  /** Sem valor, fica só o eixo e o conteúdo (ex.: uma frase embaixo do eixo). */
  value?: string
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
        {value && <span className={styles.metricValue}>{value}</span>}
        {children}
      </div>
      {pill && <span className={styles.metricPill}>{pill}</span>}
    </div>
  )
}

/** `none`: ano que não conta (ex.: o satélite não viu soja no ponto naquele ano). */
export type CellState = 'good' | 'bad' | 'unknown' | 'none'

type YearStripProps = {
  label: string
  cells: readonly CellState[]
  size?: 'sm' | 'lg'
  years?: readonly string[]
}

/** O ano sem certeza leva um "?" e o ano que não conta, um traço: o significado não depende só da cor. */
const CELL_MARK: Partial<Record<CellState, string>> = { unknown: '?', none: '–' }

/**
 * Um quadrinho por ano: cheio = deu certo / plantou; contorno laranja = faltou água / ficou parado;
 * cinza com "?" = o satélite não teve certeza; pontilhado com "–" = não conta (sem soja).
 */
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
          <span className={styles.cell} data-state={state}>
            {CELL_MARK[state] ?? null}
          </span>
          {years && <span className={styles.year}>{years[index]}</span>}
        </span>
      ))}
    </div>
  )
}

/** Legenda dos quadrinhos (ex.: cheio = Plantou, contorno = Ficou parado). */
export type YearMarker = 'el_nino' | 'la_nina'

type StripLegendProps = {
  items: readonly { state: CellState; label: string }[]
  /** Pontos de El Niño / La Niña em cima dos quadrinhos. */
  markers?: readonly { kind: YearMarker; label: string }[]
  /** Nota no fim da legenda (ex.: o período "2006–2025"). */
  note?: string
}

export function StripLegend({ items, markers = [], note }: StripLegendProps) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.state} className={styles.legendItem}>
          <span className={styles.legendCell} data-state={item.state} aria-hidden="true">
            {CELL_MARK[item.state] ?? null}
          </span>
          {item.label}
        </li>
      ))}
      {markers.map((marker) => (
        <li key={marker.kind} className={styles.legendItem}>
          <span className={styles.marker} data-marker={marker.kind} aria-hidden="true" />
          {marker.label}
        </li>
      ))}
      {note && <li>{note}</li>}
    </ul>
  )
}

/** Selo com ícone e texto num tom (ex.: sinal do outono: seco laranja, normal verde, incerto azul). */
export function ToneBadge({ tone, icon, children }: { tone: 'green' | 'blue' | 'orange'; icon: ReactNode; children: ReactNode }) {
  return (
    <span className={styles.toneBadge} data-tone={tone}>
      {icon}
      <strong>{children}</strong>
    </span>
  )
}

export type TappableYear = { year: number; state: CellState; marker: YearMarker | null; text: string }

type TappableYearStripProps = {
  label: string
  years: readonly TappableYear[]
  openLabel: (year: number) => string
  stateLabel: (state: CellState) => string
  closeLabel: string
}

/**
 * Quadrinhos de anos que dá para tocar (P1): cada um abre o que aconteceu naquele ano, com o ponto de
 * El Niño / La Niña em cima. O ano aparece embaixo de 5 em 5.
 */
export function TappableYearStrip({ label, years, openLabel, stateLabel, closeLabel }: TappableYearStripProps) {
  const [open, setOpen] = useState<number | null>(null)
  const panelId = useId()
  const current = years.find((item) => item.year === open)
  const first = years[0]?.year ?? 0
  return (
    <div className={styles.tappable}>
      <div role="group" aria-label={label} className={styles.tappableStrip} style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}>
        {years.map((item) => (
          <span key={item.year} className={styles.tappableCell}>
            <button
              type="button"
              className={styles.yearButton}
              aria-expanded={open === item.year}
              aria-controls={panelId}
              aria-label={`${openLabel(item.year)}: ${stateLabel(item.state)}`}
              onClick={() => setOpen(open === item.year ? null : item.year)}
            >
              <span className={styles.marker} data-marker={item.marker ?? 'none'} aria-hidden="true" />
              <span className={styles.cell} data-state={item.state} aria-hidden="true" />
            </button>
            <span className={styles.yearTick} aria-hidden="true">
              {(item.year - first) % 5 === 0 ? item.year : ''}
            </span>
          </span>
        ))}
      </div>
      {current && (
        <div id={panelId} role="region" aria-label={String(current.year)} aria-live="polite" className={styles.yearPanel}>
          <div className={styles.yearPanelHead}>
            <strong className={styles.yearPanelTitle}>{current.year}</strong>
            <button type="button" className={styles.yearPanelClose} onClick={() => setOpen(null)}>
              <CloseIcon size={16} />
              {closeLabel}
            </button>
          </div>
          <p>{current.text}</p>
        </div>
      )}
    </div>
  )
}
