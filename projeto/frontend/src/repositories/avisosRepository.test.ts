import { describe, expect, it, vi } from 'vitest'
import { createHttpAvisosRepository } from './avisosRepository'
import { createMockAvisosRepository } from './mocks/mockAvisos'

describe('avisosRepository (tela "Avisos", tarefa 0046 do backend)', () => {
  it('http chama /api/avisos com lat e lon do ponto salvo', async () => {
    const getJson = vi.fn().mockResolvedValue({})

    await createHttpAvisosRepository(getJson).get({ lat: -18.9543, lon: -48.1993 }, 'pt')

    expect(getJson).toHaveBeenCalledWith('/api/avisos?lat=-18.9543&lon=-48.1993', { lang: 'pt' })
  })

  it('http leva a colheita, o solo e as safras confirmadas, quando houver', async () => {
    const getJson = vi.fn().mockResolvedValue({})

    await createHttpAvisosRepository(getJson).get(
      { lat: -18.9543, lon: -48.1993, colheita: 'tarde', solo: 'arenoso', confirmadas: '2025:parado' },
      'en',
    )

    expect(getJson).toHaveBeenCalledWith(
      '/api/avisos?lat=-18.9543&lon=-48.1993&colheita=tarde&solo=arenoso&confirmadas=2025:parado',
      { lang: 'en' },
    )
  })

  it('dados de exemplo: os quatro grupos, o contador e o ponto pedido', async () => {
    const avisos = await createMockAvisosRepository(0).get({ lat: -18.9, lon: -48.2 }, 'pt')

    expect(avisos.ponto).toEqual({ lat: -18.9, lon: -48.2 })
    expect(avisos.agora.avisos.map((a) => a.tipo)).toContain('enso')
    expect(avisos.mudou?.avisos.length).toBeGreaterThan(0)
    expect(avisos.recordes?.avisos.length).toBeGreaterThan(0)
    expect(avisos.perto).not.toBeNull()
    expect(avisos.contador).toBe(avisos.agora.avisos.length + (avisos.perto?.avisos.length ?? 0))
  })
})
