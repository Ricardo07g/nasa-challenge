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
  const talhao = {
    ponto: { lat: -18.9543, lon: -48.1993 },
    solo: { textura: 'argiloso', cad_mm: 75, fonte: 'soilgrids' },
    historico: { anos: [], parado: 5, total: 10, fonte: 'modis' },
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

  it('sem histórico, sem mapa de solos e sem sinal na API, não inventa', () => {
    const fact = missionFacts({ ...talhao, solo: null, historico: null } as Talhao, {} as Recomendacao)

    expect(fact).toMatchObject({ soil: 'medio', historyYears: null, signal: null })
  })
})
