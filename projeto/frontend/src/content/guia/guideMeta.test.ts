/**
 * Campos novos do cabeçalho dos artigos (tela 8 do pacote 3, tarefa 0063): `resumo` (uma linha para o cartão, o
 * "Em uma frase" do próprio artigo encurtado) e `relacionados` (o "Veja também"). Ficam fora do
 * `guideContent.test.ts`, que confere o corpo dos artigos.
 */
import { describe, expect, it } from 'vitest'
import { guideRepository } from '../../repositories/guideRepository'
import { parseFrontMatter } from '../../services/guideService'

const files = guideRepository.files()
const bySlug = (lang: 'pt' | 'en') => new Map(files.filter((f) => f.lang === lang).map((f) => [f.slug, f.raw]))
const slugs = [...bySlug('pt').keys()]

describe('cabeçalho dos artigos do Guia (tela 8)', () => {
  it.each(['pt', 'en'] as const)('(%s) resumo de uma linha para o cartão', (lang) => {
    for (const [slug, raw] of bySlug(lang)) {
      const resumo = parseFrontMatter(raw)!.meta.resumo ?? ''
      expect(resumo.length, `${lang}/${slug} sem resumo`).toBeGreaterThan(10)
      expect(resumo.length, `${lang}/${slug}: resumo longo demais`).toBeLessThanOrEqual(90)
    }
  })

  it('relacionados com 1 a 3 artigos que existem, sem o próprio, iguais em pt e en', () => {
    const related = (raw: string) => (parseFrontMatter(raw)!.meta.relacionados ?? '').split(',').map((s) => s.trim())
    for (const [slug, raw] of bySlug('pt')) {
      const list = related(raw)
      expect(list.length, slug).toBeGreaterThanOrEqual(1)
      expect(list.length, slug).toBeLessThanOrEqual(3)
      for (const other of list) {
        expect(slugs, `${slug}: ${other}`).toContain(other)
        expect(other, slug).not.toBe(slug)
      }
      expect(related(bySlug('en').get(slug)!), slug).toEqual(list)
    }
  })

  it.each(['pt', 'en'] as const)('(%s) o tempo de leitura não é escrito à mão (é calculado pelo texto)', (lang) => {
    for (const [slug, raw] of bySlug(lang)) {
      expect(parseFrontMatter(raw)!.meta.min, `${lang}/${slug}`).toBeUndefined()
    }
  })
})
