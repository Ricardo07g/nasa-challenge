import { describe, expect, it } from 'vitest'
import type { CropId, Opcao, Recomendacao } from '../models/recomendacao'
import {
  availableCrops,
  choiceFlow,
  comparedCrops,
  comparedFlow,
  consOf,
  defaultCompared,
  isLate,
  objectiveFlow,
  ownChoice,
  pickerItems,
  planChoice,
  rankAll,
  suggestionOf,
  toggleCompared,
  withCompared,
} from './choiceService'

function option(id: CropId, extra: Partial<Opcao> = {}): Opcao {
  return {
    id,
    nome: id,
    na_janela: true,
    fora_do_prazo: false,
    data_limite: '2027-03-20',
    chuva: { anos_bons: 15, anos: 20, faixa: [], rotulo: 'medio', texto: '' },
    futuro: null,
    renda: { da_grao: true, anos_aperto: 5, rotulo: 'medio', texto: '', risco: '' },
    terra: { nota: 50, rotulo: 'medio', texto: '' },
    notas: { seguranca: 50, futuro: null, solo: 50, renda: 50, final: 50 },
    porque: [],
    como_fazer: [],
    ...extra,
  }
}

const late = (id: CropId) => option(id, { na_janela: false, fora_do_prazo: true, data_limite: '2027-02-28' })

/** Colheita tarde da lavoura de demonstração (tarefa 0056): 2 no prazo, 3 fora do prazo. */
function lateHarvest(): Recomendacao {
  return {
    entrada: { celula_id: null, colheita: 'tarde', semeadura: '2027-03-03', solo: 'argiloso', nematoide: null },
    melhor: 'milheto',
    alternativas: [],
    opcoes: [option('milheto'), option('sorgo'), late('crotalaria'), late('milho_braquiaria'), late('milho_safrinha')],
    fora_da_janela: [],
    pousio: { texto: '' },
    plano_3_anos: {
      normal: { anos: ['milheto', 'milheto', 'sorgo'], nota: 60, descricao: '' },
      seco: { anos: ['milheto', 'milheto', 'sorgo'], nota: 60, descricao: '' },
      hoje: { anos: ['pousio', 'pousio', 'pousio'], nota: 0, descricao: '' },
    },
    versao_dados: '',
    aviso: '',
    objetivos: {
      equilibrio: { ordem: ['milheto', 'sorgo', 'crotalaria', 'milho_braquiaria', 'milho_safrinha'], plano: [], nota_plano: 0 },
      renda: { ordem: ['sorgo', 'milheto', 'milho_braquiaria', 'milho_safrinha', 'crotalaria'], plano: [], nota_plano: 0 },
    },
  }
}

describe('choiceService (aba "1. Escolher", tela 5 do pacote 2)', () => {
  it('fora do prazo: o campo da API, ou fora da janela numa API antiga', () => {
    expect(isLate(late('crotalaria'))).toBe(true)
    expect(isLate(option('sorgo'))).toBe(false)
    expect(isLate({ na_janela: false })).toBe(true)
  })

  it('todas as opções na ordem do motor para o objetivo, as fora do prazo no fim', () => {
    const rec = lateHarvest()
    expect(rankAll(rec, null).map((o) => o.id)).toEqual(['milheto', 'sorgo', 'crotalaria', 'milho_braquiaria', 'milho_safrinha'])
    expect(rankAll(rec, 'renda').map((o) => o.id)).toEqual(['sorgo', 'milheto', 'milho_braquiaria', 'milho_safrinha', 'crotalaria'])
  })

  it('sem a ordem do objetivo (API antiga): no prazo pelo eixo e as fora do prazo depois', () => {
    const rec = { ...lateHarvest(), objetivos: undefined }
    const ids = rankAll(rec, null).map((o) => o.id)
    expect(ids.slice(0, 2).sort()).toEqual(['milheto', 'sorgo'])
    expect(ids.slice(2).sort()).toEqual(['crotalaria', 'milho_braquiaria', 'milho_safrinha'])
  })

  it('a sugestão é a 1ª do objetivo que está no prazo, nunca uma fora do prazo', () => {
    const rec = lateHarvest()
    expect(suggestionOf(rec, null)?.id).toBe('milheto')
    expect(suggestionOf(rec, 'renda')?.id).toBe('sorgo')
    const onlyLate = { ...rec, opcoes: [late('crotalaria')], objetivos: undefined }
    expect(suggestionOf(onlyLate, null)).toBeNull()
  })

  it('as 6 culturas para escolher: as da recomendação, na ordem, e o "Deixar parado"', () => {
    expect(availableCrops(lateHarvest(), null)).toEqual(['milheto', 'sorgo', 'crotalaria', 'milho_braquiaria', 'milho_safrinha', 'pousio'])
  })

  it('a escolha do plano: a da URL, senão a escolha atual do raio-X, senão a sugestão', () => {
    const rec = lateHarvest()
    expect(planChoice(rec, null, { escolha: 'crotalaria', pensa: 'sorgo' })).toBe('crotalaria')
    expect(planChoice(rec, null, { pensa: 'sorgo' })).toBe('sorgo')
    expect(planChoice(rec, null, { pensa: 'nao_sei' })).toBe('milheto')
    expect(planChoice(rec, null, {})).toBe('milheto')
    expect(planChoice(rec, null, { pensa: 'pousio' })).toBe('pousio')
  })

  it('a escolha do próprio produtor (15/11/2026): só a da URL ou a que ele marcou no raio-X; sem marcar ou com "Ainda não sei", nenhuma', () => {
    const rec = lateHarvest()
    expect(ownChoice(rec, null, { escolha: 'crotalaria', pensa: 'sorgo' })).toBe('crotalaria')
    expect(ownChoice(rec, null, { pensa: 'sorgo' })).toBe('sorgo')
    expect(ownChoice(rec, null, { pensa: 'milho_braquiaria' })).toBe('milho_braquiaria')
    expect(ownChoice(rec, null, { pensa: 'pousio' })).toBe('pousio')
    expect(ownChoice(rec, null, { pensa: 'nao_sei' })).toBeNull()
    expect(ownChoice(rec, null, {})).toBeNull()
  })

  it('uma escolha que a recomendação não tem (API antiga sem as fora do prazo) cai para a sugestão', () => {
    const rec = { ...lateHarvest(), opcoes: [option('milheto'), option('sorgo')], objetivos: undefined }
    expect(planChoice(rec, null, { pensa: 'milho_safrinha' })).toBe('milheto')
  })

  it('a comparação já vem com a escolha e a sugestão; se forem a mesma, entra a próxima do ranking', () => {
    const ranked: CropId[] = ['milheto', 'sorgo', 'crotalaria']
    expect(defaultCompared(ranked, 'crotalaria', 'milheto')).toEqual(['crotalaria', 'milheto'])
    expect(defaultCompared(ranked, 'milheto', 'milheto')).toEqual(['milheto', 'sorgo'])
  })

  it('as culturas comparadas: as da URL que existem (até 3, o pousio vale); sem elas, as do padrão', () => {
    const rec = lateHarvest()
    expect(comparedCrops(rec, null, { comparar: ['sorgo', 'pousio', 'crotalaria'] })).toEqual(['sorgo', 'pousio', 'crotalaria'])
    expect(comparedCrops(rec, null, { pensa: 'sorgo' })).toEqual(['sorgo', 'milheto'])
    expect(comparedCrops(rec, 'renda', {})).toEqual(['sorgo', 'milheto'])
    const old = { ...rec, opcoes: [option('milheto'), option('sorgo')], objetivos: undefined }
    expect(comparedCrops(old, null, { comparar: ['milho_safrinha'] })).toEqual(['milheto', 'sorgo'])
  })

  it('marcar e desmarcar: até 3 e pelo menos 1', () => {
    expect(toggleCompared(['sorgo'], 'milheto')).toEqual(['sorgo', 'milheto'])
    expect(toggleCompared(['sorgo', 'milheto', 'pousio'], 'crotalaria')).toEqual(['sorgo', 'milheto', 'pousio'])
    expect(toggleCompared(['sorgo', 'milheto'], 'sorgo')).toEqual(['milheto'])
    expect(toggleCompared(['sorgo'], 'sorgo')).toEqual(['sorgo'])
  })

  it('a cultura escolhida entra na comparação; com 3, troca a última que não é a sugestão', () => {
    expect(withCompared(['sorgo', 'milheto'], 'sorgo', 'milheto')).toEqual(['sorgo', 'milheto'])
    expect(withCompared(['sorgo', 'milheto'], 'pousio', 'milheto')).toEqual(['sorgo', 'milheto', 'pousio'])
    expect(withCompared(['sorgo', 'crotalaria', 'milheto'], 'pousio', 'milheto')).toEqual(['sorgo', 'pousio', 'milheto'])
  })

  it('as caixinhas: marcadas, etiquetas e, com 3 marcadas, as outras desligadas; a única marcada não sai', () => {
    const items = pickerItems(['milheto', 'sorgo', 'crotalaria', 'pousio'], ['sorgo', 'milheto', 'crotalaria'], 'sorgo', 'milheto', new Set(['crotalaria']))
    expect(items).toEqual([
      { id: 'milheto', selected: true, disabled: false, choice: false, suggestion: true, late: false },
      { id: 'sorgo', selected: true, disabled: false, choice: true, suggestion: false, late: false },
      { id: 'crotalaria', selected: true, disabled: false, choice: false, suggestion: false, late: true },
      { id: 'pousio', selected: false, disabled: true, choice: false, suggestion: false, late: false },
    ])
    const one = pickerItems(['milheto', 'sorgo'], ['sorgo'], 'sorgo', 'milheto', new Set())
    expect(one.map((item) => item.disabled)).toEqual([false, true])
  })

  it('escolher para o plano grava a escolha, congela a comparação com ela e refaz os anos 2 e 3', () => {
    const params = { lat: 1, lon: 2, colheita: 'tarde' as const, ano2: 'pousio' as const, ano3: 'sorgo' as const }
    expect(choiceFlow(params, 'crotalaria', ['sorgo', 'milheto'], 'milheto')).toEqual({
      lat: 1,
      lon: 2,
      colheita: 'tarde',
      escolha: 'crotalaria',
      comparar: ['sorgo', 'milheto', 'crotalaria'],
      ano2: undefined,
      ano3: undefined,
    })
  })

  it('trocar o objetivo volta a comparação ao padrão; sem escolha gravada, o plano também volta', () => {
    const base = { lat: 1, lon: 2, comparar: ['sorgo' as const], ano2: 'pousio' as const }
    expect(objectiveFlow(base, 'renda')).toEqual({ lat: 1, lon: 2, objetivo: 'renda', comparar: undefined, ano2: undefined, ano3: undefined })
    expect(objectiveFlow({ ...base, escolha: 'sorgo' }, null)).toEqual({
      lat: 1,
      lon: 2,
      objetivo: undefined,
      comparar: undefined,
      escolha: 'sorgo',
      ano2: 'pousio',
    })
  })

  it('a comparação marcada vai para a URL', () => {
    expect(comparedFlow({ lat: 1, lon: 2 }, ['sorgo', 'pousio'])).toEqual({ lat: 1, lon: 2, comparar: ['sorgo', 'pousio'] })
  })

  it('"Contra": passou do prazo primeiro, depois os rótulos do motor', () => {
    expect(consOf(late('crotalaria'))[0]).toBe('late')
    expect(consOf(option('sorgo', { renda: { da_grao: false, anos_aperto: 0, rotulo: 'fraco', texto: '', risco: '' } }))).toEqual(['noGrain'])
  })
})
