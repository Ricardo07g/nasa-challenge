import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlanoParams, PlanoSugestaoParams } from '../models/plano'
import type { RaioX } from '../models/raioX'
import type { Talhao } from '../models/talhao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { buildPlano, buildSugestao } from '../repositories/mocks/mockPlano'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import type { FarmService } from '../services/farmService'
import type { PlanService } from '../services/planService'
import type { RaioXService } from '../services/raioXService'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { usePlanningController } from './usePlanningController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=tarde'
const RAIO = buildRaioX({ lat: -18.9543, lon: -48.1993, colheita: 'tarde' }, 'pt')

const talhao = {
  dentro_da_area: true,
  dados: [
    { fonte: 'gpm_imerg', periodo: '2005-2024' },
    { fonte: 'nex_gddp_cmip6', periodo: '2041-2060', cenario: 'ssp245', modelos: 3 },
  ],
} as unknown as Talhao

function deps(loadRaio: () => Promise<RaioX> = () => Promise.resolve(RAIO), loadTalhao = () => Promise.resolve(talhao)) {
  const farm: FarmService = {
    talhao: vi.fn(loadTalhao),
    recomendacao: vi.fn(() => Promise.resolve(buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'tarde' }, 'pt'))),
  }
  const plan: PlanService = {
    suggest: vi.fn((params: PlanoSugestaoParams) => Promise.resolve(buildSugestao(params, 'pt'))),
    evaluate: vi.fn((params: PlanoParams) => Promise.resolve(buildPlano(params, 'pt'))),
  }
  const raioX: RaioXService = { get: vi.fn(loadRaio) }
  const speech: SpeechService = { isSupported: () => true, speak: vi.fn(), stop: vi.fn() }
  return { farm, plan, raioX, speech, print: vi.fn(), today: () => '2026-11-15' }
}

describe('usePlanningController (/planejamento: os blocos que saíram do raio-X)', () => {
  it('pede o raio-X com a colheita e a terra da URL e traz os alertas e os cartões', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanningController(d), { wrapper: providers(`/planejamento?${flow}&solo=arenoso&safras=2025:pousio`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(d.raioX.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'tarde', solo: 'arenoso' }, 'pt')
    expect(result.current.alerts.map((alert) => alert.kind)).toEqual(['heavyRain'])
    expect(result.current.cards?.chuva_20_anos?.anos_bons).toBe(16)
  })

  it('o Voltar e o "ver na sugestão" levam para a resposta com o fluxo', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanningController(d), { wrapper: providers(`/planejamento?${flow}&pensa=sorgo`) })

    expect(result.current.backTo).toBe(`/resposta?${flow}&pensa=sorgo`)
    expect(result.current.answerTo).toBe(`/resposta?${flow}&pensa=sorgo`)
  })

  it('sem o raio-X, os cartões de antes: anos de chuva da recomendação e o clima do talhão', async () => {
    const d = deps(() => Promise.reject(new Error('fora do ar')))
    const { result } = renderHook(() => usePlanningController(d), { wrapper: providers(`/planejamento?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() => expect(result.current.rain?.years).toBe(20))
    expect(result.current.cards).toBeNull()
    expect(result.current.alerts).toEqual([])
    expect(result.current.climate).toEqual({ period: { start: '2041', end: '2060' } })
  })

  it('"Ouvir resumo" fala os alertas, os anos de chuva e o clima de 2041 a 2060', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanningController(d), { wrapper: providers(`/planejamento?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.listen.toggle())
    expect(d.speech.speak).toHaveBeenCalledWith(
      'Na sua área, há alerta de chuva forte. Com milho com braquiária, deu certo em 16 de 20 anos de chuva. Para 2041 a 2060: 2 de 3 modelos indicam menos chuva; 3 de 3, mais calor.',
      'pt',
      expect.any(Function),
    )
  })

  it('"Imprimir relatório" (veio da tela 5) chama a impressão; o relatório tem o raio-X e a data de hoje', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanningController(d), { wrapper: providers(`/planejamento?${flow}`) })
    await waitFor(() => expect(result.current.report?.raio).not.toBeNull())
    expect(result.current.report?.generatedOn).toBe('2026-11-15')
    act(() => result.current.print())
    expect(d.print).toHaveBeenCalledTimes(1)
  })

  it('sem ponto volta para o mapa; sem colheita, para a pergunta da colheita', () => {
    const d = deps()
    const noPoint = renderHook(() => usePlanningController(d), { wrapper: providers('/planejamento') })
    const noHarvest = renderHook(() => usePlanningController(d), { wrapper: providers('/planejamento?lat=-18.9543&lon=-48.1993') })

    expect(noPoint.result.current.redirectTo).toBe('/onde')
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })

  it('fora da área com dados preparados vira "fora da área"; falha do talhão, erro com "tentar de novo"', async () => {
    const outsideDeps = deps(undefined, () => Promise.resolve({ ...talhao, dentro_da_area: false }))
    const outside = renderHook(() => usePlanningController(outsideDeps), { wrapper: providers(`/planejamento?${flow}`) })
    await waitFor(() => expect(outside.result.current.status).toBe('outside'))

    let calls = 0
    const failing = deps(undefined, () => (++calls === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(talhao)))
    const { result } = renderHook(() => usePlanningController(failing), { wrapper: providers(`/planejamento?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })
})
