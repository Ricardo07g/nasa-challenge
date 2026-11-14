import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomeView } from './HomeView'

describe('HomeView', () => {
  it('mostra o status da API e as opções de entressafra', () => {
    render(
      <HomeView
        apiStatus="ok"
        cropOptions={[{ id: 'milheto', name: 'Milheto', role: 'Cobertura' }]}
        error={null}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Raiz Orbital' })).toBeInTheDocument()
    expect(screen.getByText('ok')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Milheto')
    expect(screen.getByRole('listitem')).toHaveTextContent('Cobertura')
  })

  it('mostra a mensagem de erro no lugar da lista', () => {
    render(<HomeView apiStatus="fora do ar" cropOptions={[]} error="Falhou" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Falhou')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
