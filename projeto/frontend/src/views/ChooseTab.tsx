import type { ReactNode } from 'react'
import { CompareCards } from '../design-system/components/CompareCards'
import { PlantPhoto } from '../design-system/components/PlantPhoto'
import { StatusPill } from '../design-system/components/Status'
import { ArrowRightIcon, ChevronRightIcon, GrainIcon, ShieldIcon, SproutIcon } from '../design-system/icons'
import { plantPhotoProps } from '../content/plantPhotos'
import { COMPARE_ROWS, type ChoosePlanState, type CompareColumn, type CompareRow } from '../controllers/useChoosePlanController'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { OBJETIVOS, type CropId, type Objetivo } from '../models/recomendacao'
import { CURRENT_SEASON, seasonName } from '../services/seasonService'
import { consTexts, cropName, deadlineText, futureTexts, prosTexts, suggestionLine, waterTexts } from './choiceTexts'
import styles from './ChoosePlanView.module.css'

type Choose = NonNullable<ChoosePlanState['choose']>

export type ChooseTabProps = { t: Messages; lang: Lang; state: ChoosePlanState; choose: Choose }

const OBJECTIVE_ICON: Record<Objetivo, ReactNode> = {
  seguranca: <ShieldIcon size={20} />,
  renda: <GrainIcon size={20} />,
  terra: <SproutIcon size={20} />,
}

export function Tag({ kind, children }: { kind: 'suggestion' | 'choice' | 'late' | 'changed'; children: ReactNode }) {
  return (
    <span className={styles.tag} data-kind={kind}>
      {children}
    </span>
  )
}

/** Aba "1. Escolher": o que você quer mais, a sugestão, o "Comparar até 3" e a escolha do 1º ano do plano. */
export function ChooseTab({ t, lang, state, choose }: ChooseTabProps) {
  const c = t.choose
  return (
    <>
      <Objective t={t} state={state} />
      <SuggestionCard t={t} lang={lang} state={state} choose={choose} />
      <section aria-labelledby="comparar-titulo" className={styles.compare}>
        <div className={styles.sectionHead}>
          <h2 id="comparar-titulo" className={styles.sectionTitle}>
            {c.compare.title}
          </h2>
          <p>{c.compare.sub}</p>
        </div>
        <Picker t={t} state={state} choose={choose} />
        <CompareCards
          label={c.compare.region}
          rowLabels={COMPARE_ROWS.map((row) => c.compare.rows[row])}
          hint={c.compare.swipe}
          cards={choose.columns.map((column) => ({
            key: column.id,
            label: cropName(t, column.id),
            highlighted: column.id === choose.choice,
            header: <ColumnHead t={t} lang={lang} column={column} choose={choose} />,
            cells: COMPARE_ROWS.map((row) => <Cell key={row} t={t} lang={lang} state={state} column={column} row={row} />),
            footer: <ChooseButton t={t} state={state} crop={column.id} chosen={column.id === choose.own} />,
          }))}
        />
        <div className={styles.next}>
          <p>
            {c.compare.nextLead(seasonName(CURRENT_SEASON))} <strong>{cropName(t, choose.choice)}</strong>.
          </p>
          <button type="button" className={styles.primary} onClick={state.goToPlan}>
            {c.compare.goPlan}
            <ArrowRightIcon size={18} />
          </button>
        </div>
      </section>
    </>
  )
}

/** "O que você quer mais?": 3 botões iguais; tocar de novo tira a escolha (equilíbrio). */
function Objective({ t, state }: { t: Messages; state: ChoosePlanState }) {
  const o = t.choose.objective
  return (
    <section className={styles.prefs} aria-labelledby="prefs-titulo">
      <div>
        <h2 id="prefs-titulo" className={styles.prefsTitle}>
          {o.title}
        </h2>
        <p className={styles.prefsNote}>{o.note}</p>
      </div>
      <div role="group" aria-labelledby="prefs-titulo" className={styles.seg}>
        {OBJETIVOS.map((value) => {
          const pressed = state.objective === value
          return (
            <button
              key={value}
              type="button"
              className={styles.segButton}
              aria-pressed={pressed}
              onClick={() => state.chooseObjective(pressed ? null : value)}
            >
              {OBJECTIVE_ICON[value]}
              <span>{o[value]}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Cartão "Nossa sugestão": foto, frase do porquê, 3 números, o modal grande e "Usar no meu plano". */
function SuggestionCard({ t, lang, state, choose }: ChooseTabProps) {
  const c = t.choose
  const option = choose.suggestion
  const inPlan = choose.choice === option.id
  return (
    <article className={styles.suggestion} aria-labelledby="sugestao-nome">
      <PlantPhoto {...plantPhotoProps(option.id, lang)} height={150} className={styles.suggestionPhoto} />
      <div className={styles.suggestionBody}>
        <Tag kind="suggestion">{c.tags.suggestion}</Tag>
        <h2 id="sugestao-nome" className={styles.suggestionName}>
          {cropName(t, option.id)}
        </h2>
        <p>{suggestionLine(t, option)}</p>
        <p className={styles.suggestionNumbers}>
          <strong>{c.card.worked(option.chuva.anos_bons, option.chuva.anos)}</strong>
          {option.agua && <span>{t.suggestion.thirst[option.agua.sede]}</span>}
          <span>{option.renda.da_grao ? c.card.grain : c.card.noGrain}</span>
        </p>
      </div>
      <div className={styles.suggestionActions}>
        <button type="button" className={styles.blue} aria-haspopup="dialog" onClick={state.why.onOpen}>
          {c.card.why}
          <ChevronRightIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.secondary}
          aria-pressed={inPlan}
          data-done={inPlan ? '' : undefined}
          onClick={() => state.chooseForPlan(option.id)}
        >
          {inPlan ? c.card.inPlan : c.card.use}
        </button>
      </div>
    </article>
  )
}

/** "Comparar:": as 6 culturas como caixinhas, com as etiquetas; até 3 e pelo menos 1. */
function Picker({ t, state, choose }: { t: Messages; state: ChoosePlanState; choose: Choose }) {
  const c = t.choose
  return (
    <fieldset className={styles.picker}>
      <legend className={styles.pickerLegend}>{c.compare.pickLabel}</legend>
      <div className={styles.pickerItems}>
        {choose.picker.map((item) => (
          <label key={item.id} className={styles.pick} data-selected={item.selected ? '' : undefined} data-disabled={item.disabled ? '' : undefined}>
            <input type="checkbox" checked={item.selected} disabled={item.disabled} onChange={() => state.toggleCompared(item.id)} />
            <span className={styles.pickName}>{cropName(t, item.id)}</span>{' '}
            {(item.choice || item.suggestion || item.late) && (
              <span className={styles.pickTags}>
                {[
                  item.choice && { kind: 'choice', text: c.pickerTags.choice },
                  item.suggestion && { kind: 'suggestion', text: c.pickerTags.suggestion },
                  item.late && { kind: 'late', text: c.pickerTags.late },
                ]
                  .filter((tag) => tag !== false)
                  .map((tag, index) => (
                    <small key={tag.kind} data-kind={tag.kind}>
                      {index > 0 ? ' ' : ''}
                      {tag.text}
                    </small>
                  ))}
              </span>
            )}
          </label>
        ))}
      </div>
      <p className={styles.hint}>{c.compare.pickHint}</p>
    </fieldset>
  )
}

function ColumnHead({ t, lang, column, choose }: { t: Messages; lang: Lang; column: CompareColumn; choose: Choose }) {
  const c = t.choose
  const late = choose.late.has(column.id)
  return (
    <div className={styles.columnHead}>
      <PlantPhoto {...plantPhotoProps(column.id, lang)} height={120} className={styles.columnPhoto} />
      <div className={styles.tags}>
        {column.id === choose.own && <Tag kind="choice">{c.tags.choice}</Tag>}
        {column.id === choose.suggestion.id && <Tag kind="suggestion">{c.tags.suggestion}</Tag>}
        {late && <Tag kind="late">{c.tags.late}</Tag>}
      </div>
      <h3 className={styles.columnName}>{cropName(t, column.id)}</h3>
    </div>
  )
}

/** O que a célula mostra (o mesmo número abre o modal com a conta e a fonte). */
function cellContent(t: Messages, lang: Lang, state: ChoosePlanState, column: CompareColumn, row: CompareRow): ReactNode {
  const c = t.choose.compare
  const option = column.option
  if (row === 'pros' || row === 'cons') {
    const items = row === 'pros' ? prosTexts(t, option) : consTexts(t, lang, option)
    return items.length ? (
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : (
      <span className={styles.muted}>{c.nothing}</span>
    )
  }
  if (!option) {
    if (row === 'income') return <strong>{t.choose.card.noGrain}</strong>
    if (row === 'soil') return <span>{state.pousioText}</span>
    if (row === 'deadline') return <span>{c.noDeadline}</span>
    return <span className={styles.muted}>{c.noCrop}</span>
  }
  if (row === 'worked') {
    return (
      <>
        <strong>{c.worked(option.chuva.anos_bons, option.chuva.anos)}</strong>
        <StatusPill rotulo={option.chuva.rotulo}>{t.labels[option.chuva.rotulo]}</StatusPill>
      </>
    )
  }
  if (row === 'water') {
    const water = waterTexts(t, lang, option)
    return water ? (
      <>
        <strong>{water.main}</strong>
        <span>{water.dry}</span>
      </>
    ) : null
  }
  if (row === 'future') {
    const future = futureTexts(t, option)
    return future ? (
      <>
        <strong>{future.main}</strong>
        <span>{future.range}</span>
      </>
    ) : null
  }
  if (row === 'income') {
    return (
      <>
        <strong>{option.renda.texto}</strong>
        <span>{option.renda.risco}</span>
        <StatusPill rotulo={option.renda.rotulo}>{t.labels[option.renda.rotulo]}</StatusPill>
      </>
    )
  }
  if (row === 'soil') {
    return (
      <>
        <span>{option.terra.texto}</span>
        <StatusPill rotulo={option.terra.rotulo}>{t.labels[option.terra.rotulo]}</StatusPill>
      </>
    )
  }
  const deadline = deadlineText(t, lang, option)
  return (
    <strong className={deadline.late ? styles.lateText : undefined} data-late={deadline.late ? '' : undefined}>
      {deadline.text}
    </strong>
  )
}

/** Uma célula: botão que abre o modal; o nome da linha vai junto (visível só no celular). */
function Cell({ t, lang, state, column, row }: { t: Messages; lang: Lang; state: ChoosePlanState; column: CompareColumn; row: CompareRow }) {
  const content = cellContent(t, lang, state, column, row)
  const label = t.choose.compare.rows[row]
  if (content === null) {
    return (
      <span className={styles.cellEmpty}>
        <span className={styles.rowName}>{label}</span>–
      </span>
    )
  }
  return (
    <button type="button" className={styles.cell} aria-haspopup="dialog" onClick={() => state.cell.onOpen(column.id, row)}>
      <span className={styles.rowName}>{label}</span>
      <span className={styles.cellValue}>{content}</span>
      <span className={styles.more} aria-hidden="true">
        {t.choose.compare.details}
        <ChevronRightIcon size={13} />
      </span>
    </button>
  )
}

/** "Essa é a escolha para o meu plano" (escolha única): o mesmo tamanho marcado ou não. */
function ChooseButton({ t, state, crop, chosen }: { t: Messages; state: ChoosePlanState; crop: CropId; chosen: boolean }) {
  const c = t.choose.compare
  return (
    <button type="button" className={styles.choose} aria-pressed={chosen} onClick={() => state.chooseForPlan(crop)}>
      <span className={styles.radio} aria-hidden="true" />
      {chosen ? c.chosen : c.choose}
    </button>
  )
}
