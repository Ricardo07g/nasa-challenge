import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { StartView } from './StartView'

describe('StartView (tela 1)', () => {
  it('mostra a pergunta, os passos e leva para as próximas telas', () => {
    render(
      <MemoryRouter>
        <StartView t={pt} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'O que plantar depois da soja?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Começar' })).toHaveAttribute('href', '/onde')
    expect(screen.getByRole('link', { name: 'Ver um exemplo pronto' })).toHaveAttribute('href', '/exemplo')
    expect(screen.getByRole('link', { name: 'Sou agrônomo(a): como a conta é feita' })).toHaveAttribute(
      'href',
      '/como-funciona',
    )
    expect(screen.getByText('2 perguntas · 1 minuto · grátis, sem cadastro')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('em inglês', () => {
    render(
      <MemoryRouter>
        <StartView t={en} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'What to plant after soybeans?' })).toBeInTheDocument()
  })
})
