import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChipGroup, DateField, RadioCard } from './Choice'

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

describe('RadioCard que abre mais campos', () => {
  it('avisa se o que ela abre está aberto', () => {
    render(<RadioCard title="Colocar a data exata" sub="Se você já sabe o dia" selected={false} expanded onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Colocar a data exata/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('sem esse uso, não tem aria-expanded', () => {
    render(<RadioCard title="Meio de fevereiro" sub="dia 11 a 20" selected onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Meio de fevereiro/ })).not.toHaveAttribute('aria-expanded')
  })
})

describe('DateField', () => {
  it('campo de data com rótulo, limites e aviso', async () => {
    const onChange = vi.fn()
    render(
      <DateField
        label="Dia da colheita"
        value=""
        min="2027-01-15"
        max="2027-03-31"
        status="Escolha um dia dentro da época de colheita."
        onChange={onChange}
      />,
    )

    const input = screen.getByLabelText('Dia da colheita')
    expect(input).toHaveAttribute('type', 'date')
    expect(input).toHaveAttribute('min', '2027-01-15')
    expect(input).toHaveAttribute('max', '2027-03-31')
    expect(screen.getByRole('status')).toHaveTextContent('Escolha um dia dentro da época de colheita.')

    await userEvent.type(input, '2027-02-18')
    expect(onChange).toHaveBeenLastCalledWith('2027-02-18')
  })
})
