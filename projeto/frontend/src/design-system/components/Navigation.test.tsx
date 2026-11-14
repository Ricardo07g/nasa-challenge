import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { BackLink, QuestionStepper } from './Navigation'

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
