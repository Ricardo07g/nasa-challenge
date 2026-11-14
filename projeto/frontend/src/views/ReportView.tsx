import type { ReactNode } from 'react'
import { Button } from '../design-system/components/Button'
import { BackLink } from '../design-system/components/Navigation'
import { ToneBadge, YearStrip } from '../design-system/components/Status'
import { ClimateIcon, DryIcon, UncertainIcon } from '../design-system/icons'
import { formatCoordinates, formatCurrency, formatDayMonth, formatFullDate } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { NivelSinal, Recomendacao } from '../models/recomendacao'
import type { ScreenStatus } from '../models/screenStatus'
import type { SituacaoAno, Talhao } from '../models/talhao'
import { harvestYear } from '../services/recomendacaoRules'
import { reportSources } from '../services/reportService'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import layout from './layout.module.css'
import styles from './ReportView.module.css'

export type ReportViewProps = {
  t: Messages
  lang: Lang
  status: ScreenStatus
  onRetry: () => void
  backTo: string
  talhao: Talhao | null
  recomendacao: Recomendacao | null
  example: boolean
  place: string | null
  /** Data de hoje (ISO). */
  today: string
  onPrint: () => void
}

const SIGNAL_LOOK: Record<NivelSinal, { tone: 'orange' | 'green' | 'blue'; icon: ReactNode }> = {
  seco: { tone: 'orange', icon: <DryIcon /> },
  normal: { tone: 'green', icon: <ClimateIcon /> },
  incerto: { tone: 'blue', icon: <UncertainIcon /> },
}

const CELL: Record<SituacaoAno, 'good' | 'bad' | 'unknown'> = {
  plantou: 'good',
  parado: 'bad',
  incerto: 'unknown',
  sem_dado: 'unknown',
}

/** Relatório para banco e seguro (P2): folha A4 para imprimir ou salvar em PDF. */
export function ReportView(props: ReportViewProps) {
  const { t, status, onRetry, backTo, talhao, recomendacao } = props
  return (
    <div className={layout.page}>
      <div className={`no-print ${styles.actions}`}>
        <BackLink to={backTo}>{t.nav.back}</BackLink>
        {status === 'ready' && (
          <div className={layout.cta}>
            <Button onClick={props.onPrint}>{t.report.savePdf}</Button>
          </div>
        )}
      </div>
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' && talhao && recomendacao && <Sheet {...props} talhao={talhao} recomendacao={recomendacao} />}
    </div>
  )
}

function Sheet({ t, lang, talhao, recomendacao: rec, example, place, today }: ReportViewProps & { talhao: Talhao; recomendacao: Recomendacao }) {
  const r = t.report
  const best = rec.opcoes.find((option) => option.id === rec.melhor)
  const sowing = formatFullDate(lang, rec.entrada.semeadura)
  const sections: { title: string; body: ReactNode }[] = [
    {
      title: r.place,
      body: (
        <>
          <p>{example ? t.method.exampleFarm : place ? t.where.near(place) : null}</p>
          <p>{r.coords(formatCoordinates(talhao.ponto))}</p>
          <p>{r.today(formatFullDate(lang, today))}</p>
          <p>{r.dataVersion(rec.versao_dados)}</p>
        </>
      ),
    },
    {
      title: r.best,
      body: (
        <>
          <p>
            <strong>{best?.nome}</strong>
          </p>
          <p>{best?.na_janela === false ? r.sowingOut(sowing) : r.sowing(sowing)}</p>
        </>
      ),
    },
    {
      title: r.table,
      body: (
        <table className={styles.table} aria-label={r.table}>
          <thead>
            <tr>
              <th scope="col">{r.headers.crop}</th>
              <th scope="col">{r.headers.years}</th>
              <th scope="col">{r.headers.margin}</th>
              <th scope="col">{r.headers.soil}</th>
            </tr>
          </thead>
          <tbody>
            {rec.opcoes.map((option) => (
              <tr key={option.id}>
                <th scope="row">{option.nome}</th>
                <td>{option.na_janela ? option.chuva.anos_bons : t.options.outOfWindowTitle}</td>
                <td>{formatCurrency(lang, option.dinheiro.margem_ha)}</td>
                <td>{option.terra.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
  ]
  if (rec.sinal) {
    const look = SIGNAL_LOOK[rec.sinal.nivel]
    sections.push({
      title: t.plan.signalTitle(harvestYear(rec.entrada.semeadura)),
      body: (
        <>
          <ToneBadge tone={look.tone} icon={look.icon}>
            {t.signal[rec.sinal.nivel]}
          </ToneBadge>
          <p>{rec.sinal.motivo}</p>
          <p>{t.plan.signalSource(formatDayMonth(lang, rec.sinal.data))}</p>
        </>
      ),
    })
  }
  if (talhao.historico) {
    sections.push({
      title: r.history,
      body: (
        <>
          <YearStrip
            size="lg"
            label={r.idle(talhao.historico.parado, talhao.historico.total)}
            cells={talhao.historico.anos.map((year) => CELL[year.situacao])}
            years={talhao.historico.anos.map((year) => String(year.ano))}
          />
          <p>{r.idle(talhao.historico.parado, talhao.historico.total)}</p>
        </>
      ),
    })
  }
  sections.push({ title: r.sources, body: <p>{reportSources(talhao, rec).join(' · ')}</p> })

  return (
    <article className={styles.sheet} aria-label={r.title}>
      <h1 className={styles.title}>{r.title}</h1>
      {sections.map((section, index) => (
        <section key={section.title} className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {index + 1}. {section.title}
          </h2>
          {section.body}
        </section>
      ))}
      <p className={styles.footer}>
        <em>{r.footer}</em>
      </p>
    </article>
  )
}
