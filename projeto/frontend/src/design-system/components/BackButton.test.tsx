import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { BackButton } from './BackButton'

describe('BackButton ("← Voltar" de verdade, regra geral 1)', () => {
  it('é um link para a tela anterior, com a seta (decorativa) e o texto', () => {
    render(
      <MemoryRouter>
        <BackButton to="/onde?lat=1&lon=2">Voltar</BackButton>
      </MemoryRouter>,
    )

    const back = screen.getByRole('link', { name: 'Voltar' })
    expect(back).toHaveAttribute('href', '/onde?lat=1&lon=2')
    expect(back.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('marca o componente para o mesmo visual em todas as telas e aceita a classe da tela', () => {
    render(
      <MemoryRouter>
        <BackButton to="/" className="extra">
          Back
        </BackButton>
      </MemoryRouter>,
    )

    const back = screen.getByRole('link', { name: 'Back' })
    expect(back).toHaveAttribute('data-back-button')
    expect(back).toHaveClass('extra')
  })
})
