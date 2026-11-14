import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorState, LoadingState, SkeletonCard } from './Feedback'

describe('LoadingState', () => {
  it('avisa leitores de tela que está carregando', () => {
    render(<LoadingState>Carregando…</LoadingState>)

    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })
})

describe('ErrorState', () => {
  it('mostra o erro e deixa tentar de novo', async () => {
    const onRetry = vi.fn()
    render(<ErrorState message="Não foi possível carregar agora." retryLabel="Tentar de novo" onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar agora.')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('SkeletonCard', () => {
  it('é só um bloco visual enquanto carrega (o leitor de tela ouve o aviso de carregando)', () => {
    const { container } = render(<SkeletonCard />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
