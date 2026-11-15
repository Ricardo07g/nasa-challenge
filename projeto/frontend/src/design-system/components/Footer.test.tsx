import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppFooter, type AppFooterProps } from './Footer'

function setup(overrides: Partial<AppFooterProps> = {}) {
  const props: AppFooterProps = {
    disclaimer: 'Ajuda a decidir. Não substitui o seu agrônomo.',
    credits: { label: 'Créditos e uso de IA', onOpen: vi.fn() },
    project: 'NASA Space Apps 2026 · Field Shift',
    method: null,
    ...overrides,
  }
  render(
    <MemoryRouter>
      <AppFooter {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('AppFooter (rodapé global, tarefa 0052)', () => {
  it('na Início: o aviso à esquerda e, à direita, os créditos e o projeto (sem link do agrônomo)', () => {
    setup()

    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('Ajuda a decidir. Não substitui o seu agrônomo.')
    expect(footer).toHaveTextContent('NASA Space Apps 2026 · Field Shift')
    expect(within(footer).queryByRole('link')).not.toBeInTheDocument()
    expect(footer).not.toHaveTextContent(/agrônomo\(a\)/)
  })

  it('"Créditos e uso de IA" é um botão que abre o modal global de créditos', async () => {
    const props = setup()

    const button = screen.getByRole('button', { name: 'Créditos e uso de IA' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.click(button)

    expect(props.credits.onOpen).toHaveBeenCalledTimes(1)
  })

  it('nas telas internas: "Como a conta é feita ↗" antes dos créditos e do projeto', () => {
    setup({ method: { label: 'Como a conta é feita', to: '/como-funciona?lat=1&lon=2' } })

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Como a conta é feita' })).toHaveAttribute(
      'href',
      '/como-funciona?lat=1&lon=2',
    )
    expect(footer.textContent?.indexOf('Como a conta é feita')).toBeLessThan(
      footer.textContent?.indexOf('Créditos e uso de IA') ?? -1,
    )
    expect(footer.textContent?.indexOf('Créditos e uso de IA')).toBeLessThan(
      footer.textContent?.indexOf('NASA Space Apps 2026') ?? -1,
    )
  })

  it('em inglês', () => {
    setup({
      disclaimer: 'Helps you decide. It does not replace your agronomist.',
      credits: { label: 'Credits and use of AI', onOpen: vi.fn() },
      method: { label: 'How the math works', to: '/como-funciona' },
    })

    expect(screen.getByRole('contentinfo')).toHaveTextContent('Helps you decide. It does not replace your agronomist.')
    expect(screen.getByRole('button', { name: 'Credits and use of AI' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How the math works' })).toBeInTheDocument()
  })
})
