import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlanoParams, PlanoSugestaoParams } from '../models/plano'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { buildPlano, buildSugestao } from '../repositories/mocks/mockPlano'
import type { FarmService } from '../services/farmService'
import type { PlanService } from '../services/planService'
import { providers } from '../test/providers'
import { usePlanFlow } from './usePlanFlow'

const point = { lat: -18.9543, lon: -48.1993 }
const flow = 'lat=-18.9543&lon=-48.1993&colheita=tarde&data=2027-03-03'

function deps() {
  const farm: FarmService = {
    talhao: vi.fn(() => new Promise<never>(() => {})),
    recomendacao: vi.fn(() => Promise.resolve(buildRecomendacao({ ...point, colheita: 'tarde' }, 'pt'))),
  }
  const plan: PlanService = {
    suggest: vi.fn((params: PlanoSugestaoParams) => Promise.resolve(buildSugestao(params, 'pt'))),
    evaluate: vi.fn((params: PlanoParams) => Promise.resolve(buildPlano(params, 'pt'))),
  }
  return { farm, plan }
}

describe('usePlanFlow (o plano de 3 anos da URL, o mesmo nas telas 5 e 6)', () => {
  it('a escolha da URL é o 1º ano; os outros dois vêm da sugestão em cadeia', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanFlow(d), { wrapper: providers(`/planejamento?${flow}&escolha=sorgo`) })

    await waitFor(() => expect(result.current.cards).not.toBeNull())
    expect(result.current.choose?.choice).toBe('sorgo')
    expect(result.current.cards?.map((card) => card.crop)).toEqual(['sorgo', 'milheto', 'sorgo'])
    expect(d.plan.suggest).toHaveBeenCalledWith(expect.objectContaining({ fixos: ['sorgo'], colheita: 'tarde' }), 'pt')
  })

  it('com o 3º ano mudado, o plano inteiro vem do /api/plano', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanFlow(d), {
      wrapper: providers(`/planejamento?${flow}&escolha=sorgo&ano3=crotalaria`),
    })

    await waitFor(() => expect(result.current.cards?.[2].crop).toBe('crotalaria'))
    expect(d.plan.evaluate).toHaveBeenCalledWith(expect.objectContaining({ anos: ['sorgo', 'milheto', 'crotalaria'] }), 'pt')
    expect(result.current.edited).toBe(true)
  })

  it('sem ponto volta ao mapa', () => {
    const d = deps()
    const { result } = renderHook(() => usePlanFlow(d), { wrapper: providers('/planejamento') })
    expect(result.current.redirectTo).toBe('/onde')
  })
})
