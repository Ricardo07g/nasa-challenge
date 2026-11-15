import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GuideLink } from './GuideLink'

describe('GuideLink ("Saiba mais" do Guia, regra geral 3)', () => {
  it('leva ao artigo do Guia numa nova aba, sem perder a tela', () => {
    render(
      <GuideLink slug="rotacao-de-culturas" newTabLabel="(abre em nova aba)">
        Saiba mais: rotação de culturas
      </GuideLink>,
    )

    const link = screen.getByRole('link', { name: 'Saiba mais: rotação de culturas (abre em nova aba)' })
    expect(link).toHaveAttribute('href', '/guia/rotacao-de-culturas')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
  })

  it('tem o ícone de "abrir fora" (decorativo) e o aviso da nova aba só para o leitor de tela', () => {
    render(
      <GuideLink slug="raio-x" newTabLabel="(opens in a new tab)">
        Learn more
      </GuideLink>,
    )

    const link = screen.getByRole('link', { name: 'Learn more (opens in a new tab)' })
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('(opens in a new tab)')).toHaveClass('visually-hidden')
  })

  it('aceita a classe da tela (espaço em volta)', () => {
    render(
      <GuideLink slug="veranico" newTabLabel="(abre em nova aba)" className="extra">
        Veranico
      </GuideLink>,
    )

    expect(screen.getByRole('link')).toHaveClass('extra')
  })
})
