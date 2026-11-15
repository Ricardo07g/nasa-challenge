import { describe, expect, it } from 'vitest'
import type { Opcao, Recomendacao } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { guideService } from './guideService'
import {
  COMPARE_ARTICLES,
  compareChips,
  comparedCrops,
  failureCounts,
  toggleCompared,
  whyAvoid,
  whyUse,
} from './compareService'

const meio = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
const tarde = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'tarde' }, 'pt')
const option = (rec: Recomendacao, id: Opcao['id']) => rec.opcoes.find((o) => o.id === id)!

describe('compareService (aba Comparar, tarefa 0045)', () => {
  it('por padrão, as 3 melhores para o objetivo', () => {
    expect(comparedCrops(meio, null, undefined)).toEqual(meio.objetivos!.equilibrio!.ordem.slice(0, 3))
    expect(comparedCrops(meio, 'terra', undefined)).toEqual(meio.objetivos!.terra!.ordem.slice(0, 3))
  })

  it('a escolha da URL vale, sem as culturas que não cabem na janela desta colheita', () => {
    expect(comparedCrops(meio, null, ['sorgo', 'milheto'])).toEqual(['sorgo', 'milheto'])
    expect(comparedCrops(tarde, null, ['milho_safrinha', 'sorgo'])).toEqual(['sorgo'])
    expect(comparedCrops(tarde, 'renda', ['milho_safrinha'])).toEqual(tarde.objetivos!.renda!.ordem.slice(0, 3))
  })

  it('os chips: as da janela na ordem do objetivo, com a sede; as fora da janela desligadas, com a data', () => {
    const chips = compareChips(tarde, null, ['sorgo'])

    expect(chips.map((chip) => chip.id)).toEqual([...tarde.objetivos!.equilibrio!.ordem, 'milho_safrinha'])
    expect(chips.find((chip) => chip.id === 'sorgo')).toMatchObject({ selected: true, disabled: false, sede: 'media' })
    expect(chips.at(-1)).toMatchObject({
      id: 'milho_safrinha',
      nome: 'Milho sozinho',
      selected: false,
      disabled: true,
      limit: '2027-02-28',
    })
  })

  it('tocar põe ou tira; no máximo 3 e nunca nenhuma', () => {
    expect(toggleCompared(['sorgo'], 'milheto')).toEqual(['sorgo', 'milheto'])
    expect(toggleCompared(['sorgo', 'milheto'], 'sorgo')).toEqual(['milheto'])
    expect(toggleCompared(['sorgo', 'milheto', 'crotalaria'], 'milho_braquiaria')).toEqual([
      'sorgo',
      'milheto',
      'crotalaria',
    ])
    expect(toggleCompared(['sorgo'], 'sorgo')).toEqual(['sorgo'])
  })

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

  it('os artigos da linha Terra (palhada, adubo verde e nematoide) existem em pt e en', () => {
    for (const path of Object.values(COMPARE_ARTICLES)) {
      const slug = path.replace('/guia/', '')
      expect(guideService.get('pt', slug)).not.toBeNull()
      expect(guideService.get('en', slug)).not.toBeNull()
    }
  })
})
