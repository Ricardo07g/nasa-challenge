import { describe, expect, it } from 'vitest'
import type { ChuvaQueSobra, Talhao } from '../models/talhao'
import type { DelayCost } from './delayCostService'
import { harvestBands } from './harvestBandsService'

const field2027 = { min: '2027-01-01', max: '2027-04-30' }

/** Valores redondos de teste (não são do GPM IMERG nem do motor). */
const SOBRA: ChuvaQueSobra = {
  fim: '06-30',
  percentil_seco: 20,
  dias: [
    { dia: '02-05', mediana_mm: 500.4, seco_mm: 400 },
    { dia: '02-15', mediana_mm: 450, seco_mm: 350 },
    { dia: '02-28', mediana_mm: 340, seco_mm: 240 },
    { dia: '03-03', mediana_mm: 320, seco_mm: 230 },
  ],
  anos: [2005, 2006],
  fonte: 'gpm_imerg',
}

const COST: DelayCost = {
  bands: [
    { band: 'cedo', crop: 'milho_braquiaria', good: 18, total: 20 },
    { band: 'tarde', crop: 'milheto', good: 20, total: 20 },
  ],
  sameCrop: false,
}

const talhao = { chuva_que_sobra: SOBRA } as Talhao

describe('harvestBands ("Compare as épocas" e a prévia das 3 barrinhas)', () => {
  it('sem escolha: as 3 épocas em ordem, com a chuva no dia de colheita de cada uma no motor', () => {
    expect(harvestBands(talhao, COST, null, field2027)).toEqual([
      { band: 'cedo', day: '2027-02-05', rainMm: 500, best: { crop: 'milho_braquiaria', good: 18, total: 20 }, yours: false },
      { band: 'meio', day: '2027-02-15', rainMm: 450, best: null, yours: false },
      { band: 'tarde', day: '2027-02-28', rainMm: 340, best: { crop: 'milheto', good: 20, total: 20 }, yours: false },
    ])
  })

  it('com a data escolhida, a época dela é a "sua" e usa o próprio dia na chuva', () => {
    const bands = harvestBands(talhao, COST, { band: 'tarde', date: '2027-03-03' }, field2027)

    expect(bands[2]).toEqual({
      band: 'tarde',
      day: '2027-03-03',
      rainMm: 320,
      best: { crop: 'milheto', good: 20, total: 20 },
      yours: true,
    })
    expect(bands.filter((band) => band.yours)).toHaveLength(1)
  })

  it('só com a época, ela é a "sua" e usa o dia de colheita da época no motor', () => {
    const bands = harvestBands(talhao, COST, { band: 'meio', date: null }, field2027)

    expect(bands[1]).toMatchObject({ band: 'meio', day: '2027-02-15', rainMm: 450, yours: true })
  })

  it('sem a chuva que sobra, ou com o dia fora da tabela, a chuva fica sem número (decisão D2)', () => {
    expect(harvestBands(undefined, null, null, field2027).map((band) => band.rainMm)).toEqual([null, null, null])
    expect(harvestBands(talhao, null, { band: 'tarde', date: '2027-04-10' }, field2027)[2].rainMm).toBeNull()
  })
})
