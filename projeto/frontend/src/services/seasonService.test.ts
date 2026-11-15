import { describe, expect, it } from 'vitest'
import {
  afterSoyMonths,
  afterSoyPeriod,
  CURRENT_SEASON,
  LAST_SEASONS,
  satellitePeriod,
  seasonName,
  soyPeriod,
} from './seasonService'

describe('safra, não ano (regra geral 4 do pacote 2)', () => {
  it('a safra atual é a 2026/27 (ano da colheita 2027), numa constante só', () => {
    expect(CURRENT_SEASON).toBe(2027)
    expect(seasonName(CURRENT_SEASON)).toBe('2026/27')
  })

  it('as últimas safras são as 3 antes da atual, em ordem', () => {
    expect(LAST_SEASONS).toEqual([2024, 2025, 2026])
  })

  it('o nome da safra sai do ano da colheita da soja', () => {
    expect(seasonName(2026)).toBe('2025/26')
    expect(seasonName(2017)).toBe('2016/17')
    expect(seasonName(2000)).toBe('1999/00')
  })

  it('o período que o satélite leu (jan a jul do ano da colheita), em pt e en', () => {
    expect(satellitePeriod(2024, 'pt')).toBe('jan–jul 2024')
    expect(satellitePeriod(2024, 'en')).toBe('Jan–Jul 2024')
  })

  it('o "depois da soja" da safra (mar a jul do ano da colheita), curto, em pt e en', () => {
    expect(afterSoyPeriod(2027, 'pt')).toBe('mar–jul de 2027')
    expect(afterSoyPeriod(2027, 'en')).toBe('Mar–Jul 2027')
  })

  it('o "depois da soja" por extenso, para as perguntas', () => {
    expect(afterSoyMonths(2024, 'pt')).toBe('de março a julho de 2024')
    expect(afterSoyMonths(2024, 'en')).toBe('March to July 2024')
  })

  it('quando a soja da safra foi plantada e colhida, em pt e en', () => {
    expect(soyPeriod(2024, 'pt')).toBe('plantada no fim de 2023, colhida no começo de 2024')
    expect(soyPeriod(2024, 'en')).toBe('planted in late 2023, harvested in early 2024')
  })
})
