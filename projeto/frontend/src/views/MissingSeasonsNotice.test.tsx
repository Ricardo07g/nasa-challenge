import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { MissingSeasonsNotice, type MissingSeasonsNoticeProps } from './MissingSeasonsNotice'

function setup(overrides: Partial<MissingSeasonsNoticeProps> = {}) {
  const onOpen = vi.fn()
  const onClose = vi.fn()
  const onAnswer = vi.fn()
  render(
    <MemoryRouter>
      <MissingSeasonsNotice
        t={pt}
        lang="pt"
        open={false}
        onOpen={onOpen}
        onClose={onClose}
        form={{ seasons: [{ year: 2024, satellite: null }, { year: 2025, satellite: null }, { year: 2026, satellite: null }], answers: {}, onAnswer }}
        {...overrides}
      />
    </MemoryRouter>,
  )
  return { onOpen, onClose, onAnswer }
}

describe('MissingSeasonsNotice ("Você não preencheu as últimas safras", regra geral 6)', () => {
  it('mostra o aviso com o "Preencher agora", que pede para abrir o modal', async () => {
    const { onOpen } = setup()

    expect(screen.getByText('Você não preencheu as últimas safras.')).toBeInTheDocument()
    const fill = screen.getByRole('button', { name: 'Preencher agora' })
    expect(fill).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(fill)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('a tela pode dizer o que ficou faltando por causa disso', () => {
    setup({ text: 'Você não preencheu as últimas safras, então “como é hoje” fica sem nota.' })

    expect(screen.getByText('Você não preencheu as últimas safras, então “como é hoje” fica sem nota.')).toBeInTheDocument()
  })

  it('aberto, o modal tem o formulário das safras para completar ali mesmo, e o Salvar fecha', async () => {
    const { onAnswer, onClose } = setup({ open: true })

    const dialog = screen.getByRole('dialog', { name: 'Suas últimas safras' })
    expect(dialog).toHaveTextContent('O que você plantou depois da soja? Pode pular o que não lembrar.')
    await userEvent.click(within(within(dialog).getByRole('group', { name: 'Depois da soja na safra 2024/25' })).getByRole('button', { name: 'Milheto' }))
    expect(onAnswer).toHaveBeenCalledWith(2025, 'milheto')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('no modal, a safra atual só com a época da colheita diz a época, como na tela 4', () => {
    setup({
      open: true,
      form: { seasons: [], answers: {}, onAnswer: vi.fn(), current: { choice: undefined, onChoose: vi.fn(), harvestBand: 'tarde' } },
    })

    const dialog = screen.getByRole('dialog', { name: 'Suas últimas safras' })
    expect(within(dialog).getByText('colheita prevista no fim de fevereiro ou em março')).toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en', open: true })

    expect(screen.getByText('You did not fill in your last seasons.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill in now' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Your last seasons' })).toBeInTheDocument()
  })
})
