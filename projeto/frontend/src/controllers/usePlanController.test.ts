import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import { ApiError } from '../repositories/httpClient'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { usePlanController } from './usePlanController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'
const sample = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')

function deps(load: () => Promise<Recomendacao> = () => Promise.resolve(sample)) {
  const farm: FarmService = { talhao: vi.fn(), recomendacao: vi.fn(load) }
  return { farm }
}

async function ready(d = deps()) {
  const hook = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return hook
}

describe('usePlanController (tela 7)', () => {
  it('o sinal do outono marca o plano: incerto fica no Plano A (RF-20)', async () => {
    const { result } = await ready()

    expect(result.current.signal?.nivel).toBe('incerto')
    expect(result.current.scenario).toBe('normal')
    expect(result.current.plan?.years.map((y) => y.crop)).toEqual(['milho_braquiaria', 'crotalaria', 'sorgo'])
  })

  it('sinal de ano seco já abre no Plano B', async () => {
    const dry = { ...sample, sinal: { ...sample.sinal!, nivel: 'seco' as const } }
    const { result } = await ready(deps(() => Promise.resolve(dry)))

    expect(result.current.scenario).toBe('seco')
    expect(result.current.plan?.years[0]).toEqual({ year: 2027, crop: 'sorgo', swappedFrom: 'milho_braquiaria' })
  })

  it('a pessoa troca o plano; "nenhum" (null) não desmarca', async () => {
    const { result } = await ready()

    act(() => result.current.chooseScenario('seco'))
    expect(result.current.scenario).toBe('seco')
    act(() => result.current.chooseScenario(null))
    expect(result.current.scenario).toBe('seco')
  })

  it('hectares: começa em 50 e os totais acompanham a opção do 1º ano do plano (RF-21)', async () => {
    const { result } = await ready()

    expect(result.current.areaInput).toBe('50')
    expect(result.current.totals).toEqual({ margin: 700 * 50, seed: 520 * 50, worstDry: -180 * 50 })

    act(() => result.current.changeArea('120'))
    expect(result.current.hectares).toBe(120)
    act(() => result.current.stepArea(-10))
    expect(result.current.hectares).toBe(110)
    expect(result.current.totals.margin).toBe(700 * 110)

    act(() => result.current.chooseScenario('seco'))
    expect(result.current.totals.margin).toBe(540 * 110)
  })

  it('campo vazio conta como 50 ha e volta a mostrar 50 ao sair do campo', async () => {
    const { result } = await ready()

    act(() => result.current.changeArea(''))
    expect(result.current.hectares).toBe(50)
    expect(result.current.areaInput).toBe('')
    act(() => result.current.commitArea())
    expect(result.current.areaInput).toBe('50')
  })

  it('o botão de diminuir não passa de 1 ha', async () => {
    const { result } = await ready()

    act(() => result.current.changeArea('5'))
    act(() => result.current.stepArea(-10))
    expect(result.current.hectares).toBe(1)
  })

  it('traz a regra do dia de plantar', async () => {
    const { result } = await ready()

    expect(result.current.rule).toEqual({ text: sample.sinal!.regra_dia_plantar.texto })
  })

  it('as abas marcam "Plano de 3 anos"; sem colheita volta à pergunta 2', () => {
    const d = deps()
    const plan = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })
    const noHarvest = renderHook(() => usePlanController(d), {
      wrapper: providers('/plano?lat=-18.9543&lon=-48.1993'),
    })

    expect(plan.result.current.nav.tabs[1]).toMatchObject({ label: 'Plano de 3 anos', current: true })
    expect(plan.result.current.communityTo).toBe(`/comunidade?${flow}`)
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })

  it('ponto sem dados no servidor vira o estado "fora da área"', async () => {
    const d = deps(() => Promise.reject(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA')))
    const { result } = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })
})
