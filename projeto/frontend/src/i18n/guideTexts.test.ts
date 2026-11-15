import { describe, expect, it } from 'vitest'
import type { FieldFact } from '../services/guideFieldService'
import { fieldFactText, rainSourceName } from './guideTexts'
import { en } from './messages.en'
import { pt } from './messages.pt'

/** Os números da lavoura de demonstração (`/api/raio-x` da API de revisão, 15/11/2026). */
const heavyRain: FieldFact = {
  kind: 'heavyRain',
  data: { media_dias_ano: 0.25, dias: 5, total_anos: 20, limite_mm: 50, fonte: 'gpm_imerg' },
}
const dryspell: FieldFact = { kind: 'dryspell', data: { dias: 43, ano: 2024, inicio: '04-19', total_anos: 20, fonte: 'gpm_imerg' } }
const heat = (anos: number[]): FieldFact => ({
  kind: 'heat',
  data: { anos_com_calor: anos.length, total_anos: 20, temp_c: 35, anos, fonte: 'nasa_power' },
})
const future: FieldFact = {
  kind: 'future',
  data: {
    chuva_pct: 2.2,
    tmax_c: 1.3,
    modelos: 3,
    modelos_menos_chuva: 1,
    modelos_mais_chuva: 2,
    modelos_mais_quente: 3,
    cenario: 'ssp245',
    periodo: '2041-2060',
  },
}
const xray: FieldFact = {
  kind: 'xray',
  soil: { textura: 'argiloso', argila_pct: 41.9, areia_pct: 40.2, cad_mm: 60, vizinho_km: null },
  moisture: { percentil: 59.3, data: '2026-11-10' },
  rain: { media_mm: 862.1, anos: [2005, 2024], fonte: 'gpm_imerg', fim_das_chuvas: null },
}

describe('fieldFactText (a frase e a fonte da caixa "Na sua lavoura")', () => {
  it('erosão: os dias de chuva forte em fevereiro e março', () => {
    expect(fieldFactText(pt, 'pt', heavyRain)).toEqual({
      text: 'Em 20 anos, houve 5 dias de chuva forte em fevereiro e março: em média, 0,25 dia por ano.',
      source: 'GPM IMERG (NASA), 20 anos',
    })
    expect(fieldFactText(en, 'en', heavyRain)).toEqual({
      text: 'In 20 years, there were 5 days of heavy rain in February and March: on average, 0.25 days a year.',
      source: 'GPM IMERG (NASA), 20 years',
    })
  })

  it('a frase não traz o limite da conta (quem escolhe o limite é a conta, não a frase)', () => {
    const otherLimit: FieldFact = { kind: 'heavyRain', data: { media_dias_ano: 0.25, dias: 5, total_anos: 20, limite_mm: 40, fonte: 'gpm_imerg' } }
    expect(fieldFactText(pt, 'pt', otherLimit).text).toBe(fieldFactText(pt, 'pt', heavyRain).text)
    const hotter: FieldFact = { kind: 'heat', data: { anos_com_calor: 1, total_anos: 20, temp_c: 34, anos: [2024], fonte: 'nasa_power' } }
    expect(fieldFactText(pt, 'pt', hotter).text).toBe(fieldFactText(pt, 'pt', heat([2024])).text)
    for (const lang of ['pt', 'en'] as const) {
      const t = lang === 'pt' ? pt : en
      for (const fact of [heavyRain, heat([]), heat([2024]), heat([2019, 2024])]) {
        expect(fieldFactText(t, lang, fact).text).not.toMatch(/\bmm\b|°C/)
      }
    }
  })

  it('veranico: o maior trecho seco de março a maio', () => {
    expect(fieldFactText(pt, 'pt', dryspell).text).toBe(
      'O maior veranico de março a maio em 20 anos foi de 43 dias seguidos sem chuva, a partir de 19 de abril de 2024.',
    )
    expect(fieldFactText(en, 'en', dryspell).text).toBe(
      'The longest dry spell from March to May in 20 years was 43 days in a row without rain, starting April 19, 2024.',
    )
  })

  it('calor: nenhum, 1 ou vários anos com dia de calor forte', () => {
    expect(fieldFactText(pt, 'pt', heat([])).text).toBe('Em 20 anos, nenhum teve dia de calor forte entre março e maio.')
    expect(fieldFactText(pt, 'pt', heat([2024])).text).toBe('Em 20 anos, só 1 (2024) teve dia de calor forte entre março e maio.')
    expect(fieldFactText(pt, 'pt', heat([2019, 2020, 2024])).text).toBe(
      'Em 20 anos, 3 (2019, 2020 e 2024) tiveram dia de calor forte entre março e maio.',
    )
    expect(fieldFactText(en, 'en', heat([])).text).toBe('In 20 years, none had a day of strong heat between March and May.')
    expect(fieldFactText(en, 'en', heat([2024])).text).toBe('In 20 years, only 1 (2024) had a day of strong heat between March and May.')
    expect(fieldFactText(en, 'en', heat([2019, 2024])).text).toBe('In 20 years, 2 (2019 and 2024) had a day of strong heat between March and May.')
    expect(fieldFactText(pt, 'pt', heat([])).source).toBe('NASA POWER, 20 anos')
  })

  it('clima de 2041 a 2060', () => {
    expect(fieldFactText(pt, 'pt', future)).toEqual({
      text: 'Para 2041 a 2060, a média de 3 modelos indica chuva de março a maio +2,2% e máxima +1,3 °C.',
      source: 'NEX-GDDP-CMIP6 (NASA), cenário intermediário',
    })
    expect(fieldFactText(en, 'en', future).text).toBe(
      'For 2041 to 2060, the average of 3 models shows March to May rain +2.2% and maximum temperature +1.3 °C.',
    )
  })

  it('raio-X: só as partes que vieram, com as fontes delas (a terra pelos números do SoilGrids)', () => {
    expect(fieldFactText(pt, 'pt', xray)).toEqual({
      text: 'A terra tem 42% de argila e 40% de areia. Agora está mais úmida que em 59% dos anos nesta época. De janeiro a julho, chove em média 862 mm.',
      source: 'SoilGrids (ISRIC), SMAP (NASA), GPM IMERG (NASA)',
    })
    expect(fieldFactText(en, 'en', xray).text).toBe(
      'The soil has 42% clay and 40% sand. Right now it is wetter than in 59% of years at this time. From January to July, it rains 862 mm on average.',
    )
    expect(fieldFactText(pt, 'pt', { kind: 'xray', soil: null, moisture: null, rain: xray.rain })).toEqual({
      text: 'De janeiro a julho, chove em média 862 mm.',
      source: 'GPM IMERG (NASA)',
    })
  })
})

describe('rainSourceName', () => {
  it('o nome da fonte da chuva pelo código do backend', () => {
    expect(rainSourceName('gpm_imerg', 'pt')).toBe('GPM IMERG (NASA)')
    expect(rainSourceName('gpm_imerg+nasa_power', 'pt')).toBe('GPM IMERG (NASA) e NASA POWER')
    expect(rainSourceName('gpm_imerg+nasa_power', 'en')).toBe('GPM IMERG (NASA) and NASA POWER')
  })
})
