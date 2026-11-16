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
    // Única exceção: o significado do nome fica vazio em pt (o nome já é português), para a linha não aparecer.
    const ptWithoutNameMeaning = { ...pt, start: { ...pt.start, nameMeaning: 'x' } }
    expect(empty.length).toBeGreaterThan(0)
    expect(values(ptWithoutNameMeaning).filter((text) => text.trim() === '')).toEqual([])
    expect(values(en).filter((text) => text.trim() === '')).toEqual([])
  })
})

describe('nome e slogan (15/11/2026)', () => {
  it('o nome continua "Raiz Orbital" nos dois idiomas; o slogan em inglês é "Eyes on the sky, roots in the ground."', () => {
    expect(en.header.slogan).toBe('Eyes on the sky, roots in the ground.')
    expect(en.header.home).toBe('Raiz Orbital: Portuguese for “Orbital Root”, home page')
    expect(en.header.homeTitle).toBe('Raiz Orbital: Portuguese for “Orbital Root”')
  })

  it('o slogan em português não muda', () => {
    expect(pt.header.slogan).toBe('Do espaço até a raiz.')
    expect(pt.header.home).toBe('Raiz Orbital, página inicial')
    expect(pt.header.homeTitle).toBe('Raiz Orbital')
  })

  it('só em inglês a Início explica o nome, com aspas curvas; em português fica vazia (não aparece)', () => {
    expect(en.start.nameMeaning).toBe('Raiz Orbital is Portuguese for “Orbital Root”.')
    expect(pt.start.nameMeaning).toBe('')
    expect('nameMeaning' in en.header).toBe(false)
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

describe('só o que a fonte sustenta (tarefa 0066 do backend, revisão com fontes)', () => {
  const texts = (obj: unknown): string[] =>
    typeof obj === 'string'
      ? [obj]
      : typeof obj === 'function'
        ? [String((obj as (...args: string[]) => unknown)('x', 'x', 'x', 'x', 'x', 'x', 'x'))]
        : obj && typeof obj === 'object'
          ? Object.values(obj).flatMap(texts)
          : []
  // A crotalária reduz o nematoide antes e no começo da soja, mas a diferença some na colheita (Debiasi et al.
  // 2016): "quebra o ciclo" promete demais. A soja inoculada tira o nitrogênio do ar: o da crotalária fica na terra,
  // não é "para a soja". A sede "pouca" é consumo baixo, não tolerância à seca.
  const unsupported = /quebra[mr]? o (ciclo do )?nematoide|break[s]? the nematode|nitrog[eê]nio para a soja|nitrogen for the soybean|aguenta a seca|and handles drought|deixa pouca palha|little straw left/i

  it('nenhum texto da interface diz o que a literatura não sustenta, em pt e en', () => {
    expect(texts(pt).filter((text) => unsupported.test(text))).toEqual([])
    expect(texts(en).filter((text) => unsupported.test(text))).toEqual([])
  })

  it('a crotalária não tem prazo do ZARC: a data dela é sugestão do app', () => {
    expect(pt.choose.compare.cons.lateSuggested('x')).not.toMatch(/ZARC|seguro/)
    expect(en.choose.compare.cons.lateSuggested('x')).not.toMatch(/ZARC|insurance/)
    expect(pt.choose.cell.deadlineSuggestedLate('x', 'y')).not.toMatch(/prazo do ZARC|pelo ZARC|seguro/i)
    expect(pt.choose.cell.deadlineSuggestedLate('x', 'y')).toContain('Não há ZARC')
    expect(en.choose.cell.deadlineSuggestedOk('x', 'y')).not.toMatch(/ZARC deadline|by ZARC|insurance/i)
    expect(pt.planning.timeline.plant.lateSuggested('x')).not.toMatch(/ZARC|seguro/)
    expect(en.planning.timeline.next.lateSuggested('x')).not.toMatch(/ZARC|insurance/)
  })
})

describe('"Como a conta é feita" sem os relatos de vizinhos (15/11/2026)', () => {
  // A comunidade está "em breve" (COMMUNITY_OPEN = false): a regra dos avisos não fala dos relatos.
  const texts = (obj: unknown): string[] =>
    typeof obj === 'string'
      ? [obj]
      : typeof obj === 'function'
        ? [String((obj as (...args: string[]) => unknown)('x', 'x', 'x', 'x', 'x', 'x', 'x'))]
        : obj && typeof obj === 'object'
          ? Object.values(obj).flatMap(texts)
          : []

  it('nenhum texto do bloco method fala de vizinhos nem de relatos, em pt e en', () => {
    expect(texts(pt.method).filter((text) => /vizinh|relato/i.test(text))).toEqual([])
    expect(texts(en.method).filter((text) => /neighbo|report/i.test(text))).toEqual([])
  })
})
