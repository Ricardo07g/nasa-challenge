import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CustoAtraso } from '../models/custoAtraso'
import type { ChuvaMensal, ChuvaQueSobra, FimDasChuvas, Talhao } from '../models/talhao'
import type { DelayCostService } from '../services/delayCostService'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useWhenController } from './useWhenController'

const point = 'lat=-18.9543&lon=-48.1993'

/** Resultados de teste do motor (não são de dado real). */
const CUSTO: CustoAtraso = {
  faixas: [
    { colheita: 'cedo', semeadura: '2027-02-08', melhor: 'milho_braquiaria', nome: 'x', anos_bons: 18, total_anos: 20 },
    { colheita: 'meio', semeadura: '2027-02-18', melhor: 'milho_braquiaria', nome: 'x', anos_bons: 16, total_anos: 20 },
    { colheita: 'tarde', semeadura: '2027-03-03', melhor: 'milheto', nome: 'y', anos_bons: 20, total_anos: 20 },
  ],
  mesma_cultura: false,
}

/** O satélite viu a soja secar em 25/fev (dado de teste). */
const SATELLITE: Partial<Talhao> = {
  colheita_sugerida: { faixa: 'tarde', fonte: 'ndvi_modis', anos_usados: 10, dia: '02-25' },
}

function deps(
  talhao: Promise<Partial<Talhao>> = Promise.resolve(SATELLITE),
  custo: Promise<CustoAtraso> = Promise.resolve(CUSTO),
) {
  const farm: FarmService = { talhao: vi.fn().mockReturnValue(talhao), recomendacao: vi.fn().mockResolvedValue({}) }
  const delayCost: DelayCostService = { get: vi.fn().mockReturnValue(custo) }
  return { farm, delayCost, today: () => new Date(2026, 10, 14) }
}

/** Valores redondos de teste (não são do GPM IMERG nem do NASA POWER). */
const CHUVA: ChuvaMensal = {
  meses: [
    { mes: 1, media_mm: 200 },
    { mes: 2, media_mm: 100 },
  ],
  anos: [2005, 2006],
  fonte: 'nasa_power',
}

const SOBRA: ChuvaQueSobra = {
  fim: '06-30',
  percentil_seco: 20,
  dias: [
    { dia: '02-05', mediana_mm: 500, seco_mm: 400 },
    { dia: '02-15', mediana_mm: 450, seco_mm: 350 },
    { dia: '02-25', mediana_mm: 360, seco_mm: 270 },
    { dia: '02-28', mediana_mm: 340, seco_mm: 240 },
  ],
  anos: [2005, 2006],
  fonte: 'gpm_imerg',
}

const FIM: FimDasChuvas = {
  mediana: '04-21',
  mais_cedo: { dia: '03-16', ano: 2021 },
  mais_tarde: { dia: '06-22', ano: 2012 },
  anos: [2005, 2006],
  fonte: 'gpm_imerg',
  inicio: '03-01',
  dias: 20,
  chuva_max_mm: 10,
}

function render(d: ReturnType<typeof deps>, url = `/quando?${point}`) {
  return renderHook(() => useWhenController(d), { wrapper: providers(url) })
}

describe('useWhenController (tela 3)', () => {
  it('já preenche o dia que o satélite viu e marca a faixa desse dia: sugestão = seleção', async () => {
    // A API antiga chamava 21 a 22/fev de "meio"; o dia vem primeiro e a faixa sai dele.
    const d = deps(Promise.resolve({ colheita_sugerida: { faixa: 'meio', fonte: 'ndvi_modis', anos_usados: 10, dia: '02-25' } }))
    const { result } = render(d)

    await waitFor(() => expect(result.current.suggestion).not.toBeNull())
    expect(result.current.suggestion).toEqual({ faixa: 'tarde', fromSatellite: true, date: '2027-02-25' })
    expect(result.current.date).toBe('2027-02-25')
    expect(result.current.selected).toBe('tarde')
    expect(result.current.selected).toBe(result.current.suggestion?.faixa)
    expect(result.current.suggestionApplied).toBe(true)
    expect(result.current.bandsOpen).toBe(false)
    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: false }, 'pt')
  })

  it('a faixa da URL vale mais que a sugestão (voltar da tela 4), e a faixa azul não diz que já marcou', async () => {
    const { result } = render(deps(), `/quando?${point}&colheita=meio`)

    await waitFor(() => expect(result.current.suggestion).not.toBeNull())
    expect(result.current.date).toBe('')
    expect(result.current.selected).toBe('meio')
    expect(result.current.suggestionApplied).toBe(false)
    expect(result.current.bandsOpen).toBe(true)
  })

  it('com a faixa da URL igual à do satélite, o campo traz o dia do satélite', async () => {
    const { result } = render(deps(), `/quando?${point}&colheita=tarde`)

    await waitFor(() => expect(result.current.date).toBe('2027-02-25'))
    expect(result.current.suggestionApplied).toBe(true)
  })

  it('"Usar o dia do satélite" volta o campo para o dia sugerido', async () => {
    const { result } = render(deps(), `/quando?${point}&colheita=cedo`)
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    act(() => result.current.applySuggestedDate())

    expect(result.current.date).toBe('2027-02-25')
    expect(result.current.selected).toBe('tarde')
    expect(result.current.suggestionApplied).toBe(true)
  })

  it('se o talhão não carregar, fica no meio de fevereiro, sem data e com as faixas abertas', async () => {
    const { result } = render(deps(Promise.reject(new Error('rede'))))

    await waitFor(() => expect(result.current.suggestion).toEqual({ faixa: 'meio', fromSatellite: false, date: null }))
    expect(result.current.date).toBe('')
    expect(result.current.selected).toBe('meio')
    expect(result.current.bandsOpen).toBe(true)
  })

  it('"Não sei o dia exato" abre as faixas; escolher uma faixa limpa o dia', async () => {
    const { result } = render(deps())
    await waitFor(() => expect(result.current.date).toBe('2027-02-25'))

    act(() => result.current.toggleBands())
    expect(result.current.bandsOpen).toBe(true)
    act(() => result.current.select('cedo'))

    expect(result.current.selected).toBe('cedo')
    expect(result.current.date).toBe('')
    expect(result.current.suggestionApplied).toBe(false)
    act(() => result.current.toggleBands())
    expect(result.current.bandsOpen).toBe(false)
  })

  it('a data exata vira a faixa; data fora da época não conta', async () => {
    const { result } = render(deps())
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    expect(result.current.window).toEqual({ min: '2027-01-15', max: '2027-03-31' })
    act(() => result.current.changeDate('2027-02-18'))
    expect(result.current.dateBand).toBe('meio')
    expect(result.current.selected).toBe('meio')

    act(() => result.current.changeDate('2027-05-02'))
    expect(result.current.dateBand).toBeNull()
    expect(result.current.selected).toBe('tarde')
  })

  it('"Próximo passo" leva a faixa na URL para a missão (RF-19) e já pede a recomendação', async () => {
    const d = deps()
    const { result } = render(d)
    await waitFor(() => expect(result.current.date).toBe('2027-02-25'))

    act(() => result.current.confirm())

    expect(screen.getByTestId('location')).toHaveTextContent(`/calculando?${point}&colheita=tarde`)
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'tarde', solo: undefined, exemplo: false },
      'pt',
    )
  })

  it('voltando da tela 4 com safras confirmadas, elas seguem na URL e na recomendação (tarefa 0039)', async () => {
    const d = deps()
    const { result } = render(d, `/quando?${point}&confirmadas=2025:parado`)
    await waitFor(() => expect(result.current.date).toBe('2027-02-25'))

    act(() => result.current.confirm())

    expect(screen.getByTestId('location')).toHaveTextContent(`/calculando?${point}&colheita=tarde&confirmadas=2025:parado`)
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'tarde', solo: undefined, exemplo: false, confirmadas: '2025:parado' },
      'pt',
    )
  })

  it('o Voltar leva para o mapa com o mesmo ponto', () => {
    const { result } = render(deps())

    expect(result.current.backTo).toBe(`/onde?${point}`)
  })

  it('sem ponto na URL, avisa para voltar ao mapa', () => {
    const { result } = render(deps(), '/quando')

    expect(result.current.missingPoint).toBe(true)
  })

  it('o gráfico da chuva de cada mês vem do talhão (dado da API, nos dois modos)', async () => {
    const { result } = render(deps(Promise.resolve({ chuva_mensal: CHUVA })))

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

  it('enquanto o talhão carrega, os blocos de chuva esperam (nada piscando)', () => {
    const { result } = render(deps(new Promise(() => {})))

    expect(result.current.rainChart).toBe('loading')
    expect(result.current.rainLeft).toBe('loading')
    expect(result.current.rainEnd).toBe('loading')
  })

  it('a chuva que sobra segue o dia do campo; só com a faixa, o dia de colheita da faixa', async () => {
    const { result } = render(deps(Promise.resolve({ ...SATELLITE, chuva_que_sobra: SOBRA })))
    await waitFor(() => expect(result.current.date).toBe('2027-02-25'))

    expect(result.current.rainLeft).toMatchObject({ date: '2027-02-25', medianMm: 360, dryMm: 270, exact: true })

    act(() => result.current.select('meio'))

    expect(result.current.rainLeft).toMatchObject({ date: '2027-02-15', medianMm: 450, dryMm: 350, exact: false })
  })

  it('o fim das chuvas vem do talhão', async () => {
    const { result } = render(deps(Promise.resolve({ fim_das_chuvas: FIM })))

    await waitFor(() => expect(result.current.rainEnd).not.toBe('loading'))
    expect(result.current.rainEnd).toMatchObject({ median: '2023-04-21', earliest: { year: 2021 }, latest: { year: 2012 } })
  })

  it('sem os campos novos (API antiga) ou se o talhão falhar, os blocos não aparecem (decisão D2)', async () => {
    const without = render(deps(Promise.resolve({ chuva_mensal: null })))
    const failed = render(deps(Promise.reject(new Error('rede'))))

    await waitFor(() => expect(without.result.current.rainChart).toBeNull())
    await waitFor(() => expect(failed.result.current.rainChart).toBeNull())
    expect(without.result.current.rainLeft).toBeNull()
    expect(without.result.current.rainEnd).toBeNull()
    expect(failed.result.current.rainLeft).toBeNull()
  })

  it('o custo do atraso vem do motor (as 3 faixas), com o solo e as safras da URL', async () => {
    const d = deps()
    const { result } = render(d, `/quando?${point}&solo=arenoso&confirmadas=2025:parado`)

    expect(result.current.delayCost).toBe('loading')
    await waitFor(() => expect(result.current.delayCost).not.toBe('loading'))
    expect(result.current.delayCost).toEqual({
      bands: [
        { band: 'cedo', crop: 'milho_braquiaria', good: 18, total: 20 },
        { band: 'meio', crop: 'milho_braquiaria', good: 16, total: 20 },
        { band: 'tarde', crop: 'milheto', good: 20, total: 20 },
      ],
      sameCrop: false,
    })
    expect(d.delayCost.get).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, solo: 'arenoso', confirmadas: '2025:parado' },
      'pt',
    )
  })

  it('se o custo do atraso falhar, o bloco não aparece', async () => {
    const { result } = render(deps(Promise.resolve(SATELLITE), Promise.reject(new Error('rede'))))

    await waitFor(() => expect(result.current.delayCost).toBeNull())
  })

  it('avisa quando o satélite não viu soja no ponto na última safra (RF-24) e "Seguir mesmo assim" fecha o aviso', async () => {
    const d = deps(Promise.resolve({ soja_recente: { safra: '2025/26', vista: false, ndvi_pico: 0.41, fonte: 'teste' } }))
    const { result } = render(d)

    await waitFor(() => expect(result.current.soyWarning).toEqual({ safra: '2025/26' }))
    // "Ajustar no mapa" volta ao mapa com o mesmo ponto
    expect(result.current.backTo).toBe(`/onde?${point}`)

    act(() => result.current.dismissSoyWarning())

    expect(result.current.soyWarning).toBeNull()
  })

  it('não avisa quando viu soja, sem o dado ou se o talhão falhar', async () => {
    const a = render(deps(Promise.resolve({ soja_recente: { safra: '2025/26', vista: true, ndvi_pico: 0.86, fonte: 'teste' } })))
    const b = render(deps(Promise.resolve({ soja_recente: null })))
    const c = render(deps(Promise.reject(new Error('rede'))))

    await waitFor(() => expect(a.result.current.suggestion).not.toBeNull())
    await waitFor(() => expect(b.result.current.suggestion).not.toBeNull())
    await waitFor(() => expect(c.result.current.suggestion).not.toBeNull())
    expect(a.result.current.soyWarning).toBeNull()
    expect(b.result.current.soyWarning).toBeNull()
    expect(c.result.current.soyWarning).toBeNull()
  })
})
