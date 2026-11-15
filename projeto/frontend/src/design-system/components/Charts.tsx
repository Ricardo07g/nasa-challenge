import styles from './Charts.module.css'

type Bar = {
  label: string
  value: number
  tone: 'strong' | 'soft' | 'earth'
  /** Valor escrito em cima da barra (ex.: "62%"). */
  display?: string
}

/**
 * Barras de chuva por mês (tela 3). `value` é a altura em % da maior barra. O `display` fica preso em
 * cima da própria barra (sem ocupar altura), para a barra de 100% não encolher.
 */
export function RainBarChart({ label, caption, bars }: { label: string; caption: string; bars: readonly Bar[] }) {
  const withValues = bars.some((bar) => bar.display)
  return (
    <figure className={styles.figure}>
      <div
        role="img"
        aria-label={label}
        className={styles.bars}
        data-values={withValues || undefined}
        style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
      >
        {bars.map((bar) => (
          <span key={bar.label} className={styles.barColumn}>
            <span className={styles.barTrack}>
              <span data-bar className={styles.bar} data-tone={bar.tone} style={{ height: `${bar.value}%` }}>
                {bar.display && <span className={styles.barValue}>{bar.display}</span>}
              </span>
            </span>
            <span className={styles.barLabel}>{bar.label}</span>
          </span>
        ))}
      </div>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  )
}

type RainLeftChartProps = {
  /** Descrição acessível (o gráfico inteiro é uma imagem com a frase que ele mostra). */
  label: string
  caption: string
  /** Um ponto por dia de colheita, em ordem: a chuva que sobra na mediana e num ano seco (mm). */
  points: readonly { median: number; dry: number }[]
  /** Maior valor do eixo (mm); `topLabel` é o texto dessa linha (ex.: "620 mm"). */
  max: number
  topLabel?: string
  /** O dia escolhido (índice em `points`): linha vertical e um ponto em cada curva. */
  selectedIndex: number
  /** Rótulos do eixo dos dias (índice em `points`). */
  ticks: readonly { index: number; label: string }[]
  legend: { median: string; dry: string }
}

const LEFT_W = 320
const LEFT_H = 170
const LEFT_PAD = { left: 6, right: 6, top: 18, bottom: 24 }

/**
 * Chuva que sobra depois da colheita (tela 3): quanto mais tarde a colheita, menos chuva sobra. A
 * mediana é a linha cheia e o ano seco a tracejada (não depende só da cor); a legenda escreve as duas.
 */
export function RainLeftChart({ label, caption, points, max, topLabel, selectedIndex, ticks, legend }: RainLeftChartProps) {
  const plotW = LEFT_W - LEFT_PAD.left - LEFT_PAD.right
  const plotH = LEFT_H - LEFT_PAD.top - LEFT_PAD.bottom
  const x = (index: number) => LEFT_PAD.left + (points.length > 1 ? (index / (points.length - 1)) * plotW : plotW / 2)
  const y = (value: number) => LEFT_PAD.top + (max > 0 ? (1 - value / max) * plotH : plotH)
  const line = (pick: (point: { median: number; dry: number }) => number) =>
    points.map((point, index) => `${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`).join(' ')
  const selected = points[selectedIndex]
  const anchor = (index: number) => (index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle')
  return (
    <figure className={styles.figure}>
      <svg role="img" aria-label={label} viewBox={`0 0 ${LEFT_W} ${LEFT_H}`} className={styles.leftSvg}>
        <line x1={LEFT_PAD.left} x2={LEFT_W - LEFT_PAD.right} y1={y(max)} y2={y(max)} className={styles.gridLine} />
        <line x1={LEFT_PAD.left} x2={LEFT_W - LEFT_PAD.right} y1={y(0)} y2={y(0)} className={styles.axisLine} />
        {topLabel && (
          <text x={LEFT_PAD.left} y={y(max) - 5} className={styles.svgText}>
            {topLabel}
          </text>
        )}
        <polyline data-line="median" points={line((point) => point.median)} className={styles.lineMedian} />
        <polyline data-line="dry" points={line((point) => point.dry)} className={styles.lineDry} strokeDasharray="7 5" />
        {selected && (
          <g data-marker>
            <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={LEFT_PAD.top} y2={y(0)} className={styles.markerLine} />
            <circle cx={x(selectedIndex)} cy={y(selected.median)} r={5} className={styles.dotMedian} />
            <circle cx={x(selectedIndex)} cy={y(selected.dry)} r={5} className={styles.dotDry} />
          </g>
        )}
        {ticks.map((tick) => (
          <text key={tick.index} x={x(tick.index)} y={LEFT_H - 6} textAnchor={anchor(tick.index)} className={styles.svgText}>
            {tick.label}
          </text>
        ))}
      </svg>
      <div className={styles.lineLegend}>
        <span className={styles.legendItem}>
          <svg viewBox="0 0 28 8" className={styles.legendSwatch} aria-hidden="true">
            <line x1="0" x2="28" y1="4" y2="4" className={styles.lineMedian} />
          </svg>
          {legend.median}
        </span>
        <span className={styles.legendItem}>
          <svg viewBox="0 0 28 8" className={styles.legendSwatch} aria-hidden="true">
            <line x1="0" x2="28" y1="4" y2="4" className={styles.lineDry} strokeDasharray="7 5" />
          </svg>
          {legend.dry}
        </span>
      </div>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  )
}

type RainEtoBar = {
  label: string
  /** Alturas em % da maior barra do gráfico (chuva ou gasto). */
  rainPct: number
  etoPct: number
  rainDisplay: string
  etoDisplay: string
  /** Texto do mês em destaque (ex.: "chove menos"): o destaque é escrito, não só cor. */
  tag?: string
}

/**
 * Chuva e o que a lavoura gasta (ETo), mês a mês (tela 3). A chuva é a barra cheia e o gasto a
 * listrada; o mês em que a chuva fica menor que o gasto ganha contorno e o texto `tag`.
 */
export function RainEtoChart({
  label,
  caption,
  bars,
  legend,
}: {
  label: string
  caption: string
  bars: readonly RainEtoBar[]
  legend: { rain: string; eto: string }
}) {
  return (
    <figure className={styles.figure}>
      <div
        role="img"
        aria-label={label}
        className={styles.etoBars}
        style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
      >
        {bars.map((bar) => (
          <span key={bar.label} className={styles.etoColumn} data-highlight={bar.tag ? 'true' : undefined}>
            <span className={styles.etoPair}>
              <span className={styles.etoTrack}>
                <span data-bar="rain" className={styles.etoRain} style={{ height: `${bar.rainPct}%` }}>
                  <span className={styles.barValue}>{bar.rainDisplay}</span>
                </span>
              </span>
              <span className={styles.etoTrack}>
                <span data-bar="eto" className={styles.etoUse} style={{ height: `${bar.etoPct}%` }}>
                  <span className={styles.barValue}>{bar.etoDisplay}</span>
                </span>
              </span>
            </span>
            {/* Pé de altura igual em todos os meses: o texto do destaque não encurta as barras. */}
            <span className={styles.etoFoot}>
              <span className={styles.barLabel}>{bar.label}</span>
              {bar.tag && <span className={styles.etoTag}>{bar.tag}</span>}
            </span>
          </span>
        ))}
      </div>
      <div className={styles.lineLegend}>
        <span className={styles.legendItem}>
          <span className={styles.swatchRain} aria-hidden="true" />
          {legend.rain}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatchEto} aria-hidden="true" />
          {legend.eto}
        </span>
      </div>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  )
}

export function NeighborDots({ liked, total, label }: { liked: number; total: number; label: string }) {
  return (
    <span role="img" aria-label={label} className={styles.dots}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={styles.dot} data-liked={index < liked} />
      ))}
    </span>
  )
}

type NeighborRowProps = { name: string; liked: number; total: number; dotsLabel: string; likedText: string }

/** Uma opção que os vizinhos plantaram: uma bolinha por vizinho (cheia = gostou) e quantos gostaram. */
export function NeighborRow({ name, liked, total, dotsLabel, likedText }: NeighborRowProps) {
  return (
    <div className={styles.neighbor}>
      <strong className={styles.neighborName}>{name}</strong>
      <span className={styles.neighborDots}>
        <NeighborDots liked={liked} total={total} label={dotsLabel} />
        <span className={styles.neighborLiked}>{likedText}</span>
      </span>
    </div>
  )
}

export function RainReadingRow({ place, reading }: { place: string; reading: string }) {
  return (
    <div className={styles.reading}>
      <span className={styles.readingPlace}>{place}</span>
      <span className={styles.readingValue}>{reading}</span>
    </div>
  )
}

type RegionMapProps = {
  label: string
  legend: { gauge: string; planted: string; idle: string }
}

/** Mapa ilustrativo da região (tela 8): mostra a região, nunca a posição exata das fazendas (RNF-10). */
export function RegionMap({ label, legend }: RegionMapProps) {
  return (
    <div className={styles.region}>
      <svg role="img" aria-label={label} viewBox="0 0 346 190" className={styles.regionSvg}>
        <rect width="346" height="190" fill="var(--color-map-bg)" />
        <path d="M0 60h346M0 120h346M90 0v190M190 0v190M280 0v190" stroke="var(--color-map-grid)" strokeWidth="1" />
        <path d="M0 150 Q 120 110 346 140" fill="none" stroke="var(--color-map-river)" strokeWidth="5" />
        <path d="M40 0 L 120 190" fill="none" stroke="var(--color-map-road)" strokeWidth="6" />
        <circle cx="173" cy="95" r="7" fill="var(--color-text)" stroke="var(--color-surface)" strokeWidth="3" />
        <circle cx="140" cy="45" r="7" fill="var(--color-secondary)" />
        <circle cx="250" cy="80" r="7" fill="var(--color-secondary)" />
        <circle cx="200" cy="150" r="7" fill="var(--color-secondary)" />
        <rect x="95" y="80" width="14" height="14" rx="3" fill="var(--color-primary)" />
        <rect x="230" y="40" width="14" height="14" rx="3" fill="var(--color-primary)" />
        <rect x="260" y="130" width="14" height="14" rx="3" fill="var(--color-primary)" />
        <rect x="60" y="130" width="14" height="14" rx="3" fill="var(--color-risk-soft)" stroke="var(--color-risk)" strokeWidth="2" />
      </svg>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendGauge} aria-hidden="true" />
          {legend.gauge}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendPlanted} aria-hidden="true" />
          {legend.planted}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendIdle} aria-hidden="true" />
          {legend.idle}
        </span>
      </div>
    </div>
  )
}
