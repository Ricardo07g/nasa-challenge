/**
 * Frases da tela 5 (aba "Escolher", modais e relatório) montadas com os números da API. Só apresentação: quem
 * decide o que vai em cada linha são os services (`choiceService`, `compareService`).
 */
import type { GuideSlug } from '../content/guia/slugs'
import { formatDayMonth, formatFullDate, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { CropId, Opcao } from '../models/recomendacao'
import type { Colheita } from '../models/talhao'
import { consOf, isLate } from '../services/choiceService'
import { whyUse } from '../services/compareService'

/** O artigo de cada cultura no Guia ("Saiba mais", sempre em nova aba). */
export const CROP_GUIDE: Record<CropId, GuideSlug> = {
  milho_safrinha: 'milho-safrinha',
  milho_braquiaria: 'milho-braquiaria',
  sorgo: 'sorgo',
  milheto: 'milheto',
  crotalaria: 'crotalaria',
  pousio: 'terra-parada',
}

export const cropName = (t: Messages, crop: CropId) => t.crops.names[crop]

/** "a, b e c" / "a, b and c". */
export function joinList(items: readonly string[], and: string): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`
}

/** "Safra 2026/27 · colheita prevista em 3 de março de 2027" (ou a faixa, sem a data da tela 2). */
export function contextText(t: Messages, lang: Lang, season: string, date: string | null, band: Colheita | null): string {
  if (date) return t.choose.context(season, formatFullDate(lang, date))
  return t.choose.contextBand(season, band ? t.harvest[band].inline : t.seasons.harvestExpectedEarly(season.slice(-2)))
}

/** O prazo do ZARC da cultura: "Até 20 de março", "Passou do prazo (28 de fevereiro)" ou sem data. */
export function deadlineText(t: Messages, lang: Lang, option: Opcao): { text: string; late: boolean } {
  const c = t.choose.compare
  const late = isLate(option)
  if (!option.data_limite) return { text: c.deadlineNone, late }
  const date = formatDayMonth(lang, option.data_limite)
  return { text: late ? c.deadlineLate(date) : c.deadline(date), late }
}

/** "A favor": os rótulos do motor (nenhum corte novo no front); o pousio tem os fatos fixos. */
export function prosTexts(t: Messages, option: Opcao | null): string[] {
  const c = t.choose.compare
  if (!option) return [...c.fallowPros]
  return whyUse(option).map((reason) => c.pros[reason])
}

/** "Contra": passou do prazo (sem seguro) primeiro, depois os rótulos do motor. */
export function consTexts(t: Messages, lang: Lang, option: Opcao | null): string[] {
  const c = t.choose.compare
  if (!option) return [...c.fallowCons]
  return consOf(option).map((reason) => {
    if (reason !== 'late') return c.cons[reason]
    return option.data_limite ? c.cons.late(formatDayMonth(lang, option.data_limite)) : c.cons.lateNoDate
  })
}

/** A frase do porquê no cartão da sugestão: até 2 pontos a favor; sem nenhum, o resumo da cultura. */
export function suggestionLine(t: Messages, option: Opcao): string {
  const pros = prosTexts(t, option).slice(0, 2)
  return pros.length ? `${pros.join('. ')}.` : t.crops.taglines[option.id]
}

/** Água da cultura: "Falta 120 mm" e "num ano seco: 165 mm"; null sem a linha "Água" da API. */
export function waterTexts(t: Messages, lang: Lang, option: Opcao): { main: string; dry: string } | null {
  const c = t.choose.compare
  if (!option.agua) return null
  const mm = (value: number) => formatNumber(lang, value)
  return {
    main: option.agua.falta_normal_mm > 0 ? c.waterShort(mm(option.agua.falta_normal_mm)) : c.waterNone,
    dry: c.waterDry(mm(option.agua.falta_seco_mm)),
  }
}

/** Clima 2041–2060 da cultura: "10 de 20 anos" e a faixa dos modelos; null sem o CMIP6. */
export function futureTexts(t: Messages, option: Opcao): { main: string; range: string } | null {
  const c = t.choose.compare
  if (!option.futuro) return null
  return {
    main: c.future(Math.round(option.futuro.anos_bons_media), option.chuva.anos),
    range: c.futureRange(option.futuro.anos_bons_min, option.futuro.anos_bons_max),
  }
}
