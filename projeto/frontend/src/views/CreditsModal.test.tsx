import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CREDITS } from '../content/credits'
import { CreditsModal } from './CreditsModal'

describe('CreditsModal (global: o rodapé de todas as telas abre este modal)', () => {
  it('fechado, não aparece', () => {
    render(<CreditsModal open={false} onClose={vi.fn()} content={CREDITS.pt} closeLabel="Fechar" />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('aberto, é o modal largo com os grupos, uma linha por fonte, e o quadro do uso de IA', () => {
    render(<CreditsModal open onClose={vi.fn()} content={CREDITS.pt} closeLabel="Fechar" />)

    const dialog = screen.getByRole('dialog', { name: 'Créditos e uso de IA' })
    expect(dialog).toHaveAttribute('data-size', 'wide')
    expect(dialog).toHaveTextContent('Tudo o que usamos para fazer o Raiz Orbital.')
    const headings = within(dialog)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual(['Dados da NASA', 'Outros dados', 'Código, fontes e ícones', 'Imagens', 'Uso de IA'])

    const nasa = within(dialog).getAllByRole('list')[0]
    expect(within(nasa).getAllByRole('listitem')).toHaveLength(5)
    expect(within(nasa).getAllByRole('listitem')[0]).toHaveTextContent('GPM IMERG Final · chuva de cada dia, 2005–2024')
    // O negrito do arquivo vira <strong>, nunca HTML solto.
    expect(within(dialog).getByText('GPM IMERG Final').tagName).toBe('STRONG')
    expect(within(dialog).getByText(/Nenhum número das telas vem de IA/)).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent('**')
  })

  it('em inglês', () => {
    render(<CreditsModal open onClose={vi.fn()} content={CREDITS.en} closeLabel="Close" />)

    expect(screen.getByRole('dialog', { name: 'Credits and use of AI' })).toHaveTextContent('Use of AI')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('fecha com o X', async () => {
    const onClose = vi.fn()
    render(<CreditsModal open onClose={onClose} content={CREDITS.pt} closeLabel="Fechar" />)

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalled()
  })
})
