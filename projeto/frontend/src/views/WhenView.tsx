import { useId, useRef, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import type { BandsModalState, DetailsModalState } from '../controllers/useWhenController'
import { BackButton } from '../design-system/components/BackButton'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { Modal } from '../design-system/components/Modal'
import { ArrowRightIcon, CalendarIcon, CheckIcon, DropIcon, WarningIcon } from '../design-system/icons'
import { formatCalendarMonth, formatFullDate, formatNumber, formatWeekday } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { COLHEITAS } from '../models/talhao'
import type { HarvestBand } from '../services/harvestBandsService'
import type { HarvestChoice, HarvestWindow } from '../services/harvestService'
import type { RainChart } from '../services/monthlyRainService'
import type { RainEnd, RainLeft, RainLeftCurve } from '../services/rainLeftService'
import { WhenDetails } from './WhenDetails'
import styles from './WhenView.module.css'

export type WhenViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  listen: ListenSummaryState
  /** O campo de data (de 1/jan a 30/abr de 2027). */
  window: HarvestWindow
  /** A data (e a época dela) ou só a época; null = nada escolhido. */
  choice: HarvestChoice | null
  onPickDate: (value: string) => void
  canContinue: boolean
  onConfirm: () => void
  /** O satélite não viu soja no ponto: aviso laranja com "Conferir no mapa". */
  notSoy: boolean
  bands: readonly HarvestBand[]
  rainCurve: RainLeftCurve | null
  rainLeft: RainLeft | null
  rainChart: RainChart | null
  rainEnd: RainEnd | null
  heatC: number | null
  /** O talhão ainda carrega: a caixa "Ainda não decidiu?" aparece sem a prévia. */
  loading: boolean
  bandsModal: BandsModalState
  details: DetailsModalState
}

type CardState = 'empty' | 'band' | 'date'

/** Abre o calendário do aparelho; sem `showPicker` (navegador antigo), foca e clica no campo. */
function openPicker(input: HTMLInputElement | null) {
  if (!input) return
  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
  } catch {
    // Sem permissão para abrir o calendário assim: cai no foco + clique, como um toque no campo.
  }
  input.focus()
  input.click()
}

/** Cartão "Dia da colheita": sem data, com a época ou com a data; "Não sei o dia exato" no canto. */
function HarvestCard({ t, lang, window, choice, onPickDate, bandsModal }: WhenViewProps) {
  const w = t.when
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const state: CardState = !choice ? 'empty' : choice.date ? 'date' : 'band'
  const date = choice?.date ?? null

  let month = '– –'
  let day = '?'
  let title = w.emptyTitle
  let hint = w.emptyHint
  let button = w.pickDate
  if (choice && date) {
    month = formatCalendarMonth(lang, date)
    day = String(Number(date.slice(8, 10)))
    title = formatFullDate(lang, date)
    hint = formatWeekday(lang, date)
    button = w.changeDate
  } else if (choice) {
    month = formatCalendarMonth(lang, `${window.min.slice(0, 4)}-02-01`)
    day = w.bandDays[choice.band]
    title = t.harvest[choice.band].title
    hint = w.bandHint
    button = w.pickDay
  }

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.cardLabel}>{w.dateLabel}</div>
      <div className={styles.cardBody}>
        <div className={styles.calendar} data-state={state} aria-hidden="true">
          <span className={styles.calMonth}>{month}</span>
          <span className={styles.calDay}>{day}</span>
        </div>
        <div className={styles.cardText} aria-live="polite">
          <h2 id={titleId} className={styles.cardTitle}>
            {title}
          </h2>
          <p className={styles.cardHint}>{hint}</p>
          {choice && date && (
            <span className={styles.badge}>
              <CheckIcon size={13} />
              {t.harvest[choice.band].title}
            </span>
          )}
        </div>
      </div>
      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.dateButton}
          data-filled={state === 'empty'}
          onClick={() => openPicker(inputRef.current)}
        >
          <CalendarIcon size={17} />
          <span>{button}</span>
        </button>
        <button type="button" className={styles.dontKnow} aria-haspopup="dialog" onClick={bandsModal.onOpen}>
          {w.dontKnow}
        </button>
      </div>
      {/* O calendário do próprio aparelho, aberto pelo botão (fica escondido, perto do canto do cartão). */}
      <input
        ref={inputRef}
        type="date"
        className={styles.dateInput}
        min={window.min}
        max={window.max}
        value={date ?? ''}
        onChange={(event) => onPickDate(event.target.value)}
        aria-label={w.dateLabel}
        aria-hidden="true"
        tabIndex={-1}
      />
    </section>
  )
}

/** Caixa "Ainda não decidiu? Veja nossas sugestões": inteira clicável, abre o modal grande. */
function HelpBox({ t, lang, bands, rainCurve, details }: WhenViewProps) {
  const w = t.when
  const titleId = useId()
  const preview = rainCurve && bands.some((band) => band.rainMm !== null) ? rainCurve.maxMm : null
  return (
    <section className={styles.help} aria-labelledby={titleId}>
      <span className={styles.helpEyebrow}>
        <span className={styles.helpIcon}>
          <DropIcon size={16} />
        </span>
        {w.helpEyebrow}
      </span>
      <h2 id={titleId} className={styles.helpTitle}>
        {w.helpTitle}
      </h2>
      <p className={styles.helpText}>{w.helpText}</p>
      {preview !== null && (
        <div className={styles.preview}>
          <span className={styles.previewTitle}>{w.previewTitle}</span>
          <ul className={styles.previewList}>
            {bands.map((band) => (
              <li key={band.band} className={styles.previewRow} data-yours={band.yours}>
                <span>{w.bandShort[band.band]}</span>
                <span className={styles.previewTrack} aria-hidden="true">
                  <i style={{ width: `${band.rainMm === null ? 0 : Math.min(100, Math.round((band.rainMm / preview) * 100))}%` }} />
                </span>
                <b>{band.rainMm === null ? '' : `${formatNumber(lang, band.rainMm)} mm`}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      <span className={styles.helpSpacer} />
      <button type="button" className={styles.helpButton} aria-haspopup="dialog" onClick={details.onOpen}>
        <span>{w.helpButton}</span>
        <ArrowRightIcon size={17} />
      </button>
    </section>
  )
}

/** Modal "Não sei o dia exato": as 3 épocas, nenhuma marcada; "Usar esta época" só liga depois de escolher. */
function BandsModal({ t, bandsModal }: Pick<WhenViewProps, 't' | 'bandsModal'>) {
  const w = t.when
  const name = useId()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    bandsModal.onSubmit()
  }
  return (
    <Modal open={bandsModal.open} onClose={bandsModal.onClose} title={w.bandsTitle} subtitle={w.bandsSubtitle} closeLabel={t.common.close}>
      <form onSubmit={submit}>
        <fieldset className={styles.options}>
          <legend className="visually-hidden">{w.bandsTitle}</legend>
          {COLHEITAS.map((band) => (
            <label key={band} className={styles.option}>
              <input
                type="radio"
                name={name}
                value={band}
                checked={bandsModal.draft === band}
                onChange={() => bandsModal.onDraft(band)}
              />
              <span className={styles.optionDot} aria-hidden="true" />
              <span className={styles.optionText}>
                <b>{t.harvest[band].title}</b> <small>{w.bandSub[band]}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <p className={styles.note}>{w.bandsNote}</p>
        <button type="submit" className={styles.useBand} disabled={!bandsModal.draft}>
          {w.useBand}
        </button>
      </form>
    </Modal>
  )
}

/**
 * Tela 2 "Quando você colhe a soja?" (pacote 2, tarefa 0057). No computador, duas colunas da mesma altura: o
 * cartão "Dia da colheita" com o "Próximo passo" embaixo e a caixa "Ainda não decidiu?", com os dois botões
 * terminando na mesma linha. No celular, uma coluna e o "Próximo passo" preso embaixo, com a data escolhida.
 */
export function WhenView(props: WhenViewProps) {
  const { t, lang, backTo, listen, choice, canContinue, notSoy, details } = props
  const w = t.when
  const hasDetails =
    props.bands.some((band) => band.rainMm !== null || band.best !== null) ||
    props.rainCurve !== null ||
    Boolean(props.rainChart?.eto) ||
    props.rainEnd !== null
  const barText = !choice
    ? w.barEmpty
    : choice.date
      ? formatFullDate(lang, choice.date)
      : t.harvest[choice.band].title

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <BackButton to={backTo}>{t.nav.back}</BackButton>
      </div>
      <h1 className={styles.title}>{w.title}</h1>
      <div className={styles.sub}>
        <p>{w.lead}</p>
        <ListenSummary
          supported={listen.supported}
          speaking={listen.speaking}
          onToggle={listen.toggle}
          label={w.listenSummary}
          stopLabel={w.stopListening}
        />
      </div>

      <div className={styles.grid}>
        <div className={styles.dateColumn}>
          <HarvestCard {...props} />
          {notSoy && (
            <p className={styles.notSoy} role="note">
              <WarningIcon size={18} />
              <span>
                {w.notSoy} <Link to={backTo}>{w.notSoyLink}</Link>
              </span>
            </p>
          )}
          <div className={styles.confirmBlock}>
            <p className={styles.barLine} data-empty={!choice} aria-hidden="true">
              <CalendarIcon size={16} />
              <span>{barText}</span>
            </p>
            <button type="button" className={styles.confirm} disabled={!canContinue} onClick={props.onConfirm}>
              <span className={styles.confirmText}>
                <b>{w.nextStep}</b> <small>{w.cta}</small>
              </span>
              <ArrowRightIcon size={20} />
            </button>
            <p className={styles.reason}>{canContinue ? '' : w.needChoice}</p>
          </div>
        </div>
        {(props.loading || hasDetails) && <HelpBox {...props} />}
      </div>

      <BandsModal t={t} bandsModal={props.bandsModal} />
      <Modal
        open={details.open}
        onClose={details.onClose}
        title={w.detailsTitle}
        subtitle={w.detailsLead}
        closeLabel={t.common.close}
        size="large"
      >
        <WhenDetails
          t={t}
          lang={lang}
          choice={choice}
          bands={props.bands}
          rainCurve={props.rainCurve}
          rainLeft={props.rainLeft}
          rainChart={props.rainChart}
          rainEnd={props.rainEnd}
          heatC={props.heatC}
          onUseBand={details.onUseBand}
        />
      </Modal>
    </div>
  )
}
