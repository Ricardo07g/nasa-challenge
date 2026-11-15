/**
 * Frases dos 8 blocos do raio-X (tela 4, pacote 2, tarefa 0058): no bloco, só o nome, o número, uma linha e o
 * selo da fonte; no modal, o texto completo (negrito com `**…**`, lido pelo `parseInline`), a fonte e o "Saiba
 * mais". Só apresentação: os números vêm prontos do `/api/raio-x`.
 */
import type { GuideSlug } from '../content/guia/slugs'
import { formatDayMonth, formatDecimal, formatFullDate, formatMonth, formatNumber } from './format'
import type { Lang } from './language'
import type { Messages } from './messages.pt'
import type { RaioX } from '../models/raioX'
import { futureAgreement, regionSide, soilParts, type AreaAlert, type XRayBlock } from '../services/raioXService'
import type { SoilSummary } from '../services/satelliteService'

export type XRayBar = { kind: 'soil'; clay: number; silt: number; sand: number } | { kind: 'moisture'; pct: number }

export type XRayText = {
  kind: XRayBlock['kind']
  label: string
  /** O número já no jeito do idioma ("0,42"); `amount` é o mesmo número, para a contagem na chegada. */
  value: string
  amount: number
  format: (value: number) => string
  unit: string
  line: string
  badge: string
  bar: XRayBar | null
  title: string
  text: string
  source: string
  guide: { slug: GuideSlug; label: string } | null
}

/** Um ano comum só para escrever o "MM-DD" como "19 de abril". */
const dayMonth = (lang: Lang, mmdd: string) => formatDayMonth(lang, `2023-${mmdd}`)

function yearList(lang: Lang, years: readonly number[]): string {
  if (years.length <= 1) return years.join('')
  return `${years.slice(0, -1).join(', ')} ${lang === 'pt' ? 'e' : 'and'} ${years.at(-1)}`
}

/** Nome da cultura no meio da frase ("milho com braquiária"). */
function cropName(t: Messages, id: string, fallback: string | null): string {
  const names: Record<string, string> = t.crops.names
  const name = names[id] ?? fallback ?? id
  return name.charAt(0).toLowerCase() + name.slice(1)
}

export function xrayText(t: Messages, lang: Lang, block: XRayBlock, soil: SoilSummary): XRayText {
  const x = t.xray
  const integer = (value: number) => formatNumber(lang, value)
  const guide = (slug: GuideSlug, title: string) => ({ slug, label: x.learnMore(title) })
  const base = { kind: block.kind, badge: x.badges[block.kind], bar: null, guide: null, format: integer }
  switch (block.kind) {
    case 'soil': {
      const parts = soilParts(block.data)
      const texture = x.textures[block.data.textura]
      const chosen = soil.source === 'user' ? x.textures[soil.textura] : null
      const extra = [
        block.data.vizinho_km !== null ? x.soil.neighbor(formatDecimal(lang, block.data.vizinho_km, 1)) : '',
        chosen ? x.soil.chosen(chosen) : '',
      ].filter(Boolean)
      return {
        ...base,
        label: x.soil.label,
        value: integer(parts.clay),
        amount: parts.clay,
        unit: x.soil.unit,
        line: chosen ? x.soil.lineChosen(chosen) : x.soil.line(texture),
        bar: { kind: 'soil', ...parts },
        title: x.soil.title,
        text: [x.soil.text(parts.clay, parts.silt, parts.sand, texture, x.soil.about[block.data.textura]), ...extra].join(' '),
        source: x.soil.source,
        guide: guide('raio-x', x.guides.xray),
      }
    }
    case 'water': {
      const water = block.data
      const flowering = water.dias !== null && water.cultura && water.floracao
      const use = flowering && water.consumo_mm_dia !== null ? formatDecimal(lang, water.consumo_mm_dia, 1) : null
      const fromPower = water.eto_mm_dia !== null && water.kc !== null
      return {
        ...base,
        label: x.water.label,
        value: integer(water.cad_mm),
        amount: water.cad_mm,
        unit: x.water.unit,
        line: flowering ? x.water.line(water.dias!) : x.water.lineNoCrop,
        title: x.water.title,
        text: [
          x.water.text(integer(water.cad_mm)),
          flowering && use ? x.water.flowering(cropName(t, water.cultura!, water.nome), dayMonth(lang, water.floracao!), use, water.dias!) : '',
        ]
          .filter(Boolean)
          .join(' '),
        source:
          flowering && fromPower
            ? x.water.source(formatDecimal(lang, water.eto_mm_dia!, 1), formatDecimal(lang, water.kc!, 2))
            : x.water.sourceNoCrop,
        guide: guide('raio-x', x.guides.xray),
      }
    }
    case 'moisture': {
      const pct = Math.round(block.data.percentil)
      return {
        ...base,
        label: x.moisture.label,
        value: integer(pct),
        amount: pct,
        unit: '%',
        line: x.moisture.line(pct),
        bar: { kind: 'moisture', pct },
        title: x.moisture.title,
        text: x.moisture.text(formatFullDate(lang, block.data.data), pct),
        source: x.moisture.source,
      }
    }
    case 'green': {
      const green = block.data
      const ndvi = (value: number) => formatDecimal(lang, value, 2)
      const main = green.ultimo_ndvi ?? green.pico_ndvi ?? 0
      const peakMonth = green.pico_data
        ? x.green.month(formatMonth(lang, Number(green.pico_data.slice(5, 7))).slice(0, 3), green.pico_data.slice(0, 4))
        : null
      const noSoy = green.soja_vista === false
      const line =
        green.pico_ndvi !== null && noSoy
          ? x.green.lineNoSoy(ndvi(green.pico_ndvi))
          : green.pico_ndvi !== null && peakMonth
            ? x.green.linePeak(ndvi(green.pico_ndvi), peakMonth)
            : green.ultimo_data
              ? x.green.lineLast(formatFullDate(lang, green.ultimo_data))
              : ''
      const peak =
        green.pico_ndvi !== null && green.safra
          ? noSoy
            ? x.green.peakNoSoy(green.safra, ndvi(green.pico_ndvi), green.pico_data ? formatFullDate(lang, green.pico_data) : null)
            : green.pico_data
              ? x.green.peakOn(green.safra, ndvi(green.pico_ndvi), formatFullDate(lang, green.pico_data))
              : x.green.peak(green.safra, ndvi(green.pico_ndvi))
          : ''
      return {
        ...base,
        format: ndvi,
        label: x.green.label,
        value: ndvi(main),
        amount: main,
        unit: x.green.unit,
        line,
        title: x.green.title,
        text: [
          x.green.text,
          green.ultimo_ndvi !== null && green.ultimo_data ? x.green.last(ndvi(green.ultimo_ndvi), formatFullDate(lang, green.ultimo_data)) : '',
          peak,
        ]
          .filter(Boolean)
          .join(' '),
        source: x.green.source,
      }
    }
    case 'rain': {
      const rain = block.data
      const end = rain.fim_das_chuvas
      const years = [...rain.anos].sort((a, b) => a - b)
      return {
        ...base,
        label: x.rain.label,
        value: integer(rain.media_mm),
        amount: rain.media_mm,
        unit: x.rain.unit,
        line: x.rain.line(rain.anos.length),
        title: x.rain.title,
        text: [
          years.length > 0 ? x.rain.text(integer(rain.media_mm), years[0], years.at(-1)!) : '',
          end ? x.rain.end(dayMonth(lang, end.mediana)) : '',
          end
            ? x.rain.endRange(
                formatFullDate(lang, `${end.mais_cedo.ano}-${end.mais_cedo.dia}`),
                formatFullDate(lang, `${end.mais_tarde.ano}-${end.mais_tarde.dia}`),
              )
            : '',
        ]
          .filter(Boolean)
          .join(' '),
        source: x.rain.source,
        guide: guide('quando-a-chuva-acaba', x.guides.rain),
      }
    }
    case 'dryspell': {
      const spell = block.data
      return {
        ...base,
        label: x.dryspell.label,
        value: integer(spell.dias),
        amount: spell.dias,
        unit: x.dryspell.unit,
        line: x.dryspell.line(spell.ano),
        title: x.dryspell.title,
        text: x.dryspell.text(spell.ano, dayMonth(lang, spell.inicio), spell.dias, spell.total_anos),
        source: x.dryspell.source(spell.total_anos),
        guide: guide('veranico', x.guides.dryspell),
      }
    }
    case 'heat': {
      const heat = block.data
      const temp = integer(heat.temp_c)
      const count =
        heat.anos_com_calor === 0
          ? x.heat.none(heat.total_anos, temp)
          : heat.anos_com_calor === 1
            ? x.heat.one(heat.total_anos, yearList(lang, heat.anos), temp)
            : x.heat.many(heat.total_anos, heat.anos_com_calor, yearList(lang, heat.anos), temp)
      return {
        ...base,
        label: x.heat.label,
        value: integer(heat.anos_com_calor),
        amount: heat.anos_com_calor,
        unit: x.heat.unit(heat.total_anos),
        line: x.heat.line(temp),
        title: x.heat.title,
        text: `${count} ${x.heat.why}`,
        source: x.heat.source(heat.total_anos),
        guide: guide('calor-35-graus', x.guides.heat),
      }
    }
    case 'region': {
      const side = regionSide(block.data)
      const mm = integer(block.data.chuva_mm)
      return {
        ...base,
        label: x.region.label,
        value: integer(side.pct),
        amount: side.pct,
        unit: '%',
        line: side.side === 'drier' ? x.region.lineDrier(side.pct) : x.region.lineWetter(side.pct),
        title: x.region.title,
        text:
          side.side === 'drier'
            ? x.region.textDrier(side.pct, mm, block.data.celulas)
            : x.region.textWetter(side.pct, mm, block.data.celulas),
        source: x.region.source,
      }
    }
  }
}

/**
 * "Ouvir resumo" da tela 4: 2 ou 3 frases com os números da tela (terra, água, umidade, chuva e veranico) e o
 * pedido de confirmar as safras. Frase sem o bloco não entra.
 */
export function xraySummary(t: Messages, lang: Lang, blocks: readonly XRayBlock[], soil?: SoilSummary): string {
  const s = t.satellite.summary
  const find = <K extends XRayBlock['kind']>(kind: K) =>
    blocks.find((block) => block.kind === kind) as Extract<XRayBlock, { kind: K }> | undefined
  const integer = (value: number) => formatNumber(lang, value)
  const soilBlock = find('soil')
  const water = find('water')
  const moisture = find('moisture')
  const rain = find('rain')
  const spell = find('dryspell')
  const mm = water?.data.cad_mm ?? soilBlock?.data.cad_mm
  const texture = soil?.source === 'user' ? soil.textura : soilBlock?.data.textura
  return [
    texture && mm !== undefined ? s.soil(t.xray.textures[texture], integer(mm)) : mm !== undefined ? s.water(integer(mm)) : '',
    moisture ? s.moisture(Math.round(moisture.data.percentil)) : '',
    rain && spell
      ? s.rainDryspell(integer(rain.data.media_mm), spell.data.dias)
      : rain
        ? s.rain(integer(rain.data.media_mm))
        : spell
          ? s.dryspell(spell.data.dias)
          : '',
    s.ask,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * "Ouvir resumo" de `/planejamento`: os alertas da área, em quantos anos a melhor opção deu certo e o que os
 * modelos dizem de 2041 a 2060. Frase sem o dado não entra.
 */
export function planningSummary(t: Messages, alerts: readonly AreaAlert[], cards: RaioX['cartoes'] | null): string {
  const p = t.planning.summary
  const c = t.xray.cards
  const names = alerts.map((alert) => p.names[alert.kind])
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} ${p.and} ${names.at(-1)}` : names.join('')
  const rain = cards?.chuva_20_anos
  const future = cards?.clima_futuro
  let agreement = ''
  if (future) {
    const { rain: direction, heat, models } = futureAgreement(future)
    const rainText =
      direction.direction === 'less'
        ? c.agreeLess(direction.count, models)
        : direction.direction === 'more'
          ? c.agreeMore(direction.count, models)
          : c.agreeSplit(models)
    agreement = `${rainText}; ${c.agreeHeat(heat, models)}.`
  }
  return [
    names.length > 0 ? p.alerts(list, names.length) : p.noAlerts,
    rain ? p.rain(cropName(t, rain.cultura, rain.nome), rain.anos_bons, rain.total_anos) : '',
    agreement ? p.future(agreement) : '',
  ]
    .filter(Boolean)
    .join(' ')
}
