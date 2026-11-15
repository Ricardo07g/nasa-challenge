import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChipGroup, DateField, MeasureField, NumberStepper, RadioCard, SelectField } from './Choice'

const options = [
  { value: 'chuva', label: 'Chuva' },
  { value: 'renda', label: 'Renda' },
  { value: 'terra', label: 'Terra' },
] as const

describe('ChipGroup', () => {
  it('marca a opção escolhida com aria-pressed', () => {
    render(<ChipGroup label="Ordenar" options={options} value="renda" onChange={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Ordenar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Renda' })).toHaveAttribute('aria-pressed', 'true')
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

describe('NumberStepper', () => {
  it('campo numérico com rótulo, unidade e botões de menos e mais', async () => {
    const onChange = vi.fn()
    const onStep = vi.fn()
    const onCommit = vi.fn()
    render(
      <NumberStepper
        label="Quantos hectares quer testar?"
        value="50"
        unit="ha"
        step={10}
        decreaseLabel="Diminuir 10 hectares"
        increaseLabel="Aumentar 10 hectares"
        onChange={onChange}
        onStep={onStep}
        onCommit={onCommit}
      />,
    )

    const input = screen.getByLabelText('Quantos hectares quer testar?')
    expect(input).toHaveValue(50)
    await userEvent.type(input, '5')
    expect(onChange).toHaveBeenLastCalledWith('505')
    await userEvent.tab()
    expect(onCommit).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir 10 hectares' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar 10 hectares' }))
    expect(onStep).toHaveBeenNthCalledWith(1, -10)
    expect(onStep).toHaveBeenNthCalledWith(2, 10)
    expect(screen.getByText('ha')).toBeInTheDocument()
  })
})

describe('MeasureField (relatos da comunidade: milímetros de chuva)', () => {
  it('campo de texto com teclado de número, unidade e dica ligada ao campo', async () => {
    const onChange = vi.fn()
    render(<MeasureField label="Quantos milímetros?" value="1" unit="mm" hint="De 0 a 300 mm." onChange={onChange} />)

    const input = screen.getByLabelText('Quantos milímetros?')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    expect(input).toHaveValue('1')
    expect(input).toHaveAccessibleDescription('De 0 a 300 mm.')
    await userEvent.type(input, '2')
    expect(onChange).toHaveBeenLastCalledWith('12')
    expect(screen.getByText('mm')).toBeInTheDocument()
  })
})

describe('SelectField (cultura de cada ano do plano, tarefa 0045)', () => {
  it('lista as opções com o rótulo visível e avisa a escolha', async () => {
    const onChange = vi.fn()
    render(
      <SelectField
        label="O que plantar em 2028"
        value="sorgo"
        options={[
          { value: 'sorgo', label: 'Sorgo' },
          { value: 'pousio', label: 'Deixar parado' },
        ]}
        onChange={onChange}
      />,
    )

    const select = screen.getByRole('combobox', { name: 'O que plantar em 2028' })
    expect(select).toHaveValue('sorgo')
    await userEvent.selectOptions(select, 'pousio')
    expect(onChange).toHaveBeenCalledWith('pousio')
  })
})
