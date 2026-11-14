import type { Colheita, Ponto } from '../models/talhao'

export type TelegramService = {
  /** Só liga com o endereço do bot do time configurado (VITE_TELEGRAM_BOT_URL). */
  enabled: boolean
  /** Link do bot com o ponto e a colheita no código de início (`?start=`). */
  linkFor(params: (Ponto & { colheita?: Colheita }) | null): string | null
}

/** Código de início do Telegram: `latx10000_lonx10000_colheita` (até 64 caracteres). */
function startCode(params: Ponto & { colheita?: Colheita }): string {
  const lat = Math.round(params.lat * 10000)
  const lon = Math.round(params.lon * 10000)
  return `${lat}_${lon}_${params.colheita ?? 'meio'}`.slice(0, 64)
}

/**
 * P5: cartão do Telegram (só front-end). Sem o endereço do bot do time, nada aparece: o app não
 * promete um serviço que não existe nem manda o produtor para um bot de terceiros.
 */
export function createTelegramService(baseUrl: string | undefined): TelegramService {
  const base = baseUrl?.trim() || null
  return {
    enabled: base !== null,
    linkFor(params) {
      if (!base) return null
      if (!params) return base
      const url = new URL(base)
      url.searchParams.set('start', startCode(params))
      return url.toString()
    },
  }
}

export const telegramService = createTelegramService(import.meta.env.VITE_TELEGRAM_BOT_URL)
