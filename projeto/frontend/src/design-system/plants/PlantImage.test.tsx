import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GUIDE_PLANTS } from '../../models/guide'
import { PlantImage } from './PlantImage'

describe('PlantImage', () => {
  it.each(GUIDE_PLANTS)('desenha %s em SVG próprio, com o nome para quem não vê', (plant) => {
    const { container } = render(<PlantImage plant={plant} label={`Desenho de ${plant}`} />)
    expect(screen.getByRole('img', { name: `Desenho de ${plant}` })).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('image, foreignObject, script')).toBeNull()
  })

  it('só usa cores do design system, nunca hex solto', () => {
    for (const plant of GUIDE_PLANTS) {
      const { container, unmount } = render(<PlantImage plant={plant} label="x" />)
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b/i)
      unmount()
    }
  })

  it('cada planta é um desenho diferente', () => {
    const html = GUIDE_PLANTS.map((plant) => {
      const { container, unmount } = render(<PlantImage plant={plant} label="x" />)
      const out = container.innerHTML
      unmount()
      return out
    })
    expect(new Set(html).size).toBe(GUIDE_PLANTS.length)
  })
})
