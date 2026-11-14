import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DemoBanner, ErrorState, LoadingState, ProgressBar, SkeletonCard } from './Feedback'

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

describe('ProgressBar', () => {
  it('barra de progresso acessível (quanto já foi de quanto)', () => {
    render(<ProgressBar label="Missão: sua lavoura" value={2} max={6} />)

    const bar = screen.getByRole('progressbar', { name: 'Missão: sua lavoura' })
    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '6')
  })
})

describe('DemoBanner (modo de demonstração)', () => {
  it('deixa claro, num aviso fixo, que os dados são de exemplo', () => {
    render(<DemoBanner>Modo de demonstração: dados de exemplo, não são da NASA</DemoBanner>)

    const banner = screen.getByRole('note')
    expect(banner).toHaveTextContent('Modo de demonstração: dados de exemplo, não são da NASA')
    expect(banner.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })
})
