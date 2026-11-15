import { describe, expect, it } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { MISSION_PHASES, PHASE_MIN_MS, missionFacts, phaseWait } from './missionService'

describe('tempos da missão (RF-19)', () => {
  it('são 6 fases, cada uma com no mínimo 1,2 s', () => {
    expect(MISSION_PHASES).toBe(6)
    expect(PHASE_MIN_MS).toBe(1200)
  })

  it('a fase só termina depois do mínimo, contando o tempo que já passou', () => {
    expect(phaseWait(0)).toBe(1200)
    expect(phaseWait(500)).toBe(700)
    expect(phaseWait(3000)).toBe(0)
  })
})

describe('missionFacts', () => {
  type Situacao = NonNullable<Talhao['historico']>['anos'][number]['situacao']
  const historico = (situacoes: Situacao[]) => ({
    anos: situacoes.map((situacao, index) => ({ ano: 2016 + index, situacao, ndvi_max: null, n_obs: 12 })),
    parado: situacoes.filter((s) => s === 'parado').length,
    plantou: situacoes.filter((s) => s === 'plantou').length,
    sem_certeza: situacoes.filter((s) => s === 'incerto' || s === 'sem_dado').length,
    total: situacoes.length,
    fonte: 'MODIS MOD13Q1 + MYD13Q1',
    janela: '04-01 a 07-31',
  })
  const talhao = {
    ponto: { lat: -18.9543, lon: -48.1993 },
    solo: { textura: 'argiloso', cad_mm: 75, fonte: 'soilgrids' },
    dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
    historico: historico(['parado', 'plantou', 'parado', 'plantou', 'parado', 'plantou', 'parado', 'plantou', 'parado', 'plantou']),
  } as unknown as Talhao

  it('o que cada fase mostra: ponto, terra, anos de histórico e o sinal do outono', () => {
    const rec = { sinal: { nivel: 'seco', fonte: ['NOAA', 'NASA POWER'] } } as Recomendacao

    expect(missionFacts(talhao, rec)).toEqual({
      point: { lat: -18.9543, lon: -48.1993 },
      soil: 'argiloso',
      soilSource: 'SoilGrids',
      smap: null,
      rainYears: 20,
      rainSource: 'NASA POWER',
      historyYears: 10,
      future: null,
      signal: 'seco',
      signalSource: 'NOAA',
      options: null,
      burned: null,
    })
  })

  it('o clima que vem lê o período do NEX-GDDP-CMIP6 do talhão, separado do sinal do outono', () => {
    const comFuturo = {
      ...talhao,
      dados: [
        { fonte: 'nasa_power', periodo: '2005-2024' },
        { fonte: 'nex_gddp_cmip6', periodo: '2041-2060', cenario: 'ssp245', modelos: 3 },
      ],
    } as unknown as Talhao

    const fact = missionFacts(comFuturo, {} as Recomendacao)

    expect(fact.future).toEqual({ period: { start: '2041', end: '2060' } })
    expect(fact.signal).toBeNull()
  })

  it('sem o CMIP6 no talhão, a fase não inventa o clima do futuro', () => {
    expect(missionFacts(talhao, {} as Recomendacao).future).toBeNull()
  })

  it('os anos de histórico contam só os anos em que o satélite teve certeza', () => {
    const uncertain = historico(['parado', 'plantou', 'incerto', 'sem_dado', 'parado'])

    expect(missionFacts({ ...talhao, historico: uncertain }, {} as Recomendacao).historyYears).toBe(3)
  })

  it('sem nenhum ano certo, a fase diz que não há histórico', () => {
    const none = historico(['incerto', 'sem_dado'])

    expect(missionFacts({ ...talhao, historico: none }, {} as Recomendacao).historyYears).toBeNull()
  })

  it('sem histórico, sem mapa de solos e sem sinal na API, não inventa', () => {
    const fact = missionFacts({ ...talhao, solo: null, historico: null } as Talhao, {} as Recomendacao)

    expect(fact).toMatchObject({ soil: 'medio', historyYears: null, signal: null })
  })

  it('os anos de chuva lidos vêm da conta (anos usados das opções), não de um 20 fixo', () => {
    const rec = { opcoes: [{ chuva: { anos: 17 } }, { chuva: { anos: 17 } }] } as unknown as Recomendacao

    expect(missionFacts(talhao, rec).rainYears).toBe(17)
  })

  it('sem nenhum dado de chuva, a fase não inventa os anos', () => {
    expect(missionFacts({ ...talhao, dados: [] }, {} as Recomendacao).rainYears).toBeNull()
  })

  it('sem o mapa de solos, a terra é a que a recomendação usou', () => {
    const rec = { entrada: { solo: 'arenoso' } } as unknown as Recomendacao

    expect(missionFacts({ ...talhao, solo: null }, rec).soil).toBe('arenoso')
  })

  it('só as fontes usadas de fato: IMERG na chuva, SMAP no balde e o número certo de opções (tarefa 0049)', () => {
    const comTudo = {
      ...talhao,
      dados: [
        { fonte: 'nasa_power', periodo: '2005-2024' },
        { fonte: 'gpm_imerg', periodo: '2005-2024' },
        { fonte: 'smap', periodo: '2016-2024' },
      ],
    } as unknown as Talhao
    const rec = {
      opcoes: [
        { chuva: { anos: 20 }, na_janela: true },
        { chuva: { anos: 20 }, na_janela: true },
        { chuva: { anos: 20 }, na_janela: false },
      ],
    } as unknown as Recomendacao

    const fact = missionFacts(comTudo, rec)

    expect(fact.rainSource).toBe('GPM IMERG')
    expect(fact.smap).toEqual({ start: '2016', end: '2024' })
    expect(fact.options).toBe(3) // as 2 que cabem na janela e deixar parado
    expect(fact.burned).toBeNull() // sem o arquivo do MCD64A1, a fonte não aparece
    const comFogo = { ...comTudo, dados: [...comTudo.dados, { fonte: 'modis_mcd64a1', periodo: '2016-2025' }] } as Talhao
    expect(missionFacts(comFogo, rec).burned).toEqual({ start: '2016', end: '2025' })
    expect(missionFacts({ ...talhao, solo: { textura: 'medio', cad_mm: 50, fonte: 'padrao' } } as Talhao, rec).soilSource).toBeNull()
  })
})
