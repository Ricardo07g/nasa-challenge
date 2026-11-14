import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppFooter } from './Footer'

describe('AppFooter', () => {
  it('mostra o aviso, o caminho do agrônomo e o projeto', () => {
    render(
      <MemoryRouter>
        <AppFooter
          disclaimer="Ajuda a decidir. Não substitui o seu agrônomo."
          agronomist="Sou agrônomo(a): como a conta é feita"
          project="NASA Space Apps Challenge 2026 · Field Shift"
        />
      </MemoryRouter>,
    )

    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('Ajuda a decidir. Não substitui o seu agrônomo.')
    expect(footer).toHaveTextContent('NASA Space Apps Challenge 2026 · Field Shift')
    expect(screen.getByRole('link', { name: 'Sou agrônomo(a): como a conta é feita' })).toHaveAttribute(
      'href',
      '/como-funciona',
    )
  })
})
