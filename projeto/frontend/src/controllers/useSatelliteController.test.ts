import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RaioX } from '../models/raioX'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { ApiError } from '../repositories/httpClient'
import type { CommunityService } from '../services/communityService'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import type { FarmService } from '../services/farmService'
import type { RaioXService } from '../services/raioXService'
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

const RAIO = buildRaioX({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')

function deps(
  load: () => Promise<Partial<Talhao>> = () => Promise.resolve(talhao),
  loadRec: () => Promise<Recomendacao> = () => Promise.resolve(recWithRainYears(20)),
  loadRaio: () => Promise<RaioX> = () => Promise.resolve(RAIO),
) {
  const farm: FarmService = {
    talhao: vi.fn(() => load() as Promise<Talhao>),
    recomendacao: vi.fn(() => loadRec()),
  }
  const raioX: RaioXService = { get: vi.fn(() => loadRaio()) }
  return { farm, raioX }
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
    expect(result.current.climate).toEqual({ period: { start: '2041', end: '2060' } })
  })

  it('sem o CMIP6 no talhão, o clima dos próximos anos não fica pronto', async () => {
    const d = deps()
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.climate).toBeNull()
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

  describe('confirmação das últimas safras (tarefa 0039)', () => {
    const confirmable: Partial<Talhao> = { ...talhao, anos_confirmaveis: [2024, 2025, 2026] }

    it('lista as 3 últimas safras, com o que o satélite viu (sem dado começa vazio)', async () => {
      const d = deps(() => Promise.resolve(confirmable))
      const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

      await waitFor(() => expect(result.current.status).toBe('ready'))
      expect(result.current.confirmations).toEqual([
        { year: 2024, satellite: 'parado', choice: null },
        { year: 2025, satellite: 'plantou', choice: null },
        { year: 2026, satellite: null, choice: null },
      ])
    })

    it('marcar uma safra grava na URL e a resposta vale no lugar do satélite', async () => {
      const d = deps(() => Promise.resolve(confirmable))
      const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })
      await waitFor(() => expect(result.current.status).toBe('ready'))

      act(() => result.current.confirmSeason(2025, 'parado'))

      expect(screen.getByTestId('location')).toHaveTextContent(`/satelite?${flow}&confirmadas=2025:parado`)
      await waitFor(() => expect(result.current.history).toMatchObject({ idle: 2, planted: 0, known: 2, confirmed: 1 }))
      expect(result.current.confirmations[1]).toEqual({ year: 2025, satellite: 'plantou', choice: 'parado' })
    })

    it('tocar de novo na resposta marcada tira a confirmação da URL', async () => {
      const d = deps(() => Promise.resolve(confirmable))
      const { result } = renderHook(() => useSatelliteController(d), {
        wrapper: providers(`/satelite?${flow}&confirmadas=2024:plantou,2025:parado`),
      })
      await waitFor(() => expect(result.current.status).toBe('ready'))

      act(() => result.current.confirmSeason(2025, null))

      expect(screen.getByTestId('location')).toHaveTextContent(`/satelite?${flow}&confirmadas=2024:plantou`)
    })

    it('"Ver o que plantar" leva as safras confirmadas para a resposta e para a recomendação', async () => {
      const d = deps(() => Promise.resolve(confirmable))
      const { result } = renderHook(() => useSatelliteController(d), {
        wrapper: providers(`/satelite?${flow}&confirmadas=2026:plantou`),
      })
      await waitFor(() => expect(result.current.status).toBe('ready'))

      act(() => result.current.confirm())

      expect(screen.getByTestId('location')).toHaveTextContent(`/resposta?${flow}&confirmadas=2026:plantou`)
      expect(d.farm.recomendacao).toHaveBeenLastCalledWith(
        { lat: -18.9543, lon: -48.1993, colheita: 'meio', solo: undefined, exemplo: false, confirmadas: '2026:plantou' },
        'pt',
      )
    })

    it('nenhum ano com soja no ponto: avisa e oferece ajustar no mapa', async () => {
      const semSoja = {
        ...confirmable,
        historico: {
          ...talhao.historico!,
          anos: talhao.historico!.anos.map((a) => ({ ...a, situacao: 'sem_soja' as const, ndvi_max: null, n_obs: 0 })),
          parado: 0,
          plantou: 0,
          sem_certeza: 0,
          sem_soja: 3,
        },
      }
      const d = deps(() => Promise.resolve(semSoja))
      const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

      await waitFor(() => expect(result.current.status).toBe('ready'))
      expect(result.current.noSoy).toBe(true)
      expect(result.current.history).toBeNull()
      expect(result.current.adjustTo).toBe(`/onde?${flow}`)
    })
  })

  it('talhão fora da área com dados preparados vira o estado "fora da área"', async () => {
    const d = deps(() => Promise.resolve({ ...talhao, dentro_da_area: false }))
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })

  describe('raio-X da sua terra (tarefa 0043)', () => {
    it('pede o raio-X com a colheita e a terra da URL, sem as safras confirmadas', async () => {
      const d = deps()
      renderHook(() => useSatelliteController(d), {
        wrapper: providers(`/satelite?${flow}&solo=arenoso&confirmadas=2025:parado`),
      })

      await waitFor(() =>
        expect(d.raioX.get).toHaveBeenCalledWith(
          { lat: -18.9543, lon: -48.1993, colheita: 'meio', solo: 'arenoso' },
          'pt',
        ),
      )
    })

    it('monta o painel com os blocos, o lugar e o ponto', async () => {
      const d = deps()
      const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

      await waitFor(() => expect(result.current.xray).not.toBeNull())
      expect(result.current.xray?.blocks.map((block) => block.kind)).toEqual([
        'soil', 'water', 'moisture', 'green', 'rain', 'dryspell', 'heat', 'region',
      ]) // prettier-ignore
      expect(result.current.xray?.place).toBe('Uberlândia (MG)')
      expect(result.current.xray?.point).toEqual({ lat: -18.9543, lon: -48.1993 })
      expect(result.current.alerts.map((alert) => alert.kind)).toEqual(['heavyRain'])
      expect(result.current.cards?.chuva_20_anos?.anos_bons).toBe(16)
    })

    it('a faixa de calor usa o histórico com as safras confirmadas', async () => {
      const raio: RaioX = {
        ...RAIO,
        historico_ndvi: { ...RAIO.historico_ndvi!, anos: [{ ano: 2025, valores: [0.8] }], colunas: ['01-01'] },
      }
      const d = deps(undefined, undefined, () => Promise.resolve(raio))
      const { result } = renderHook(() => useSatelliteController(d), {
        wrapper: providers(`/satelite?${flow}&confirmadas=2025:parado`),
      })

      await waitFor(() => expect(result.current.heatmap).not.toBeNull())
      expect(result.current.heatmap?.rows[0]).toMatchObject({ year: 2025, situation: 'parado', byProducer: true })
    })

    it('sem o raio-X (falhou), a tela continua sem o painel', async () => {
      const d = deps(undefined, undefined, () => Promise.reject(new Error('rede')))
      const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

      await waitFor(() => expect(result.current.status).toBe('ready'))
      await waitFor(() => expect(d.raioX.get).toHaveBeenCalled())
      expect(result.current.xray).toBeNull()
      expect(result.current.alerts).toEqual([])
      expect(result.current.cards).toBeNull()
    })

    it('"ver na sugestão" leva o caminho todo para a resposta', async () => {
      const d = deps()
      const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

      expect(result.current.answerTo).toBe(`/resposta?${flow}`)
    })
  })
})

describe('"Compartilhar com a comunidade" depois de confirmar as safras (tarefa 0047)', () => {
  const confirmable: Partial<Talhao> = { ...talhao, anos_confirmaveis: [2024, 2025, 2026] }

  function withCommunity(send: CommunityService['send'] = vi.fn().mockResolvedValue({ id: 'r1' })) {
    const community: CommunityService = {
      nearby: vi.fn(),
      send,
      remove: vi.fn(),
      noticeSeen: vi.fn(() => false),
      region: vi.fn(),
    }
    return { ...deps(() => Promise.resolve(confirmable)), community }
  }

  it('sem safra confirmada, não oferece compartilhar', async () => {
    const d = withCommunity()
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.share).toBeNull()
  })

  it('na fazenda de exemplo, não oferece compartilhar (o relato vale para a lavoura marcada)', async () => {
    const d = withCommunity()
    const { result } = renderHook(() => useSatelliteController(d), {
      wrapper: providers(`/satelite?${flow}&exemplo=1&confirmadas=2025:parado`),
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.share).toBeNull()
  })

  it('uma linha por safra confirmada: "deixei parado" já pronto; "plantei" pergunta a cultura e como foi', async () => {
    const d = withCommunity()
    const { result } = renderHook(() => useSatelliteController(d), {
      wrapper: providers(`/satelite?${flow}&confirmadas=2024:plantou,2025:parado`),
    })

    await waitFor(() => expect(result.current.share).not.toBeNull())
    expect(result.current.share?.open).toBe(false)
    expect(result.current.share?.showNotice).toBe(true)
    expect(result.current.share?.rows).toEqual([
      { year: 2024, idle: false, draft: { crop: null, year: 2024, outcome: null, reason: null }, ready: false, status: null },
      { year: 2025, idle: true, draft: { crop: 'pousio', year: 2025, outcome: null, reason: null }, ready: true, status: null },
    ])
    act(() => result.current.toggleShare())
    expect(result.current.share?.open).toBe(true)
  })

  it('compartilhar grava o relato de plantio da safra no ponto da lavoura', async () => {
    const d = withCommunity()
    const { result } = renderHook(() => useSatelliteController(d), {
      wrapper: providers(`/satelite?${flow}&confirmadas=2024:plantou`),
    })
    await waitFor(() => expect(result.current.share).not.toBeNull())

    act(() => result.current.changeShare(2024, { crop: 'milheto' }))
    act(() => result.current.changeShare(2024, { outcome: 'bem' }))
    expect(result.current.share?.rows[0].ready).toBe(true)
    await act(() => result.current.sendShare(2024))

    expect(d.community.send).toHaveBeenCalledWith({
      tipo: 'plantio',
      subtipo: 'milheto',
      valores: { ano: 2024, resultado: 'bem' },
      lat: -18.9543,
      lon: -48.1993,
      data_fato: null,
    })
    expect(result.current.share?.rows[0].status).toBe('sent')
  })

  it('se o envio falhar, diz o motivo na linha', async () => {
    const d = withCommunity(vi.fn().mockRejectedValue(new ApiError('/api/comunidade/relatos', 429, 'TOO_MANY_REPORTS', 'POST')))
    const { result } = renderHook(() => useSatelliteController(d), {
      wrapper: providers(`/satelite?${flow}&confirmadas=2025:parado`),
    })
    await waitFor(() => expect(result.current.share).not.toBeNull())

    await act(() => result.current.sendShare(2025))

    expect(result.current.share?.rows[0].status).toBe('limit')
  })
})
