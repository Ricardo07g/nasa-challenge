import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { articleSummary, guideService, searchGuides, type GuideService } from '../services/guideService'
import { speechService, type SpeechService } from '../services/speechService'
import { useListenSummary } from './useListenSummary'

type Deps = { guide: GuideService; speech?: SpeechService }
const defaultDeps: Deps = { guide: guideService }

/** Página inicial do Guia: artigos do idioma atual, agrupados nos 5 temas, com busca por título. */
export function useGuideController(deps: Deps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const [query, setQuery] = useState('')
  const all = useMemo(() => deps.guide.list(lang), [deps.guide, lang])
  const found = useMemo(() => searchGuides(all, query), [all, query])
  const groups = useMemo(() => deps.guide.groups(found), [deps.guide, found])
  // "Ouvir resumo" (regra geral 9 do pacote 2): conta todos os artigos, para a busca não trocar a fala.
  const listen = useListenSummary(t.guide.summary(all.length), lang, deps.speech ?? speechService)
  return { query, setQuery, groups, count: found.length, listen }
}

/** Um artigo do Guia pelo slug da URL (null se não existir no idioma atual). */
export function useGuideArticleController(slug: string, deps: Deps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const article = useMemo(() => deps.guide.get(lang, slug), [deps.guide, lang, slug])
  // "Ouvir resumo" do artigo: o título e a frase do "Em uma frase".
  const listen = useListenSummary(article ? articleSummary(article) : t.guide.notFound, lang, deps.speech ?? speechService)
  return { article, listen }
}
