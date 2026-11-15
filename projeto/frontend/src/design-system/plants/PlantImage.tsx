import type { ReactNode } from 'react'
import type { GuidePlant } from '../../models/guide'

/**
 * Ilustrações próprias e simples das culturas do Guia (SVG feito aqui: sem IA e sem imagem de fora).
 * As cores vêm só das variáveis do design system; o desenho não depende só de cor (cada planta tem uma forma).
 */
const LEAF = 'var(--color-primary)'
const STEM = 'var(--color-primary-strong)'
const SOIL = 'var(--color-soil)'
const SKY = 'var(--color-tint-blue)'
const EAR = 'var(--color-fair-bg)'
const EAR_LINE = 'var(--color-fair-text)'
const SEED = 'var(--color-risk)'

const ground = <rect x="0" y="100" width="120" height="20" fill={SOIL} />

/** Folha comprida saindo do caule em (x, y), para a esquerda (-1) ou a direita (1). */
function leaf(x: number, y: number, side: 1 | -1, length = 26) {
  return (
    <path
      key={`${x}-${y}-${side}`}
      d={`M${x} ${y} Q${x + side * length * 0.6} ${y - 16} ${x + side * length} ${y + 2} Q${x + side * length * 0.5} ${y - 6} ${x} ${y}Z`}
      fill={LEAF}
    />
  )
}

function grassTufts(xs: number[]) {
  return xs.map((x) => (
    <path key={x} d={`M${x} 100 L${x - 4} 84 M${x} 100 L${x} 80 M${x} 100 L${x + 4} 84`} stroke={LEAF} strokeWidth="2.5" fill="none" strokeLinecap="round" />
  ))
}

const stalk = (top: number) => <line x1="60" y1="100" x2="60" y2={top} stroke={STEM} strokeWidth="5" strokeLinecap="round" />

const cornEar = (
  <g>
    <ellipse cx="72" cy="58" rx="6" ry="14" fill={EAR} stroke={EAR_LINE} strokeWidth="2" />
    <path d="M66 56 H78 M66 62 H78" stroke={EAR_LINE} strokeWidth="1.5" />
  </g>
)

const drawings: Record<GuidePlant, ReactNode> = {
  milho_safrinha: (
    <>
      {stalk(22)}
      {[84, 70, 56, 42].map((y, i) => leaf(60, y, i % 2 ? 1 : -1, 30))}
      {cornEar}
      <path d="M60 22 L54 8 M60 22 L60 6 M60 22 L66 8" stroke={EAR_LINE} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  milho_braquiaria: (
    <>
      {stalk(22)}
      {[84, 70, 56, 42].map((y, i) => leaf(60, y, i % 2 ? 1 : -1, 30))}
      {cornEar}
      <path d="M60 22 L54 8 M60 22 L60 6 M60 22 L66 8" stroke={EAR_LINE} strokeWidth="2" strokeLinecap="round" />
      {grassTufts([14, 28, 92, 106, 40, 80])}
    </>
  ),
  sorgo: (
    <>
      {stalk(30)}
      {[84, 66, 48].map((y, i) => leaf(60, y, i % 2 ? 1 : -1, 28))}
      <ellipse cx="60" cy="22" rx="11" ry="17" fill={SEED} />
      <path d="M52 16 H68 M50 24 H70 M54 32 H66" stroke="var(--color-surface)" strokeWidth="1.5" />
    </>
  ),
  milheto: (
    <>
      {stalk(36)}
      {[86, 70, 54].map((y, i) => leaf(60, y, i % 2 ? 1 : -1, 26))}
      <rect x="54" y="6" width="12" height="42" rx="6" fill={EAR} stroke={EAR_LINE} strokeWidth="2" />
      <path d="M54 16 H66 M54 26 H66 M54 36 H66" stroke={EAR_LINE} strokeWidth="1.5" strokeDasharray="2 3" />
    </>
  ),
  crotalaria: (
    <>
      <path d="M60 100 L60 40 M60 80 L38 56 M60 70 L84 46 M60 56 L46 36 M60 50 L76 30" stroke={STEM} strokeWidth="4" fill="none" strokeLinecap="round" />
      {[[38, 56], [84, 46], [46, 36], [76, 30], [60, 40]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="9" fill={LEAF} />
          <circle cx={x} cy={y - 10} r="5" fill={EAR} stroke={EAR_LINE} strokeWidth="2" />
        </g>
      ))}
      <path d="M60 100 L40 92 M60 100 L82 94" stroke={LEAF} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  pousio: (
    <>
      <rect x="10" y="30" width="100" height="62" rx="8" fill="none" stroke="var(--color-border-strong)" strokeWidth="2.5" strokeDasharray="6 6" />
      <path d="M24 100 L22 90 M24 100 L28 92 M96 100 L94 92 M96 100 L100 90" stroke={LEAF} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="45" cy="106" r="2.5" fill="var(--color-surface)" />
      <circle cx="68" cy="110" r="2.5" fill="var(--color-surface)" />
    </>
  ),
}

export function PlantImage({ plant, label, size = 120 }: { plant: GuidePlant; label: string; size?: number }) {
  return (
    <svg role="img" aria-label={label} viewBox="0 0 120 120" width={size} height={size} style={{ maxWidth: '100%' }}>
      <rect width="120" height="120" rx="14" fill={SKY} />
      {ground}
      {drawings[plant]}
    </svg>
  )
}
