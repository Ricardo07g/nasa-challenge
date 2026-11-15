import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { fieldFactText } from '../i18n/guideTexts'
import { useI18n } from '../i18n/useI18n'
import type { ArticleLayout, GuideArticle, GuideFilters, GuideSummary, GuideThemeFilter, HighlightPart } from '../models/guide'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { fieldPoint, guideFieldService, type GuideFieldService } from '../services/guideFieldService'
import {
  articleLayout,
  articleSummary,
  featuredArticles,
  filterByTheme,
  guideIndexUrl,
  guideService,
  highlight,
  readGuideFilters,
  relatedArticles,
  searchGuides,
  themeCounts,
  type GuideGroup,
  type GuideService,
} from '../services/guideService'
import { nearestPlace } from '../services/locationService'
import { speechService, type SpeechService } from '../services/speechService'
import { useAsync } from './useAsync'
import { useListenSummary, type ListenSummaryState } from './useListenSummary'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import { useReplaceUrl } from './useReplaceFlow'

/**
 * Há uma tela anterior do app neste histórico? O roteador do navegador guarda a posição (`idx`) em
 * `history.state`; 0 = o Guia foi a primeira tela aberta nesta aba (link direto ou nova aba).
 */
function browserCanGoBack(): boolean {
  const state = window.history.state as { idx?: number } | null
  return (state?.idx ?? 0) > 0
}

type Deps = { guide: GuideService; speech?: SpeechService; canGoBack?: () => boolean }
const defaultDeps: Deps = { guide: guideService }

/** Um cartão da busca: o artigo e os trechos do título e do resumo, com a palavra marcada. */
export type GuideResult = { article: GuideSummary; title: HighlightPart[]; summary: HighlightPart[] }

export type GuideIndexState = {
  filters: GuideFilters
  setQuery: (query: string) => void
  clearQuery: () => void
  setTheme: (theme: GuideThemeFilter) => void
  themes: { key: GuideThemeFilter; count: number }[]
  searching: boolean
  /** "Comece por aqui": só em "Todos", sem busca. */
  featured: GuideSummary[]
  groups: GuideGroup[]
  results: GuideResult[]
  /** O fluxo da URL (`?lat=…`, ou ""), que segue nos links para os artigos. */
  linkQuery: string
  /** "← Voltar": sem tela anterior no app, a Início. */
  backTo: string
  /** Com tela anterior no app, o "← Voltar" volta para ela (no lugar do `backTo`). */
  onBack: (event: { preventDefault: () => void }) => void
  listen: ListenSummaryState
}

/**
 * Início do Guia (tela 8 do pacote 3): busca, filtros por tema, "Comece por aqui" e os cartões. A busca e o tema
 * ficam no estado da tela e são copiados para a URL (`q` e `tema`) com `useReplaceUrl`: digitar ou trocar de filtro
 * não mexe na rolagem nem cria entrada no histórico. Um link novo para o Guia (navegação que não é `replace`,
 * ex.: o botão do cabeçalho) relê a URL.
 */
export function useGuideController(deps: Deps = defaultDeps): GuideIndexState {
  const { lang, messages: t } = useI18n()
  const location = useLocation()
  const navigationType = useNavigationType()
  const navigate = useNavigate()
  const replaceUrl = useReplaceUrl()
  const canGoBack = deps.canGoBack ?? browserCanGoBack
  const [filters, setFilters] = useState<GuideFilters>(() => readGuideFilters(new URLSearchParams(location.search)))
  const [seenKey, setSeenKey] = useState(location.key)
  if (seenKey !== location.key) {
    setSeenKey(location.key)
    if (navigationType !== 'REPLACE') setFilters(readGuideFilters(new URLSearchParams(location.search)))
  }

  const linkQuery = keepFlowQuery(location.search)
  const update = useCallback(
    (next: GuideFilters) => {
      setFilters(next)
      replaceUrl(guideIndexUrl(linkQuery, next))
    },
    [linkQuery, replaceUrl],
  )

  const all = useMemo(() => deps.guide.list(lang), [deps.guide, lang])
  const searching = filters.query.trim() !== ''
  const results = useMemo(
    () =>
      searching
        ? searchGuides(all, filters.query).map((article) => ({
            article,
            title: highlight(article.title, filters.query),
            summary: highlight(article.summary, filters.query),
          }))
        : [],
    [all, filters.query, searching],
  )
  const groups = useMemo(
    () => (searching ? [] : deps.guide.groups(filterByTheme(all, filters.theme))),
    [all, deps.guide, filters.theme, searching],
  )
  const featured = useMemo(() => (!searching && filters.theme === 'all' ? featuredArticles(all) : []), [all, filters.theme, searching])

  // "Ouvir resumo" (regra geral 9 do pacote 2): conta todos os artigos, para a busca não trocar a fala.
  const listen = useListenSummary(t.guide.summary(all.length), lang, deps.speech ?? speechService)

  // "← Voltar" volta à tela anterior (a busca e o filtro trocam a URL com `replace`: não contam como tela).
  const onBack = useCallback(
    (event: { preventDefault: () => void }) => {
      if (!canGoBack()) return
      event.preventDefault()
      void navigate(-1)
    },
    [canGoBack, navigate],
  )

  return {
    filters,
    setQuery: (query) => update({ ...filters, query }),
    clearQuery: () => update({ ...filters, query: '' }),
    setTheme: (theme) => update({ ...filters, theme }),
    themes: themeCounts(all),
    searching,
    featured,
    groups,
    results,
    linkQuery,
    backTo: '/',
    onBack,
    listen,
  }
}

type ArticleDeps = { guide: GuideService; field: GuideFieldService; speech?: SpeechService }
const defaultArticleDeps: ArticleDeps = { guide: guideService, field: guideFieldService }

export type HelpfulAnswer = 'yes' | 'no'

export type GuideArticleState = {
  article: GuideArticle | null
  layout: ArticleLayout | null
  related: GuideSummary[]
  /** "Na sua lavoura": o lugar, a frase com o número do ponto e a fonte; sem ponto ou sem dado, `null`. */
  field: { place: string; text: string; source: string } | null
  /** "Este artigo ajudou?": só marca e agradece (sem contagem guardada). */
  helpful: HelpfulAnswer | null
  setHelpful: (answer: HelpfulAnswer) => void
  /** Índice "Neste artigo": rola até a seção (suave, a não ser com menos movimento) e põe o foco nela. */
  jumpTo: (id: string) => void
  backTo: string
  linkQuery: string
  listen: ListenSummaryState
}

/** Um artigo do Guia pelo slug da URL (null se não existir no idioma atual). */
export function useGuideArticleController(slug: string, deps: ArticleDeps = defaultArticleDeps): GuideArticleState {
  const { lang, messages: t } = useI18n()
  const { search } = useLocation()
  const reduced = usePrefersReducedMotion()
  const article = useMemo(() => deps.guide.get(lang, slug), [deps.guide, lang, slug])
  const layout = useMemo(() => (article ? articleLayout(article.blocks) : null), [article])
  const related = useMemo(() => (article ? relatedArticles(article, deps.guide.list(lang)) : []), [article, deps.guide, lang])

  // A lavoura do produtor: o ponto da URL ou o salvo no aparelho (nunca a fazenda de exemplo).
  const point = useMemo(() => fieldPoint(readFlowParams(new URLSearchParams(search)), deps.field.savedPoint()), [search, deps.field])
  const pointKey = point ? JSON.stringify(point) : ''
  const fact = useAsync(() => deps.field.fact(slug, point, lang), [slug, pointKey, lang, deps.field])
  const field = useMemo(() => {
    if (fact.status !== 'ready' || !fact.data || !point) return null
    const { text, source } = fieldFactText(t, lang, fact.data)
    return { place: t.guide.field.place(nearestPlace(point)), text, source: t.guide.field.source(source) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pointKey` resume o ponto
  }, [fact.status, fact.data, pointKey, t, lang])

  const [answer, setAnswer] = useState<{ slug: string; value: HelpfulAnswer } | null>(null)
  const setHelpful = useCallback((value: HelpfulAnswer) => setAnswer({ slug, value }), [slug])

  const jumpTo = useCallback(
    (id: string) => {
      const target = document.getElementById(id)
      if (!target) return
      target.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
      target.focus({ preventScroll: true })
    },
    [reduced],
  )

  // "Ouvir": o título, o "Em uma frase" e o número de "Na sua lavoura".
  const spoken = article
    ? [articleSummary(article), field && point ? t.guide.field.spoken(nearestPlace(point), field.text) : ''].filter(Boolean).join(' ')
    : t.guide.notFound
  const listen = useListenSummary(spoken, lang, deps.speech ?? speechService)
  const linkQuery = keepFlowQuery(search)

  return {
    article,
    layout,
    related,
    field,
    helpful: answer && answer.slug === slug ? answer.value : null,
    setHelpful,
    jumpTo,
    backTo: `/guia${linkQuery}`,
    linkQuery,
    listen,
  }
}
