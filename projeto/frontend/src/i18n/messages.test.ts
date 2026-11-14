import { describe, expect, it } from 'vitest'
import { en } from './messages.en'
import { pt } from './messages.pt'

function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return [`${path}:string`]
  if (typeof value === 'function') return [`${path}:function`]
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .flatMap((key) => shape((value as Record<string, unknown>)[key], `${path}.${key}`))
  }
  return [`${path}:${typeof value}`]
}

describe('dicionários', () => {
  it('pt e en têm exatamente as mesmas chaves e tipos', () => {
    expect(shape(en)).toEqual(shape(pt))
  })

  it('nenhum texto está vazio', () => {
    const empty = shape(pt).filter((entry) => entry.endsWith(':string'))
    const values = (obj: unknown): string[] =>
      typeof obj === 'string'
        ? [obj]
        : obj && typeof obj === 'object'
          ? Object.values(obj).flatMap(values)
          : []
    expect(empty.length).toBeGreaterThan(0)
    expect(values(pt).filter((text) => text.trim() === '')).toEqual([])
    expect(values(en).filter((text) => text.trim() === '')).toEqual([])
  })
})
