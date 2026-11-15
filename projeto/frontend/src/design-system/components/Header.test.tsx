import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppHeader, type AppHeaderProps } from './Header'

function setup(overrides: Partial<AppHeaderProps> = {}, path = '/') {
  const props: AppHeaderProps = {
    homeLabel: 'Raiz Orbital, voltar ao início',
    slogan: 'Do espaço até a raiz.',
    navLabel: 'Principal',
    community: { label: 'Comunidade', to: '/comunidade?lat=-18.95&lon=-48.2' },
    alerts: { label: 'Avisos', to: '/avisos', count: null, countLabel: null },
    lang: { current: 'pt', onToggle: vi.fn(), label: 'Trocar idioma: português ou inglês' },
    ...overrides,
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppHeader {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('AppHeader (cabeçalho global, tarefa 0052)', () => {
  it('tem o logo e o nome que levam ao início, com o slogan', () => {
    setup()

    const home = screen.getByRole('link', { name: 'Raiz Orbital, voltar ao início' })
    expect(home).toHaveAttribute('href', '/')
    expect(home).toHaveTextContent('Raiz Orbital')
    expect(screen.getByText('Do espaço até a raiz.')).toBeInTheDocument()
  })

  it('à direita, só três itens: Comunidade, Avisos e o idioma (sem o botão grande "Ouvir")', () => {
    setup()

    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Comunidade', 'Avisos'])
    expect(within(nav).getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Ouvir/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Telegram/ })).not.toBeInTheDocument()
  })

  it('a Comunidade é uma pílula com o nome escrito (também no celular) e leva junto o ponto', () => {
    setup()

    const link = screen.getByRole('link', { name: 'Comunidade' })
    expect(link).toHaveAttribute('href', '/comunidade?lat=-18.95&lon=-48.2')
    expect(link).not.toHaveAttribute('aria-label')
    expect(link).toHaveAttribute('data-variant', 'pill')
  })

  it('marca a Comunidade quando a pessoa está nela', () => {
    setup({ community: { label: 'Comunidade', to: '/comunidade' } }, '/comunidade')

    expect(screen.getByRole('link', { name: 'Comunidade' })).toHaveAttribute('aria-current', 'page')
  })

  it('Avisos mostra o selo com o número de avisos ativos, também no nome acessível', () => {
    setup({ alerts: { label: 'Avisos', to: '/avisos?lat=1&lon=2', count: 2, countLabel: 'Avisos: 2 avisos ativos' } })

    const link = screen.getByRole('link', { name: 'Avisos: 2 avisos ativos' })
    expect(link).toHaveAttribute('href', '/avisos?lat=1&lon=2')
    expect(within(link).getByText('2')).toHaveAttribute('aria-hidden', 'true')
  })

  it('sem ponto ou sem aviso ativo, o selo não aparece', () => {
    setup({ alerts: { label: 'Avisos', to: '/avisos', count: null, countLabel: null } })

    const link = screen.getByRole('link', { name: 'Avisos' })
    expect(link).not.toHaveTextContent(/\d/)
  })

  it('o idioma mostra PT | EN com o atual destacado e troca ao tocar', async () => {
    const props = setup()

    const toggle = screen.getByRole('button', { name: 'Trocar idioma: português ou inglês' })
    expect(toggle).toHaveTextContent('PT|EN')
    expect(toggle.querySelector('[data-active="true"]')).toHaveTextContent('PT')
    expect(toggle.querySelector('[data-active="false"]')).toHaveTextContent('EN')
    await userEvent.click(toggle)

    expect(props.lang.onToggle).toHaveBeenCalled()
  })

  it('em inglês, destaca o EN', () => {
    setup({
      slogan: 'From space to the root.',
      navLabel: 'Main',
      community: { label: 'Community', to: '/comunidade' },
      alerts: { label: 'Alerts', to: '/avisos', count: null, countLabel: null },
      lang: { current: 'en', onToggle: vi.fn(), label: 'Switch language: Portuguese or English' },
    })

    expect(screen.getByText('From space to the root.')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Community' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alerts' })).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Switch language: Portuguese or English' })
    expect(toggle.querySelector('[data-active="true"]')).toHaveTextContent('EN')
  })
})
