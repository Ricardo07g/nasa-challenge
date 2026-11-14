/**
 * Ícones do protótipo v3: SVG de uma cor, traço 2.2, pontas arredondadas, sempre aria-hidden
 * (o texto ao lado dá o significado). Cor via `currentColor`, para seguir o token do componente.
 */
type IconProps = { size?: number }

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function LogoMark({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="13" fill="none" stroke="var(--color-primary)" strokeWidth="2" />
      <ellipse
        cx="15"
        cy="15"
        rx="13"
        ry="5"
        fill="none"
        stroke="var(--color-secondary)"
        strokeWidth="1.6"
        transform="rotate(-25 15 15)"
      />
      <path
        d="M15 9v12M15 15c-3 0-5-2-5-5M15 17c3 0 5-2 5-5"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SpeakerIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 8v4h3l4 3V5L6 8H3z" fill="currentColor" />
      <path
        d="M13 7c1 .8 1.5 1.8 1.5 3s-.5 2.2-1.5 3M15 4.5c1.7 1.4 2.5 3.2 2.5 5.5s-.8 4.1-2.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PinIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <path d="M15 27s8-8.5 8-14a8 8 0 0 0-16 0c0 5.5 8 14 8 14z" {...stroke} />
      <circle cx="15" cy="13" r="3" fill="currentColor" />
    </svg>
  )
}

export function CalendarIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <rect x="4" y="7" width="22" height="19" rx="3" {...stroke} />
      <path d="M4 13h22M10 4v6M20 4v6" {...stroke} />
    </svg>
  )
}

export function CheckCircleIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="11" {...stroke} />
      <path d="M10 15.5l3.5 3.5 7-7.5" {...stroke} strokeWidth={2.4} />
    </svg>
  )
}

export function CheckFilledIcon({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="12" fill="currentColor" />
      <path
        d="M8 13.5l3.2 3.2 6.6-7"
        fill="none"
        stroke="var(--color-on-primary)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CrosshairIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" {...stroke} />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...stroke} />
    </svg>
  )
}

export function SatelliteIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)" {...stroke} />
      <path d="M7 7L3.5 3.5M17 17l3.5 3.5M4 9l5-5M15 20l5-5" {...stroke} />
    </svg>
  )
}

export function DropIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" {...stroke} />
    </svg>
  )
}

export function SoilIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 14h18M3 18h18M6 22h12" {...stroke} />
      <path d="M12 14V8M12 10c-2.5 0-4-1.5-4-4M12 11c2.5 0 4-1.5 4-4" {...stroke} />
    </svg>
  )
}

export function SunIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" {...stroke} />
      <path
        d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
        {...stroke}
      />
    </svg>
  )
}

export function CoinIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.1 0-2.1-.4-2.6-1.2M12 6.5V8M12 16v1.5" {...stroke} strokeWidth={1.8} />
    </svg>
  )
}

export function LeafIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7" {...stroke} />
    </svg>
  )
}
