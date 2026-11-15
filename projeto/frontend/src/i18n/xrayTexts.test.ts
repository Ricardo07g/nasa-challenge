import { describe, expect, it } from 'vitest'
import { en } from './messages.en'
import { pt } from './messages.pt'
import type { RaioX } from '../models/raioX'
import { xRayBlocks, type XRayBlock } from '../services/raioXService'
import type { SoilSummary } from '../services/satelliteService'
import { xraySummary, xrayText } from './xrayTexts'

/** Os números da lavoura de demonstração (`/api/raio-x`, 15/11/2026). */
const RAIO = {
  solo: { textura: 'argiloso', argila_pct: 41.9, areia_pct: 40.2, cad_mm: 60, vizinho_km: null },
  agua: { cad_mm: 60, dias: 16, cultura: 'milheto', nome: 'Milheto', floracao: '04-22', eto_mm_dia: 3.6, kc: 1, consumo_mm_dia: 3.6, fonte_eto: 'nasa_power' },
  umidade: { percentil: 59.3, data: '2026-11-10' },
  verde: { ultimo_ndvi: 0.4166, ultimo_data: '2026-07-28', pico_ndvi: 0.9023, pico_data: '2026-01-17', safra: '2025/26', fonte: 'MODIS', soja_vista: true },
  chuva: {
    media_mm: 862.1,
    anos: Array.from({ length: 20 }, (_, index) => 2005 + index),
    fonte: 'gpm_imerg',
    fim_das_chuvas: { mediana: '04-21', mais_cedo: { dia: '03-16', ano: 2021 }, mais_tarde: { dia: '06-22', ano: 2012 } },
  },
  veranico: { dias: 43, ano: 2024, inicio: '04-19', total_anos: 20, fonte: 'gpm_imerg' },
  calor: { anos_com_calor: 1, total_anos: 20, temp_c: 35, anos: [2024], fonte: 'nasa_power' },
  regiao: { chuva_mm: 330.7, mediana_regiao_mm: 325.6, celulas: 225, pct_mais_seca: 38, pct_mais_chuvosa: 62, fonte: 'gpm_imerg' },
} as unknown as RaioX

const blocks = xRayBlocks(RAIO)
const block = <K extends XRayBlock['kind']>(kind: K) => blocks.find((item) => item.kind === kind) as Extract<XRayBlock, { kind: K }>
const MAP: SoilSummary = { textura: 'argiloso', source: 'map' }

describe('textos dos blocos do raio-X (tela 4, pacote 2)', () => {
  it('Solo: o número, a linha curta e, no modal, a argila, o silte, a areia, a fonte e o Saiba mais', () => {
    const text = xrayText(pt, 'pt', block('soil'), MAP)

    expect(text).toMatchObject({ label: 'Solo', value: '42', unit: '% de argila', line: 'Terra argilosa', badge: 'SoilGrids · ISRIC · 250 m' })
    expect(text.title).toBe('Do que a sua terra é feita')
    expect(text.text).toBe(
      'Pelo mapa de solos SoilGrids, a terra deste ponto tem **42% de argila**, 18% de silte e 40% de areia. É uma terra argilosa: segura bem a água, mas encharca mais fácil.',
    )
    expect(text.source).toBe('SoilGrids (ISRIC), mapa de 250 m, CC BY 4.0.')
    expect(text.guide).toEqual({ slug: 'raio-x', label: 'Saiba mais: como ler o raio-X da sua terra' })
    expect(text.bar).toEqual({ kind: 'soil', clay: 42, silt: 18, sand: 40 })
  })

  it('Solo com a terra escolhida pelo produtor: a linha e o modal dizem a escolha', () => {
    const text = xrayText(pt, 'pt', block('soil'), { textura: 'arenoso', source: 'user' })

    expect(text.line).toBe('Você escolheu: terra arenosa')
    expect(text.text).toContain('Você escolheu terra arenosa: a conta da água usa a sua escolha.')
  })

  it('Água: quantos dias a terra aguenta na floração, com a conta do gasto na fonte', () => {
    const text = xrayText(pt, 'pt', block('water'), MAP)

    expect(text).toMatchObject({ value: '60', unit: 'mm', line: 'Aguenta ~16 dias sem chuva na floração' })
    expect(text.text).toBe(
      'A terra deste ponto guarda cerca de **60 mm** de água para a planta. Na floração de milheto, por volta de 22 de abril, a planta gasta uns 3,6 mm por dia. Então a terra aguenta **cerca de 16 dias sem chuva** nessa fase.',
    )
    expect(text.source).toBe('Textura do SoilGrids; gasto de água: evapotranspiração de 3,6 mm do NASA POWER × coeficiente da cultura 1,00.')
  })

  it('Água sem a cultura da floração: só o que a terra guarda', () => {
    const water = { ...block('water'), data: { ...block('water').data, dias: null, cultura: null, floracao: null } }
    const text = xrayText(pt, 'pt', water, MAP)

    expect(text.line).toBe('Ao alcance das raízes')
    expect(text.text).toBe('A terra deste ponto guarda cerca de **60 mm** de água para a planta.')
    expect(text.source).toBe('Textura do SoilGrids (ISRIC).')
  })

  it('Umidade agora: o percentil, a barra e a data da leitura', () => {
    const text = xrayText(pt, 'pt', block('moisture'), MAP)

    expect(text).toMatchObject({ value: '59', unit: '%', line: 'Mais úmida que em 59% dos anos nesta época', bar: { kind: 'moisture', pct: 59 } })
    expect(text.text).toBe('Na leitura de **10 de novembro de 2026**, a terra estava **mais úmida que em 59% dos anos** nesta mesma época.')
    expect(text.guide).toBeNull()
  })

  it('Verde: a última leitura no número e o pico da última soja na linha', () => {
    const text = xrayText(pt, 'pt', block('green'), MAP)

    expect(text).toMatchObject({ value: '0,42', unit: 'NDVI', line: 'Pico da última soja: 0,90 (jan/2026)' })
    expect(text.text).toBe(
      'O NDVI mede o verde da planta: vai de **0 (terra nua)** a **1 (verde forte)**. Última leitura: 0,42, em 28 de julho de 2026. Na soja 2025/26, o pico foi 0,90, em 17 de janeiro de 2026.',
    )
    expect(xrayText(en, 'en', block('green'), MAP)).toMatchObject({ value: '0.42', line: 'Last soybean peak: 0.90 (Jan 2026)' })
  })

  it('Verde sem soja no ponto: a linha não fala de soja', () => {
    const green = { ...block('green'), data: { ...block('green').data, soja_vista: false, pico_ndvi: 0.3328, pico_data: '2026-02-18' } }

    expect(xrayText(pt, 'pt', green, MAP).line).toBe('Maior verde de jan a meados de mar: 0,33')
  })

  it('Chuva num ano típico: a média, os anos e quando a chuva acaba, com o Saiba mais', () => {
    const text = xrayText(pt, 'pt', block('rain'), MAP)

    expect(text).toMatchObject({ label: 'Chuva num ano típico', value: '862', unit: 'mm', line: 'De janeiro a julho, média de 20 anos' })
    expect(text.text).toBe(
      'De janeiro a julho caem, em média, **862 mm** de chuva neste ponto (2005 a 2024). Em metade dos anos, a chuva acabou até 21 de abril. A que acabou mais cedo foi em 16 de março de 2021; a mais tarde, em 22 de junho de 2012.',
    )
    expect(text.guide).toEqual({ slug: 'quando-a-chuva-acaba', label: 'Saiba mais: quando a chuva acaba' })
  })

  it('Maior veranico: os dias seguidos, o ano e o começo', () => {
    const text = xrayText(pt, 'pt', block('dryspell'), MAP)

    expect(text).toMatchObject({ value: '43', unit: 'dias', line: 'Seguidos sem chuva, em 2024' })
    expect(text.text).toBe(
      'Em 2024, a partir de 19 de abril, foram **43 dias seguidos** com menos de 1 mm de chuva por dia. Foi o maior trecho seco entre março e maio em 20 anos.',
    )
    expect(text.guide).toEqual({ slug: 'veranico', label: 'Saiba mais: veranico' })
  })

  it('Calor forte: quantos anos de quantos, e quais', () => {
    const text = xrayText(pt, 'pt', block('heat'), MAP)

    expect(text).toMatchObject({ label: 'Calor forte', value: '1', unit: 'de 20 anos', line: 'Com 35 °C ou mais de março a maio' })
    expect(text.text).toBe(
      'Em 20 anos, só **1 ano (2024)** teve pelo menos um dia de 35 °C ou mais entre março e maio. Calor assim na floração faz a planta perder flor e produção.',
    )
    expect(text.guide).toEqual({ slug: 'calor-35-graus', label: 'Saiba mais: calor na floração' })
    expect(xrayText(en, 'en', block('heat'), MAP).guide).toEqual({ slug: 'calor-35-graus', label: 'Learn more: heat at flowering' })
    const many = { ...block('heat'), data: { ...block('heat').data, anos_com_calor: 3, anos: [2015, 2019, 2024] } }
    expect(xrayText(pt, 'pt', many, MAP).text).toContain('**3 anos (2015, 2019 e 2024)** tiveram pelo menos um dia')
    const none = { ...block('heat'), data: { ...block('heat').data, anos_com_calor: 0, anos: [] } }
    expect(xrayText(pt, 'pt', none, MAP).text).toContain('Em 20 anos, nenhum teve dia de 35 °C ou mais entre março e maio.')
  })

  it('Sua área e a região: o lado com mais áreas (mais chuvosa ou mais seca)', () => {
    const text = xrayText(pt, 'pt', block('region'), MAP)

    expect(text).toMatchObject({ value: '62', unit: '%', line: 'Mais chuvosa que 62% da região (mar–mai)' })
    expect(text.text).toBe(
      'Na chuva de março a maio, sua área é **mais chuvosa que 62% da região**: 331 mm em média, comparada com 225 áreas de 10 km em volta.',
    )
    const drier = { ...block('region'), data: { ...block('region').data, pct_mais_seca: 70, pct_mais_chuvosa: 30 } }
    expect(xrayText(pt, 'pt', drier, MAP).line).toBe('Mais seca que 70% da região (mar–mai)')
  })

  it('em inglês, os mesmos números', () => {
    expect(xrayText(en, 'en', block('soil'), MAP)).toMatchObject({ label: 'Soil', unit: '% clay', line: 'Clay soil' })
    expect(xrayText(en, 'en', block('rain'), MAP).line).toBe('January to July, 20-year average')
  })
})

describe('resumo falado do raio-X', () => {
  it('com os números da tela, pelo texto do protótipo', () => {
    expect(xraySummary(pt, 'pt', blocks)).toBe(
      'Sua terra é argilosa e guarda cerca de 60 milímetros de água. Hoje ela está mais úmida que em 59% dos anos. Num ano típico chovem 862 milímetros de janeiro a julho, e o maior veranico foi de 43 dias. Confirme abaixo o que você plantou nas últimas safras.',
    )
    expect(xraySummary(en, 'en', blocks)).toBe(
      'Your soil is clay and holds about 60 millimeters of water. Today it is wetter than in 59% of years. In a typical year, 862 millimeters of rain fall from January to July, and the longest dry spell was 43 days. Confirm below what you planted in the last seasons.',
    )
  })

  it('sem um bloco, a frase dele sai; sem raio-X, só o pedido de confirmar', () => {
    const onlySoil = blocks.filter((item) => item.kind === 'soil' || item.kind === 'rain')

    expect(xraySummary(pt, 'pt', onlySoil)).toBe(
      'Sua terra é argilosa e guarda cerca de 60 milímetros de água. Num ano típico chovem 862 milímetros de janeiro a julho. Confirme abaixo o que você plantou nas últimas safras.',
    )
    expect(xraySummary(pt, 'pt', [])).toBe('Confirme abaixo o que você plantou nas últimas safras.')
  })
})
