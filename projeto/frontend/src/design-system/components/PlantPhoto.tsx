import { useState } from 'react'
import styles from './PlantPhoto.module.css'

export type PlantPhotoCredit = {
  /** "Foto" / "Photo". */
  label: string
  author: string
  /** Licença já escrita no idioma (ex.: "CC BY-SA 4.0", "Domínio público"). */
  license: string
  /** Página do arquivo no Wikimedia Commons. */
  href: string
  /** "(abre em nova aba)" / "(opens in a new tab)": só para leitor de tela. */
  newTabLabel: string
}

export type PlantPhotoProps = {
  src: string
  /** O que a foto mostra (não só o nome da cultura). */
  alt: string
  /** Nome da cultura: aparece no bloco colorido quando a foto não carrega. */
  name: string
  credit: PlantPhotoCredit
  /** Legenda opcional (ex.: "na foto: a braquiária"). */
  caption?: string
  /** Altura em px; a largura acompanha o contêiner. */
  height?: number
  /** Cantos e espaço em volta, decididos pela tela. */
  className?: string
}

/**
 * Foto real de uma cultura (tarefa 0055), com o crédito em cima da imagem ("Foto: autor · licença", o autor
 * ligando à página do Commons em nova aba) e a legenda opcional. Se a imagem não carregar, vira um bloco
 * colorido com o nome da cultura. As props de cada cultura vêm prontas de `plantPhotoProps` (`content/plantPhotos.ts`).
 */
export function PlantPhoto({ src, alt, name, credit, caption, height = 150, className }: PlantPhotoProps) {
  // Guarda qual foto falhou: outra foto no mesmo lugar tenta carregar de novo.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = failedSrc === src

  return (
    <figure className={className ? `${styles.photo} ${className}` : styles.photo} style={{ height }}>
      {failed ? (
        <span className={styles.fallback} data-fallback>
          {name}
        </span>
      ) : (
        <>
          <img
            className={styles.image}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailedSrc(src)}
          />
          <figcaption>
            {caption && <span className={styles.caption}>{caption}</span>}
            <span
              className={styles.credit}
              data-credit
              title={`${credit.label}: ${credit.author} · ${credit.license}`}
            >
              {credit.label}:{' '}
              <a href={credit.href} target="_blank" rel="noopener">
                {credit.author}
                {/* O espaço vai dentro do aviso escondido: o sublinhado para no nome. */}
                <span className="visually-hidden">{` ${credit.newTabLabel}`}</span>
              </a>{' '}
              · {credit.license}
            </span>
          </figcaption>
        </>
      )}
    </figure>
  )
}
