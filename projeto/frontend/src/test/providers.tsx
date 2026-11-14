import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import type { Lang } from '../i18n/language'

/** Mostra a URL atual, para os testes conferirem a navegação. */
export function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

/** Wrapper para renderHook/render: idioma fixo + roteador em memória na URL pedida. */
// oxlint-disable-next-line react/only-export-components -- utilitário de teste, sem fast refresh
export function providers(initialEntry = '/', lang: Lang = 'pt') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider initialLang={lang}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  {children}
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    )
  }
}
