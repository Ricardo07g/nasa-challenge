import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MapPicker } from './MapPicker'

describe('MapPicker', () => {
  it('mostra o mapa com descrição e o nome do lugar', () => {
    render(
      <MapPicker
        label="Mapa para marcar a lavoura"
        center={{ lat: -18.92, lon: -48.28 }}
        placeLabel="Perto de Uberlândia (MG)"
        onMove={vi.fn()}
      />,
    )

    expect(screen.getByRole('region', { name: 'Mapa para marcar a lavoura' })).toBeInTheDocument()
    expect(screen.getByText('Perto de Uberlândia (MG)')).toBeInTheDocument()
  })

  it('desenha o limite da área (linha tracejada) com a legenda em texto, não só pela cor', () => {
    const { container } = render(
      <MapPicker
        label="Mapa para marcar a lavoura"
        center={{ lat: -18.92, lon: -48.28 }}
        bounds={{ south: -19.9, west: -49.0, north: -18.4, east: -47.5 }}
        boundsLabel="Linha tracejada: área com dados"
        onMove={vi.fn()}
      />,
    )

    expect(container.querySelector('.leaflet-overlay-pane path')).not.toBeNull()
    expect(screen.getByText('Linha tracejada: área com dados')).toBeInTheDocument()
  })

  it('"Ver a área inteira" afasta o mapa sem tirar o alfinete do ponto', async () => {
    const onMove = vi.fn()
    render(
      <MapPicker
        label="Mapa para marcar a lavoura"
        center={{ lat: -18.92, lon: -48.28 }}
        bounds={{ south: -19.9, west: -49.0, north: -18.4, east: -47.5 }}
        boundsLabel="Linha tracejada: área com dados"
        boundsAction="Ver a área inteira"
        onMove={onMove}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Ver a área inteira' }))

    for (const [point] of onMove.mock.calls) {
      expect(point.lat).toBeCloseTo(-18.92, 4)
      expect(point.lon).toBeCloseTo(-48.28, 4)
    }
  })

  it('sem limite, nem a linha nem a legenda', () => {
    const { container } = render(
      <MapPicker label="Mapa para marcar a lavoura" center={{ lat: -18.92, lon: -48.28 }} onMove={vi.fn()} />,
    )

    expect(container.querySelector('.leaflet-overlay-pane path')).toBeNull()
  })
})
