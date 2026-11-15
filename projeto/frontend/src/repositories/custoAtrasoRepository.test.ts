import { describe, expect, it, vi } from 'vitest'
import { createHttpCustoAtrasoRepository } from './custoAtrasoRepository'
import { createMockCustoAtrasoRepository } from './mocks/mockRepositories'

describe('custoAtrasoRepository (custo do atraso da colheita, tela 3)', () => {
  it('http chama /api/custo-atraso com lat e lon', async () => {
    const getJson = vi.fn().mockResolvedValue({ faixas: [], mesma_cultura: false })

    await createHttpCustoAtrasoRepository(getJson).get({ lat: -18.9543, lon: -48.1993 }, 'pt')

    expect(getJson).toHaveBeenCalledWith('/api/custo-atraso?lat=-18.9543&lon=-48.1993', { lang: 'pt' })
  })

  it('http leva o solo e as safras confirmadas, quando houver', async () => {
    const getJson = vi.fn().mockResolvedValue({ faixas: [], mesma_cultura: false })

    await createHttpCustoAtrasoRepository(getJson).get(
      { lat: -18.9543, lon: -48.1993, solo: 'arenoso', confirmadas: '2025:parado' },
      'en',
    )

    expect(getJson).toHaveBeenCalledWith(
      '/api/custo-atraso?lat=-18.9543&lon=-48.1993&solo=arenoso&confirmadas=2025:parado',
      { lang: 'en' },
    )
  })

  it('dados de exemplo: as 3 faixas, cedo, meio e tarde, em 20 anos', async () => {
    const custo = await createMockCustoAtrasoRepository(0).get({ lat: -18.9543, lon: -48.1993 }, 'pt')

    expect(custo.faixas.map((faixa) => faixa.colheita)).toEqual(['cedo', 'meio', 'tarde'])
    expect(custo.faixas.every((faixa) => faixa.total_anos === 20)).toBe(true)
  })
})
