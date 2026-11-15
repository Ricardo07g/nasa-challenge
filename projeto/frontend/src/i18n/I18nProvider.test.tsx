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

  it('sem escolha salva, começa em inglês mesmo com o navegador em português, e atualiza o lang do html', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR'])

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByRole('button')).toHaveTextContent('en:Guide')
    expect(document.documentElement.lang).toBe('en')
  })

  it('troca de idioma e guarda a escolha', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR'])
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    await act(() => userEvent.click(screen.getByRole('button')))

    expect(screen.getByRole('button')).toHaveTextContent('pt:Guia')
    expect(document.documentElement.lang).toBe('pt-BR')
    expect(localStorage.getItem('raiz-orbital:lang')).toBe('pt')
  })

  it('respeita a escolha salva (quem escolheu PT continua em PT)', () => {
    localStorage.setItem('raiz-orbital:lang', 'pt')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByRole('button')).toHaveTextContent('pt:Guia')
  })
})
