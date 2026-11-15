import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { pt } from '../i18n/messages.pt'
import { DesignSystemView } from './DesignSystemView'

function setup() {
  render(
    <MemoryRouter>
      <DesignSystemView t={pt} apiMode="http" backend="ok" cropOptions={[]} cropOptionsError={false} />
    </MemoryRouter>,
  )
}

describe('DesignSystemView (/design-system)', () => {
  it('não tem mais o estado "Ainda não conectado" (decisão D2) nem valor em reais (tarefa 0040)', () => {
    setup()

    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('R$')
    expect(screen.getByRole('button', { name: 'Renda' })).toBeInTheDocument()
    expect(screen.getByText('Dá grão para vender')).toBeInTheDocument()
  })

  it('mostra o aviso do modo de demonstração', () => {
    setup()

    expect(screen.getByRole('note')).toHaveTextContent('Modo de demonstração: dados de exemplo, não são da NASA')
  })
})
