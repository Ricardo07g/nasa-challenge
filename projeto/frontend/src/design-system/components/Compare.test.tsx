import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CompareTable, CropPicker } from './Compare'

describe('CropPicker (chips das culturas com a imagem, tarefa 0045)', () => {
  const items = [
    { value: 'sorgo', label: 'Sorgo', selected: true, media: <svg data-testid="planta" />, badge: <span>Sede: média</span> },
    { value: 'milheto', label: 'Milheto', selected: false },
    { value: 'milho_safrinha', label: 'Milho sozinho', selected: false, disabled: true, note: 'Passou do prazo (28 de fevereiro)' },
  ]

  it('um botão por cultura, com a escolha em aria-pressed, a imagem e o selo', () => {
    render(<CropPicker label="Culturas para comparar" items={items} onToggle={() => {}} />)

    const group = screen.getByRole('group', { name: 'Culturas para comparar' })
    expect(within(group).getByRole('button', { name: /Sorgo/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: /Milheto/ })).toHaveAttribute('aria-pressed', 'false')
    expect(within(group).getByTestId('planta')).toBeInTheDocument()
    expect(within(group).getByText('Sede: média')).toBeInTheDocument()
  })

  it('a cultura fora da janela fica desligada, com o motivo escrito', async () => {
    const onToggle = vi.fn()
    render(<CropPicker label="Culturas" items={items} onToggle={onToggle} />)

    const late = screen.getByRole('button', { name: /Milho sozinho/ })
    expect(late).toBeDisabled()
    expect(late).toHaveTextContent('Passou do prazo (28 de fevereiro)')
    await userEvent.click(late)
    await userEvent.click(screen.getByRole('button', { name: /Milheto/ }))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith('milheto')
  })
})

describe('CompareTable (colunas lado a lado, tarefa 0045)', () => {
  it('uma coluna por cultura e as mesmas linhas para todas, com o rótulo em texto', () => {
    render(
      <CompareTable
        caption="Lado a lado: Sorgo e Milheto"
        columns={[
          { key: 'sorgo', title: 'Sorgo', media: <svg data-testid="sorgo" /> },
          { key: 'milheto', title: 'Milheto' },
        ]}
        rows={[
          { label: 'Deu certo', cells: ['15 de 20 anos', '19 de 20 anos'] },
          { label: 'Prazo para plantar', cells: ['Até 20 de março', 'Até 15 de março'] },
        ]}
      />,
    )

    const table = screen.getByRole('table', { name: 'Lado a lado: Sorgo e Milheto' })
    expect(within(table).getByRole('columnheader', { name: 'Sorgo' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Milheto' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Deu certo' })).toBeInTheDocument()
    const cells = within(table).getAllByRole('cell').map((cell) => cell.textContent)
    expect(cells).toEqual(['15 de 20 anos', '19 de 20 anos', 'Até 20 de março', 'Até 15 de março'])
  })
})
