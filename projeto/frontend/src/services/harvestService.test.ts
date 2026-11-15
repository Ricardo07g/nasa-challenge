import { describe, expect, it } from 'vitest'
import type { Talhao } from '../models/talhao'
import { bandDate, harvestFromDate, harvestSuggestion, harvestWindow } from './harvestService'

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
  it('API antiga, sem o dia: usa a faixa que o satélite viu (NDVI do MODIS), sem data', () => {
    expect(harvestSuggestion(talhao({ faixa: 'cedo', fonte: 'ndvi_modis', anos_usados: 9 }), window2027)).toEqual({
      faixa: 'cedo',
      fromSatellite: true,
      date: null,
    })
  })

  it('sem dado do satélite, fica no meio de fevereiro, sem data (RF-16)', () => {
    const fallback = { faixa: 'meio', fromSatellite: false, date: null }
    expect(harvestSuggestion(talhao({ faixa: 'meio', fonte: 'padrao', anos_usados: 2, dia: null }), window2027)).toEqual(
      fallback,
    )
    expect(harvestSuggestion(talhao(null), window2027)).toEqual(fallback)
    expect(harvestSuggestion(undefined, window2027)).toEqual(fallback)
  })

  it('põe o dia em que a soja seca no ano da época da colheita (tarefa 0042)', () => {
    const suggestion = harvestSuggestion(talhao({ faixa: 'tarde', fonte: 'ndvi_modis', anos_usados: 10, dia: '02-25' }), window2027)

    expect(suggestion).toEqual({ faixa: 'tarde', fromSatellite: true, date: '2027-02-25' })
  })

  it('sugestão = seleção: a faixa sai do dia, pela mesma regra da data exata', () => {
    // Antes, o backend chamava 21/fev de "meio" (limite de 22/fev); a mesma data no campo vira "tarde".
    const suggestion = harvestSuggestion(talhao({ faixa: 'meio', fonte: 'ndvi_modis', anos_usados: 10, dia: '02-21' }), window2027)

    expect(suggestion).toEqual({ faixa: 'tarde', fromSatellite: true, date: '2027-02-21' })
    expect(suggestion.faixa).toBe(harvestFromDate(suggestion.date!, window2027))
  })

  it('dia fora da época da colheita ou num formato estranho: fica só a faixa', () => {
    const april = talhao({ faixa: 'tarde', fonte: 'ndvi_modis', anos_usados: 10, dia: '04-02' })
    const odd = talhao({ faixa: 'meio', fonte: 'ndvi_modis', anos_usados: 10, dia: '15/02' })

    expect(harvestSuggestion(april, window2027)).toEqual({ faixa: 'tarde', fromSatellite: true, date: null })
    expect(harvestSuggestion(odd, window2027)).toEqual({ faixa: 'meio', fromSatellite: true, date: null })
  })
})

describe('bandDate', () => {
  it('o dia de colheita de cada faixa no motor (semeadura 3 dias depois)', () => {
    expect(bandDate('cedo', window2027)).toBe('2027-02-05')
    expect(bandDate('meio', window2027)).toBe('2027-02-15')
    expect(bandDate('tarde', window2027)).toBe('2027-02-28')
  })

  it('cada dia cai na própria faixa', () => {
    for (const band of ['cedo', 'meio', 'tarde'] as const) {
      expect(harvestFromDate(bandDate(band, window2027), window2027)).toBe(band)
    }
  })
})
