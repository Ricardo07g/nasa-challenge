import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { AnswerTab } from '../design-system/components/Navigation'
import { useI18n } from '../i18n/useI18n'
import type { Objetivo } from '../models/recomendacao'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from '../services/flowParams'

export type AnswerNav = {
  label: string
  tabs: AnswerTab[]
  backTo: string
  /** "O que você quer mais?" (tarefa 0044): null = equilíbrio (pesos padrão do motor). */
  objective: Objetivo | null
  chooseObjective: (value: Objetivo | null) => void
}

/**
 * Abas das telas da resposta (tarefa 0044: Sugestão, Comparar e Plano de 3 anos, nessa ordem): mantêm o
 * ponto e o objetivo do produtor na URL (RF-18) e marcam a tela atual. As URLs continuam as mesmas
 * (`/resposta`, `/opcoes`, `/plano`), para os links já compartilhados não quebrarem.
 */
export function useAnswerNav(): AnswerNav {
  const { messages: t } = useI18n()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const query = keepFlowQuery(search)
  const params = readFlowParams(new URLSearchParams(search))
  const objective = params?.objetivo ?? null
  const tabs = [
    { path: '/resposta', label: t.suggestion.tabs.suggestion },
    { path: '/opcoes', label: t.suggestion.tabs.compare },
    { path: '/plano', label: t.suggestion.tabs.plan },
  ]

  const chooseObjective = useCallback(
    (value: Objetivo | null) => {
      const current = readFlowParams(new URLSearchParams(search))
      if (!current) return
      // Só os parâmetros do caminho (o ano aberto no explorador fecha ao trocar o objetivo).
      navigate(`${pathname}${buildFlowQuery({ ...current, objetivo: value ?? undefined })}`, { replace: true })
    },
    [navigate, pathname, search],
  )

  return {
    label: t.answerTabs.label,
    tabs: tabs.map((tab) => ({ to: `${tab.path}${query}`, label: tab.label, current: pathname === tab.path })),
    backTo: `/quando${query}`,
    objective,
    chooseObjective,
  }
}
