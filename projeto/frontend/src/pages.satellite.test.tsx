import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SatelliteDeps } from './controllers/useSatelliteController'
import { I18nProvider } from './i18n/I18nProvider'
import type { Recomendacao } from './models/recomendacao'
import type { Talhao } from './models/talhao'
import { buildRaioX } from './repositories/mocks/raioXFixture'
import { SatellitePage } from './pages'

/**
 * Tela 4 inteira (controller + view, com o roteador e o `ScrollRestoration` da moldura): clicar numa opção grava
 * na URL e **não mexe na rolagem** (regra geral 2 do pacote 2).
 */

let scrollY = 0

beforeEach(() => {
  scrollY = 0
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY)
  vi.spyOn(window, 'scrollTo').mockImplementation(((x: number | ScrollToOptions, y?: number) => {
    scrollY = typeof x === 'number' ? (y ?? 0) : (x.top ?? 0)
  }) as typeof window.scrollTo)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const talhao = {
  dentro_da_area: true,
  solo: { textura: 'argiloso', cad_mm: 60, fonte: 'soilgrids' },
  historico: {
    anos: [2024, 2025, 2026].map((ano) => ({ ano, situacao: 'plantou', ndvi_max: 0.8, n_obs: 12 })),
    parado: 0,
    plantou: 3,
    sem_certeza: 0,
    total: 3,
    fonte: 'MODIS',
    janela: '04-01 a 07-31',
  },
  dados: [],
} as unknown as Talhao

const deps: SatelliteDeps = {
  farm: { talhao: () => Promise.resolve(talhao), recomendacao: () => Promise.resolve({} as Recomendacao) },
  raioX: { get: (params, lang) => Promise.resolve(buildRaioX(params, lang)) },
  speech: { isSupported: () => false, speak: () => {}, stop: () => {} },
}

const start = '/satelite?lat=-18.9543&lon=-48.1993&colheita=tarde&data=2027-03-03'

function renderPage() {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <ScrollRestoration />
            <Outlet />
          </>
        ),
        children: [{ path: '/satelite', element: <SatellitePage deps={deps} /> }],
      },
    ],
    { initialEntries: [start] },
  )
  render(
    <I18nProvider initialLang="pt">
      <RouterProvider router={router} />
    </I18nProvider>,
  )
  return router
}

describe('tela 4: clicar numa opção não mexe na rolagem', () => {
  it('as respostas das safras, a safra atual e a terra vão para a URL, e a tela fica onde está', async () => {
    const router = renderPage()
    await screen.findByRole('region', { name: 'Suas últimas safras' })
    act(() => window.scrollTo(0, 640))

    await userEvent.click(within(screen.getByRole('group', { name: 'Depois da soja na safra 2023/24' })).getByRole('button', { name: 'Sorgo' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Soja na safra 2024/25' })).getByRole('button', { name: 'Não plantei' }))
    await userEvent.click(
      within(screen.getByRole('group', { name: 'O que você pensa plantar depois da soja 2026/27' })).getByRole('button', { name: 'Milheto' }),
    )
    expect(router.state.location.search).toBe(`${start.slice(9)}&safras=2024:sorgo,2025:sem_soja&pensa=milheto`)
    expect(router.state.historyAction).toBe('REPLACE')
    expect(window.scrollY).toBe(640)

    await userEvent.click(screen.getByRole('button', { name: /^Solo/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Do que a sua terra é feita' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Arenosa' }))

    expect(router.state.location.search).toContain('&solo=arenoso')
    expect(screen.getByRole('dialog', { name: 'Do que a sua terra é feita' })).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Arenosa' })).toHaveAttribute('aria-pressed', 'true')
    expect(window.scrollY).toBe(640)
  })
})

describe('tela 4: a comunidade está "em breve" (pacote 3, tarefa 0061)', () => {
  it('com as safras respondidas, a tela não oferece "Compartilhar com a comunidade" nem leva aos relatos', async () => {
    renderPage()
    await screen.findByRole('region', { name: 'Suas últimas safras' })

    await userEvent.click(within(screen.getByRole('group', { name: 'Depois da soja na safra 2023/24' })).getByRole('button', { name: 'Sorgo' }))

    expect(screen.queryByRole('button', { name: 'Compartilhar com a comunidade' })).not.toBeInTheDocument()
    expect(screen.queryByText(/comunidade/i)).not.toBeInTheDocument()
    expect(screen.queryAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/comunidade'))).toEqual([])
  })
})
