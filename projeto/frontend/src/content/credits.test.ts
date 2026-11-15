import { describe, expect, it } from 'vitest'
import { parseInline } from '../services/markdownService'
import { CREDITS } from './credits'

const allLines = (lang: 'pt' | 'en') => CREDITS[lang].groups.flatMap((group) => group.lines)
const groupText = (lang: 'pt' | 'en', id: string) =>
  (CREDITS[lang].groups.find((group) => group.id === id)?.lines ?? []).join('\n')

describe('créditos (modal global "Créditos e uso de IA", regra do NASA Space Apps)', () => {
  it('pt e en têm os mesmos grupos, na mesma ordem e com o mesmo número de linhas (uma por fonte)', () => {
    const shape = (lang: 'pt' | 'en') => CREDITS[lang].groups.map((group) => `${group.id}:${group.lines.length}`)

    expect(shape('en')).toEqual(shape('pt'))
    expect(shape('pt')).toEqual(['nasa:5', 'other:5', 'code:3', 'images:1'])
  })

  it('lista os dados da NASA usados', () => {
    const nasa = groupText('pt', 'nasa')

    for (const source of ['GPM IMERG Final', 'NASA POWER', 'NEX-GDDP-CMIP6', 'SSP2-4.5', 'SMAP L4', 'MODIS']) {
      expect(nasa).toContain(source)
    }
    expect(nasa).toContain('ORNL DAAC, MCD64A1, MCD12Q1')
  })

  it('lista os outros dados com a licença, o código, as fontes e os ícones', () => {
    const other = groupText('pt', 'other')
    const code = groupText('en', 'code')

    for (const source of ['SoilGrids', 'CC BY 4.0', 'NOAA CPC', 'ZARC (MAPA) e Embrapa', 'OpenStreetMap', 'ODbL', 'Photon']) {
      expect(other).toContain(source)
    }
    for (const item of ['React', 'Vite', 'FastAPI', 'PostgreSQL', 'PostGIS', 'Leaflet', 'Inter', 'Space Grotesk', 'SIL Open Font License', 'Lucide', 'ISC']) {
      expect(code).toContain(item)
    }
  })

  it('diz que a foto da tela inicial foi gerada por IA no Lovable', () => {
    expect(groupText('pt', 'images')).toMatch(/gerada por IA no \*\*Lovable\*\*, não é uma foto real/)
    expect(groupText('en', 'images')).toMatch(/AI-generated with \*\*Lovable\*\*, not a real photo/)
  })

  it('declara o uso de IA: Claude, Gemini e Lovable, e que nenhum número vem de IA', () => {
    expect(CREDITS.pt.ai.text).toMatch(/\*\*Claude\*\* \(Anthropic\), \*\*Gemini\*\* \(Google\) e \*\*Lovable\*\*/)
    expect(CREDITS.pt.ai.text).toContain('Nenhum número das telas vem de IA')
    expect(CREDITS.en.ai.text).toContain('No number on screen comes from AI')
  })

  it('nenhuma linha vazia nem negrito sem fechar', () => {
    for (const lang of ['pt', 'en'] as const) {
      const lines = [...allLines(lang), CREDITS[lang].ai.text]
      expect(lines.filter((line) => line.trim() === '')).toEqual([])
      const leftovers = lines.filter((line) => parseInline(line).some((part) => part.text.includes('**')))
      expect(leftovers).toEqual([])
    }
  })
})
