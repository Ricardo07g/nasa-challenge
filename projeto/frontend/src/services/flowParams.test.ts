import { describe, expect, it } from 'vitest'
import { buildFlowQuery, readFlowParams } from './flowParams'

describe('readFlowParams', () => {
  it('lê ponto, colheita e solo da URL', () => {
    const params = readFlowParams(new URLSearchParams('lat=-18.92&lon=-48.28&colheita=tarde&solo=argiloso'))

    expect(params).toEqual({ lat: -18.92, lon: -48.28, colheita: 'tarde', solo: 'argiloso', exemplo: false })
  })

  it('sem colheita ou solo, deixa indefinido', () => {
    const params = readFlowParams(new URLSearchParams('lat=-18.92&lon=-48.28'))

    expect(params).toEqual({ lat: -18.92, lon: -48.28, colheita: undefined, solo: undefined, exemplo: false })
  })

  it('reconhece a fazenda de exemplo', () => {
    expect(readFlowParams(new URLSearchParams('lat=-18.92&lon=-48.28&colheita=meio&exemplo=1'))?.exemplo).toBe(true)
  })

  it('ignora valores inválidos', () => {
    expect(readFlowParams(new URLSearchParams('lat=abc&lon=-48'))).toBeNull()
    expect(readFlowParams(new URLSearchParams('lon=-48'))).toBeNull()
    expect(readFlowParams(new URLSearchParams('lat=-18&lon=-48&colheita=junho'))?.colheita).toBeUndefined()
    expect(readFlowParams(new URLSearchParams('lat=-18&lon=-48&solo=pedra'))?.solo).toBeUndefined()
  })
})

describe('buildFlowQuery', () => {
  it('monta a query na ordem lat, lon, colheita, solo, exemplo', () => {
    expect(buildFlowQuery({ lat: -18.92, lon: -48.28, colheita: 'meio', solo: 'medio', exemplo: true })).toBe(
      '?lat=-18.92&lon=-48.28&colheita=meio&solo=medio&exemplo=1',
    )
  })

  it('arredonda o ponto em 4 casas (cerca de 10 m)', () => {
    expect(buildFlowQuery({ lat: -18.923456789, lon: -48.2812345 })).toBe('?lat=-18.9235&lon=-48.2812')
  })
})
