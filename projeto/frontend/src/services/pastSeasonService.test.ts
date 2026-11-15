import { describe, expect, it, vi } from 'vitest'
import { createPastSeasonService, isWarning } from './pastSeasonService'

describe('pastSeasonService (P4)', () => {
  it('avisos são os de veranico e calor', () => {
    expect(isWarning('aviso_veranico')).toBe(true)
    expect(isWarning('aviso_calor')).toBe(true)
    expect(isWarning('semeadura')).toBe(false)
  })

  it('busca a safra no repositório', async () => {
    const repository = { get: vi.fn().mockResolvedValue({ ano: 2023 }) }

    await createPastSeasonService(repository).get({ lat: 1, lon: 2 }, 2023, 'pt')

    expect(repository.get).toHaveBeenCalledWith({ lat: 1, lon: 2 }, 2023, 'pt', {})
  })

  it('repassa a faixa de colheita e a opção do detalhe de um ano (tarefa 0044)', async () => {
    const repository = { get: vi.fn().mockResolvedValue({ ano: 2016 }) }

    await createPastSeasonService(repository).get({ lat: 1, lon: 2 }, 2016, 'pt', { colheita: 'meio', opcao: 'sorgo' })

    expect(repository.get).toHaveBeenCalledWith({ lat: 1, lon: 2 }, 2016, 'pt', { colheita: 'meio', opcao: 'sorgo' })
  })
})
