import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useSatelliteController } from './useSatelliteController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'

const talhao: Partial<Talhao> = {
  solo: { textura: 'argiloso', cad_mm: 75, fonte: 'soilgrids' },
  historico: {
    anos: [
      { ano: 2023, situacao: 'sem_dado', ndvi_max: null, n_obs: 1 },
      { ano: 2024, situacao: 'parado', ndvi_max: 0.42, n_obs: 12 },
      { ano: 2025, situacao: 'plantou', ndvi_max: 0.71, n_obs: 13 },
    ],
    parado: 1,
    plantou: 1,
    sem_certeza: 1,
    total: 3,
    fonte: 'MODIS MOD13Q1 + MYD13Q1',
    janela: '04-01 a 07-31',
  },
  dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
}

const cmip6 = { fonte: 'nex_gddp_cmip6', periodo: '2041-2060', cenario: 'ssp245', modelos: 3 }

/** Recomendação só com o que a tela 4 lê: os anos de chuva usados em cada opção. */
const recWithRainYears = (anos: number) =>
  ({ opcoes: [{ chuva: { anos } }, { chuva: { anos } }] }) as unknown as Recomendacao

function deps(
  load: () => Promise<Partial<Talhao>> = () => Promise.resolve(talhao),
  loadRec: () => Promise<Recomendacao> = () => Promise.resolve(recWithRainYears(20)),
) {
  const farm: FarmService = {
    talhao: vi.fn(() => load() as Promise<Talhao>),
    recomendacao: vi.fn(() => loadRec()),
  }
  return { farm }
}

describe('useSatelliteController (tela 4)', () => {
  it('mostra o que o satélite viu: histórico, chuva e terra', async () => {
    const d = deps()
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.history).toMatchObject({ idle: 1, planted: 1, uncertain: 1, known: 2, total: 3 })
    expect(result.current.history?.window).toEqual({ from: 4, to: 7 })
    expect(result.current.rain).toEqual({ years: 20, period: { start: '2005', end: '2024' }, skipped: 0 })
    expect(result.current.soil).toEqual({ textura: 'argiloso', source: 'map' })
    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: false }, 'pt')
  })

  it('chuva: o número de anos vem da recomendação (17 usados de fato), com o período do NASA POWER', async () => {
    const d = deps(undefined, () => Promise.resolve(recWithRainYears(17)))
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}&solo=arenoso`) })

    await waitFor(() => expect(result.current.rain?.years).toBe(17))
    expect(result.current.rain).toEqual({ years: 17, period: { start: '2005', end: '2024' }, skipped: 3 })
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', solo: 'arenoso', exemplo: false },
      'pt',
    )
  })

  it('sem a recomendação (falhou), a chuva conta pelo período do NASA POWER e a tela continua', async () => {
    const d = deps(undefined, () => Promise.reject(new Error('rede')))
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() => expect(d.farm.recomendacao).toHaveBeenCalled())
    expect(result.current.rain).toEqual({ years: 20, period: { start: '2005', end: '2024' }, skipped: 0 })
  })

  it('com o NEX-GDDP-CMIP6 no talhão, o clima dos próximos anos fica pronto', async () => {
    const d = deps(() => Promise.resolve({ ...talhao, dados: [...talhao.dados!, cmip6] }))
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.climate).toBe(true)
  })

  it('sem o CMIP6 no talhão, o clima dos próximos anos não fica pronto', async () => {
    const d = deps()
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.climate).toBe(false)
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

  it('talhão fora da área com dados preparados vira o estado "fora da área"', async () => {
    const d = deps(() => Promise.resolve({ ...talhao, dentro_da_area: false }))
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })
})
