/** Atraso artificial do mock, para a interface mostrar os estados de "carregando" como na vida real. */
export function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}
