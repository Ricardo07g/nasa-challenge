// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (file: string) => readFileSync(resolve(root, file), 'utf-8')

describe('ícone do navegador (identidade visual)', () => {
  it('o index.html aponta para os ícones do Raiz Orbital e a cor da marca', () => {
    const html = read('index.html')

    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    expect(html).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />')
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
    expect(html).toContain('<meta name="theme-color" content="#1F6B47" />')
  })

  it('o favicon.svg é o símbolo da marca (verde, órbita azul), não o logo do Vite', () => {
    const svg = read('public/favicon.svg')

    expect(svg).toContain('#1F6B47')
    expect(svg).toContain('#1D5FA8')
    expect(svg).not.toContain('#863bff')
  })

  it('as versões em PNG existem', () => {
    expect(existsSync(resolve(root, 'public/favicon-32.png'))).toBe(true)
    expect(existsSync(resolve(root, 'public/apple-touch-icon.png'))).toBe(true)
  })
})
