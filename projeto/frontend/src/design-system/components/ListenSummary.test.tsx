import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ListenSummary } from './ListenSummary'

const labels = { label: 'Ouvir resumo', stopLabel: 'Parar' }

describe('ListenSummary ("Ouvir resumo")', () => {
  it('é um link discreto com o alto-falante, que pede para falar o resumo', async () => {
    const onToggle = vi.fn()
    render(<ListenSummary supported speaking={false} onToggle={onToggle} {...labels} />)

    const button = screen.getByRole('button', { name: 'Ouvir resumo' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.querySelector('.lucide-volume-1')).not.toBeNull()
    await userEvent.click(button)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('enquanto fala, vira "Parar", com o quadrado e aria-pressed', () => {
    render(<ListenSummary supported speaking onToggle={vi.fn()} {...labels} />)

    const button = screen.getByRole('button', { name: 'Parar' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.querySelector('.lucide-square')).not.toBeNull()
    expect(button.querySelector('.lucide-volume-1')).toBeNull()
  })

  it('em inglês', () => {
    render(
      <ListenSummary supported speaking={false} onToggle={vi.fn()} label="Listen to summary" stopLabel="Stop" />,
    )

    expect(screen.getByRole('button', { name: 'Listen to summary' })).toBeInTheDocument()
  })

  it('some quando o navegador não tem voz', () => {
    render(<ListenSummary supported={false} speaking={false} onToggle={vi.fn()} {...labels} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
