/**
 * Ligação de cada rota: controller (estado) → view (desenho). Sem lógica aqui.
 */
import { Navigate, Outlet, ScrollRestoration } from 'react-router'
import { useDesignSystemController } from './controllers/useDesignSystemController'
import { useDocumentTitle } from './controllers/useDocumentTitle'
import { useShellController } from './controllers/useShellController'
import { useWhereController } from './controllers/useWhereController'
import { useI18n } from './i18n/useI18n'
import { EXAMPLE_FARM } from './services/locationService'
import { buildFlowQuery } from './services/flowParams'
import { ComingSoonView } from './views/ComingSoonView'
import { DesignSystemView } from './views/DesignSystemView'
import { ShellView } from './views/ShellView'
import { StartView } from './views/StartView'
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

type PendingScreen = 'when' | 'satellite' | 'answer' | 'options' | 'plan' | 'community' | 'method'

/** Provisório até cada tela ficar pronta. */
export function PendingPage({ screen }: { screen: PendingScreen }) {
  const { messages: t } = useI18n()
  const titles: Record<PendingScreen, string> = {
    when: t.when.title,
    satellite: t.satellite.title,
    answer: t.answer.best,
    options: t.options.title,
    plan: t.plan.title,
    community: t.community.title,
    method: t.method.title,
  }
  useDocumentTitle(titles[screen])
  return <ComingSoonView t={t} title={titles[screen]} />
}
