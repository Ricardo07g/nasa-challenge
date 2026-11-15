import { act, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lang } from '../i18n/language'
import type { FarmService } from '../services/farmService'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { useWhereController } from './useWhereController'

const AREA = { min_lat: -19.9, max_lat: -18.4, min_lon: -49.0, max_lon: -47.5 }
const DEMO = { lat: -18.9543, lon: -48.1993 }

function deps(position = { lat: -19.0, lon: -48.0 }) {
  const farm: FarmService = { talhao: vi.fn().mockResolvedValue({}), recomendacao: vi.fn() }
  const positionService = { current: vi.fn().mockResolvedValue(position) }
  const geocoding = { reverse: vi.fn().mockResolvedValue('Fazenda Maria Dória, Uberlândia, Minas Gerais') }
  const pilotArea = { get: vi.fn().mockResolvedValue(AREA) }
  const speech: SpeechService = { isSupported: () => true, speak: vi.fn(), stop: vi.fn() }
  return { farm, positionService, geocoding, pilotArea, speech }
}

/** Passa o tempo (a espera de 400 ms do Photon) e deixa as promessas responderem. */
const wait = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms))

function setup(d = deps(), url = '/onde', lang: Lang = 'pt') {
  const hook = renderHook(() => useWhereController(d), { wrapper: providers(url, lang) })
  return { ...hook, d }
}

describe('useWhereController (tela "Onde fica a lavoura", tarefa 0053)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('abre sem ponto marcado, mostrando a área inteira, e sem pedir endereço ao Photon', async () => {
    const { result, d } = setup()
    await wait(1000)

    expect(result.current.point).toBeNull()
    expect(result.current.status).toBe('empty')
    expect(result.current.canConfirm).toBe(false)
    expect(result.current.view.target).toBe('area')
    expect(result.current.area).toEqual(AREA)
    expect(d.geocoding.reverse).not.toHaveBeenCalled()
  })

  it('volta ao ponto que já estava na URL, chegando perto dele', () => {
    const { result } = setup(deps(), '/onde?lat=-19.74&lon=-47.93')

    expect(result.current.point).toEqual({ lat: -19.74, lon: -47.93 })
    expect(result.current.demo).toBe(false)
    expect(result.current.view.target).toBe('point')
    expect(result.current.place).toBe('Uberaba (MG)')
  })

  it('volta à lavoura de demonstração (exemplo=1 na URL) com o nome dela', () => {
    const { result } = setup(deps(), '/onde?lat=-18.9543&lon=-48.1993&exemplo=1')

    expect(result.current.point).toEqual(DEMO)
    expect(result.current.demo).toBe(true)
  })

  it('tocar no mapa marca o ponto, sem mexer no enquadre', async () => {
    const { result } = setup()
    await wait()
    const view = result.current.view

    act(() => result.current.pick({ lat: -19.0, lon: -48.2 }))

    expect(result.current.point).toEqual({ lat: -19.0, lon: -48.2 })
    expect(result.current.status).toBe('marked')
    expect(result.current.canConfirm).toBe(true)
    expect(result.current.view).toEqual(view)
  })

  it('o endereço aproximado vem do Photon 400 ms depois de o ponto parar; antes, a cidade de referência', async () => {
    const { result, d } = setup()
    await wait()

    act(() => result.current.pick({ lat: -18.9543, lon: -48.1993 }))
    expect(result.current.place).toBe('Uberlândia (MG)')
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
    const { result } = setup(d, '/onde?lat=-19.74&lon=-47.93')

    await wait(400)

    expect(result.current.place).toBe('Uberaba (MG)')
  })

  it('ponto fora da área do MVP: avisa e não deixa confirmar', async () => {
    const { result, d } = setup()
    await wait()

    act(() => result.current.pick({ lat: -17.78, lon: -50.92 }))
    act(() => result.current.confirm())

    expect(result.current.status).toBe('outside')
    expect(result.current.canConfirm).toBe(false)
    expect(d.farm.talhao).not.toHaveBeenCalled()
    expect(screen.getByTestId('location')).toHaveTextContent('/onde')
  })

  it('enquanto a área carrega, o Confirmar espera', () => {
    const d = deps()
    d.pilotArea.get.mockReturnValue(new Promise(() => {}))
    const { result } = setup(d, '/onde?lat=-19&lon=-48.2')

    expect(result.current.area).toBeNull()
    expect(result.current.canConfirm).toBe(false)
  })

  it('se a área não carregar, deixa seguir (a API ainda responde "fora da área" nas próximas telas)', async () => {
    const d = deps()
    d.pilotArea.get.mockRejectedValue(new Error('fora do ar'))
    const { result } = setup(d, '/onde?lat=-17.78&lon=-50.92')
    await wait()

    expect(result.current.status).toBe('marked')
    expect(result.current.canConfirm).toBe(true)
  })

  it('"Usar a lavoura de demonstração" marca o ponto dela e chega perto, sem pedir endereço', async () => {
    const { result, d } = setup()
    await wait()
    const seq = result.current.view.seq

    act(() => result.current.useDemo())
    await wait(1000)

    expect(result.current.point).toEqual(DEMO)
    expect(result.current.demo).toBe(true)
    expect(result.current.view).toEqual({ target: 'point', seq: seq + 1 })
    expect(d.geocoding.reverse).not.toHaveBeenCalled()
  })

  it('arrastar o alfinete da lavoura de demonstração vira um ponto comum', async () => {
    const { result } = setup()
    await wait()

    act(() => result.current.useDemo())
    act(() => result.current.pick({ lat: -18.96, lon: -48.19 }))

    expect(result.current.demo).toBe(false)
  })

  it('"Usar onde estou agora": procura (aria-busy na tela) e chega perto do ponto do GPS', async () => {
    const { result } = setup(deps({ lat: -19.1, lon: -48.1 }))
    await wait()
    const seq = result.current.view.seq

    act(() => result.current.useMyLocation())
    expect(result.current.gps).toBe('locating')
    await wait()

    expect(result.current.gps).toBe('idle')
    expect(result.current.point).toEqual({ lat: -19.1, lon: -48.1 })
    expect(result.current.view).toEqual({ target: 'point', seq: seq + 1 })
  })

  it('GPS que falha: mostra o erro sem ponto; marcar um ponto tira o erro', async () => {
    const d = deps()
    d.positionService.current.mockRejectedValueOnce(new Error('negado'))
    const { result } = setup(d)

    act(() => result.current.useMyLocation())
    await wait()

    expect(result.current.gps).toBe('error')
    expect(result.current.status).toBe('empty')
    expect(result.current.canConfirm).toBe(false)

    act(() => result.current.pick({ lat: -19.0, lon: -48.2 }))
    expect(result.current.gps).toBe('idle')
  })

  it('"Ver a área inteira" do mapa enquadra a área de novo', async () => {
    const { result } = setup(deps(), '/onde?lat=-19&lon=-48.2')
    const seq = result.current.view.seq

    act(() => result.current.showArea())

    expect(result.current.view).toEqual({ target: 'area', seq: seq + 1 })
  })

  it('"Confirmar local" já busca o talhão e vai para a pergunta seguinte com o ponto na URL', async () => {
    const { result, d } = setup()
    await wait()

    act(() => result.current.pick({ lat: -19.123456, lon: -48.234567 }))
    act(() => result.current.confirm())

    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -19.1235, lon: -48.2346 }, 'pt')
    expect(screen.getByTestId('location')).toHaveTextContent('/quando?lat=-19.1235&lon=-48.2346')
  })

  it('confirmar a lavoura de demonstração leva o exemplo=1 (não vira o ponto salvo dos avisos)', async () => {
    const { result, d } = setup()
    await wait()

    act(() => result.current.useDemo())
    act(() => result.current.confirm())

    expect(d.farm.talhao).toHaveBeenCalledWith({ ...DEMO, exemplo: true }, 'pt')
    expect(screen.getByTestId('location')).toHaveTextContent('/quando?lat=-18.9543&lon=-48.1993&exemplo=1')
  })
})

describe('useWhereController: modal "Outras formas de marcar"', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('abre, e o que não dá para entender mostra "Não entendi" sem fechar', async () => {
    const { result } = setup()
    await wait()

    act(() => result.current.other.onOpen())
    expect(result.current.other.open).toBe(true)

    act(() => result.current.other.onChange('Uberaba'))
    act(() => result.current.other.onSubmit())

    expect(result.current.other.error).toBe(true)
    expect(result.current.other.open).toBe(true)
    expect(result.current.point).toBeNull()
  })

  it('mudar o texto tira o aviso', async () => {
    const { result } = setup()
    await wait()
    act(() => result.current.other.onOpen())
    act(() => result.current.other.onSubmit())
    expect(result.current.other.error).toBe(true)

    act(() => result.current.other.onChange('-19'))

    expect(result.current.other.error).toBe(false)
  })

  it('"Usar este ponto": fecha o modal, marca o ponto e centraliza o mapa nele', async () => {
    const { result } = setup()
    await wait()
    const seq = result.current.view.seq

    act(() => result.current.other.onOpen())
    act(() => result.current.other.onChange('https://www.google.com/maps/@-19.2,-48.3,15z'))
    act(() => result.current.other.onSubmit())

    expect(result.current.other.open).toBe(false)
    expect(result.current.point).toEqual({ lat: -19.2, lon: -48.3 })
    expect(result.current.view).toEqual({ target: 'point', seq: seq + 1 })
  })

  it('fechar tira o aviso de "Não entendi"', async () => {
    const { result } = setup()
    await wait()
    act(() => result.current.other.onOpen())
    act(() => result.current.other.onSubmit())

    act(() => result.current.other.onClose())

    expect(result.current.other.open).toBe(false)
    expect(result.current.other.error).toBe(false)
  })
})

describe('useWhereController: modal "Onde o app funciona"', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('"Saiba mais" abre; "Ver a área inteira" fecha o modal e enquadra a área', async () => {
    const { result } = setup(deps(), '/onde?lat=-19&lon=-48.2')
    const seq = result.current.view.seq

    act(() => result.current.areaInfo.onOpen())
    expect(result.current.areaInfo.open).toBe(true)

    act(() => result.current.areaInfo.onShowArea())

    expect(result.current.areaInfo.open).toBe(false)
    expect(result.current.view).toEqual({ target: 'area', seq: seq + 1 })
  })

  it('o X fecha sem mexer no mapa', async () => {
    const { result } = setup()
    const view = result.current.view
    act(() => result.current.areaInfo.onOpen())

    act(() => result.current.areaInfo.onClose())

    expect(result.current.areaInfo.open).toBe(false)
    expect(result.current.view).toEqual(view)
  })
})

describe('useWhereController: "Ouvir resumo"', () => {
  it('fala só o resumo desta tela, no idioma da tela', () => {
    const d = deps()
    const { result } = setup(d, '/onde', 'en')

    act(() => result.current.listen.toggle())

    expect(d.speech.speak).toHaveBeenCalledWith(
      'Mark where your field is. Tap the map, use your current location or the demo field. This first version works in the Uberlândia and Uberaba region. Then tap Confirm location.',
      'en',
      expect.any(Function),
    )
    expect(result.current.listen.speaking).toBe(true)
  })
})
