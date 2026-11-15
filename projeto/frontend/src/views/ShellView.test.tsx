import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CREDITS } from '../content/credits'
import type { CreditsState } from '../controllers/useShellController'
import type { AppFooterProps } from '../design-system/components/Footer'
import type { AppHeaderProps } from '../design-system/components/Header'
import { ShellView } from './ShellView'

const header: AppHeaderProps = {
  homeLabel: 'Raiz Orbital, voltar ao início',
  slogan: 'Do espaço até a raiz.',
  navLabel: 'Principal',
  guide: { label: 'Guia', to: '/guia' },
  alerts: { label: 'Avisos', to: '/avisos', count: null, countLabel: null },
  lang: { current: 'pt', onToggle: vi.fn(), label: 'Trocar idioma: português ou inglês' },
}

function setup(open: boolean) {
  const credits: CreditsState = {
    open,
    content: CREDITS.pt,
    closeLabel: 'Fechar',
    onOpen: vi.fn(),
    onClose: vi.fn(),
  }
  const footer: AppFooterProps = {
    disclaimer: 'Ajuda a decidir. Não substitui o seu agrônomo.',
    credits: { label: 'Créditos e uso de IA', onOpen: credits.onOpen },
    project: 'NASA Space Apps 2026 · Field Shift',
    method: null,
  }
  render(
    <MemoryRouter>
      <ShellView header={header} footer={footer} credits={credits}>
        <h1>Tela</h1>
      </ShellView>
    </MemoryRouter>,
  )
  return credits
}

describe('ShellView (moldura de todas as telas)', () => {
  it('tem o cabeçalho, o conteúdo da tela e o rodapé', () => {
    setup(false)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Tela')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('o rodapé abre o modal global de créditos', async () => {
    const credits = setup(false)

    await userEvent.click(screen.getByRole('button', { name: 'Créditos e uso de IA' }))

    expect(credits.onOpen).toHaveBeenCalled()
  })

  it('com os créditos abertos, mostra o modal, que fecha pelo X', async () => {
    const credits = setup(true)

    expect(screen.getByRole('dialog', { name: 'Créditos e uso de IA' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(credits.onClose).toHaveBeenCalled()
  })
})
