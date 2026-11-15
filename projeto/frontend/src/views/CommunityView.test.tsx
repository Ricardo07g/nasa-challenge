import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildCommunity } from '../repositories/mocks/fixtures'
import { createMockRegionRepository } from '../repositories/mocks/mockRepositories'
import { regionPoints, regionSummary } from '../services/communityService'
import { CommunityView, type CommunityViewProps } from './CommunityView'

const center = { lat: -18.9543, lon: -48.1993 }
const region = regionSummary(await createMockRegionRepository(0).get(center, 'pt'))

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
    region,
    regionStatus: 'ready',
    onRegionRetry: vi.fn(),
    regionRadius: 30,
    regionDistance: null,
    history: { idle: 5, known: 9, uncertain: 1 },
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
  it('no fim da tela, um link para o Guia', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Guia: dúvidas e respostas curtas' })).toHaveAttribute('href', '/guia')
  })

  it('região pelo satélite: o último ano em destaque, a comparação e o gráfico ano a ano (P3)', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Na sua região' })).toBeInTheDocument()
    expect(screen.getByText('Até 30 km da sua lavoura · visto pelo satélite')).toBeInTheDocument()
    expect(screen.getByText('Em 2025, 62% da área de soja ficou parada depois da colheita.')).toBeInTheDocument()
    expect(
      screen.getByText('Sua área: parada em 5 de 9 anos (1 sem certeza). Na região, em média 65% da área fica parada.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '% da área de soja parada depois da colheita, ano a ano.' })).toHaveTextContent(
      '62%',
    )
    expect(screen.getByText(/Em 9% da área o satélite não conseguiu dizer/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('círculo centrado longe da lavoura: o subtítulo diz o raio e a que distância fica o centro', () => {
    setup({ regionDistance: 12.3 })

    expect(
      screen.getByText('Raio de 30 km em volta de um ponto a 12,3 km da sua lavoura · visto pelo satélite'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Até 30 km da sua lavoura · visto pelo satélite')).not.toBeInTheDocument()
  })

  it('o subtítulo e as frases da região em inglês', () => {
    setup({ t: en, community: buildCommunity('en'), regionDistance: 12.3 })

    expect(screen.getByText('30 km radius around a point 12.3 km from your field · seen by satellite')).toBeInTheDocument()
    expect(screen.getByText('In 2025, 62% of the soybean area was left idle after harvest.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '% of the soybean area left idle after harvest, year by year.' })).toBeInTheDocument()
  })

  it('ponto fora das regiões medidas: o bloco da região não aparece (sem aviso, sem erro)', () => {
    setup({ region: null, regionStatus: 'outside', regionRadius: null })

    expect(screen.queryByRole('region', { name: 'Área parada na região, pelo satélite' })).not.toBeInTheDocument()
    expect(screen.queryByText(/ainda não mediu/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
    expect(screen.queryByText(/visto pelo satélite/)).not.toBeInTheDocument()
    // a comunidade continua na tela
    expect(screen.getByRole('heading', { name: 'Na sua região' })).toBeInTheDocument()
  })

  it('ponto fora das regiões medidas, em inglês: também sem o bloco', () => {
    setup({ t: en, community: buildCommunity('en'), region: null, regionStatus: 'outside', regionRadius: null })

    expect(screen.queryByRole('region', { name: 'Idle cropland in the region, by satellite' })).not.toBeInTheDocument()
    expect(screen.queryByText(/has not measured/i)).not.toBeInTheDocument()
  })

  it('porcentagens com casa decimal saem com vírgula em português e com ponto em inglês', () => {
    const decimal = { last: { ano: 2025, pct: 0.8 }, average: 1.5, uncertain: 2.3, bars: [{ ano: 2025, pct: 0.8 }] }
    setup({ region: decimal, history: null })

    expect(screen.getByText('Em 2025, 0,8% da área de soja ficou parada depois da colheita.')).toBeInTheDocument()
    expect(screen.getByText(/Na região, em média 1,5% da área fica parada/)).toBeInTheDocument()
    expect(screen.getByText(/Em 2,3% da área o satélite não conseguiu dizer/)).toBeInTheDocument()
    expect(screen.getByText('0,8%')).toBeInTheDocument()
    expect(screen.queryByText(/0\.8%/)).not.toBeInTheDocument()
    cleanup()

    setup({ t: en, community: buildCommunity('en'), region: decimal, history: null })
    expect(screen.getByText('In 2025, 0.8% of the soybean area was left idle after harvest.')).toBeInTheDocument()
  })

  it('a comunidade vem embaixo, marcada como ilustrativa, com quantos participam', () => {
    setup()

    const community = screen.getByRole('region', { name: 'O que os vizinhos contam' })
    expect(community).toHaveTextContent('Valores ilustrativos')
    expect(community).toHaveTextContent('Até 30 km de Uberlândia · 18 produtores participando')
  })

  it('sem ano sem certeza na lavoura, a comparação fica sem o parêntese', () => {
    setup({ history: { idle: 5, known: 10, uncertain: 0 } })

    expect(screen.getByText('Sua área: parada em 5 de 10 anos. Na região, em média 65% da área fica parada.')).toBeInTheDocument()
  })

  it('sem a região na API, o bloco do satélite não aparece (decisão D2) e a comunidade continua', () => {
    setup({ region: null, regionStatus: 'not-connected', regionRadius: null })

    expect(screen.queryByText(/da área de soja ficou parada/)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Área parada na região, pelo satélite' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'O que os vizinhos contam' })).toBeInTheDocument()
  })

  it('se a região falhar por outro motivo, dá para tentar de novo', async () => {
    const props = setup({ region: null, regionStatus: 'error', regionRadius: null, status: 'not-connected', community: null })

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRegionRetry).toHaveBeenCalled()
  })

  it('comunidade ainda não conectada (API real): os blocos não aparecem, sem vizinho simulado (decisão D2)', () => {
    setup({ status: 'not-connected', community: null, points: [] })

    expect(screen.queryByRole('region', { name: 'O que os vizinhos contam' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Choveu aqui' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(screen.queryByText('Valores ilustrativos')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Contar como foi a minha' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar a chuva de hoje' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Mapa da região com pluviômetros e o que cada vizinho plantou' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/mm · satélite/)).not.toBeInTheDocument()
  })

  it('comunidade e região ainda não conectadas, em inglês: nada de "Not connected yet"', () => {
    setup({ t: en, status: 'not-connected', community: null, region: null, regionStatus: 'not-connected', regionRadius: null })

    expect(screen.queryByRole('region', { name: 'Idle cropland in the region, by satellite' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'It rained here' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Not connected yet/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
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
          region={null}
          regionStatus="loading"
          onRegionRetry={vi.fn()}
          regionRadius={null}
          regionDistance={null}
          history={null}
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

    expect(screen.getByRole('heading', { level: 1, name: 'In your region' })).toBeInTheDocument()
  })
})
