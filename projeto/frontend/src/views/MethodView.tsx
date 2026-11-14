import { Button } from '../design-system/components/Button'
import { Card, SourceCard } from '../design-system/components/Card'
import { NumberedSteps, PageHeading, ScoreTable } from '../design-system/components/Content'
import { ErrorState, LoadingState } from '../design-system/components/Feedback'
import { NotConnected } from '../design-system/components/Status'
import { BackLink } from '../design-system/components/Navigation'
import { ArrowUpRightIcon, SatelliteIcon, SendIcon, SproutIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import type { Opcao } from '../models/recomendacao'
import type { RainSummary } from '../services/satelliteService'
import type { SourceStatus } from '../services/sourceService'
import { rainPeriodText } from './rainPeriod'
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
  /** Fontes conectadas de fato (pelo talhão) e o tamanho do quadrado da chuva usada. */
  sources: { status: 'loading' | 'ready' | 'error'; rows: SourceStatus[]; rainKm: number | null }
  onRetrySources: () => void
  /** Anos e período da chuva (do talhão), para o passo 1; null enquanto o talhão não chega. */
  rain: RainSummary | null
}

/** Tela 9 "Como a conta é feita" (para agrônomos e jurados): método, fontes e notas de 0 a 100. */
export function MethodView(props: MethodViewProps) {
  const { t, backTo, status, onRetry, rows, example, telegramHref, sources, rain } = props
  const m = t.method
  const h = m.scoresHeaders
  const years = rain ? rainPeriodText(t, rain.years, rain) : null
  const noFuture = rows.length > 0 && rows.every(({ notas }) => notas.futuro === null)
  return (
    <div className={layout.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <PageHeading title={m.title} subtitle={m.subtitle} />
      <div className={layout.pageGrid}>
        <NumberedSteps size="lg" steps={[years ? m.step1(years) : m.step1Generic, m.step2, m.step3]} />
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
        <p>
          {sources.rainKm ? m.blindRain(sources.rainKm) : m.blindRainGeneric} {m.blindRest}
        </p>
      </Card>
      <section aria-label={m.sourcesTitle} className={layout.stack}>
        <h2 className={layout.sectionTitle}>{m.sourcesTitle}</h2>
        {sources.status === 'loading' && <LoadingState>{t.common.loading}</LoadingState>}
        {sources.status === 'error' && (
          <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={props.onRetrySources} />
        )}
        {sources.status === 'ready' && (
          <div className={layout.optionGrid}>
            {sources.rows.map(({ key, connected }) => (
              <SourceCard
                key={key}
                what={m.sources[key].what}
                source={m.sources[key].source}
                scale={m.sources[key].scale}
                notConnected={connected ? undefined : t.common.notConnected}
              />
            ))}
          </div>
        )}
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
            {noFuture && <NotConnected label={t.common.notConnected} what={h.future} />}
            {example && <p className={layout.muted}>{m.exampleFarm}</p>}
          </>
        )}
      </Card>
      <p className={layout.muted}>{m.disclaimer}</p>
    </div>
  )
}
