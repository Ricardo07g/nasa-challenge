import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlanoParams } from '../models/plano'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { ApiError } from '../repositories/httpClient'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import { buildPlano } from '../repositories/mocks/mockPlano'
import type { FarmService } from '../services/farmService'
import type { PlanService } from '../services/planService'
import { providers } from '../test/providers'
import { usePlanController } from './usePlanController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'
const point = { lat: -18.9543, lon: -48.1993 }
const sample = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
const talhao = buildTalhao(point, 'pt')

function deps(
  load: () => Promise<Recomendacao> = () => Promise.resolve(sample),
  field: () => Promise<Talhao> = () => Promise.resolve(talhao),
) {
  const farm: FarmService = { talhao: vi.fn(field), recomendacao: vi.fn(load) }
  const evaluate = vi.fn((params: PlanoParams) => Promise.resolve(buildPlano(params, 'pt')))
  const plan: PlanService = { evaluate }
  return { farm, plan, evaluate }
}

async function ready(url = `/plano?${flow}`, d = deps()) {
  const hook = renderHook(() => usePlanController(d), { wrapper: providers(url) })
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return { ...hook, d }
}

const anos = (d: ReturnType<typeof deps>) => d.evaluate.mock.calls.map(([params]) => params.anos.join(','))

describe('usePlanController (aba Plano de 3 anos, tarefa 0045)', () => {
  it('abre o plano sugerido do objetivo, ano a ano, a partir da soja que vem', async () => {
    const { result } = await ready()

    expect(result.current.plan?.years).toEqual([
      { year: 2027, crop: 'milho_braquiaria' },
      { year: 2028, crop: 'crotalaria' },
      { year: 2029, crop: 'sorgo' },
    ])
    expect(result.current.plan?.edited).toBe(false)
    expect(result.current.plan?.choices).toEqual([...sample.objetivos!.equilibrio!.ordem, 'pousio'])
  })

  it('avalia o plano e o "Como é hoje" no /api/plano, com a faixa da recomendação', async () => {
    const { result, d } = await ready()

    await waitFor(() => expect(result.current.evaluation.data).not.toBeNull())
    await waitFor(() => expect(result.current.today?.evaluation.data).not.toBeNull())
    expect(d.evaluate).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', solo: undefined, anos: ['milho_braquiaria', 'crotalaria', 'sorgo'] },
      'pt',
    )
    // Sem a resposta de 2026 (o satélite viu plantio), "Como é hoje" fica na referência do motor
    expect(result.current.today?.reference).toBe(true)
    expect(anos(d)).toContain(sample.plano_3_anos.hoje.anos.join(','))
  })

  it('trocar a cultura de um ano vai para a URL e recalcula; "Voltar ao plano sugerido" volta', async () => {
    const { result, d } = await ready()

    act(() => result.current.chooseCrop(1, 'milheto'))
    await waitFor(() => expect(result.current.plan?.years[1].crop).toBe('milheto'))
    expect(result.current.plan?.edited).toBe(true)
    await waitFor(() => expect(anos(d)).toContain('milho_braquiaria,milheto,sorgo'))

    act(() => result.current.reset())
    await waitFor(() => expect(result.current.plan?.edited).toBe(false))
    expect(result.current.plan?.years[1].crop).toBe('crotalaria')
  })

  it('o plano editado da URL vale (veio do "Usar no meu plano" do Comparar)', async () => {
    const { result } = await ready(`/plano?${flow}&plano=sorgo,crotalaria,sorgo`)

    expect(result.current.plan?.years.map((y) => y.crop)).toEqual(['sorgo', 'crotalaria', 'sorgo'])
    expect(result.current.plan?.edited).toBe(true)
  })

  it('"Como é hoje" usa o NDVI das 3 últimas safras e a resposta do "O que foi?"', async () => {
    const { result, d } = await ready()

    await waitFor(() => expect(result.current.today?.rows.length).toBe(3))
    expect(result.current.today?.rows.map((row) => [row.year, row.seen])).toEqual([
      [2024, 'parado'],
      [2025, 'parado'],
      [2026, 'plantou'],
    ])
    expect(result.current.today?.hasSatellite).toBe(true)

    act(() => result.current.answerToday(2026, 'sorgo'))
    await waitFor(() => expect(result.current.today?.reference).toBe(false))
    expect(result.current.today?.crops).toEqual(['pousio', 'pousio', 'sorgo'])
    await waitFor(() => expect(anos(d)).toContain('pousio,pousio,sorgo'))
  })

  it('a resposta do "Como é hoje" fica na URL', async () => {
    const { result } = await ready(`/plano?${flow}&hoje=2026:milho_safrinha`)

    await waitFor(() => expect(result.current.today?.reference).toBe(false))
    expect(result.current.today?.crops).toEqual(['pousio', 'pousio', 'milho_safrinha'])
  })

  it('sem o talhão, "Como é hoje" fica na referência (sem linhas)', async () => {
    const { result } = await ready(`/plano?${flow}`, deps(undefined, () => Promise.reject(new Error('rede'))))

    await waitFor(() => expect(result.current.today?.reference).toBe(true))
    expect(result.current.today?.rows).toEqual([])
  })

  it('sem "Comece por um pedaço" e sem "Como teria sido em 2024?"', async () => {
    const { result } = await ready()

    for (const key of ['areaInput', 'hectares', 'totals', 'pastTo', 'scenario', 'rule']) {
      expect(result.current).not.toHaveProperty(key)
    }
  })

  it('as abas marcam "Plano de 3 anos"; sem colheita volta à pergunta 2', () => {
    const d = deps()
    const plan = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })
    const noHarvest = renderHook(() => usePlanController(d), { wrapper: providers('/plano?lat=-18.9543&lon=-48.1993') })

    expect(plan.result.current.nav.tabs[2]).toMatchObject({ label: 'Plano de 3 anos', current: true })
    expect(plan.result.current.communityTo).toBe(`/comunidade?${flow}`)
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })

  it('o objetivo do produtor troca o plano sugerido (tarefa 0044)', async () => {
    const { result } = await ready(`/plano?${flow}&objetivo=terra`)

    expect(result.current.plan?.years.map((y) => y.crop)).toEqual(sample.objetivos?.terra?.plano)
  })

  it('o sinal do outono continua (RF-20)', async () => {
    const { result } = await ready()

    expect(result.current.signal?.nivel).toBe('incerto')
  })

  it('ponto sem dados no servidor vira o estado "fora da área"', async () => {
    const d = deps(() => Promise.reject(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA')))
    const { result } = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })
})
