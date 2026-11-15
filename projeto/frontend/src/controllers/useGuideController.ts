import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { guideService, searchGuides, type GuideService } from '../services/guideService'

type Deps = { guide: GuideService }
const defaultDeps: Deps = { guide: guideService }

/** Página inicial do Guia: artigos do idioma atual, agrupados nos 5 temas, com busca por título. */
export function useGuideController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const [query, setQuery] = useState('')
  const all = useMemo(() => deps.guide.list(lang), [deps.guide, lang])
  const found = useMemo(() => searchGuides(all, query), [all, query])
  const groups = useMemo(() => deps.guide.groups(found), [deps.guide, found])
  return { query, setQuery, groups, count: found.length }
}

/** Um artigo do Guia pelo slug da URL (null se não existir no idioma atual). */
export function useGuideArticleController(slug: string, deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const article = useMemo(() => deps.guide.get(lang, slug), [deps.guide, lang, slug])
  return { article }
}
