import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlanoParams, PlanoSugestaoParams } from '../models/plano'
import type { RaioX, RaioXParams } from '../models/raioX'
import type { Recomendacao } from '../models/recomendacao'
import type { Colheita } from '../models/talhao'
import { ApiError } from '../repositories/httpClient'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import { buildPlano, buildSugestao } from '../repositories/mocks/mockPlano'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import type { FarmService } from '../services/farmService'
import type { PlanService } from '../services/planService'
import type { RaioXService } from '../services/raioXService'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { usePlanningController, type PlanningDeps } from './usePlanningController'

const point = { lat: -18.9543, lon: -48.1993 }
const flow = 'lat=-18.9543&lon=-48.1993&colheita=tarde&data=2027-03-03'

function deps(options: { raio?: () => Promise<RaioX>; rec?: (colheita: Colheita) => Promise<Recomendacao> } = {}) {
  const farm: FarmService = {
    talhao: vi.fn(() => Promise.resolve(buildTalhao(point, 'pt'))),
    recomendacao: vi.fn((params: { colheita: Colheita }) =>
      (options.rec ?? ((c: Colheita) => Promise.resolve(buildRecomendacao({ ...point, colheita: c }, 'pt'))))(params.colheita),
    ),
  }
  const plan: PlanService = {
    suggest: vi.fn((params: PlanoSugestaoParams) => Promise.resolve(buildSugestao(params, 'pt'))),
    evaluate: vi.fn((params: PlanoParams) => Promise.resolve(buildPlano(params, 'pt'))),
  }
  const raioX: RaioXService = { get: vi.fn(options.raio ?? ((params: RaioXParams) => Promise.resolve(buildRaioX(params, 'pt')))) }
  const speech: SpeechService = { isSupported: () => true, speak: vi.fn(), stop: vi.fn() }
  const geocoding = { reverse: vi.fn(() => Promise.resolve('Fazenda Boa Vista, Uberlândia, Minas Gerais')) }
  const d = { farm, plan, raioX, speech, geocoding, print: vi.fn(), today: () => '2026-11-15' } satisfies PlanningDeps
  return d
}

async function ready(url: string, d = deps()) {
  const hook = renderHook(() => usePlanningController(d), { wrapper: providers(url) })
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return { ...hook, d }
}

const location = () => screen.getByTestId('location').textContent ?? ''

describe('usePlanningController (tela 6 "Seu planejamento", pacote 3)', () => {
  it('o plano é o mesmo da tela 5: a escolha da URL e a sugestão em cadeia do /api/plano/sugestao', async () => {
    const { result, d } = await ready(`/planejamento?${flow}&escolha=sorgo&solo=argiloso`)

    expect(result.current.plan.cards?.map((card) => card.crop)).toEqual(['sorgo', 'milheto', 'sorgo'])
    expect(d.plan.suggest).toHaveBeenCalledWith(expect.objectContaining({ fixos: ['sorgo'], colheita: 'tarde', solo: 'argiloso' }), 'pt')
    expect(d.raioX.get).toHaveBeenCalledWith({ ...point, colheita: 'tarde', solo: 'argiloso' }, 'pt')
  })

  it('"Voltar ao plano" e "Mudar o plano" levam a /plano com o fluxo inteiro; os outros links', async () => {
    const { result } = await ready(`/planejamento?${flow}&escolha=sorgo&ano3=crotalaria&safras=2025:pousio`)
    const query = `?${flow}&safras=2025:pousio&escolha=sorgo&ano3=crotalaria`

    expect(result.current.backTo).toBe(`/plano${query}`)
    expect(result.current.changeTo).toBe(`/plano${query}`)
    expect(result.current.avisosTo).toBe(`/avisos${query}`)
    expect(result.current.officialTo).toBe(`/avisos${query}#alertas-oficiais`)
    expect(result.current.guideTo).toBe('/guia')
    expect(result.current.newPlanTo).toBe('/onde')
  })

  it('a linha do tempo usa a data da colheita da tela 2 e o prazo do ZARC da cultura do 1º ano', async () => {
    const { result } = await ready(`/planejamento?${flow}&escolha=sorgo`)
    const steps = result.current.timeline!

    expect(steps.map((step) => step.kind)).toEqual(['now', 'signal', 'harvest', 'plant', 'water', 'cropHarvest', 'next'])
    expect(steps.find((step) => step.kind === 'harvest')).toEqual({ kind: 'harvest', date: '2027-03-03' })
    expect(steps.find((step) => step.kind === 'plant')).toMatchObject({ crop: 'sorgo', sowing: '2027-03-03', late: false })
  })

  it('só com a época (sem data): a colheita é o dia da época no motor e o plantio, a semeadura do motor', async () => {
    const { result } = await ready('/planejamento?lat=-18.9543&lon=-48.1993&colheita=meio&escolha=sorgo')
    const steps = result.current.timeline!

    expect(steps.find((step) => step.kind === 'harvest')).toEqual({ kind: 'harvest', date: '2027-02-15' })
    expect(steps.find((step) => step.kind === 'plant')).toMatchObject({ sowing: '2027-02-18' })
    expect(result.current.harvest).toEqual({ date: null, band: 'meio', day: '2027-02-15' })
  })

  it('a crotalária não tem ZARC (tarefa 0066 do backend): o plantio e a próxima soja dizem data sugerida', async () => {
    const first = (await ready(`/planejamento?${flow}&escolha=crotalaria`)).result.current.timeline!
    const second = (await ready(`/planejamento?${flow}&escolha=sorgo&ano2=crotalaria`)).result.current.timeline!

    expect(first.find((step) => step.kind === 'plant')).toMatchObject({ crop: 'crotalaria', zarc: false })
    expect(second.find((step) => step.kind === 'plant')).toMatchObject({ crop: 'sorgo', zarc: true })
    expect(second.find((step) => step.kind === 'next')).toMatchObject({ crop: 'crotalaria', zarc: false })
  })

  it('o 1º ano fora do prazo (milho sozinho na colheita tarde) marca o plantio', async () => {
    const { result } = await ready(`/planejamento?${flow}&escolha=milho_safrinha`)
    expect(result.current.timeline!.find((step) => step.kind === 'plant')).toMatchObject({ late: true, deadline: '2027-02-28' })
  })

  it('os alertas: a previsão da NOAA (o sinal) e a chuva forte do raio-X; o fogo sem dado não aparece', async () => {
    const { result } = await ready(`/planejamento?${flow}`)
    expect(result.current.alerts.map((alert) => alert.kind)).toEqual(['now', 'heavyRain'])
  })

  it('na demonstração, o nome da lavoura de demonstração e nada para o Photon', async () => {
    const { result, d } = await ready(`/planejamento?${flow}&exemplo=1`)
    expect(result.current.place).toEqual({ demo: true, name: null, point })
    expect(d.geocoding.reverse).not.toHaveBeenCalled()
  })

  it('fora da demonstração, o mesmo nome da tela 1 (Photon, um pedido); antes dele, a cidade mais perto', async () => {
    const { result, d } = await ready(`/planejamento?${flow}`)
    expect(result.current.place.name).toBe('Uberlândia (MG)')
    await waitFor(() => expect(result.current.place.name).toBe('Fazenda Boa Vista, Uberlândia, Minas Gerais'))
    expect(d.geocoding.reverse).toHaveBeenCalledTimes(1)
  })

  it('"Ouvir resumo" fala o plano, a colheita e o prazo e o Plano B', async () => {
    const { result, d } = await ready(`/planejamento?${flow}&escolha=sorgo`)
    act(() => result.current.listen.toggle())
    expect(d.speech.speak).toHaveBeenCalledWith(
      'Seu plano: sorgo depois da soja de 2026/27, milheto em 2027/28 e sorgo em 2028/29. Colha a soja por volta de 3 de março e plante sorgo até 20 de março. Em fevereiro, confira o sinal do outono: se o ano vier seco, troque para crotalária.',
      'pt',
      expect.any(Function),
    )
  })

  it('"Imprimir relatório" chama a impressão; o relatório tem o raio-X, o ganho do plano e a data de hoje', async () => {
    const { result, d } = await ready(`/planejamento?${flow}&escolha=sorgo`)
    await waitFor(() => expect(result.current.raio).not.toBeNull())
    expect(result.current.generatedOn).toBe('2026-11-15')
    expect(result.current.gain?.income).toEqual([{ crop: 'sorgo', seasons: [2027, 2029] }])
    act(() => result.current.print())
    expect(d.print).toHaveBeenCalledTimes(1)
  })

  it('últimas safras: a resposta, ou o que o satélite viu; faltou, "não preenchido" com o "Preencher agora"', async () => {
    const { result } = await ready(`/planejamento?${flow}&safras=2024:milho_braquiaria`)
    await waitFor(() => expect(result.current.seasons.list[0]).toEqual({ year: 2024, kind: 'answer', answer: 'milho_braquiaria' }))

    act(() => result.current.seasons.onOpen())
    expect(result.current.seasons.open).toBe(true)
    act(() => result.current.seasons.form.onAnswer(2025, 'pousio'))
    await waitFor(() => expect(location()).toContain('safras=2024:milho_braquiaria,2025:pousio'))
    expect(location()).toMatch(/^\/planejamento\?/)
  })

  it('sem ponto volta ao mapa; sem colheita volta para a pergunta da colheita', () => {
    const d = deps()
    const noPoint = renderHook(() => usePlanningController(d), { wrapper: providers('/planejamento') })
    const noHarvest = renderHook(() => usePlanningController(d), { wrapper: providers('/planejamento?lat=-18.9543&lon=-48.1993') })

    expect(noPoint.result.current.redirectTo).toBe('/onde')
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })

  it('fora da área vira "fora da área"; falha da recomendação, erro com "tentar de novo"', async () => {
    const outsideDeps = deps({ rec: () => Promise.reject(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA')) })
    const outside = renderHook(() => usePlanningController(outsideDeps), { wrapper: providers(`/planejamento?${flow}`) })
    await waitFor(() => expect(outside.result.current.status).toBe('outside'))

    let calls = 0
    const failing = deps({
      rec: (c) => (++calls === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(buildRecomendacao({ ...point, colheita: c }, 'pt'))),
    })
    const { result } = renderHook(() => usePlanningController(failing), { wrapper: providers(`/planejamento?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('sem o raio-X (falha), a tela segue sem os blocos dele', async () => {
    const { result } = await ready(`/planejamento?${flow}`, deps({ raio: () => Promise.reject(new Error('fora do ar')) }))
    expect(result.current.raio).toBeNull()
    expect(result.current.alerts.map((alert) => alert.kind)).toEqual(['now'])
  })
})
