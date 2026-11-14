import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon } from '../icons'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'outline' | 'outline-blue' | 'compact'

type CommonProps = {
  children: ReactNode
  variant?: ButtonVariant
  icon?: ReactNode
  /** Ocupa a largura toda do contêiner (padrão nos CTAs das telas). */
  fullWidth?: boolean
  /** Seta → no fim: a ação avança no fluxo (Começar, É aqui, Ver a resposta). */
  arrow?: boolean
  /** Outro ícone no fim (ex.: ↗ quando abre um exemplo). */
  iconEnd?: ReactNode
}

type AsButton = CommonProps & {
  to?: undefined
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

type AsLink = CommonProps & {
  to: string
}

export type ButtonProps = AsButton | AsLink

export function Button(props: ButtonProps) {
  const { children, variant = 'primary', icon, iconEnd, fullWidth = true, arrow = false } = props
  const className = styles.button
  const content = (
    <>
      {icon}
      <span>{children}</span>
      {arrow && <ArrowRightIcon />}
      {iconEnd}
    </>
  )

  if (props.to !== undefined) {
    return (
      <Link to={props.to} className={className} data-variant={variant} data-full={fullWidth}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type={props.type ?? 'button'}
      className={className}
      data-variant={variant}
      data-full={fullWidth}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {content}
    </button>
  )
}
