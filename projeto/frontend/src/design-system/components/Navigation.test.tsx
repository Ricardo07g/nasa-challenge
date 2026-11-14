import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AnswerTabs, BackLink, QuestionStepper } from './Navigation'

describe('BackLink', () => {
  it('leva para a tela anterior', () => {
    render(
      <MemoryRouter>
        <BackLink to="/onde">Voltar</BackLink>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/onde')
  })
})

describe('QuestionStepper', () => {
  it('mostra em qual pergunta a pessoa está', () => {
    render(<QuestionStepper current={1} total={2} label="Pergunta 1 de 2" />)

    const stepper = screen.getByRole('img', { name: 'Pergunta 1 de 2' })
    expect(stepper).toHaveTextContent('Pergunta 1 de 2')
    expect(stepper.querySelectorAll('[data-done="true"]')).toHaveLength(1)
    expect(stepper.querySelectorAll('[data-done="false"]')).toHaveLength(1)
  })
})

describe('AnswerTabs', () => {
  it('mostra as abas da resposta e marca a atual', () => {
    render(
      <MemoryRouter>
        <AnswerTabs
          label="Telas da resposta"
          tabs={[
            { to: '/resposta?lat=1&lon=2', label: 'Resposta', current: false },
            { to: '/plano?lat=1&lon=2', label: 'Plano de 3 anos', current: true },
            { to: '/opcoes?lat=1&lon=2', label: 'Todas as opções', current: false },
          ]}
        />
      </MemoryRouter>,
    )

    const nav = screen.getByRole('navigation', { name: 'Telas da resposta' })
    expect(nav.querySelectorAll('a')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Plano de 3 anos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Resposta' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Todas as opções' })).toHaveAttribute('href', '/opcoes?lat=1&lon=2')
  })
})
