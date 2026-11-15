import type { ComponentProps, ReactNode } from 'react'
import { ChipGroup, DateField, MeasureField } from '../design-system/components/Choice'
import { ShieldIcon, UncertainIcon, WarningIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import { CULTURAS_RELATO, EVENTOS, MOTIVOS, RESULTADOS, type CulturaRelato } from '../models/community'
import type { EventDraft, PlantingDraft, RainDraft, ReportErrorKind } from '../services/communityService'
import styles from './CommunityView.module.css'

/**
 * Botões de escolha com a pergunta em texto visível em cima (lida também pelo "Ouvir"); o grupo leva o
 * mesmo nome para o leitor de tela.
 */
function QuestionChips<T extends string>(props: ComponentProps<typeof ChipGroup<T>>) {
  return (
    <div className={styles.field}>
      <p className={styles.question} aria-hidden="true">
        {props.label}
      </p>
      <ChipGroup {...props} />
    </div>
  )
}

/** Campos do relato de plantio, usados na tela "Na sua região" e no "Compartilhar" da tela 4. */
export function PlantingFields({
  t,
  draft,
  years,
  crops = CULTURAS_RELATO,
  onChange,
}: {
  t: Messages
  draft: PlantingDraft
  /** Safras para escolher; vazio = a safra já está decidida (ex.: a que o produtor confirmou). */
  years: readonly number[]
  /** Culturas oferecidas; uma só = já escolhida (ex.: "Deixei parado" confirmado na tela 4). */
  crops?: readonly CulturaRelato[]
  onChange: (change: Partial<PlantingDraft>) => void
}) {
  const c = t.community
  return (
    <>
      {crops.length > 1 && (
        <QuestionChips
          label={c.cropLabel}
          options={crops.map((crop) => ({ value: crop, label: c.reportCrops[crop] }))}
          value={draft.crop}
          onChange={(crop) => onChange({ crop })}
        />
      )}
      {years.length > 0 && (
        <QuestionChips
          label={c.yearLabel}
          options={years.map((year) => ({ value: String(year), label: String(year) }))}
          value={draft.year === null ? null : String(draft.year)}
          onChange={(year) => onChange({ year: year === null ? null : Number(year) })}
        />
      )}
      {draft.crop !== 'pousio' && (
        <QuestionChips
          label={c.outcomeLabel}
          options={RESULTADOS.map((outcome) => ({ value: outcome, label: c.outcomes[outcome] }))}
          value={draft.outcome}
          onChange={(outcome) => onChange({ outcome })}
        />
      )}
      {draft.crop !== 'pousio' && draft.outcome === 'perdi' && (
        <QuestionChips
          label={c.reasonLabel}
          options={MOTIVOS.map((reason) => ({ value: reason, label: c.reasons[reason] }))}
          value={draft.reason}
          onChange={(reason) => onChange({ reason })}
        />
      )}
    </>
  )
}

export function RainFields({
  t,
  draft,
  bounds,
  onChange,
}: {
  t: Messages
  draft: RainDraft
  bounds: { min: string; max: string }
  onChange: (change: Partial<RainDraft>) => void
}) {
  const c = t.community
  return (
    <>
      <MeasureField label={c.mmLabel} value={draft.mm} unit={c.mmUnit} hint={c.mmHint} onChange={(mm) => onChange({ mm })} />
      <DateField label={c.dateLabel} value={draft.date} min={bounds.min} max={bounds.max} onChange={(date) => onChange({ date })} />
      <p className={styles.hint}>{c.dateHint}</p>
    </>
  )
}

export function EventFields({
  t,
  draft,
  bounds,
  fireCall,
  onChange,
}: {
  t: Messages
  draft: EventDraft
  bounds: { min: string; max: string }
  fireCall: boolean
  onChange: (change: Partial<EventDraft>) => void
}) {
  const c = t.community
  return (
    <>
      <QuestionChips
        label={c.eventLabel}
        options={EVENTOS.map((event) => ({ value: event, label: c.events[event] }))}
        value={draft.event}
        onChange={(event) => onChange({ event })}
      />
      {fireCall && (
        <div role="alert" className={styles.fire}>
          <WarningIcon size={20} />
          <span>{c.fireCall}</span>
          <a className={styles.fireLink} href="tel:193">
            {c.fireCallButton}
          </a>
        </div>
      )}
      <DateField label={c.dateLabel} value={draft.date} min={bounds.min} max={bounds.max} onChange={(date) => onChange({ date })} />
      <p className={styles.hint}>{c.dateHint}</p>
    </>
  )
}

/** "Seus vizinhos veem a região, não o seu ponto.": antes do primeiro envio. */
export function PrivacyNotice({ t }: { t: Messages }) {
  return (
    <p className={styles.privacy}>
      <ShieldIcon size={18} />
      {t.community.privacyNotice}
    </p>
  )
}

/** O resultado do envio: confirmação (status) ou o motivo da falha (alert). */
export function SendResult({ t, result, sentText }: { t: Messages; result: 'sent' | ReportErrorKind | null; sentText?: string }) {
  const c = t.community
  if (result === null) return null
  if (result === 'sent') {
    return (
      <p role="status" className={styles.sent}>
        {sentText ?? c.sent}
      </p>
    )
  }
  const message = result === 'limit' ? c.errorLimit : result === 'invalid' ? c.errorInvalid : c.errorOther
  return (
    <p role="alert" className={styles.failed}>
      {message}
    </p>
  )
}

/** Selo em cada relato: "Relato de vizinho, não confirmado" (e "Exemplo" nos dados de demonstração). */
export function ReportBadges({ t, example }: { t: Messages; example: boolean }): ReactNode {
  return (
    <span className={styles.badges}>
      <span className={styles.badge}>
        <UncertainIcon size={14} />
        {t.community.unconfirmed}
      </span>
      {example && <span className={styles.badgeExample}>{t.community.example}</span>}
    </span>
  )
}
