import { describe, expect, it } from 'vitest'
import { guideRepository } from '../../repositories/guideRepository'
import { createGuideService } from '../../services/guideService'
import { parseFrontMatter } from '../../services/guideService'
import { parseMarkdown, plainText, type Block, type Inline } from '../../services/markdownService'
import { VERIFIED_SOURCES } from './verifiedSources'

/** Os artigos que precisam existir (os prioritários da seção 8 do pedido). */
const PRIORITY = [
  'milho-safrinha',
  'milho-braquiaria',
  'sorgo',
  'milheto',
  'crotalaria',
  'terra-parada',
  'deu-certo',
  'conta-de-agua',
  'rotacao-de-culturas',
  'prazo-de-plantio-zarc',
  'veranico',
  'alertas-defesa-civil',
]
const CULTURES = PRIORITY.slice(0, 6)
const APP_ROUTES = ['/', '/onde', '/quando', '/satelite', '/resposta', '/opcoes', '/plano', '/comunidade', '/avisos', '/como-funciona']

const SECTIONS = {
  pt: ['Em uma frase', 'Por que importa', 'Na sua lavoura', 'Fontes'],
  en: ['In one sentence', 'Why it matters', 'In your field', 'Sources'],
}
const CULTURE_SECTIONS = { pt: ['Conheça', 'Passo a passo'], en: ['Get to know it', 'Step by step'] }

const files = guideRepository.files()
const bySlug = (lang: 'pt' | 'en') => new Map(files.filter((f) => f.lang === lang).map((f) => [f.slug, f.raw]))
const slugs = [...bySlug('pt').keys()]

function links(blocks: Block[]): Extract<Inline, { type: 'link' }>[] {
  const inlines = blocks.flatMap((b) => (b.type === 'list' ? b.items.flat() : b.children))
  return inlines.filter((i) => i.type === 'link')
}
const words = (raw: string) => plainText(parseMarkdown(parseFrontMatter(raw)!.body)).split(/\s+/).filter(Boolean).length

describe('conteúdo do Guia', () => {
  it('os artigos prioritários existem em pt e en', () => {
    for (const slug of PRIORITY) {
      expect(bySlug('pt').has(slug), `pt/${slug}`).toBe(true)
      expect(bySlug('en').has(slug), `en/${slug}`).toBe(true)
    }
  })

  it('todo artigo pt tem o par en, e vice-versa', () => {
    expect([...bySlug('en').keys()].sort()).toEqual([...slugs].sort())
  })

  it.each(['pt', 'en'] as const)('(%s) cabeçalho completo, slug igual ao do arquivo e tema válido', (lang) => {
    const service = createGuideService(guideRepository)
    expect(service.list(lang)).toHaveLength(bySlug(lang).size)
    for (const [slug, raw] of bySlug(lang)) {
      expect(parseFrontMatter(raw)?.meta.slug, `${lang}/${slug}`).toBe(slug)
    }
  })

  it.each(['pt', 'en'] as const)('(%s) de 100 a 300 palavras e a estrutura fixa', (lang) => {
    for (const [slug, raw] of bySlug(lang)) {
      const n = words(raw)
      expect(n, `${lang}/${slug} tem ${n} palavras`).toBeGreaterThanOrEqual(100)
      expect(n, `${lang}/${slug} tem ${n} palavras`).toBeLessThanOrEqual(300)
      const headings = parseMarkdown(parseFrontMatter(raw)!.body)
        .filter((b) => b.type === 'heading')
        .map((b) => plainText([b]))
      const expected = [...SECTIONS[lang], ...(CULTURES.includes(slug) ? CULTURE_SECTIONS[lang] : [])]
      for (const h of expected) expect(headings, `${lang}/${slug}`).toContain(h)
    }
  })

  it('nenhum artigo é rascunho e todo artigo de cultura tem a planta', () => {
    const service = createGuideService(guideRepository)
    for (const lang of ['pt', 'en'] as const) {
      for (const a of service.list(lang)) {
        expect(a.draft, `${lang}/${a.slug}`).toBe(false)
        if (CULTURES.includes(a.slug)) expect(a.plant, `${lang}/${a.slug}`).not.toBeNull()
      }
    }
  })

  it('nenhum texto diz que falta a revisão da agrônoma', () => {
    const pending = /agr[oô]nom[ao][^.\n]*(revis|review)|(revis|review)[^.\n]*agr[oô]nom|to be reviewed by the agronomist/i
    for (const [slug, raw] of [...bySlug('pt'), ...bySlug('en')]) {
      expect(raw.match(pending)?.[0] ?? null, slug).toBeNull()
    }
  })

  it('todo link interno aponta para uma tela ou artigo que existe, e o artigo volta a uma tela', () => {
    for (const [lang, map] of [['pt', bySlug('pt')], ['en', bySlug('en')]] as const) {
      for (const [slug, raw] of map) {
        const found = links(parseMarkdown(parseFrontMatter(raw)!.body))
        const internal = found.filter((l) => !l.external)
        for (const l of internal) {
          const ok = l.href.startsWith('/guia/') ? slugs.includes(l.href.slice(6)) : APP_ROUTES.includes(l.href)
          expect(ok, `${lang}/${slug}: ${l.href}`).toBe(true)
        }
        expect(
          internal.some((l) => !l.href.startsWith('/guia/')),
          `${lang}/${slug} sem link de volta para uma tela`,
        ).toBe(true)
      }
    }
  })

  it('os links para a tela 5 levam às abas de hoje ("Escolher" e "Plano de 3 anos"), com o nome delas', () => {
    // Desde o pacote 2, a tela 5 tem 2 abas: `/resposta` abre "Escolher" e `/plano`, "Plano de 3 anos".
    // As antigas "Sugestão" e "Comparar" (`/opcoes`) viraram a aba "Escolher".
    const tabs: Record<'pt' | 'en', Record<string, string>> = {
      pt: { '/resposta': 'Escolher', '/plano': 'Plano de 3 anos' },
      en: { '/resposta': 'Choose', '/plano': '3-year plan' },
    }
    for (const lang of ['pt', 'en'] as const) {
      for (const [slug, raw] of bySlug(lang)) {
        for (const l of links(parseMarkdown(parseFrontMatter(raw)!.body)).filter((x) => !x.external)) {
          expect(l.href, `${lang}/${slug}: link para a tela antiga ${l.href}`).not.toBe('/opcoes')
          if (l.href in tabs[lang]) expect(l.text, `${lang}/${slug}: ${l.href}`).toBe(tabs[lang][l.href])
        }
        expect(raw.match(/\[(Sugestão|Comparar|Suggestion|Compare)\]/)?.[0] ?? null, `${lang}/${slug}`).toBeNull()
      }
    }
  })

  it('todo link externo é https e está na lista de fontes conferidas', () => {
    const allowed = new Set(VERIFIED_SOURCES.map((s) => s.url))
    for (const [slug, raw] of [...bySlug('pt'), ...bySlug('en')]) {
      for (const l of links(parseMarkdown(parseFrontMatter(raw)!.body)).filter((x) => x.external)) {
        expect(l.href.startsWith('https://'), `${slug}: ${l.href}`).toBe(true)
        expect(allowed.has(l.href), `${slug}: fonte não conferida ${l.href}`).toBe(true)
      }
    }
  })

  it('toda fonte é artigo científico, livro técnico ou fonte oficial, nunca notícia', () => {
    for (const s of VERIFIED_SOURCES) {
      expect(['article', 'book', 'official'], s.url).toContain(s.kind)
      expect(s.citation.length, s.url).toBeGreaterThan(10)
      expect(s.url, s.url).not.toMatch(/busca-de-noticias/)
      if (s.kind === 'official') expect(s.url, s.url).toMatch(/\.gov(\.br)?\//)
      else expect(s.url, s.url).not.toMatch(/noticia/)
    }
  })

  it('a lista de fontes conferidas diz o que cada página confirma', () => {
    for (const s of VERIFIED_SOURCES) {
      expect(s.confirms.length, s.url).toBeGreaterThan(10)
      expect(s.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
