import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppHeader, type AppHeaderProps } from './Header'

function setup(overrides: Partial<AppHeaderProps> = {}) {
  const props: AppHeaderProps = {
    homeLabel: 'Raiz Orbital, voltar ao início',
    slogan: 'Do espaço até a raiz.',
    community: { label: 'Comunidade', to: '/comunidade?lat=-18.95&lon=-48.2' },
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

  it('tem o link da Comunidade, que leva junto o ponto da lavoura', () => {
    setup()

    expect(screen.getByRole('link', { name: 'Comunidade' })).toHaveAttribute('href', '/comunidade?lat=-18.95&lon=-48.2')
  })

  it('marca a Comunidade quando a pessoa está nela', () => {
    render(
      <MemoryRouter initialEntries={['/comunidade']}>
        <AppHeader
          homeLabel="Início"
          slogan="Do espaço até a raiz."
          community={{ label: 'Comunidade', to: '/comunidade' }}
          listen={{
            supported: false,
            speaking: false,
            onToggle: vi.fn(),
            label: 'Ouvir',
            stopLabel: 'Parar',
            text: 'Ouvir',
            stopText: 'Parar',
          }}
          lang={{ current: 'pt', onToggle: vi.fn(), label: 'Idioma' }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Comunidade' })).toHaveAttribute('aria-current', 'page')
  })

  it('mostra o slogan ao lado do nome', () => {
    setup()

    expect(screen.getByText('Do espaço até a raiz.')).toBeInTheDocument()
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

  it('sem o Telegram configurado, não mostra o link', () => {
    setup()
    expect(screen.queryByRole('link', { name: 'Abrir no Telegram' })).not.toBeInTheDocument()
  })

  it('com o Telegram configurado, mostra o link', () => {
    setup({ telegram: { href: 'https://t.me/BotDoTime?start=1', label: 'Abrir no Telegram' } })

    const link = screen.getByRole('link', { name: 'Abrir no Telegram' })
    expect(link).toHaveAttribute('href', 'https://t.me/BotDoTime?start=1')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
