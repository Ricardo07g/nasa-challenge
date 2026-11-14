import type { Messages } from '../i18n/messages.pt'
import type { RainSummary } from '../services/satelliteService'

/** "20 anos entre 2005 e 2024": o período vem do talhão; sem ele, só o número de anos (nada de ano fixo). */
export function rainPeriodText(t: Messages, years: number, rain: RainSummary | null): string {
  return rain?.period ? t.answer.rainYears(years, rain.period.start, rain.period.end) : t.answer.rainYearsCount(years)
}
