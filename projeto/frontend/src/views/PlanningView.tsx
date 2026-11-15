import { useId } from 'react'
import { Link } from 'react-router'
import type { GuideSlug } from '../content/guia/slugs'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import type { PlanReportData } from '../controllers/usePlanningController'
import { BackButton } from '../design-system/components/BackButton'
import { Card, DataSourceCard } from '../design-system/components/Card'
import { GuideLink } from '../design-system/components/GuideLink'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { ClimateIcon, DropIcon, FireIcon, FrostIcon, HeavyRainIcon, PrinterIcon } from '../design-system/icons'
import { formatDecimal, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { RaioX } from '../models/raioX'
import type { ScreenStatus } from '../models/screenStatus'
import type { AreaAlert } from '../services/raioXService'
import type { ClimateSummary, RainSummary } from '../services/satelliteService'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import { futureClimateText } from './futureClimateText'
import { PlanReport } from './PlanReport'
import styles from './PlanningView.module.css'

export type PlanningViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  status: ScreenStatus
  onRetry: () => void
  listen: ListenSummaryState
  /** Alertas da área que o dado indica (cada um só vem com risco). */
  alerts: AreaAlert[]
  /** Cartões do raio-X (20 anos de chuva, clima 2041–2060); null sem o raio-X. */
  cards: RaioX['cartoes'] | null
  /** Sem o raio-X: os anos de chuva e o clima de antes. */
  rain: RainSummary | null
  climate: ClimateSummary | null
  /** "ver na sugestão": a resposta com o caminho todo. */
  answerTo: string
  /** O relatório para imprimir (veio da tela 5 no pacote 3); null enquanto o plano não chegou. */
  report: PlanReportData | null
  onPrint: () => void
}

const ALERT_ICON = { frost: <FrostIcon />, heavyRain: <HeavyRainIcon />, fire: <FireIcon /> }

/** O artigo do Guia de cada alerta (os que existem). */
const ALERT_ARTICLE: Record<AreaAlert['kind'], GuideSlug> = {
  frost: 'geada-na-safrinha',
  heavyRain: 'como-evitar-erosao',
  fire: 'fogo-na-palha',
}

/** Nome da cultura no meio da frase ("milho com braquiária"). */
function cropName(t: Messages, id: string): string {
  const names: Record<string, string> = t.crops.names
  const name = names[id] ?? id
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/**
 * Tela final "Seu planejamento" (`/planejamento`, pacote 2, tarefa 0058): por enquanto, os blocos que saíram do
 * raio-X ("Alertas da sua área", "20 anos de chuva" e "Clima 2041–2060"), como eram. Será refeita no próximo
 * pacote.
 */
export function PlanningView(props: PlanningViewProps) {
  const { t, lang, backTo, status, listen, cards, report } = props
  const p = t.planning
  return (
    <div className={styles.page}>
      <BackButton to={backTo}>{t.nav.back}</BackButton>
      <h1 className={styles.title}>{p.title}</h1>
      {(status === 'ready' || status === 'loading') && (
        <div className={styles.sub}>
          <p>{p.subtitle}</p>
          {status === 'ready' && (
            <ListenSummary supported={listen.supported} speaking={listen.speaking} onToggle={listen.toggle} label={t.listen.summary} stopLabel={t.listen.stop} />
          )}
        </div>
      )}
      <div className={styles.content}>
        {status === 'loading' && <FlowLoading label={p.loading} />}
        {status === 'error' && <FlowError t={t} message={t.satellite.error} onRetry={props.onRetry} />}
        {status === 'outside' && <FlowOutside t={t} />}
        {status === 'ready' && report && (
          <button type="button" className={styles.print} onClick={props.onPrint}>
            <PrinterIcon size={17} />
            {p.print}
          </button>
        )}
        {status === 'ready' && (
          <>
            <AreaAlerts {...props} />
            <div className={styles.cardsRow}>{cards ? <SmallCards {...props} cards={cards} /> : <LegacyCards {...props} />}</div>
          </>
        )}
        {report && <PlanReport t={t} lang={lang} data={report} />}
      </div>
    </div>
  )
}

/** Alertas da sua área: cada um só aparece se o dado indicar risco (o backend só manda esses). */
function AreaAlerts({ t, lang, alerts }: PlanningViewProps) {
  const titleId = useId()
  if (alerts.length === 0) return null
  const a = t.xray.alerts
  const items = alerts.map((alert) => {
    switch (alert.kind) {
      case 'frost':
        return {
          kind: alert.kind,
          title: a.frost.title,
          text: a.frost.text(alert.data.anos.length, alert.data.total_anos, formatNumber(lang, alert.data.temp_c)),
          article: t.xray.articles.frost,
        }
      case 'heavyRain':
        return {
          kind: alert.kind,
          title: a.heavyRain.title,
          text: a.heavyRain.text(
            formatDecimal(lang, alert.data.media_dias_ano, 1),
            formatNumber(lang, alert.data.limite_mm),
            alert.data.dias,
            alert.data.total_anos,
          ),
          article: t.xray.articles.erosion,
        }
      case 'fire':
        return {
          kind: alert.kind,
          title: a.fire.title,
          text: a.fire.text(formatNumber(lang, alert.data.raio_km), alert.data.anos.length, alert.data.total_anos),
          article: t.xray.articles.fire,
        }
    }
  })
  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <h2 id={titleId} className={styles.sectionTitle}>
        {a.title}
      </h2>
      <ul className={styles.alerts}>
        {items.map((item) => (
          <li key={item.kind} className={styles.alert}>
            <span className={styles.alertIcon}>{ALERT_ICON[item.kind]}</span>
            <div className={styles.alertText}>
              <h3 className={styles.alertTitle}>{item.title}</h3>
              <p>{item.text}</p>
              <GuideLink slug={ALERT_ARTICLE[item.kind]} newTabLabel={t.common.newTab}>
                {t.xray.learnMore(item.article)}
              </GuideLink>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Cartões menores: em quantos anos a melhor opção deu certo e o clima de 2041 a 2060. */
function SmallCards({ t, lang, cards, answerTo }: PlanningViewProps & { cards: RaioX['cartoes'] }) {
  const c = t.xray.cards
  const rain = cards.chuva_20_anos
  const future = cards.clima_futuro
  const futureText = future && futureClimateText(t, lang, future)
  const see = (
    <Link to={answerTo} className={styles.seeLink}>
      {c.seeAnswer}
    </Link>
  )
  return (
    <>
      {rain && (
        <Card as="section">
          <h2 className={styles.smallTitle}>{c.rainTitle(rain.total_anos)}</h2>
          <p className={styles.bigNumber}>{c.rainValue(rain.anos_bons, rain.total_anos)}</p>
          <p>{c.rainText(cropName(t, rain.cultura))}</p>
          {see}
        </Card>
      )}
      {futureText && (
        <Card as="section">
          <h2 className={styles.smallTitle}>{c.futureTitle}</h2>
          <p className={styles.mediumNumber}>{futureText.rain}</p>
          <p className={styles.mediumNumber}>{futureText.heat}</p>
          <p>{futureText.agreement}</p>
          <p className={styles.muted}>{c.futureSource}</p>
          {see}
        </Card>
      )}
    </>
  )
}

/** Sem o raio-X: os cartões de antes (chuva e clima), só com o dado que chegou. */
function LegacyCards({ t, rain, climate }: PlanningViewProps) {
  const s = t.satellite
  return (
    <>
      {rain && (
        <DataSourceCard
          icon={<DropIcon />}
          iconTone="blue"
          title={s.rainTitle(rain.years)}
          subtitle={rain.period ? s.rainSubtitle(rain.period.start, rain.period.end, rain.skipped) : s.rainDaily}
          readyLabel={t.common.ready}
        />
      )}
      {climate && (
        <DataSourceCard
          icon={<ClimateIcon />}
          iconTone="blue"
          title={s.climateTitle}
          subtitle={climate.period ? s.climateSubtitle(climate.period.start, climate.period.end) : s.climateSubtitleGeneric}
          readyLabel={t.common.ready}
        />
      )}
    </>
  )
}
