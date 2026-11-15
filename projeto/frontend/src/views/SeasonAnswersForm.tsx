import { Link } from 'react-router'
import { CheckIcon } from '../design-system/icons'
import { formatDayMonth, formatDecimal, formatFullDate } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { CropId } from '../models/recomendacao'
import type { CurrentChoice, SeasonAnswer, SeasonAnswers, SeasonRow, SeasonSatellite } from '../models/seasonAnswers'
import { nextAfterAnswer, nextSoyAnswer, soyState } from '../services/seasonAnswersService'
import { afterSoyMonths, CURRENT_SEASON, seasonName, soyPeriod } from '../services/seasonService'
import styles from './SeasonAnswersForm.module.css'

/** As 6 opções do "depois da soja", na ordem do protótipo (ids do `culturas.yaml`). */
const OPTIONS: readonly CropId[] = ['milho_safrinha', 'milho_braquiaria', 'sorgo', 'milheto', 'crotalaria', 'pousio']

/** A linha da safra atual (2026/27): a soja não é perguntada, só o que o produtor pensa plantar depois. */
export type CurrentSeasonProps = {
  /** O `pensa` da URL: a "escolha atual" da tela 5. */
  choice: CurrentChoice | null | undefined
  /** Tocar de novo na opção marcada devolve `null`. */
  onChoose: (choice: CurrentChoice | null) => void
  /** A data da colheita escolhida na tela 2 (`data`, "AAAA-MM-DD"); sem ela, "no começo de 2027". */
  harvestDate?: string | null
  /** "Trocar data": o link para `/quando` com o fluxo; sem ele, o link não aparece. */
  changeDateTo?: string
}

export type SeasonAnswersFormProps = {
  t: Messages
  lang: Lang
  /** As safras passadas, em ordem (o padrão é `seasonRows(historico)`: 2023/24, 2024/25 e 2025/26). */
  seasons: readonly SeasonRow[]
  /** As respostas (o `safras` da URL, lido por `seasonAnswersFromFlow`). */
  answers: SeasonAnswers
  /** A nova resposta da safra; `null` = sem resposta (volta para o satélite). */
  onAnswer: (year: number, answer: SeasonAnswer | null) => void
  /** A linha da safra atual; ausente, a linha não aparece. */
  current?: CurrentSeasonProps | null
}

type Chip = { key: string; label: string; pressed: boolean; tone?: 'fallow' | 'unsure'; onClick: () => void }

function Chips({ label, chips, disabled = false }: { label: string; chips: readonly Chip[]; disabled?: boolean }) {
  return (
    <div role="group" aria-label={label} className={styles.chips}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={styles.chip}
          data-tone={chip.tone}
          aria-pressed={chip.pressed}
          disabled={disabled}
          onClick={chip.onClick}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}

function satelliteHint(t: Messages, lang: Lang, satellite: SeasonSatellite | null): string | null {
  if (!satellite) return null
  const s = t.seasons
  if (!satellite.soy) return s.satelliteNoSoy
  const seen = satellite.after === 'plantou' ? s.satellitePlanted : satellite.after === 'parado' ? s.satelliteFallow : s.satelliteSoy
  return satellite.ndvi === null || satellite.after === null ? seen : `${seen} · ${s.green(formatDecimal(lang, satellite.ndvi, 2))}`
}

function PastSeason({ t, lang, row, answer, onAnswer }: { t: Messages; lang: Lang; row: SeasonRow; answer: SeasonAnswer | undefined; onAnswer: SeasonAnswersFormProps['onAnswer'] }) {
  const s = t.seasons
  const name = seasonName(row.year)
  const soy = soyState(answer, row.satellite)
  const hint = satelliteHint(t, lang, row.satellite)
  const noSoy = soy === 'nao'
  const soyChips: Chip[] = [
    { key: 'sim', label: s.planted, pressed: soy === 'sim', onClick: () => onAnswer(row.year, nextSoyAnswer(answer, 'sim')) },
    { key: 'nao', label: s.notPlanted, pressed: soy === 'nao', onClick: () => onAnswer(row.year, nextSoyAnswer(answer, 'nao')) },
  ]
  const afterChips: Chip[] = OPTIONS.map((crop) => ({
    key: crop,
    label: s.options[crop],
    pressed: answer === crop,
    tone: crop === 'pousio' ? 'fallow' : undefined,
    onClick: () => onAnswer(row.year, nextAfterAnswer(answer, crop)),
  }))
  return (
    <div className={styles.row}>
      <p className={styles.season}>
        <span className={styles.seasonName}>{name}</span>
        {hint && <small className={styles.hint}>{hint}</small>}
      </p>
      <div className={styles.question}>
        <span className={styles.questionLabel}>{s.colSoy}</span>
        <span className={styles.caption}>{soyPeriod(row.year, lang)}</span>
        <Chips label={s.groupSoy(name)} chips={soyChips} />
      </div>
      <div className={styles.question}>
        <span className={styles.questionLabel}>{s.colAfter}</span>
        <span className={styles.caption}>{noSoy ? s.noSoyAfter : s.afterQuestion(afterSoyMonths(row.year, lang))}</span>
        <Chips label={s.groupAfter(name)} chips={afterChips} disabled={noSoy} />
      </div>
    </div>
  )
}

function CurrentSeason({ t, lang, current }: { t: Messages; lang: Lang; current: CurrentSeasonProps }) {
  const s = t.seasons
  const name = seasonName(CURRENT_SEASON)
  const year = String(CURRENT_SEASON)
  const date = current.harvestDate ?? null
  const choose = (choice: CurrentChoice) => current.onChoose(current.choice === choice ? null : choice)
  const chips: Chip[] = [
    ...OPTIONS.map(
      (crop): Chip => ({
        key: crop,
        label: crop === 'pousio' ? s.fallowFuture : s.options[crop],
        pressed: current.choice === crop,
        tone: crop === 'pousio' ? 'fallow' : undefined,
        onClick: () => choose(crop),
      }),
    ),
    { key: 'nao_sei', label: s.notSure, pressed: current.choice === 'nao_sei', tone: 'unsure', onClick: () => choose('nao_sei') },
  ]
  return (
    <div className={styles.row} data-current="">
      <p className={styles.season}>
        <span className={styles.seasonName}>{name}</span>
        <small className={styles.currentTag}>{s.currentTag}</small>
      </p>
      <div className={styles.question}>
        <span className={styles.questionLabel}>{s.colSoy}</span>
        <p className={styles.soyPlanted}>
          <CheckIcon size={16} />
          <span>
            <b>{s.soyPlanted}</b>
            <span>{date ? s.harvestExpected(formatFullDate(lang, date)) : s.harvestExpectedEarly(year)}</span>
            {current.changeDateTo && (
              <Link to={current.changeDateTo} className={styles.changeDate}>
                {s.changeDate}
              </Link>
            )}
          </span>
        </p>
      </div>
      <div className={styles.question}>
        <span className={styles.questionLabel}>{s.colAfter}</span>
        <span className={styles.caption}>
          {date ? s.currentQuestion(formatDayMonth(lang, date), year) : s.currentQuestionNoDate(year)}
        </span>
        <Chips label={s.groupCurrent(name)} chips={chips} />
      </div>
    </div>
  )
}

/**
 * "Confirme as últimas safras" (pacote 2, tarefa 0054): o formulário da tela 4, que a tela 5 também abre no
 * modal "Preencher agora". Componente controlado: recebe as respostas e devolve cada mudança, sem buscar
 * dados (a regra fica no `seasonAnswersService`). Uma linha por safra passada (Safra · Soja · Depois da soja)
 * e, se houver `current`, a linha da safra atual. Quando o espaço é estreito (celular ou modal), as perguntas
 * ficam uma embaixo da outra. As linhas e os botões têm `key` estável: clicar só troca o `aria-pressed`.
 */
export function SeasonAnswersForm({ t, lang, seasons, answers, onAnswer, current }: SeasonAnswersFormProps) {
  const s = t.seasons
  return (
    <div className={styles.form}>
      <div className={styles.table}>
        <div className={styles.head} aria-hidden="true">
          <span>{s.colSeason}</span>
          <span>{s.colSoy}</span>
          <span>{s.colAfter}</span>
        </div>
        {seasons.map((row) => (
          <PastSeason key={row.year} t={t} lang={lang} row={row} answer={answers[row.year]} onAnswer={onAnswer} />
        ))}
        {current && <CurrentSeason t={t} lang={lang} current={current} />}
      </div>
    </div>
  )
}
