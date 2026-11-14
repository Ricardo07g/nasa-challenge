import { Button } from '../design-system/components/Button'
import { Card } from '../design-system/components/Card'
import { ErrorState, LoadingState, SkeletonCard } from '../design-system/components/Feedback'
import type { Messages } from '../i18n/messages.pt'
import type { LateSummary } from '../services/recomendacaoRules'
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

/** Aviso laranja do que ficou fora da janela de plantio (colheita tardia). */
export function LateWarning({ t, late }: { t: Messages; late: LateSummary }) {
  if (late.names.length === 0) return null
  return (
    <Card tone="orange" as="section" aria-label={t.options.outOfWindowTitle}>
      <strong>{t.answer.lateWarning(late.names.join(', '), late.names.length)}</strong>
      {late.texts.map((text) => (
        <p key={text}>{text}</p>
      ))}
    </Card>
  )
}
