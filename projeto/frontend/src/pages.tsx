/**
 * Ligação de cada rota: controller (estado) → view (desenho). Sem lógica aqui.
 */
import { Navigate, Outlet, ScrollRestoration } from 'react-router'
import { useAnswerController } from './controllers/useAnswerController'
import { useCommunityController } from './controllers/useCommunityController'
import { useDesignSystemController } from './controllers/useDesignSystemController'
import { useMethodController } from './controllers/useMethodController'
import { useMissionController } from './controllers/useMissionController'
import { useDocumentTitle } from './controllers/useDocumentTitle'
import { useOptionsController } from './controllers/useOptionsController'
import { usePastSeasonController } from './controllers/usePastSeasonController'
import { usePlanController } from './controllers/usePlanController'
import { useSatelliteController } from './controllers/useSatelliteController'
import { useReportController } from './controllers/useReportController'
import { useShellController } from './controllers/useShellController'
import { useTelegramLink } from './controllers/useTelegramLink'
import { useWhenController } from './controllers/useWhenController'
import { useWhereController } from './controllers/useWhereController'
import { useI18n } from './i18n/useI18n'
import { EXAMPLE_FARM } from './services/locationService'
import { buildFlowQuery } from './services/flowParams'
import { AnswerView } from './views/AnswerView'
import { CommunityView } from './views/CommunityView'
import { DesignSystemView } from './views/DesignSystemView'
import { MethodView } from './views/MethodView'
import { MissionView } from './views/MissionView'
import { OptionsView } from './views/OptionsView'
import { PastSeasonView } from './views/PastSeasonView'
import { PlanView } from './views/PlanView'
import { ReportView } from './views/ReportView'
import { SatelliteView } from './views/SatelliteView'
import { ShellView } from './views/ShellView'
import { StartView } from './views/StartView'
import { WhenView } from './views/WhenView'
import { WhereView } from './views/WhereView'

export function ShellPage() {
  const { header, footer, demoNotice } = useShellController()
  return (
    <ShellView header={header} footer={footer} demoNotice={demoNotice}>
      <ScrollRestoration />
      <Outlet />
    </ShellView>
  )
}

export function StartPage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.start.pageTitle)
  const telegramHref = useTelegramLink()
  return <StartView t={t} telegramHref={telegramHref} />
}

export function WherePage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.where.title)
  const state = useWhereController()
  return (
    <WhereView
      t={t}
      center={state.center}
      place={state.place}
      outside={state.outside}
      locating={state.locating}
      locationError={state.locationError}
      onMove={state.move}
      onUseLocation={state.useMyLocation}
      onConfirm={state.confirm}
    />
  )
}

export function WhenPage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.when.title)
  const state = useWhenController()
  if (state.missingPoint) return <Navigate to="/onde" replace />
  return (
    <WhenView
      t={t}
      lang={lang}
      backTo={state.backTo}
      suggestion={state.suggestion}
      selected={state.selected}
      dateOpen={state.dateOpen}
      date={state.date}
      dateBand={state.dateBand}
      window={state.window}
      onSelect={state.select}
      onOpenDate={state.openDate}
      onDateChange={state.changeDate}
      onConfirm={state.confirm}
      rainChart={state.rainChart}
    />
  )
}

export function MissionPage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.mission.title)
  const state = useMissionController()
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <MissionView
      t={t}
      lang={lang}
      status={state.status}
      phase={state.phase}
      complete={state.complete}
      facts={state.facts}
      place={state.place}
      weak={state.weak}
      reducedMotion={state.reducedMotion}
      spins={state.spins}
      backTo={state.backTo}
      continueTo={state.continueTo}
      onSpin={state.spin}
      onWait={state.waitMore}
      onRetry={state.retry}
    />
  )
}

export function SatellitePage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.satellite.title)
  const state = useSatelliteController()
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <SatelliteView
      t={t}
      lang={lang}
      backTo={state.backTo}
      status={state.status}
      onRetry={state.retry}
      history={state.history}
      rain={state.rain}
      climate={state.climate}
      soil={state.soil}
      soilOpen={state.soilOpen}
      onToggleSoil={state.toggleSoil}
      onChooseSoil={state.chooseSoil}
      onConfirm={state.confirm}
    />
  )
}

export function AnswerPage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.answer.best)
  const state = useAnswerController()
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <AnswerView
      t={t}
      lang={lang}
      nav={state.nav}
      status={state.status}
      onRetry={state.retry}
      answer={state.answer}
      aviso={state.aviso}
      sampleData={state.sampleData}
      reportTo={state.reportTo}
      telegramHref={state.telegramHref}
      rain={state.rain}
    />
  )
}

export function OptionsPage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.options.title)
  const state = useOptionsController()
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <OptionsView
      t={t}
      nav={state.nav}
      status={state.status}
      onRetry={state.retry}
      axis={state.axis}
      onAxis={state.chooseAxis}
      summary={state.summary}
      rain={state.rain}
    />
  )
}

export function PlanPage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.plan.title)
  const state = usePlanController()
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <PlanView
      t={t}
      lang={lang}
      nav={state.nav}
      status={state.status}
      onRetry={state.retry}
      signal={state.signal}
      scenario={state.scenario}
      onScenario={state.chooseScenario}
      areaInput={state.areaInput}
      onAreaChange={state.changeArea}
      onAreaCommit={state.commitArea}
      onAreaStep={state.stepArea}
      totals={state.totals}
      rule={state.rule}
      plan={state.plan}
      communityTo={state.communityTo}
      pastTo={state.pastTo}
      showGainReference={state.showGainReference}
    />
  )
}

export function PastSeasonPage() {
  const { lang, messages: t } = useI18n()
  const state = usePastSeasonController()
  useDocumentTitle(t.past.title(state.year))
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <PastSeasonView
      t={t}
      lang={lang}
      status={state.status}
      onRetry={state.retry}
      backTo={state.backTo}
      year={state.year}
      onYear={state.chooseYear}
      season={state.season}
      sampleData={state.sampleData}
      telegramHref={state.telegramHref}
    />
  )
}

export function ReportPage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.report.title)
  const state = useReportController()
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <ReportView
      t={t}
      lang={lang}
      status={state.status}
      onRetry={state.retry}
      backTo={state.backTo}
      talhao={state.talhao}
      recomendacao={state.recomendacao}
      example={state.example}
      place={state.place}
      today={state.today}
      onPrint={state.print}
    />
  )
}

export function CommunityPage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.community.title)
  const state = useCommunityController()
  return (
    <CommunityView
      t={t}
      backTo={state.backTo}
      status={state.status}
      onRetry={state.retry}
      community={state.community}
      center={state.center}
      points={state.points}
      demo={state.demo}
      onDemo={state.showDemo}
      region={state.region}
      regionStatus={state.regionStatus}
      onRegionRetry={state.retryRegion}
      regionRadius={state.regionRadius}
      history={state.history}
    />
  )
}

export function MethodPage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.method.title)
  const state = useMethodController()
  return (
    <MethodView
      t={t}
      backTo={state.backTo}
      status={state.status}
      onRetry={state.retry}
      rows={state.rows}
      example={state.example}
      telegramHref={state.telegramHref}
      sources={state.sources}
      onRetrySources={state.retrySources}
      rain={state.rain}
    />
  )
}

/** "Ver um exemplo pronto": abre a resposta da fazenda de exemplo (RF-11). */
export function ExamplePage() {
  return <Navigate to={`/resposta${buildFlowQuery({ ...EXAMPLE_FARM, colheita: 'meio', exemplo: true })}`} replace />
}

export function DesignSystemPage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.designSystem.title)
  const state = useDesignSystemController()
  return <DesignSystemView t={t} {...state} />
}
