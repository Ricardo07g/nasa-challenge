import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CustoAtraso } from '../models/custoAtraso'
import type { MetodoRegras } from '../models/metodo'
import type { ChuvaMensal, ChuvaQueSobra, FimDasChuvas, Talhao } from '../models/talhao'
import type { DelayCostService } from '../services/delayCostService'
import type { FarmService } from '../services/farmService'
import type { MethodRulesService } from '../services/methodRulesService'
import type { SpeechService } from '../services/speechService'
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

/** Valores redondos de teste (não são do GPM IMERG nem do NASA POWER). */
const CHUVA: ChuvaMensal = {
  meses: [
    { mes: 1, media_mm: 200, eto_media_mm: 120 },
    { mes: 2, media_mm: 100, eto_media_mm: 110 },
  ],
  anos: [2005, 2006],
  fonte: 'gpm_imerg',
  fonte_eto: 'nasa_power',
  mes_chuva_abaixo_eto: 2,
}

const SOBRA: ChuvaQueSobra = {
  fim: '06-30',
  percentil_seco: 20,
  dias: [
    { dia: '02-05', mediana_mm: 500, seco_mm: 400 },
    { dia: '02-15', mediana_mm: 450, seco_mm: 350 },
    { dia: '02-25', mediana_mm: 367, seco_mm: 276 },
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

/** O satélite viu a soja secar em 25/fev: não preenche mais a tela (tarefa 0057). */
const TALHAO: Partial<Talhao> = {
  colheita_sugerida: { faixa: 'tarde', fonte: 'ndvi_modis', anos_usados: 10, dia: '02-25' },
  chuva_que_sobra: SOBRA,
  chuva_mensal: CHUVA,
  fim_das_chuvas: FIM,
  soja_recente: { safra: '2025/26', vista: true, ndvi_pico: 0.86, fonte: 'MODIS' },
}

function deps(talhao: Promise<Partial<Talhao>> = Promise.resolve(TALHAO), custo: Promise<CustoAtraso> = Promise.resolve(CUSTO)) {
  const farm: FarmService = { talhao: vi.fn().mockReturnValue(talhao), recomendacao: vi.fn().mockResolvedValue({}) }
  const delayCost: DelayCostService = { get: vi.fn().mockReturnValue(custo) }
  const rules: MethodRulesService = {
    get: vi.fn().mockResolvedValue({ deu_certo: { calor_temp_c: 35 } } as MetodoRegras),
  }
  const speech: SpeechService = { isSupported: () => true, speak: vi.fn(), stop: vi.fn() }
  return { farm, delayCost, rules, speech }
}

function render(d: ReturnType<typeof deps>, url = `/quando?${point}`) {
  return renderHook(() => useWhenController(d), { wrapper: providers(url) })
}

const location = () => screen.getByTestId('location').textContent

describe('useWhenController (tela 2 "Quando você colhe a soja?", tarefa 0057)', () => {
  it('abre sem data, mesmo com o dia do satélite: o produtor sempre escolhe, e o Próximo passo fica desligado', async () => {
    const d = deps()
    const { result } = render(d)

    await waitFor(() => expect(result.current.rainCurve).not.toBeNull())
    expect(result.current.choice).toBeNull()
    expect(result.current.canContinue).toBe(false)
    expect(result.current.rainLeft).toBeNull()
    expect(result.current.window).toEqual({ min: '2027-01-01', max: '2027-04-30' })
    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: false }, 'pt')
  })

  it('escolher a data grava data e colheita na URL (a época sai da data) e mostra a chuva desse dia', async () => {
    const { result } = render(deps())
    await waitFor(() => expect(result.current.rainCurve).not.toBeNull())

    act(() => result.current.pickDate('2027-02-25'))

    expect(location()).toBe(`/quando?${point}&colheita=tarde&data=2027-02-25`)
    expect(result.current.choice).toEqual({ band: 'tarde', date: '2027-02-25' })
    expect(result.current.canContinue).toBe(true)
    expect(result.current.rainLeft).toMatchObject({ date: '2027-02-25', medianMm: 367, dryMm: 276 })
  })

  it('data fora do campo (1/jan a 30/abr de 2027) não vale', async () => {
    const { result } = render(deps())
    await waitFor(() => expect(result.current.rainCurve).not.toBeNull())

    act(() => result.current.pickDate('2027-05-02'))

    expect(location()).toBe(`/quando?${point}`)
    expect(result.current.choice).toBeNull()
  })

  it('"Não sei o dia exato": o modal abre sem nada marcado e "Usar esta época" só vale depois de escolher', async () => {
    const { result } = render(deps())

    act(() => result.current.bandsModal.onOpen())
    expect(result.current.bandsModal.open).toBe(true)
    expect(result.current.bandsModal.draft).toBeNull()
    act(() => result.current.bandsModal.onSubmit())
    expect(result.current.bandsModal.open).toBe(true)

    act(() => result.current.bandsModal.onDraft('meio'))
    act(() => result.current.bandsModal.onSubmit())

    expect(result.current.bandsModal.open).toBe(false)
    expect(location()).toBe(`/quando?${point}&colheita=meio`)
    expect(result.current.choice).toEqual({ band: 'meio', date: null })
    await waitFor(() => expect(result.current.rainLeft).toMatchObject({ date: '2027-02-15', medianMm: 450 }))
  })

  it('o modal de época abre de novo sem nada marcado, mesmo com uma época já escolhida', () => {
    const { result } = render(deps(), `/quando?${point}&colheita=cedo`)

    act(() => result.current.bandsModal.onOpen())
    act(() => result.current.bandsModal.onDraft('tarde'))
    act(() => result.current.bandsModal.onClose())
    act(() => result.current.bandsModal.onOpen())

    expect(result.current.bandsModal.draft).toBeNull()
    expect(result.current.choice).toEqual({ band: 'cedo', date: null })
  })

  it('escolher a data depois da época tira a época da URL; e a época depois da data tira a data', async () => {
    const { result } = render(deps(), `/quando?${point}&colheita=meio`)

    act(() => result.current.pickDate('2027-01-20'))
    expect(location()).toBe(`/quando?${point}&colheita=cedo&data=2027-01-20`)

    act(() => result.current.details.onUseBand('tarde'))
    expect(location()).toBe(`/quando?${point}&colheita=tarde`)
  })

  it('voltando da tela seguinte, a escolha da URL continua (a data vale mais que a época)', () => {
    const { result } = render(deps(), `/quando?${point}&data=2027-02-25&colheita=cedo`)

    expect(result.current.choice).toEqual({ band: 'tarde', date: '2027-02-25' })
    expect(result.current.canContinue).toBe(true)
  })

  it('"Compare as épocas": a chuva de cada época e a melhor opção do motor, com a "sua época" marcada', async () => {
    const { result } = render(deps(), `/quando?${point}&colheita=meio`)

    await waitFor(() => expect(result.current.bands[2].best).not.toBeNull())
    expect(result.current.bands).toEqual([
      { band: 'cedo', day: '2027-02-05', rainMm: 500, best: { crop: 'milho_braquiaria', good: 18, total: 20 }, yours: false },
      { band: 'meio', day: '2027-02-15', rainMm: 450, best: { crop: 'milho_braquiaria', good: 16, total: 20 }, yours: true },
      { band: 'tarde', day: '2027-02-28', rainMm: 340, best: { crop: 'milheto', good: 20, total: 20 }, yours: false },
    ])
  })

  it('traz os blocos do modal grande: a chuva mês a mês, o fim das chuvas e o calor do "deu certo" (/api/metodo)', async () => {
    const { result } = render(deps())

    await waitFor(() => expect(result.current.heatC).toBe(35))
    await waitFor(() => expect(result.current.rainChart?.eto?.deficitMonth).toBe('feb'))
    expect(result.current.rainEnd?.median).toBe('2023-04-21')
  })

  it('o modal grande abre pela caixa e "Usar esta época" escolhe a época e fecha', () => {
    const { result } = render(deps())

    act(() => result.current.details.onOpen())
    expect(result.current.details.open).toBe(true)
    act(() => result.current.details.onUseBand('cedo'))

    expect(result.current.details.open).toBe(false)
    expect(result.current.choice).toEqual({ band: 'cedo', date: null })
  })

  it('avisa quando o satélite não vê soja no ponto (soja_recente.vista === false)', async () => {
    const notSoy = deps(Promise.resolve({ ...TALHAO, soja_recente: { safra: '2025/26', vista: false, ndvi_pico: 0.4, fonte: 'MODIS' } }))
    const { result } = render(notSoy)

    expect(result.current.notSoy).toBe(false)
    await waitFor(() => expect(result.current.notSoy).toBe(true))
  })

  it('sem o dado do satélite (vista null), nenhum aviso', async () => {
    const { result } = render(deps(Promise.resolve({ ...TALHAO, soja_recente: { safra: '2025/26', vista: null, ndvi_pico: null, fonte: 'MODIS' } })))

    await waitFor(() => expect(result.current.rainCurve).not.toBeNull())
    expect(result.current.notSoy).toBe(false)
  })

  it('"Próximo passo" leva a data e a época para a missão, com o resto do fluxo, e já pede a recomendação', async () => {
    const d = deps()
    const { result } = render(d, `/quando?${point}&exemplo=1&solo=argiloso&data=2027-02-25&colheita=tarde`)

    act(() => result.current.confirm())

    expect(location()).toBe(`/calculando?${point}&colheita=tarde&data=2027-02-25&solo=argiloso&exemplo=1`)
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'tarde', solo: 'argiloso', exemplo: true, confirmadas: undefined },
      'pt',
    )
  })

  it('só com a época, segue só a colheita', () => {
    const { result } = render(deps(), `/quando?${point}&colheita=meio`)

    act(() => result.current.confirm())

    expect(location()).toBe(`/calculando?${point}&colheita=meio`)
  })

  it('sem data nem época, o Próximo passo não faz nada', () => {
    const d = deps()
    const { result } = render(d)

    act(() => result.current.confirm())

    expect(location()).toBe(`/quando?${point}`)
    expect(d.farm.recomendacao).not.toHaveBeenCalled()
  })

  it('o Voltar leva para "Onde fica a lavoura" com o ponto', () => {
    const { result } = render(deps(), `/quando?${point}&exemplo=1&colheita=meio`)

    expect(result.current.backTo).toBe(`/onde?${point}&colheita=meio&exemplo=1`)
  })

  it('sem ponto na URL, volta para o mapa', () => {
    const { result } = render(deps(), '/quando')

    expect(result.current.missingPoint).toBe(true)
  })

  describe('"Ouvir resumo"', () => {
    it('sem data: pede para escolher o dia ou a época', () => {
      const d = deps()
      const { result } = render(d)

      act(() => result.current.listen.toggle())

      expect(d.speech.speak).toHaveBeenCalledWith(
        'Escolha o dia em que você colhe a soja. Se não souber o dia exato, escolha a época: começo, meio ou fim de fevereiro.',
        'pt',
        expect.any(Function),
      )
    })

    it('com a data: os números da chuva que sobra desse dia', async () => {
      const d = deps()
      const { result } = render(d, `/quando?${point}&data=2027-02-25&colheita=tarde`)
      await waitFor(() => expect(result.current.rainLeft).not.toBeNull())

      act(() => result.current.listen.toggle())

      expect(d.speech.speak).toHaveBeenCalledWith(
        'Colhendo em 25 de fevereiro, sobram em média 367 milímetros de chuva até o fim de junho; num ano seco, 276. Quanto mais cedo a colheita, mais chuva sobra para a próxima planta.',
        'pt',
        expect.any(Function),
      )
    })

    it('com a época: os números no dia de colheita da época no motor', async () => {
      const d = deps()
      const { result } = render(d, `/quando?${point}&colheita=meio`)
      await waitFor(() => expect(result.current.rainLeft).not.toBeNull())

      act(() => result.current.listen.toggle())

      expect(d.speech.speak).toHaveBeenCalledWith(
        'Colhendo no meio de fevereiro, sobram em média 450 milímetros de chuva até o fim de junho; num ano seco, 350. Quanto mais cedo a colheita, mais chuva sobra para a próxima planta.',
        'pt',
        expect.any(Function),
      )
    })

    it('com a data fora da conta da chuva (abril), sem os números', async () => {
      const d = deps()
      const { result } = render(d, `/quando?${point}&data=2027-04-10&colheita=tarde`)
      await waitFor(() => expect(result.current.rainCurve).not.toBeNull())

      act(() => result.current.listen.toggle())

      expect(d.speech.speak).toHaveBeenCalledWith(
        'Colhendo em 10 de abril. Quanto mais cedo a colheita, mais chuva sobra para a próxima planta.',
        'pt',
        expect.any(Function),
      )
    })
  })
})
