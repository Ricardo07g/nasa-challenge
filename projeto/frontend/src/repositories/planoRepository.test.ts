import { describe, expect, it, vi } from 'vitest'
import { createMockPlanoRepository } from './mocks/mockPlano'
import { createHttpPlanoRepository } from './planoRepository'

describe('planoRepository (plano de 3 anos qualquer, tarefa 0045)', () => {
  it('http chama /api/plano com o ponto, a colheita e os 3 anos', async () => {
    const getJson = vi.fn().mockResolvedValue({})

    await createHttpPlanoRepository(getJson).get(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', anos: ['sorgo', 'pousio', 'crotalaria'] },
      'pt',
    )

    expect(getJson).toHaveBeenCalledWith(
      '/api/plano?lat=-18.9543&lon=-48.1993&colheita=meio&anos=sorgo,pousio,crotalaria',
      { lang: 'pt' },
    )
  })

  it('http leva o solo, quando houver', async () => {
    const getJson = vi.fn().mockResolvedValue({})

    await createHttpPlanoRepository(getJson).get(
      { lat: 1, lon: 2, colheita: 'tarde', anos: ['milheto', 'milheto', 'sorgo'], solo: 'arenoso' },
      'en',
    )

    expect(getJson).toHaveBeenCalledWith('/api/plano?lat=1&lon=2&colheita=tarde&anos=milheto,milheto,sorgo&solo=arenoso', {
      lang: 'en',
    })
  })

  it('dados de exemplo: os 3 anos pedidos, com as notas e o Plano A/B do 1º ano', async () => {
    const plano = await createMockPlanoRepository(0).get(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', anos: ['milho_braquiaria', 'pousio', 'crotalaria'] },
      'pt',
    )

    expect(plano.anos.map((ano) => ano.cultura)).toEqual(['milho_braquiaria', 'pousio', 'crotalaria'])
    expect(plano.anos[1]).toMatchObject({ nome: 'Deixar parado', anos_bons: null, usa_mm: null, cobre_terra: false })
    expect(plano.notas.seguranca).not.toBeNull()
    expect(plano.plano_ab?.cultura_a).toBe('milho_braquiaria')
    expect(plano.terra.total).toBe(3)
  })
})
