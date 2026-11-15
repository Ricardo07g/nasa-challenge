import { describe, expect, it } from 'vitest'
import { areaCenter, EXAMPLE_FARM, isInsideArea, nearestPlace } from './locationService'

/** Como vem de GET /api/area-piloto. */
const AREA = { min_lat: -19.9, max_lat: -18.4, min_lon: -49.0, max_lon: -47.5 }

describe('locationService', () => {
  it('a fazenda de exemplo é o campo de soja da Fazenda Experimental do Glória (UFU), dentro da área piloto', () => {
    expect(EXAMPLE_FARM).toEqual({ lat: -18.9543, lon: -48.1993 })
    expect(isInsideArea(EXAMPLE_FARM, AREA)).toBe(true)
  })

  it('pontos fora da área piloto ficam de fora; a borda conta como dentro', () => {
    expect(isInsideArea({ lat: -15.8, lon: -47.9 }, AREA)).toBe(false)
    expect(isInsideArea({ lat: -19.95, lon: -48.0 }, AREA)).toBe(false)
    expect(isInsideArea({ lat: -19.0, lon: -49.1 }, AREA)).toBe(false)
    expect(isInsideArea({ lat: -19.9, lon: -47.5 }, AREA)).toBe(true)
  })

  it('o centro da área (preferência da busca de endereço)', () => {
    expect(areaCenter(AREA)).toEqual({ lat: -19.15, lon: -48.25 })
  })

  it('acha a cidade mais próxima para mostrar "Perto de …"', () => {
    expect(nearestPlace({ lat: -18.95, lon: -48.25 })).toBe('Uberlândia (MG)')
    expect(nearestPlace({ lat: -19.74, lon: -47.93 })).toBe('Uberaba (MG)')
  })
})
