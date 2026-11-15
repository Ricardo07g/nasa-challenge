import { act, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaceSuggestion } from '../models/place'
import type { FarmService } from '../services/farmService'
import type { GeocodingService } from '../services/geocodingService'
import { providers } from '../test/providers'
import { useWhereController } from './useWhereController'

const AREA = { min_lat: -19.9, max_lat: -18.4, min_lon: -49.0, max_lon: -47.5 }

const UBERABA: PlaceSuggestion = {
  id: 'R1',
  label: 'Uberaba',
  detail: 'Minas Gerais',
  point: { lat: -19.748, lon: -47.932 },
}

function deps(position = { lat: -19.0, lon: -48.0 }) {
  const farm: FarmService = { talhao: vi.fn().mockResolvedValue({}), recomendacao: vi.fn() }
  const positionService = { current: vi.fn().mockResolvedValue(position) }
  const geocoding = {
    canSearch: vi.fn((query: string) => query.trim().length >= 3),
    search: vi.fn().mockResolvedValue([UBERABA]),
    reverse: vi.fn().mockResolvedValue('Fazenda Maria Dória, Uberlândia, Minas Gerais'),
  } satisfies GeocodingService
  const pilotArea = { get: vi.fn().mockResolvedValue(AREA) }
  return { farm, positionService, geocoding, pilotArea }
}

/** Passa o tempo (a espera de 400 ms) e deixa as promessas responderem. */
const wait = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms))

function setup(d = deps(), url = '/onde') {
  const hook = renderHook(() => useWhereController(d), { wrapper: providers(url) })
  return { ...hook, d }
}

describe('useWhereController (tela "Onde fica a lavoura")', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('começa na fazenda de exemplo; até o endereço chegar, mostra a cidade de referência', async () => {
    const { result } = setup()

    expect(result.current.center).toEqual({ lat: -18.9543, lon: -48.1993 })
    expect(result.current.place).toBe('Uberlândia (MG)')
    await wait()
    expect(result.current.outside).toBe(false)
  })

  it('o endereço aproximado vem do Photon depois de 400 ms parado, no idioma da tela', async () => {
    const { result, d } = setup()

    await wait(399)
    expect(d.geocoding.reverse).not.toHaveBeenCalled()
    await wait(1)

    expect(d.geocoding.reverse).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993 }, 'pt', {
      signal: expect.any(AbortSignal),
    })
    expect(result.current.place).toBe('Fazenda Maria Dória, Uberlândia, Minas Gerais')
  })

  it('sem endereço (Photon fora do ar ou nada perto), fica a cidade de referência', async () => {
    const d = deps()
    d.geocoding.reverse.mockRejectedValue(new Error('429'))
    const { result } = setup(d)

    await wait(400)

    expect(result.current.place).toBe('Uberlândia (MG)')
  })

  it('volta ao ponto que já estava na URL', () => {
    const { result } = setup(deps(), '/onde?lat=-19.74&lon=-47.93')

    expect(result.current.center).toEqual({ lat: -19.74, lon: -47.93 })
    expect(result.current.place).toBe('Uberaba (MG)')
  })

  it('arrastar o mapa muda o ponto; fora da área piloto avisa e bloqueia o avanço', async () => {
    const { result, d } = setup()
    await wait()

    act(() => result.current.move({ lat: -15.8, lon: -47.9 }))
    act(() => result.current.confirm())

    expect(result.current.area).toEqual(AREA)
    expect(result.current.outside).toBe(true)
    expect(result.current.canConfirm).toBe(false)
    expect(d.farm.talhao).not.toHaveBeenCalled()
    expect(screen.getByTestId('location')).toHaveTextContent('/onde')
  })

  it('enquanto a área piloto carrega, ainda não confirma', () => {
    const d = deps()
    d.pilotArea.get.mockReturnValue(new Promise(() => {}))
    const { result } = setup(d)

    expect(result.current.area).toBeNull()
    expect(result.current.canConfirm).toBe(false)
  })

  it('se a área piloto não carregar, deixa seguir (a API ainda responde "fora da área" nas próximas telas)', async () => {
    const d = deps()
    d.pilotArea.get.mockRejectedValue(new Error('fora do ar'))
    const { result } = setup(d)
    await wait()

    expect(result.current.area).toBeNull()
    expect(result.current.outside).toBe(false)
    expect(result.current.canConfirm).toBe(true)
  })

  it('"Usar onde estou agora" centraliza no GPS', async () => {
    const { result } = setup(deps({ lat: -19.1, lon: -48.1 }))

    act(() => result.current.useMyLocation())
    expect(result.current.locating).toBe(true)
    await wait()

    expect(result.current.center).toEqual({ lat: -19.1, lon: -48.1 })
    expect(result.current.locating).toBe(false)
  })

  it('mostra erro quando o GPS falha', async () => {
    const d = deps()
    d.positionService.current.mockRejectedValueOnce(new Error('negado'))
    const { result } = setup(d)

    act(() => result.current.useMyLocation())
    await wait()

    expect(result.current.locationError).toBe(true)
  })

  it('"Confirmar local" já busca o talhão e vai para a pergunta 2', async () => {
    const { result, d } = setup()
    await wait()

    expect(result.current.canConfirm).toBe(true)
    act(() => result.current.confirm())

    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993 }, 'pt')
    expect(screen.getByTestId('location')).toHaveTextContent('/quando?lat=-18.9543&lon=-48.1993')
  })
})

describe('useWhereController: busca de endereço', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('busca 400 ms depois da última tecla, com o centro da área piloto como preferência', async () => {
    const { result, d } = setup()
    await wait()

    act(() => result.current.changeQuery('ube'))
    expect(result.current.query).toBe('ube')
    expect(result.current.searchStatus).toBe('loading')
    await wait(200)
    act(() => result.current.changeQuery('uberaba'))
    await wait(400)

    expect(d.geocoding.search).toHaveBeenCalledTimes(1)
    expect(d.geocoding.search).toHaveBeenCalledWith('uberaba', 'pt', {
      near: { lat: -19.15, lon: -48.25 },
      signal: expect.any(AbortSignal),
    })
    expect(result.current.searchStatus).toBe('ready')
    expect(result.current.options).toEqual([{ kind: 'place', ...UBERABA }])
  })

  it('com menos de 3 letras não busca', async () => {
    const { result, d } = setup()

    act(() => result.current.changeQuery('ub'))
    await wait(1000)

    expect(d.geocoding.search).not.toHaveBeenCalled()
    expect(result.current.searchStatus).toBe('idle')
    expect(result.current.options).toEqual([])
  })

  it('a busca que falhou vira o estado de erro', async () => {
    const d = deps()
    d.geocoding.search.mockRejectedValue(new Error('429'))
    const { result } = setup(d)

    act(() => result.current.changeQuery('uberaba'))
    await wait(400)

    expect(result.current.searchStatus).toBe('error')
  })

  it('escolher um lugar leva o mapa até ele, põe o nome no campo e fecha a lista sem buscar de novo', async () => {
    const { result, d } = setup()
    act(() => result.current.changeQuery('uberaba'))
    await wait(400)

    act(() => result.current.selectOption(result.current.options[0]))
    await wait(1000)

    expect(result.current.center).toEqual(UBERABA.point)
    expect(result.current.query).toBe('Uberaba')
    expect(result.current.options).toEqual([])
    expect(result.current.searchStatus).toBe('idle')
    expect(d.geocoding.search).toHaveBeenCalledTimes(1)
  })

  it('coordenadas coladas viram uma opção "ir para o ponto", sem chamar o Photon', async () => {
    const { result, d } = setup()

    act(() => result.current.changeQuery('-19,5; -48,0'))
    await wait(400)

    expect(d.geocoding.search).not.toHaveBeenCalled()
    expect(result.current.options).toEqual([
      { kind: 'point', id: 'ponto-colado', source: 'coordinates', point: { lat: -19.5, lon: -48.0 } },
    ])

    act(() => result.current.selectOption(result.current.options[0]))
    expect(result.current.center).toEqual({ lat: -19.5, lon: -48.0 })
    expect(result.current.options).toEqual([])
  })

  it('link do Google Maps colado vira o ponto do link', () => {
    const { result } = setup()

    act(() => result.current.changeQuery('https://www.google.com/maps/@-19.2,-48.3,15z'))

    expect(result.current.options).toEqual([
      { kind: 'point', id: 'ponto-colado', source: 'link', point: { lat: -19.2, lon: -48.3 } },
    ])
    expect(result.current.notice).toBeNull()
  })

  it('link curto: avisa que não dá para abrir e não busca', async () => {
    const { result, d } = setup()

    act(() => result.current.changeQuery('https://maps.app.goo.gl/AbCdEf123'))
    await wait(400)

    expect(result.current.notice).toBe('short-link')
    expect(result.current.options).toEqual([])
    expect(d.geocoding.search).not.toHaveBeenCalled()
  })

  it('link sem coordenadas e coordenadas impossíveis também avisam', () => {
    const { result } = setup()

    act(() => result.current.changeQuery('https://www.google.com/maps/place/Uberaba,+MG'))
    expect(result.current.notice).toBe('link-without-point')

    act(() => result.current.changeQuery('95, -48'))
    expect(result.current.notice).toBe('invalid-coordinates')
  })
})
