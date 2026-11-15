import { Link } from 'react-router'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import { BackButton } from '../design-system/components/BackButton'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { PageHeading } from '../design-system/components/Content'
import { PlantPhoto } from '../design-system/components/PlantPhoto'
import { plantPhotoProps } from '../content/plantPhotos'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { GuideArticle } from '../models/guide'
import type { GuideGroup } from '../services/guideService'
import type { Block, Inline } from '../services/markdownService'
import styles from './GuideView.module.css'
import layout from './layout.module.css'

export type GuideViewProps = {
  t: Messages
  backTo: string
  groups: GuideGroup[]
  query: string
  onQuery: (query: string) => void
  count: number
  /** "Ouvir resumo" (regra geral 9 do pacote 2). */
  listen: ListenSummaryState
}

/** Página inicial do Guia: busca por título e os artigos nos 5 temas. */
export function GuideView({ t, backTo, groups, query, onQuery, count, listen }: GuideViewProps) {
  const g = t.guide
  return (
    <div className={layout.page}>
      <BackButton to={backTo}>{t.nav.back}</BackButton>
      <PageHeading title={g.title} subtitle={g.subtitle} />
      <ListenSummary
        supported={listen.supported}
        speaking={listen.speaking}
        onToggle={listen.toggle}
        label={t.listen.summary}
        stopLabel={t.listen.stop}
      />
      {/* Tarefa 0051 (RF-35): a área do MVP fica aqui, e não nos artigos (que têm limite de palavras). */}
      <p className={layout.muted}>{g.mvpArea}</p>
      <input
        type="search"
        className={styles.search}
        aria-label={g.searchLabel}
        placeholder={g.searchPlaceholder}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      {count === 0 && <p role="status">{g.noResults}</p>}
      <div className={styles.themes}>
        {groups.map((group) => (
          <section key={group.theme} aria-label={g.themes[group.theme]} className={styles.theme}>
            <h2 className={layout.cardTitle}>{g.themes[group.theme]}</h2>
            <ul className={styles.list}>
              {group.articles.map((article) => (
                <li key={article.slug} className={styles.item}>
                  <Link to={`/guia/${article.slug}`} className={styles.link}>
                    {article.title}
                    {article.draft && <span className={styles.badge}>{g.draftBadge}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.type === 'strong') return <strong key={index}>{item.text}</strong>
        if (item.type === 'link')
          return item.external ? (
            <a key={index} href={item.href} target="_blank" rel="noopener noreferrer">
              {item.text}
            </a>
          ) : (
            <Link key={index} to={item.href}>
              {item.text}
            </Link>
          )
        return item.text
      })}
    </>
  )
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'heading')
          return block.level === 2 ? (
            <h2 key={index}>
              <Inlines items={block.children} />
            </h2>
          ) : (
            <h3 key={index}>
              <Inlines items={block.children} />
            </h3>
          )
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag key={index}>
              {block.items.map((item, i) => (
                <li key={i}>
                  <Inlines items={item} />
                </li>
              ))}
            </Tag>
          )
        }
        return (
          <p key={index}>
            <Inlines items={block.children} />
          </p>
        )
      })}
    </>
  )
}

/** Um artigo: texto puro no DOM (o "Ouvir" lê o que está no main). */
export function GuideArticleView({
  t,
  lang,
  article,
  listen,
}: {
  t: Messages
  lang: Lang
  article: GuideArticle | null
  listen: ListenSummaryState
}) {
  const g = t.guide
  return (
    <div className={layout.page}>
      <BackButton to="/guia">{g.back}</BackButton>
      {article ? (
        <article className={styles.article}>
          {article.draft && <p className={styles.draftNote}>{g.draft}</p>}
          {article.plant && <PlantPhoto {...plantPhotoProps(article.plant, lang)} height={200} />}
          <h1 className={layout.sectionTitle}>{article.title}</h1>
          <ListenSummary
            supported={listen.supported}
            speaking={listen.speaking}
            onToggle={listen.toggle}
            label={t.listen.summary}
            stopLabel={t.listen.stop}
          />
          <div className={styles.prose}>
            <Blocks blocks={article.blocks} />
          </div>
        </article>
      ) : (
        <p role="status">{g.notFound}</p>
      )}
    </div>
  )
}
