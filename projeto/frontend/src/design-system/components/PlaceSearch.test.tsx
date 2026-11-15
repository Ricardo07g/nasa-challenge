import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlaceSearch, type PlaceSearchProps } from './PlaceSearch'

const OPTIONS = [
  { id: 'R1', label: 'Uberaba', detail: 'Minas Gerais' },
  { id: 'R2', label: 'Uberlândia', detail: 'Minas Gerais' },
]

function setup(overrides: Partial<PlaceSearchProps> = {}) {
  const props: PlaceSearchProps = {
    label: 'Buscar cidade, estrada ou endereço',
    hint: 'Também dá para colar as coordenadas.',
    listLabel: 'Lugares encontrados',
    value: 'uber',
    onChange: vi.fn(),
    options: OPTIONS,
    onSelect: vi.fn(),
    status: null,
    notice: null,
    attribution: { text: 'Endereços: © OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
    ...overrides,
  }
  render(<PlaceSearch {...props} />)
  return props
}

describe('PlaceSearch (campo de busca com autocompletar)', () => {
  it('campo com rótulo visível, dica e a atribuição do OpenStreetMap', () => {
    setup({ options: [] })

    const input = screen.getByRole('combobox', { name: 'Buscar cidade, estrada ou endereço' })
    expect(input).toHaveAccessibleDescription(/Também dá para colar as coordenadas/)
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Endereços: © OpenStreetMap' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    )
  })

  it('digitar avisa quem controla o campo', async () => {
    const props = setup({ value: '', options: [] })

    await userEvent.type(screen.getByRole('combobox'), 'U')

    expect(props.onChange).toHaveBeenCalledWith('U')
  })

  it('mostra a lista de lugares e escolhe com o toque', async () => {
    const props = setup()

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('listbox', { name: 'Lugares encontrados' })
    expect(list).toHaveTextContent('Uberaba')
    expect(list).toHaveTextContent('Minas Gerais')

    await userEvent.click(screen.getByRole('option', { name: /Uberlândia/ }))

    expect(props.onSelect).toHaveBeenCalledWith('R2')
  })

  it('setas andam pela lista e Enter escolhe a opção marcada', async () => {
    const props = setup()
    const input = screen.getByRole('combobox')
    await userEvent.click(input)

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /Uberaba/ })).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Uberaba/ }).id)

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}')
    expect(screen.getByRole('option', { name: /Uberlândia/ })).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{Enter}')
    expect(props.onSelect).toHaveBeenCalledWith('R2')
  })

  it('Enter sem nada marcado escolhe a primeira opção', async () => {
    const props = setup()

    await userEvent.type(screen.getByRole('combobox'), '{Enter}')

    expect(props.onSelect).toHaveBeenCalledWith('R1')
  })

  it('Esc fecha a lista', async () => {
    setup()
    await userEvent.click(screen.getByRole('combobox'))

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
  })

  it('situação da busca (lida pelo leitor de tela) e aviso', () => {
    setup({ options: [], status: 'Procurando…', notice: 'Esse link é curto.' })

    expect(screen.getByRole('status')).toHaveTextContent('Procurando…')
    expect(screen.getByRole('alert')).toHaveTextContent('Esse link é curto.')
  })
})
