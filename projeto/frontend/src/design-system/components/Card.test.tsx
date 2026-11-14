import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AlternativeCard, Card, DataSourceCard, InfoBanner, SourceCard } from './Card'

describe('Card', () => {
  it('aplica o tom e o destaque', () => {
    render(
      <Card tone="green" highlighted>
        Conteúdo
      </Card>,
    )

    const card = screen.getByText('Conteúdo')
    expect(card).toHaveAttribute('data-tone', 'green')
    expect(card).toHaveAttribute('data-highlighted', 'true')
  })

  it('pode virar uma seção com título acessível', () => {
    render(
      <Card as="section" aria-label="Como fazer">
        x
      </Card>,
    )

    expect(screen.getByRole('region', { name: 'Como fazer' })).toBeInTheDocument()
  })
})

describe('InfoBanner', () => {
  it('mostra a mensagem', () => {
    render(<InfoBanner>Já deixamos marcado.</InfoBanner>)

    expect(screen.getByText('Já deixamos marcado.')).toBeInTheDocument()
  })
})

describe('DataSourceCard', () => {
  it('mostra título, subtítulo, o selo de pronto e o conteúdo extra', () => {
    render(
      <DataSourceCard icon={<svg />} title="20 anos de chuva daqui" subtitle="De 2006 a 2025." readyLabel="Pronto">
        <span>extra</span>
      </DataSourceCard>,
    )

    expect(screen.getByRole('heading', { name: '20 anos de chuva daqui' })).toBeInTheDocument()
    expect(screen.getByText('De 2006 a 2025.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pronto' })).toBeInTheDocument()
    expect(screen.getByText('extra')).toBeInTheDocument()
  })
})

describe('AlternativeCard', () => {
  it('mostra o motivo, a opção e o resumo', () => {
    render(<AlternativeCard label="Menos risco de seca" title="Sorgo" text="Deu certo em 17 de 20 anos." />)

    expect(screen.getByText('Menos risco de seca')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sorgo' })).toBeInTheDocument()
    expect(screen.getByText('Deu certo em 17 de 20 anos.')).toBeInTheDocument()
  })
})

describe('SourceCard', () => {
  it('mostra o dado, a fonte e a escala', () => {
    render(<SourceCard what="Chuva" source="GPM IMERG (NASA)" scale="quadrados de 10 km, por dia" />)

    expect(screen.getByRole('heading', { name: 'Chuva' })).toBeInTheDocument()
    expect(screen.getByText('GPM IMERG (NASA)')).toBeInTheDocument()
    expect(screen.getByText('quadrados de 10 km, por dia')).toBeInTheDocument()
  })
})
