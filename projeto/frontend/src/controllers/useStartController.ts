import { useCallback, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { speechService, type SpeechService } from '../services/speechService'
import { useListenSummary, type ListenSummaryState } from './useListenSummary'

export type StartSourcesState = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** "Todas as fontes e créditos": fecha este modal e abre o modal global de créditos. */
  onAllCredits: () => void
}

/**
 * Controller da tela Início (tarefa 0052): o "Ouvir resumo" com o resumo falado da tela e o modal
 * "De onde vêm os dados", aberto pelo selo da foto. `openCredits` vem da moldura (o modal de créditos é global).
 */
export function useStartController(
  openCredits: () => void,
  speech: SpeechService = speechService,
): { listen: ListenSummaryState; sources: StartSourcesState } {
  const { lang, messages: t } = useI18n()
  const listen = useListenSummary(t.start.summary, lang, speech)
  const [open, setOpen] = useState(false)
  const onOpen = useCallback(() => setOpen(true), [])
  const onClose = useCallback(() => setOpen(false), [])
  const onAllCredits = useCallback(() => {
    setOpen(false)
    openCredits()
  }, [openCredits])

  return { listen, sources: { open, onOpen, onClose, onAllCredits } }
}
