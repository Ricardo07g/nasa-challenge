import styles from './SuggestionCharts.module.css'

export type YearBarItem = {
  year: number
  /** Altura da barra, de 0 a 100 (% da água que a planta precisa na fase crítica). */
  pct: number
  state: 'good' | 'bad'
  /** Marca de texto em cima da barra (ex.: "N" para El Niño, "L" para La Niña). */
  mark: string | null
  /** O que o leitor de tela e o "Ouvir" falam do ano (ano, número, resultado e El Niño / La Niña). */
  label: string
}

type YearBarsChartProps = {
  label: string
  bars: readonly YearBarItem[]
  /** Linha de corte do motor (%), com o texto escrito ao lado. */
  cutPct: number
  cutLabel: string
  selectedYear: number | null
  /** O ano tocado; tocar de novo no ano escolhido manda null (fecha o detalhe). */
  onSelect: (year: number | null) => void
}

const MAX_PCT = 100

/**
 * Explorador ano a ano (aba Sugestão, tarefa 0044): uma barra-botão por ano, com a água na fase crítica em
 * % do que a planta precisa. O ano bom é cheio; o ano com aperto é listrado com contorno (não depende só da
 * cor). A linha tracejada é o limite do motor, com o texto escrito. O ano aparece de 5 em 5 e no escolhido.
 */
export function YearBarsChart({ label, bars, cutPct, cutLabel, selectedYear, onSelect }: YearBarsChartProps) {
  const first = bars[0]?.year ?? 0
  return (
    <div className={styles.explorer}>
      <div className={styles.plot}>
        {/* A área das barras fica entre a marca de cima (14 px) e o ano embaixo (16 px). */}
        <span
          className={styles.cut}
          style={{ bottom: `calc(16px + (100% - 30px) * ${Math.min(MAX_PCT, cutPct) / MAX_PCT})` }}
          aria-hidden="true"
        >
          <span className={styles.cutLabel}>{cutLabel}</span>
        </span>
        <div role="group" aria-label={label} className={styles.bars} style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
          {bars.map((bar) => {
            const selected = bar.year === selectedYear
            return (
              <button
                key={bar.year}
                type="button"
                className={styles.yearButton}
                aria-pressed={selected}
                aria-label={bar.label}
                onClick={() => onSelect(selected ? null : bar.year)}
              >
                <span className={styles.mark} aria-hidden="true">
                  {bar.mark ?? ''}
                </span>
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.bar} data-state={bar.state} style={{ height: `${Math.max(2, Math.min(MAX_PCT, bar.pct))}%` }} />
                </span>
                <span className={styles.tick} aria-hidden="true">
                  {selected || (bar.year - first) % 5 === 0 ? String(bar.year).slice(2) : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Uma linha da barra da água: o texto escrito e o tamanho em mm. */
export type WaterRow = { key: 'need' | 'rain' | 'short'; text: string; mm: number }

/**
 * Linha "Água" (tarefa 0044): precisa, costuma chover e falta, na mesma escala (a maior é 100%). O número
 * está escrito em cada linha; a barra só ilustra. A falta é listrada (não depende só da cor).
 */
export function WaterBar({ rows }: { rows: readonly WaterRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.mm))
  return (
    <ul className={styles.water}>
      {rows.map((row) => (
        <li key={row.key} className={styles.waterRow}>
          <span className={styles.waterText}>{row.text}</span>
          <span className={styles.waterTrack} aria-hidden="true">
            <span
              data-water-bar
              data-kind={row.key}
              className={styles.waterBar}
              style={{ width: `${Number(((row.mm / max) * MAX_PCT).toFixed(1))}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}
