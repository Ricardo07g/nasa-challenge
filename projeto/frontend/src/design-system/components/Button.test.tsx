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

  it('pode ficar desabilitado', () => {
    render(<Button disabled>É aqui</Button>)

    expect(screen.getByRole('button', { name: 'É aqui' })).toBeDisabled()
  })
})
