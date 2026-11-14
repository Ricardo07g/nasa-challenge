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
    historico: historico(['parado', 'plantou', 'parado', 'plantou', 'parado', 'plantou', 'parado', 'plantou', 'parado', 'plantou']),
  } as unknown as Talhao

  it('o que cada fase mostra: ponto, terra, anos de histórico e o sinal do outono', () => {
    const rec = { sinal: { nivel: 'seco' } } as Recomendacao

    expect(missionFacts(talhao, rec)).toEqual({
      point: { lat: -18.9543, lon: -48.1993 },
      soil: 'argiloso',
      historyYears: 10,
      signal: 'seco',
    })
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
})
