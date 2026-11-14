import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChipGroup, RadioCard } from './Choice'

const options = [
  { value: 'chuva', label: 'Chuva' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'terra', label: 'Terra' },
] as const

describe('ChipGroup', () => {
  it('marca a opção escolhida com aria-pressed', () => {
    render(<ChipGroup label="Ordenar" options={options} value="dinheiro" onChange={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Ordenar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dinheiro' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Chuva' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('avisa a opção tocada', async () => {
    const onChange = vi.fn()
    render(<ChipGroup label="Ordenar" options={options} value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Terra' }))

    expect(onChange).toHaveBeenCalledWith('terra')
  })

  it('tocar na escolhida desmarca quando permitido', async () => {
    const onChange = vi.fn()
    render(
      <ChipGroup label="Ordenar" options={options} value="chuva" onChange={onChange} allowDeselect />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Chuva' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('tocar na escolhida não faz nada quando não pode desmarcar', async () => {
    const onChange = vi.fn()
    render(<ChipGroup label="Cenário" options={options} value="chuva" onChange={onChange} tone="blue" />)

    await userEvent.click(screen.getByRole('button', { name: 'Chuva' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'Cenário' })).toHaveAttribute('data-tone', 'blue')
  })
})

describe('RadioCard', () => {
  it('mostra título, detalhe e se está escolhido', async () => {
    const onSelect = vi.fn()
    render(<RadioCard title="Meio de fevereiro" sub="dia 11 a 20" selected onSelect={onSelect} />)

    const card = screen.getByRole('button', { name: /Meio de fevereiro/ })
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(card).toHaveTextContent('dia 11 a 20')
    await userEvent.click(card)
    expect(onSelect).toHaveBeenCalled()
  })
})
