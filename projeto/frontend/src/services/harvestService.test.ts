import { describe, expect, it } from 'vitest'
import type { Talhao } from '../models/talhao'
import { harvestFromDate, harvestSuggestion, harvestWindow } from './harvestService'

const window2027 = { min: '2027-01-15', max: '2027-03-31' }

describe('harvestWindow', () => {
  it('de abril a dezembro, vale a colheita do ano que vem', () => {
    expect(harvestWindow(new Date(2026, 10, 14))).toEqual(window2027)
    expect(harvestWindow(new Date(2026, 3, 1))).toEqual(window2027)
  })

  it('de janeiro a março, a colheita é deste ano', () => {
    expect(harvestWindow(new Date(2027, 1, 20))).toEqual(window2027)
  })
})

describe('harvestFromDate', () => {
  it('converte o dia numa das 3 faixas do PRD', () => {
    expect(harvestFromDate('2027-01-20', window2027)).toBe('cedo')
    expect(harvestFromDate('2027-02-10', window2027)).toBe('cedo')
    expect(harvestFromDate('2027-02-11', window2027)).toBe('meio')
    expect(harvestFromDate('2027-02-20', window2027)).toBe('meio')
    expect(harvestFromDate('2027-02-21', window2027)).toBe('tarde')
    expect(harvestFromDate('2027-03-15', window2027)).toBe('tarde')
  })

  it('fora da época de colheita ou sem data, não vale', () => {
    expect(harvestFromDate('', window2027)).toBeNull()
    expect(harvestFromDate('2027-01-14', window2027)).toBeNull()
    expect(harvestFromDate('2027-04-01', window2027)).toBeNull()
    expect(harvestFromDate('2026-02-15', window2027)).toBeNull()
    expect(harvestFromDate('15/02/2027', window2027)).toBeNull()
  })
})

const talhao = (colheita: Talhao['colheita_sugerida']) => ({ colheita_sugerida: colheita }) as Talhao

describe('harvestSuggestion', () => {
  it('usa a faixa que o satélite viu (NDVI do MODIS)', () => {
    expect(harvestSuggestion(talhao({ faixa: 'cedo', fonte: 'ndvi_modis', anos_usados: 9 }))).toEqual({
      faixa: 'cedo',
      fromSatellite: true,
    })
  })

  it('sem dado do satélite, fica no meio de fevereiro (RF-16)', () => {
    const fallback = { faixa: 'meio', fromSatellite: false }
    expect(harvestSuggestion(talhao({ faixa: 'meio', fonte: 'padrao', anos_usados: 2 }))).toEqual(fallback)
    expect(harvestSuggestion(talhao(null))).toEqual(fallback)
    expect(harvestSuggestion(undefined)).toEqual(fallback)
  })
})
