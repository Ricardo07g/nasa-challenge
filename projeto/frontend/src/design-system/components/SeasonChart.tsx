import { useId, type CSSProperties, type ReactNode } from 'react'
import { HistoryIcon } from '../icons'
import styles from './SeasonChart.module.css'

export type SeasonLevel = 0 | 1 | 2 | 3 | 4 | 5

export type SeasonChartRowProps = {
  key: string | number
  /** "2025/26" */
  season: string
  /** "jan–jul 2026": o que o satélite leu da safra. */
  period: string
  /** `confirmable` = uma das 3 safras que o produtor confirma (destaque leve); `current` = a safra atual. */
  tone: 'plain' | 'confirmable' | 'current'
  /** As leituras (nível do NDVI e o texto da dica); null = sem leitura (listrada, ou tracejada na safra atual). */
  cells: readonly { level: SeasonLevel; title: string }[] | null
  /** Coluna da direita: a resposta do produtor ou o que o satélite viu. */
  status: ReactNode
}

export type SeasonChartProps = {
  title: string
  seasonLabel: string
  afterLabel: string
  /** Quantas leituras por safra (colunas). */
  columns: number
  /** Faixas no topo, em colunas `[from, to)`: soja, colheita e depois da soja. */
  marks: readonly { key: 'soy' | 'harvest' | 'after'; label: string; from: number; to: number }[]
  months: readonly { label: string; from: number; span: number }[]
  rows: readonly SeasonChartRowProps[]
  legend: {
    title: string | null
    /** Os 5 níveis do NDVI, do mais claro ao mais escuro (vazio = sem NDVI no ponto). */
    levels: readonly string[]
    noReading: string | null
    current: string
    source: string | null
  }
}

/**
 * Gráfico "Suas últimas safras" (tela 4, pacote 2): uma linha por safra, com a safra à esquerda, as leituras do
 * NDVI de janeiro a julho no meio e, à direita, o que veio depois da soja. Dentro das barras não entra nenhum
 * texto (regra geral 5): só as cores do que o satélite leu. A safra atual fica tracejada (ainda sem leitura).
 */
export function SeasonChart({ title, seasonLabel, afterLabel, columns, marks, months, rows, legend }: SeasonChartProps) {
  const titleId = useId()
  const grid = { '--cols': columns } as CSSProperties
  return (
    <figure className={styles.chart} aria-labelledby={titleId}>
      <figcaption id={titleId} className={styles.title}>
        <HistoryIcon size={18} />
        <span>{title}</span>
      </figcaption>
      <div className={styles.line} data-chart-head="" aria-hidden="true">
        <span className={styles.headSeason}>{seasonLabel}</span>
        <div>
          <div className={styles.marks} style={grid}>
            {marks
              .filter((mark) => mark.to > mark.from)
              .map((mark) => (
                <span key={mark.key} className={styles.mark} data-mark={mark.key} style={{ gridColumn: `${mark.from + 1} / ${mark.to + 1}` }}>
                  {mark.label}
                </span>
              ))}
          </div>
          <div className={styles.months} style={grid}>
            {months.map((month) => (
              <span key={`${month.label}-${month.from}`} style={{ gridColumn: `${month.from + 1} / span ${month.span}` }}>
                {month.label}
              </span>
            ))}
          </div>
        </div>
        <span className={styles.headAfter}>{afterLabel}</span>
      </div>
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.key} className={styles.line} data-tone={row.tone}>
            <span className={styles.season}>
              {row.season}
              <small>{row.period}</small>
            </span>
            <span
              className={styles.track}
              style={grid}
              data-track=""
              data-empty={row.cells ? undefined : row.tone === 'current' ? 'current' : 'stripes'}
              aria-hidden="true"
            >
              {row.cells
                ? row.cells.map((cell, index) => <i key={index} data-level={cell.level} title={cell.title} />)
                : Array.from({ length: columns }, (_, index) => <i key={index} />)}
            </span>
            <span className={styles.status}>{row.status}</span>
          </li>
        ))}
      </ul>
      <ul className={styles.legend}>
        {legend.title && <li>{legend.title}</li>}
        {legend.levels.map((label, index) => (
          <li key={label}>
            <i data-level={index + 1} aria-hidden="true" />
            {label}
          </li>
        ))}
        {legend.noReading && (
          <li>
            <i data-empty="stripes" aria-hidden="true" />
            {legend.noReading}
          </li>
        )}
        <li>
          <i data-empty="current" aria-hidden="true" />
          {legend.current}
        </li>
        {legend.source && <li className={styles.source}>{legend.source}</li>}
      </ul>
    </figure>
  )
}
