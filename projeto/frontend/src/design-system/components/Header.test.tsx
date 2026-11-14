import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppHeader, type AppHeaderProps } from './Header'

function setup(overrides: Partial<AppHeaderProps> = {}) {
  const props: AppHeaderProps = {
    homeLabel: 'Raiz Orbital, voltar ao início',
    listen: {
      supported: true,
      speaking: false,
      onToggle: vi.fn(),
      label: 'Ouvir esta tela',
      stopLabel: 'Parar a leitura',
      text: 'Ouvir',
      stopText: 'Parar',
    },
    lang: { current: 'pt', onToggle: vi.fn(), label: 'Trocar idioma: português ou inglês' },
    ...overrides,
  }
  render(
    <MemoryRouter>
      <AppHeader {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('AppHeader', () => {
  it('tem o logo que leva ao início', () => {
    setup()

    expect(screen.getByRole('link', { name: 'Raiz Orbital, voltar ao início' })).toHaveAttribute('href', '/')
  })

  it('o botão Ouvir chama o controller e mostra quando está falando', async () => {
    const props = setup()

    const button = screen.getByRole('button', { name: 'Ouvir esta tela' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)

    expect(props.listen.onToggle).toHaveBeenCalled()
  })

  it('mostra "Parar" enquanto lê', () => {
    setup({
      listen: {
        supported: true,
        speaking: true,
        onToggle: vi.fn(),
        label: 'Ouvir esta tela',
        stopLabel: 'Parar a leitura',
        text: 'Ouvir',
        stopText: 'Parar',
      },
    })

    const button = screen.getByRole('button', { name: 'Parar a leitura' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('Parar')
  })

  it('esconde o Ouvir quando o navegador não lê em voz alta', () => {
    setup({
      listen: {
        supported: false,
        speaking: false,
        onToggle: vi.fn(),
        label: 'Ouvir esta tela',
        stopLabel: 'Parar a leitura',
        text: 'Ouvir',
        stopText: 'Parar',
      },
    })

    expect(screen.queryByRole('button', { name: 'Ouvir esta tela' })).not.toBeInTheDocument()
  })

  it('troca o idioma e destaca o atual', async () => {
    const props = setup()

    const toggle = screen.getByRole('button', { name: 'Trocar idioma: português ou inglês' })
    expect(toggle.querySelector('[data-active="true"]')).toHaveTextContent('PT')
    await userEvent.click(toggle)

    expect(props.lang.onToggle).toHaveBeenCalled()
  })
})
