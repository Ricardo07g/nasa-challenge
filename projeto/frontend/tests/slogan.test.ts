// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Slogan em inglês (15/11/2026): "Eyes on the sky, roots in the ground." no lugar do antigo, e a linha discreta
 * que explica o nome só na Início em inglês. A busca no repositório inteiro (docs, README) é feita com grep no PR;
 * aqui, o pacote do front, que é o que roda também no container.
 */
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (file: string) => readFileSync(resolve(root, file), 'utf-8')

/** O slogan antigo, montado por partes para este arquivo não virar ocorrência (com ou sem ponto, "root" ou "roots"). */
const oldSlogan = new RegExp(['from', 'space', 'to', 'the', 'roots?'].join('\\s+'), 'i')

const skipDirs = new Set(['node_modules', 'dist', '.vite', 'coverage'])
const binary = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.pdf'])

function textFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) return skipDirs.has(entry.name) ? [] : textFiles(path)
    return binary.has(extname(entry.name).toLowerCase()) ? [] : [path]
  })
}

/** Corpo da regra `.classe { ... }` de um trecho de CSS. */
function rule(css: string, selector: string): string {
  const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : ''
}

describe('slogan em inglês (15/11/2026)', () => {
  it('nenhum arquivo do front tem mais o slogan antigo', () => {
    const files = textFiles(root)
    const offenders = files.filter((file) => oldSlogan.test(readFileSync(file, 'utf-8'))).map((file) => relative(root, file))

    expect(files.length).toBeGreaterThan(100)
    expect(offenders).toEqual([])
  })

  it('a linha "Portuguese for “Orbital Root”" é discreta: 14 px no computador, 13 px no celular, cor #5d6461, peso normal', () => {
    const css = read('src/design-system/components/Header.module.css')
    const [desktop] = css.split('@media')
    const mobile = css.slice(css.indexOf('@media (max-width: 900px)'))
    const tokens = read('src/design-system/tokens.css')

    const base = rule(desktop, '.nameMeaning')
    expect(base).toMatch(/font-size:\s*14px;/)
    expect(base).toMatch(/color:\s*var\(--color-text-soft\);/)
    expect(base).toMatch(/font-weight:\s*var\(--font-weight-regular\);/)
    expect(tokens).toMatch(/--color-text-soft:\s*#5d6461;/)
    expect(tokens).toMatch(/--font-weight-regular:\s*400;/)
    expect(rule(mobile, '.nameMeaning')).toMatch(/font-size:\s*13px;/)
  })
})
