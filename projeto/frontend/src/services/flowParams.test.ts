import { describe, expect, it } from 'vitest'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from './flowParams'

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

  it('lê as safras confirmadas pelo produtor, em ordem de ano (tarefa 0039)', () => {
    const params = readFlowParams(new URLSearchParams('lat=-18&lon=-48&confirmadas=2026:parado,2024:plantou'))

    expect(params?.confirmadas).toBe('2024:plantou,2026:parado')
  })

  it('safra confirmada fora do formato fica de fora; nenhuma válida = indefinido', () => {
    expect(readFlowParams(new URLSearchParams('lat=-18&lon=-48&confirmadas=2024:talvez'))?.confirmadas).toBeUndefined()
    expect(readFlowParams(new URLSearchParams('lat=-18&lon=-48'))?.confirmadas).toBeUndefined()
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

  it('as safras confirmadas vão no fim, legíveis (dá para compartilhar o link)', () => {
    expect(buildFlowQuery({ lat: -18.92, lon: -48.28, colheita: 'meio', confirmadas: '2024:plantou,2025:parado' })).toBe(
      '?lat=-18.92&lon=-48.28&colheita=meio&confirmadas=2024:plantou,2025:parado',
    )
  })

  it('arredonda o ponto em 4 casas (cerca de 10 m)', () => {
    expect(buildFlowQuery({ lat: -18.923456789, lon: -48.2812345 })).toBe('?lat=-18.9235&lon=-48.2812')
  })
})

describe('keepFlowQuery', () => {
  it('repassa o ponto, a colheita e o exemplo da URL atual para o próximo link', () => {
    expect(keepFlowQuery('?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1&x=lixo')).toBe(
      '?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1',
    )
  })

  it('repassa as safras confirmadas para as telas seguintes', () => {
    expect(keepFlowQuery('?lat=-18.9543&lon=-48.1993&colheita=meio&confirmadas=2025:parado')).toBe(
      '?lat=-18.9543&lon=-48.1993&colheita=meio&confirmadas=2025:parado',
    )
  })

  it('sem ponto na URL, não repassa nada', () => {
    expect(keepFlowQuery('')).toBe('')
    expect(keepFlowQuery('?colheita=meio')).toBe('')
  })

  it('repassa o objetivo do produtor entre as abas (tarefa 0044)', () => {
    expect(keepFlowQuery('?lat=-18.9543&lon=-48.1993&colheita=meio&objetivo=terra&ano=2016')).toBe(
      '?lat=-18.9543&lon=-48.1993&colheita=meio&objetivo=terra',
    )
  })
})

describe('objetivo do produtor na URL (tarefa 0044)', () => {
  it('lê só os objetivos conhecidos; sem objetivo vale o equilíbrio do motor', () => {
    const read = (query: string) => readFlowParams(new URLSearchParams(query))?.objetivo
    expect(read('lat=1&lon=2&objetivo=seguranca')).toBe('seguranca')
    expect(read('lat=1&lon=2&objetivo=renda')).toBe('renda')
    expect(read('lat=1&lon=2&objetivo=dinheiro')).toBeUndefined()
    expect(read('lat=1&lon=2')).toBeUndefined()
  })

  it('o objetivo vai antes das safras confirmadas', () => {
    expect(buildFlowQuery({ lat: 1, lon: 2, colheita: 'meio', objetivo: 'renda', confirmadas: '2025:parado' })).toBe(
      '?lat=1&lon=2&colheita=meio&objetivo=renda&confirmadas=2025:parado',
    )
  })
})
