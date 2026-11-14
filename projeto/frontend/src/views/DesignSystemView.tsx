import { Button, TextButton } from '../design-system/components/Button'
import {
  AlternativeCard,
  Card,
  DataSourceCard,
  InfoBanner,
  NotConnectedCard,
  SourceCard,
} from '../design-system/components/Card'
import { NeighborDots, RainBarChart, RainReadingRow, RegionMap } from '../design-system/components/Charts'
import { ChipGroup, DateField, RadioCard } from '../design-system/components/Choice'
import {
  Disclaimer,
  Disclosure,
  NumberedSteps,
  OptionCompareCard,
  PageHeading,
  RecommendationHero,
  YearTimeline,
} from '../design-system/components/Content'
import { ErrorState, LoadingState, ProgressBar, SkeletonCard } from '../design-system/components/Feedback'
import { AnswerTabs, BackLink, QuestionStepper } from '../design-system/components/Navigation'
import {
  MetricRow,
  NotConnected,
  StatusPill,
  StripLegend,
  YearStrip,
  type CellState,
} from '../design-system/components/Status'
import {
  CalendarIcon,
  CheckIcon,
  ClimateIcon,
  CrosshairIcon,
  DropIcon,
  HistoryIcon,
  LeafIcon,
  MoneyIcon,
  PinIcon,
  RainIcon,
  SatelliteIcon,
  ShieldIcon,
  SoilIcon,
  SpeakerIcon,
  SproutIcon,
} from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import type { ApiStatus } from '../models/apiStatus'
import type { CropOption } from '../models/cropOption'
import styles from './DesignSystemView.module.css'
import layout from './layout.module.css'

const COLOR_TOKENS = [
  'primary',
  'primary-strong',
  'secondary',
  'secondary-soft',
  'text',
  'text-secondary',
  'text-muted',
  'page',
  'surface',
  'tint-green',
  'tint-blue',
  'tint-orange',
  'border-control',
  'border',
  'divider',
  'border-green-tint',
  'border-blue-tint',
  'border-orange-tint',
  'good-bg',
  'fair-bg',
  'weak-bg',
  'risk',
  'soil',
]

const RADII = ['hero', 'lg', 'md', 'sm', 'xs', 'tag', 'badge', 'cell']

const ICONS = [
  PinIcon,
  CalendarIcon,
  SatelliteIcon,
  DropIcon,
  RainIcon,
  ClimateIcon,
  HistoryIcon,
  SproutIcon,
  MoneyIcon,
  LeafIcon,
  ShieldIcon,
  CheckIcon,
  CrosshairIcon,
  SpeakerIcon,
]

const noop = () => {}

const rainCells: CellState[] = Array.from({ length: 20 }, (_, index) =>
  [1, 5, 8, 12, 15, 18].includes(index) ? 'bad' : 'good',
)

type DesignSystemViewProps = {
  t: Messages
  apiMode: string
  backend: ApiStatus
  cropOptions: CropOption[]
  cropOptionsError: boolean
}

/** Vitrine do design system (só no ambiente local): tokens, componentes e ambiente. */
export function DesignSystemView({ t, apiMode, backend, cropOptions, cropOptionsError }: DesignSystemViewProps) {
  const d = t.designSystem
  return (
    <div className={layout.page}>
      <PageHeading title={d.title} subtitle={d.intro} />

      <section className={styles.section} aria-labelledby="ds-env">
        <h2 id="ds-env" className={layout.sectionTitle}>
          {d.environment}
        </h2>
        <Card>
          <p>{d.apiMode(apiMode)}</p>
          <p>{d.backendStatus(backend)}</p>
          <h3 className={layout.cardTitle}>{d.cropOptions}</h3>
          {cropOptionsError ? (
            <p role="alert">{t.common.loadError}</p>
          ) : (
            <ul>
              {cropOptions.map((option) => (
                <li key={option.id}>
                  {option.name} ({option.role})
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className={styles.section} aria-labelledby="ds-colors">
        <h2 id="ds-colors" className={layout.sectionTitle}>
          {d.colors}
        </h2>
        <ul className={styles.swatches}>
          {COLOR_TOKENS.map((token) => (
            <li key={token} className={styles.swatch}>
              <span className={styles.swatchColor} style={{ background: `var(--color-${token})` }} />
              <code>--color-{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="ds-type">
        <h2 id="ds-type" className={layout.sectionTitle}>
          {d.typography}
        </h2>
        <Card>
          <p className={styles.hero}>{t.start.title}</p>
          <p className={styles.h1}>{t.plan.title}</p>
          <p className={layout.sectionTitle}>{t.answer.prefer}</p>
          <p className={styles.lead}>{d.sampleText}</p>
          <p>{d.sampleText}</p>
          <p className={layout.muted}>{d.sampleText}</p>
        </Card>
      </section>

      <section className={styles.section} aria-labelledby="ds-shapes">
        <h2 id="ds-shapes" className={layout.sectionTitle}>
          {d.shapes}
        </h2>
        <ul className={styles.radii}>
          {RADII.map((radius) => (
            <li key={radius} className={styles.radius} style={{ borderRadius: `var(--radius-${radius})` }}>
              <code>--radius-{radius}</code>
            </li>
          ))}
        </ul>
        <ul className={styles.icons} aria-label={d.icons}>
          {ICONS.map((Icon, index) => (
            <li key={index} className={styles.icon}>
              <Icon />
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="ds-components">
        <h2 id="ds-components" className={layout.sectionTitle}>
          {d.components}
        </h2>
        <AnswerTabs
          label={t.answerTabs.label}
          tabs={[
            { to: '/design-system#resposta', label: t.answerTabs.answer, current: true },
            { to: '/design-system#plano', label: t.answerTabs.plan, current: false },
            { to: '/design-system#opcoes', label: t.answerTabs.options, current: false },
          ]}
        />
        <div className={layout.grid}>
          <Card>
            <BackLink to="/design-system">{t.nav.back}</BackLink>
            <QuestionStepper current={1} total={2} label={t.stepper.label(1, 2)} />
            <Button arrow>{t.start.start}</Button>
            <Button arrow detail={t.when.cta}>
              {t.when.nextStep}
            </Button>
            <Button variant="outline">{t.start.example}</Button>
            <Button variant="outline-blue" icon={<CrosshairIcon />}>
              {t.where.useLocation}
            </Button>
            <Button variant="compact">{t.community.tellMine}</Button>
            <Button disabled>{t.where.confirm}</Button>
          </Card>
          <Card>
            <ChipGroup
              label={t.options.sortLabel}
              value="dinheiro"
              onChange={noop}
              options={[
                { value: 'chuva', label: t.axes.chuva },
                { value: 'dinheiro', label: t.axes.dinheiro },
                { value: 'terra', label: t.axes.terra },
              ]}
            />
            <ChipGroup
              label={t.plan.planChoice}
              tone="blue"
              value="seco"
              onChange={noop}
              options={[
                { value: 'normal', label: t.plan.planA },
                { value: 'seco', label: t.plan.planB },
              ]}
            />
            <RadioCard title={t.harvest.meio.title} sub={t.harvest.meio.sub} selected onSelect={noop} />
            <RadioCard title={t.harvest.tarde.title} sub={t.harvest.tarde.sub} selected={false} onSelect={noop} />
            <RadioCard title={t.when.dateOption} sub={t.when.dateOptionHint} selected={false} expanded onSelect={noop} />
            <DateField
              label={t.when.dateLabel}
              value="2027-02-18"
              min="2027-01-15"
              max="2027-03-31"
              status={t.when.dateBand('18/02', t.harvest.meio.inline)}
              onChange={noop}
            />
          </Card>
          <Card>
            <MetricRow
              icon={<DropIcon />}
              iconTone="blue"
              label={t.axes.chuva}
              value="14 / 20"
              pill={<StatusPill rotulo="medio">{t.labels.medio}</StatusPill>}
            >
              <YearStrip label={t.answer.rainStripLabel(14, 20)} cells={rainCells} />
            </MetricRow>
            <MetricRow
              icon={<MoneyIcon />}
              label={t.axes.dinheiro}
              value="R$ 700"
              pill={<StatusPill rotulo="bom">{t.labels.bom}</StatusPill>}
            />
            <MetricRow
              icon={<SoilIcon />}
              label={t.axes.terra}
              value="10"
              pill={<StatusPill rotulo="fraco">{t.labels.fraco}</StatusPill>}
            />
            <YearStrip
              size="lg"
              label={t.satellite.historyStripLabel(5, 9, 1)}
              cells={['bad', 'good', 'bad', 'good', 'bad', 'good', 'good', 'bad', 'unknown', 'good']}
              years={['16', '17', '18', '19', '20', '21', '22', '23', '24', '25']}
            />
            <StripLegend
              items={[
                { state: 'good', label: t.satellite.planted },
                { state: 'bad', label: t.satellite.idle },
                { state: 'unknown', label: t.satellite.uncertain },
              ]}
            />
            <TextButton expanded={false} onClick={noop}>
              {t.satellite.soilChange}
            </TextButton>
          </Card>
          <RecommendationHero label={t.answer.best} title={t.crops.names.milho_braquiaria}>
            <p>{t.answer.plantSoon}</p>
          </RecommendationHero>
          <Card tone="green">
            <h3 className={layout.cardTitle}>{t.answer.howTitle}</h3>
            <NumberedSteps steps={[t.method.step1, t.method.step2, t.method.step3]} />
          </Card>
          <Card>
            <Disclosure openLabel={t.answer.why} closeLabel={t.answer.close}>
              <p>{t.method.step3}</p>
            </Disclosure>
            <InfoBanner>{t.when.defaultSuggestion}</InfoBanner>
            <Disclaimer>{t.common.disclaimer}</Disclaimer>
          </Card>
          <DataSourceCard
            icon={<SoilIcon />}
            iconTone="soil"
            title={t.satellite.soilTitle(t.soil.medio)}
            subtitle={t.satellite.soilFromMap}
            readyLabel={t.common.ready}
          />
          <DataSourceCard
            icon={<ClimateIcon />}
            iconTone="blue"
            title={t.satellite.climateTitle}
            subtitle={t.satellite.climateSubtitleGeneric}
            readyLabel={t.common.ready}
            status="unavailable"
            unavailableLabel={t.common.notConnected}
          />
          <NotConnectedCard icon={<RainIcon />} iconTone="blue" title={t.community.rainTitle} label={t.common.notConnected} />
          <Card>
            <NotConnected label={t.common.notConnected} />
            <NotConnected label={t.common.notConnected} what={t.plan.seedCost} />
          </Card>
          <AlternativeCard
            icon={<ShieldIcon />}
            label={t.motives.menos_risco}
            title={t.crops.names.sorgo}
            text={t.crops.taglines.sorgo}
          />
          <OptionCompareCard
            rank={t.options.rank(1)}
            name={t.crops.names.milho_braquiaria}
            highlighted
            rows={[
              { label: t.axes.chuva, value: '14 / 20' },
              { label: t.axes.terra, value: t.crops.taglines.milho_braquiaria },
            ]}
          />
          <Card>
            <YearTimeline
              label={t.plan.timelineLabel}
              items={[
                { year: 2027, title: t.crops.names.milho_braquiaria, text: t.crops.taglines.milho_braquiaria },
                { year: 2028, title: t.crops.names.crotalaria, text: t.crops.taglines.crotalaria },
              ]}
            />
          </Card>
          <Card>
            <RainBarChart
              label={t.when.chartLabel}
              caption={t.when.chartCaption}
              bars={[
                { label: t.when.months.jan, value: 100, tone: 'strong' },
                { label: t.when.months.feb, value: 70, tone: 'strong' },
                { label: t.when.months.mar, value: 66, tone: 'strong' },
                { label: t.when.months.apr, value: 28, tone: 'soft' },
                { label: t.when.months.may, value: 12, tone: 'soft' },
                { label: t.when.months.jun, value: 5, tone: 'soft' },
              ]}
            />
          </Card>
          <Card>
            <NeighborDots liked={3} total={6} label={t.community.dotsLabel(3, 6)} />
            <RainReadingRow place="6 km" reading={t.community.reading(32, 24)} />
            <RegionMap
              label={t.community.mapLabel}
              legend={{ gauge: t.community.legendGauge, planted: t.community.legendPlanted, idle: t.community.legendIdle }}
            />
          </Card>
          <SourceCard
            what={t.method.sources.rain.what}
            source={t.method.sources.rain.source}
            scale={t.method.sources.rain.scale}
          />
          <Card>
            <LoadingState>{t.common.loading}</LoadingState>
            <ProgressBar label={t.mission.title} value={2} max={6} />
            <SkeletonCard />
            <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={noop} />
          </Card>
        </div>
      </section>
    </div>
  )
}
