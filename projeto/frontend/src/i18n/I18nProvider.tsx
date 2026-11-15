import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, type I18nValue } from './i18nContext'
import { detectLanguage, htmlLang, LANG_STORAGE_KEY, type Lang } from './language'
import { en } from './messages.en'
import { pt } from './messages.pt'

const dictionaries = { pt, en }

function readStored(): string | null {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // Sem localStorage (modo privado): a troca vale só nesta visita.
  }
}

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(
    () => initialLang ?? detectLanguage(readStored()),
  )

  useEffect(() => {
    document.documentElement.lang = htmlLang(lang)
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    writeStored(next)
  }, [])

  const toggleLang = useCallback(() => setLang(lang === 'pt' ? 'en' : 'pt'), [lang, setLang])

  const value = useMemo<I18nValue>(
    () => ({ lang, messages: dictionaries[lang], setLang, toggleLang }),
    [lang, setLang, toggleLang],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}
