import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { ApiError } from '../repositories/httpClient'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useOptionsController } from './useOptionsController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'
const point = { lat: -18.9543, lon: -48.1993 }
const sample = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
const talhao = {
  ponto: point,
  celula_id: '-190_-482',
  dentro_da_area: true,
  solo: { textura: 'argiloso', cad_mm: 60, fonte: 'soilgrids' },
  colheita_sugerida: { faixa: 'meio', fonte: 'padrao', anos_usados: 0 },
  historico: null,
  dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
} as Talhao

function deps(load: () => Promise<Recomendacao> = () => Promise.resolve(sample)) {
  const farm: FarmService = { talhao: vi.fn(() => Promise.resolve(talhao)), recomendacao: vi.fn(load) }
  return { farm }
}

async function ready(url = `/opcoes?${flow}`, d = deps()) {
  const hook = renderHook(() => useOptionsController(d), { wrapper: providers(url) })
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return hook
}

describe('useOptionsController (aba Comparar, tarefa 0045)', () => {
  it('por padrão compara as 3 melhores para o objetivo, em colunas', async () => {
    const { result } = await ready()

    const top3 = sample.objetivos!.equilibrio!.ordem.slice(0, 3)
    expect(result.current.compare?.columns.map((option) => option.id)).toEqual(top3)
    expect(result.current.compare?.chips.filter((chip) => chip.selected).map((chip) => chip.id)).toEqual(top3)
    expect(result.current.compare?.full).toBe(true)
  })

  it('a escolha fica na URL: tocar num chip tira ou põe a cultura', async () => {
    const { result } = await ready(`/opcoes?${flow}&comparar=sorgo`)

    expect(result.current.compare?.columns.map((option) => option.id)).toEqual(['sorgo'])
    act(() => result.current.toggle('milheto'))
    await waitFor(() => expect(result.current.compare?.columns.map((option) => option.id)).toEqual(['sorgo', 'milheto']))
    act(() => result.current.toggle('sorgo'))
    await waitFor(() => expect(result.current.compare?.columns.map((option) => option.id)).toEqual(['milheto']))
  })

  it('"Se você prefere…" é o ponto de partida: compara a alternativa com a sugestão', async () => {
    const { result } = await ready()

    expect(result.current.compare?.alternatives.map((alt) => alt.option.id)).toEqual(['milheto', 'sorgo', 'crotalaria'])
    act(() => result.current.compareWith('crotalaria'))
    await waitFor(() =>
      expect(result.current.compare?.columns.map((option) => option.id)).toEqual(['milho_braquiaria', 'crotalaria']),
    )
  })

  it('"Usar no meu plano" leva a cultura para o ano 1 do plano, mantendo o caminho', async () => {
    const { result } = await ready(`/opcoes?${flow}&objetivo=terra`)

    const [, second, third] = sample.objetivos!.terra!.plano
    expect(result.current.planLink('sorgo')).toBe(`/plano?${flow}&objetivo=terra&plano=sorgo,${second},${third}`)
  })

  it('as culturas fora da janela aparecem desligadas, com a data limite', async () => {
    const late = buildRecomendacao({ ...point, colheita: 'tarde' }, 'pt')
    const { result } = await ready(`/opcoes?lat=-18.9543&lon=-48.1993&colheita=tarde`, deps(() => Promise.resolve(late)))

    expect(result.current.compare?.chips.at(-1)).toMatchObject({ id: 'milho_safrinha', disabled: true, limit: '2027-02-28' })
  })

  it('o objetivo troca a comparação padrão e limpa a escolha anterior (tarefa 0044)', async () => {
    const { result } = await ready(`/opcoes?${flow}&comparar=sorgo`)

    act(() => result.current.nav.chooseObjective('terra'))
    await waitFor(() => expect(result.current.nav.objective).toBe('terra'))
    expect(result.current.compare?.columns.map((option) => option.id)).toEqual(sample.objetivos!.terra!.ordem.slice(0, 3))
  })

  it('ponto sem dados no servidor vira o estado "fora da área"', async () => {
    const d = deps(() => Promise.reject(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA')))
    const { result } = renderHook(() => useOptionsController(d), { wrapper: providers(`/opcoes?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })
})
