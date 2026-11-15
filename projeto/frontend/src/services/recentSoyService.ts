import type { Talhao } from '../models/talhao'

/**
 * Checagem do começo do fluxo (RF-24): o satélite não viu soja no ponto na safra mais recente, então o
 * ponto pode não ser a lavoura (cidade, cana, pasto). A tela avisa e deixa seguir. Viu soja, ou sem o
 * dado (nuvem, fora da área medida, API antiga): nenhum aviso.
 */
export function recentSoyWarning(talhao: Talhao | undefined): { safra: string } | null {
  const soja = talhao?.soja_recente
  return soja && soja.vista === false ? { safra: soja.safra } : null
}
