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

  it('http leva a cultura do 1º ano do plano (tarefa 0065); sem ela, nada de `cultura`', async () => {
    const getJson = vi.fn().mockResolvedValue({})
    const repository = createHttpAvisosRepository(getJson)

    await repository.get({ lat: -18.9543, lon: -48.1993, colheita: 'tarde' }, 'pt', 'sorgo')
    await repository.get({ lat: -18.9543, lon: -48.1993 }, 'pt', null)

    expect(getJson).toHaveBeenNthCalledWith(1, '/api/avisos?lat=-18.9543&lon=-48.1993&colheita=tarde&cultura=sorgo', { lang: 'pt' })
    expect(getJson).toHaveBeenNthCalledWith(2, '/api/avisos?lat=-18.9543&lon=-48.1993', { lang: 'pt' })
  })

  it('dados de exemplo: os grupos, o contador (só o "Agora") e o ponto pedido; sem os vizinhos', async () => {
    const avisos = await createMockAvisosRepository(0).get({ lat: -18.9, lon: -48.2 }, 'pt')

    expect(avisos.ponto).toEqual({ lat: -18.9, lon: -48.2 })
    expect(avisos.agora.avisos.map((a) => a.tipo)).toContain('enso')
    expect(avisos.mudou?.avisos.length).toBeGreaterThan(0)
    expect(avisos.recordes?.avisos.length).toBeGreaterThan(0)
    expect(avisos.perto).toBeNull()
    expect(avisos.contador).toBe(avisos.agora.avisos.length)
  })

  it('dados de exemplo com a cultura do plano: os quadros da cultura falam dela; no pousio, saem', async () => {
    const repository = createMockAvisosRepository(0)
    const crops = (avisos: Awaited<ReturnType<typeof repository.get>>) =>
      (avisos.mudou?.avisos ?? [])
        .filter((a) => a.tipo === 'mudou_falta_agua' || a.tipo === 'mudou_deu_certo')
        .map((a) => [a.valores.cultura, a.valores.nome])

    const sorgo = await repository.get({ lat: -18.9, lon: -48.2, colheita: 'tarde' }, 'pt', 'sorgo')
    const pousio = await repository.get({ lat: -18.9, lon: -48.2, colheita: 'tarde' }, 'pt', 'pousio')

    expect(crops(sorgo)).toEqual([
      ['sorgo', 'Sorgo'],
      ['sorgo', 'Sorgo'],
    ])
    expect(crops(pousio)).toEqual([])
  })
})
