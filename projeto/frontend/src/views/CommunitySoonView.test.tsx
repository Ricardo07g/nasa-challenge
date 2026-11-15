import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { CommunitySoonView, type CommunitySoonViewProps } from './CommunitySoonView'

function setup(overrides: Partial<CommunitySoonViewProps> = {}) {
  const props: CommunitySoonViewProps = {
    t: pt,
    backTo: '/',
    guideTo: '/guia',
    listen: { supported: true, speaking: false, toggle: vi.fn() },
    ...overrides,
  }
  render(
    <MemoryRouter>
      <CommunitySoonView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('CommunitySoonView (/comunidade "em breve", tarefa 0061)', () => {
  it('mostra só o cartão "Em breve: Comunidade da sua região", com o título da tela', () => {
    setup()

    const card = screen.getByRole('region', { name: 'Comunidade da sua região' })
    expect(within(card).getByRole('heading', { level: 1, name: 'Comunidade da sua região' })).toBeInTheDocument()
    expect(within(card).getByText('Em breve')).toBeInTheDocument()
    expect(card).toHaveTextContent('Um espaço para acompanhar a sua região junto com os vizinhos.')
    const list = within(card).getByRole('list', { name: 'O que vai ter na comunidade' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'O que os vizinhos plantaram depois da soja e como foi',
      'Quanto choveu em cada lavoura',
      'Granizo, fogo ou enxurrada perto de você',
    ])
  })

  it('o botão "Abrir o Guia" leva ao Guia, com o ícone de livro', () => {
    setup()

    expect(screen.getByText('Enquanto isso, o Guia explica cada cultura, o plantio e o clima.')).toBeInTheDocument()
    const guide = screen.getByRole('link', { name: 'Abrir o Guia' })
    expect(guide).toHaveAttribute('href', '/guia')
    expect(guide.querySelector('svg')).toHaveClass('lucide-book-text')
  })

  it('nenhum relato de vizinho: sem formulário, sem mapa, sem "Perto de você" e sem "Contar"', () => {
    setup()

    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Perto de você|Conte o que aconteceu/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Relato de vizinho|Contar|Enviar/)).not.toBeInTheDocument()
    // Só o Voltar e o Guia levam a algum lugar.
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/', '/guia'])
  })

  it('tem o "← Voltar" de verdade acima do cartão e o "Ouvir resumo" (regras gerais 1 e 9)', async () => {
    const props = setup({ backTo: '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio' })

    const back = screen.getByRole('link', { name: 'Voltar' })
    expect(back).toHaveAttribute('href', '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')
    expect(back).toHaveAttribute('data-back-button')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(props.listen.toggle).toHaveBeenCalled()
  })

  it('em inglês', () => {
    setup({ t: en })

    const card = screen.getByRole('region', { name: "Your region's community" })
    expect(within(card).getByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the Guide' })).toHaveAttribute('href', '/guia')
    expect(screen.getByRole('link', { name: 'Back' })).toBeInTheDocument()
  })
})
