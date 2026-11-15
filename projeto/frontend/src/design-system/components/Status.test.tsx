import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MetricRow, NotConnected, StatusPill, StripLegend, TappableYearStrip, ToneBadge, YearStrip } from './Status'

describe('StatusPill', () => {
  it('mostra o rótulo com o tom certo', () => {
    render(<StatusPill rotulo="medio">Médio</StatusPill>)

    expect(screen.getByText('Médio')).toHaveAttribute('data-rotulo', 'medio')
  })

  it.each(['bom', 'medio', 'fraco'] as const)('o rótulo %s tem um ícone, para não depender só da cor', (rotulo) => {
    render(<StatusPill rotulo={rotulo}>Rótulo</StatusPill>)

    expect(screen.getByText('Rótulo').querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('MetricRow', () => {
  it('mostra eixo, valor, rótulo e conteúdo extra', () => {
    render(
      <MetricRow icon={<svg />} label="Chuva" value="Deu certo em 14 de 20 anos" pill={<StatusPill rotulo="medio">Médio</StatusPill>}>
        <span>faixa</span>
      </MetricRow>,
    )

    expect(screen.getByText('Chuva')).toBeInTheDocument()
    expect(screen.getByText('Deu certo em 14 de 20 anos')).toBeInTheDocument()
    expect(screen.getByText('Médio')).toBeInTheDocument()
    expect(screen.getByText('faixa')).toBeInTheDocument()
  })

  it('o ícone da chuva pode ficar azul (dado de satélite)', () => {
    render(<MetricRow icon={<svg data-testid="icone" />} iconTone="blue" label="Chuva" value="14 de 20" />)

    expect(screen.getByTestId('icone').parentElement).toHaveAttribute('data-tone', 'blue')
  })

  it('sem valor (dado que a API ainda não manda), mostra o eixo e o conteúdo, sem frase vazia', () => {
    const { container } = render(
      <MetricRow icon={<svg />} label="Clima 2041–2060">
        <NotConnected label="Ainda não conectado" />
      </MetricRow>,
    )

    expect(screen.getByText('Clima 2041–2060')).toBeInTheDocument()
    expect(screen.getByText('Ainda não conectado')).toBeInTheDocument()
    expect(container.querySelector('[class*="metricValue"]')).toBeNull()
  })
})

describe('YearStrip', () => {
  it('desenha um quadrinho por ano, com descrição acessível', () => {
    render(<YearStrip label="14 anos bons e 6 com falta de água" cells={['good', 'good', 'bad']} />)

    const strip = screen.getByRole('img', { name: '14 anos bons e 6 com falta de água' })
    const cells = strip.querySelectorAll('[data-state]')
    expect(cells).toHaveLength(3)
    expect(strip.querySelectorAll('[data-state="good"]')).toHaveLength(2)
    expect(strip.querySelectorAll('[data-state="bad"]')).toHaveLength(1)
  })

  it('no tamanho grande mostra o ano embaixo de cada quadrinho', () => {
    render(
      <YearStrip
        label="Plantou em 1 de 3 anos"
        size="lg"
        cells={['bad', 'good', 'unknown']}
        years={['16', '17', '18']}
      />,
    )

    const strip = screen.getByRole('img', { name: 'Plantou em 1 de 3 anos' })
    expect(strip).toHaveAttribute('data-size', 'lg')
    expect(strip).toHaveTextContent('1617?18')
  })

  it('o ano sem certeza fica cinza com "?" (não depende só da cor)', () => {
    render(<YearStrip label="Plantou em 1 de 2 anos" cells={['good', 'unknown', 'bad']} />)

    const strip = screen.getByRole('img', { name: 'Plantou em 1 de 2 anos' })
    expect(strip.querySelector('[data-state="unknown"]')).toHaveTextContent('?')
    expect(strip.querySelector('[data-state="good"]')).toHaveTextContent('')
    expect(strip.querySelector('[data-state="bad"]')).toHaveTextContent('')
  })
})

describe('StripLegend', () => {
  it('explica cada tipo de quadrinho', () => {
    render(
      <StripLegend
        items={[
          { state: 'good', label: 'Plantou' },
          { state: 'bad', label: 'Ficou parado' },
        ]}
      />,
    )

    expect(screen.getByText('Plantou').querySelector('[data-state="good"]')).not.toBeNull()
    expect(screen.getByText('Ficou parado').querySelector('[data-state="bad"]')).not.toBeNull()
  })

  it('o quadrinho sem certeza da legenda também tem o "?", escondido do leitor de tela', () => {
    render(<StripLegend items={[{ state: 'unknown', label: 'Sem certeza' }]} />)

    const cell = screen.getByRole('listitem').querySelector('[data-state="unknown"]')
    expect(cell).toHaveTextContent('?')
    expect(cell).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('StripLegend com nota', () => {
  it('mostra uma nota no fim (ex.: o período)', () => {
    render(<StripLegend items={[{ state: 'good', label: 'Choveu o bastante' }]} note="2006–2025" />)

    expect(screen.getByText('2006–2025')).toBeInTheDocument()
  })
})

describe('ToneBadge', () => {
  it('selo com ícone e texto, no tom pedido', () => {
    render(<ToneBadge tone="orange" icon={<svg data-testid="icone" />}>Sinal de ano seco</ToneBadge>)

    const badge = screen.getByText('Sinal de ano seco').closest('[data-tone]')
    expect(badge).toHaveAttribute('data-tone', 'orange')
    expect(screen.getByTestId('icone')).toBeInTheDocument()
  })
})

describe('TappableYearStrip (tocar num ano, P1)', () => {
  const years = [
    { year: 2006, state: 'good' as const, marker: null, text: 'Em 2006, choveu o bastante.' },
    { year: 2007, state: 'bad' as const, marker: 'el_nino' as const, text: 'Em 2007, ficou 18 dias sem chuva. Ano de El Niño.' },
  ]
  const renderStrip = () =>
    render(
      <TappableYearStrip
        label="Anos de chuva"
        years={years}
        openLabel={(year) => `Ver o ano ${year}`}
        stateLabel={(state) => (state === 'good' ? 'Choveu o bastante' : 'Faltou chuva')}
        closeLabel="Fechar"
      />,
    )

  it('cada ano é um botão; tocar abre o que aconteceu naquele ano', async () => {
    renderStrip()

    const year = screen.getByRole('button', { name: 'Ver o ano 2007: Faltou chuva' })
    expect(year).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(year)

    expect(year).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: '2007' })).toHaveTextContent('ficou 18 dias sem chuva. Ano de El Niño.')
  })

  it('tocar de novo ou em "Fechar" fecha o painel', async () => {
    renderStrip()
    const year = screen.getByRole('button', { name: 'Ver o ano 2006: Choveu o bastante' })

    await userEvent.click(year)
    await userEvent.click(year)
    expect(screen.queryByRole('region', { name: '2006' })).not.toBeInTheDocument()

    await userEvent.click(year)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('region', { name: '2006' })).not.toBeInTheDocument()
  })

  it('marca o ano de El Niño ou La Niña com um ponto', () => {
    renderStrip()

    expect(screen.getByRole('button', { name: /2007/ }).querySelector('[data-marker="el_nino"]')).not.toBeNull()
  })
})

describe('StripLegend com os pontos de El Niño e La Niña', () => {
  it('mostra os pontos na legenda', () => {
    render(
      <StripLegend
        items={[{ state: 'good', label: 'Choveu o bastante' }]}
        markers={[
          { kind: 'el_nino', label: 'El Niño' },
          { kind: 'la_nina', label: 'La Niña (NOAA)' },
        ]}
      />,
    )

    expect(screen.getByText('El Niño').querySelector('[data-marker="el_nino"]')).not.toBeNull()
    expect(screen.getByText('La Niña (NOAA)').querySelector('[data-marker="la_nina"]')).not.toBeNull()
  })
})

describe('NotConnected (dado que a API ainda não manda)', () => {
  it('mostra o aviso com um traço no lugar do dado, marcado como não conectado', () => {
    render(<NotConnected label="Ainda não conectado" />)

    const note = screen.getByText('Ainda não conectado').closest('[data-status]')
    expect(note).toHaveAttribute('data-status', 'not-connected')
    expect(note?.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('pode dizer o que ainda não está conectado', () => {
    render(<NotConnected label="Ainda não conectado" what="Custo da semente" />)

    expect(screen.getByText('Ainda não conectado').closest('[data-status]')).toHaveTextContent(
      'Custo da semente: Ainda não conectado',
    )
  })
})
