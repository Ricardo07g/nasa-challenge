import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as CardModule from './Card'
import { AlternativeCard, Card, DataSourceCard, IconBubble, InfoBanner, SourceCard } from './Card'

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

describe('IconBubble', () => {
  it('mostra o ícone numa bolinha do tom pedido', () => {
    render(
      <IconBubble tone="blue">
        <svg data-testid="icone" />
      </IconBubble>,
    )

    expect(screen.getByTestId('icone').parentElement).toHaveAttribute('data-tone', 'blue')
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

  it('o cartão sempre tem o dado: não há mais o estado "Ainda não conectado" (decisão D2)', () => {
    render(<DataSourceCard icon={<svg />} title="Clima dos próximos anos" subtitle="Como a chuva e o calor devem mudar." readyLabel="Pronto" />)

    const card = screen.getByRole('heading', { name: 'Clima dos próximos anos' }).closest('[data-status]')
    expect(card).toHaveAttribute('data-status', 'ready')
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect('NotConnectedCard' in CardModule).toBe(false)
  })
})

describe('AlternativeCard', () => {
  it('mostra o motivo, a opção e o resumo', () => {
    render(<AlternativeCard label="Menos risco de seca" title="Sorgo" text="Deu certo em 17 de 20 anos." />)

    expect(screen.getByText('Menos risco de seca')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sorgo' })).toBeInTheDocument()
    expect(screen.getByText('Deu certo em 17 de 20 anos.')).toBeInTheDocument()
  })

  it('pode ter um ícone ao lado do motivo', () => {
    render(<AlternativeCard icon={<svg data-testid="icone" />} label="Menos risco de seca" title="Sorgo" text="x" />)

    expect(screen.getByTestId('icone')).toBeInTheDocument()
  })
})

describe('SourceCard', () => {
  it('mostra o dado, a fonte e a escala', () => {
    render(<SourceCard what="Chuva" source="GPM IMERG (NASA)" scale="quadrados de 10 km, por dia" />)

    expect(screen.getByRole('heading', { name: 'Chuva' })).toBeInTheDocument()
    expect(screen.getByText('GPM IMERG (NASA)')).toBeInTheDocument()
    expect(screen.getByText('quadrados de 10 km, por dia')).toBeInTheDocument()
  })

  it('fonte conectada não leva o aviso', () => {
    render(<SourceCard what="Chuva" source="NASA POWER" scale="50 km" />)

    expect(screen.queryByText('Ainda não conectado')).not.toBeInTheDocument()
  })
})
