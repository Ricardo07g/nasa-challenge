import { describe, expect, it } from 'vitest'
import * as harvest from './harvestService'
import { bandDate, choiceDay, harvestChoice, harvestDateWindow, harvestFromDate } from './harvestService'

/** O campo de data da tela 2 na safra 2026/27 (pacote 2, tarefa 0057). */
const field2027 = { min: '2027-01-01', max: '2027-04-30' }

describe('harvestDateWindow', () => {
  it('o campo de data vai de 1/jan a 30/abr do ano da colheita da safra atual (2026/27)', () => {
    expect(harvestDateWindow()).toEqual(field2027)
    expect(harvestDateWindow(2028)).toEqual({ min: '2028-01-01', max: '2028-04-30' })
  })

  it('o dia do satélite não preenche mais a tela: sai a sugestão pelo NDVI e a janela por hoje', () => {
    expect('harvestSuggestion' in harvest).toBe(false)
    expect('harvestWindow' in harvest).toBe(false)
  })
})

describe('harvestFromDate', () => {
  it('converte o dia numa das 3 faixas do motor (regras.yaml, grupo colheita)', () => {
    expect(harvestFromDate('2027-01-01', field2027)).toBe('cedo')
    expect(harvestFromDate('2027-01-20', field2027)).toBe('cedo')
    expect(harvestFromDate('2027-02-10', field2027)).toBe('cedo')
    expect(harvestFromDate('2027-02-11', field2027)).toBe('meio')
    expect(harvestFromDate('2027-02-20', field2027)).toBe('meio')
    expect(harvestFromDate('2027-02-21', field2027)).toBe('tarde')
    expect(harvestFromDate('2027-03-15', field2027)).toBe('tarde')
    expect(harvestFromDate('2027-04-30', field2027)).toBe('tarde')
  })

  it('fora do campo de data ou sem data, não vale', () => {
    expect(harvestFromDate('', field2027)).toBeNull()
    expect(harvestFromDate('2026-12-31', field2027)).toBeNull()
    expect(harvestFromDate('2027-05-01', field2027)).toBeNull()
    expect(harvestFromDate('2026-02-15', field2027)).toBeNull()
    expect(harvestFromDate('15/02/2027', field2027)).toBeNull()
  })
})

describe('bandDate', () => {
  it('o dia de colheita de cada faixa no motor (semeadura 3 dias depois)', () => {
    expect(bandDate('cedo', field2027)).toBe('2027-02-05')
    expect(bandDate('meio', field2027)).toBe('2027-02-15')
    expect(bandDate('tarde', field2027)).toBe('2027-02-28')
  })

  it('cada dia cai na própria faixa', () => {
    for (const band of ['cedo', 'meio', 'tarde'] as const) {
      expect(harvestFromDate(bandDate(band, field2027), field2027)).toBe(band)
    }
  })
})

describe('harvestChoice (o que o produtor escolheu, lido da URL)', () => {
  it('sem data e sem época, nada escolhido: a tela abre vazia', () => {
    expect(harvestChoice({}, field2027)).toBeNull()
    expect(harvestChoice(null, field2027)).toBeNull()
  })

  it('a data vale mais que a época, e a época sai da data', () => {
    expect(harvestChoice({ data: '2027-02-25', colheita: 'cedo' }, field2027)).toEqual({ band: 'tarde', date: '2027-02-25' })
    expect(harvestChoice({ data: '2027-03-03' }, field2027)).toEqual({ band: 'tarde', date: '2027-03-03' })
  })

  it('só a época ("Não sei o dia exato")', () => {
    expect(harvestChoice({ colheita: 'meio' }, field2027)).toEqual({ band: 'meio', date: null })
  })

  it('data fora do campo não vale: fica a época, se houver', () => {
    expect(harvestChoice({ data: '2027-05-10', colheita: 'meio' }, field2027)).toEqual({ band: 'meio', date: null })
    expect(harvestChoice({ data: '2026-02-10' }, field2027)).toBeNull()
  })
})

describe('choiceDay (o dia usado na chuva que sobra)', () => {
  it('a data escolhida ou, só com a época, o dia de colheita da época no motor', () => {
    expect(choiceDay({ band: 'tarde', date: '2027-03-03' }, field2027)).toBe('2027-03-03')
    expect(choiceDay({ band: 'meio', date: null }, field2027)).toBe('2027-02-15')
  })
})
