import { describe, expect, it } from 'vitest'
import type { Opcao, Recomendacao } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { failureCounts, whyAvoid, whyUse } from './compareService'

const meio = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
const option = (rec: Recomendacao, id: Opcao['id']) => rec.opcoes.find((o) => o.id === id)!

describe('compareService (a favor e contra da comparação)', () => {
  it('por que falhou: anos por falta de água e anos por calor, do explorador do motor', () => {
    const base = option(meio, 'sorgo')
    const details = [
      { ...base.anos_detalhe![0], bom: false, falta_agua: true, calor: false },
      { ...base.anos_detalhe![1], bom: false, falta_agua: true, calor: true },
      { ...base.anos_detalhe![2], bom: false, falta_agua: false, calor: true },
      { ...base.anos_detalhe![3], bom: true, falta_agua: false, calor: false },
    ]

    expect(failureCounts({ ...base, anos_detalhe: details })).toEqual({ water: 2, heat: 2, failed: 3 })
    expect(failureCounts({ ...base, anos_detalhe: [] })).toBeNull()
  })

  it('"Por que usar" e "Por que evitar" saem dos rótulos e da sede que o motor manda', () => {
    const strong: Opcao = {
      ...option(meio, 'milho_braquiaria'),
      chuva: { ...option(meio, 'milho_braquiaria').chuva, rotulo: 'bom' },
      renda: { ...option(meio, 'milho_braquiaria').renda, da_grao: true, rotulo: 'bom' },
      terra: { ...option(meio, 'milho_braquiaria').terra, rotulo: 'bom' },
      agua: { ...option(meio, 'milho_braquiaria').agua!, sede: 'pouca' },
      futuro: { anos_bons_media: 18, anos_bons_min: 17, anos_bons_max: 19, modelos: 3, cenario: 'ssp245' },
    }
    const weak: Opcao = {
      ...strong,
      chuva: { ...strong.chuva, anos_bons: 14, rotulo: 'fraco' },
      renda: { ...strong.renda, da_grao: false, rotulo: 'fraco' },
      terra: { ...strong.terra, rotulo: 'fraco' },
      agua: { ...strong.agua!, sede: 'muita' },
      futuro: { ...strong.futuro!, anos_bons_media: 12 },
    }

    expect(whyUse(strong)).toEqual(['safe', 'grain', 'soil', 'littleWater'])
    expect(whyAvoid(strong)).toEqual([])
    expect(whyUse(weak)).toEqual([])
    expect(whyAvoid(weak)).toEqual(['risky', 'noGrain', 'soilWeak', 'muchWater', 'futureWorse'])
  })

  it('sem a linha Água ou sem o CMIP6, nada de sede nem de clima futuro nos motivos', () => {
    const plain: Opcao = { ...option(meio, 'sorgo'), agua: null, futuro: null }

    expect(whyUse(plain)).not.toContain('littleWater')
    expect(whyAvoid(plain)).not.toContain('muchWater')
    expect(whyAvoid(plain)).not.toContain('futureWorse')
  })

})
