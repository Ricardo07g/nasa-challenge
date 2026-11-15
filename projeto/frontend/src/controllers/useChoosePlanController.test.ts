import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlanoParams, PlanoSugestaoParams } from '../models/plano'
import type { Recomendacao } from '../models/recomendacao'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import { buildPlano, buildSugestao } from '../repositories/mocks/mockPlano'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import type { FarmService } from '../services/farmService'
import type { PastSeasonService } from '../services/pastSeasonService'
import type { PlanService } from '../services/planService'
import type { RaioXService } from '../services/raioXService'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { useChoosePlanController } from './useChoosePlanController'

const point = { lat: -18.9543, lon: -48.1993 }
const flow = 'lat=-18.9543&lon=-48.1993&colheita=tarde&data=2027-03-03'
const tarde = buildRecomendacao({ ...point, colheita: 'tarde' }, 'pt')

function deps(rec: Recomendacao = tarde) {
  const farm: FarmService = {
    talhao: vi.fn(() => Promise.resolve(buildTalhao(point, 'pt'))),
    recomendacao: vi.fn(() => Promise.resolve(rec)),
  }
  const suggest = vi.fn((params: PlanoSugestaoParams) => Promise.resolve(buildSugestao(params, 'pt')))
  const evaluate = vi.fn((params: PlanoParams) => Promise.resolve(buildPlano(params, 'pt')))
  const plan: PlanService = { suggest, evaluate }
  const raioX: RaioXService = { get: vi.fn((params) => Promise.resolve(buildRaioX(params, 'pt'))) }
  const pastSeason: PastSeasonService = { get: vi.fn(() => new Promise<never>(() => {})) }
  const speech: SpeechService = { isSupported: () => true, speak: vi.fn(), stop: vi.fn() }
  const print = vi.fn()
  return { farm, plan, raioX, pastSeason, speech, print, suggest, evaluate, today: () => '2026-11-15' }
}

async function ready(url = `/resposta?${flow}`, d = deps()) {
  const hook = renderHook(() => useChoosePlanController(d), { wrapper: providers(url) })
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return { ...hook, d }
}

const location = () => screen.getByTestId('location').textContent ?? ''

describe('useChoosePlanController (tela 5: "1. Escolher" e "2. Plano de 3 anos")', () => {
  it('a aba vem do endereço: /resposta e /opcoes abrem "Escolher"; /plano abre o plano', async () => {
    expect((await ready(`/resposta?${flow}`)).result.current.tab).toBe('choose')
    expect((await ready(`/opcoes?${flow}`)).result.current.tab).toBe('choose')
    expect((await ready(`/plano?${flow}`)).result.current.tab).toBe('plan')
  })

  it('o Voltar leva ao raio-X com o caminho; "Ver meu planejamento" leva ao /planejamento', async () => {
    const { result } = await ready()
    expect(result.current.backTo).toBe(`/satelite?${flow}`)
    expect(result.current.planningTo).toBe(`/planejamento?${flow}`)
  })

  it('a sugestão, a escolha atual do raio-X e a comparação de partida (escolha + sugestão)', async () => {
    const { result } = await ready(`/resposta?${flow}&pensa=sorgo`)
    const choose = result.current.choose!
    expect(choose.suggestion.id).toBe('milho_braquiaria')
    expect(choose.choice).toBe('sorgo')
    expect(choose.compared).toEqual(['sorgo', 'milho_braquiaria'])
    expect(choose.columns.map((column) => column.id)).toEqual(['sorgo', 'milho_braquiaria'])
    expect(choose.picker.map((item) => item.id)).toContain('pousio')
    expect(choose.picker.find((item) => item.id === 'milho_safrinha')?.late).toBe(true)
  })

  it('sem escolha atual ("Ainda não sei"), vale a sugestão, e a comparação ganha a próxima do ranking', async () => {
    const { result } = await ready(`/resposta?${flow}&pensa=nao_sei`)
    expect(result.current.choose?.choice).toBe('milho_braquiaria')
    expect(result.current.choose?.compared).toHaveLength(2)
    expect(result.current.choose?.compared[0]).toBe('milho_braquiaria')
  })

  it('marcar uma caixinha grava a comparação na URL', async () => {
    const { result } = await ready()
    act(() => result.current.toggleCompared('pousio'))
    expect(location()).toContain('&comparar=milho_braquiaria,')
    expect(location()).toContain(',pousio')
  })

  it('"Essa é a escolha para o meu plano" grava a escolha, congela a comparação e mostra o alerta do 1º ano', async () => {
    const { result } = await ready()
    act(() => result.current.chooseForPlan('milho_safrinha'))

    expect(location()).toContain('escolha=milho_safrinha')
    expect(result.current.choose?.choice).toBe('milho_safrinha')
    expect(result.current.choose?.compared).toContain('milho_safrinha')
    expect(result.current.plan.alert).toBe('year1')
  })

  it('trocar o objetivo grava na URL e solta a comparação', async () => {
    const { result } = await ready(`/resposta?${flow}&comparar=sorgo,pousio`)
    act(() => result.current.chooseObjective('renda'))
    expect(location()).toContain('objetivo=renda')
    expect(location()).not.toContain('comparar=')
  })

  it('o plano pede a sugestão em cadeia com o 1º ano e monta os 3 cartões', async () => {
    const { result, d } = await ready(`/plano?${flow}&escolha=sorgo`)

    await waitFor(() => expect(result.current.plan.cards).not.toBeNull())
    expect(d.suggest).toHaveBeenCalledWith(expect.objectContaining({ fixos: ['sorgo'], colheita: 'tarde' }), 'pt')
    expect(result.current.plan.cards?.map((card) => [card.season, card.crop, card.tag])).toEqual([
      [2027, 'sorgo', 'choice'],
      [2028, 'milheto', 'suggested'],
      [2029, 'sorgo', 'suggested'],
    ])
  })

  it('mudar o 2º ano refaz o 3º (sugestão com os dois fixos) e mostra o alerta; "Voltar ao plano sugerido" desfaz', async () => {
    const { result, d } = await ready(`/plano?${flow}&escolha=sorgo`)
    await waitFor(() => expect(result.current.plan.cards).not.toBeNull())

    act(() => result.current.plan.chooseYear(1, 'pousio'))
    expect(location()).toContain('ano2=pousio')
    await waitFor(() => expect(d.suggest).toHaveBeenLastCalledWith(expect.objectContaining({ fixos: ['sorgo', 'pousio'] }), 'pt'))
    await waitFor(() => expect(result.current.plan.cards?.[2].crop).toBe('milheto'))
    expect(result.current.plan.cards?.[1].tag).toBe('changed')
    expect(result.current.plan.alert).toBe('year2')

    act(() => result.current.plan.reset())
    expect(location()).not.toContain('ano2=')
    expect(result.current.plan.alert).toBeNull()
  })

  it('mudar o 3º ano avalia o plano inteiro no /api/plano', async () => {
    const { result, d } = await ready(`/plano?${flow}&escolha=sorgo`)
    await waitFor(() => expect(result.current.plan.cards).not.toBeNull())

    act(() => result.current.plan.chooseYear(2, 'crotalaria'))
    await waitFor(() => expect(d.evaluate).toHaveBeenCalledWith(expect.objectContaining({ anos: ['sorgo', 'milheto', 'crotalaria'] }), 'pt'))
    await waitFor(() => expect(result.current.plan.cards?.[2]).toMatchObject({ crop: 'crotalaria', tag: 'changed' }))
  })

  it('mudar o 1º ano no plano muda a escolha da aba 1 e põe a cultura na comparação', async () => {
    const { result } = await ready(`/plano?${flow}`)
    act(() => result.current.plan.chooseYear(0, 'pousio'))
    expect(location()).toContain('escolha=pousio')
    expect(result.current.choose?.compared).toContain('pousio')
  })

  it('"Como é hoje": com as 3 safras respondidas, avalia o plano delas', async () => {
    const { result, d } = await ready(`/plano?${flow}&safras=2024:milho_braquiaria,2025:pousio,2026:sorgo`)
    expect(result.current.today.state).toEqual({ kind: 'crops', crops: ['milho_braquiaria', 'pousio', 'sorgo'] })
    await waitFor(() => expect(d.evaluate).toHaveBeenCalledWith(expect.objectContaining({ anos: ['milho_braquiaria', 'pousio', 'sorgo'] }), 'pt'))
    await waitFor(() => expect(result.current.today.evaluation.data).not.toBeNull())
  })

  it('"Como é hoje" sem as safras: "não preenchido"; preencher no modal grava na URL sem sair da tela', async () => {
    const { result } = await ready(`/plano?${flow}`)
    expect(result.current.today.state).toEqual({ kind: 'missing' })

    act(() => result.current.seasons.onOpen())
    expect(result.current.seasons.open).toBe(true)
    act(() => result.current.seasons.form.onAnswer(2025, 'milheto'))
    expect(location()).toContain('safras=2025:milheto')
    expect(location().startsWith('/plano?')).toBe(true)
  })

  it('"Como é hoje" com "Não plantei" numa safra: não dá para comparar, sem o aviso de não preenchido', async () => {
    const { result } = await ready(`/plano?${flow}&safras=2024:sem_soja,2025:pousio,2026:sorgo`)
    expect(result.current.today.state).toEqual({ kind: 'noSoy', seasons: [2024] })
  })

  it('trocar de aba troca o endereço, mantendo o caminho', async () => {
    const { result } = await ready(`/resposta?${flow}&escolha=sorgo`)
    act(() => result.current.selectTab('plan'))
    expect(location()).toBe(`/plano?${flow}&escolha=sorgo`)
    act(() => result.current.goToChoose())
    expect(location()).toBe(`/resposta?${flow}&escolha=sorgo`)
    act(() => result.current.goToPlan())
    expect(location()).toBe(`/plano?${flow}&escolha=sorgo`)
  })

  it('os modais: "Por que essa sugestão?", a célula, a nota e o ano tocado (na URL)', async () => {
    const { result } = await ready()
    act(() => result.current.why.onOpen())
    expect(result.current.why.open).toBe(true)
    act(() => result.current.why.year.choose(2015))
    expect(location()).toContain('ano=2015')
    expect(result.current.why.year.selected?.ano).toBe(2015)
    act(() => result.current.why.onClose())
    expect(result.current.why.open).toBe(false)
    expect(location()).not.toContain('ano=')

    act(() => result.current.cell.onOpen('sorgo', 'deadline'))
    expect(result.current.cell.open).toEqual({ crop: 'sorgo', row: 'deadline' })
    act(() => result.current.cell.onClose())
    expect(result.current.cell.open).toBeNull()

    act(() => result.current.score.onOpen('solo'))
    expect(result.current.score.open).toBe('solo')
  })

  it('um link com o ano (dos avisos) abre o "Por que essa sugestão?" naquele ano', async () => {
    const { result } = await ready(`/resposta?${flow}&ano=2016`)
    expect(result.current.why.open).toBe(true)
    expect(result.current.why.year.selected?.ano).toBe(2016)
  })

  it('"Imprimir relatório" chama a impressão; o relatório tem o raio-X e a data de hoje', async () => {
    const { result, d } = await ready()
    await waitFor(() => expect(result.current.report.raio).not.toBeNull())
    expect(result.current.report.generatedOn).toBe('2026-11-15')
    act(() => result.current.print())
    expect(d.print).toHaveBeenCalledTimes(1)
  })

  it('o "Ouvir resumo" fala a sugestão e o que o produtor pensava', async () => {
    const { result, d } = await ready(`/resposta?${flow}&pensa=sorgo`)
    act(() => result.current.listen.toggle())
    expect(d.speech.speak).toHaveBeenCalledWith(
      'A nossa sugestão para depois da soja é milho com braquiária. Você pensava em sorgo. Compare as opções e escolha uma para o seu plano de 3 anos.',
      'pt',
      expect.any(Function),
    )
  })

  it('sem ponto volta ao mapa; sem colheita volta para a pergunta da colheita', async () => {
    const d = deps()
    const noPoint = renderHook(() => useChoosePlanController(d), { wrapper: providers('/resposta') })
    expect(noPoint.result.current.redirectTo).toBe('/onde')
    const noHarvest = renderHook(() => useChoosePlanController(d), { wrapper: providers('/plano?lat=-18.9543&lon=-48.1993') })
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })
})
