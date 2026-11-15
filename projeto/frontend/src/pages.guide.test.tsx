import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from './i18n/I18nProvider'
import { GuideArticlePage, GuidePage } from './pages'

/**
 * Guia inteiro (tela 8 do pacote 3: controller + view, com os artigos reais, o roteador e o `ScrollRestoration` da
 * moldura). Trocar de filtro ou digitar na busca **não mexe na rolagem** (regra geral 2 do pacote 2).
 */

let scrollY = 0

beforeEach(() => {
  scrollY = 0
  window.localStorage.clear()
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY)
  vi.spyOn(window, 'scrollTo').mockImplementation(((x: number | ScrollToOptions, y?: number) => {
    scrollY = typeof x === 'number' ? (y ?? 0) : (x.top ?? 0)
  }) as typeof window.scrollTo)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderAt(path: string, lang: 'pt' | 'en' = 'pt') {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <ScrollRestoration />
            <Outlet />
          </>
        ),
        children: [
          { path: '/guia', element: <GuidePage /> },
          { path: '/guia/:artigo', element: <GuideArticlePage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <I18nProvider initialLang={lang}>
      <RouterProvider router={router} />
    </I18nProvider>,
  )
  return router
}

function scrollDown() {
  act(() => window.scrollTo(0, 720))
  expect(window.scrollY).toBe(720)
}

describe('Guia (tela 8): início', () => {
  it('os 27 artigos nos 5 temas, com a contagem certa em cada pílula', async () => {
    renderAt('/guia')
    const themes = await screen.findByRole('group', { name: 'Temas' })

    expect(within(themes).getByRole('button', { name: 'Todos 27' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(themes).getByRole('button', { name: 'Culturas 6' })).toBeInTheDocument()
    expect(within(themes).getByRole('button', { name: 'Plantar 4' })).toBeInTheDocument()
    expect(within(themes).getByRole('button', { name: 'Cuidar da terra 5' })).toBeInTheDocument()
    expect(within(themes).getByRole('button', { name: 'Clima, água e dados 9' })).toBeInTheDocument()
    expect(within(themes).getByRole('button', { name: 'Segurança 3' })).toBeInTheDocument()
  })

  it('o filtro por tema mostra só os artigos do tema, vai para a URL e não mexe na rolagem', async () => {
    const router = renderAt('/guia')
    const themes = await screen.findByRole('group', { name: 'Temas' })
    scrollDown()

    await userEvent.click(within(themes).getByRole('button', { name: 'Segurança 3' }))

    expect(within(themes).getByRole('button', { name: 'Segurança 3' })).toHaveAttribute('aria-pressed', 'true')
    const safety = screen.getByRole('region', { name: 'Segurança' })
    expect(within(safety).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('region', { name: 'Culturas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Comece por aqui' })).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?tema=seguranca')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(window.scrollY).toBe(720)
  })

  it('a busca acha sem acento ("erosao" → "Como evitar erosão"), marca a palavra e não mexe na rolagem', async () => {
    const router = renderAt('/guia')
    const box = await screen.findByRole('searchbox', { name: 'Buscar no Guia' })
    scrollDown()

    await userEvent.type(box, 'erosao')

    expect(screen.getByRole('link', { name: 'Como evitar erosão' })).toHaveAttribute('href', '/guia/como-evitar-erosao')
    expect(screen.getAllByText('erosão', { selector: 'mark' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('group', { name: 'Temas' })).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?q=erosao')
    expect(window.scrollY).toBe(720)
  })

  it('sem resultado, mostra 3 sugestões; tocar numa delas busca por ela', async () => {
    renderAt('/guia?q=xyzw')

    expect(await screen.findByText('Nenhum artigo encontrado para "xyzw"')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'veranico' }))

    expect(screen.getByRole('link', { name: 'Veranico' })).toHaveAttribute('href', '/guia/veranico')
  })

  it('em inglês, a busca e as sugestões em inglês', async () => {
    renderAt('/guia?q=xyzw', 'en')

    expect(await screen.findByText('No article found for "xyzw"')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'dry spell' }))
    expect(screen.getByRole('link', { name: 'Dry spell' })).toBeInTheDocument()
  })
})

describe('Guia (tela 8): artigo', () => {
  it('com o ponto na URL, "Na sua lavoura" mostra o número do ponto (dados de exemplo no teste)', async () => {
    renderAt('/guia/como-evitar-erosao?lat=-18.9543&lon=-48.1993')

    const box = await screen.findByRole('note')
    expect(box).toHaveTextContent('Sua lavoura, perto de Uberlândia (MG)')
    expect(box).toHaveTextContent('Em 20 anos, houve 6 dias de chuva forte em fevereiro e março')
    expect(screen.getByRole('link', { name: 'Voltar ao Guia' })).toHaveAttribute('href', '/guia?lat=-18.9543&lon=-48.1993')
  })

  it('sem ponto (nem salvo no aparelho), a caixa não aparece', async () => {
    renderAt('/guia/como-evitar-erosao')

    expect(await screen.findByRole('heading', { level: 1, name: 'Como evitar erosão' })).toBeInTheDocument()
    await act(async () => {})
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('o tempo de leitura vem do texto e o "Veja também" traz os relacionados', async () => {
    renderAt('/guia/como-evitar-erosao')

    expect(await screen.findByText(/^\d+ min de leitura$/)).toBeInTheDocument()
    const seeAlso = screen.getByRole('region', { name: 'Veja também' })
    expect(within(seeAlso).getByRole('link', { name: /Palhada: por que cobrir a terra/ })).toHaveAttribute('href', '/guia/palhada')
  })
})
