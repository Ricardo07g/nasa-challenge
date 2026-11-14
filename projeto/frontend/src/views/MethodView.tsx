import { Button } from '../design-system/components/Button'
import { Card, SourceCard } from '../design-system/components/Card'
import { NumberedSteps, PageHeading, ScoreTable } from '../design-system/components/Content'
import { ErrorState, LoadingState } from '../design-system/components/Feedback'
import { BackLink } from '../design-system/components/Navigation'
import { ArrowUpRightIcon, SatelliteIcon, SendIcon, SproutIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import type { Opcao } from '../models/recomendacao'
import layout from './layout.module.css'

export type MethodViewProps = {
  t: Messages
  backTo: string
  /** Estado só da tabela de notas: o resto da tela é texto fixo e aparece na hora. */
  status: 'loading' | 'ready' | 'error'
  onRetry: () => void
  rows: { id: string; nome: string; notas: Opcao['notas'] }[]
  example: boolean
  /** P5: link do bot do Telegram; null quando não está configurado. */
  telegramHref: string | null
}

const SOURCES = ['rain', 'heat', 'moisture', 'history', 'climate', 'soil'] as const

/** Tela 9 "Como a conta é feita" (para agrônomos e jurados): método, fontes e notas de 0 a 100. */
export function MethodView({ t, backTo, status, onRetry, rows, example, telegramHref }: MethodViewProps) {
  const m = t.method
  const h = m.scoresHeaders
  return (
    <div className={layout.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <PageHeading title={m.title} subtitle={m.subtitle} />
      <div className={layout.pageGrid}>
        <NumberedSteps size="lg" steps={[m.step1, m.step2, m.step3]} />
        <div className={layout.stack}>
          <Card tone="green" as="section" aria-label={m.noAiTitle}>
            <h2 className={layout.iconTitle}>
              <SproutIcon />
              {m.noAiTitle}
            </h2>
            <p>{m.noAiText}</p>
          </Card>
          <Card as="section" aria-label={m.validationTitle}>
            <h2 className={layout.cardTitle}>{m.validationTitle}</h2>
            <p>{m.validationText}</p>
          </Card>
        </div>
      </div>
      <Card tone="blue" as="section" aria-label={m.blindTitle}>
        <h2 className={layout.iconTitle} data-tone="blue">
          <SatelliteIcon />
          {m.blindTitle}
        </h2>
        <p>{m.blindText}</p>
      </Card>
      <section aria-label={m.sourcesTitle} className={layout.stack}>
        <h2 className={layout.sectionTitle}>{m.sourcesTitle}</h2>
        <div className={layout.optionGrid}>
          {SOURCES.map((key) => (
            <SourceCard key={key} what={m.sources[key].what} source={m.sources[key].source} scale={m.sources[key].scale} />
          ))}
        </div>
      </section>
      {telegramHref && (
        <Card tone="blue" as="section" aria-label={t.telegram.methodTitle}>
          <h2 className={layout.iconTitle} data-tone="blue">
            <SendIcon />
            {t.telegram.methodTitle}
          </h2>
          <p>{t.telegram.method}</p>
          <div>
            <Button href={telegramHref} variant="blue" fullWidth={false} iconEnd={<ArrowUpRightIcon size={18} />}>
              {t.telegram.open}
            </Button>
          </div>
        </Card>
      )}
      <Card>
        {status === 'loading' && <LoadingState>{t.common.loading}</LoadingState>}
        {status === 'error' && <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={onRetry} />}
        {status === 'ready' && (
          <>
            <ScoreTable
              caption={m.scoresTitle}
              headers={[h.crop, h.safety, h.future, h.soil, h.income, h.final]}
              rows={rows.map(({ nome, notas }) => ({
                name: nome,
                values: [notas.seguranca, notas.futuro, notas.solo, notas.renda, notas.final],
              }))}
            />
            {example && <p className={layout.muted}>{m.exampleFarm}</p>}
          </>
        )}
      </Card>
      <p className={layout.muted}>{m.disclaimer}</p>
    </div>
  )
}
