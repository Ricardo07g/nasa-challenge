import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { pt } from '../i18n/messages.pt'
import { WhereView, type WhereViewProps } from './WhereView'

// O mapa real (Leaflet) é testado no design system; aqui só importa o que a tela faz com ele.
vi.mock('../design-system/components/MapPicker', () => ({
  MapPicker: ({ label, placeLabel }: { label: string; placeLabel?: string }) => (
    <section aria-label={label}>{placeLabel}</section>
  ),
}))

function setup(overrides: Partial<WhereViewProps> = {}) {
  const props: WhereViewProps = {
    t: pt,
    center: { lat: -18.92, lon: -48.28 },
    place: 'Uberlândia (MG)',
    outside: false,
    locating: false,
    locationError: false,
    onMove: vi.fn(),
    onUseLocation: vi.fn(),
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

describe('WhereView (tela 2)', () => {
  it('mostra a pergunta 1 de 2, o mapa e o lugar', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pergunta 1 de 2' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Mapa para marcar a lavoura/ })).toHaveTextContent(
      'Perto de Uberlândia (MG)',
    )
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/')
  })

  it('usa o GPS e confirma o ponto', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Usar onde estou agora' }))
    await userEvent.click(screen.getByRole('button', { name: 'É aqui' }))

    expect(props.onUseLocation).toHaveBeenCalled()
    expect(props.onConfirm).toHaveBeenCalled()
  })

  it('enquanto procura e quando o GPS falha', () => {
    setup({ locating: true, locationError: true })

    expect(screen.getByRole('button', { name: 'Procurando onde você está…' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos achar onde você está.')
  })

  it('fora da área preparada, oferece a fazenda de exemplo e não deixa confirmar', () => {
    setup({ outside: true })

    expect(screen.getByRole('heading', { name: 'Ainda não chegamos aí' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
    expect(screen.getByRole('button', { name: 'É aqui' })).toBeDisabled()
  })
})
