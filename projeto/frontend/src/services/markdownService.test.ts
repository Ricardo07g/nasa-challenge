import { describe, expect, it } from 'vitest'
import { parseMarkdown, plainText } from './markdownService'

describe('parseMarkdown', () => {
  it('lê títulos de nível 2 e 3, parágrafos e listas', () => {
    const blocks = parseMarkdown('## Em uma frase\n\nUm texto.\n\n### Detalhe\n\n- um\n- dois\n\n1. primeiro\n2. segundo')
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'heading', 'list', 'list'])
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2 })
    expect(blocks[3]).toMatchObject({ type: 'list', ordered: false })
    expect(blocks[4]).toMatchObject({ type: 'list', ordered: true })
    expect(blocks[3].type === 'list' && blocks[3].items).toHaveLength(2)
  })

  it('junta as linhas seguidas num parágrafo só', () => {
    const [block] = parseMarkdown('linha um\nlinha dois')
    expect(plainText([block])).toBe('linha um linha dois')
  })

  it('negrito e links internos e externos', () => {
    const [block] = parseMarkdown('Veja **isto** e [o guia](/guia/veranico) e [a Embrapa](https://www.embrapa.br).')
    expect(block.type).toBe('paragraph')
    const inlines = block.type === 'paragraph' ? block.children : []
    expect(inlines).toContainEqual({ type: 'strong', text: 'isto' })
    expect(inlines).toContainEqual({ type: 'link', text: 'o guia', href: '/guia/veranico', external: false })
    expect(inlines).toContainEqual({ type: 'link', text: 'a Embrapa', href: 'https://www.embrapa.br', external: true })
  })

  it('HTML vira texto puro, nunca marcação', () => {
    const [block] = parseMarkdown('<script>alert(1)</script> e <b>x</b>')
    expect(block).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', text: '<script>alert(1)</script> e <b>x</b>' }],
    })
  })

  it('link com endereço perigoso vira só o texto', () => {
    const [block] = parseMarkdown('[clique](javascript:alert(1)) e [x](//evil.com)')
    expect(block.type === 'paragraph' && block.children.every((i) => i.type === 'text')).toBe(true)
    expect(plainText([block])).toBe('clique e x')
  })

  it('ignora linhas em branco extras', () => {
    expect(parseMarkdown('\n\n\n')).toEqual([])
  })
})
