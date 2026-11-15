import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { LocationOption } from '../models/place'
import { WhereView, type WhereViewProps } from './WhereView'

// O mapa real (Leaflet) é testado no design system; aqui só importa o que a tela passa para ele.
vi.mock('../design-system/components/MapPicker', () => ({
  MapPicker: (props: { label: string; placeLabel?: string; bounds?: object; boundsLabel?: string; boundsAction?: string }) => (
    <section aria-label={props.label}>
      {props.placeLabel}
      {props.bounds && <span>{props.boundsLabel}</span>}
      {props.bounds && <button type="button">{props.boundsAction}</button>}
    </section>
  ),
}))

const AREA = { min_lat: -19.9, max_lat: -18.4, min_lon: -49.0, max_lon: -47.5 }

const UBERABA: LocationOption = {
  kind: 'place',
  id: 'R1',
  label: 'Uberaba',
  detail: 'Minas Gerais',
  point: { lat: -19.748, lon: -47.932 },
}

function setup(overrides: Partial<WhereViewProps> = {}) {
  const props: WhereViewProps = {
    t: pt,
    center: { lat: -18.92, lon: -48.28 },
    place: 'Fazenda Maria Dória, Uberlândia, Minas Gerais',
    area: AREA,
    outside: false,
    canConfirm: true,
    locating: false,
    locationError: false,
    query: '',
    options: [],
    searchStatus: 'idle',
    notice: null,
    onMove: vi.fn(),
    onUseLocation: vi.fn(),
    onConfirm: vi.fn(),
    onQueryChange: vi.fn(),
    onSelectOption: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <WhereView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('WhereView (tela "Onde fica a lavoura")', () => {
  it('mostra a pergunta 1 de 2, o mapa com o endereço aproximado perto do alfinete e o limite da área', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pergunta 1 de 2' })).toBeInTheDocument()
    const map = screen.getByRole('region', { name: /Mapa para marcar a lavoura/ })
    expect(map).toHaveTextContent('Perto de Fazenda Maria Dória, Uberlândia, Minas Gerais')
    expect(map).toHaveTextContent('Linha tracejada: área com dados')
    expect(screen.getByRole('button', { name: 'Ver a área inteira' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/')
  })

  it('mostra no painel o lugar e as coordenadas do ponto escolhido', () => {
    setup()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Perto de Fazenda Maria Dória, Uberlândia, Minas Gerais' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Local escolhido: -18.9200, -48.2800')).toBeInTheDocument()
  })

  it('campo de busca com a dica das coordenadas e do link, e o crédito do OpenStreetMap', async () => {
    const props = setup()

    const input = screen.getByRole('combobox', { name: 'Buscar cidade, estrada ou endereço' })
    expect(input).toHaveAccessibleDescription(/coordenadas, como -18\.9543, -48\.1993, ou um link do Google Maps/)
    expect(screen.getByRole('link', { name: 'Endereços: © OpenStreetMap' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    )

    await userEvent.type(input, 'U')
    expect(props.onQueryChange).toHaveBeenCalledWith('U')
  })

  it('lista os lugares achados e escolhe um', async () => {
    const props = setup({ query: 'uberaba', options: [UBERABA], searchStatus: 'ready' })

    expect(screen.getByRole('status')).toHaveTextContent('Achamos 1 lugar.')
    await userEvent.click(screen.getByRole('option', { name: /Uberaba/ }))

    expect(props.onSelectOption).toHaveBeenCalledWith(UBERABA)
  })

  it('coordenadas e link colados viram a opção "ir para o ponto", com as coordenadas', () => {
    setup({
      query: '-19.5, -48',
      options: [{ kind: 'point', id: 'ponto-colado', source: 'coordinates', point: { lat: -19.5, lon: -48 } }],
    })
    expect(screen.getByRole('option', { name: /Ir para as coordenadas/ })).toHaveTextContent('-19.5000, -48.0000')
  })

  it('link colado: "Ir para o ponto do link"', () => {
    setup({ options: [{ kind: 'point', id: 'ponto-colado', source: 'link', point: { lat: -19.2, lon: -48.3 } }] })

    expect(screen.getByRole('option', { name: /Ir para o ponto do link/ })).toBeInTheDocument()
  })

  it.each([
    ['loading', [], 'Procurando…'],
    ['ready', [], 'Não achamos esse lugar.'],
    ['ready', [UBERABA, { ...UBERABA, id: 'R2' }], 'Achamos 2 lugares.'],
    ['error', [], 'A busca não respondeu agora.'],
  ] as const)('situação da busca %s', (searchStatus, options, text) => {
    setup({ searchStatus, options: [...options] })

    expect(screen.getByRole('status')).toHaveTextContent(text)
  })

  it.each([
    ['short-link', 'Esse é um link curto'],
    ['link-without-point', 'Não achamos as coordenadas nesse link.'],
    ['invalid-coordinates', 'Essas coordenadas não existem.'],
  ] as const)('aviso do que foi colado: %s', (notice, text) => {
    setup({ notice })

    expect(screen.getByRole('alert')).toHaveTextContent(text)
  })

  it('usa o GPS e confirma o local no botão com o alfinete', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Usar onde estou agora' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar local' }))

    expect(props.onUseLocation).toHaveBeenCalled()
    expect(props.onConfirm).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'É aqui' })).not.toBeInTheDocument()
  })

  it('enquanto procura e quando o GPS falha', () => {
    setup({ locating: true, locationError: true })

    expect(screen.getByRole('button', { name: 'Procurando onde você está…' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos achar onde você está.')
  })

  it('fora da área piloto: o aviso em texto, a fazenda de exemplo e o botão bloqueado', () => {
    setup({ outside: true, canConfirm: false })

    expect(screen.getByRole('heading', { name: 'Ainda não chegamos aí' })).toBeInTheDocument()
    expect(screen.getByText('Por enquanto só temos dados da região de Uberlândia e Uberaba.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
    expect(screen.getByRole('button', { name: 'Confirmar local' })).toBeDisabled()
  })

  it('sem a área ainda, não desenha o limite', () => {
    setup({ area: null, canConfirm: false })

    expect(screen.queryByText('Linha tracejada: área com dados')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar local' })).toBeDisabled()
  })

  it('em inglês', () => {
    setup({ t: en, outside: true, canConfirm: false })

    expect(screen.getByRole('combobox', { name: 'Search for a city, road or address' })).toBeInTheDocument()
    expect(screen.getByText('For now we only have data for the Uberlândia and Uberaba region.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm location' })).toBeDisabled()
  })
})
