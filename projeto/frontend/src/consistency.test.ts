/**
 * Regras gerais da remodelagem conferidas no front inteiro (S9, tarefa 0049 do backend): nenhum valor em reais,
 * nenhum "Ainda não conectado" visível, nenhum link para as telas que saíram e a fonte certa da chuva.
 */
import { describe, expect, it } from 'vitest'
import { en } from './i18n/messages.en'
import { pt } from './i18n/messages.pt'

/** Código de produção (sem os testes) e os artigos do Guia, lidos como texto. */
const code = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
const articles = import.meta.glob<string>('/src/content/guia/*/*.md', { query: '?raw', import: 'default', eager: true })
const production = Object.entries(code).filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.startsWith('/src/test/'))

/** Todos os textos de um dicionário; as funções são chamadas com argumentos de exemplo. */
function texts(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'function') {
    const args = Array.from({ length: value.length }, () => '1')
    try {
      const out = (value as (...a: string[]) => unknown)(...args)
      return typeof out === 'string' ? [out] : []
    } catch {
      return []
    }
  }
  if (value && typeof value === 'object') return Object.values(value).flatMap(texts)
  return []
}

const allTexts = [...texts(pt), ...texts(en)]

describe('regras gerais da remodelagem no front (tarefa 0049)', () => {
  it('nenhum valor em reais no código, nos textos nem no Guia', () => {
    const offenders = [...production, ...Object.entries(articles)].filter(([, source]) => source.includes('R$')).map(([path]) => path)

    expect(production.length).toBeGreaterThan(50)
    expect(offenders).toEqual([])
    expect(allTexts.filter((text) => text.includes('R$'))).toEqual([])
  })

  it('nenhum texto da tela diz "Ainda não conectado"', () => {
    expect(allTexts.filter((text) => /Ainda não conectado|Not connected yet/i.test(text))).toEqual([])
  })

  it('nenhum link nem botão leva às telas que saíram (relatório e safra passada solta)', () => {
    const link = /(to|href)=\{?\s*[`'"]\/(relatorio|safra-passada)\b|navigate\(\s*[`'"]\/(relatorio|safra-passada)\b|\]\(\/(relatorio|safra-passada)\b/
    const offenders = [...production, ...Object.entries(articles)].filter(([, source]) => link.test(source)).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('nenhum texto das telas que saíram continua no dicionário', () => {
    const gone = /Todas as opções|All options|Como teria sido em|Comece por um pedaço|Relatório para banco/i
    expect(allTexts.filter((text) => gone.test(text))).toEqual([])
  })

  it('a chuva da série não é atribuída ao NASA POWER quando o IMERG existe: o POWER é calor e ETo', () => {
    expect(pt.method.sources.nasa_power.what).not.toMatch(/^Chuva/)
    expect(en.method.sources.nasa_power.what).not.toMatch(/^Rain/)
  })
})
