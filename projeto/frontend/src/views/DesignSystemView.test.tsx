import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { PLANT_PHOTO_CROPS, PLANT_PHOTOS } from '../content/plantPhotos'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { newTabName } from '../test/newTabName'
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
      expect(within(section).getAllByRole('link', { name: newTabName(photo.author) })[0]).toHaveAttribute(
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

describe('DesignSystemView: seção "Pacote 2" (peças compartilhadas)', () => {
  it('mostra o Voltar, o "Saiba mais" do Guia, o aviso das safras, o formulário e o botão do modal grande', () => {
    const pacote2 = {
      answers: {},
      onAnswer: vi.fn(),
      current: { choice: undefined, onChoose: vi.fn(), harvestDate: '2027-03-03', changeDateTo: '/design-system' },
      modal: null,
      openLarge: vi.fn(),
      openSeasons: vi.fn(),
      closeModal: vi.fn(),
    }
    render(
      <MemoryRouter>
        <DesignSystemView t={pt} lang="pt" apiMode="http" backend="ok" cropOptions={[]} cropOptionsError={false} pacote2={pacote2} />
      </MemoryRouter>,
    )

    const section = screen.getByRole('region', { name: 'Pacote 2: peças compartilhadas' })
    expect(within(section).getByRole('link', { name: 'Voltar' })).toHaveAttribute('data-back-button')
    expect(within(section).getByRole('link', { name: 'Saiba mais: rotação de culturas (abre em nova aba)' })).toHaveAttribute('target', '_blank')
    expect(within(section).getByRole('button', { name: 'Preencher agora' })).toBeInTheDocument()
    expect(within(section).getByRole('group', { name: 'Soja na safra 2023/24' })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Abrir o modal grande' })).toBeInTheDocument()
  })
})
