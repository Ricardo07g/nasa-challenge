import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { StartView } from './StartView'

describe('StartView (tela 1)', () => {
  it('mostra a pergunta, os passos e leva para as próximas telas', () => {
    render(
      <MemoryRouter>
        <StartView t={pt} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'O que plantar depois da soja?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Começar' })).toHaveAttribute('href', '/onde')
    expect(screen.getByRole('link', { name: 'Ver um exemplo pronto' })).toHaveAttribute('href', '/exemplo')
    expect(screen.getByText('2 perguntas · 1 minuto · grátis, sem cadastro')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('tem a foto da lavoura no Cerrado, o slogan e o selo dos dados da NASA', () => {
    render(
      <MemoryRouter>
        <StartView t={pt} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: 'Fileiras de lavoura no Cerrado brasileiro' })).toBeInTheDocument()
    expect(screen.getByText('Do espaço até a raiz.')).toBeInTheDocument()
    expect(screen.getByText('MVP · região de Uberlândia e Uberaba')).toBeInTheDocument()
  })

  it('diz que esta primeira versão funciona na região de Uberlândia e Uberaba e que vamos ampliar', () => {
    // Tarefa 0051 (RF-35): o selo da foto some no celular, então a frase fica no texto da tela.
    render(
      <MemoryRouter>
        <StartView t={pt} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Para quem planta soja no Triângulo Mineiro')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Nesta primeira versão (MVP), o app funciona na região de Uberlândia e Uberaba (MG). Vamos ampliar para todo o Triângulo Mineiro.',
      ),
    ).toBeInTheDocument()
  })

  it('explica os 3 passos com um texto curto em cada', () => {
    render(
      <MemoryRouter>
        <StartView t={pt} />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { level: 2, name: 'Uma boa próxima safra começa com uma boa escolha.' }),
    ).toBeInTheDocument()
    const steps = screen.getAllByRole('listitem')
    expect(steps[0]).toHaveTextContent('1. Marque a lavoura')
    expect(steps[0]).toHaveTextContent('Um ponto no mapa. É só isso.')
    expect(steps[2]).toHaveTextContent('O melhor caminho para a sua terra.')
  })

  it('em inglês', () => {
    render(
      <MemoryRouter>
        <StartView t={en} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'What to plant after soybeans?' })).toBeInTheDocument()
    expect(screen.getByText('MVP · Uberlândia and Uberaba region')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This first version (MVP) works in the Uberlândia and Uberaba region (Minas Gerais, Brazil). We will expand to the whole Triângulo Mineiro.',
      ),
    ).toBeInTheDocument()
  })

  it('com o bot configurado, oferece conversar pelo Telegram (P5)', () => {
    render(
      <MemoryRouter>
        <StartView t={pt} telegramHref="https://t.me/BotDoTime" />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Prefere conversar? Fale com o Raiz Orbital no Telegram' })
    expect(link).toHaveAttribute('href', 'https://t.me/BotDoTime')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('sem o bot configurado, não fala do Telegram', () => {
    render(
      <MemoryRouter>
        <StartView t={pt} />
      </MemoryRouter>,
    )

    expect(screen.queryByText(/Telegram/)).not.toBeInTheDocument()
  })

  it('a promessa do produto não traz número que pareça medido (nada de "20 anos")', () => {
    render(
      <MemoryRouter>
        <StartView t={pt} />
      </MemoryRouter>,
    )

    expect(screen.getByText('O satélite da NASA olha a chuva de muitos anos na sua lavoura. Veja a melhor opção.')).toBeInTheDocument()
    expect(screen.queryByText(/20 anos/)).not.toBeInTheDocument()
  })
})
