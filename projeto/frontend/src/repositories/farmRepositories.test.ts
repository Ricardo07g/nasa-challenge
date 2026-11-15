import { describe, expect, it, vi } from 'vitest'
import { createHttpExemploRepository } from './exemploRepository'
import {
  createMockExemploRepository,
  createMockRecomendacaoRepository,
  createMockTalhaoRepository,
} from './mocks/mockRepositories'
import { createHttpRecomendacaoRepository } from './recomendacaoRepository'
import { createHttpTalhaoRepository } from './talhaoRepository'

const UBERLANDIA = { lat: -18.92, lon: -48.28 }

describe('repositories http', () => {
  it('talhao chama /api/talhao com lat e lon', async () => {
    const getJson = vi.fn().mockResolvedValue({ dentro_da_area: true })
    const repository = createHttpTalhaoRepository(getJson)

    await repository.get(UBERLANDIA, 'pt')

    expect(getJson).toHaveBeenCalledWith('/api/talhao?lat=-18.92&lon=-48.28', { lang: 'pt' })
  })

  it('recomendacao chama /api/recomendacao com colheita e solo opcional', async () => {
    const getJson = vi.fn().mockResolvedValue({})
    const repository = createHttpRecomendacaoRepository(getJson)

    await repository.get({ ...UBERLANDIA, colheita: 'meio' }, 'en')
    await repository.get({ ...UBERLANDIA, colheita: 'cedo', solo: 'argiloso' }, 'pt')

    expect(getJson).toHaveBeenNthCalledWith(1, '/api/recomendacao?lat=-18.92&lon=-48.28&colheita=meio', {
      lang: 'en',
    })
    expect(getJson).toHaveBeenNthCalledWith(
      2,
      '/api/recomendacao?lat=-18.92&lon=-48.28&colheita=cedo&solo=argiloso',
      { lang: 'pt' },
    )
  })

  it('recomendacao leva as safras confirmadas pelo produtor (tarefa 0039)', async () => {
    const getJson = vi.fn().mockResolvedValue({})
    const repository = createHttpRecomendacaoRepository(getJson)

    await repository.get({ ...UBERLANDIA, colheita: 'meio', confirmadas: '2024:plantou,2026:parado' }, 'pt')

    expect(getJson).toHaveBeenCalledWith(
      '/api/recomendacao?lat=-18.92&lon=-48.28&colheita=meio&confirmadas=2024:plantou,2026:parado',
      { lang: 'pt' },
    )
  })

  it('exemplo chama /api/exemplo', async () => {
    const getJson = vi.fn().mockResolvedValue({})
    const repository = createHttpExemploRepository(getJson)

    await repository.get('pt')

    expect(getJson).toHaveBeenCalledWith('/api/exemplo', { lang: 'pt' })
  })
})

describe('repositories mock (dados de exemplo no formato do contrato)', () => {
  it('talhão dentro da área preparada vem completo', async () => {
    const talhao = await createMockTalhaoRepository(0).get(UBERLANDIA, 'pt')

    expect(talhao.dentro_da_area).toBe(true)
    expect(talhao.ponto).toEqual(UBERLANDIA)
    expect(talhao.celula_id).toBe('-190_-483')
    expect(talhao.colheita_sugerida?.faixa).toBe('meio')
    expect(talhao.historico?.anos).toHaveLength(10)
    expect(talhao.historico?.parado).toBe(talhao.historico?.anos.filter((a) => a.situacao === 'parado').length)
  })

  it('histórico do talhão no formato completo do guia do NDVI: 5 parados, 4 plantados e 1 sem certeza', async () => {
    const { historico } = await createMockTalhaoRepository(0).get(UBERLANDIA, 'pt')

    expect(historico).toMatchObject({
      parado: 5,
      plantou: 4,
      sem_certeza: 1,
      total: 10,
      fonte: 'MODIS MOD13Q1 + MYD13Q1',
      janela: '04-01 a 07-31',
    })
    for (const ano of historico!.anos) {
      expect(['plantou', 'parado', 'incerto', 'sem_dado', 'sem_soja']).toContain(ano.situacao)
      expect(ano.n_obs).toBeGreaterThanOrEqual(0)
      expect(ano.fonte_ano).toBe('satelite')
    }
    const uncertain = historico!.anos.filter((a) => a.situacao === 'incerto' || a.situacao === 'sem_dado')
    expect(uncertain).toHaveLength(historico!.sem_certeza)
    expect(historico!.sem_soja).toBe(0)
  })

  it('histórico de 2017 a 2026 e as 3 últimas safras para o produtor confirmar (tarefa 0039)', async () => {
    const talhao = await createMockTalhaoRepository(0).get(UBERLANDIA, 'pt')

    expect(talhao.historico?.anos.map((a) => a.ano)).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
    expect(talhao.anos_confirmaveis).toEqual([2024, 2025, 2026])
  })

  it('talhão traz a chuva de cada mês, de janeiro a junho, no formato do contrato', async () => {
    const { chuva_mensal } = await createMockTalhaoRepository(0).get(UBERLANDIA, 'pt')

    expect(chuva_mensal?.meses.map((mes) => mes.mes)).toEqual([1, 2, 3, 4, 5, 6])
    expect(chuva_mensal?.anos).toHaveLength(20)
    expect(chuva_mensal?.fonte).toBe('nasa_power')
  })

  it('talhão traz a soja da última safra como vista: no modo de demonstração, nenhum aviso (RF-24)', async () => {
    const { soja_recente } = await createMockTalhaoRepository(0).get(UBERLANDIA, 'pt')

    expect(soja_recente).toEqual({ safra: '2025/26', vista: true, ndvi_pico: 0.86, fonte: 'MODIS MOD13Q1 + MYD13Q1' })
  })

  it('talhão fora da área preparada vem sem dados (HTTP 200, não é erro)', async () => {
    const talhao = await createMockTalhaoRepository(0).get({ lat: -15.8, lon: -47.9 }, 'pt')

    expect(talhao.dentro_da_area).toBe(false)
    expect(talhao.solo).toBeNull()
    expect(talhao.historico).toBeNull()
    expect(talhao.chuva_mensal).toBeNull()
    expect(talhao.soja_recente).toBeNull()
  })

  it('recomendação traz 5 opções, a melhor e as alternativas, coerentes entre si', async () => {
    const rec = await createMockRecomendacaoRepository(0).get({ ...UBERLANDIA, colheita: 'meio' }, 'pt')

    expect(rec.opcoes).toHaveLength(5)
    expect(rec.melhor).toBe('milho_braquiaria')
    expect(rec.entrada.colheita).toBe('meio')
    expect(rec.entrada.solo).toBe('medio')
    const ids = rec.opcoes.map((opcao) => opcao.id)
    for (const alternativa of rec.alternativas) {
      expect(ids).toContain(alternativa.opcao)
      expect(alternativa.opcao).not.toBe(rec.melhor)
    }
    for (const opcao of rec.opcoes) {
      expect(opcao.chuva.faixa).toHaveLength(20)
      expect(opcao.chuva.faixa.filter(Boolean)).toHaveLength(opcao.chuva.anos_bons)
    }
  })

  it('renda só com fatos, no formato da API (tarefa 0040): nenhum valor em reais', async () => {
    for (const lang of ['pt', 'en'] as const) {
      const rec = await createMockRecomendacaoRepository(0).get({ ...UBERLANDIA, colheita: 'meio' }, lang)

      expect(JSON.stringify(rec)).not.toContain('R$')
      for (const opcao of rec.opcoes) {
        expect(opcao).not.toHaveProperty('dinheiro')
        expect(opcao).not.toHaveProperty('custo_semente_ha')
        expect(opcao.renda.anos_aperto).toBe(opcao.chuva.anos - opcao.chuva.anos_bons)
      }
    }
    const rec = await createMockRecomendacaoRepository(0).get({ ...UBERLANDIA, colheita: 'meio' }, 'pt')
    const sorgo = rec.opcoes.find((opcao) => opcao.id === 'sorgo')!
    const crotalaria = rec.opcoes.find((opcao) => opcao.id === 'crotalaria')!
    expect(sorgo.renda).toEqual({
      da_grao: true,
      anos_aperto: 3,
      rotulo: 'bom',
      texto: 'Dá grão para vender',
      risco: 'Risco de perder a lavoura: faltou água ou fez calor em 3 de 20 anos.',
    })
    expect(crotalaria.renda.texto).toBe('Não dá grão: é investimento na terra')
    expect(rec.alternativas.map((alternativa) => alternativa.motivo)).toContain('mais_renda')
  })

  it('recomendação respeita o idioma e o solo escolhido', async () => {
    const rec = await createMockRecomendacaoRepository(0).get(
      { ...UBERLANDIA, colheita: 'cedo', solo: 'argiloso' },
      'en',
    )

    expect(rec.entrada.solo).toBe('argiloso')
    expect(rec.opcoes[0].nome).toBe('Corn with brachiaria')
    expect(rec.aviso).toMatch(/agronomist/)
  })

  it('colheita tarde tira o milho sozinho da janela de plantio (tarefa 0056: vem por último, fora do prazo)', async () => {
    const rec = await createMockRecomendacaoRepository(0).get({ ...UBERLANDIA, colheita: 'tarde' }, 'pt')

    const late = rec.opcoes.filter((opcao) => opcao.fora_do_prazo)
    expect(late.map((opcao) => opcao.id)).toEqual(['milho_safrinha'])
    expect(rec.opcoes.at(-1)).toMatchObject({ id: 'milho_safrinha', na_janela: false, data_limite: '2027-02-28' })
    expect(rec.objetivos?.equilibrio?.ordem.at(-1)).toBe('milho_safrinha')
    expect(rec.fora_da_janela.map((opcao) => opcao.id)).toEqual(['milho_safrinha'])
    expect(rec.alternativas.map((alternativa) => alternativa.opcao)).not.toContain('milho_safrinha')
  })

  it('exemplo é a fazenda de Uberlândia, colheita no meio de fevereiro', async () => {
    const exemplo = await createMockExemploRepository(0).get('pt')

    expect(exemplo.talhao.ponto).toEqual({ lat: -18.9543, lon: -48.1993 })
    expect(exemplo.recomendacao.entrada.colheita).toBe('meio')
  })
})
