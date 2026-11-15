import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { ClimaFuturo } from '../models/raioX'
import { futureClimateText } from './futureClimateText'

/** Valores de teste (não são de fonte real). */
const CLIMA: ClimaFuturo = {
  chuva_pct: 2.2,
  tmax_c: 1.3,
  modelos: 3,
  modelos_menos_chuva: 1,
  modelos_mais_chuva: 2,
  modelos_mais_quente: 3,
  cenario: 'ssp245',
  periodo: '2041-2060',
}

describe('futureClimateText (clima 2041–2060 igual na Sugestão e no raio-X, tarefa 0049)', () => {
  it('chuva, máxima e concordância dos modelos com o mesmo número e o mesmo sentido', () => {
    expect(futureClimateText(pt, 'pt', CLIMA)).toEqual({
      rain: 'Chuva de março a maio: +2,2%',
      heat: 'Máxima: +1,3 °C',
      agreement: '2 de 3 modelos indicam mais chuva; 3 de 3, mais calor.',
    })
  })

  it('chuva negativa com o sinal de menos, e modelos divididos', () => {
    const text = futureClimateText(pt, 'pt', { ...CLIMA, chuva_pct: -0.7, modelos_menos_chuva: 1, modelos_mais_chuva: 1 })
    expect(text.rain).toBe('Chuva de março a maio: -0,7%')
    expect(text.agreement).toBe('os 3 modelos não concordam sobre a chuva; 3 de 3, mais calor.')
  })

  it('em inglês', () => {
    expect(futureClimateText(en, 'en', CLIMA).agreement).toBe('2 of 3 models point to more rain; 3 of 3, to more heat.')
  })
})
