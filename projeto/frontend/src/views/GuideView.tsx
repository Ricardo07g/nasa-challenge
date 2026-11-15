import { Fragment, useRef } from 'react'
import { Link } from 'react-router'
import { plantPhotoProps } from '../content/plantPhotos'
import type { GuideResult } from '../controllers/useGuideController'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import { BackButton } from '../design-system/components/BackButton'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { PlantPhoto } from '../design-system/components/PlantPhoto'
import { CalendarIcon, CheckIcon, CloseIcon, SatelliteIcon, SearchIcon } from '../design-system/icons'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { GuideFilters, GuideSummary, GuideThemeFilter, HighlightPart } from '../models/guide'
import type { GuideGroup } from '../services/guideService'
import { GuideThemeIcon } from './GuideThemeIcon'
import styles from './GuideView.module.css'

export type GuideViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  /** Com tela anterior no app, o "← Voltar" volta para ela. */
  onBack: (event: { preventDefault: () => void }) => void
  filters: GuideFilters
  onQuery: (query: string) => void
  onClear: () => void
  onTheme: (theme: GuideThemeFilter) => void
  themes: { key: GuideThemeFilter; count: number }[]
  searching: boolean
  featured: GuideSummary[]
  groups: GuideGroup[]
  results: GuideResult[]
  /** O fluxo da URL (`?lat=…`, ou ""), que segue nos links para os artigos. */
  linkQuery: string
  /** "Ouvir resumo" (regra geral 9 do pacote 2). */
  listen: ListenSummaryState
}

/** O ícone de cada destaque do "Comece por aqui". */
function FeaturedIcon({ slug }: { slug: string }) {
  if (slug === 'raio-x') return <SatelliteIcon size={19} />
  if (slug === 'deu-certo') return <CheckIcon size={19} />
  return <CalendarIcon size={19} />
}

function Highlighted({ parts }: { parts: HighlightPart[] }) {
  return (
    <>
      {parts.map((part, index) => (part.mark ? <mark key={index}>{part.text}</mark> : <Fragment key={index}>{part.text}</Fragment>))}
    </>
  )
}

type CardProps = {
  t: Messages
  lang: Lang
  article: GuideSummary
  to: string
  title?: HighlightPart[]
  summary?: HighlightPart[]
  themeName?: string
  photo?: boolean
}

/**
 * Um cartão de artigo: o título é o link (o `::after` dele cobre o cartão inteiro, que fica todo clicável e pode
 * abrir em nova aba); a foto da cultura, com o link do crédito, fica fora do link, por cima.
 */
function GuideCard({ t, lang, article, to, title, summary, themeName, photo }: CardProps) {
  const g = t.guide
  const withPhoto = photo && article.plant !== null
  return (
    <li className={withPhoto ? `${styles.card} ${styles.photoCard}` : styles.card}>
      {withPhoto && <PlantPhoto {...plantPhotoProps(article.plant!, lang)} height={96} className={styles.photo} />}
      <div className={styles.cardText}>
        {themeName && <span className={styles.cardTheme}>{themeName}</span>}
        <Link to={to} className={styles.cardLink}>
          {title ? <Highlighted parts={title} /> : article.title}
        </Link>
        <p className={styles.cardSummary}>{summary ? <Highlighted parts={summary} /> : article.summary}</p>
        <span className={styles.cardFoot}>{g.minutes(article.minutes)}</span>
      </div>
    </li>
  )
}

/** Início do Guia (tela 8 do pacote 3): busca, filtros por tema, "Comece por aqui" e os cartões dos artigos. */
export function GuideView({
  t,
  lang,
  backTo,
  onBack,
  filters,
  onQuery,
  onClear,
  onTheme,
  themes,
  searching,
  featured,
  groups,
  results,
  linkQuery,
  listen,
}: GuideViewProps) {
  const g = t.guide
  const input = useRef<HTMLInputElement>(null)
  const to = (slug: string) => `/guia/${slug}${linkQuery}`
  const themeName = (key: GuideThemeFilter) => (key === 'all' ? g.all : g.themes[key])

  return (
    <div className={styles.page}>
      <BackButton to={backTo} onClick={onBack}>
        {t.nav.back}
      </BackButton>
      <div className={styles.top}>
        <div>
          <h1 className={styles.title}>{g.title}</h1>
          <div className={styles.lead}>
            <p>{g.subtitle}</p>
            <ListenSummary
              supported={listen.supported}
              speaking={listen.speaking}
              onToggle={listen.toggle}
              label={t.listen.summary}
              stopLabel={t.listen.stop}
            />
          </div>
        </div>
        <div className={styles.search} role="search">
          <SearchIcon size={20} />
          <input
            ref={input}
            type="search"
            autoComplete="off"
            aria-label={g.searchLabel}
            placeholder={g.searchPlaceholder}
            value={filters.query}
            onChange={(event) => onQuery(event.target.value)}
          />
          {filters.query && (
            <button
              type="button"
              className={styles.clear}
              aria-label={g.clearSearch}
              onClick={() => {
                onClear()
                input.current?.focus({ preventScroll: true })
              }}
            >
              <CloseIcon size={18} />
            </button>
          )}
        </div>
      </div>

      {!searching && (
        <div className={styles.themes} role="group" aria-label={g.themesLabel}>
          {themes.map(({ key, count }) => (
            <button
              key={key}
              type="button"
              className={styles.themeButton}
              aria-pressed={filters.theme === key}
              onClick={() => onTheme(key)}
            >
              {key !== 'all' && <GuideThemeIcon theme={key} size={15} />}
              {themeName(key)} <span className={styles.count}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {searching ? (
        results.length > 0 ? (
          <>
            <p className={styles.resultsInfo} role="status">
              <strong>{results.length}</strong> {g.resultsWord(results.length)} {g.resultsFor(filters.query.trim())}
            </p>
            <ul className={styles.cards}>
              {results.map((result) => (
                <GuideCard
                  key={result.article.slug}
                  t={t}
                  lang={lang}
                  article={result.article}
                  to={to(result.article.slug)}
                  title={result.title}
                  summary={result.summary}
                  themeName={g.themes[result.article.theme]}
                />
              ))}
            </ul>
          </>
        ) : (
          <div className={styles.empty} role="status">
            <strong>{g.noResults(filters.query.trim())}</strong>
            <span>{g.noResultsHint}</span>
            <div className={styles.suggestions}>
              {g.suggestions.map((suggestion) => (
                <button key={suggestion} type="button" className={styles.themeButton} onClick={() => onQuery(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          {featured.length > 0 && (
            <section className={styles.block} aria-labelledby="guia-comece">
              <div className={styles.blockTop}>
                <h2 id="guia-comece">{g.start}</h2>
              </div>
              <ul className={styles.featured}>
                {featured.map((article) => (
                  <li key={article.slug} className={styles.featuredCard}>
                    <span className={styles.featuredIcon}>
                      <FeaturedIcon slug={article.slug} />
                    </span>
                    <Link to={to(article.slug)} className={styles.featuredLink}>
                      {article.title}
                    </Link>
                    <p>{article.summary}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {groups.map((group) => (
            <section key={group.theme} className={styles.block} aria-labelledby={`guia-tema-${group.theme}`}>
              <div className={styles.blockTop}>
                <span className={styles.blockIcon}>
                  <GuideThemeIcon theme={group.theme} />
                </span>
                <h2 id={`guia-tema-${group.theme}`}>{g.themes[group.theme]}</h2>
                <span className={styles.blockCount}>{g.articles(group.articles.length)}</span>
              </div>
              <ul className={styles.cards}>
                {group.articles.map((article) => (
                  <GuideCard key={article.slug} t={t} lang={lang} article={article} to={to(article.slug)} photo />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

    </div>
  )
}
