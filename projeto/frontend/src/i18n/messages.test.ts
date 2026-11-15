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

describe('sem revisão pendente da agrônoma (15/11/2026)', () => {
  const texts = (obj: unknown): string[] =>
    typeof obj === 'string'
      ? [obj]
      : typeof obj === 'function'
        ? [String((obj as (...args: string[]) => unknown)('x', 'x', 'x', 'x', 'x', 'x'))]
        : obj && typeof obj === 'object'
          ? Object.values(obj).flatMap(texts)
          : []
  const pending =
    /agr[oô]nom[ao][^.\n]*(revis|review)|(revis|review)[^.\n]*agr[oô]nom|ajustad[oa]s com agr[oô]nom|tuned with local agronomists|rascunho|\bdraft\b/i

  it('nenhum texto da interface diz que falta a revisão da agrônoma nem fala em rascunho, em pt e en', () => {
    expect(texts(pt).filter((text) => pending.test(text))).toEqual([])
    expect(texts(en).filter((text) => pending.test(text))).toEqual([])
  })

  it('as hipóteses do time aparecem como "ainda não validadas em campo"', () => {
    expect(pt.method.rules.intro).toContain('ainda não foram validados em campo')
    expect(en.method.rules.intro).toContain('have not been validated in the field yet')
    expect(pt.method.blindRest).toContain('ainda não foram validados em campo')
    expect(en.method.blindRest).toContain('have not been validated in the field yet')
    expect(pt.choose.cell.soilText).toContain('hipótese do time, ainda não validada em campo')
    expect(en.choose.cell.soilText).toContain('team hypothesis, not yet validated in the field')
  })
})
