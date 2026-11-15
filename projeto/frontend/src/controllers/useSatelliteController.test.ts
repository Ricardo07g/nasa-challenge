import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RaioX } from '../models/raioX'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { ApiError } from '../repositories/httpClient'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import type { CommunityService } from '../services/communityService'
import type { FarmService } from '../services/farmService'
import type { RaioXService } from '../services/raioXService'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { useSatelliteController } from './useSatelliteController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'

/** O que o satélite viu nas 3 últimas safras: 2024 e 2026 plantou, 2025 parada. */
const talhao: Partial<Talhao> = {
  dentro_da_area: true,
  solo: { textura: 'argiloso', cad_mm: 75, fonte: 'soilgrids' },
  historico: {
    anos: [
      { ano: 2024, situacao: 'plantou', ndvi_max: 0.66, n_obs: 11 },
      { ano: 2025, situacao: 'parado', ndvi_max: 0.42, n_obs: 12 },
      { ano: 2026, situacao: 'plantou', ndvi_max: 0.71, n_obs: 13 },
    ],
    parado: 1,
    plantou: 2,
    sem_certeza: 0,
    total: 3,
    fonte: 'MODIS MOD13Q1 + MYD13Q1',
    janela: '04-01 a 07-31',
  },
  dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
  anos_confirmaveis: [2024, 2025, 2026],
}

const RAIO = buildRaioX({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')

function deps(
  load: () => Promise<Partial<Talhao>> = () => Promise.resolve(talhao),
  loadRaio: () => Promise<RaioX> = () => Promise.resolve(RAIO),
) {
  const farm: FarmService = {
    talhao: vi.fn(() => load() as Promise<Talhao>),
    recomendacao: vi.fn(() => Promise.resolve({} as Recomendacao)),
  }
  const raioX: RaioXService = { get: vi.fn(() => loadRaio()) }
  const speech: SpeechService = { isSupported: () => true, speak: vi.fn(), stop: vi.fn() }
  return { farm, raioX, speech }
}

async function ready(url = `/satelite?${flow}`, d = deps()) {
  const hook = renderHook(() => useSatelliteController(d), { wrapper: providers(url) })
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return { ...hook, d }
}

const location = () => screen.getByTestId('location').textContent

describe('useSatelliteController (tela 4, raio-X e últimas safras)', () => {
  it('pede o talhão sem as respostas (o que o satélite viu) e o raio-X com a colheita e a terra da URL', async () => {
    const { d } = await ready(`/satelite?${flow}&solo=arenoso&safras=2025:pousio`)

    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: false }, 'pt')
    expect(d.raioX.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'meio', solo: 'arenoso' }, 'pt')
  })

  it('a tela só fica pronta quando o raio-X chega (o painel não entra por cima do que já apareceu)', async () => {
    let resolveRaio: (raio: RaioX) => void = () => {}
    const d = deps(undefined, () => new Promise<RaioX>((resolve) => (resolveRaio = resolve)))
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(d.farm.talhao).toHaveBeenCalled())
    await act(async () => {})
    expect(result.current.status).toBe('loading')
    expect(result.current.xray).toBeNull()

    await act(async () => resolveRaio(RAIO))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.xray).not.toBeNull()
  })

  it('se o raio-X falhar, a tela abre sem o painel (as safras continuam)', async () => {
    const { result } = await ready(`/satelite?${flow}`, deps(undefined, () => Promise.reject(new Error('fora do ar'))))

    expect(result.current.xray).toBeNull()
    expect(result.current.seasons.rows).toHaveLength(3)
  })

  it('monta o painel: os 8 blocos, o lugar perto e o ponto', async () => {
    const { result } = await ready()

    expect(result.current.xray?.blocks.map((block) => block.kind)).toEqual([
      'soil', 'water', 'moisture', 'green', 'rain', 'dryspell', 'heat', 'region',
    ]) // prettier-ignore
    expect(result.current.xray).toMatchObject({ place: 'Uberlândia (MG)', demo: false, point: { lat: -18.9543, lon: -48.1993 } })
  })

  it('na lavoura de demonstração, o painel diz que é a demonstração', async () => {
    const { result } = await ready(`/satelite?${flow}&exemplo=1`)

    expect(result.current.xray?.demo).toBe(true)
  })

  it('o bloco abre e fecha o detalhe', async () => {
    const { result } = await ready()

    act(() => result.current.openDetail('water'))
    expect(result.current.detail).toBe('water')
    act(() => result.current.closeDetail())
    expect(result.current.detail).toBeNull()
  })

  it('"Sua terra é diferente?": grava a terra na URL sem sair do modal, e o painel fica enquanto recarrega', async () => {
    let calls = 0
    let resolveSecond: (raio: RaioX) => void = () => {}
    const d = deps(undefined, () => (++calls === 1 ? Promise.resolve(RAIO) : new Promise<RaioX>((resolve) => (resolveSecond = resolve))))
    const { result } = await ready(`/satelite?${flow}`, d)

    act(() => result.current.openDetail('soil'))
    act(() => result.current.chooseSoil('arenoso'))

    expect(location()).toBe(`/satelite?${flow}&solo=arenoso`)
    expect(result.current.detail).toBe('soil')
    expect(result.current.soil).toEqual({ textura: 'arenoso', source: 'user' })
    await waitFor(() => expect(d.raioX.get).toHaveBeenCalledTimes(2))
    expect(result.current.status).toBe('ready')
    expect(result.current.xray).not.toBeNull()
    await act(async () => resolveSecond(RAIO))
  })

  describe('suas últimas safras', () => {
    it('as 3 últimas safras com o que o satélite viu, as respostas da URL e a safra atual', async () => {
      const { result } = await ready(`/satelite?${flow}&data=2027-03-03&safras=2025:pousio&pensa=sorgo`)

      expect(result.current.seasons.rows).toEqual([
        { year: 2024, satellite: { soy: true, after: 'plantou', ndvi: 0.66 } },
        { year: 2025, satellite: { soy: true, after: 'parado', ndvi: 0.42 } },
        { year: 2026, satellite: { soy: true, after: 'plantou', ndvi: 0.71 } },
      ])
      expect(result.current.seasons.answers).toEqual({ 2025: 'pousio' })
      expect(result.current.seasons.current).toEqual({
        choice: 'sorgo',
        harvestDate: '2027-03-03',
        changeDateTo: `/quando?${flow}&data=2027-03-03&safras=2025:pousio&pensa=sorgo`,
      })
      expect(result.current.seasons.answered).toBe(1)
    })

    it('com só a época da colheita, a safra atual fica sem data', async () => {
      const { result } = await ready()

      expect(result.current.seasons.current.harvestDate).toBeNull()
    })

    it('responder uma safra grava "safras" na URL e tira o "confirmadas" dos links antigos', async () => {
      const { result } = await ready(`/satelite?${flow}&confirmadas=2025:parado`)
      expect(result.current.seasons.answers).toEqual({ 2025: 'pousio' })

      act(() => result.current.answerSeason(2024, 'milho_braquiaria'))

      expect(location()).toBe(`/satelite?${flow}&safras=2024:milho_braquiaria,2025:pousio`)
      expect(result.current.seasons.answers).toEqual({ 2024: 'milho_braquiaria', 2025: 'pousio' })
      act(() => result.current.answerSeason(2025, null))
      expect(location()).toBe(`/satelite?${flow}&safras=2024:milho_braquiaria`)
    })

    it('a escolha da safra atual vai para "pensa"; tocar de novo tira', async () => {
      const { result } = await ready()

      act(() => result.current.chooseCurrent('nao_sei'))
      expect(location()).toBe(`/satelite?${flow}&pensa=nao_sei`)
      act(() => result.current.chooseCurrent(null))
      expect(location()).toBe(`/satelite?${flow}`)
    })

    it('o que o satélite viu da soja nas 3 últimas safras: todas, algumas, nenhuma ou sem leitura', async () => {
      const all = await ready()
      expect(all.result.current.seasons.seen).toEqual({ kind: 'all', count: 3 })

      const some = await ready(
        `/satelite?${flow}`,
        deps(() =>
          Promise.resolve({
            ...talhao,
            historico: { ...talhao.historico!, anos: talhao.historico!.anos.map((ano) => (ano.ano === 2024 ? { ...ano, situacao: 'sem_soja' as const } : ano)) },
          }),
        ),
      )
      expect(some.result.current.seasons.seen).toEqual({ kind: 'some', count: 2 })

      const none = await ready(`/satelite?${flow}`, deps(() => Promise.resolve({ ...talhao, historico: null })))
      expect(none.result.current.seasons.seen).toEqual({ kind: 'no-reading', count: 0 })
    })

    it('o gráfico usa o NDVI do raio-X, o histórico do talhão e as respostas', async () => {
      const { result } = await ready(`/satelite?${flow}&safras=2026:pousio&pensa=milheto`)

      expect(result.current.chart.readings).toBe(true)
      expect(result.current.chart.rows.map((row) => row.year)).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
      expect(result.current.chart.rows.at(-1)?.status).toEqual({ kind: 'answer', answer: 'pousio' })
      expect(result.current.chart.current).toEqual({ year: 2027, choice: 'milheto' })
    })

    it('sem NDVI, o gráfico fica com as 3 últimas safras e usa a data do produtor na colheita', async () => {
      const raio = { ...RAIO, historico_ndvi: null }
      const { result } = await ready(`/satelite?${flow}&data=2027-03-10`, deps(undefined, () => Promise.resolve(raio)))

      expect(result.current.chart.readings).toBe(false)
      expect(result.current.chart.rows.map((row) => row.year)).toEqual([2024, 2025, 2026])
      expect(result.current.chart.marks.harvest).toBe(4)
    })

    it('nenhum ano com soja no ponto: avisa e oferece ajustar no mapa', async () => {
      const noSoy: Partial<Talhao> = {
        ...talhao,
        historico: { ...talhao.historico!, anos: talhao.historico!.anos.map((ano) => ({ ...ano, situacao: 'sem_soja' as const })) },
      }
      const { result } = await ready(`/satelite?${flow}`, deps(() => Promise.resolve(noSoy)))

      expect(result.current.noSoy).toBe(true)
      expect(result.current.adjustTo).toBe(`/onde?${flow}`)
    })
  })

  it('"Ver o que plantar" leva o fluxo inteiro para a resposta e já pede a recomendação com as respostas', async () => {
    const url = `/satelite?${flow}&data=2027-03-03&solo=arenoso&safras=2024:sorgo,2025:pousio,2026:sem_soja&pensa=milheto`
    const { result, d } = await ready(url)

    act(() => result.current.confirm())

    expect(location()).toBe(`/resposta?${flow}&data=2027-03-03&solo=arenoso&safras=2024:sorgo,2025:pousio,2026:sem_soja&pensa=milheto`)
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', solo: 'arenoso', exemplo: false, confirmadas: '2024:plantou,2025:parado' },
      'pt',
    )
  })

  it('"Ouvir resumo" fala o resumo da tela com os números do raio-X', async () => {
    const { result, d } = await ready()

    expect(result.current.listen.supported).toBe(true)
    act(() => result.current.listen.toggle())
    expect(d.speech.speak).toHaveBeenCalledWith(
      'Sua terra é média e guarda cerca de 50 milímetros de água. Hoje ela está mais úmida que em 41% dos anos. Num ano típico chovem 880 milímetros de janeiro a julho, e o maior veranico foi de 31 dias. Confirme abaixo o que você plantou nas últimas safras.',
      'pt',
      expect.any(Function),
    )
  })

  it('o Voltar leva para a pergunta da colheita, com o fluxo', async () => {
    const { result } = await ready(`/satelite?${flow}&pensa=sorgo`)

    expect(result.current.backTo).toBe(`/quando?${flow}&pensa=sorgo`)
    expect(result.current.redirectTo).toBeNull()
  })

  it('sem ponto volta para o mapa; sem colheita volta para a pergunta da colheita', () => {
    const d = deps()
    const noPoint = renderHook(() => useSatelliteController(d), { wrapper: providers('/satelite') })
    const noHarvest = renderHook(() => useSatelliteController(d), { wrapper: providers('/satelite?lat=-18.9543&lon=-48.1993') })

    expect(noPoint.result.current.redirectTo).toBe('/onde')
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })

  it('se os dados não vierem, mostra o erro e tenta de novo', async () => {
    let calls = 0
    const d = deps(() => (++calls === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(talhao)))
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('talhão fora da área com dados preparados vira o estado "fora da área"', async () => {
    const d = deps(() => Promise.resolve({ ...talhao, dentro_da_area: false }))
    const { result } = renderHook(() => useSatelliteController(d), { wrapper: providers(`/satelite?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })
})

describe('"Compartilhar com a comunidade" das safras respondidas (tarefa 0047)', () => {
  function withCommunity(send: CommunityService['send'] = vi.fn().mockResolvedValue({ id: 'r1' })) {
    const community: CommunityService = {
      nearby: vi.fn(),
      send,
      remove: vi.fn(),
      noticeSeen: vi.fn(() => false),
      region: vi.fn(),
    }
    return { ...deps(), community }
  }

  it('sem safra respondida, não oferece compartilhar', async () => {
    const { result } = await ready(`/satelite?${flow}`, withCommunity())

    expect(result.current.share).toBeNull()
  })

  it('na lavoura de demonstração, não oferece compartilhar (o relato vale para a lavoura marcada)', async () => {
    const { result } = await ready(`/satelite?${flow}&exemplo=1&safras=2025:pousio`, withCommunity())

    expect(result.current.share).toBeNull()
  })

  it('uma linha por safra com soja: "Deixei parado" já pronto; a cultura respondida já vem marcada', async () => {
    const { result } = await ready(`/satelite?${flow}&safras=2024:milheto,2025:pousio,2026:sem_soja`, withCommunity())

    expect(result.current.share?.open).toBe(false)
    expect(result.current.share?.showNotice).toBe(true)
    expect(result.current.share?.rows).toEqual([
      { year: 2024, idle: false, draft: { crop: 'milheto', year: 2024, outcome: null, reason: null }, ready: false, status: null },
      { year: 2025, idle: true, draft: { crop: 'pousio', year: 2025, outcome: null, reason: null }, ready: true, status: null },
    ])
    act(() => result.current.toggleShare())
    expect(result.current.share?.open).toBe(true)
  })

  it('compartilhar grava o relato de plantio da safra no ponto da lavoura', async () => {
    const { result, d } = await ready(`/satelite?${flow}&safras=2024:soja`, withCommunity())

    act(() => result.current.changeShare(2024, { crop: 'milheto' }))
    act(() => result.current.changeShare(2024, { outcome: 'bem' }))
    expect(result.current.share?.rows[0].ready).toBe(true)
    await act(() => result.current.sendShare(2024))

    expect((d as ReturnType<typeof withCommunity>).community.send).toHaveBeenCalledWith({
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
    const { result } = await ready(`/satelite?${flow}&safras=2025:pousio`, d)

    await act(() => result.current.sendShare(2025))

    expect(result.current.share?.rows[0].status).toBe('limit')
  })
})
