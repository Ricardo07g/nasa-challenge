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
