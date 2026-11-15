import type { ReactNode } from 'react'
import type { GuideSlug } from '../../content/guia/slugs'
import { ExternalLinkIcon } from '../icons'
import styles from './GuideLink.module.css'

export type GuideLinkProps = {
  /** O artigo do Guia (só os que existem: `GUIDE_SLUGS`). */
  slug: GuideSlug
  /** O texto do link, ex.: "Saiba mais: rotação de culturas". */
  children: ReactNode
  /** "(abre em nova aba)" / "(opens in a new tab)": só para o leitor de tela (`t.common.newTab`). */
  newTabLabel: string
  /** Espaço em volta ou cor, decididos pela tela. */
  className?: string
}

/**
 * "Saiba mais" do Guia (regra geral 3 do pacote 2): abre o artigo numa **nova aba**, para o produtor não
 * perder o que estava fazendo. Tem o ícone de "abrir fora" e o aviso "(abre em nova aba)" escondido para o
 * leitor de tela. Todo link de uma tela para um artigo do Guia usa este componente.
 */
export function GuideLink({ slug, children, newTabLabel, className }: GuideLinkProps) {
  return (
    <a
      href={`/guia/${slug}`}
      target="_blank"
      rel="noopener"
      className={className ? `${styles.link} ${className}` : styles.link}
    >
      <span>{children}</span>
      <ExternalLinkIcon size={14} />{' '}
      <span className="visually-hidden">{newTabLabel}</span>
    </a>
  )
}
