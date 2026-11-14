import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('é um botão com a variante primária por padrão', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Começar</Button>)

    const button = screen.getByRole('button', { name: 'Começar' })
    expect(button).toHaveAttribute('data-variant', 'primary')
    expect(button).toHaveAttribute('type', 'button')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalled()
  })

  it('vira link quando recebe "to"', () => {
    render(
      <MemoryRouter>
        <Button to="/onde" variant="outline">
          Ver um exemplo
        </Button>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Ver um exemplo' })
    expect(link).toHaveAttribute('href', '/onde')
    expect(link).toHaveAttribute('data-variant', 'outline')
  })

  it('mostra o ícone sem atrapalhar o nome acessível', () => {
    render(
      <Button variant="outline-blue" icon={<svg aria-hidden="true" />}>
        Usar onde estou agora
      </Button>,
    )

    expect(screen.getByRole('button', { name: 'Usar onde estou agora' })).toHaveAttribute(
      'data-variant',
      'outline-blue',
    )
  })

  it('mostra a seta no fim quando a ação avança no fluxo', () => {
    render(
      <>
        <Button arrow>Começar</Button>
        <Button>Tentar de novo</Button>
      </>,
    )

    const withArrow = screen.getByRole('button', { name: 'Começar' })
    expect(withArrow.lastElementChild?.tagName).toBe('svg')
    expect(withArrow.lastElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: 'Tentar de novo' }).querySelector('svg')).toBeNull()
  })

  it('aceita um ícone no fim (ex.: ↗ no "Ver um exemplo pronto")', () => {
    render(<Button iconEnd={<svg data-testid="fim" aria-hidden="true" />}>Ver um exemplo pronto</Button>)

    const button = screen.getByRole('button', { name: 'Ver um exemplo pronto' })
    expect(button.lastElementChild).toBe(screen.getByTestId('fim'))
  })

  it('pode ficar desabilitado', () => {
    render(<Button disabled>É aqui</Button>)

    expect(screen.getByRole('button', { name: 'É aqui' })).toBeDisabled()
  })
})
