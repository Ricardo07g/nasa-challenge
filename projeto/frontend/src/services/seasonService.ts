import type { Lang } from '../i18n/language'

/**
 * Safra, não ano (regra geral 4 do pacote 2): toda tela nomeia pela safra. A safra é contada pelo **ano da
 * colheita da soja**: 2026 = safra 2025/26 (soja plantada no fim de 2025 e colhida no começo de 2026; o
 * "depois da soja" vai de março a julho de 2026).
 */

/** A safra atual: 2026/27 (soja plantada agora, colheita prevista no começo de 2027). Muda só aqui. */
export const CURRENT_SEASON = 2027

/** As 3 safras antes da atual (as que o produtor confirma): 2023/24, 2024/25 e 2025/26. */
export const LAST_SEASONS: readonly number[] = [CURRENT_SEASON - 3, CURRENT_SEASON - 2, CURRENT_SEASON - 1]

const twoDigits = (year: number) => String(year % 100).padStart(2, '0')

/** 2026 → "2025/26". */
export function seasonName(harvestYear: number): string {
  return `${harvestYear - 1}/${twoDigits(harvestYear)}`
}

/** O que o satélite leu da safra (janeiro a julho do ano da colheita): "jan–jul 2024" / "Jan–Jul 2024". */
export function satellitePeriod(harvestYear: number, lang: Lang): string {
  return lang === 'pt' ? `jan–jul ${harvestYear}` : `Jan–Jul ${harvestYear}`
}

/** O "depois da soja", curto (plano de 3 anos): "mar–jul de 2027" / "Mar–Jul 2027". */
export function afterSoyPeriod(harvestYear: number, lang: Lang): string {
  return lang === 'pt' ? `mar–jul de ${harvestYear}` : `Mar–Jul ${harvestYear}`
}

/** O "depois da soja", por extenso (perguntas): "de março a julho de 2024" / "March to July 2024". */
export function afterSoyMonths(harvestYear: number, lang: Lang): string {
  return lang === 'pt' ? `de março a julho de ${harvestYear}` : `March to July ${harvestYear}`
}

/** Quando a soja da safra foi plantada e colhida: "plantada no fim de 2023, colhida no começo de 2024". */
export function soyPeriod(harvestYear: number, lang: Lang): string {
  const planted = harvestYear - 1
  return lang === 'pt'
    ? `plantada no fim de ${planted}, colhida no começo de ${harvestYear}`
    : `planted in late ${planted}, harvested in early ${harvestYear}`
}
