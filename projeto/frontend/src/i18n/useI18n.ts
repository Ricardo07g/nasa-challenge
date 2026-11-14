import { useContext } from 'react'
import { I18nContext, type I18nValue } from './i18nContext'

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error('useI18n precisa estar dentro de <I18nProvider>')
  }
  return value
}
