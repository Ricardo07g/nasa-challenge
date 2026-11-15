import { Fragment, useState } from 'react'
import styles from './PlantPhoto.module.css'

/** Uma imagem da foto, com o crédito dela. */
export type PlantPhotoImage = {
  src: string
  /** O que a imagem mostra (não só o nome da cultura). */
  alt: string
  author: string
  /** Licença já escrita no idioma (ex.: "CC BY-SA 4.0", "Domínio público"). */
  license: string
  /** Página do arquivo no Wikimedia Commons. */
  href: string
}

export type PlantPhotoProps = {
  /**
   * 1 imagem ou 2 lado a lado (quando não há foto aberta da cultura inteira; ex.: milho com braquiária = o milho à
   * esquerda e a braquiária à direita).
   */
  images: readonly [PlantPhotoImage] | readonly [PlantPhotoImage, PlantPhotoImage]
  /** Nome da cultura: nome do bloco de 2 imagens e o texto do bloco colorido quando a foto não carrega. */
  name: string
  /** "Foto" / "Photo". */
  creditLabel: string
  /** "(abre em nova aba)" / "(opens in a new tab)": só para leitor de tela. */
  newTabLabel: string
  /** Altura em px; a largura acompanha o contêiner. */
  height?: number
  /** Cantos e espaço em volta, decididos pela tela. */
  className?: string
}

/**
 * Foto real de uma cultura (tarefa 0055), com o crédito em cima da imagem, embaixo ("Foto: autor · licença", o autor
 * ligando à página do Commons em nova aba). Com 2 imagens (tarefa 0064), elas ficam lado a lado num bloco só
 * (`role="img"` com o nome da cultura) e o crédito, um só, junta os dois autores ("Foto: A · licença | B · licença").
 * Se uma imagem não carregar, vira um bloco colorido com o nome da cultura. As props de cada cultura vêm prontas de
 * `plantPhotoProps` (`content/plantPhotos.ts`).
 */
export function PlantPhoto({ images, name, creditLabel, newTabLabel, height = 150, className }: PlantPhotoProps) {
  // Guarda qual foto falhou: outra foto no mesmo lugar tenta carregar de novo.
  const photoKey = images.map((image) => image.src).join('|')
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const failed = failedKey === photoKey
  const onError = () => setFailedKey(photoKey)
  const image = (item: PlantPhotoImage, alt: string) => (
    <img key={item.src} className={styles.image} src={item.src} alt={alt} loading="lazy" decoding="async" onError={onError} />
  )
  const title = `${creditLabel}: ${images.map((item) => `${item.author} · ${item.license}`).join(' | ')}`

  return (
    <figure className={className ? `${styles.photo} ${className}` : styles.photo} style={{ height }}>
      {failed ? (
        <span className={styles.fallback} data-fallback>
          {name}
        </span>
      ) : (
        <>
          {images.length > 1 ? (
            // As metades não são lidas uma a uma: o bloco é uma imagem com o nome da cultura.
            <div className={styles.pair} role="img" aria-label={name} data-pair>
              {images.map((item) => image(item, ''))}
            </div>
          ) : (
            image(images[0], images[0].alt)
          )}
          <figcaption>
            <span className={styles.credit} data-credit title={title}>
              {creditLabel}:{' '}
              {images.map((item, index) => (
                <Fragment key={item.src}>
                  {index > 0 && ' | '}
                  <a href={item.href} target="_blank" rel="noopener">
                    {item.author}
                    {/* O espaço vai dentro do aviso escondido: o sublinhado para no nome. */}
                    <span className="visually-hidden">{` ${newTabLabel}`}</span>
                  </a>{' '}
                  · {item.license}
                </Fragment>
              ))}
            </span>
          </figcaption>
        </>
      )}
    </figure>
  )
}
