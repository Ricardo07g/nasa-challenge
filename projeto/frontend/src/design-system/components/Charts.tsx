import styles from './Charts.module.css'

type Bar = {
  label: string
  value: number
  tone: 'strong' | 'soft' | 'earth'
  /** Valor escrito em cima da barra (ex.: "62%"). */
  display?: string
}

/** Barras de chuva por mês (tela 3). `value` é a altura em % da maior barra. */
export function RainBarChart({ label, caption, bars }: { label: string; caption: string; bars: readonly Bar[] }) {
  return (
    <figure className={styles.figure}>
      <div
        role="img"
        aria-label={label}
        className={styles.bars}
        style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
      >
        {bars.map((bar) => (
          <span key={bar.label} className={styles.barColumn}>
            <span className={styles.barTrack}>
              {bar.display && <span className={styles.barValue}>{bar.display}</span>}
              <span data-bar className={styles.bar} data-tone={bar.tone} style={{ height: `${bar.value}%` }} />
            </span>
            <span className={styles.barLabel}>{bar.label}</span>
          </span>
        ))}
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
