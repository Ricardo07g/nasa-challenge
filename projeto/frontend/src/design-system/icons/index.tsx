/**
 * Ícones da interface: lucide (traço 2, grade 24, pontas arredondadas), os mesmos da interface nova.
 * Sempre aria-hidden: o texto ao lado dá o significado. Cor via `currentColor`, para seguir o token
 * do componente. As telas importam daqui (nunca direto do lucide), para trocar o desenho num lugar só.
 */
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Clock,
  CloudOff,
  CloudRain,
  CloudRainWind,
  CloudSun,
  DropletOff,
  Droplets,
  Eye,
  FileText,
  Flame,
  History,
  House,
  Layers,
  Leaf,
  LocateFixed,
  LockKeyhole,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  Pointer,
  Satellite,
  Send,
  ShieldCheck,
  Snowflake,
  Sparkle,
  Sprout,
  Thermometer,
  TriangleAlert,
  Square,
  Star,
  Users,
  Volume1,
  Volume2,
  Wheat,
  X,
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

/** "Parar" do "Ouvir resumo": quadrado cheio. */
export function StopIcon({ size = 20 }: IconProps) {
  return <Square size={size} fill="currentColor" {...decorative} />
}

/** "Ouvir resumo" (tarefa 0052): alto-falante com uma onda, discreto. */
export function ListenIcon({ size = 17 }: IconProps) {
  return <Volume1 size={size} {...decorative} />
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

/** Renda: dá grão para vender (tarefa 0040: nenhum valor em reais, por isso nada de nota de dinheiro). */
export function GrainIcon({ size = 24 }: IconProps) {
  return <Wheat size={size} {...decorative} />
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

// Plano de 3 anos (sinal do outono e hectares)
export function PlusIcon({ size = 24 }: IconProps) {
  return <Plus size={size} {...decorative} />
}

export function DryIcon({ size = 24 }: IconProps) {
  return <DropletOff size={size} {...decorative} />
}

export function UncertainIcon({ size = 24 }: IconProps) {
  return <CircleHelp size={size} {...decorative} />
}

export function SeedIcon({ size = 24 }: IconProps) {
  return <Wheat size={size} {...decorative} />
}

export function CloseIcon({ size = 18 }: IconProps) {
  return <X size={size} {...decorative} />
}

export function ReportIcon({ size = 20 }: IconProps) {
  return <FileText size={size} {...decorative} />
}

// Replay da safra passada
export function NoRainIcon({ size = 16 }: IconProps) {
  return <CloudOff size={size} {...decorative} />
}

export function WarningIcon({ size = 16 }: IconProps) {
  return <TriangleAlert size={size} {...decorative} />
}

export function HeatIcon({ size = 16 }: IconProps) {
  return <Thermometer size={size} {...decorative} />
}

export function SendIcon({ size = 18 }: IconProps) {
  return <Send size={size} {...decorative} />
}

// Alertas da sua área (raio-X, tela 4, tarefa 0043)
export function FrostIcon({ size = 20 }: IconProps) {
  return <Snowflake size={size} {...decorative} />
}

export function HeavyRainIcon({ size = 20 }: IconProps) {
  return <CloudRainWind size={size} {...decorative} />
}

export function FireIcon({ size = 20 }: IconProps) {
  return <Flame size={size} {...decorative} />
}

// Tela "Avisos" (tarefa 0046): o botão do cabeçalho e o nível "Fique de olho"
export function AlertsIcon({ size = 18 }: IconProps) {
  return <Bell size={size} {...decorative} />
}

export function WatchIcon({ size = 16 }: IconProps) {
  return <Eye size={size} {...decorative} />
}

// Tela Início, cabeçalho, rodapé e modais (tarefa 0052)
/** Faixa do agrônomo: "Como a conta é feita". */
export function CalculatorIcon({ size = 20 }: IconProps) {
  return <Calculator size={size} {...decorative} />
}

/** Lavoura de demonstração (tela "Onde fica a lavoura"). */
export function HouseIcon({ size = 20 }: IconProps) {
  return <House size={size} {...decorative} />
}

/** Marca d'água "Imagem gerada por IA" (regra do NASA Space Apps). */
export function SparkleIcon({ size = 12 }: IconProps) {
  return <Sparkle size={size} fill="currentColor" {...decorative} />
}

/** Clima do futuro (2041 a 2060) no modal "De onde vêm os dados". */
export function ClockIcon({ size = 20 }: IconProps) {
  return <Clock size={size} {...decorative} />
}

// Tela "Onde fica a lavoura" (tarefa 0053)
/** Seta do cartão "Usar a lavoura de demonstração". */
export function ChevronRightIcon({ size = 16 }: IconProps) {
  return <ChevronRight size={size} {...decorative} />
}

/** "Ver a área inteira": afasta o mapa até a área do MVP caber. */
export function ExpandIcon({ size = 14 }: IconProps) {
  return <Maximize2 size={size} {...decorative} />
}

/** Dica sobre o mapa: "Toque no mapa onde fica a lavoura". */
export function TapIcon({ size = 15 }: IconProps) {
  return <Pointer size={size} {...decorative} />
}
