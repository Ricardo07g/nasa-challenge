import { COLHEITAS, type Colheita, type Talhao } from '../models/talhao'
import type { DelayCost } from './delayCostService'
import { bandDate, type HarvestChoice, type HarvestWindow } from './harvestService'
import { rainLeft } from './rainLeftService'

/** Uma época de colheita em "Compare as épocas" (modal grande da tela 2) e na prévia das 3 barrinhas. */
export type HarvestBand = {
  band: Colheita
  /** O dia usado na chuva: o escolhido, na época da escolha; senão, o dia de colheita da época no motor. */
  day: string
  /** Chuva que sobra até o fim de junho (mediana, mm); null sem o dado ou com o dia fora da tabela. */
  rainMm: number | null
  /** A melhor opção do motor nessa época e em quantos anos deu certo; null sem opção na janela de plantio. */
  best: { crop: string; good: number; total: number } | null
  /** É a época do produtor ("sua época"). */
  yours: boolean
}

/**
 * As 3 épocas lado a lado (tarefa 0057): a chuva que sobra vem da tabela do backend (`chuva_que_sobra`) e a
 * melhor opção, com o "deu certo em X de Y", do motor (`/api/custo-atraso`). Nada é recalculado aqui.
 */
export function harvestBands(
  talhao: Talhao | undefined,
  cost: DelayCost | null,
  choice: HarvestChoice | null,
  window: HarvestWindow,
): HarvestBand[] {
  return COLHEITAS.map((band) => {
    const yours = choice?.band === band
    const day = yours && choice?.date ? choice.date : bandDate(band, window)
    const best = cost?.bands.find((item) => item.band === band)
    return {
      band,
      day,
      rainMm: rainLeft(talhao, day)?.medianMm ?? null,
      best: best ? { crop: best.crop, good: best.good, total: best.total } : null,
      yours,
    }
  })
}
