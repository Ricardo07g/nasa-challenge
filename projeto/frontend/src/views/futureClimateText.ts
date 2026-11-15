/**
 * Frases do clima de 2041–2060 da célula, iguais na aba Sugestão e no cartão do raio-X (tarefa 0049 do
 * backend): o mesmo dado (`ClimaFuturo`), o mesmo jeito de escrever o número e a mesma concordância dos
 * modelos. Só apresentação: a conta é do backend.
 */
import { formatDecimal } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { ClimaFuturo } from '../models/raioX'
import { futureAgreement } from '../services/raioXService'

/** "+2,2" / "-0,7" / "0,0": o hífen comum é o que o "Ouvir" lê como "menos" (decisão da S4). */
export function signedDelta(lang: Lang, value: number): string {
  const text = formatDecimal(lang, Math.abs(value), 1)
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : text
}

export function futureClimateText(t: Messages, lang: Lang, clima: ClimaFuturo): { rain: string; heat: string; agreement: string } {
  const c = t.xray.cards
  const { rain, heat, models } = futureAgreement(clima)
  const rainText =
    rain.direction === 'less'
      ? c.agreeLess(rain.count, models)
      : rain.direction === 'more'
        ? c.agreeMore(rain.count, models)
        : c.agreeSplit(models)
  return {
    rain: c.futureRain(signedDelta(lang, clima.chuva_pct)),
    heat: c.futureHeat(signedDelta(lang, clima.tmax_c)),
    agreement: `${rainText}; ${c.agreeHeat(heat, models)}.`,
  }
}
