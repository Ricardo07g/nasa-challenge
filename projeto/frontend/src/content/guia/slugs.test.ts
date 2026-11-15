import { describe, expect, it } from 'vitest'
import { guideRepository } from '../../repositories/guideRepository'
import { GUIDE_SLUGS } from './slugs'

describe('GUIDE_SLUGS (os artigos que o GuideLink aceita)', () => {
  const files = guideRepository.files()
  const of = (lang: 'pt' | 'en') => files.filter((file) => file.lang === lang).map((file) => file.slug).sort()

  it('é exatamente a lista de artigos do Guia, em pt e em en (artigo novo entra aqui junto)', () => {
    expect([...GUIDE_SLUGS].sort()).toEqual(of('pt'))
    expect([...GUIDE_SLUGS].sort()).toEqual(of('en'))
  })
})
