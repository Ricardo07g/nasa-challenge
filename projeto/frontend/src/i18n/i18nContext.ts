import { createContext } from 'react'
import type { Lang } from './language'
import type { Messages } from './messages.pt'

export type I18nValue = {
  lang: Lang
  messages: Messages
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

export const I18nContext = createContext<I18nValue | null>(null)
