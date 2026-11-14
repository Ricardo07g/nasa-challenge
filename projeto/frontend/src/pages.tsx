/**
 * Ligação de cada rota: controller (estado) → view (desenho). Sem lógica aqui.
 */
import { Navigate, Outlet, ScrollRestoration } from 'react-router'
import { useAnswerNav } from './controllers/useAnswerNav'
import { useDesignSystemController } from './controllers/useDesignSystemController'
import { useDocumentTitle } from './controllers/useDocumentTitle'
import { useSatelliteController } from './controllers/useSatelliteController'
import { useShellController } from './controllers/useShellController'
import { useWhenController } from './controllers/useWhenController'
import { useWhereController } from './controllers/useWhereController'
import { useI18n } from './i18n/useI18n'
import { EXAMPLE_FARM } from './services/locationService'
import { buildFlowQuery } from './services/flowParams'
import { ComingSoonView } from './views/ComingSoonView'
import { DesignSystemView } from './views/DesignSystemView'
import { SatelliteView } from './views/SatelliteView'
import { ShellView } from './views/ShellView'
import { StartView } from './views/StartView'
import { WhenView } from './views/WhenView'
import { WhereView } from './views/WhereView'

export function ShellPage() {
  const { header, footer } = useShellController()
  return (
    <ShellView header={header} footer={footer}>
      <ScrollRestoration />
      <Outlet />
    </ShellView>
  )
}

export function StartPage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.start.pageTitle)
  return <StartView t={t} />
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
    />
  )
}

export function SatellitePage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.satellite.title)
  const state = useSatelliteController()
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <SatelliteView
      t={t}
      backTo={state.backTo}
      status={state.status}
      onRetry={state.retry}
      history={state.history}
      rain={state.rain}
      soil={state.soil}
      soilOpen={state.soilOpen}
      onToggleSoil={state.toggleSoil}
      onChooseSoil={state.chooseSoil}
      onConfirm={state.confirm}
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

type PendingScreen = 'answer' | 'options' | 'plan' | 'community' | 'method'

/** Telas da resposta: navegam entre si pelas abas. */
const ANSWER_SCREENS: readonly PendingScreen[] = ['answer', 'plan', 'options']

/** Provisório até cada tela ficar pronta. */
export function PendingPage({ screen }: { screen: PendingScreen }) {
  const { messages: t } = useI18n()
  const answerNav = useAnswerNav()
  const titles: Record<PendingScreen, string> = {
    answer: t.answer.best,
    options: t.options.title,
    plan: t.plan.title,
    community: t.community.title,
    method: t.method.title,
  }
  useDocumentTitle(titles[screen])
  return (
    <ComingSoonView
      t={t}
      title={titles[screen]}
      answerNav={ANSWER_SCREENS.includes(screen) ? answerNav : undefined}
    />
  )
}
