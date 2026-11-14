/**
 * Ícones da interface: lucide (traço 2, grade 24, pontas arredondadas), os mesmos da interface nova.
 * Sempre aria-hidden: o texto ao lado dá o significado. Cor via `currentColor`, para seguir o token
 * do componente. As telas importam daqui (nunca direto do lucide), para trocar o desenho num lugar só.
 */
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  CloudRain,
  CloudSun,
  Droplets,
  History,
  Layers,
  Leaf,
  LocateFixed,
  LockKeyhole,
  MapPin,
  Minus,
  Satellite,
  ShieldCheck,
  Sprout,
  Square,
  Star,
  Users,
  Volume2,
} from 'lucide-react'

type IconProps = { size?: number }

/** Props comuns: decorativo (o texto ao lado dá o significado). */
const decorative = { 'aria-hidden': true, focusable: false } as const

/** Símbolo do Raiz Orbital: a Terra (verde), a órbita do satélite (azul) e o broto. */
export function LogoMark({ size = 49 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" />
      <ellipse
        cx="32"
        cy="32"
        rx="31"
        ry="13"
        transform="rotate(-32 32 32)"
        fill="none"
        stroke="var(--color-secondary)"
        strokeWidth="1.8"
      />
      <path
        d="M32 47V31M32 36C20 37 18 29 19 24C27 24 31 27 32 36ZM32 32C32 22 39 18 45 20C45 28 40 33 32 32ZM31 28C25 23 26 17 30 13C35 18 36 22 31 28Z"
        fill="var(--color-primary)"
      />
    </svg>
  )
}

// Ações e navegação
export function SpeakerIcon({ size = 20 }: IconProps) {
  return <Volume2 size={size} {...decorative} />
}

export function StopIcon({ size = 20 }: IconProps) {
  return <Square size={size} {...decorative} />
}

export function ArrowRightIcon({ size = 20 }: IconProps) {
  return <ArrowRight size={size} {...decorative} />
}

export function ArrowLeftIcon({ size = 20 }: IconProps) {
  return <ArrowLeft size={size} {...decorative} />
}

export function ArrowUpRightIcon({ size = 14 }: IconProps) {
  return <ArrowUpRight size={size} {...decorative} />
}

export function ChevronDownIcon({ size = 18 }: IconProps) {
  return <ChevronDown size={size} {...decorative} />
}

export function CommunityIcon({ size = 18 }: IconProps) {
  return <Users size={size} {...decorative} />
}

export function CrosshairIcon({ size = 20 }: IconProps) {
  return <LocateFixed size={size} {...decorative} />
}

// Situação
export function CheckIcon({ size = 24 }: IconProps) {
  return <Check size={size} {...decorative} />
}

export function CheckCircleIcon({ size = 24 }: IconProps) {
  return <CircleCheck size={size} {...decorative} />
}

export function MinusIcon({ size = 24 }: IconProps) {
  return <Minus size={size} {...decorative} />
}

export function ShieldIcon({ size = 24 }: IconProps) {
  return <ShieldCheck size={size} {...decorative} />
}

// Dados e domínio
export function PinIcon({ size = 24 }: IconProps) {
  return <MapPin size={size} {...decorative} />
}

export function CalendarIcon({ size = 24 }: IconProps) {
  return <CalendarDays size={size} {...decorative} />
}

export function SatelliteIcon({ size = 24 }: IconProps) {
  return <Satellite size={size} {...decorative} />
}

export function DropIcon({ size = 24 }: IconProps) {
  return <Droplets size={size} {...decorative} />
}

export function RainIcon({ size = 24 }: IconProps) {
  return <CloudRain size={size} {...decorative} />
}

export function ClimateIcon({ size = 24 }: IconProps) {
  return <CloudSun size={size} {...decorative} />
}

export function HistoryIcon({ size = 24 }: IconProps) {
  return <History size={size} {...decorative} />
}

export function SoilIcon({ size = 24 }: IconProps) {
  return <Sprout size={size} {...decorative} />
}

export function SproutIcon({ size = 24 }: IconProps) {
  return <Sprout size={size} {...decorative} />
}

export function MoneyIcon({ size = 24 }: IconProps) {
  return <Banknote size={size} {...decorative} />
}

export function LeafIcon({ size = 24 }: IconProps) {
  return <Leaf size={size} {...decorative} />
}

// Missão (tela de cálculo)
export function LockIcon({ size = 21 }: IconProps) {
  return <LockKeyhole size={size} {...decorative} />
}

export function StarIcon({ size = 28 }: IconProps) {
  return <Star size={size} {...decorative} />
}

export function LayersIcon({ size = 24 }: IconProps) {
  return <Layers size={size} {...decorative} />
}
