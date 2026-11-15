import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal, type ModalProps } from './Modal'

function renderModal(overrides: Partial<ModalProps> = {}) {
  const onClose = vi.fn()
  render(
    <Modal
      open
      onClose={onClose}
      title="De onde vêm os dados"
      subtitle="20 anos de satélite (2005–2024) no ponto da sua lavoura."
      closeLabel="Fechar"
      {...overrides}
    >
      <p>Conteúdo</p>
      <button type="button">Todas as fontes e créditos</button>
    </Modal>,
  )
  return onClose
}

/** Uma tela de verdade: o botão abre o modal e o modal fecha pelo onClose. */
function Screen() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Dados da NASA
      </button>
      <button type="button">Outro botão da tela</button>
      <Modal open={open} onClose={() => setOpen(false)} title="De onde vêm os dados" closeLabel="Fechar">
        <a href="/guia">Guia</a>
        <button type="button">Todas as fontes e créditos</button>
      </Modal>
    </>
  )
}

describe('Modal (padrão de "ver detalhes" em todas as telas)', () => {
  it('fechado, não mostra nada', () => {
    renderModal({ open: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument()
  })

  it('aberto, é um diálogo com o título como nome, o subtítulo e o conteúdo', () => {
    renderModal()

    const dialog = screen.getByRole('dialog', { name: 'De onde vêm os dados' })
    expect(dialog).toHaveTextContent('20 anos de satélite (2005–2024) no ponto da sua lavoura.')
    expect(dialog).toHaveTextContent('Conteúdo')
    expect(screen.getByRole('heading', { level: 2, name: 'De onde vêm os dados' })).toBeInTheDocument()
  })

  it('fecha com o X', async () => {
    const onClose = renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fecha com Esc', async () => {
    const onClose = renderModal()

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('fecha com clique fora (no fundo escurecido), mas não com clique dentro', async () => {
    const onClose = renderModal()

    await userEvent.click(screen.getByText('Conteúdo'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('o de créditos é mais largo', () => {
    renderModal({ size: 'wide' })

    expect(screen.getByRole('dialog')).toHaveAttribute('data-size', 'wide')
  })

  it('ao abrir, o foco entra no modal e fica preso nele (Tab e Shift+Tab dão a volta)', async () => {
    render(<Screen />)
    await userEvent.click(screen.getByRole('button', { name: 'Dados da NASA' }))

    const close = screen.getByRole('button', { name: 'Fechar' })
    const link = screen.getByRole('link', { name: 'Guia' })
    const last = screen.getByRole('button', { name: 'Todas as fontes e créditos' })
    expect(close).toHaveFocus()

    await userEvent.tab()
    expect(link).toHaveFocus()
    await userEvent.tab()
    expect(last).toHaveFocus()
    await userEvent.tab()
    expect(close).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(last).toHaveFocus()
  })

  it('ao fechar, devolve o foco ao botão que abriu', async () => {
    render(<Screen />)
    const opener = screen.getByRole('button', { name: 'Dados da NASA' })
    await userEvent.click(opener)

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('fechar pelo X também devolve o foco', async () => {
    render(<Screen />)
    const opener = screen.getByRole('button', { name: 'Dados da NASA' })
    await userEvent.click(opener)

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(opener).toHaveFocus()
  })
})
