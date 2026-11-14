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
  /** Segunda linha, menor (ex.: "Próximo passo" / "Ver a resposta"). */
  detail?: string
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
  const { children, variant = 'primary', icon, iconEnd, fullWidth = true, arrow = false, detail } = props
  const className = styles.button
  const content = (
    <>
      {icon}
      {detail ? (
        <span className={styles.text}>
          <span className={styles.main}>{children}</span> <span className={styles.detail}>{detail}</span>
        </span>
      ) : (
        <span>{children}</span>
      )}
      {arrow && <ArrowRightIcon />}
      {iconEnd}
    </>
  )

  if (props.to !== undefined) {
    return (
      <Link
        to={props.to}
        className={className}
        data-variant={variant}
        data-full={fullWidth}
        data-detail={detail !== undefined}
      >
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
      data-detail={detail !== undefined}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {content}
    </button>
  )
}

type TextButtonProps = {
  children: ReactNode
  onClick: () => void
  /** Quando o botão abre e fecha algo (ex.: "Não é? Trocar"). */
  expanded?: boolean
}

/** Botão com cara de link, para ações pequenas dentro de um cartão. */
export function TextButton({ children, onClick, expanded }: TextButtonProps) {
  return (
    <button type="button" className={styles.textButton} aria-expanded={expanded} onClick={onClick}>
      {children}
    </button>
  )
}
