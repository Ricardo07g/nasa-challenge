/**
 * Frases da caixa "Na sua lavoura" do Guia (tela 8 do pacote 3, tarefa 0063): a frase com o número do ponto e
 * a fonte. Só apresentação: os números vêm prontos do `/api/raio-x`, e qual dado vale para cada artigo fica no
 * `guideFieldService`. O limite da conta (os mm da chuva forte, os °C do calor) não entra na frase: quem escolhe
 * o limite é a conta, não a frase (pedido do usuário de 15/11/2026).
 */
import { signedDelta } from '../views/futureClimateText'
import type { FieldFact } from '../services/guideFieldService'
import { formatDayMonth, formatDecimal, formatNumber } from './format'
import type { Lang } from './language'
import { en } from './messages.en'
import { pt, type Messages } from './messages.pt'

const MESSAGES: Record<Lang, Messages> = { pt, en }

/** Um ano comum só para escrever o "MM-DD" como "19 de abril". */
const dayMonth = (lang: Lang, mmdd: string) => formatDayMonth(lang, `2023-${mmdd}`)

function list(items: readonly (string | number)[], and: string): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${and} ${items.at(-1)}`
}

/** "gpm_imerg+nasa_power" (código do backend) → "GPM IMERG (NASA) e NASA POWER". */
export function rainSourceName(code: string, lang: Lang, t?: Messages): string {
  const f = (t ?? MESSAGES[lang]).guide.field
  const names = code.split('+').map((part) => f.rainSources[part.trim()] ?? part.trim())
  return list(names, f.and)
}

export function fieldFactText(t: Messages, lang: Lang, fact: FieldFact): { text: string; source: string } {
  const f = t.guide.field
  const n = (value: number) => formatNumber(lang, value)
  switch (fact.kind) {
    case 'heavyRain': {
      const d = fact.data
      return {
        text: f.heavyRain(d.total_anos, d.dias, formatDecimal(lang, d.media_dias_ano, 2)),
        source: `${rainSourceName(d.fonte, lang, t)}, ${f.years(d.total_anos)}`,
      }
    }
    case 'dryspell': {
      const d = fact.data
      return {
        text: f.dryspell(d.total_anos, d.dias, dayMonth(lang, d.inicio), d.ano),
        source: `${rainSourceName(d.fonte, lang, t)}, ${f.years(d.total_anos)}`,
      }
    }
    case 'heat': {
      const d = fact.data
      const text =
        d.anos.length === 0
          ? f.heatNone(d.total_anos)
          : d.anos.length === 1
            ? f.heatOne(d.total_anos, String(d.anos[0]))
            : f.heatMany(d.total_anos, d.anos.length, list(d.anos, f.and))
      return { text, source: `${f.sourcePower}, ${f.years(d.total_anos)}` }
    }
    case 'future': {
      const d = fact.data
      return { text: f.future(d.modelos, signedDelta(lang, d.chuva_pct), signedDelta(lang, d.tmax_c)), source: f.sourceFuture }
    }
    case 'xray': {
      const texts: string[] = []
      const sources: string[] = []
      if (fact.soil) {
        texts.push(f.xraySoil(n(fact.soil.argila_pct), n(fact.soil.areia_pct)))
        sources.push(f.sourceSoil)
      }
      if (fact.moisture) {
        texts.push(f.xrayMoisture(Math.round(fact.moisture.percentil)))
        sources.push(f.sourceSmap)
      }
      if (fact.rain) {
        texts.push(f.xrayRain(n(fact.rain.media_mm)))
        sources.push(rainSourceName(fact.rain.fonte, lang, t))
      }
      return { text: texts.join(' '), source: sources.join(', ') }
    }
  }
}
