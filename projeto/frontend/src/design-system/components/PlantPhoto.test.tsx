import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { newTabName } from '../../test/newTabName'
import { PlantPhoto, type PlantPhotoImage, type PlantPhotoProps } from './PlantPhoto'

const corn: PlantPhotoImage = {
  src: '/fotos/milho.jpg',
  alt: 'Beira de uma lavoura de milho alto e verde, com os pendões no topo',
  author: 'Christian Fischer',
  license: 'CC BY-SA 3.0',
  href: 'https://commons.wikimedia.org/wiki/File:ZeaMays.jpg',
}

const brachiaria: PlantPhotoImage = {
  src: '/fotos/braquiaria.jpg',
  alt: 'Faixas de braquiária verde ao lado de pés de milho já secos',
  author: 'Ethan Bass',
  license: 'CC BY-SA 4.0',
  href: 'https://commons.wikimedia.org/wiki/File:Strip_of_Brachiaria_brizantha_%28signal_grass%29.jpg',
}

const props: PlantPhotoProps = {
  images: [corn],
  name: 'Milho sozinho',
  creditLabel: 'Foto',
  newTabLabel: '(abre em nova aba)',
}

const pair: PlantPhotoProps = { ...props, images: [corn, brachiaria], name: 'Milho com braquiária' }

describe('PlantPhoto (foto real da cultura, com crédito, tarefa 0055)', () => {
  it('mostra a foto com o texto alternativo que a descreve', () => {
    render(<PlantPhoto {...props} />)

    const img = screen.getByRole('img', { name: corn.alt })
    expect(img).toHaveAttribute('src', '/fotos/milho.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('o crédito fica em cima da foto: "Foto: autor · licença", com o autor ligando à página do Commons em nova aba', () => {
    render(<PlantPhoto {...props} />)

    const link = screen.getByRole('link', { name: newTabName('Christian Fischer') })
    expect(link).toHaveAttribute('href', corn.href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
    expect(link.closest('[data-credit]')).toHaveTextContent('Foto: Christian Fischer (abre em nova aba) · CC BY-SA 3.0')
    // O aviso da nova aba é só para quem usa leitor de tela; o espaço fica dentro dele (o sublinhado para no nome).
    expect(link.textContent).toBe('Christian Fischer (abre em nova aba)')
    expect(link.querySelector('.visually-hidden')?.textContent).toBe(' (abre em nova aba)')
  })

  it('o crédito é uma linha só; cortado com reticências numa foto estreita, o texto inteiro aparece ao parar o mouse', () => {
    render(<PlantPhoto {...props} />)

    expect(screen.getByRole('link', { name: newTabName('Christian Fischer') }).closest('[data-credit]')).toHaveAttribute(
      'title',
      'Foto: Christian Fischer · CC BY-SA 3.0',
    )
  })

  it('se a imagem não carregar, vira um bloco colorido com o nome da cultura (sem crédito)', () => {
    render(<PlantPhoto {...props} />)

    fireEvent.error(screen.getByRole('img', { name: corn.alt }))

    expect(screen.queryByRole('img', { name: corn.alt })).not.toBeInTheDocument()
    expect(screen.getByText('Milho sozinho')).toHaveAttribute('data-fallback')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('outra foto no mesmo lugar tenta carregar de novo', () => {
    const { rerender } = render(<PlantPhoto {...props} />)
    fireEvent.error(screen.getByRole('img', { name: corn.alt }))

    rerender(<PlantPhoto {...props} images={[brachiaria]} name="Braquiária" />)

    expect(screen.getByRole('img', { name: brachiaria.alt })).toHaveAttribute('src', '/fotos/braquiaria.jpg')
  })

  it('ocupa a largura do contêiner (sem rolagem lateral) com a altura pedida pela tela', () => {
    const { container, rerender } = render(<PlantPhoto {...props} />)
    const figure = container.querySelector('figure')
    expect(figure).toHaveStyle({ height: '150px' })

    rerender(<PlantPhoto {...props} height={72} />)
    expect(figure).toHaveStyle({ height: '72px' })
  })
})

describe('PlantPhoto com 2 imagens (sem foto aberta da cultura inteira, pacote 3, tarefa 0064)', () => {
  it('as 2 imagens lado a lado num bloco só, que é uma imagem com o nome da cultura', () => {
    const { container } = render(<PlantPhoto {...pair} />)

    const block = screen.getByRole('img', { name: 'Milho com braquiária' })
    const images = block.querySelectorAll('img')
    expect([...images].map((img) => img.getAttribute('src'))).toEqual(['/fotos/milho.jpg', '/fotos/braquiaria.jpg'])
    // As metades não são lidas uma a uma: o leitor de tela ouve o nome da cultura.
    expect([...images].every((img) => img.getAttribute('alt') === '')).toBe(true)
    expect(block).toHaveAttribute('data-pair')
    expect(container.querySelectorAll('figure')).toHaveLength(1)
  })

  it('um crédito só, embaixo, com os 2 autores, cada um ligando à sua página do Commons em nova aba', () => {
    render(<PlantPhoto {...pair} />)

    const credit = screen.getByRole('link', { name: newTabName('Christian Fischer') }).closest('[data-credit]')
    expect(credit).toHaveTextContent(
      'Foto: Christian Fischer (abre em nova aba) · CC BY-SA 3.0 | Ethan Bass (abre em nova aba) · CC BY-SA 4.0',
    )
    expect(credit).toHaveAttribute('title', 'Foto: Christian Fischer · CC BY-SA 3.0 | Ethan Bass · CC BY-SA 4.0')
    expect(screen.getByRole('link', { name: newTabName('Ethan Bass') })).toHaveAttribute('href', brachiaria.href)
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(document.querySelectorAll('[data-credit]')).toHaveLength(1)
  })

  it('se uma das 2 não carregar, vira o bloco colorido com o nome da cultura', () => {
    const { container } = render(<PlantPhoto {...pair} />)

    fireEvent.error(container.querySelectorAll('img')[1])

    expect(screen.getByText('Milho com braquiária')).toHaveAttribute('data-fallback')
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
