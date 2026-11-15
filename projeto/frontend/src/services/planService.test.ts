import { describe, expect, it, vi } from 'vitest'
import type { AnoPlano, PlanoAB, PlanoAvaliado } from '../models/plano'
import type { CropId } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { buildSugestao } from '../repositories/mocks/mockPlano'
import {
  PLAN_ARTICLES,
  createPlanService,
  finalCrops,
  planBState,
  planCards,
  planEdited,
  planEdits,
  planSignal,
  rainRows,
  rainSourceName,
  resetPlanFlow,
  signalParts,
  suggestedFor,
  suggestionFixos,
  todayState,
  yearFlow,
  type PlanSources,
} from './planService'

const point = { lat: -18.9543, lon: -48.1993, colheita: 'tarde' as const }

function year(cultura: CropId, extra: Partial<AnoPlano> = {}): AnoPlano {
  return {
    cultura,
    nome: cultura,
    na_janela: true,
    anos_bons: 11,
    total_anos: 20,
    futuro_anos_bons: 10,
    sede: 'media',
    cobre_terra: true,
    deixa_nitrogenio: false,
    quebra_nematoide: false,
    usa_mm: 180,
    fora_do_prazo: false,
    fixo: true,
    motivo: null,
    ...extra,
  }
}

function plan(anos: AnoPlano[], extra: Partial<PlanoAvaliado> = {}): PlanoAvaliado {
  return {
    colheita: 'tarde',
    semeadura: '2027-03-03',
    anos,
    notas: { seguranca: 70, solo: 40, futuro: 70 },
    terra: { anos_cobertos: 3, anos_nitrogenio: 0, anos_nematoide: 1, repetidas: [], total: 3, bonus_diversidade: 5 },
    chuva: { inicio: '2027-03-03', fim: '07-31', chuva_mm: 341, usa_media_mm: 122, anos: 20, fonte: 'gpm_imerg' },
    plano_ab: null,
    ...extra,
  }
}

/** As respostas que a aba usa; sem dizer, o 1º ano é sorgo e a sugestão da aba Escolher também. */
function sources(extra: Partial<PlanSources>): PlanSources {
  return {
    choice: 'sorgo',
    suggestion: 'sorgo',
    edits: { year2: null, year3: null },
    fromChoice: null,
    fromYear2: null,
    final: null,
    ...extra,
  }
}

describe('planService: o plano em cadeia da aba "2. Plano de 3 anos" (tela 5, tarefa 0056)', () => {
  it('os anos que o produtor mudou vêm da URL', () => {
    expect(planEdits({ ano2: 'pousio' })).toEqual({ year2: 'pousio', year3: null })
    expect(planEdits({})).toEqual({ year2: null, year3: null })
  })

  it('o que fixar no /api/plano/sugestao: o 1º ano e, se mudou para outra cultura que não a sugestão, o 2º', () => {
    expect(suggestionFixos('sorgo', { year2: null, year3: null })).toEqual(['sorgo'])
    expect(suggestionFixos('sorgo', { year2: 'pousio', year3: null })).toEqual(['sorgo', 'pousio'])
    expect(suggestionFixos('sorgo', { year2: 'pousio', year3: 'sorgo' })).toEqual(['sorgo', 'pousio'])
    // O 2º ano igual à sugestão (link antigo) é o plano sugerido: o 3º vem da sugestão com o 1º ano só.
    expect(suggestionFixos('sorgo', { year2: 'milheto', year3: null }, 'milheto')).toEqual(['sorgo'])
    expect(suggestionFixos('sorgo', { year2: 'pousio', year3: null }, 'milheto')).toEqual(['sorgo', 'pousio'])
  })

  it('com o 3º ano mudado, o plano final vai inteiro para o /api/plano (o 2º sugerido entra como está)', () => {
    const base = plan([year('sorgo'), year('milheto', { fixo: false }), year('sorgo', { fixo: false })])
    expect(finalCrops('sorgo', { year2: null, year3: 'pousio' }, base)).toEqual(['sorgo', 'milheto', 'pousio'])
    expect(finalCrops('sorgo', { year2: 'crotalaria', year3: 'pousio' }, null)).toEqual(['sorgo', 'crotalaria', 'pousio'])
    expect(finalCrops('sorgo', { year2: null, year3: 'pousio' }, null)).toBeNull()
    expect(finalCrops('sorgo', { year2: 'pousio', year3: null }, base)).toBeNull()
  })

  it('os 3 cartões: safra, etiqueta, deu certo, sede, fora do prazo e o porquê só nos anos sugeridos', () => {
    const fromChoice = buildSugestao({ ...point, fixos: ['sorgo'] }, 'pt')
    const fromYear2 = buildSugestao({ ...point, fixos: ['sorgo', 'pousio'] }, 'pt')
    const cards = planCards(sources({ edits: { year2: 'pousio', year3: null }, fromChoice, fromYear2 }), 2027)
    expect(cards?.map((card) => [card.season, card.crop, card.tag])).toEqual([
      [2027, 'sorgo', 'choice'],
      [2028, 'pousio', 'changed'],
      [2029, 'milheto', 'suggested'],
    ])
    expect(cards?.[2].motivo).toMatch(/terra ficou descoberta/)
    expect(cards?.[0].motivo).toBeNull()
    expect(cards?.[1]).toMatchObject({ good: null, total: null, sede: null, motivo: null })
  })

  it('com o 3º ano mudado, os números vêm do plano final e o porquê do 2º ano fica o da sugestão', () => {
    const fromChoice = plan([year('sorgo'), year('milheto', { fixo: false, motivo: 'varia a cultura' }), year('sorgo', { fixo: false })])
    const final = plan([year('sorgo'), year('milheto'), year('crotalaria', { anos_bons: 20, fora_do_prazo: true })])
    const cards = planCards(sources({ edits: { year2: null, year3: 'crotalaria' }, fromChoice, final }), 2027)
    expect(cards?.map((card) => card.tag)).toEqual(['choice', 'suggested', 'changed'])
    expect(cards?.[1].motivo).toBe('varia a cultura')
    expect(cards?.[2]).toMatchObject({ crop: 'crotalaria', good: 20, late: true, motivo: null })
  })

  it('com o 3º ano mudado e o plano final ainda carregando, os cartões ficam os da sugestão (a tela não pisca)', () => {
    const fromChoice = plan([year('sorgo'), year('milheto', { fixo: false }), year('sorgo', { fixo: false })])
    const cards = planCards(sources({ edits: { year2: null, year3: 'crotalaria' }, fromChoice }), 2027)
    expect(cards?.map((card) => card.crop)).toEqual(['sorgo', 'milheto', 'sorgo'])
  })

  it('sem a sugestão ainda (carregando), nada de cartão', () => {
    expect(planCards(sources({}), 2027)).toBeNull()
  })

  it('sem escolha do produtor (não marcou nada ou "Ainda não sei"), o 1º ano é a nossa sugestão, não "Sua escolha" (15/11/2026)', () => {
    const fromChoice = buildSugestao({ ...point, fixos: ['sorgo'] }, 'pt')
    const cards = planCards(sources({ own: null, fromChoice }), 2027)
    expect(cards?.[0]).toMatchObject({ crop: 'sorgo', tag: 'suggested' })
    expect(planCards(sources({ own: 'sorgo', fromChoice }), 2027)?.[0].tag).toBe('choice')
  })

  it('trocar o 1º ano solta o 2º e o 3º; trocar o 2º solta o 3º; trocar o 3º só grava ele', () => {
    const params = { lat: 1, lon: 2, escolha: 'sorgo' as const, ano2: 'pousio' as const, ano3: 'milheto' as const }
    expect(yearFlow(params, 0, 'milheto')).toMatchObject({ escolha: 'milheto', ano2: undefined, ano3: undefined })
    expect(yearFlow(params, 1, 'sorgo')).toMatchObject({ escolha: 'sorgo', ano2: 'sorgo', ano3: undefined })
    expect(yearFlow(params, 2, 'crotalaria')).toMatchObject({ escolha: 'sorgo', ano2: 'pousio', ano3: 'crotalaria' })
  })

  it('"Voltar ao plano sugerido" tira os anos mudados e mantém a escolha', () => {
    expect(resetPlanFlow({ lat: 1, lon: 2, escolha: 'sorgo', ano2: 'pousio', ano3: 'sorgo' })).toEqual({
      lat: 1,
      lon: 2,
      escolha: 'sorgo',
      ano2: undefined,
      ano3: undefined,
    })
  })
})

describe('planService: a nossa sugestão de cada ano, sempre visível (pacote 3, tarefa 0064)', () => {
  // Cadeia do motor com o 1º ano fixo (sorgo): milheto e depois sorgo; com o 2º fixo em pousio, o 3º é milheto.
  const fromChoice = plan([
    year('sorgo'),
    year('milheto', { fixo: false, motivo: 'varia a cultura' }),
    year('sorgo', { fixo: false, motivo: 'dá grão para vender' }),
  ])
  const fromYear2 = plan([year('sorgo'), year('pousio'), year('milheto', { fixo: false, motivo: 'a terra ficou descoberta' })])

  it('1º ano: a sugestão da aba Escolher (o porquê fica no cartão da aba 1)', () => {
    expect(suggestedFor(0, sources({ suggestion: 'milho_braquiaria', fromChoice }))).toEqual({ crop: 'milho_braquiaria', motivo: null })
  })

  it('2º ano: o anos[1] da sugestão com o 1º ano fixo, com o porquê dessa mesma resposta', () => {
    expect(suggestedFor(1, sources({ fromChoice }))).toEqual({ crop: 'milheto', motivo: 'varia a cultura' })
    // Mesmo com o 2º ano mudado, a sugestão dele continua a da cadeia com o 1º ano só.
    expect(suggestedFor(1, sources({ edits: { year2: 'pousio', year3: null }, fromChoice, fromYear2 }))).toEqual({
      crop: 'milheto',
      motivo: 'varia a cultura',
    })
  })

  it('3º ano: com o 2º ano sugerido, o anos[2] da sugestão com o 1º ano fixo', () => {
    expect(suggestedFor(2, sources({ fromChoice }))).toEqual({ crop: 'sorgo', motivo: 'dá grão para vender' })
    // O 2º ano igual à sugestão (link antigo com ano2) não muda nada.
    expect(suggestedFor(2, sources({ edits: { year2: 'milheto', year3: null }, fromChoice }))).toEqual({
      crop: 'sorgo',
      motivo: 'dá grão para vender',
    })
  })

  it('3º ano: com o 2º ano mudado, o anos[2] da sugestão com os dois anos fixos', () => {
    expect(suggestedFor(2, sources({ edits: { year2: 'pousio', year3: null }, fromChoice, fromYear2 }))).toEqual({
      crop: 'milheto',
      motivo: 'a terra ficou descoberta',
    })
    // Com o 3º ano mudado também: a sugestão dele não muda.
    expect(suggestedFor(2, sources({ edits: { year2: 'pousio', year3: 'sorgo' }, fromChoice, fromYear2 }))?.crop).toBe('milheto')
  })

  it('enquanto a resposta não chega, ou se ela é de outro plano (pedido antigo), a sugestão do ano fica desconhecida', () => {
    expect(suggestedFor(1, sources({}))).toBeNull()
    expect(suggestedFor(2, sources({ edits: { year2: 'pousio', year3: null }, fromChoice }))).toBeNull()
    // A resposta ainda é da escolha anterior (o 1º ano mudou) ou do 2º ano anterior.
    expect(suggestedFor(1, sources({ choice: 'milheto', fromChoice }))).toBeNull()
    expect(suggestedFor(2, sources({ edits: { year2: 'crotalaria', year3: null }, fromChoice, fromYear2 }))).toBeNull()
  })

  it('"Você mudou" só quando a cultura do ano é diferente da sugestão dele; o cartão leva a sugestão', () => {
    const cards = planCards(sources({ edits: { year2: 'pousio', year3: null }, fromChoice, fromYear2 }), 2027)
    expect(cards?.map((card) => [card.crop, card.tag, card.suggested?.crop])).toEqual([
      ['sorgo', 'choice', 'sorgo'],
      ['pousio', 'changed', 'milheto'],
      ['milheto', 'suggested', 'milheto'],
    ])
  })

  it('o 2º ano igual à sugestão (link antigo) volta a "Nossa sugestão", com o porquê, e o 3º segue a cadeia do 1º ano', () => {
    const cards = planCards(sources({ edits: { year2: 'milheto', year3: null }, fromChoice }), 2027)
    expect(cards?.map((card) => [card.crop, card.tag, card.motivo])).toEqual([
      ['sorgo', 'choice', null],
      ['milheto', 'suggested', 'varia a cultura'],
      ['sorgo', 'suggested', 'dá grão para vender'],
    ])
  })

  it('o 3º ano mudado para a própria sugestão também é "Nossa sugestão"', () => {
    const final = plan([year('sorgo'), year('milheto'), year('sorgo')])
    const cards = planCards(sources({ edits: { year2: null, year3: 'sorgo' }, fromChoice, final }), 2027)
    expect(cards?.[2]).toMatchObject({ crop: 'sorgo', tag: 'suggested', motivo: 'dá grão para vender' })
  })

  it('o 1º ano é sempre "Sua escolha", com a sugestão da aba 1 ao lado quando é outra cultura', () => {
    const cards = planCards(sources({ suggestion: 'milho_braquiaria', fromChoice }), 2027)
    expect(cards?.[0]).toMatchObject({ crop: 'sorgo', tag: 'choice', suggested: { crop: 'milho_braquiaria', motivo: null } })
  })

  it('sem a sugestão do ano (carregando), vale o que está na URL: ano mudado é "Você mudou"', () => {
    const stale = plan([year('sorgo'), year('milheto'), year('sorgo')])
    const cards = planCards(sources({ edits: { year2: 'pousio', year3: null }, fromYear2: stale }), 2027)
    expect(cards?.map((card) => card.tag)).toEqual(['choice', 'changed', 'suggested'])
  })

  it('o plano foi mudado quando algum cartão diz "Você mudou" (sem cartão, quando a URL tem ano mudado)', () => {
    const changed = planCards(sources({ edits: { year2: 'pousio', year3: null }, fromChoice, fromYear2 }), 2027)
    const back = planCards(sources({ edits: { year2: 'milheto', year3: null }, fromChoice }), 2027)
    expect(planEdited(changed, { year2: 'pousio', year3: null })).toBe(true)
    expect(planEdited(back, { year2: 'milheto', year3: null })).toBe(false)
    expect(planEdited(null, { year2: 'pousio', year3: null })).toBe(true)
    expect(planEdited(null, { year2: null, year3: null })).toBe(false)
  })

  it('escolher de novo a sugestão do 2º ano tira o ano2 (e solta o 3º); a do 3º tira o ano3', () => {
    const params = { lat: 1, lon: 2, escolha: 'sorgo' as const, ano2: 'pousio' as const, ano3: 'sorgo' as const }
    expect(yearFlow(params, 1, 'milheto', 'milheto')).toMatchObject({ escolha: 'sorgo', ano2: undefined, ano3: undefined })
    expect(yearFlow(params, 2, 'milheto', 'milheto')).toMatchObject({ escolha: 'sorgo', ano2: 'pousio', ano3: undefined })
    expect(yearFlow(params, 1, 'crotalaria', 'milheto')).toMatchObject({ ano2: 'crotalaria', ano3: undefined })
    // No 1º ano, escolher a sugestão é escolher a cultura (muda a escolha, como na aba 1).
    expect(yearFlow(params, 0, 'milho_braquiaria', 'milho_braquiaria')).toMatchObject({ escolha: 'milho_braquiaria', ano2: undefined })
  })
})

describe('planService: "Como é hoje" nas notas do plano (as 3 últimas safras)', () => {
  it('com as 3 culturas respondidas, vale o plano delas (o pousio vale)', () => {
    expect(todayState({ 2024: 'milho_braquiaria', 2025: 'pousio', 2026: 'sorgo' })).toEqual({
      kind: 'crops',
      crops: ['milho_braquiaria', 'pousio', 'sorgo'],
    })
  })

  it('faltou resposta (ou só "Plantei" sem dizer o quê): "não preenchido", com o aviso', () => {
    expect(todayState({})).toEqual({ kind: 'missing' })
    expect(todayState({ 2024: 'sorgo', 2025: 'soja', 2026: 'sorgo' })).toEqual({ kind: 'missing' })
  })

  it('"Não plantei" (sem soja) em alguma safra: preencheu, mas não dá para comparar; diz quais safras', () => {
    expect(todayState({ 2024: 'sem_soja', 2025: 'sorgo', 2026: 'sem_soja' })).toEqual({ kind: 'noSoy', seasons: [2024, 2026] })
    // Sem soja vale mais que a resposta que faltou: o aviso de "não preencheu" estaria errado para essa safra.
    expect(todayState({ 2024: 'sem_soja' })).toEqual({ kind: 'noSoy', seasons: [2024] })
  })
})

describe('planService: "E se o ano vier seco?"', () => {
  it('o sinal em duas frases: a previsão e como a cultura se saiu nos anos daquela fase', () => {
    expect(
      signalParts(
        'Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA). Nos 7 anos de El Niño desde 2005, sorgo deu certo em 3 e milheto em 7.',
      ),
    ).toEqual({
      forecast: 'Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA).',
      history: 'Nos 7 anos de El Niño desde 2005, sorgo deu certo em 3 e milheto em 7.',
    })
    expect(signalParts('Previsão (NOAA): nenhuma fase se destaca (La Niña 30%, neutro 40%, El Niño 30%).')).toEqual({
      forecast: 'Previsão (NOAA): nenhuma fase se destaca (La Niña 30%, neutro 40%, El Niño 30%).',
      history: null,
    })
  })

  const ab = (extra: Partial<PlanoAB>): PlanoAB => ({
    cultura_a: 'sorgo',
    nome_a: 'Sorgo',
    falhas_a: 9,
    total: 20,
    cultura_b: 'milheto',
    nome_b: 'Milheto',
    b_bons_nas_falhas: 9,
    limite: null,
    motivo: null,
    ...extra,
  })

  it('Plano B: a cultura que mais deu certo quando a do Plano A falhou (do motor, não fixa)', () => {
    expect(planBState(ab({}))).toEqual({ kind: 'b', crop: 'milheto', name: 'Milheto', good: 9, fails: 9 })
    expect(planBState(ab({ cultura_b: 'crotalaria', nome_b: 'Crotalária', b_bons_nas_falhas: 4 }))).toMatchObject({ crop: 'crotalaria' })
  })

  it('"Não precisa" com a terra parada ou quando o 1º ano nunca falhou; sem outra melhor, "nenhuma"', () => {
    expect(planBState(ab({ cultura_b: null, nome_b: null, b_bons_nas_falhas: null, motivo: 'nunca_falhou' }))).toEqual({
      kind: 'notNeeded',
      reason: 'nunca_falhou',
    })
    expect(planBState(ab({ cultura_a: 'pousio', cultura_b: null, nome_b: null, motivo: 'pousio' }))).toEqual({ kind: 'notNeeded', reason: 'pousio' })
    expect(planBState(ab({ cultura_b: null, nome_b: null, motivo: 'nenhuma_melhor' }))).toEqual({ kind: 'none' })
  })

  it('chuva aproveitada: a terra parada e o que a lavoura usa em cada ano (pousio = 0)', () => {
    const data = plan([year('sorgo', { usa_mm: 183 }), year('pousio', { usa_mm: null }), year('milheto', { usa_mm: 182 })])
    expect(rainRows(data, 2027)).toEqual({
      rain: 341,
      rows: [
        { season: 2027, crop: 'sorgo', mm: 183 },
        { season: 2028, crop: 'pousio', mm: 0 },
        { season: 2029, crop: 'milheto', mm: 182 },
      ],
    })
    expect(rainRows(plan([], { chuva: null }), 2027)).toBeNull()
  })
})

describe('planService: pedir o plano (GET /api/plano e /api/plano/sugestao)', () => {
  it('pede ao repository e guarda o mesmo plano em memória', async () => {
    const get = vi.fn().mockResolvedValue({ anos: [] })
    const service = createPlanService({ get, suggest: vi.fn() })
    const params = { lat: 1, lon: 2, colheita: 'meio' as const, anos: ['sorgo', 'sorgo', 'sorgo'] as const }

    await service.evaluate(params, 'pt')
    await service.evaluate({ ...params, anos: ['sorgo', 'sorgo', 'sorgo'] }, 'pt')
    await service.evaluate({ ...params, anos: ['sorgo', 'pousio', 'sorgo'] }, 'pt')

    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenLastCalledWith({ ...params, anos: ['sorgo', 'pousio', 'sorgo'] }, 'pt')
  })

  it('a sugestão em cadeia também fica em memória, separada por anos fixos e idioma', async () => {
    const suggest = vi.fn().mockResolvedValue({ anos: [] })
    const service = createPlanService({ get: vi.fn(), suggest })
    const params = { lat: 1, lon: 2, colheita: 'tarde' as const, fixos: ['sorgo'] as const }

    await service.suggest(params, 'pt')
    await service.suggest({ ...params, fixos: ['sorgo'] }, 'pt')
    await service.suggest(params, 'en')
    await service.suggest({ ...params, fixos: ['sorgo', 'pousio'] }, 'pt')

    expect(suggest).toHaveBeenCalledTimes(3)
  })

  it('não guarda a falha: o próximo pedido tenta de novo', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValue({ anos: [] })
    const service = createPlanService({ get, suggest: vi.fn() })
    const params = { lat: 1, lon: 2, colheita: 'meio' as const, anos: ['sorgo', 'sorgo', 'sorgo'] as const }

    await expect(service.evaluate(params, 'pt')).rejects.toThrow('rede')
    await expect(service.evaluate(params, 'pt')).resolves.toEqual({ anos: [] })
  })
})

describe('planService: artigos do Guia e fonte da chuva', () => {
  it('os artigos da aba existem (slugs tipados do Guia)', () => {
    expect(Object.values(PLAN_ARTICLES)).toEqual(['rotacao-de-culturas', 'conta-de-agua', 'veranico'])
  })

  it('o nome de cada fonte da série, juntos com "+"', () => {
    expect(rainSourceName('gpm_imerg')).toBe('GPM IMERG')
    expect(rainSourceName('gpm_imerg+nasa_power')).toBe('GPM IMERG + NASA POWER')
  })
})

describe('planSignal: o sinal do outono fala do Plano A da tela (tarefa 0049)', () => {
  const rec = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
  const fromPlan = { ...rec.sinal!, motivo: 'Sinal do plano editado (teste).' }

  it('com a avaliação do plano, vale o sinal dela', () => {
    expect(planSignal({ sinal: fromPlan }, rec, true)).toBe(fromPlan)
    expect(planSignal({ sinal: null }, rec, false)).toBeNull()
  })

  it('sem o campo (API antiga) ou enquanto carrega: o sinal da recomendação só no plano sugerido', () => {
    expect(planSignal({}, rec, false)).toBe(rec.sinal)
    expect(planSignal(null, rec, false)).toBe(rec.sinal)
    expect(planSignal(null, rec, true)).toBeNull()
  })
})
