import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { FieldMapProps } from '../design-system/components/FieldMap'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { WhereView, type WhereViewProps } from './WhereView'

// O mapa real (Leaflet) é testado no design system; aqui só importa o que a tela passa para ele.
vi.mock('../design-system/components/FieldMap', () => ({
  FieldMap: (props: FieldMapProps) => (
    <section aria-label={props.label}>
      <p>{props.hint}</p>
      <p>{props.legend}</p>
      <button type="button" onClick={props.onLegendAction}>
        {props.legendAction}
      </button>
      <button type="button" onClick={props.onFit}>
        {props.fitLabel}
      </button>
      <button type="button" onClick={() => props.onPick({ lat: -19.0, lon: -48.2 })}>
        tocar no mapa
      </button>
      {props.bounds && <output data-testid="area">{JSON.stringify(props.bounds)}</output>}
      {props.point && <output data-testid="alfinete">{JSON.stringify(props.point)}</output>}
    </section>
  ),
}))

const AREA = { min_lat: -19.9, max_lat: -18.4, min_lon: -49.0, max_lon: -47.5 }

function setup(overrides: Partial<WhereViewProps> = {}) {
  const props: WhereViewProps = {
    t: pt,
    point: null,
    demo: false,
    place: '',
    area: AREA,
    status: 'empty',
    canConfirm: false,
    gps: 'idle',
    view: { target: 'area', seq: 0 },
    listen: { supported: true, speaking: false, toggle: vi.fn() },
    other: {
      open: false,
      text: '',
      error: false,
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onChange: vi.fn(),
      onSubmit: vi.fn(),
    },
    areaInfo: { open: false, onOpen: vi.fn(), onClose: vi.fn(), onShowArea: vi.fn() },
    onPick: vi.fn(),
    onUseDemo: vi.fn(),
    onUseLocation: vi.fn(),
    onShowArea: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <WhereView {...props} />
    </MemoryRouter>,
  )
  return props
}

const marked: Partial<WhereViewProps> = {
  point: { lat: -18.95431, lon: -48.19934 },
  place: 'Fazenda Maria Dória, Uberlândia, Minas Gerais',
  status: 'marked',
  canConfirm: true,
}

/** Cartão do local: a região que o leitor de tela anuncia quando muda. */
const card = () =>
  screen.getByRole('region', { name: /Sua lavoura|Local escolhido|Fora da área|Your field|Chosen spot|Outside the area/ })

describe('WhereView: topo (tarefa 0053)', () => {
  it('Voltar para o início, título, a frase e o "Ouvir resumo"', async () => {
    const props = setup()

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })).toBeInTheDocument()
    expect(screen.getByText('Toque no mapa em cima da sua lavoura.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(props.listen.toggle).toHaveBeenCalled()
  })

  it('enquanto fala, o "Ouvir resumo" vira "Parar"; sem voz no navegador, não aparece', () => {
    setup({ listen: { supported: true, speaking: true, toggle: vi.fn() } })
    expect(screen.getByRole('button', { name: 'Parar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sem "Pergunta 1 de 2" e sem o que saiu da tela (busca, frase das coordenadas, frase longa do MVP)', () => {
    setup()

    expect(screen.queryByText(/Pergunta 1 de 2/)).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Buscar cidade/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Endereços: © OpenStreetMap/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Também dá para colar/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Nesta primeira versão/)).not.toBeInTheDocument()
    expect(screen.queryByText(/arraste o mapa/i)).not.toBeInTheDocument()
  })
})

describe('WhereView: mapa', () => {
  it('passa a área do MVP, a dica e a legenda ao mapa; "Saiba mais" abre o modal da área', async () => {
    const props = setup()

    const map = screen.getByRole('region', { name: 'Mapa. Toque para marcar a lavoura.' })
    expect(within(map).getByTestId('area')).toHaveTextContent('{"south":-19.9,"west":-49,"north":-18.4,"east":-47.5}')
    expect(within(map).getByText('Toque no mapa onde fica a lavoura')).toBeInTheDocument()
    expect(within(map).getByText('Área do MVP: Uberlândia e Uberaba')).toBeInTheDocument()

    await userEvent.click(within(map).getByRole('button', { name: 'Saiba mais' }))
    await userEvent.click(within(map).getByRole('button', { name: 'Ver a área inteira' }))
    await userEvent.click(within(map).getByRole('button', { name: 'tocar no mapa' }))

    expect(props.areaInfo.onOpen).toHaveBeenCalled()
    expect(props.onShowArea).toHaveBeenCalled()
    expect(props.onPick).toHaveBeenCalledWith({ lat: -19.0, lon: -48.2 })
  })

  it('com o ponto marcado, a dica muda para arrastar o alfinete', () => {
    setup(marked)

    expect(screen.getByText('Arraste o alfinete para ajustar')).toBeInTheDocument()
    expect(screen.getByTestId('alfinete')).toHaveTextContent('{"lat":-18.95431,"lon":-48.19934}')
  })
})

describe('WhereView: os 4 estados do cartão do local', () => {
  it('sem ponto: "Sua lavoura", o convite e o Confirmar desligado com o motivo', () => {
    setup()

    expect(card()).toHaveAttribute('aria-live', 'polite')
    expect(card()).toHaveTextContent('Sua lavoura')
    expect(within(card()).getByRole('heading', { name: 'Nenhum ponto marcado' })).toBeInTheDocument()
    expect(card()).toHaveTextContent('Toque no mapa, use onde você está agora ou a lavoura de demonstração.')
    expect(screen.getByRole('button', { name: 'Confirmar local' })).toBeDisabled()
    expect(screen.getAllByText('Marque a lavoura no mapa para continuar.').length).toBeGreaterThan(0)
  })

  it('marcado: "Local escolhido", o endereço aproximado, as coordenadas com 4 casas e o Confirmar ligado', async () => {
    const props = setup(marked)

    expect(card()).toHaveTextContent('Local escolhido')
    expect(within(card()).getByRole('heading', { name: 'Perto de Fazenda Maria Dória, Uberlândia, Minas Gerais' })).toBeInTheDocument()
    expect(card()).toHaveTextContent('-18.9543, -48.1993')

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar local' }))
    expect(props.onConfirm).toHaveBeenCalled()
  })

  it('marcado na lavoura de demonstração: o nome dela no lugar do endereço', () => {
    setup({ ...marked, point: { lat: -18.9543, lon: -48.1993 }, demo: true })

    expect(
      within(card()).getByRole('heading', { name: 'Lavoura de demonstração, perto de Uberlândia (MG)' }),
    ).toBeInTheDocument()
  })

  it('fora da área: "Fora da área", o aviso "Ainda não chegamos aí" e o Confirmar desligado', () => {
    setup({ ...marked, point: { lat: -17.78, lon: -50.92 }, place: 'Rio Verde (GO)', status: 'outside', canConfirm: false })

    expect(card()).toHaveTextContent('Fora da área')
    expect(within(card()).getByRole('heading', { name: 'Perto de Rio Verde (GO)' })).toBeInTheDocument()
    expect(card()).toHaveTextContent('-17.7800, -50.9200')
    expect(card()).toHaveTextContent('Ainda não chegamos aí')
    expect(card()).toHaveTextContent(
      'Por enquanto só temos dados da região de Uberlândia e Uberaba. Vamos ampliar para todo o Triângulo Mineiro.',
    )
    expect(screen.getByRole('button', { name: 'Confirmar local' })).toBeDisabled()
    expect(screen.getByText('Escolha um ponto dentro da linha tracejada.')).toBeInTheDocument()
  })

  it('erro do GPS: igual a "sem ponto", mais o aviso de que não deu para achar', () => {
    setup({ gps: 'error' })

    expect(card()).toHaveTextContent('Nenhum ponto marcado')
    expect(card()).toHaveTextContent('Não deu para achar onde você está. Toque no mapa ou use a lavoura de demonstração.')
    expect(screen.getByRole('button', { name: 'Confirmar local' })).toBeDisabled()
  })
})

describe('WhereView: atalhos', () => {
  it('"Usar onde estou agora", "Usar a lavoura de demonstração" e "Outras formas de marcar"', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Usar onde estou agora' }))
    await userEvent.click(screen.getByRole('button', { name: 'Usar a lavoura de demonstração Perto de Uberlândia (MG)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Outras formas de marcar' }))

    expect(props.onUseLocation).toHaveBeenCalled()
    expect(props.onUseDemo).toHaveBeenCalled()
    expect(props.other.onOpen).toHaveBeenCalled()
  })

  it('enquanto o GPS procura: "Procurando você…" com aria-busy', () => {
    setup({ gps: 'locating' })

    expect(screen.getByRole('button', { name: 'Procurando você…' })).toHaveAttribute('aria-busy', 'true')
  })
})

describe('WhereView: barra fixa do celular (estado + Confirmar)', () => {
  const barLine = () => document.querySelector('[data-bar-line]')

  it('mostra o estado numa linha curta em cada caso', () => {
    setup()
    expect(barLine()).toHaveTextContent('Marque a lavoura no mapa para continuar.')
  })

  it('com o ponto, o nome do local', () => {
    setup(marked)
    expect(barLine()).toHaveTextContent('Perto de Fazenda Maria Dória, Uberlândia, Minas Gerais')
  })

  it('fora da área, o aviso curto', () => {
    setup({ ...marked, status: 'outside', canConfirm: false })
    expect(barLine()).toHaveTextContent('Fora da área do MVP. Veja os detalhes abaixo.')
  })
})

describe('WhereView: modal "Outras formas de marcar"', () => {
  const open = (other: Partial<WhereViewProps['other']> = {}) =>
    setup({
      other: {
        open: true,
        text: '',
        error: false,
        onOpen: vi.fn(),
        onClose: vi.fn(),
        onChange: vi.fn(),
        onSubmit: vi.fn(),
        ...other,
      },
    })

  it('campo das coordenadas ou do link, com o exemplo embaixo, e "Usar este ponto"', async () => {
    const props = open()

    const dialog = screen.getByRole('dialog', { name: 'Outras formas de marcar' })
    expect(dialog).toHaveTextContent('Para quem já tem a localização da lavoura.')
    const field = within(dialog).getByRole('textbox', { name: 'Coordenadas ou link do Google Maps' })
    expect(field).toHaveAccessibleDescription(/Exemplos: -18.9543, -48.1993 ou um link copiado do Google Maps./)

    await userEvent.type(field, '-1')
    expect(props.other.onChange).toHaveBeenCalledWith('-')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar este ponto' }))
    expect(props.other.onSubmit).toHaveBeenCalled()
  })

  it('o que não deu para entender: "Não entendi" anunciado e o campo marcado como inválido', () => {
    open({ text: 'Uberaba', error: true })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não entendi. Cole a latitude e a longitude, ou um link do Google Maps.',
    )
    expect(screen.getByRole('textbox', { name: 'Coordenadas ou link do Google Maps' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('fecha com o X', async () => {
    const props = open()

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(props.other.onClose).toHaveBeenCalled()
  })
})

describe('WhereView: modal "Onde o app funciona"', () => {
  it('o texto do MVP, o quadro da linha tracejada e "Ver a área inteira"', async () => {
    const props = setup({ areaInfo: { open: true, onOpen: vi.fn(), onClose: vi.fn(), onShowArea: vi.fn() } })

    const dialog = screen.getByRole('dialog', { name: 'Onde o app funciona' })
    expect(dialog).toHaveTextContent(
      'Nesta primeira versão (MVP), o app funciona na região de Uberlândia e Uberaba (MG): é lá que os dados de satélite já estão prontos. Vamos ampliar para todo o Triângulo Mineiro.',
    )
    expect(dialog).toHaveTextContent('A linha tracejada no mapa mostra essa área.')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Ver a área inteira' }))
    expect(props.areaInfo.onShowArea).toHaveBeenCalled()
  })
})

describe('WhereView em inglês', () => {
  it('textos da tela e do cartão em inglês', () => {
    setup({ t: en, ...marked, demo: true })

    expect(screen.getByRole('heading', { level: 1, name: 'Where is your field?' })).toBeInTheDocument()
    expect(screen.getByText('Tap the map on top of your field.')).toBeInTheDocument()
    expect(card()).toHaveTextContent('Chosen spot')
    expect(within(card()).getByRole('heading', { name: 'Demo field, near Uberlândia (MG)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use my current location' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use the demo field Near Uberlândia (MG)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Other ways to mark' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm location' })).toBeEnabled()
    expect(screen.getByText('MVP area: Uberlândia and Uberaba')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument()
  })

  it('sem ponto e fora da área, em inglês', () => {
    setup({ t: en, gps: 'error' })

    expect(card()).toHaveTextContent('Your field')
    expect(card()).toHaveTextContent('No spot marked yet')
    expect(card()).toHaveTextContent('We could not find your location. Tap the map or use the demo field.')
  })
})
