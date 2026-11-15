import { describe, expect, it } from 'vitest'
import { canConfirm, EXAMPLE_FARM, isInsideArea, nearestPlace, whereStatus } from './locationService'

/** Como vem de GET /api/area-piloto. */
const AREA = { min_lat: -19.9, max_lat: -18.4, min_lon: -49.0, max_lon: -47.5 }

describe('locationService', () => {
  it('a lavoura de demonstração (um dos pontos com histórico de NDVI) fica dentro da área piloto', () => {
    expect(EXAMPLE_FARM).toEqual({ lat: -18.9543, lon: -48.1993 })
    expect(isInsideArea(EXAMPLE_FARM, AREA)).toBe(true)
  })

  it('pontos fora da área piloto ficam de fora; a borda conta como dentro', () => {
    expect(isInsideArea({ lat: -15.8, lon: -47.9 }, AREA)).toBe(false)
    expect(isInsideArea({ lat: -19.95, lon: -48.0 }, AREA)).toBe(false)
    expect(isInsideArea({ lat: -19.0, lon: -49.1 }, AREA)).toBe(false)
    expect(isInsideArea({ lat: -19.9, lon: -47.5 }, AREA)).toBe(true)
  })

  it('acha a cidade mais próxima para mostrar "Perto de …"', () => {
    expect(nearestPlace({ lat: -18.95, lon: -48.25 })).toBe('Uberlândia (MG)')
    expect(nearestPlace({ lat: -19.74, lon: -47.93 })).toBe('Uberaba (MG)')
  })
})

describe('whereStatus: estado do cartão do local (tarefa 0053)', () => {
  it('sem ponto marcado', () => {
    expect(whereStatus(null, AREA)).toBe('empty')
    expect(whereStatus(null, null)).toBe('empty')
  })

  it('ponto dentro da área do MVP: marcado', () => {
    expect(whereStatus({ lat: -19.0, lon: -48.2 }, AREA)).toBe('marked')
  })

  it('ponto fora da área do MVP', () => {
    expect(whereStatus({ lat: -17.78, lon: -50.92 }, AREA)).toBe('outside')
  })

  it('sem a área (ainda carregando ou fora do ar): marcado, sem aviso de fora', () => {
    expect(whereStatus({ lat: -17.78, lon: -50.92 }, null)).toBe('marked')
  })
})

describe('canConfirm: quando o "Confirmar local" liga', () => {
  it('sem ponto ou fora da área: desligado', () => {
    expect(canConfirm('empty', 'ready')).toBe(false)
    expect(canConfirm('outside', 'ready')).toBe(false)
  })

  it('ponto marcado com a área pronta: ligado', () => {
    expect(canConfirm('marked', 'ready')).toBe(true)
  })

  it('enquanto a área carrega, o botão espera', () => {
    expect(canConfirm('marked', 'loading')).toBe(false)
  })

  it('se a área não carregar, deixa seguir (o backend ainda responde OUTSIDE_AREA nas telas seguintes)', () => {
    expect(canConfirm('marked', 'error')).toBe(true)
    expect(canConfirm('empty', 'error')).toBe(false)
  })
})
