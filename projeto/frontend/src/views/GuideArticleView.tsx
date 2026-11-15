import { Link } from 'react-router'
import type { HelpfulAnswer } from '../controllers/useGuideController'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import { BackButton } from '../design-system/components/BackButton'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, PinIcon } from '../design-system/icons'
import { PlantImage } from '../design-system/plants/PlantImage'
import type { Messages } from '../i18n/messages.pt'
import type { ArticleBlock, ArticleLayout, GuideArticle, GuideSummary } from '../models/guide'
import type { Inline } from '../services/markdownService'
import styles from './GuideArticleView.module.css'
import { GuideThemeIcon } from './GuideThemeIcon'

export type GuideArticleViewProps = {
  t: Messages
  article: GuideArticle | null
  layout: ArticleLayout | null
  related: GuideSummary[]
  /** "Na sua lavoura": o lugar, a frase com o número do ponto e a fonte; `null` = sem caixa. */
  field: { place: string; text: string; source: string } | null
  helpful: HelpfulAnswer | null
  onHelpful: (answer: HelpfulAnswer) => void
  /** Índice "Neste artigo": rola até a seção. */
  onJump: (id: string) => void
  backTo: string
  /** O fluxo da URL (`?lat=…`, ou ""), que segue nos links internos do artigo. */
  linkQuery: string
  listen: ListenSummaryState
}

/** Link interno do artigo com o fluxo da URL (para a lavoura e o "Voltar" continuarem os mesmos). */
const withQuery = (href: string, query: string) => (href.includes('?') ? href : `${href}${query}`)

function Inlines({ items, linkQuery }: { items: Inline[]; linkQuery: string }) {
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
            <Link key={index} to={withQuery(item.href, linkQuery)}>
              {item.text}
            </Link>
          )
        return item.text
      })}
    </>
  )
}

/** Os blocos do texto (Markdown lido pelo `markdownService`: nunca HTML) e a lista de cuidados em cartões. */
function Blocks({ blocks, linkQuery, idPrefix }: { blocks: ArticleBlock[]; linkQuery: string; idPrefix: string }) {
  return (
    <>
      {blocks.map((block, index) => {
        const labelId = `${idPrefix}-p${index}`
        if (block.type === 'cards') {
          const before = blocks[index - 1]
          return (
            <ul key={index} className={styles.cards} aria-labelledby={before?.type === 'paragraph' ? `${idPrefix}-p${index - 1}` : undefined}>
              {block.items.map((item) => (
                <li key={item.title} className={styles.card}>
                  <span className={styles.cardIcon}>
                    <CheckIcon size={18} />
                  </span>
                  <strong>{item.title}</strong>
                  <span>
                    <Inlines items={item.text} linkQuery={linkQuery} />
                  </span>
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === 'heading')
          return (
            <h3 key={index}>
              <Inlines items={block.children} linkQuery={linkQuery} />
            </h3>
          )
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag key={index}>
              {block.items.map((item, i) => (
                <li key={i}>
                  <Inlines items={item} linkQuery={linkQuery} />
                </li>
              ))}
            </Tag>
          )
        }
        return (
          <p key={index} id={labelId}>
            <Inlines items={block.children} linkQuery={linkQuery} />
          </p>
        )
      })}
    </>
  )
}

function FieldBox({ field }: { field: NonNullable<GuideArticleViewProps['field']> }) {
  return (
    <div className={styles.field} role="note">
      <p className={styles.fieldPlace}>
        <PinIcon size={14} />
        {field.place}
      </p>
      <p className={styles.fieldText}>{field.text}</p>
      <p className={styles.fieldSource}>{field.source}</p>
    </div>
  )
}

/**
 * Um artigo do Guia (tela 8 do pacote 3): tema, título, tempo de leitura e "Ouvir"; a faixa "em revisão"; o "Em
 * uma frase" em destaque; as seções (com a caixa "Na sua lavoura" quando há número do ponto); as fontes
 * recolhidas; "Este artigo ajudou?"; e, ao lado (fixo no computador), o índice e o "Veja também". No celular, o
 * índice some e o "Veja também" vai para o fim.
 */
export function GuideArticleView({
  t,
  article,
  layout,
  related,
  field,
  helpful,
  onHelpful,
  onJump,
  backTo,
  linkQuery,
  listen,
}: GuideArticleViewProps) {
  const g = t.guide
  return (
    <div className={styles.page}>
      <BackButton to={backTo}>{g.back}</BackButton>
      {article && layout ? (
        <div className={styles.grid}>
          <article className={styles.article}>
            <div className={styles.head}>
              <div>
                <span className={styles.theme}>
                  <GuideThemeIcon theme={article.theme} size={14} />
                  {g.themes[article.theme]}
                </span>
                <h1 className={styles.title}>{article.title}</h1>
                <div className={styles.meta}>
                  <span>{g.minutes(article.minutes)}</span>
                  <ListenSummary
                    supported={listen.supported}
                    speaking={listen.speaking}
                    onToggle={listen.toggle}
                    label={t.listen.summary}
                    stopLabel={t.listen.stop}
                  />
                </div>
              </div>
              {article.plant && (
                <span className={styles.plant}>
                  <PlantImage plant={article.plant} label={g.plantAlt(g.plants[article.plant])} size={96} />
                </span>
              )}
            </div>

            {layout.sentence && (
              <section className={styles.sentence} aria-labelledby="guia-frase">
                <p id="guia-frase" className={styles.sentenceLabel}>
                  {g.sentence}
                </p>
                <p className={styles.sentenceText}>
                  <Inlines items={layout.sentence} linkQuery={linkQuery} />
                </p>
              </section>
            )}

            <div className={styles.body}>
              {layout.sections.map((section) => (
                <section key={section.id}>
                  <h2 id={section.id} tabIndex={-1}>
                    {section.title}
                  </h2>
                  {section.field && field && <FieldBox field={field} />}
                  <Blocks blocks={section.blocks} linkQuery={linkQuery} idPrefix={section.id} />
                </section>
              ))}
            </div>

            {layout.sources.length > 0 && (
              <details className={styles.sources}>
                <summary>
                  <span>{g.sources}</span>
                  <ChevronDownIcon size={18} />
                </summary>
                <Blocks blocks={layout.sources} linkQuery={linkQuery} idPrefix="guia-fontes" />
              </details>
            )}

            <div className={styles.helpful}>
              <span id="guia-ajudou">{g.helpful}</span>
              <div className={styles.helpfulButtons} role="group" aria-labelledby="guia-ajudou">
                <button type="button" aria-pressed={helpful === 'yes'} onClick={() => onHelpful('yes')}>
                  {g.helpfulYes}
                </button>
                <button type="button" aria-pressed={helpful === 'no'} onClick={() => onHelpful('no')}>
                  {g.helpfulNo}
                </button>
              </div>
              <span role="status" className={styles.thanks}>
                {helpful ? g.helpfulThanks : ''}
              </span>
            </div>
          </article>

          <aside className={styles.side}>
            {layout.sections.length > 0 && (
              <nav className={`${styles.sideBox} ${styles.toc}`} aria-labelledby="guia-indice">
                <h2 id="guia-indice" className={styles.sideTitle}>
                  {g.toc}
                </h2>
                <ol>
                  {layout.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        onClick={(event) => {
                          event.preventDefault()
                          onJump(section.id)
                        }}
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {related.length > 0 && (
              <section className={styles.sideBox} aria-labelledby="guia-veja">
                <h2 id="guia-veja" className={styles.sideTitle}>
                  {g.seeAlso}
                </h2>
                <ul className={styles.related}>
                  {related.map((item) => (
                    <li key={item.slug}>
                      <Link to={`/guia/${item.slug}${linkQuery}`} className={styles.relatedItem}>
                        <span>{item.title}</span>
                        <ChevronRightIcon size={16} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      ) : (
        <p role="status" className={styles.notFound}>
          {g.notFound}
        </p>
      )}
    </div>
  )
}
