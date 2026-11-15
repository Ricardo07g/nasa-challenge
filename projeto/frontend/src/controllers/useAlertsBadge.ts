import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import {
  alertsPoint,
  avisosService,
  headerCount,
  pointFromFlow,
  viewPointFromFlow,
  type AvisosService,
} from '../services/avisosService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'

/**
 * Botão "Avisos" do cabeçalho (tarefa 0046 do backend): guarda no aparelho o último ponto marcado no
 * fluxo (nunca a fazenda de exemplo) e mostra quantos avisos ativos ele tem. Sem ponto, sem aviso ou com
 * falha da API, o botão fica sem número. O pedido é o mesmo da tela (um por ponto e idioma na visita).
 * Pacote 3 (tela 7): o número é o do ponto que a tela de avisos mostra (na lavoura de demonstração, o dela) e
 * conta só os avisos que a tela mostra (`headerCount`), para o sino e o resumo da tela dizerem o mesmo.
 */
export function useAlertsBadge(avisos: AvisosService = avisosService): { to: string; count: number | null } {
  const { lang } = useI18n()
  const { search } = useLocation()
  const params = useMemo(() => readFlowParams(new URLSearchParams(search)), [search])
  const flow = useMemo(() => pointFromFlow(params), [params])
  const shown = useMemo(() => viewPointFromFlow(params), [params])

  useEffect(() => {
    if (flow) avisos.savePoint(flow)
  }, [flow, avisos])

  const point = useMemo(() => alertsPoint(shown, avisos.savedPoint()), [shown, avisos])
  const key = point ? `${lang}|${JSON.stringify(point)}` : ''
  const [result, setResult] = useState<{ key: string; count: number | null } | null>(null)

  useEffect(() => {
    if (!point) return
    let active = true
    avisos.get(point, lang).then(
      (data) => active && setResult({ key, count: headerCount(data) }),
      () => active && setResult({ key, count: null }),
    )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` resume o ponto e o idioma
  }, [key, avisos])

  return { to: `/avisos${keepFlowQuery(search)}`, count: result && result.key === key ? result.count : null }
}
