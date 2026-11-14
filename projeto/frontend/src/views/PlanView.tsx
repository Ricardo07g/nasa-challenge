import { Card } from '../design-system/components/Card'
import { ChipGroup } from '../design-system/components/Choice'
import { PageHeading, YearTimeline } from '../design-system/components/Content'
import { AnswerTabs, BackLink, type AnswerTab } from '../design-system/components/Navigation'
import type { Messages } from '../i18n/messages.pt'
import type { CropId } from '../models/recomendacao'
import type { PlanArea, PlanScenario, PlanView as Plan } from '../services/recomendacaoRules'
import { FlowError, FlowLoading } from './FlowStates'
import layout from './layout.module.css'

export type PlanViewProps = {
  t: Messages
  nav: { label: string; tabs: AnswerTab[]; backTo: string }
  status: 'loading' | 'ready' | 'error'
  onRetry: () => void
  scenario: PlanScenario
  onScenario: (value: PlanScenario | null) => void
  area: PlanArea
  onArea: (value: PlanArea | null) => void
  plan: Plan | null
}

/** Tela 7 "Plano de 3 anos": linha do tempo; embaixo, ano seco e resumo à esquerda; por onde começar à direita. */
export function PlanView(props: PlanViewProps) {
  const { t, nav, status, onRetry, plan } = props
  const p = t.plan
  return (
    <div className={layout.page}>
      <BackLink to={nav.backTo}>{t.nav.back}</BackLink>
      <AnswerTabs label={nav.label} tabs={nav.tabs} />
      <PageHeading title={p.title} subtitle={p.subtitle} />
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'ready' && plan && <Plan {...props} plan={plan} />}
    </div>
  )
}

function Plan({ t, scenario, onScenario, area, onArea, plan }: PlanViewProps & { plan: Plan }) {
  const p = t.plan
  const name = (crop: CropId) => t.crops.names[crop]
  const lower = (crop: CropId) => name(crop).toLocaleLowerCase()
  const { grain, covered, total } = plan.summary
  const coverage = covered === total ? p.coveredAll(total) : p.coveredSome(covered, total)
  const scenarioText =
    scenario === 'seco'
      ? [p.dryText, ...plan.swaps.map((swap) => p.swap(lower(swap.from), swap.year, lower(swap.to)))].join(' ')
      : p.normalText
  return (
    <>
      <YearTimeline
        label={p.timelineLabel}
        items={plan.years.map(({ year, crop, swappedFrom }) => ({
          year,
          title: name(crop),
          text: swappedFrom ? p.swapTagline(lower(swappedFrom)) : t.crops.taglines[crop],
        }))}
      />
      <div className={layout.pageGrid}>
        <div className={layout.stack}>
          <Card>
            <h2 className={layout.cardTitle}>{p.dryQuestion}</h2>
            <ChipGroup
              label={p.dryQuestion}
              tone="blue"
              options={[
                { value: 'normal', label: p.normal },
                { value: 'seco', label: p.dry },
              ]}
              value={scenario}
              onChange={onScenario}
            />
            <p className={layout.muted}>{scenarioText}</p>
          </Card>
          <Card tone="green" as="section" aria-label={p.withPlan}>
            <h3 className={layout.cardTitle}>{p.withPlan}</h3>
            <p>
              {coverage} · {p.grainYears(grain, total)}
            </p>
          </Card>
          <Card tone="orange" as="section" aria-label={p.today}>
            <h3 className={layout.cardTitle}>{p.today}</h3>
            <p>{plan.today}</p>
          </Card>
        </div>
        <div className={layout.stack}>
          <Card>
            <h2 className={layout.cardTitle}>{p.startSmall}</h2>
            <ChipGroup
              label={p.startSmall}
              options={[
                { value: '50', label: p.area50 },
                { value: '100', label: p.area100 },
                { value: 'all', label: p.areaAll },
              ]}
              value={area}
              onChange={onArea}
            />
            <p>{area === 'all' ? p.wholeText : p.partialText(Number(area))}</p>
          </Card>
          <Card tone="green">
            <h2 className={layout.cardTitle}>{p.gainTitle}</h2>
            <p>{p.gainText}</p>
            <p className={layout.muted}>{p.gainNote}</p>
          </Card>
        </div>
      </div>
    </>
  )
}
