import { describe, expect, it, vi } from 'vitest'
import type { Historico } from '../models/talhao'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import { guideService } from './guideService'
import {
  PLAN_ARTICLES,
  createPlanService,
  rainSourceName,
  currentPlan,
  planChoices,
  planStartingWith,
  todayPlan,
  todayRows,
  withTodayAnswer,
  withYearCrop,
} from './planService'

const meio = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
const tarde = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'tarde' }, 'pt')
const historico = buildTalhao({ lat: -18.9543, lon: -48.1993 }, 'pt').historico as Historico

describe('planService: montar a rotação (tarefa 0045)', () => {
  it('cada ano escolhe entre as culturas que cabem na janela (na ordem do objetivo) e o "Deixar parado"', () => {
    expect(planChoices(meio, null)).toEqual([...meio.objetivos!.equilibrio!.ordem, 'pousio'])
    expect(planChoices(tarde, 'terra')).not.toContain('milho_safrinha')
    expect(planChoices(tarde, 'terra').at(-1)).toBe('pousio')
  })

  it('sem plano na URL, vale o plano sugerido do objetivo', () => {
    expect(currentPlan(meio, 'terra', undefined)).toEqual({
      years: meio.objetivos!.terra!.plano,
      suggested: meio.objetivos!.terra!.plano,
      edited: false,
    })
  })

  it('o plano editado da URL vale se todas as culturas cabem na janela', () => {
    const edited = currentPlan(meio, null, ['sorgo', 'pousio', 'milheto'])
    expect(edited).toMatchObject({ years: ['sorgo', 'pousio', 'milheto'], edited: true })

    expect(currentPlan(tarde, null, ['milho_safrinha', 'sorgo', 'sorgo']).edited).toBe(false)
    expect(currentPlan(meio, null, meio.objetivos!.equilibrio!.plano).edited).toBe(false)
  })

  it('troca a cultura de um ano e "Usar no meu plano" leva a cultura para o ano 1', () => {
    expect(withYearCrop(['sorgo', 'sorgo', 'sorgo'], 1, 'crotalaria')).toEqual(['sorgo', 'crotalaria', 'sorgo'])
    expect(planStartingWith(['milho_braquiaria', 'crotalaria', 'sorgo'], 'milheto')).toEqual([
      'milheto',
      'crotalaria',
      'sorgo',
    ])
  })
})

describe('planService: "Como é hoje" com o NDVI e a resposta do produtor (tarefa 0045)', () => {
  const years = [2024, 2025, 2026]

  it('uma linha por safra confirmável, com o que o satélite viu; parado já conta como "Deixar parado"', () => {
    // No exemplo: 2024 parado, 2025 parado, 2026 plantou
    const rows = todayRows(historico, years, {}, {})

    expect(rows.map((row) => [row.year, row.seen, row.value])).toEqual([
      [2024, 'parado', 'pousio'],
      [2025, 'parado', 'pousio'],
      [2026, 'plantou', null],
    ])
    expect(rows[2]).toMatchObject({ ndvi: 0.71, byProducer: false, answer: null })
  })

  it('a safra confirmada na tela 4 vale no lugar do satélite', () => {
    const rows = todayRows(historico, years, { 2024: 'plantou' }, {})

    expect(rows[0]).toMatchObject({ seen: 'plantou', byProducer: true, value: null })
  })

  it('a resposta do "O que foi?" vale mais que tudo', () => {
    const rows = todayRows(historico, years, {}, { 2024: 'sorgo', 2026: 'milho_safrinha' })

    expect(rows.map((row) => row.value)).toEqual(['sorgo', 'pousio', 'milho_safrinha'])
  })

  it('sem NDVI para o ponto, pergunta direto: nenhuma linha com o que o satélite viu', () => {
    const rows = todayRows(null, years, {}, {})

    expect(rows.map((row) => [row.seen, row.value])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ])
  })

  it('com as 3 safras conhecidas, "Como é hoje" é o que ele plantou; senão, a referência do motor', () => {
    const known = todayRows(historico, years, {}, { 2026: 'sorgo' })
    expect(todayPlan(known, meio)).toEqual({ crops: ['pousio', 'pousio', 'sorgo'], reference: false })

    const missing = todayRows(historico, years, {}, {})
    expect(todayPlan(missing, meio)).toEqual({ crops: meio.plano_3_anos.hoje.anos, reference: true })
    expect(todayPlan([], meio).reference).toBe(true)
  })

  it('marca e desmarca a resposta de um ano', () => {
    expect(withTodayAnswer({ 2024: 'sorgo' }, 2025, 'pousio')).toEqual({ 2024: 'sorgo', 2025: 'pousio' })
    expect(withTodayAnswer({ 2024: 'sorgo' }, 2024, null)).toEqual({})
  })
})

describe('planService: pedir a avaliação do plano (GET /api/plano)', () => {
  it('pede ao repository e guarda o mesmo plano em memória', async () => {
    const get = vi.fn().mockResolvedValue({ anos: [] })
    const service = createPlanService({ get })
    const params = { lat: 1, lon: 2, colheita: 'meio' as const, anos: ['sorgo', 'sorgo', 'sorgo'] as const }

    await service.evaluate(params, 'pt')
    await service.evaluate({ ...params, anos: ['sorgo', 'sorgo', 'sorgo'] }, 'pt')
    await service.evaluate({ ...params, anos: ['sorgo', 'pousio', 'sorgo'] }, 'pt')

    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenLastCalledWith({ ...params, anos: ['sorgo', 'pousio', 'sorgo'] }, 'pt')
  })

  it('não guarda a falha: o próximo pedido tenta de novo', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValue({ anos: [] })
    const service = createPlanService({ get })
    const params = { lat: 1, lon: 2, colheita: 'meio' as const, anos: ['sorgo', 'sorgo', 'sorgo'] as const }

    await expect(service.evaluate(params, 'pt')).rejects.toThrow('rede')
    await expect(service.evaluate(params, 'pt')).resolves.toEqual({ anos: [] })
  })
})

describe('planService: artigos do Guia da aba', () => {
  it('rotação, conta de água e veranico existem em pt e en', () => {
    for (const path of Object.values(PLAN_ARTICLES)) {
      const slug = path.replace('/guia/', '')
      expect(guideService.get('pt', slug)).not.toBeNull()
      expect(guideService.get('en', slug)).not.toBeNull()
    }
  })
})

describe('planService: nome da fonte da chuva na frase', () => {
  it('o nome de cada fonte da série, juntos com "+"', () => {
    expect(rainSourceName('gpm_imerg')).toBe('GPM IMERG')
    expect(rainSourceName('gpm_imerg+nasa_power')).toBe('GPM IMERG + NASA POWER')
    expect(rainSourceName('nasa_power')).toBe('NASA POWER')
  })
})
