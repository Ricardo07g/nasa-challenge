import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeftIcon } from '../icons'
import styles from './BackButton.module.css'

export type BackButtonProps = {
  /** A tela anterior, com o caminho do fluxo (ex.: `/onde?lat=…`). */
  to: string
  /** "Voltar" / "Back" (`t.nav.back`). */
  children: ReactNode
  /** Espaço em volta, decidido pela tela (o visual é sempre o mesmo). */
  className?: string
}

/**
 * "← Voltar" de verdade (regra geral 1 do pacote 2): igual em todas as telas internas, no computador e no
 * celular, sempre acima do título. Botão de 42 px com borda verde-clara, fundo branco, texto e seta verdes;
 * com o mouse em cima, fundo verde-claro.
 */
export function BackButton({ to, children, className }: BackButtonProps) {
  return (
    <Link to={to} className={className ? `${styles.back} ${className}` : styles.back} data-back-button="">
      <ArrowLeftIcon size={18} />
      <span>{children}</span>
    </Link>
  )
}
