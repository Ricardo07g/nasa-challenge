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
  it('mostra o estado "Ainda não conectado" em linha e em bloco, igual ao das telas', () => {
    setup()

    expect(screen.getByRole('region', { name: 'Choveu aqui' })).toHaveTextContent('Ainda não conectado')
    const notes = screen.getAllByText('Ainda não conectado').map((text) => text.closest('[data-status="not-connected"]'))
    expect(notes.some((note) => note?.textContent === 'Custo da semente: Ainda não conectado')).toBe(true)
    const climate = screen.getByRole('heading', { name: 'Clima dos próximos anos' }).closest('[data-status]')
    expect(climate).toHaveAttribute('data-status', 'unavailable')
    expect(climate).toHaveTextContent('Ainda não conectado')
  })
})
