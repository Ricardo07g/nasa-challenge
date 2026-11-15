/**
 * Ligação de cada rota: controller (estado) → view (desenho). Sem lógica aqui.
 */
import { Navigate, Outlet, ScrollRestoration, useOutletContext, useParams, useSearchParams } from 'react-router'
import { useAvisosController } from './controllers/useAvisosController'
import { useChoosePlanController } from './controllers/useChoosePlanController'
import { useCommunityController } from './controllers/useCommunityController'
import { useCommunitySoonController } from './controllers/useCommunitySoonController'
import { useGuideArticleController, useGuideController } from './controllers/useGuideController'
import { useDesignSystemController } from './controllers/useDesignSystemController'
import { useMethodController } from './controllers/useMethodController'
import { useMissionController } from './controllers/useMissionController'
import { useDocumentTitle } from './controllers/useDocumentTitle'
import { useExampleController } from './controllers/useExampleController'
import { usePlanningController } from './controllers/usePlanningController'
import { useSatelliteController, type SatelliteDeps } from './controllers/useSatelliteController'
import { useShellController } from './controllers/useShellController'
import { useStartController } from './controllers/useStartController'
import { useWhenController } from './controllers/useWhenController'
import { useWhereController } from './controllers/useWhereController'
import { useI18n } from './i18n/useI18n'
import { keepFlowQuery } from './services/flowParams'
import { AvisosView } from './views/AvisosView'
import { ChoosePlanView } from './views/ChoosePlanView'
import { CommunitySoonView } from './views/CommunitySoonView'
import { CommunityView } from './views/CommunityView'
import { DesignSystemView } from './views/DesignSystemView'
import { FlowLoading } from './views/FlowStates'
import { GuideArticleView, GuideView } from './views/GuideView'
import { MethodView } from './views/MethodView'
import { MissionView } from './views/MissionView'
import { PlanningView } from './views/PlanningView'
import { SatelliteView } from './views/SatelliteView'
import { ShellView } from './views/ShellView'
import { StartView } from './views/StartView'
import { WhenView } from './views/WhenView'
import { WhereView } from './views/WhereView'

/** O que a moldura oferece às telas: abrir o modal global de créditos (tarefa 0052). */
export type ShellOutletContext = { openCredits: () => void }

const noop = () => {}

export function ShellPage() {
  const { header, footer, credits, demoNotice } = useShellController()
  const context: ShellOutletContext = { openCredits: credits.onOpen }
  return (
    <ShellView header={header} footer={footer} credits={credits} demoNotice={demoNotice}>
      <ScrollRestoration />
      <Outlet context={context} />
    </ShellView>
  )
}

export function StartPage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.start.pageTitle)
  const shell = useOutletContext<ShellOutletContext | undefined>()
  const state = useStartController(shell?.openCredits ?? noop)
  return <StartView t={t} listen={state.listen} sources={state.sources} />
}

export function WherePage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.where.title)
  const state = useWhereController()
  return (
    <WhereView
      t={t}
      point={state.point}
      demo={state.demo}
      place={state.place}
      area={state.area}
      status={state.status}
      canConfirm={state.canConfirm}
      gps={state.gps}
      view={state.view}
      listen={state.listen}
      other={state.other}
      areaInfo={state.areaInfo}
      onPick={state.pick}
      onUseDemo={state.useDemo}
      onUseLocation={state.useMyLocation}
      onShowArea={state.showArea}
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
      listen={state.listen}
      window={state.window}
      choice={state.choice}
      onPickDate={state.pickDate}
      canContinue={state.canContinue}
      onConfirm={state.confirm}
      notSoy={state.notSoy}
      bands={state.bands}
      rainCurve={state.rainCurve}
      rainLeft={state.rainLeft}
      rainChart={state.rainChart}
      rainEnd={state.rainEnd}
      heatC={state.heatC}
      loading={state.loading}
      bandsModal={state.bandsModal}
      details={state.details}
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
      listen={state.listen}
    />
  )
}

/** Tela 4 (pacote 2, tarefa 0058): raio-X da sua terra e últimas safras. `deps` só nos testes. */
export function SatellitePage({ deps }: { deps?: SatelliteDeps } = {}) {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.satellite.title)
  const state = useSatelliteController(deps)
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <SatelliteView
      t={t}
      lang={lang}
      backTo={state.backTo}
      status={state.status}
      onRetry={state.retry}
      listen={state.listen}
      xray={state.xray}
      detail={state.detail}
      onOpenDetail={state.openDetail}
      onCloseDetail={state.closeDetail}
      soil={state.soil}
      onChooseSoil={state.chooseSoil}
      chart={state.chart}
      seasons={state.seasons}
      onAnswerSeason={state.answerSeason}
      onChooseCurrent={state.chooseCurrent}
      noSoy={state.noSoy}
      adjustTo={state.adjustTo}
      share={
        state.share && {
          state: state.share,
          communityTo: state.communityTo,
          onToggle: state.toggleShare,
          onChange: state.changeShare,
          onSend: (year) => void state.sendShare(year),
        }
      }
      onConfirm={state.confirm}
    />
  )
}

/**
 * Tela 5 do pacote 2 (`/resposta`, `/opcoes` e `/plano`): as abas "1. Escolher" e "2. Plano de 3 anos". `/plano`
 * abre a aba do plano; as outras, a aba "Escolher".
 */
export function ChoosePlanPage() {
  const { lang, messages: t } = useI18n()
  const state = useChoosePlanController()
  useDocumentTitle(state.tab === 'plan' ? t.choose.tabPlan : t.choose.title)
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return <ChoosePlanView t={t} lang={lang} state={state} />
}

/**
 * Endereços antigos (tarefa 0044): `/relatorio` saiu e `/safra-passada` virou o detalhe do ano no explorador
 * da Sugestão. Levam para a tela 5 com o mesmo caminho (e o `ano`, na safra passada: abre o "Por que essa sugestão?" naquele ano).
 */
export function LegacyAnswerRedirect({ keepYear = false }: { keepYear?: boolean }) {
  const [search] = useSearchParams()
  const query = keepFlowQuery(search.toString())
  const year = keepYear ? search.get('ano') : null
  const withYear = year && /^\d{4}$/.test(year) ? `${query}${query ? '&' : '?'}ano=${year}` : query
  return <Navigate to={`/resposta${withYear}`} replace />
}

/**
 * Tela final "Seu planejamento" (`/planejamento`, tarefa 0058): por enquanto, os alertas, os 20 anos de chuva e o
 * clima 2041–2060 que saíram do raio-X. Será refeita no próximo pacote.
 */
export function PlanningPage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.planning.title)
  const state = usePlanningController()
  if (state.redirectTo) return <Navigate to={state.redirectTo} replace />
  return (
    <PlanningView
      t={t}
      lang={lang}
      backTo={state.backTo}
      status={state.status}
      onRetry={state.retry}
      listen={state.listen}
      alerts={state.alerts}
      cards={state.cards}
      rain={state.rain}
      climate={state.climate}
      answerTo={state.answerTo}
      report={state.report}
      onPrint={state.print}
    />
  )
}

/**
 * Comunidade "em breve" (`/comunidade`, pacote 3, tarefa 0061): só o cartão "Em breve" com o "Abrir o Guia". A
 * tela dos relatos (`CommunityPage`, abaixo) fica pronta para quando a comunidade voltar (`COMMUNITY_OPEN`).
 */
export function CommunitySoonPage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.comingSoon.title)
  const state = useCommunitySoonController()
  return <CommunitySoonView t={t} backTo={state.backTo} guideTo={state.guideTo} listen={state.listen} />
}

/** Relatos dos vizinhos ("Na sua região", tarefa 0047): fora da interface enquanto a comunidade está "em breve". */
export function CommunityPage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.community.title)
  const state = useCommunityController()
  return (
    <CommunityView
      t={t}
      lang={lang}
      backTo={state.backTo}
      center={state.center}
      radiusKm={state.radiusKm}
      status={state.status}
      onRetry={state.retry}
      summary={state.summary}
      markers={state.markers}
      canTell={state.canTell}
      markTo={state.markTo}
      years={state.years}
      form={state.form}
      onOpenForm={state.openForm}
      onPlanting={state.setPlanting}
      onRain={state.setRain}
      onEvent={state.setEvent}
      onSend={() => void state.send()}
      onRemove={(id) => void state.remove(id)}
      removing={state.removing}
      region={state.region}
      regionStatus={state.regionStatus}
      onRegionRetry={state.retryRegion}
      regionRadius={state.regionRadius}
      regionDistance={state.regionDistance}
      history={state.history}
      listen={state.listen}
    />
  )
}

export function MethodPage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.method.title)
  const state = useMethodController()
  return (
    <MethodView
      t={t}
      lang={lang}
      backTo={state.backTo}
      status={state.status}
      onRetry={state.retry}
      rows={state.rows}
      example={state.example}
      telegramHref={state.telegramHref}
      sources={state.sources}
      onRetrySources={state.retrySources}
      rain={state.rain}
      rules={state.rules}
      listen={state.listen}
    />
  )
}

/**
 * Exemplo pronto (`/exemplo`): a resposta da fazenda de exemplo com a faixa do satélite (tarefa 0049). Desde a
 * tarefa 0052, a entrada é o link "Usar a lavoura de demonstração" de "Onde fica a lavoura".
 */
export function ExamplePage() {
  const { messages: t } = useI18n()
  const { to } = useExampleController()
  return to ? <Navigate to={to} replace /> : <FlowLoading label={t.common.loading} />
}

export function DesignSystemPage() {
  const { messages: t, lang } = useI18n()
  useDocumentTitle(t.designSystem.title)
  const state = useDesignSystemController()
  return <DesignSystemView t={t} lang={lang} {...state} />
}

export function GuidePage() {
  const { messages: t } = useI18n()
  useDocumentTitle(t.guide.title)
  const state = useGuideController()
  return (
    <GuideView
      t={t}
      backTo="/comunidade"
      groups={state.groups}
      query={state.query}
      onQuery={state.setQuery}
      count={state.count}
      listen={state.listen}
    />
  )
}

export function GuideArticlePage() {
  const { messages: t } = useI18n()
  const { artigo = '' } = useParams()
  const { article, listen } = useGuideArticleController(artigo)
  useDocumentTitle(article?.title ?? t.guide.title)
  return <GuideArticleView t={t} article={article} listen={listen} />
}

/** Tela "Avisos" (seção 6 da remodelagem, tarefa 0046): os avisos do ponto salvo no aparelho. */
export function AvisosPage() {
  const { lang, messages: t } = useI18n()
  useDocumentTitle(t.alerts.title)
  const state = useAvisosController()
  return (
    <AvisosView
      t={t}
      lang={lang}
      status={state.status}
      onRetry={state.retry}
      avisos={state.avisos}
      groups={state.groups}
      place={state.place}
      explorerTo={state.explorerTo}
      markTo={state.markTo}
      backTo={state.backTo}
      listen={state.listen}
    />
  )
}
