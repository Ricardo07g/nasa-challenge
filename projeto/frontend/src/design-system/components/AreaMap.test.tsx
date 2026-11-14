import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AreaMap } from './AreaMap'

describe('AreaMap', () => {
  it('mapa da região com descrição e legenda dos pontos', () => {
    render(
      <AreaMap
        label="Mapa da região com pluviômetros e o que cada vizinho plantou"
        center={{ lat: -18.9543, lon: -48.1993 }}
        points={[
          { lat: -18.9, lon: -48.2, kind: 'gauge' },
          { lat: -19.0, lon: -48.1, kind: 'planted' },
        ]}
        legend={{ gauge: 'Pluviômetro', planted: 'Plantou', idle: 'Parado' }}
      />,
    )

    expect(
      screen.getByRole('region', { name: 'Mapa da região com pluviômetros e o que cada vizinho plantou' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Pluviômetro')).toBeInTheDocument()
    expect(screen.getByText('Plantou')).toBeInTheDocument()
    expect(screen.getByText('Parado')).toBeInTheDocument()
  })
})
