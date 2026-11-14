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
    expect(screen.getByText('2 perguntas · 1 minuto · grátis, sem cadastro')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('tem a foto da lavoura no Cerrado, o slogan e o selo dos dados da NASA', () => {
    render(
      <MemoryRouter>
        <StartView t={pt} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: 'Fileiras de lavoura no Cerrado brasileiro' })).toBeInTheDocument()
    expect(screen.getByText('Do espaço até a raiz.')).toBeInTheDocument()
    expect(screen.getByText('Triângulo Mineiro · MG')).toBeInTheDocument()
  })

  it('explica os 3 passos com um texto curto em cada', () => {
    render(
      <MemoryRouter>
        <StartView t={pt} />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { level: 2, name: 'Uma boa próxima safra começa com uma boa escolha.' }),
    ).toBeInTheDocument()
    const steps = screen.getAllByRole('listitem')
    expect(steps[0]).toHaveTextContent('1. Marque a lavoura')
    expect(steps[0]).toHaveTextContent('Um ponto no mapa. É só isso.')
    expect(steps[2]).toHaveTextContent('O melhor caminho para a sua terra.')
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
