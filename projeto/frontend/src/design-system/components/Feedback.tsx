import type { ReactNode } from 'react'
import { Button } from './Button'
import styles from './Feedback.module.css'

export function LoadingState({ children }: { children: ReactNode }) {
  return (
    <p role="status" className={styles.loading}>
      <span className={styles.spinner} aria-hidden="true" />
      {children}
    </p>
  )
}

type ErrorStateProps = { message: string; retryLabel: string; onRetry: () => void }

export function ErrorState({ message, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.error}>
      <p role="alert">{message}</p>
      <div className={styles.retry}>
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    </div>
  )
}

/** Bloco cinza pulsando no lugar de um cartão enquanto os dados chegam (a tela nunca fica em branco). */
export function SkeletonCard() {
  return <div className={styles.skeleton} aria-hidden="true" />
}

/** Barra de progresso (ex.: fases da missão). A largura acompanha `value / max`. */
export function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={styles.progress}
    >
      <span className={styles.progressFill} style={{ transform: `scaleX(${max > 0 ? value / max : 0})` }} />
    </div>
  )
}
