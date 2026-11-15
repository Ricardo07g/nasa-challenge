import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportsMap } from './ReportsMap'

describe('ReportsMap (relatos da comunidade agrupados por célula)', () => {
  it('mapa com descrição, o círculo explicado em texto e cada célula com ícone e texto por tipo', () => {
    render(
      <ReportsMap
        label="Mapa dos relatos até 30 km"
        center={{ lat: -18.9543, lon: -48.1993 }}
        radiusKm={30}
        circleLabel="Círculo de 30 km em volta da sua lavoura"
        cells={[
          {
            id: '-190_-482',
            lat: -18.95,
            lon: -48.15,
            items: [
              { kind: 'chuva', count: 2, text: '2 de chuva' },
              { kind: 'evento', count: 1, text: '1 evento' },
            ],
          },
        ]}
        note="Cada marca é um quadrado de cerca de 10 km, nunca uma fazenda."
        legend={{ label: 'Legenda', plantio: 'Plantio', chuva: 'Chuva', evento: 'Evento' }}
      />,
    )

    const map = screen.getByRole('region', { name: 'Mapa dos relatos até 30 km' })
    expect(within(map).getByText('Círculo de 30 km em volta da sua lavoura')).toBeInTheDocument()
    expect(within(map).getByText('Cada marca é um quadrado de cerca de 10 km, nunca uma fazenda.')).toBeInTheDocument()
    const cells = within(map).getByRole('list', { name: 'Mapa dos relatos até 30 km' })
    expect(within(cells).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['2 de chuva, 1 evento'])
    // Legenda em texto: o tipo de cada ícone do mapa (nada só por cor).
    const legend = within(map).getByRole('list', { name: 'Legenda' })
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Plantio', 'Chuva', 'Evento'])
  })
})
