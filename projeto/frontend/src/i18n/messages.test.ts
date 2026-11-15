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

describe('lavoura de demonstração (tarefa 0053)', () => {
  const texts = (obj: unknown): string[] =>
    typeof obj === 'string'
      ? [obj]
      : typeof obj === 'function'
        ? [String((obj as (...args: string[]) => unknown)('x', 'x'))]
        : obj && typeof obj === 'object'
          ? Object.values(obj).flatMap(texts)
          : []

  it('o ponto de exemplo não é chamado de fazenda da UFU nem de fazenda de exemplo, em pt e en', () => {
    const wrong = /UFU|Gl[oó]ria|fazenda de exemplo|example farm/i
    expect(texts(pt).filter((text) => wrong.test(text))).toEqual([])
    expect(texts(en).filter((text) => wrong.test(text))).toEqual([])
  })
})
