import type { ReactNode } from 'react'
import { Button } from '../design-system/components/Button'
import { AlternativeCard, Card } from '../design-system/components/Card'
import { Disclosure, NumberedSteps, RecommendationHero } from '../design-system/components/Content'
import { ErrorState, LoadingState, SkeletonCard } from '../design-system/components/Feedback'
import { AnswerTabs, BackLink, type AnswerTab } from '../design-system/components/Navigation'
import { MetricRow, StatusPill, StripLegend, YearStrip } from '../design-system/components/Status'
import { DropIcon, LeafIcon, MoneyIcon, ShieldIcon, SoilIcon, SproutIcon } from '../design-system/icons'
import { formatDayMonth } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { Motivo } from '../models/recomendacao'
import type { AnswerSummary } from '../services/recomendacaoRules'
import layout from './layout.module.css'

export type AnswerViewProps = {
  t: Messages
  lang: Lang
  nav: { label: string; tabs: AnswerTab[]; backTo: string }
  status: 'loading' | 'ready' | 'error'
  onRetry: () => void
  answer: AnswerSummary | null
  aviso: string
  sampleData: boolean
}

const MOTIVE_ICON: Record<Motivo, ReactNode> = {
  menos_risco: <ShieldIcon />,
  mais_dinheiro: <MoneyIcon />,
  cuidar_da_terra: <LeafIcon />,
}

/** Tela 5 "A resposta": destaque e sinais à esquerda; "Como fazer" à direita; alternativas embaixo. */
export function AnswerView(props: AnswerViewProps) {
  const { t, nav, status, answer } = props
  return (
    <div className={layout.page}>
      <BackLink to={nav.backTo}>{t.nav.back}</BackLink>
      <AnswerTabs label={nav.label} tabs={nav.tabs} />
      {status === 'loading' && (
        <>
          <LoadingState>{t.common.loading}</LoadingState>
          <div className={layout.pageGrid}>
            <div className={layout.stack}>
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <SkeletonCard />
          </div>
        </>
      )}
      {status === 'error' && (
        <div className={layout.stack}>
          <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={props.onRetry} />
          <div className={layout.cta}>
            <Button to="/exemplo" variant="outline">
              {t.where.seeExample}
            </Button>
          </div>
        </div>
      )}
      {status === 'ready' && answer && <Answer {...props} answer={answer} />}
    </div>
  )
}

function Answer({ t, lang, answer, aviso, sampleData }: AnswerViewProps & { answer: AnswerSummary }) {
  const a = t.answer
  const { best, late, alternatives } = answer
  const plant = best.data_limite ? `${a.plantUntil} ${formatDayMonth(lang, best.data_limite)}.` : a.plantSoon
  return (
    <>
      <p className={layout.lead}>{a.lead(answer.year)}</p>
      {late.names.length > 0 && (
        <Card tone="orange" as="section" aria-label={t.options.outOfWindowTitle}>
          <strong>{a.lateWarning(late.names.join(', '), late.names.length)}</strong>
          {late.texts.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </Card>
      )}
      <div className={layout.pageGrid}>
        <div className={layout.stack}>
          <RecommendationHero as="h1" label={a.best} title={best.nome}>
            <p>{plant}</p>
          </RecommendationHero>
          <Card>
            <div>
              <MetricRow
                icon={<DropIcon />}
                iconTone="blue"
                label={t.axes.chuva}
                value={best.chuva.texto}
                pill={<StatusPill rotulo={best.chuva.rotulo}>{t.labels[best.chuva.rotulo]}</StatusPill>}
              >
                <YearStrip
                  label={a.rainStripLabel(best.chuva.anos_bons, best.chuva.anos)}
                  cells={best.chuva.faixa.map((good) => (good ? 'good' : 'bad'))}
                />
              </MetricRow>
              <MetricRow
                icon={<MoneyIcon />}
                label={t.axes.dinheiro}
                value={best.dinheiro.texto}
                pill={<StatusPill rotulo={best.dinheiro.rotulo}>{t.labels[best.dinheiro.rotulo]}</StatusPill>}
              />
              <MetricRow
                icon={<SoilIcon />}
                label={t.axes.terra}
                value={best.terra.texto}
                pill={<StatusPill rotulo={best.terra.rotulo}>{t.labels[best.terra.rotulo]}</StatusPill>}
              />
            </div>
            <StripLegend
              items={[
                { state: 'good', label: a.rainEnough },
                { state: 'bad', label: a.rainShort },
              ]}
              note={a.rainYears}
            />
            <Disclosure openLabel={a.why} closeLabel={a.close}>
              {best.porque.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </Disclosure>
          </Card>
        </div>
        <Card tone="green" as="section" aria-label={a.howTitle}>
          <h2 className={layout.iconTitle}>
            <SproutIcon />
            {a.howTitle}
          </h2>
          <NumberedSteps steps={best.como_fazer} />
          <p className={layout.muted}>{a.howNote}</p>
        </Card>
      </div>
      {alternatives.length > 0 && (
        <section aria-label={a.prefer} className={layout.stack}>
          <h2 className={layout.sectionTitle}>{a.prefer}</h2>
          <div className={layout.grid}>
            {alternatives.map(({ motivo, option, text }) => (
              <AlternativeCard
                key={motivo}
                icon={MOTIVE_ICON[motivo]}
                label={t.motives[motivo]}
                title={option.nome}
                text={text}
              />
            ))}
          </div>
        </section>
      )}
      <p className={layout.muted}>{sampleData ? `${t.common.sampleValues} ${aviso}` : aviso}</p>
    </>
  )
}
