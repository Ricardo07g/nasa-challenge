import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildCommunity } from '../repositories/mocks/fixtures'
import { regionPoints } from '../services/communityService'
import { CommunityView, type CommunityViewProps } from './CommunityView'

const center = { lat: -18.9543, lon: -48.1993 }

function setup(overrides: Partial<CommunityViewProps> = {}) {
  const props: CommunityViewProps = {
    t: pt,
    backTo: '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    status: 'ready',
    onRetry: vi.fn(),
    community: buildCommunity('pt'),
    center,
    points: regionPoints(center),
    demo: null,
    onDemo: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <CommunityView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('CommunityView (tela 8)', () => {
  it('mostra que é simulada, o título e quantos participam', () => {
    setup()

    expect(screen.getByText('Comunidade simulada')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Perto de você' })).toBeInTheDocument()
    expect(screen.getByText('Até 30 km de Uberlândia · 18 produtores participando')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('o que os vizinhos plantaram: uma linha por opção, com as bolinhas', () => {
    setup()

    const neighbors = screen.getByRole('region', { name: 'O que os vizinhos plantaram depois da soja em 2026' })
    expect(within(neighbors).getByText('Milho safrinha')).toBeInTheDocument()
    expect(within(neighbors).getByText('3 de 6 gostaram')).toBeInTheDocument()
    expect(within(neighbors).getByText('1 de 1 gostou')).toBeInTheDocument()
    expect(within(neighbors).getAllByRole('img')).toHaveLength(5)
  })

  it('mapa da região e "Choveu aqui" com o pluviômetro ao lado do satélite', () => {
    setup()

    expect(
      screen.getByRole('region', { name: 'Mapa da região com pluviômetros e o que cada vizinho plantou' }),
    ).toBeInTheDocument()
    const rain = screen.getByRole('region', { name: 'Choveu aqui' })
    expect(rain).toHaveTextContent('A 6 km, ao norte')
    expect(rain).toHaveTextContent('32 mm · satélite 24 mm')
    expect(screen.getByText(/nunca a posição exata das fazendas/)).toBeInTheDocument()
  })

  it('os botões avisam o controller', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Contar como foi a minha' }))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar a chuva de hoje' }))

    expect(props.onDemo).toHaveBeenNthCalledWith(1, 'tell')
    expect(props.onDemo).toHaveBeenNthCalledWith(2, 'rain')
  })

  it('depois de tocar, avisa que é só demonstração', () => {
    setup({ demo: 'rain' })

    expect(within(screen.getByRole('region', { name: 'Choveu aqui' })).getByRole('status')).toHaveTextContent(
      'Esta é uma demonstração. Nenhum dado será enviado ou guardado.',
    )
  })

  it('enquanto carrega e quando dá erro', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <CommunityView
          t={pt}
          backTo="/"
          status="loading"
          onRetry={vi.fn()}
          community={null}
          center={center}
          points={[]}
          demo={null}
          onDemo={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    unmount()

    const props = setup({ status: 'error', community: null })
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetry).toHaveBeenCalled()
  })

  it('em inglês', () => {
    setup({ t: en, community: buildCommunity('en') })

    expect(screen.getByRole('heading', { level: 1, name: 'Near you' })).toBeInTheDocument()
  })
})
