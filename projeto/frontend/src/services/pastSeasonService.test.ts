import { describe, expect, it, vi } from 'vitest'
import { PAST_YEARS, createPastSeasonService, isWarning, pastYearKind, readPastYear } from './pastSeasonService'

describe('pastSeasonService (P4)', () => {
  it('os anos do replay: 2024 (seco) e 2023 (bom)', () => {
    expect(PAST_YEARS).toEqual([2024, 2023])
  })

  it('o ano vem da URL; fora da lista, fica em 2024', () => {
    expect(readPastYear('2023')).toBe(2023)
    expect(readPastYear(null)).toBe(2024)
    expect(readPastYear('1999')).toBe(2024)
  })

  it('2024 foi um ano seco; 2023, um ano bom', () => {
    expect(pastYearKind(2024)).toBe('seco')
    expect(pastYearKind(2023)).toBe('bom')
  })

  it('avisos são os de veranico e calor', () => {
    expect(isWarning('aviso_veranico')).toBe(true)
    expect(isWarning('aviso_calor')).toBe(true)
    expect(isWarning('semeadura')).toBe(false)
  })

  it('busca a safra no repositório', async () => {
    const repository = { get: vi.fn().mockResolvedValue({ ano: 2023 }) }

    await createPastSeasonService(repository).get({ lat: 1, lon: 2 }, 2023, 'pt')

    expect(repository.get).toHaveBeenCalledWith({ lat: 1, lon: 2 }, 2023, 'pt')
  })
})
