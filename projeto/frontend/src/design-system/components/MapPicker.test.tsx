import { render, screen } from '@testing-library/react'
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
})
