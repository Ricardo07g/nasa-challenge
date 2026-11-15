import { describe, expect, it, vi } from 'vitest'
import type { GuideFile } from '../models/guide'
import { parseMarkdown } from './markdownService'
import { articleSummary, createGuideService, parseFrontMatter, searchGuides } from './guideService'

const header = (o: Record<string, string>) =>
  `---\n${Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n`

const files: GuideFile[] = [
  {
    lang: 'pt',
    slug: 'sorgo',
    raw: header({ titulo: 'Sorgo', tema: 'culturas', slug: 'sorgo', rascunho: 'sim', planta: 'sorgo' }) + '## Em uma frase\n\nTexto.',
  },
  { lang: 'pt', slug: 'veranico', raw: header({ titulo: 'Veranico', tema: 'clima', slug: 'veranico', rascunho: 'nao' }) + 'Texto.' },
  { lang: 'pt', slug: 'ouvir', raw: header({ titulo: 'Álgebra do Ônibus', tema: 'seguranca', slug: 'ouvir', rascunho: 'nao' }) + 'x' },
  { lang: 'en', slug: 'sorgo', raw: header({ titulo: 'Sorghum', tema: 'culturas', slug: 'sorgo', rascunho: 'yes' }) + 'Text.' },
]
const repo = { files: vi.fn(() => files) }

describe('parseFrontMatter', () => {
  it('separa o cabeçalho do corpo', () => {
    const { meta, body } = parseFrontMatter('---\ntitulo: A: b\ntema: clima\n---\n\nCorpo')!
    expect(meta).toEqual({ titulo: 'A: b', tema: 'clima' })
    expect(body.trim()).toBe('Corpo')
  })

  it('sem cabeçalho devolve null', () => {
    expect(parseFrontMatter('só texto')).toBeNull()
  })
})

describe('guideService', () => {
  const service = createGuideService(repo)

  it('lista os artigos do idioma, com tema, rascunho e planta', () => {
    expect(service.list('pt').map((a) => a.slug)).toEqual(['sorgo', 'veranico', 'ouvir'])
    expect(service.list('pt')[0]).toMatchObject({ theme: 'cultures', draft: true, plant: 'sorgo', title: 'Sorgo' })
    expect(service.list('en')).toHaveLength(1)
    expect(service.list('en')[0].draft).toBe(true)
  })

  it('agrupa pelos 5 temas, na ordem fixa, e some com o tema vazio', () => {
    const groups = service.groups(service.list('pt'))
    expect(groups.map((g) => g.theme)).toEqual(['cultures', 'climate', 'safety'])
  })

  it('abre um artigo com os blocos; inexistente dá null', () => {
    expect(service.get('pt', 'sorgo')?.blocks[0]).toMatchObject({ type: 'heading' })
    expect(service.get('pt', 'nao-existe')).toBeNull()
  })

  it('ignora arquivo com tema inválido ou sem cabeçalho', () => {
    const bad = createGuideService({
      files: () => [
        { lang: 'pt', slug: 'a', raw: header({ titulo: 'A', tema: 'xxx', slug: 'a', rascunho: 'nao' }) },
        { lang: 'pt', slug: 'b', raw: 'sem cabeçalho' },
      ],
    })
    expect(bad.list('pt')).toEqual([])
  })
})

describe('searchGuides', () => {
  const list = createGuideService(repo).list('pt')

  it('busca por título, sem acento e sem maiúscula', () => {
    expect(searchGuides(list, 'ONIBUS').map((a) => a.slug)).toEqual(['ouvir'])
    expect(searchGuides(list, 'vera').map((a) => a.slug)).toEqual(['veranico'])
  })

  it('busca vazia devolve tudo', () => {
    expect(searchGuides(list, '  ')).toHaveLength(3)
  })
})

describe('articleSummary ("Ouvir resumo" do artigo, pacote 2)', () => {
  const base = { slug: 'sorgo', title: 'Sorgo', theme: 'cultures' as const, draft: true, plant: null }

  it('o título e a frase do "Em uma frase" (o 1º parágrafo depois do 1º título), sem o negrito', () => {
    const blocks = parseMarkdown('## Em uma frase\n\nO **sorgo** aguenta mais a seca.\n\n## Por que importa\n\nOutro parágrafo.')
    expect(articleSummary({ ...base, blocks })).toBe('Sorgo. O sorgo aguenta mais a seca.')
  })

  it('sem parágrafo, só o título', () => {
    expect(articleSummary({ ...base, blocks: [] })).toBe('Sorgo')
  })
})
