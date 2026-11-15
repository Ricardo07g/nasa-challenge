const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Nome acessível de um link que abre em nova aba: o texto visível e o aviso escondido
 * (" (abre em nova aba)", com o espaço dentro do aviso, para o sublinhado não passar do texto).
 * O navegador lê com o espaço; o cálculo do Testing Library junta os pedaços sem ele, então o espaço é opcional.
 */
export function newTabName(text: string, notice = '(abre em nova aba)'): RegExp {
  return new RegExp(`^${escapeRegExp(text)} ?${escapeRegExp(notice)}$`)
}
