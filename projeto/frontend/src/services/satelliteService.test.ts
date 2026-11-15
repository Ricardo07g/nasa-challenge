import { describe, expect, it } from 'vitest'
import type { Opcao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { climateSummary, historySummary, rainSummary, soilSummary } from './satelliteService'

type Historico = NonNullable<Talhao['historico']>
type Ano = Historico['anos'][number]

const ano = (year: number, situacao: Ano['situacao']): Ano => ({
  ano: year,
  situacao,
  ndvi_max: situacao === 'sem_dado' ? null : situacao === 'plantou' ? 0.74 : situacao === 'parado' ? 0.38 : 0.52,
  n_obs: situacao === 'sem_dado' ? 1 : 12,
})

function historico(situacoes: Ano['situacao'][], extra: Partial<Historico> = {}): Historico {
  const anos = situacoes.map((situacao, index) => ano(2016 + index, situacao))
  return {
    anos,
    parado: anos.filter((a) => a.situacao === 'parado').length,
    plantou: anos.filter((a) => a.situacao === 'plantou').length,
    sem_certeza: anos.filter((a) => a.situacao === 'incerto' || a.situacao === 'sem_dado').length,
    total: anos.length,
    fonte: 'MODIS MOD13Q1 + MYD13Q1',
    janela: '04-01 a 07-31',
    ...extra,
  }
}

describe('historySummary', () => {
  it('conta os anos parados, plantados e sem certeza, e mantém a situação de cada ano', () => {
    const summary = historySummary(historico(['parado', 'plantou', 'incerto']))

    expect(summary).toEqual({
      idle: 1,
      planted: 1,
      uncertain: 1,
      noSoy: 0,
      confirmed: 0,
      known: 2,
      total: 3,
      situations: ['parado', 'plantou', 'incerto'],
      years: ['2016', '2017', '2018'],
      window: { from: 4, to: 7 },
    })
  })

  it('"sem_soja" fica à parte: não é parado, plantou nem sem certeza (tarefa 0039)', () => {
    const summary = historySummary(historico(['parado', 'sem_soja', 'sem_soja', 'incerto', 'plantou']))

    expect(summary).toMatchObject({ idle: 1, planted: 1, uncertain: 1, noSoy: 2, known: 2, total: 5 })
    expect(summary?.situations).toEqual(['parado', 'sem_soja', 'sem_soja', 'incerto', 'plantou'])
  })

  it('conta os anos que o produtor confirmou', () => {
    const base = historico(['parado', 'plantou', 'parado'])
    const anos = base.anos.map((a, index) => (index > 0 ? { ...a, fonte_ano: 'produtor' as const } : a))

    expect(historySummary({ ...base, anos })?.confirmed).toBe(2)
  })

  it('a frase conta só os anos certos: 5 parados, 4 plantados e 1 incerto = 5 de 9 (1 sem certeza)', () => {
    const summary = historySummary(
      historico(['parado', 'plantou', 'parado', 'plantou', 'parado', 'plantou', 'plantou', 'parado', 'incerto', 'parado']),
    )

    expect(summary).toMatchObject({ idle: 5, planted: 4, uncertain: 1, known: 9, total: 10 })
  })

  it('"sem_dado" (pouca imagem sem nuvem) também é ano sem certeza', () => {
    const summary = historySummary(historico(['parado', 'sem_dado', 'incerto', 'plantou']))

    expect(summary).toMatchObject({ idle: 1, planted: 1, uncertain: 2, known: 2, total: 4 })
    expect(summary?.situations).toEqual(['parado', 'sem_dado', 'incerto', 'plantou'])
  })

  it('os meses da linha da fonte saem da janela do satélite', () => {
    expect(historySummary(historico(['parado'], { janela: '05-15 a 08-31' }))?.window).toEqual({ from: 5, to: 8 })
  })

  it('sem a janela (formato antigo da API), vale a do guia: abril a julho', () => {
    const old = { ...historico(['parado']), janela: undefined } as unknown as Historico

    expect(historySummary(old)?.window).toEqual({ from: 4, to: 7 })
  })

  it('sem histórico do satélite, o cartão some (ADR 0002)', () => {
    expect(historySummary(null)).toBeNull()
  })

  it('sem nenhum ano certo, o cartão também some (não dá para dizer "parada em 0 de 0 anos")', () => {
    expect(historySummary(historico(['sem_dado', 'incerto']))).toBeNull()
  })
})

describe('rainSummary', () => {
  const power = { fonte: 'nasa_power', periodo: '2005-2024' }
  const opcoes = (...anos: number[]) => anos.map((n) => ({ chuva: { anos: n } }) as Opcao)

  it('20 anos: o número vem da recomendação (anos usados de fato) e o período do NASA POWER', () => {
    expect(rainSummary([power], opcoes(20, 20))).toEqual({
      years: 20,
      period: { start: '2005', end: '2024' },
      skipped: 0,
    })
  })

  it('17 anos: o backend descartou 3 anos com dia faltando, e a tela diz quantos ficaram de fora', () => {
    expect(rainSummary([power], opcoes(17, 17))).toEqual({
      years: 17,
      period: { start: '2005', end: '2024' },
      skipped: 3,
    })
  })

  it('vale o maior número entre as opções (a série de chuva é a mesma para todas)', () => {
    expect(rainSummary([power], opcoes(17, 16))?.years).toBe(17)
  })

  it('sem a recomendação à mão, conta os anos pelo período do NASA POWER', () => {
    expect(rainSummary([power], null)).toEqual({ years: 20, period: { start: '2005', end: '2024' }, skipped: 0 })
    expect(rainSummary([power], [])).toMatchObject({ years: 20 })
  })

  it('lê o período da chuva do IMERG quando ele vem', () => {
    expect(rainSummary([{ fonte: 'gpm_imerg', periodo: '2006-2025' }, power], null)).toMatchObject({
      years: 20,
      period: { start: '2006', end: '2025' },
    })
  })

  it('com o número da recomendação mas sem a fonte em dados[], mostra o número sem inventar período', () => {
    expect(rainSummary([], opcoes(17))).toEqual({ years: 17, period: null, skipped: 0 })
  })

  it('sem nenhuma das duas, não inventa os 20 anos do PRD: não há resumo da chuva', () => {
    expect(rainSummary([], null)).toBeNull()
  })
})

describe('climateSummary', () => {
  it('pronto só quando o talhão traz o NEX-GDDP-CMIP6 em dados[], com o período dele', () => {
    expect(
      climateSummary([{ fonte: 'nasa_power', periodo: '2005-2024' }, { fonte: 'nex_gddp_cmip6', periodo: '2041-2060' }]),
    ).toEqual({ period: { start: '2041', end: '2060' } })
  })

  it('com o CMIP6 mas sem um período que dê para ler, não inventa as datas', () => {
    expect(climateSummary([{ fonte: 'nex_gddp_cmip6', periodo: '' }])).toEqual({ period: null })
  })

  it('sem o CMIP6, o clima dos próximos anos não está conectado', () => {
    expect(climateSummary([{ fonte: 'nasa_power', periodo: '2005-2024' }])).toBeNull()
    expect(climateSummary([])).toBeNull()
  })
})

describe('soilSummary', () => {
  const solo = (fonte: 'soilgrids' | 'padrao' | 'usuario', textura: 'arenoso' | 'medio' | 'argiloso' = 'argiloso') =>
    ({ textura, cad_mm: 75, fonte }) as Talhao['solo']

  it('a terra do mapa de solos (SoilGrids)', () => {
    expect(soilSummary(solo('soilgrids'), undefined)).toEqual({ textura: 'argiloso', source: 'map' })
  })

  it('a escolha da pessoa (na URL) vale mais que o mapa', () => {
    expect(soilSummary(solo('soilgrids'), 'arenoso')).toEqual({ textura: 'arenoso', source: 'user' })
  })

  it('sem o mapa de solos, terra média', () => {
    expect(soilSummary(null, undefined)).toEqual({ textura: 'medio', source: 'default' })
    expect(soilSummary(solo('padrao', 'medio'), undefined)).toEqual({ textura: 'medio', source: 'default' })
  })
})
