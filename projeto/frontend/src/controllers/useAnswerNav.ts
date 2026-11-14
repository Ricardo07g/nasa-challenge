import { useLocation } from 'react-router'
import type { AnswerTab } from '../design-system/components/Navigation'
import { useI18n } from '../i18n/useI18n'
import { keepFlowQuery } from '../services/flowParams'

export type AnswerNav = { label: string; tabs: AnswerTab[]; backTo: string }

/** Abas das telas da resposta: mantêm o ponto na URL (RF-18) e marcam a tela atual. */
export function useAnswerNav(): AnswerNav {
  const { messages: t } = useI18n()
  const { pathname, search } = useLocation()
  const query = keepFlowQuery(search)
  const tabs = [
    { path: '/resposta', label: t.answerTabs.answer },
    { path: '/plano', label: t.answerTabs.plan },
    { path: '/opcoes', label: t.answerTabs.options },
  ]
  return {
    label: t.answerTabs.label,
    tabs: tabs.map((tab) => ({ to: `${tab.path}${query}`, label: tab.label, current: pathname === tab.path })),
    backTo: `/quando${query}`,
  }
}
