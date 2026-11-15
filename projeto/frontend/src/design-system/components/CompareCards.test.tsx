import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompareCards } from './CompareCards'

const cards = ['Sorgo', 'Milheto', 'Crotalária'].map((name) => ({
  key: name,
  label: name,
  header: <h3>{name}</h3>,
  cells: [
    <button key="a" type="button">{`${name}: deu certo`}</button>,
    <button key="b" type="button">{`${name}: água`}</button>,
  ],
  footer: <button type="button">{`Escolher ${name}`}</button>,
}))

describe('CompareCards (Comparar até 3: tabela no computador, cartões que arrastam no celular)', () => {
  it('um grupo por cultura, com o cabeçalho, as células e o rodapé, na mesma ordem', () => {
    render(<CompareCards label="Comparação" rowLabels={['Deu certo', 'Água']} cards={cards} hint="Arraste para o lado" />)

    const region = screen.getByRole('region', { name: 'Comparação' })
    const groups = within(region).getAllByRole('group')
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(['Sorgo', 'Milheto', 'Crotalária'])
    expect(within(groups[1]).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Milheto: deu certo',
      'Milheto: água',
      'Escolher Milheto',
    ])
  })

  it('a coluna dos nomes das linhas é só visual (cada célula diz o nome da linha ao leitor de tela)', () => {
    const { container } = render(<CompareCards label="Comparação" rowLabels={['Deu certo', 'Água']} cards={cards} hint="Arraste" />)

    const labels = container.querySelector('[data-row-labels]')
    expect(labels).toHaveAttribute('aria-hidden', 'true')
    expect(labels).toHaveTextContent('Deu certoÁgua')
  })

  it('no celular: a dica de arrastar e uma bolinha por cartão, a do cartão visível marcada', () => {
    const { container } = render(
      <CompareCards label="Comparação" rowLabels={['Deu certo', 'Água']} cards={cards} hint="Arraste para o lado" />,
    )

    expect(screen.getByText('Arraste para o lado')).toBeInTheDocument()
    const dots = container.querySelectorAll('[data-dot]')
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveAttribute('data-active', 'true')

    const scroller = container.querySelector('[data-scroller]') as HTMLElement
    const first = scroller.querySelector('[role="group"]') as HTMLElement
    Object.defineProperty(first, 'offsetWidth', { value: 300 })
    Object.defineProperty(scroller, 'scrollLeft', { value: 620, configurable: true })
    fireEvent.scroll(scroller)
    expect(dots[2]).toHaveAttribute('data-active', 'true')
  })

  it('com uma cultura só, sem dica nem bolinhas', () => {
    const { container } = render(
      <CompareCards label="Comparação" rowLabels={['Deu certo', 'Água']} cards={cards.slice(0, 1)} hint="Arraste" />,
    )

    expect(screen.queryByText('Arraste')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-dot]')).toHaveLength(0)
  })
})
