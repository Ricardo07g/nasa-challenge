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

  it('não mostra nada da comunidade, que está "em breve" (pacote 3): nem relatos, nem vizinhos, nem "Contar"', () => {
    setup()

    expect(screen.queryByRole('button', { name: 'Contar como foi a minha' })).not.toBeInTheDocument()
    expect(screen.queryByText(/vizinhos gostaram/)).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /cada vizinho plantou/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Pluviômetro|satélite 24 mm/)).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/vizinh|comunidade/i)
  })

  it('mostra o aviso do modo de demonstração', () => {
    setup()

    expect(screen.getByRole('note')).toHaveTextContent('Modo de demonstração: dados de exemplo, não são da NASA')
  })

  it('mostra as fotos das plantas (PlantPhoto) com o crédito, a de 2 imagens e o bloco de quando a foto não carrega', () => {
    setup()

    const section = screen.getByRole('region', { name: 'Fotos das plantas' })
    for (const crop of PLANT_PHOTO_CROPS) {
      for (const image of PLANT_PHOTOS[crop].images) {
        expect(within(section).getAllByRole('link', { name: newTabName(image.author) })[0]).toHaveAttribute('href', image.page)
      }
    }
    const sorghum = PLANT_PHOTOS.sorgo.images[0]
    expect(within(section).getByRole('img', { name: sorghum.alt.pt })).toHaveAttribute('src', sorghum.src)
    // Milho com braquiária: as 2 imagens num bloco só, com o nome da cultura, sem a legenda antiga.
    const pair = within(section).getByRole('img', { name: 'Milho com braquiária' })
    expect([...pair.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual(['/fotos/milho.jpg', '/fotos/braquiaria.jpg'])
    expect(within(section).queryByText('na foto: a braquiária')).not.toBeInTheDocument()

    // Exemplo do bloco colorido: uma foto que não existe.
    expect(within(section).getByText('Se a foto não carregar')).toBeInTheDocument()
    const millet = PLANT_PHOTOS.milheto.images[0]
    const broken = within(section)
      .getAllByRole('img', { name: millet.alt.pt })
      .find((img) => img.getAttribute('src') !== millet.src)
    expect(broken).toBeDefined()
    fireEvent.error(broken as HTMLElement)
    expect(within(section).getByText('Milheto')).toHaveAttribute('data-fallback')
  })

  it('as fotos seguem o idioma', () => {
    setup('en')

    const section = screen.getByRole('region', { name: 'Plant photos' })
    expect(within(section).getAllByRole('img', { name: PLANT_PHOTOS.sorgo.images[0].alt.en })).toHaveLength(1)
    expect(within(section).getByRole('img', { name: 'Corn with brachiaria' })).toBeInTheDocument()
    expect(within(section).queryByText('photo shows the brachiaria')).not.toBeInTheDocument()
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
