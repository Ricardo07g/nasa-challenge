import { useSearchParams } from 'react-router'
import { readFlowParams } from '../services/flowParams'
import { telegramService, type TelegramService } from '../services/telegramService'

/**
 * Link para o bot do Telegram (P5), com o ponto e a colheita da URL quando houver.
 * Sem o bot configurado (`VITE_TELEGRAM_BOT_URL`), devolve null e as telas não falam do Telegram.
 */
export function useTelegramLink(telegram: TelegramService = telegramService): string | null {
  const [search] = useSearchParams()
  if (!telegram.enabled) return null
  const params = readFlowParams(search)
  return telegram.linkFor(params ? { lat: params.lat, lon: params.lon, colheita: params.colheita } : null)
}
