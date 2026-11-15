import { Link } from 'react-router'
import { Button } from '../design-system/components/Button'
import { Card } from '../design-system/components/Card'
import { PageHeading } from '../design-system/components/Content'
import { ErrorState } from '../design-system/components/Feedback'
import { BackLink } from '../design-system/components/Navigation'
import { WarningIcon, WatchIcon } from '../design-system/icons'
import type { AvisosStatus } from '../controllers/useAvisosController'
import { formatFullDate } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { Aviso, Avisos, GrupoAvisos, GrupoAvisosChave } from '../models/avisos'
import { alertText, sourceLine } from './alertTexts'
import styles from './AvisosView.module.css'
import { FlowLoading, FlowOutside } from './FlowStates'
import layout from './layout.module.css'

export type AvisosViewProps = {
  t: Messages
  lang: Lang
  status: AvisosStatus
  onRetry: () => void
  avisos: Avisos | null
  groups: { key: GrupoAvisosChave; group: GrupoAvisos }[]
  place: string | null
  explorerTo: string | null
  markTo: string
  backTo: string
}

/** Artigo do Guia sobre os alertas oficiais (seção 8 do pedido: "Avisos → Rodapé"). */
const OFFICIAL_GUIDE = '/guia/alertas-defesa-civil'
const SMS_HREF = 'sms:40199'
const WHATSAPP_HREF = 'https://wa.me/556120344611'

/**
 * Tela "Avisos" (seção 6 da remodelagem, RF-31): quatro grupos (Agora, O que mudou, Fora do comum, Perto
 * de você) para o ponto salvo no aparelho e o rodapé fixo "Alertas oficiais", que aparece sempre. Cada
 * aviso tem o nível escrito (nunca só a cor), o que o dado mostra, o que fazer, a fonte e a data.
 */
export function AvisosView(props: AvisosViewProps) {
  const { t, status, place } = props
  const a = t.alerts
  return (
    <div className={layout.page}>
      <BackLink to={props.backTo}>{t.nav.back}</BackLink>
      <PageHeading title={a.title} subtitle={a.subtitle} />
      {place && status !== 'no-point' && <p className={styles.place}>{a.place(place)}</p>}
      {status === 'no-point' && (
        <Card as="section" aria-label={a.markField}>
          <div className={layout.stack}>
            <p>{a.needPoint}</p>
            <div className={layout.cta}>
              <Button to={props.markTo} variant="outline">
                {a.markField}
              </Button>
            </div>
          </div>
        </Card>
      )}
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={props.onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' &&
        props.avisos &&
        props.groups.map(({ key, group }) => <AlertGroup key={key} {...props} avisos={props.avisos!} groupKey={key} group={group} />)}
      <OfficialAlerts t={t} />
    </div>
  )
}

function AlertGroup({
  t,
  lang,
  avisos,
  groupKey,
  group,
  explorerTo,
}: AvisosViewProps & { avisos: Avisos; groupKey: GrupoAvisosChave; group: GrupoAvisos }) {
  const a = t.alerts
  const title = a.groups[groupKey]
  const periodo = avisos.periodo
  const series = groupKey === 'mudou' || groupKey === 'recordes'
  return (
    <Card as="section" aria-label={title}>
      <div className={layout.stack}>
        <h2 className={layout.cardTitle}>{title}</h2>
        {groupKey === 'mudou' && periodo && (
          <p className={layout.muted}>
            {a.changedIntro(periodo.recente_inicio, periodo.recente_fim, periodo.antes_inicio, periodo.antes_fim)}{' '}
            <strong>{a.fewYears}</strong>
          </p>
        )}
        {groupKey === 'recordes' && periodo && (
          <p className={layout.muted}>{a.recordsIntro(periodo.antes_inicio, periodo.recente_fim)}</p>
        )}
        {groupKey === 'perto' && <p className={layout.muted}>{a.nearbyIntro(avisos.raio_km, avisos.vizinhos_dias)}</p>}
        {group.avisos.length === 0 ? (
          <div>
            <p className={styles.nothing}>{a.nothing}</p>
            {group.ultima_leitura && (
              <p className={layout.muted}>{a.lastReading(formatFullDate(lang, group.ultima_leitura))}</p>
            )}
          </div>
        ) : (
          <ul className={styles.list}>
            {group.avisos.map((aviso, index) => (
              <AlertItem
                key={`${aviso.tipo}-${index}`}
                t={t}
                lang={lang}
                aviso={aviso}
                series={series}
                neighbor={groupKey === 'perto'}
                periodo={periodo}
                raioKm={avisos.raio_km}
              />
            ))}
          </ul>
        )}
        {groupKey === 'agora' && <Safrinha t={t} lang={lang} avisos={avisos} explorerTo={explorerTo} />}
      </div>
    </Card>
  )
}

function AlertItem({
  t,
  lang,
  aviso,
  series,
  neighbor,
  periodo,
  raioKm,
}: {
  t: Messages
  lang: Lang
  aviso: Aviso
  series: boolean
  neighbor: boolean
  periodo: Avisos['periodo']
  raioKm: number
}) {
  const a = t.alerts
  const text = alertText(t, lang, aviso, { periodo, raioKm })
  return (
    <li className={styles.item} data-level={aviso.nivel}>
      <span className={styles.level} data-level={aviso.nivel}>
        {aviso.nivel === 'atencao' ? <WarningIcon /> : <WatchIcon />}
        <strong>{a.level[aviso.nivel]}</strong>
      </span>
      {neighbor && <span className={styles.unconfirmed}>{a.unconfirmed}</span>}
      <p className={styles.shows}>{text.shows}</p>
      <p>
        <strong>{a.todo}</strong> {text.todo}
      </p>
      <p className={styles.source}>{sourceLine(t, lang, aviso, series)}</p>
    </li>
  )
}

/** A safrinha deste ano: em andamento (os avisos do plantio já estão acima) ou o link do ano passado. */
function Safrinha({ t, lang, avisos, explorerTo }: { t: Messages; lang: Lang; avisos: Avisos; explorerTo: string | null }) {
  const a = t.alerts
  const safrinha = avisos.safrinha
  if (!safrinha) return null
  const crop = safrinha.nome ? safrinha.nome.charAt(0).toLowerCase() + safrinha.nome.slice(1) : null
  return (
    <div className={styles.safrinha}>
      {crop && safrinha.em_andamento && <p>{a.safrinhaRunning(crop)}</p>}
      {crop && !safrinha.em_andamento && safrinha.semeadura && (
        <p>{a.safrinhaNext(crop, formatFullDate(lang, safrinha.semeadura))}</p>
      )}
      {explorerTo && safrinha.explorar_ano !== null && (
        <p>
          <Link to={explorerTo}>{a.safrinhaLink(safrinha.explorar_ano)}</Link>
        </p>
      )}
    </div>
  )
}

/** Rodapé fixo "Alertas oficiais": aparece sempre, com ou sem ponto e com ou sem avisos. */
function OfficialAlerts({ t }: { t: Messages }) {
  const o = t.alerts.official
  return (
    <Card as="section" aria-label={o.title} tone="orange">
      <div className={layout.stack}>
        <h2 className={layout.cardTitle}>{o.title}</h2>
        <p>
          <strong>{o.notice}</strong>
        </p>
        <p>{o.intro}</p>
        <ul className={styles.officialList}>
          <li>
            <p>{o.sms}</p>
            <a className={styles.action} href={SMS_HREF}>
              {o.smsButton}
            </a>
          </li>
          <li>
            <p>{o.whatsapp}</p>
            <a className={styles.action} href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
              {o.whatsappButton}
            </a>
          </li>
          <li>
            <p>{o.app}</p>
          </li>
        </ul>
        <p>{o.calls}</p>
        <div className={styles.calls}>
          <a className={styles.call} href="tel:193">
            {o.call193}
          </a>
          <a className={styles.call} href="tel:199">
            {o.call199}
          </a>
        </div>
        <p>
          <Link to={OFFICIAL_GUIDE}>{o.guide}</Link>
        </p>
      </div>
    </Card>
  )
}
