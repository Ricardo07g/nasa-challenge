import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PLANT_PHOTO_CROPS, PLANT_PHOTOS } from '../content/plantPhotos'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { DesignSystemView } from './DesignSystemView'

function setup(lang: 'pt' | 'en' = 'pt') {
  render(
    <MemoryRouter>
      <DesignSystemView
        t={lang === 'pt' ? pt : en}
        lang={lang}
        apiMode="http"
        backend="ok"
        cropOptions={[]}
        cropOptionsError={false}
      />
    </MemoryRouter>,
  )
}

describe('DesignSystemView (/design-system)', () => {
  it('não tem mais o estado "Ainda não conectado" (decisão D2) nem valor em reais (tarefa 0040)', () => {
    setup()

    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('R$')
    expect(screen.getByRole('button', { name: 'Renda' })).toBeInTheDocument()
    expect(screen.getByText('Dá grão para vender')).toBeInTheDocument()
  })

  it('mostra o aviso do modo de demonstração', () => {
    setup()

    expect(screen.getByRole('note')).toHaveTextContent('Modo de demonstração: dados de exemplo, não são da NASA')
  })

  it('mostra as fotos das plantas (PlantPhoto) com o crédito, a legenda e o bloco de quando a foto não carrega', () => {
    setup()

    const section = screen.getByRole('region', { name: 'Fotos das plantas' })
    for (const crop of PLANT_PHOTO_CROPS) {
      const photo = PLANT_PHOTOS[crop]
      expect(within(section).getAllByRole('img', { name: photo.alt.pt })[0]).toHaveAttribute('src', photo.src)
      expect(within(section).getAllByRole('link', { name: `${photo.author} (abre em nova aba)` })[0]).toHaveAttribute(
        'href',
        photo.page,
      )
    }
    expect(within(section).getByText('na foto: a braquiária')).toBeInTheDocument()

    // Exemplo do bloco colorido: uma foto que não existe.
    expect(within(section).getByText('Se a foto não carregar')).toBeInTheDocument()
    const broken = within(section)
      .getAllByRole('img', { name: PLANT_PHOTOS.milheto.alt.pt })
      .find((img) => img.getAttribute('src') !== PLANT_PHOTOS.milheto.src)
    expect(broken).toBeDefined()
    fireEvent.error(broken as HTMLElement)
    expect(within(section).getByText('Milheto')).toHaveAttribute('data-fallback')
  })

  it('as fotos seguem o idioma', () => {
    setup('en')

    const section = screen.getByRole('region', { name: 'Plant photos' })
    expect(within(section).getAllByRole('img', { name: PLANT_PHOTOS.sorgo.alt.en })).toHaveLength(1)
    expect(within(section).getByText('photo shows the brachiaria')).toBeInTheDocument()
    expect(within(section).getByText('If the photo does not load')).toBeInTheDocument()
  })
})
