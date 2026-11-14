import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AlternativeCard, Card, DataSourceCard, IconBubble, InfoBanner, NotConnectedCard, SourceCard } from './Card'

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

  it('sem o dado: no lugar do ✓ vem o aviso "Ainda não conectado", e o cartão fica tracejado', () => {
    render(
      <DataSourceCard
        icon={<svg />}
        title="Clima dos próximos anos"
        subtitle="Como a chuva e o calor devem mudar."
        readyLabel="Pronto"
        status="unavailable"
        unavailableLabel="Ainda não conectado"
      />,
    )

    expect(screen.queryByRole('img', { name: 'Pronto' })).not.toBeInTheDocument()
    expect(screen.queryByText('Como a chuva e o calor devem mudar.')).not.toBeInTheDocument()
    const card = screen.getByRole('heading', { name: 'Clima dos próximos anos' }).closest('[data-status]')
    expect(card).toHaveAttribute('data-status', 'unavailable')
    expect(card).toHaveTextContent('Ainda não conectado')
    expect(screen.getByText('Ainda não conectado').closest('[data-status="not-connected"]')).not.toBeNull()
  })
})

describe('NotConnectedCard (bloco que depende de dado que a API ainda não manda)', () => {
  it('mostra o título do bloco e o aviso "Ainda não conectado", sem número de exemplo', () => {
    render(<NotConnectedCard title="Choveu aqui" label="Ainda não conectado" />)

    const block = screen.getByRole('region', { name: 'Choveu aqui' })
    expect(block).toHaveAttribute('data-status', 'unavailable')
    expect(screen.getByRole('heading', { level: 2, name: 'Choveu aqui' })).toBeInTheDocument()
    expect(block).toHaveTextContent('Ainda não conectado')
  })

  it('pode ter ícone, título de nível 3 e uma explicação', () => {
    render(
      <NotConnectedCard title="Histórico da área" label="Ainda não conectado" icon={<svg data-testid="icone" />} level={3}>
        <p>Explicação</p>
      </NotConnectedCard>,
    )

    expect(screen.getByTestId('icone')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Histórico da área' })).toBeInTheDocument()
    expect(screen.getByText('Explicação')).toBeInTheDocument()
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
})
