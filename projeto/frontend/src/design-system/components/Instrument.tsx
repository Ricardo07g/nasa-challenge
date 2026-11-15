import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import styles from './Instrument.module.css'

/**
 * Painel de instrumento do raio-X (tela 4, tarefa 0043): o único elemento escuro da tela, com uma
 * grade de blocos. Os blocos entram em sequência (CSS); com "reduzir movimento" tudo aparece parado.
 */
export function InstrumentPanel({
  title,
  header,
  children,
  footer,
}: {
  title: string
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const titleId = useId()
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.panelTitle}>
        {title}
      </h2>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.grid}>{children}</div>
      {footer && <p className={styles.footer}>{footer}</p>}
    </section>
  )
}

type InstrumentBlockProps = {
  /** Posição na grade: atrasa a entrada do bloco (sequência). */
  index: number
  label: string
  value?: ReactNode
  unit?: string
  sentence?: ReactNode
  badge: string
  /** Desenho do dado (barra, medidor), entre o número e a frase. */
  children?: ReactNode
  /** Links e botões do bloco ("Não é? Trocar", "Saiba mais"), depois da frase. */
  actions?: ReactNode
}

/** Um bloco: rótulo, número grande (fonte tabular), unidade, frase curta e o selo da fonte. */
export function InstrumentBlock({ index, label, value, unit, sentence, badge, children, actions }: InstrumentBlockProps) {
  return (
    <article className={styles.block} style={{ '--i': index } as CSSProperties}>
      <h3 className={styles.blockLabel}>{label}</h3>
      {value !== undefined && (
        <p className={styles.reading}>
          <span className={styles.value}>{value}</span>
          {unit && <span className={styles.unit}>{unit}</span>}
        </p>
      )}
      {children}
      {sentence && <p className={styles.sentence}>{sentence}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
      <SourceBadge>{badge}</SourceBadge>
    </article>
  )
}

/** Selo pequeno com a fonte e a resolução do dado (ex.: "SMAP · NASA · 9 km"). */
export function SourceBadge({ children }: { children: ReactNode }) {
  return <span className={styles.badge}>{children}</span>
}

export type SplitPart = { key: 'clay' | 'silt' | 'sand'; label: string; pct: number }

/** Barra dividida (solo): cada parte com a % escrita embaixo, nada só por cor. */
export function SplitBar({ label, parts }: { label: string; parts: readonly SplitPart[] }) {
  return (
    <div className={styles.split}>
      <div className={styles.splitBar} role="img" aria-label={label}>
        {parts.map((part) => (
          <span key={part.key} className={styles.splitPart} data-part={part.key} style={{ flexGrow: part.pct }} />
        ))}
      </div>
      <ul className={styles.splitLegend}>
        {parts.map((part) => (
          <li key={part.key}>
            <span className={styles.splitDot} data-part={part.key} aria-hidden="true" />
            {`${part.label} ${part.pct}%`}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Medidor de 0 a 100 (percentil), com a marca do valor e os extremos escritos. */
export function Meter({ label, value, lowLabel, highLabel }: { label: string; value: number; lowLabel: string; highLabel: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={styles.meter}>
      <div
        className={styles.meterTrack}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        <span className={styles.meterFill} style={{ width: `${clamped}%` }} />
        <span className={styles.meterMark} style={{ left: `${clamped}%` }} />
      </div>
      <p className={styles.meterEnds}>
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </p>
    </div>
  )
}

const COUNT_MS = 700
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Número que conta de 0 até o valor na chegada. O texto renderizado é sempre o valor final (leitor de
 * tela, "Ouvir" e testes); a contagem só troca o texto na tela, e não acontece com "reduzir movimento".
 */
export function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const formatRef = useRef(format)
  // O formato mais recente, sem reiniciar a contagem a cada desenho (a função muda a cada render).
  useLayoutEffect(() => {
    formatRef.current = format
  })

  useEffect(() => {
    const node = ref.current
    if (!node || typeof window.matchMedia !== 'function' || window.matchMedia(REDUCED_MOTION).matches) return
    let frame = 0
    let start: number | null = null
    const step = (now: number) => {
      start ??= now
      const progress = Math.min(1, (now - start) / COUNT_MS)
      node.textContent = formatRef.current(value * (1 - (1 - progress) ** 3))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      node.textContent = formatRef.current(value)
    }
  }, [value])

  return <span ref={ref}>{format(value)}</span>
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4 | 5

type NdviHeatmapProps = {
  /** Resumo para o leitor de tela (a figura é uma imagem). */
  label: string
  months: readonly { label: string; from: number; span: number }[]
  /** Faixas marcadas no topo ("soja", "colheita", "entressafra"), em colunas `[from, to)`. */
  marks: readonly { label: string; from: number; to: number }[]
  rows: readonly { year: number; tag: string; cells: readonly { level: HeatLevel; title: string }[] }[]
  legend: readonly { level: HeatLevel; label: string }[]
  noDataLabel: string
}

/**
 * Faixa de calor: um ano por linha, uma leitura por coluna, a cor é o nível do NDVI. O que aconteceu
 * em cada ano vem escrito no fim da linha, e a legenda dá os números de cada cor.
 */
export function NdviHeatmap({ label, months, marks, rows, legend, noDataLabel }: NdviHeatmapProps) {
  const columns = rows[0]?.cells.length ?? 0
  const grid = { '--cols': columns } as CSSProperties
  return (
    <div className={styles.heat}>
      <figure className={styles.heatFigure} role="img" aria-label={label}>
        <div className={styles.heatGrid} style={grid}>
          <span className={styles.heatCorner} />
          {marks.map((mark) => (
            <span
              key={mark.label}
              className={styles.heatMark}
              data-mark={mark.label}
              style={{ gridColumn: `${mark.from + 2} / ${mark.to + 2}`, gridRow: 1 }}
            >
              {mark.label}
            </span>
          ))}
          {months.map((month) => (
            <span
              key={`${month.label}-${month.from}`}
              className={styles.heatMonth}
              style={{ gridColumn: `${month.from + 2} / span ${month.span}`, gridRow: 2 }}
            >
              {month.label}
            </span>
          ))}
          {rows.map((row, rowIndex) => (
            <div key={row.year} className={styles.heatRow} style={{ gridRow: rowIndex + 3 }}>
              <span className={styles.heatYear}>{row.year}</span>
              {row.cells.map((cell, index) => (
                <span key={index} className={styles.heatCell} data-level={cell.level} title={cell.title} />
              ))}
              <span className={styles.heatTag}>{row.tag}</span>
            </div>
          ))}
        </div>
      </figure>
      <ul className={styles.heatLegend}>
        {legend.map((item) => (
          <li key={item.level}>
            <span className={styles.heatSwatch} data-level={item.level} aria-hidden="true" />
            {item.label}
          </li>
        ))}
        <li>
          <span className={styles.heatSwatch} data-level={0} aria-hidden="true" />
          {noDataLabel}
        </li>
      </ul>
    </div>
  )
}
