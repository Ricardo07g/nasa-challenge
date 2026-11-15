import styles from './Charts.module.css'
import { useElementWidth } from './useElementWidth'

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
  /** Fonte e período embaixo do gráfico; sem ele, a tela escreve a fonte por fora. */
  caption?: string
  /** Um ponto por dia de colheita, em ordem: a chuva que sobra na mediana e num ano seco (mm). */
  points: readonly { median: number; dry: number }[]
  /** Maior valor das curvas (mm): o eixo vai um pouco além, com linhas de 200 em 200 (ou 100, 50). */
  max: number
  /** Unidade escrita em cima do eixo ("mm"). */
  unit: string
  /** O dia escolhido (índice em `points`): linha vertical e um ponto em cada curva; null = sem marca. */
  selectedIndex?: number | null
  /** Os números escritos ao lado da marca ("367 mm" e "276 mm"). */
  selectedLabels?: { median: string; dry: string }
  /** Rótulos do eixo dos dias (índice em `points`). */
  ticks: readonly { index: number; label: string }[]
  legend: { median: string; dry: string }
}

const LEFT_H = 230
const LEFT_PAD = { left: 42, right: 14, top: 22, bottom: 26 }
/** Largura de reserva enquanto o espaço não foi medido (e nos testes). */
const CHART_FALLBACK_W = 560
const CHART_MIN_W = 240

/** Passo das linhas do eixo: 200 mm nas curvas grandes, 100 ou 50 nas pequenas. */
function axisStep(top: number): number {
  return top > 500 ? 200 : top > 200 ? 100 : 50
}

/**
 * Chuva que sobra depois da colheita (tela 2): quanto mais tarde a colheita, menos chuva sobra. A mediana é a
 * linha cheia e o ano seco a tracejada (não depende só da cor); a legenda escreve as duas. Desenhado na
 * largura real do espaço (o texto não encolhe no celular), com os milímetros no eixo da esquerda.
 */
export function RainLeftChart(props: RainLeftChartProps) {
  const { label, caption, points, max, unit, selectedIndex = null, selectedLabels, ticks, legend } = props
  const [ref, measured] = useElementWidth<HTMLDivElement>(CHART_FALLBACK_W)
  const width = Math.max(measured, CHART_MIN_W)
  const top = max > 0 ? max * 1.04 : 1
  const step = axisStep(top)
  const yTicks = Array.from({ length: Math.floor(top / step) + 1 }, (_, index) => index * step)
  const plotW = width - LEFT_PAD.left - LEFT_PAD.right
  const plotH = LEFT_H - LEFT_PAD.top - LEFT_PAD.bottom
  const x = (index: number) => LEFT_PAD.left + (points.length > 1 ? (index / (points.length - 1)) * plotW : plotW / 2)
  const y = (value: number) => LEFT_PAD.top + (1 - value / top) * plotH
  const line = (pick: (point: { median: number; dry: number }) => number) =>
    points.map((point, index) => `${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`).join(' ')
  const selected = selectedIndex === null ? undefined : points[selectedIndex]
  const anchor = (index: number) => (index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle')
  // Os números da marca ficam à direita dela; perto da borda direita, passam para a esquerda.
  const markerX = selectedIndex === null ? 0 : x(selectedIndex)
  const flip = markerX > width - 72
  const labelX = flip ? markerX - 9 : markerX + 9
  return (
    <figure className={styles.figure}>
      <div ref={ref} className={styles.measure}>
        <svg
          role="img"
          aria-label={label}
          width={width}
          height={LEFT_H}
          viewBox={`0 0 ${width} ${LEFT_H}`}
          className={styles.leftSvg}
        >
          {yTicks.map((value) => (
            <g key={value}>
              <line x1={LEFT_PAD.left} x2={width - LEFT_PAD.right} y1={y(value)} y2={y(value)} className={value === 0 ? styles.axisLine : styles.gridLine} />
              <text data-y-tick x={LEFT_PAD.left - 8} y={y(value) + 4} textAnchor="end" className={styles.svgText}>
                {value}
              </text>
            </g>
          ))}
          <text data-unit x={LEFT_PAD.left - 8} y={LEFT_PAD.top - 8} textAnchor="end" className={styles.svgText}>
            {unit}
          </text>
          <polyline data-line="dry" points={line((point) => point.dry)} className={styles.lineDry} strokeDasharray="6 5" />
          <polyline data-line="median" points={line((point) => point.median)} className={styles.lineMedian} />
          {selected && (
            <g data-marker>
              <line x1={markerX} x2={markerX} y1={LEFT_PAD.top - 4} y2={y(0)} className={styles.markerLine} />
              <circle cx={markerX} cy={y(selected.median)} r={5.5} className={styles.dotMedian} />
              <circle cx={markerX} cy={y(selected.dry)} r={5.5} className={styles.dotDry} />
              {selectedLabels && (
                <>
                  <text x={labelX} y={y(selected.median) - 9} textAnchor={flip ? 'end' : 'start'} className={styles.markerMedian}>
                    {selectedLabels.median}
                  </text>
                  <text
                    x={labelX}
                    y={Math.min(y(selected.dry) + 18, y(0) - 4)}
                    textAnchor={flip ? 'end' : 'start'}
                    className={styles.markerDry}
                  >
                    {selectedLabels.dry}
                  </text>
                </>
              )}
            </g>
          )}
          {ticks.map((tick) => (
            <text key={tick.index} x={x(tick.index)} y={LEFT_H - 6} textAnchor={anchor(tick.index)} className={styles.tickText}>
              {tick.label}
            </text>
          ))}
        </svg>
      </div>
      <div className={styles.lineLegend}>
        <span className={styles.legendItem}>
          <svg viewBox="0 0 28 8" className={styles.legendSwatch} aria-hidden="true">
            <line x1="0" x2="28" y1="4" y2="4" className={styles.lineMedian} />
          </svg>
          {legend.median}
        </span>
        <span className={styles.legendItem}>
          <svg viewBox="0 0 28 8" className={styles.legendSwatch} aria-hidden="true">
            <line x1="0" x2="28" y1="4" y2="4" className={styles.lineDry} strokeDasharray="6 5" />
          </svg>
          {legend.dry}
        </span>
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  )
}

type RainEndPoint = {
  /** "MM-DD" (o ano não importa: cada ponto é de um ano diferente). */
  day: string
  label: string
  /** O ano em que acabou mais cedo, a metade dos anos e o ano em que acabou mais tarde. */
  tone: 'early' | 'median' | 'late'
}

type RainEndTimelineProps = {
  /** Descrição acessível com as três datas. */
  label: string
  /** Começo e fim da linha ("MM-DD"). */
  start: string
  end: string
  /** Marcas do eixo ("1 mar", "1 abr"…). */
  ticks: readonly { day: string; label: string }[]
  points: readonly RainEndPoint[]
}

const TIMELINE_H = 100
const TIMELINE_PAD = 16
const TIMELINE_AXIS_Y = 40
/** Largura aproximada de um caractere de 12 px, para o texto não sair do desenho. */
const CHAR_W = 6.6

const dayOfYear = (monthDay: string) => {
  const [month, day] = monthDay.split('-').map(Number)
  return Date.UTC(2023, month - 1, day) / 86_400_000
}

/**
 * Quando a chuva acaba (tela 2): uma linha de março a junho com o ano em que acabou mais cedo, a data de
 * metade dos anos (embaixo) e o ano em que acabou mais tarde, com a faixa entre os dois. Cada ponto tem o
 * texto escrito (não depende da cor). Desenhada na largura real do espaço.
 */
export function RainEndTimeline({ label, start, end, ticks, points }: RainEndTimelineProps) {
  const [ref, measured] = useElementWidth<HTMLDivElement>(CHART_FALLBACK_W)
  const width = Math.max(measured, CHART_MIN_W)
  const first = dayOfYear(start)
  const span = Math.max(dayOfYear(end) - first, 1)
  const x = (monthDay: string) =>
    TIMELINE_PAD + Math.min(Math.max((dayOfYear(monthDay) - first) / span, 0), 1) * (width - 2 * TIMELINE_PAD)
  const early = points.find((point) => point.tone === 'early')
  const late = points.find((point) => point.tone === 'late')
  // O texto começa no ponto (mais cedo), termina nele (mais tarde) ou fica no meio, sem sair do desenho.
  const textX = (point: RainEndPoint) => {
    const half = (point.label.length * CHAR_W) / 2
    const shift = point.tone === 'early' ? half - 8 : point.tone === 'late' ? 8 - half : 0
    return Math.min(Math.max(x(point.day) + shift, half), width - half)
  }
  return (
    <div ref={ref} className={styles.measure}>
      <svg
        role="img"
        aria-label={label}
        width={width}
        height={TIMELINE_H}
        viewBox={`0 0 ${width} ${TIMELINE_H}`}
        className={styles.leftSvg}
      >
        {early && late && (
          <rect
            x={x(early.day)}
            y={TIMELINE_AXIS_Y - 6}
            width={Math.max(x(late.day) - x(early.day), 0)}
            height={12}
            rx={6}
            className={styles.timelineBand}
          />
        )}
        <line x1={TIMELINE_PAD} x2={width - TIMELINE_PAD} y1={TIMELINE_AXIS_Y} y2={TIMELINE_AXIS_Y} className={styles.axisLine} />
        {ticks.map((tick, index) => (
          <g key={tick.day}>
            <line x1={x(tick.day)} x2={x(tick.day)} y1={84} y2={90} className={styles.timelineTick} />
            <text x={x(tick.day)} y={99} textAnchor={index === 0 ? 'start' : 'middle'} className={styles.svgText}>
              {tick.label}
            </text>
          </g>
        ))}
        {points.map((point) => (
          <g key={point.tone} data-point={point.tone} className={styles[`timeline_${point.tone}`]}>
            <circle cx={x(point.day)} cy={TIMELINE_AXIS_Y} r={7} className={styles.timelineDot} />
            <text x={textX(point)} y={point.tone === 'median' ? 68 : 22} textAnchor="middle" className={styles.timelineText}>
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
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
 * Chuva e o que a lavoura gasta (ETo), mês a mês (tela 2). A chuva é a barra cheia e o gasto a
 * listrada; o mês em que a chuva fica menor que o gasto ganha contorno e o texto `tag`.
 */
export function RainEtoChart({
  label,
  caption,
  bars,
  legend,
}: {
  label: string
  /** Fonte e período embaixo do gráfico; sem ele, a tela escreve a fonte por fora. */
  caption?: string
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
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
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
