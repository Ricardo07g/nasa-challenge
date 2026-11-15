import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { newTabName } from '../../test/newTabName'
import { PlantPhoto, type PlantPhotoProps } from './PlantPhoto'

const props: PlantPhotoProps = {
  src: '/fotos/braquiaria.jpg',
  alt: 'Faixas de braquiária verde ao lado de pés de milho já secos',
  name: 'Milho com braquiária',
  caption: 'na foto: a braquiária',
  credit: {
    label: 'Foto',
    author: 'Ethan Bass',
    license: 'CC BY-SA 4.0',
    href: 'https://commons.wikimedia.org/wiki/File:Strip_of_Brachiaria_brizantha_%28signal_grass%29.jpg',
    newTabLabel: '(abre em nova aba)',
  },
}

describe('PlantPhoto (foto real da cultura, com crédito, tarefa 0055)', () => {
  it('mostra a foto com o texto alternativo que a descreve', () => {
    render(<PlantPhoto {...props} />)

    const img = screen.getByRole('img', { name: props.alt })
    expect(img).toHaveAttribute('src', '/fotos/braquiaria.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('o crédito fica em cima da foto: "Foto: autor · licença", com o autor ligando à página do Commons em nova aba', () => {
    render(<PlantPhoto {...props} />)

    const link = screen.getByRole('link', { name: newTabName('Ethan Bass') })
    expect(link).toHaveAttribute('href', props.credit.href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
    expect(link.closest('[data-credit]')).toHaveTextContent('Foto: Ethan Bass (abre em nova aba) · CC BY-SA 4.0')
    // O aviso da nova aba é só para quem usa leitor de tela; o espaço fica dentro dele (o sublinhado para no nome).
    expect(link.textContent).toBe('Ethan Bass (abre em nova aba)')
    expect(link.querySelector('.visually-hidden')?.textContent).toBe(' (abre em nova aba)')
  })

  it('o crédito é uma linha só; cortado com reticências numa foto estreita, o texto inteiro aparece ao parar o mouse', () => {
    render(<PlantPhoto {...props} />)

    expect(screen.getByRole('link', { name: newTabName('Ethan Bass') }).closest('[data-credit]')).toHaveAttribute(
      'title',
      'Foto: Ethan Bass · CC BY-SA 4.0',
    )
  })

  it('mostra a legenda quando existe, e nada quando não existe', () => {
    const { rerender } = render(<PlantPhoto {...props} />)
    expect(screen.getByText('na foto: a braquiária')).toBeInTheDocument()

    rerender(<PlantPhoto {...props} caption={undefined} />)
    expect(screen.queryByText('na foto: a braquiária')).not.toBeInTheDocument()
  })

  it('se a imagem não carregar, vira um bloco colorido com o nome da cultura (sem crédito nem legenda)', () => {
    render(<PlantPhoto {...props} />)

    fireEvent.error(screen.getByRole('img', { name: props.alt }))

    expect(screen.queryByRole('img', { name: props.alt })).not.toBeInTheDocument()
    expect(screen.getByText('Milho com braquiária')).toHaveAttribute('data-fallback')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('na foto: a braquiária')).not.toBeInTheDocument()
  })

  it('outra foto no mesmo lugar tenta carregar de novo', () => {
    const { rerender } = render(<PlantPhoto {...props} />)
    fireEvent.error(screen.getByRole('img', { name: props.alt }))

    rerender(<PlantPhoto {...props} src="/fotos/milho.jpg" alt="Lavoura de milho alto e verde" name="Milho sozinho" />)

    expect(screen.getByRole('img', { name: 'Lavoura de milho alto e verde' })).toHaveAttribute('src', '/fotos/milho.jpg')
  })

  it('ocupa a largura do contêiner (sem rolagem lateral) com a altura pedida pela tela', () => {
    const { container, rerender } = render(<PlantPhoto {...props} />)
    const figure = container.querySelector('figure')
    expect(figure).toHaveStyle({ height: '150px' })

    rerender(<PlantPhoto {...props} height={72} />)
    expect(figure).toHaveStyle({ height: '72px' })
  })
})
