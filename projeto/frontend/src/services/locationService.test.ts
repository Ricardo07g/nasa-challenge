import { describe, expect, it } from 'vitest'
import { EXAMPLE_FARM, isInsidePreparedArea, nearestPlace } from './locationService'

describe('locationService', () => {
  it('a fazenda de exemplo é o campo de soja da Fazenda Experimental do Glória (UFU), dentro da área preparada', () => {
    expect(EXAMPLE_FARM).toEqual({ lat: -18.9543, lon: -48.1993 })
    expect(isInsidePreparedArea(EXAMPLE_FARM)).toBe(true)
  })

  it('pontos fora da caixa do hackathon ficam de fora', () => {
    expect(isInsidePreparedArea({ lat: -15.8, lon: -47.9 })).toBe(false)
    expect(isInsidePreparedArea({ lat: -19.95, lon: -48.0 })).toBe(false)
    expect(isInsidePreparedArea({ lat: -19.0, lon: -49.1 })).toBe(false)
  })

  it('acha a cidade mais próxima para mostrar "Perto de …"', () => {
    expect(nearestPlace({ lat: -18.95, lon: -48.25 })).toBe('Uberlândia (MG)')
    expect(nearestPlace({ lat: -19.74, lon: -47.93 })).toBe('Uberaba (MG)')
  })
})
