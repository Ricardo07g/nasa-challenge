import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MiniMap } from './MiniMap'

describe('MiniMap (miniatura do mapa com o pin, raio-X)', () => {
  it('mostra o ponto marcado com a descrição para o leitor de tela', () => {
    render(<MiniMap label="Mapa com o ponto marcado perto de Uberlândia" point={{ lat: -18.9543, lon: -48.1993 }} />)

    expect(screen.getByRole('img', { name: 'Mapa com o ponto marcado perto de Uberlândia' })).toBeInTheDocument()
  })

  it('"© OpenStreetMap" sobre o mapa, e o crédito do Leaflet sem bandeira (regra do NASA Space Apps)', () => {
    const { container } = render(<MiniMap label="Mapa" point={{ lat: -18.9543, lon: -48.1993 }} />)

    const attribution = container.querySelector('.leaflet-control-attribution')
    expect(attribution).toHaveTextContent('© OpenStreetMap')
    expect(attribution).toHaveTextContent('Leaflet')
    expect(attribution?.querySelector('svg')).toBeNull()
  })
})
