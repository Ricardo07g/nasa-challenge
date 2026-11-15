import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { speechService, type SpeechService } from '../services/speechService'
import { useListenSummary, type ListenSummaryState } from './useListenSummary'

type Deps = { speech?: SpeechService }

export type CommunitySoonState = {
  /** "← Voltar": a resposta, se o link antigo trouxer o caminho da lavoura; senão, a Início. */
  backTo: string
  /** "Abrir o Guia". */
  guideTo: string
  listen: ListenSummaryState
}

/**
 * Comunidade "em breve" (`/comunidade`, pacote 3, tarefa 0061): a rota continua existindo para os links antigos,
 * mas mostra só o cartão "Em breve" com o "Abrir o Guia". Nenhum relato é pedido nem mostrado.
 */
export function useCommunitySoonController(deps: Deps = {}): CommunitySoonState {
  const { lang, messages: t } = useI18n()
  const [search] = useSearchParams()
  const params = readFlowParams(search)
  const listen = useListenSummary(t.comingSoon.summary, lang, deps.speech ?? speechService)
  return {
    backTo: params?.colheita ? `/resposta${keepFlowQuery(search.toString())}` : '/',
    guideTo: '/guia',
    listen,
  }
}
