import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs } from './Tabs'

const tabs = [
  { id: 'choose', label: 'Escolher', panelId: 'p-choose' },
  { id: 'plan', label: 'Plano de 3 anos', panelId: 'p-plan' },
] as const

/** A tela guarda a aba (na URL); aqui, num estado. */
function Controlled({ onSelect }: { onSelect: (id: string) => void }) {
  const [selected, setSelected] = useState<'choose' | 'plan'>('choose')
  return (
    <Tabs
      label="Etapas"
      tabs={tabs}
      selected={selected}
      onSelect={(id) => {
        onSelect(id)
        setSelected(id)
      }}
    />
  )
}

describe('Tabs (abas acessíveis da tela 5)', () => {
  it('é um tablist com o nome, a aba atual marcada e o painel de cada aba', () => {
    render(<Tabs label="Etapas" tabs={tabs} selected="choose" onSelect={() => {}} />)

    expect(screen.getByRole('tablist', { name: 'Etapas' })).toBeInTheDocument()
    const choose = screen.getByRole('tab', { name: 'Escolher' })
    expect(choose).toHaveAttribute('aria-selected', 'true')
    expect(choose).toHaveAttribute('aria-controls', 'p-choose')
    expect(choose).toHaveAttribute('id', 'p-choose-tab')
    expect(choose).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Plano de 3 anos' })).toHaveAttribute('tabindex', '-1')
  })

  it('tocar numa aba escolhe ela', async () => {
    const onSelect = vi.fn()
    render(<Tabs label="Etapas" tabs={tabs} selected="choose" onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('tab', { name: /Plano/ }))
    expect(onSelect).toHaveBeenCalledWith('plan')
  })

  it('as setas do teclado trocam de aba (e dão a volta); Home e End vão para a primeira e a última', async () => {
    const onSelect = vi.fn()
    render(<Controlled onSelect={onSelect} />)

    screen.getByRole('tab', { name: /Escolher/ }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onSelect).toHaveBeenLastCalledWith('plan')
    expect(screen.getByRole('tab', { name: /Plano/ })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(onSelect).toHaveBeenLastCalledWith('choose')
    await userEvent.keyboard('{ArrowLeft}')
    expect(onSelect).toHaveBeenLastCalledWith('plan')
    await userEvent.keyboard('{Home}')
    expect(onSelect).toHaveBeenLastCalledWith('choose')
    await userEvent.keyboard('{End}')
    expect(onSelect).toHaveBeenLastCalledWith('plan')
  })
})
