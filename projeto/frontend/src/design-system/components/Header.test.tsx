import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppHeader, type AppHeaderProps } from './Header'

function setup(overrides: Partial<AppHeaderProps> = {}, path = '/') {
  const props: AppHeaderProps = {
    homeLabel: 'Raiz Orbital, página inicial',
    homeTitle: 'Raiz Orbital',
    slogan: 'Do espaço até a raiz.',
    navLabel: 'Principal',
    guide: { label: 'Guia', to: '/guia' },
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

describe('AppHeader (cabeçalho global, tarefas 0052 e 0061)', () => {
  it('tem o logo e o nome que levam ao início, com o slogan', () => {
    setup()

    const home = screen.getByRole('link', { name: 'Raiz Orbital, página inicial' })
    expect(home).toHaveAttribute('href', '/')
    expect(home).toHaveAttribute('title', 'Raiz Orbital')
    expect(home).toHaveTextContent('Raiz Orbital')
    expect(screen.getByText('Do espaço até a raiz.')).toBeInTheDocument()
  })

  it('à direita, só três itens: Guia, Avisos e o idioma (sem "Comunidade" e sem o botão grande "Ouvir")', () => {
    setup()

    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Guia', 'Avisos'])
    expect(within(nav).getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /Comunidade/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ouvir/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Telegram/ })).not.toBeInTheDocument()
  })

  it('o Guia é uma pílula com o ícone de livro e o nome escrito (também no celular), e leva a /guia', () => {
    setup()

    const link = screen.getByRole('link', { name: 'Guia' })
    expect(link).toHaveAttribute('href', '/guia')
    expect(link).not.toHaveAttribute('aria-label')
    expect(link).toHaveAttribute('data-variant', 'pill')
    const icon = link.querySelector('svg')
    expect(icon).toHaveClass('lucide-book-text')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('fora do Guia e dos Avisos, nenhum dos dois fica marcado', () => {
    setup({}, '/resposta')

    expect(screen.getByRole('link', { name: 'Guia' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Avisos' })).not.toHaveAttribute('aria-current')
  })

  it('em /guia (e nos artigos), a pílula do Guia fica marcada com aria-current="page"', () => {
    setup({}, '/guia')
    expect(screen.getByRole('link', { name: 'Guia' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Avisos' })).not.toHaveAttribute('aria-current')
    cleanup()

    setup({}, '/guia/veranico')
    expect(screen.getByRole('link', { name: 'Guia' })).toHaveAttribute('aria-current', 'page')
  })

  it('em /avisos, o sino fica marcado com aria-current="page" (com o ponto na URL também)', () => {
    setup({ alerts: { label: 'Avisos', to: '/avisos?lat=1&lon=2', count: null, countLabel: null } }, '/avisos?lat=1&lon=2')

    expect(screen.getByRole('link', { name: 'Avisos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Guia' })).not.toHaveAttribute('aria-current')
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

  it('o idioma fica em destaque: EN primeiro, cada um com a bandeirinha, o atual marcado, e troca ao tocar', async () => {
    const props = setup()

    const toggle = screen.getByRole('button', { name: 'Trocar idioma: português ou inglês' })
    expect(toggle).toHaveAttribute('data-highlight')
    expect(toggle).toHaveTextContent('EN|PT')
    const en = toggle.querySelector('[data-lang="en"]')!
    const pt = toggle.querySelector('[data-lang="pt"]')!
    expect(en.querySelector('svg[data-flag="us"]')).toBeInTheDocument()
    expect(pt.querySelector('svg[data-flag="br"]')).toBeInTheDocument()
    expect(en.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(pt).toHaveAttribute('data-active', 'true')
    expect(en).toHaveAttribute('data-active', 'false')
    await userEvent.click(toggle)

    expect(props.lang.onToggle).toHaveBeenCalled()
  })

  it('em inglês, o link do nome explica o nome só no title e no aria-label: nada de linha a mais no cabeçalho', () => {
    setup({
      homeLabel: 'Raiz Orbital: Portuguese for “Orbital Root”, home page',
      homeTitle: 'Raiz Orbital: Portuguese for “Orbital Root”',
      slogan: 'Eyes on the sky, roots in the ground.',
    })

    const home = screen.getByRole('link', { name: 'Raiz Orbital: Portuguese for “Orbital Root”, home page' })
    expect(home).toHaveAttribute('title', 'Raiz Orbital: Portuguese for “Orbital Root”')
    expect(screen.queryByText(/Portuguese for/)).not.toBeInTheDocument()
    const brand = Array.from(screen.getByText('Raiz Orbital').parentElement!.children).map((child) => child.textContent)
    expect(brand).toEqual(['Raiz Orbital', 'Eyes on the sky, roots in the ground.'])
  })

  it('em inglês, destaca o EN', () => {
    setup({
      slogan: 'Eyes on the sky, roots in the ground.',
      navLabel: 'Main',
      guide: { label: 'Guide', to: '/guia' },
      alerts: { label: 'Alerts', to: '/avisos', count: null, countLabel: null },
      lang: { current: 'en', onToggle: vi.fn(), label: 'Switch language: Portuguese or English' },
    })

    expect(screen.getByText('Eyes on the sky, roots in the ground.')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Guide' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alerts' })).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Switch language: Portuguese or English' })
    expect(toggle.querySelector('[data-lang="en"]')).toHaveAttribute('data-active', 'true')
    expect(toggle.querySelector('[data-lang="pt"]')).toHaveAttribute('data-active', 'false')
  })
})
