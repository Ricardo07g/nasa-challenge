import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from './I18nProvider'
import { useI18n } from './useI18n'

function Probe() {
  const { lang, messages, toggleLang } = useI18n()
  return (
    <button type="button" onClick={toggleLang}>
      {lang}:{messages.header.guide}
    </button>
  )
}

describe('I18nProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('começa no idioma do navegador e atualiza o lang do html', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR'])

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByRole('button')).toHaveTextContent('pt:Guia')
    expect(document.documentElement.lang).toBe('pt-BR')
  })

  it('troca de idioma e guarda a escolha', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR'])
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    await act(() => userEvent.click(screen.getByRole('button')))

    expect(screen.getByRole('button')).toHaveTextContent('en:Guide')
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('raiz-orbital:lang')).toBe('en')
  })

  it('respeita a escolha salva', () => {
    localStorage.setItem('raiz-orbital:lang', 'en')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR'])

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByRole('button')).toHaveTextContent('en:Guide')
  })
})
