import { ChipGroup } from '../design-system/components/Choice'
import { AnswerTabs, BackLink } from '../design-system/components/Navigation'
import type { AnswerNav } from '../controllers/useAnswerNav'
import type { Messages } from '../i18n/messages.pt'
import { OBJETIVOS } from '../models/recomendacao'
import layout from './layout.module.css'

/**
 * Topo das três abas da resposta (tarefa 0044): "Voltar", as abas (Sugestão, Comparar, Plano de 3 anos) e
 * o seletor "O que você quer mais?". A escolha fica na URL e vale nas três abas.
 */
export function AnswerHeader({ t, nav }: { t: Messages; nav: AnswerNav }) {
  const o = t.suggestion.objective
  return (
    <>
      <BackLink to={nav.backTo}>{t.nav.back}</BackLink>
      <AnswerTabs label={nav.label} tabs={nav.tabs} />
      <section aria-label={o.label} className={layout.stack}>
        <h2 className={layout.cardTitle}>{o.label}</h2>
        <ChipGroup
          label={o.label}
          options={OBJETIVOS.map((value) => ({ value, label: o[value] }))}
          value={nav.objective}
          onChange={nav.chooseObjective}
          allowDeselect
        />
        <p className={layout.muted}>{nav.objective ? o.hint[nav.objective] : o.hintNone}</p>
      </section>
    </>
  )
}
