import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Talhao } from '../models/talhao'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useSatelliteController } from './useSatelliteController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'

const talhao: Partial<Talhao> = {
  solo: { textura: 'argiloso', cad_mm: 75, fonte: 'soilgrids' },
  historico: {
    anos: [
      { ano: 2024, situacao: 'parado', ndvi_max: 0.42 },
      { ano: 2025, situacao: 'plantou', ndvi_max: 0.71 },
    ],
    parado: 1,
    total: 2,
    fonte: 'modis_mod13q1',
  },
  dados: [{ fonte: 'gpm_imerg', periodo: '2006-2025' }],
}

function deps(load: () => Promise<Partial<Talhao>> = () => Promise.resolve(talhao)) {
  const farm: FarmService = {
    talhao: vi.fn(() => load() as Promise<Talhao>),
    recomendacao: vi.fn().mockResolvedValue({}),
  }
  return { farm }
}

describe('useSatelliteController (tela 4)', () => {
  it('mostra o que o satélite viu: histórico, chuva e terra', async () => {
    const d = deps()
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.history).toMatchObject({ idle: 1, planted: 1, total: 2 })
    expect(result.current.rain).toEqual({ start: '2006', end: '2025' })
    expect(result.current.soil).toEqual({ textura: 'argiloso', source: 'map' })
    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: false }, 'pt')
  })

  it('a terra escolhida pela pessoa fica na URL e vale mais que o mapa', async () => {
    const d = deps()
    const { result } = renderHook(() => useSatelliteController(d), {
      wrapper: providers(`/satelite?${flow}&solo=arenoso`),
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.soil).toEqual({ textura: 'arenoso', source: 'user' })
  })

  it('"Não é? Trocar" abre a escolha; escolher grava na URL e fecha', async () => {
    const d = deps()
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.toggleSoil())
    expect(result.current.soilOpen).toBe(true)
    act(() => result.current.chooseSoil('arenoso'))

    expect(screen.getByTestId('location')).toHaveTextContent(`/satelite?${flow}&solo=arenoso`)
    expect(result.current.soilOpen).toBe(false)
  })

  it('se os dados não vierem, mostra o erro e tenta de novo', async () => {
    let calls = 0
    const d = deps(() => (++calls === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(talhao)))
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('"Ver o que plantar" leva o caminho todo para a resposta e já pede a recomendação', async () => {
    const d = deps()
    const { result } = renderHook(() => useSatelliteController(d), {
      wrapper: providers(`/satelite?${flow}&solo=arenoso`),
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.confirm())

    expect(screen.getByTestId('location')).toHaveTextContent(`/resposta?${flow}&solo=arenoso`)
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', solo: 'arenoso', exemplo: false },
      'pt',
    )
  })

  it('o Voltar leva para a pergunta da colheita', () => {
    const d = deps()
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    expect(result.current.backTo).toBe(`/quando?${flow}`)
    expect(result.current.redirectTo).toBeNull()
  })

  it('sem ponto volta para o mapa; sem colheita volta para a pergunta 2', () => {
    const d = deps()
    const noPoint = renderHook(() => useSatelliteController(d), { wrapper: providers('/satelite') })
    const noHarvest = renderHook(() => useSatelliteController(d), {
      wrapper: providers('/satelite?lat=-18.9543&lon=-48.1993'),
    })

    expect(noPoint.result.current.redirectTo).toBe('/onde')
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })
})
