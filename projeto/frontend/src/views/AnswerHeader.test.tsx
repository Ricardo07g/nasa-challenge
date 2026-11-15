import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { pt } from '../i18n/messages.pt'
import { AnswerHeader } from './AnswerHeader'

const tabs = [
  { to: '/resposta?lat=1&lon=2', label: 'Sugestão', current: true },
  { to: '/opcoes?lat=1&lon=2', label: 'Comparar', current: false },
  { to: '/plano?lat=1&lon=2', label: 'Plano de 3 anos', current: false },
]

function renderHeader(objective: 'seguranca' | 'renda' | 'terra' | null, chooseObjective = vi.fn()) {
  render(
    <MemoryRouter>
      <AnswerHeader t={pt} nav={{ label: 'Telas da resposta', tabs, backTo: '/quando', objective, chooseObjective }} />
    </MemoryRouter>,
  )
  return chooseObjective
}

describe('AnswerHeader (abas e "O que você quer mais?", tarefa 0044)', () => {
  it('mostra as abas na ordem nova e o seletor do objetivo com as 3 escolhas', () => {
    renderHeader(null)

    const nav = screen.getByRole('navigation', { name: 'Telas da resposta' })
    expect([...nav.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Sugestão', 'Comparar', 'Plano de 3 anos'])
    const group = screen.getByRole('group', { name: 'O que você quer mais?' })
    expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Mais segurança', 'Renda', 'Cuidar da terra'])
    expect(screen.getByText(/Sem escolha, o app equilibra as três coisas/)).toBeInTheDocument()
  })

  it('marca o objetivo da URL e explica o que vai na frente', () => {
    renderHeader('terra')

    expect(screen.getByRole('button', { name: 'Cuidar da terra' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Na frente, quem mais cuida da terra.')).toBeInTheDocument()
  })

  it('tocar escolhe; tocar de novo volta ao equilíbrio', async () => {
    const choose = renderHeader('renda')

    await userEvent.click(screen.getByRole('button', { name: 'Mais segurança' }))
    expect(choose).toHaveBeenLastCalledWith('seguranca')
    await userEvent.click(screen.getByRole('button', { name: 'Renda' }))
    expect(choose).toHaveBeenLastCalledWith(null)
  })
})
