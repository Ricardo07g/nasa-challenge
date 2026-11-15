import { Button } from '../design-system/components/Button'
import { Card } from '../design-system/components/Card'
import { ErrorState, LoadingState, SkeletonCard } from '../design-system/components/Feedback'
import type { Messages } from '../i18n/messages.pt'
import layout from './layout.module.css'

/** Carregando: aviso + cartões pulsando no lugar do conteúdo (nunca tela branca). */
export function FlowLoading({ label }: { label: string }) {
  return (
    <>
      <LoadingState>{label}</LoadingState>
      <div className={layout.pageGrid}>
        <div className={layout.stack}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className={layout.stack}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </>
  )
}

/** Erro: explica, deixa tentar de novo e oferece a fazenda de exemplo (RF-11). */
export function FlowError({ t, message, onRetry }: { t: Messages; message: string; onRetry: () => void }) {
  return (
    <div className={layout.stack}>
      <ErrorState message={message} retryLabel={t.common.retry} onRetry={onRetry} />
      <div className={layout.cta}>
        <Button to="/exemplo" variant="outline">
          {t.where.seeExample}
        </Button>
      </div>
    </div>
  )
}

/** O servidor ainda não tem dados para esse ponto: explica e oferece a fazenda de exemplo (RF-11). */
export function FlowOutside({ t }: { t: Messages }) {
  return (
    <Card tone="orange" as="section" aria-label={t.where.outsideTitle}>
      <h2 className={layout.cardTitle}>{t.where.outsideTitle}</h2>
      <p>{t.where.outsideText}</p>
      <div className={layout.cta}>
        <Button to="/exemplo" variant="outline">
          {t.where.seeExample}
        </Button>
      </div>
    </Card>
  )
}
