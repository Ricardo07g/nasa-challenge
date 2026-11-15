import { useId } from 'react'
import type { AvisosDetail, AvisosState } from '../controllers/useAvisosController'
import { BackButton } from '../design-system/components/BackButton'
import { Button } from '../design-system/components/Button'
import { Card } from '../design-system/components/Card'
import { ErrorState, LoadingState } from '../design-system/components/Feedback'
import { GuideLink } from '../design-system/components/GuideLink'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { Modal } from '../design-system/components/Modal'
import { AlertsIcon, CheckIcon, ChevronRightIcon, WarningIcon, WatchIcon } from '../design-system/icons'
import {
  changeText,
  exampleRowText,
  nowText,
  periodsLabel,
  planText,
  recordText,
  sourceLine,
  type DetailText,
} from '../i18n/alertTexts'
import { formatFullDate } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { Aviso, Avisos, NivelAviso } from '../models/avisos'
import type { AlertsSummary } from '../services/avisosService'
import { parseInline } from '../services/markdownService'
import styles from './AvisosView.module.css'
import { FlowOutside } from './FlowStates'

export type AvisosViewProps = { t: Messages; lang: Lang; state: AvisosState }

const SMS_HREF = 'sms:40199'
const WHATSAPP_HREF = 'https://wa.me/556120344611?text=Oi'

/**
 * Tela "Avisos" (`/avisos`; refeita no pacote 3, tela 7, tarefa 0062; protótipo `tela-7-avisos.html`): topo com o
 * lugar e a data, o resumo (o mesmo número do sino), a grade "Agora" + "Alertas oficiais", "Como a sua área está
 * mudando", "Já aconteceu aqui" e a comunidade "Em breve". Os detalhes ficam em modais; sem dado, o item não aparece.
 * O "Perto de você" (relatos de vizinhos) saiu da tela, mesmo que a API ainda mande.
 */
export function AvisosView({ t, lang, state }: AvisosViewProps) {
  const a = t.alerts
  const avisos = state.status === 'ready' ? state.avisos : null
  return (
    <div className={styles.page}>
      <BackButton to={state.backTo}>{t.nav.back}</BackButton>
      <h1 className={styles.title}>{a.title}</h1>
      <div className={styles.context}>
        {state.place && (
          <p>{avisos ? <Rich text={a.context(state.place, formatFullDate(lang, avisos.hoje))} /> : state.place}</p>
        )}
        <ListenSummary
          supported={state.listen.supported}
          speaking={state.listen.speaking}
          onToggle={state.listen.toggle}
          label={t.listen.summary}
          stopLabel={t.listen.stop}
        />
        <GuideLink slug="como-ler-os-avisos" newTabLabel={t.common.newTab} className={styles.guideLink}>
          {a.readGuide}
        </GuideLink>
      </div>
      {avisos && state.summary && <StatusCard t={t} summary={state.summary} />}
      <div className={styles.grid}>
        <div className={styles.column}>
          {avisos ? <NowBox t={t} lang={lang} state={state} avisos={avisos} /> : <PendingBox t={t} state={state} />}
        </div>
        <div className={styles.column}>
          <OfficialAlerts t={t} />
        </div>
      </div>
      {avisos && state.changes.length > 0 && <ChangedSection t={t} lang={lang} state={state} avisos={avisos} />}
      {avisos && state.records.length > 0 && <RecordsSection t={t} lang={lang} state={state} avisos={avisos} />}
      <SoonCard t={t} />
      {avisos && <DetailModal t={t} lang={lang} state={state} avisos={avisos} />}
      {avisos && state.example.year !== null && <ExampleModal t={t} lang={lang} state={state} avisos={avisos} year={state.example.year} />}
    </div>
  )
}

/** Texto com **negrito** do dicionário (o `parseInline` do Guia): nunca HTML. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) =>
        part.type === 'strong' ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>,
      )}
    </>
  )
}

/** O nível sempre escrito, com o ícone (triângulo no "Atenção", olho no "Fique de olho"); a cor só reforça. */
function LevelTag({ t, level }: { t: Messages; level: NivelAviso }) {
  return (
    <span className={styles.level} data-level={level}>
      {level === 'atencao' ? <WarningIcon size={13} /> : <WatchIcon size={13} />}
      {t.alerts.level[level]}
    </span>
  )
}

/** O resumo: verde sem aviso, azul só com "Fique de olho", laranja com algum "Atenção"; a legenda só com aviso. */
function StatusCard({ t, summary }: { t: Messages; summary: AlertsSummary }) {
  const s = t.alerts.status
  const title = summary.count === 0 ? s.noneTitle : s.count(summary.count)
  const text = summary.count === 0 ? s.noneText : summary.attention > 0 ? s.attention(summary.attention) : s.watch
  const icon =
    summary.tone === 'ok' ? <CheckIcon size={24} /> : summary.tone === 'attention' ? <WarningIcon size={24} /> : <AlertsIcon size={24} />
  return (
    <section className={styles.status} data-summary={summary.tone} aria-live="polite">
      <span className={styles.statusIcon}>{icon}</span>
      <div className={styles.statusText}>
        <p className={styles.statusTitle}>{title}</p>
        <p>{text}</p>
      </div>
      {summary.count > 0 && (
        <div className={styles.levels} role="group" aria-label={s.legend}>
          <span>
            <LevelTag t={t} level="atencao" /> {s.legendAttention}
          </span>
          <span>
            <LevelTag t={t} level="fique_de_olho" /> {s.legendWatch}
          </span>
        </div>
      )}
    </section>
  )
}

type BlockProps = { t: Messages; lang: Lang; state: AvisosState; avisos: Avisos }

/** "Agora": os cartões-botão (o detalhe abre no modal), a caixa verde sem aviso e a linha do plano com o exemplo. */
function NowBox({ t, lang, state, avisos }: BlockProps) {
  const a = t.alerts
  const id = useId()
  const last = avisos.agora.ultima_leitura
  const readings = state.recentReadings ? a.now.recent : last ? a.now.until(formatFullDate(lang, last)) : null
  const year = state.example.year
  return (
    <section className={styles.box} aria-labelledby={id}>
      <div className={styles.boxTop}>
        <h2 id={id} className={styles.boxTitle}>
          {a.now.title}
        </h2>
        {readings && <span className={styles.boxSub}>{readings}</span>}
      </div>
      {state.now.length > 0 ? (
        <div className={styles.cards}>
          {state.now.map((aviso, index) => (
            <NowCard key={aviso.tipo} t={t} lang={lang} aviso={aviso} onOpen={() => state.openDetail('now', index)} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <CheckIcon size={16} />
          </span>
          <div>
            <p className={styles.emptyTitle}>{a.now.emptyTitle}</p>
            <p>{a.now.emptyText}</p>
          </div>
        </div>
      )}
      {(state.plan || year !== null) && (
        <div className={styles.planRow}>
          {state.plan && (
            <p>
              <Rich text={planText(t, lang, state.plan)} />
            </p>
          )}
          {year !== null && (
            <button type="button" className={styles.linkButton} aria-haspopup="dialog" onClick={state.example.onOpen}>
              {a.example.link(year)}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function NowCard({ t, lang, aviso, onOpen }: { t: Messages; lang: Lang; aviso: Aviso; onOpen: () => void }) {
  const text = nowText(t, lang, aviso)
  if (!text) return null
  return (
    <button type="button" className={styles.card} data-level={aviso.nivel} aria-haspopup="dialog" onClick={onOpen}>
      <span className={styles.cardTop}>
        <LevelTag t={t} level={aviso.nivel} />
        <span className={styles.details}>
          {t.alerts.now.details}
          <ChevronRightIcon size={14} />
        </span>
      </span>
      <span className={styles.cardTitle}>
        {text.title}: {text.number}
      </span>
      <span className={styles.cardTodo}>
        <strong>{t.alerts.now.todo}</strong> {text.short}
      </span>
      <span className={styles.cardSource}>{sourceLine(t, lang, aviso, false)}</span>
    </button>
  )
}

/** Sem os avisos na mão: pedir o ponto, carregando, erro ou fora da área (no lugar de "Agora"). */
function PendingBox({ t, state }: { t: Messages; state: AvisosState }) {
  const a = t.alerts
  if (state.status === 'no-point') {
    return (
      <Card as="section" aria-label={a.markField}>
        <div className={styles.pending}>
          <p>{a.needPoint}</p>
          <div>
            <Button to={state.markTo} variant="outline">
              {a.markField}
            </Button>
          </div>
        </div>
      </Card>
    )
  }
  if (state.status === 'error') return <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={state.retry} />
  if (state.status === 'outside') return <FlowOutside t={t} />
  return <LoadingState>{t.common.loading}</LoadingState>
}

/** "Como a sua área está mudando": até 4 quadros com o valor antigo riscado e o novo grande. */
function ChangedSection({ t, lang, state, avisos }: BlockProps) {
  const c = t.alerts.changed
  const id = useId()
  const periodo = avisos.periodo
  return (
    <section className={`${styles.box} ${styles.section}`} aria-labelledby={id}>
      <h2 id={id} className={styles.boxTitle}>
        {c.title}
      </h2>
      <p className={styles.boxSub}>
        {periodo && `${c.intro(periodo.recente_inicio, periodo.recente_fim, periodo.antes_inicio, periodo.antes_fim)} `}
        <strong>{c.fewYears}</strong>
      </p>
      <div className={styles.tiles}>
        {state.changes.map((aviso, index) => {
          const text = changeText(t, lang, aviso, periodo)
          if (!text) return null
          return (
            <button
              key={aviso.tipo}
              type="button"
              className={styles.tile}
              aria-haspopup="dialog"
              onClick={() => state.openDetail('change', index)}
            >
              <span className={styles.tileLabel}>{text.label}</span>
              <span className={styles.beforeAfter}>
                <span className="visually-hidden">{c.before}: </span>
                <s className={styles.before}>{text.before}</s>
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
                <span className="visually-hidden"> {c.after}: </span>
                <span className={styles.after} data-worse={String(text.worse)}>
                  {text.after}
                </span>
              </span>
              {periodo && <span className={styles.years}>{periodsLabel(periodo)}</span>}
              <span className={styles.more}>{c.seeDetails}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** "Já aconteceu aqui": os 4 recordes da série, com o número grande e a frase curta. */
function RecordsSection({ t, lang, state, avisos }: BlockProps) {
  const r = t.alerts.records
  const id = useId()
  const periodo = avisos.periodo
  return (
    <section className={`${styles.box} ${styles.section}`} aria-labelledby={id}>
      <h2 id={id} className={styles.boxTitle}>
        {r.title}
      </h2>
      <p className={styles.boxSub}>{periodo ? r.intro(periodo.antes_inicio, periodo.recente_fim) : r.introNoYears}</p>
      <div className={styles.tiles}>
        {state.records.map((aviso, index) => {
          const text = recordText(t, lang, aviso, periodo)
          if (!text) return null
          return (
            <button
              key={aviso.tipo}
              type="button"
              className={styles.tile}
              aria-haspopup="dialog"
              onClick={() => state.openDetail('record', index)}
            >
              <span className={styles.tileLabel}>{text.label}</span>
              <span className={styles.record}>{text.value}</span>
              <span className={styles.recordCaption}>{text.caption}</span>
              <span className={styles.more}>{t.alerts.changed.seeDetails}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** O que o modal de detalhe mostra para o cartão ou o quadro aberto. */
function detailOf(
  t: Messages,
  lang: Lang,
  state: AvisosState,
  avisos: Avisos,
  detail: AvisosDetail,
): { level: NivelAviso | null; text: DetailText; source: string } | null {
  const list = detail.kind === 'now' ? state.now : detail.kind === 'change' ? state.changes : state.records
  const aviso = list[detail.index]
  if (!aviso) return null
  const text =
    detail.kind === 'now'
      ? nowText(t, lang, aviso)
      : detail.kind === 'change'
        ? changeText(t, lang, aviso, avisos.periodo)
        : recordText(t, lang, aviso, avisos.periodo)
  if (!text) return null
  return { level: detail.kind === 'now' ? aviso.nivel : null, text, source: sourceLine(t, lang, aviso, detail.kind !== 'now') }
}

/** O modal de "Detalhes" e de "Ver detalhes": nível, título, número, o que significa, o que fazer, fonte e Saiba mais. */
function DetailModal({ t, lang, state, avisos }: BlockProps) {
  const a = t.alerts
  const content = state.detail ? detailOf(t, lang, state, avisos, state.detail) : null
  return (
    <Modal open={content !== null} onClose={state.closeDetail} title={content?.text.title ?? ''} closeLabel={t.common.close}>
      {content && (
        <div className={styles.detail}>
          {content.level && <LevelTag t={t} level={content.level} />}
          <p className={styles.detailNumber}>{content.text.number}</p>
          <section className={styles.detailBlock}>
            <h3>{a.detail.meaning}</h3>
            <p>{content.text.meaning}</p>
          </section>
          <section className={styles.detailBlock}>
            <h3>{a.detail.todo}</h3>
            <p>{content.text.todo}</p>
          </section>
          <p className={styles.detailSource}>{content.source}</p>
          <GuideLink slug={content.text.guide} newTabLabel={t.common.newTab} className={styles.detailMore}>
            {content.text.guideLabel}
          </GuideLink>
        </div>
      )}
    </Modal>
  )
}

/** "Como teriam sido os avisos em <ano>": o replay e os recordes daquele ano, com dado real. */
function ExampleModal({ t, lang, state, avisos, year }: BlockProps & { year: number }) {
  const e = t.alerts.example
  const example = state.example
  return (
    <Modal open={example.open} onClose={example.onClose} title={e.title(year)} subtitle={e.subtitle} closeLabel={t.common.close}>
      {example.status === 'loading' ? (
        <LoadingState>{e.loading}</LoadingState>
      ) : example.rows.length === 0 ? (
        <p className={styles.detailText}>{e.nothing(year)}</p>
      ) : (
        <ul className={styles.exampleList}>
          {example.rows.map((row) => {
            const text = exampleRowText(t, lang, row, avisos.periodo)
            return (
              <li key={row.kind === 'replay' ? `${row.tipo}-${row.date}` : row.aviso.tipo}>
                <span className={styles.exampleWhen}>{text.when}</span>
                <div>
                  <LevelTag t={t} level={text.level} />
                  <p>{text.text}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className={styles.detailSource}>{e.source(year)}</p>
    </Modal>
  )
}

/** "Alertas oficiais": sempre visível, com a âncora `#alertas-oficiais` (o "Ver alertas oficiais" da tela 6). */
function OfficialAlerts({ t }: { t: Messages }) {
  const o = t.alerts.official
  const id = useId()
  return (
    <section id="alertas-oficiais" className={`${styles.box} ${styles.official}`} aria-labelledby={id}>
      <h2 id={id} className={styles.boxTitle}>
        {o.title}
      </h2>
      <p className={styles.boxSub}>
        <strong>{o.notice}</strong> {o.intro}
      </p>
      <div className={styles.officialButtons}>
        <a className={styles.officialButton} href={SMS_HREF}>
          <span>{o.smsCaption}</span> <b>{o.sms}</b>
        </a>
        <a className={styles.officialButton} href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
          <span>{o.whatsappCaption}</span> <b>{o.whatsapp}</b>
          <span className="visually-hidden"> {t.common.newTab}</span>
        </a>
        <a className={styles.officialButton} data-strong="" href="tel:193">
          <span>{o.fireCaption}</span> <b>{o.fire}</b>
        </a>
        <a className={styles.officialButton} data-strong="" href="tel:199">
          <span>{o.civilCaption}</span> <b>{o.civil}</b>
        </a>
      </div>
      <GuideLink slug="alertas-defesa-civil" newTabLabel={t.common.newTab} className={styles.officialGuide}>
        {o.guide}
      </GuideLink>
    </section>
  )
}

/** A comunidade "em breve" no fim da página: só o aviso, sem botão. */
function SoonCard({ t }: { t: Messages }) {
  const s = t.alerts.soon
  const id = useId()
  return (
    <section className={`${styles.box} ${styles.section} ${styles.soon}`} aria-labelledby={id}>
      <span className={styles.soonTag}>{s.tag}</span>
      <h2 id={id} className={styles.boxTitle}>
        {s.title}
      </h2>
      <p className={styles.boxSub}>{s.text}</p>
      <ul className={styles.soonList}>
        {s.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
