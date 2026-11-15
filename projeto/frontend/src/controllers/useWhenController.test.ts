import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChuvaMensal, Talhao } from '../models/talhao'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useWhenController } from './useWhenController'

const point = 'lat=-18.9543&lon=-48.1993'

function deps(
  talhao: Promise<Partial<Talhao>> = Promise.resolve({ colheita_sugerida: { faixa: 'cedo', fonte: 'ndvi_modis', anos_usados: 9 } }),
) {
  const farm: FarmService = { talhao: vi.fn().mockReturnValue(talhao), recomendacao: vi.fn().mockResolvedValue({}) }
  return { farm, today: () => new Date(2026, 10, 14) }
}

/** Valores redondos de teste (não são do NASA POWER). */
const CHUVA: ChuvaMensal = {
  meses: [
    { mes: 1, media_mm: 200 },
    { mes: 2, media_mm: 100 },
  ],
  anos: [2005, 2006],
  fonte: 'nasa_power',
}

describe('useWhenController (tela 3)', () => {
  it('já deixa marcada a faixa que o satélite viu', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })

    await waitFor(() => expect(result.current.suggestion).toEqual({ faixa: 'cedo', fromSatellite: true }))
    expect(result.current.selected).toBe('cedo')
    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: false }, 'pt')
  })

  it('a faixa que já está na URL vale mais que a sugestão (voltar da tela 4)', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), {
      wrapper: providers(`/quando?${point}&colheita=tarde`),
    })

    await waitFor(() => expect(result.current.suggestion).not.toBeNull())
    expect(result.current.selected).toBe('tarde')
  })

  it('se o talhão não carregar, fica no meio de fevereiro sem dizer que veio do satélite', async () => {
    const d = deps(Promise.reject(new Error('rede')))
    const { result } = renderHook(() => useWhenController(d), {
      wrapper: providers(`/quando?${point}`),
    })

    await waitFor(() => expect(result.current.suggestion).toEqual({ faixa: 'meio', fromSatellite: false }))
    expect(result.current.selected).toBe('meio')
  })

  it('escolher uma faixa fecha a data exata', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    act(() => result.current.openDate())
    act(() => result.current.select('tarde'))

    expect(result.current.selected).toBe('tarde')
    expect(result.current.dateOpen).toBe(false)
  })

  it('a data exata vira a faixa; data fora da época não conta', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    act(() => result.current.openDate())
    expect(result.current.window).toEqual({ min: '2027-01-15', max: '2027-03-31' })
    act(() => result.current.changeDate('2027-02-18'))
    expect(result.current.dateBand).toBe('meio')
    expect(result.current.selected).toBe('meio')

    act(() => result.current.changeDate('2027-05-02'))
    expect(result.current.dateBand).toBeNull()
    expect(result.current.selected).toBe('cedo')
  })

  it('"Próximo passo" leva a faixa na URL para a missão (RF-19) e já pede a recomendação', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    act(() => result.current.confirm())

    expect(screen.getByTestId('location')).toHaveTextContent(`/calculando?${point}&colheita=cedo`)
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'cedo', solo: undefined, exemplo: false },
      'pt',
    )
  })

  it('voltando da tela 4 com safras confirmadas, elas seguem na URL e na recomendação (tarefa 0039)', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), {
      wrapper: providers(`/quando?${point}&confirmadas=2025:parado`),
    })
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    act(() => result.current.confirm())

    expect(screen.getByTestId('location')).toHaveTextContent(`/calculando?${point}&colheita=cedo&confirmadas=2025:parado`)
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'cedo', solo: undefined, exemplo: false, confirmadas: '2025:parado' },
      'pt',
    )
  })

  it('o Voltar leva para o mapa com o mesmo ponto', () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })

    expect(result.current.backTo).toBe(`/onde?${point}`)
  })

  it('sem ponto na URL, avisa para voltar ao mapa', () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers('/quando') })

    expect(result.current.missingPoint).toBe(true)
  })

  it('o gráfico da chuva de cada mês vem do talhão (dado da API, nos dois modos)', async () => {
    const d = deps(Promise.resolve({ chuva_mensal: CHUVA }))
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })

    await waitFor(() => expect(result.current.rainChart).not.toBe('loading'))
    expect(result.current.rainChart).toEqual({
      bars: [
        { month: 'jan', mm: 200, heightPct: 100 },
        { month: 'feb', mm: 100, heightPct: 50 },
      ],
      firstYear: 2005,
      lastYear: 2006,
      years: 2,
      sources: ['nasa_power'],
    })
  })

  it('enquanto o talhão carrega, o gráfico espera (nada de "Ainda não conectado" piscando)', () => {
    const d = deps(new Promise(() => {}))
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })

    expect(result.current.rainChart).toBe('loading')
  })

  it('avisa quando o satélite não viu soja no ponto na última safra (RF-24) e "Seguir mesmo assim" fecha o aviso', async () => {
    const d = deps(
      Promise.resolve({ soja_recente: { safra: '2025/26', vista: false, ndvi_pico: 0.41, fonte: 'teste' } }),
    )
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })

    await waitFor(() => expect(result.current.soyWarning).toEqual({ safra: '2025/26' }))
    // "Ajustar no mapa" volta ao mapa com o mesmo ponto
    expect(result.current.backTo).toBe(`/onde?${point}`)

    act(() => result.current.dismissSoyWarning())

    expect(result.current.soyWarning).toBeNull()
  })

  it('não avisa quando viu soja, sem o dado ou se o talhão falhar', async () => {
    const seen = deps(Promise.resolve({ soja_recente: { safra: '2025/26', vista: true, ndvi_pico: 0.86, fonte: 'teste' } }))
    const noData = deps(Promise.resolve({ soja_recente: null }))
    const failed = deps(Promise.reject(new Error('rede')))
    const a = renderHook(() => useWhenController(seen), { wrapper: providers(`/quando?${point}`) })
    const b = renderHook(() => useWhenController(noData), { wrapper: providers(`/quando?${point}`) })
    const c = renderHook(() => useWhenController(failed), { wrapper: providers(`/quando?${point}`) })

    await waitFor(() => expect(a.result.current.suggestion).not.toBeNull())
    await waitFor(() => expect(b.result.current.suggestion).not.toBeNull())
    await waitFor(() => expect(c.result.current.suggestion).not.toBeNull())
    expect(a.result.current.soyWarning).toBeNull()
    expect(b.result.current.soyWarning).toBeNull()
    expect(c.result.current.soyWarning).toBeNull()
  })

  it('sem chuva_mensal na resposta ou se o talhão falhar, não há gráfico ("Ainda não conectado")', async () => {
    const without = deps(Promise.resolve({ chuva_mensal: null }))
    const failed = deps(Promise.reject(new Error('rede')))
    const a = renderHook(() => useWhenController(without), { wrapper: providers(`/quando?${point}`) })
    const b = renderHook(() => useWhenController(failed), { wrapper: providers(`/quando?${point}`) })

    await waitFor(() => expect(a.result.current.rainChart).toBeNull())
    await waitFor(() => expect(b.result.current.rainChart).toBeNull())
  })
})
