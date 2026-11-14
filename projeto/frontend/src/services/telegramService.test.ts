import { describe, expect, it } from 'vitest'
import { createTelegramService } from './telegramService'

const params = { lat: -18.9543, lon: -48.1993, colheita: 'meio' as const }

describe('telegramService (cartão do Telegram, P5)', () => {
  it('sem o endereço do bot configurado, o Telegram fica desligado', () => {
    const telegram = createTelegramService(undefined)

    expect(telegram.enabled).toBe(false)
    expect(telegram.linkFor(params)).toBeNull()
  })

  it('o link abre o bot com o ponto e a colheita no código de início', () => {
    const telegram = createTelegramService('https://t.me/BotDoTime')

    expect(telegram.enabled).toBe(true)
    expect(telegram.linkFor(params)).toBe('https://t.me/BotDoTime?start=-189543_-481993_meio')
  })

  it('sem caminho na URL, abre o bot sem código; sem colheita, usa meio', () => {
    const telegram = createTelegramService('https://t.me/BotDoTime')

    expect(telegram.linkFor(null)).toBe('https://t.me/BotDoTime')
    expect(telegram.linkFor({ lat: -18.9543, lon: -48.1993 })).toBe('https://t.me/BotDoTime?start=-189543_-481993_meio')
  })
})
