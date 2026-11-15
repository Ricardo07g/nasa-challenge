import type { CropId } from '../models/recomendacao'
import type {
  CurrentChoice,
  SeasonAnswer,
  SeasonAnswers,
  SeasonRow,
  SeasonSatellite,
} from '../models/seasonAnswers'
import type { Confirmacao, Historico } from '../models/talhao'
import { formatConfirmadas, parseConfirmadas } from './confirmedSeasonsService'
import { CROP_IDS, parseToday } from './cropListParams'
import type { FlowParams } from './flowParams'
import { LAST_SEASONS } from './seasonService'

/**
 * Respostas das últimas safras (pacote 2, tarefa 0054): o que o produtor fez nas 3 safras passadas e o que
 * pensa plantar na atual. É a regra que as telas 4 e 5 usam juntas (o formulário `SeasonAnswersForm` só
 * desenha). Na URL: `safras=2024:milho_braquiaria,2025:pousio,2026:sem_soja` e `pensa=sorgo|nao_sei`,
 * sem codificar `:` e `,`, para o link continuar legível. O ano é o da colheita da soja.
 */

const isCrop = (value: string): value is CropId => (CROP_IDS as readonly string[]).includes(value)

const isAnswer = (value: string): value is SeasonAnswer => isCrop(value) || value === 'soja' || value === 'sem_soja'

const PAIR = /^(\d{4}):([a-z_]+)$/

/** `"2024:sorgo,2026:sem_soja"` → `{ 2024: 'sorgo', 2026: 'sem_soja' }`; pedaço fora do formato fica de fora. */
export function parseSeasonAnswers(text: string | null | undefined): SeasonAnswers {
  const result: Partial<Record<number, SeasonAnswer>> = {}
  for (const piece of (text ?? '').split(',')) {
    const match = PAIR.exec(piece.trim())
    if (match && isAnswer(match[2])) result[Number(match[1])] = match[2]
  }
  return result
}

function entries(answers: SeasonAnswers): [number, SeasonAnswer][] {
  return Object.entries(answers)
    .filter((entry): entry is [string, SeasonAnswer] => entry[1] !== undefined)
    .map(([year, value]): [number, SeasonAnswer] => [Number(year), value])
    .sort((a, b) => a[0] - b[0])
}

/** O formato da URL, em ordem de ano; sem nenhuma resposta, `undefined` (o parâmetro some). */
export function formatSeasonAnswers(answers: SeasonAnswers): string | undefined {
  const list = entries(answers)
  return list.length ? list.map(([year, value]) => `${year}:${value}`).join(',') : undefined
}

/** Marca a resposta do ano; `null` tira a resposta (o ano volta a ficar indefinido). */
export function withSeasonAnswer(answers: SeasonAnswers, year: number, value: SeasonAnswer | null): SeasonAnswers {
  const next: Partial<Record<number, SeasonAnswer>> = { ...answers }
  if (value === null) delete next[year]
  else next[year] = value
  return next
}

/** `pensa`: uma cultura (com o pousio) ou `nao_sei`; o resto vira indefinido. */
export function parseCurrentChoice(text: string | null | undefined): CurrentChoice | undefined {
  if (!text) return undefined
  return text === 'nao_sei' || isCrop(text) ? text : undefined
}

export function formatCurrentChoice(choice: CurrentChoice | null | undefined): string | undefined {
  return choice ?? undefined
}

/** A cultura da "escolha atual" (tela 5); "Ainda não sei" e sem resposta = null (a tela usa a sugestão). */
export function currentChoiceCrop(choice: CurrentChoice | null | undefined): CropId | null {
  return choice && choice !== 'nao_sei' ? choice : null
}

/** A safra está respondida: com a cultura do depois ou com "Não plantei" (só "Plantei" ainda falta o depois). */
const isComplete = (answer: SeasonAnswer | undefined) => answer !== undefined && answer !== 'soja'

/** Quantas das safras pedidas (as 3 últimas, por padrão) estão respondidas. */
export function answeredCount(answers: SeasonAnswers, years: readonly number[] = LAST_SEASONS): number {
  return years.filter((year) => isComplete(answers[year])).length
}

/**
 * O `confirmadas` que o `/api/recomendacao` aceita hoje (tarefa 0039): outra cultura = `plantou`, `pousio` =
 * `parado`; `soja` e `sem_soja` ficam sem confirmação (vale o satélite). No formato da URL, ou `undefined`.
 */
export function confirmadasFromAnswers(answers: SeasonAnswers): string | undefined {
  const confirmadas: Partial<Record<number, Confirmacao>> = {}
  for (const [year, value] of entries(answers)) {
    if (value === 'pousio') confirmadas[year] = 'parado'
    else if (isCrop(value)) confirmadas[year] = 'plantou'
  }
  return formatConfirmadas(confirmadas)
}

/**
 * As culturas do "como é hoje" para o `/api/plano` (as 3 últimas safras, em ordem; o pousio vale). Se alguma
 * safra não tem a cultura (sem resposta, só "Plantei" ou "Não plantei"), `null`: a tela mostra "não preenchido".
 */
export function todayCrops(answers: SeasonAnswers, years: readonly number[] = LAST_SEASONS): CropId[] | null {
  const crops = years.map((year) => answers[year])
  return crops.every((value): value is CropId => value !== undefined && isCrop(value)) ? crops : null
}

/**
 * Links antigos (antes do pacote 2): `confirmadas` (`2024:plantou,2025:parado`) e `hoje` (`2024:sorgo`). A
 * cultura do `hoje` vale; senão, `parado` = `pousio` e `plantou` = `soja` (plantou algo, sem dizer o quê).
 */
export function seasonAnswersFromLegacy(confirmadas: string | null | undefined, hoje: string | null | undefined): SeasonAnswers {
  const result: Partial<Record<number, SeasonAnswer>> = {}
  for (const [year, value] of Object.entries(parseConfirmadas(confirmadas))) {
    result[Number(year)] = value === 'parado' ? 'pousio' : 'soja'
  }
  for (const [year, crop] of Object.entries(parseToday(hoje))) {
    if (crop) result[Number(year)] = crop
  }
  return result
}

/**
 * Lavoura de demonstração (15/11/2026, pedido do usuário): as 3 últimas safras já vêm respondidas com este exemplo,
 * para a demonstração não parar no formulário. Coerente com o que o satélite viu no ponto (cultura depois da soja nas 3
 * safras, "plantou"); a tela avisa que são respostas de exemplo. Nunca vale para a lavoura do produtor nem para a escolha
 * atual (`pensa`), que continua só do produtor.
 */
export const DEMO_SEASON_ANSWERS: SeasonAnswers = { 2024: 'milho_safrinha', 2025: 'milho_braquiaria', 2026: 'sorgo' }

/** As respostas do fluxo: o `safras` da URL ou, sem ele, o `confirmadas` e o `hoje` dos links velhos. */
export function seasonAnswersFromFlow(params: FlowParams | null | undefined): SeasonAnswers {
  if (!params) return {}
  if (params.safras) return parseSeasonAnswers(params.safras)
  return seasonAnswersFromLegacy(params.confirmadas, params.hoje)
}

/**
 * O fluxo com as respostas novas (para gravar na URL com o `useReplaceFlow`). Tira o `confirmadas` e o `hoje`
 * antigos: a resposta fica num lugar só, e o `confirmadas` da API sai de `confirmadasFromAnswers`.
 */
export function flowWithSeasonAnswers<T extends FlowParams>(params: T, answers: SeasonAnswers): T {
  return { ...params, confirmadas: undefined, hoje: undefined, safras: formatSeasonAnswers(answers) }
}

/** Como "Plantei / Não plantei" aparece: pela resposta ou, sem ela, pelo satélite (que só pré-marca "Plantei"). */
export function soyState(answer: SeasonAnswer | undefined, satellite: SeasonSatellite | null): 'sim' | 'nao' | null {
  if (answer === 'sem_soja') return 'nao'
  if (answer !== undefined) return 'sim'
  return satellite?.soy ? 'sim' : null
}

/**
 * Tocar em "Plantei" ou "Não plantei". Tocar de novo na resposta marcada tira a resposta (volta para o
 * satélite), junto com o "depois da soja", que depende dela.
 */
export function nextSoyAnswer(answer: SeasonAnswer | undefined, pressed: 'sim' | 'nao'): SeasonAnswer | null {
  if (pressed === 'nao') return answer === 'sem_soja' ? null : 'sem_soja'
  return answer === undefined || answer === 'sem_soja' ? 'soja' : null
}

/** Tocar numa cultura do "depois da soja": marca a soja junto; tocar de novo na mesma tira só o depois. */
export function nextAfterAnswer(answer: SeasonAnswer | undefined, crop: CropId): SeasonAnswer {
  return answer === crop ? 'soja' : crop
}

function satelliteOf(historico: Historico | null, year: number): SeasonSatellite | null {
  const ano = historico?.anos.find((item) => item.ano === year)
  if (!ano || ano.situacao === 'sem_dado') return null
  if (ano.situacao === 'sem_soja') return { soy: false, after: null, ndvi: ano.ndvi_max }
  return { soy: true, after: ano.situacao === 'incerto' ? null : ano.situacao, ndvi: ano.ndvi_max }
}

/** As linhas do formulário (as 3 últimas safras, por padrão) com o que o satélite viu no `/talhao`. */
export function seasonRows(historico: Historico | null, years: readonly number[] = LAST_SEASONS): SeasonRow[] {
  return years.map((year) => ({ year, satellite: satelliteOf(historico, year) }))
}
