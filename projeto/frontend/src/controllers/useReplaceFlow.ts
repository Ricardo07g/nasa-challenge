import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { buildFlowQuery, type FlowParams } from '../services/flowParams'

/**
 * Navegar sem rolar (regra geral 2 do pacote 2): clicar numa opção (chip, botão, rádio, caixinha, select)
 * nunca muda a posição da tela. Quando a escolha vai para a URL, troque o endereço com estes hooks: eles usam
 * `replace` (sem entrada nova no histórico, o "Voltar" do navegador continua levando à tela anterior) e
 * `preventScrollReset` (o `ScrollRestoration` da moldura não sobe a tela). Para ir a OUTRA tela, use o
 * `navigate` comum: aí a tela nova começa do topo.
 */

/** Troca o endereço (caminho e query prontos) sem criar entrada no histórico e sem rolar. */
export function useReplaceUrl(): (to: string) => void {
  const navigate = useNavigate()
  return useCallback((to: string) => void navigate(to, { replace: true, preventScrollReset: true }), [navigate])
}

/** Grava o fluxo (`FlowParams`) na URL da tela atual, sem criar entrada no histórico e sem rolar. */
export function useReplaceFlow(): (params: FlowParams) => void {
  const replaceUrl = useReplaceUrl()
  const { pathname } = useLocation()
  return useCallback((params: FlowParams) => replaceUrl(`${pathname}${buildFlowQuery(params)}`), [replaceUrl, pathname])
}
