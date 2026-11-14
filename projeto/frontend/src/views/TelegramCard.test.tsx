import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { TelegramCard } from './TelegramCard'

const href = 'https://t.me/BotDoTime?start=-189543_-481993_meio'

describe('TelegramCard (P5)', () => {
  it('convida a receber a resposta no Telegram e abre o bot em outra aba', () => {
    render(<TelegramCard t={pt} href={href} />)

    const card = screen.getByRole('region', { name: 'Receber no Telegram' })
    expect(card).toHaveTextContent('A resposta em áudio no seu celular e um aviso se faltar chuva na sua lavoura.')
    const link = screen.getByRole('link', { name: 'Abrir no Telegram' })
    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('na safra passada, convida a ativar os avisos da próxima safra', () => {
    render(<TelegramCard t={pt} href={href} past />)

    expect(screen.getByText('Quer receber avisos assim na próxima safra? Ative no Telegram.')).toBeInTheDocument()
  })

  it('em inglês', () => {
    render(<TelegramCard t={en} href={href} />)

    expect(screen.getByRole('heading', { name: 'Receive on Telegram' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open in Telegram' })).toBeInTheDocument()
  })
})
