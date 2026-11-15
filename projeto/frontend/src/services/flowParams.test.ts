import { describe, expect, it } from 'vitest'
import { buildFlowQuery, keepFlowQuery, readFlowParams } from './flowParams'

describe('readFlowParams', () => {
  it('lê ponto, colheita e solo da URL', () => {
    const params = readFlowParams(new URLSearchParams('lat=-18.92&lon=-48.28&colheita=tarde&solo=argiloso'))

    expect(params).toEqual({ lat: -18.92, lon: -48.28, colheita: 'tarde', solo: 'argiloso', exemplo: false })
  })

  it('sem colheita ou solo, deixa indefinido', () => {
    const params = readFlowParams(new URLSearchParams('lat=-18.92&lon=-48.28'))

    expect(params).toEqual({ lat: -18.92, lon: -48.28, colheita: undefined, solo: undefined, exemplo: false })
  })

  it('reconhece a fazenda de exemplo', () => {
    expect(readFlowParams(new URLSearchParams('lat=-18.92&lon=-48.28&colheita=meio&exemplo=1'))?.exemplo).toBe(true)
  })

  it('lê as safras confirmadas pelo produtor, em ordem de ano (tarefa 0039)', () => {
    const params = readFlowParams(new URLSearchParams('lat=-18&lon=-48&confirmadas=2026:parado,2024:plantou'))

    expect(params?.confirmadas).toBe('2024:plantou,2026:parado')
  })

  it('safra confirmada fora do formato fica de fora; nenhuma válida = indefinido', () => {
    expect(readFlowParams(new URLSearchParams('lat=-18&lon=-48&confirmadas=2024:talvez'))?.confirmadas).toBeUndefined()
    expect(readFlowParams(new URLSearchParams('lat=-18&lon=-48'))?.confirmadas).toBeUndefined()
  })

  it('ignora valores inválidos', () => {
    expect(readFlowParams(new URLSearchParams('lat=abc&lon=-48'))).toBeNull()
    expect(readFlowParams(new URLSearchParams('lon=-48'))).toBeNull()
    expect(readFlowParams(new URLSearchParams('lat=-18&lon=-48&colheita=junho'))?.colheita).toBeUndefined()
    expect(readFlowParams(new URLSearchParams('lat=-18&lon=-48&solo=pedra'))?.solo).toBeUndefined()
  })
})

describe('buildFlowQuery', () => {
  it('monta a query na ordem lat, lon, colheita, solo, exemplo', () => {
    expect(buildFlowQuery({ lat: -18.92, lon: -48.28, colheita: 'meio', solo: 'medio', exemplo: true })).toBe(
      '?lat=-18.92&lon=-48.28&colheita=meio&solo=medio&exemplo=1',
    )
  })

  it('as safras confirmadas vão no fim, legíveis (dá para compartilhar o link)', () => {
    expect(buildFlowQuery({ lat: -18.92, lon: -48.28, colheita: 'meio', confirmadas: '2024:plantou,2025:parado' })).toBe(
      '?lat=-18.92&lon=-48.28&colheita=meio&confirmadas=2024:plantou,2025:parado',
    )
  })

  it('arredonda o ponto em 4 casas (cerca de 10 m)', () => {
    expect(buildFlowQuery({ lat: -18.923456789, lon: -48.2812345 })).toBe('?lat=-18.9235&lon=-48.2812')
  })
})

describe('keepFlowQuery', () => {
  it('repassa o ponto, a colheita e o exemplo da URL atual para o próximo link', () => {
    expect(keepFlowQuery('?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1&x=lixo')).toBe(
      '?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1',
    )
  })

  it('repassa as safras confirmadas para as telas seguintes', () => {
    expect(keepFlowQuery('?lat=-18.9543&lon=-48.1993&colheita=meio&confirmadas=2025:parado')).toBe(
      '?lat=-18.9543&lon=-48.1993&colheita=meio&confirmadas=2025:parado',
    )
  })

  it('sem ponto na URL, não repassa nada', () => {
    expect(keepFlowQuery('')).toBe('')
    expect(keepFlowQuery('?colheita=meio')).toBe('')
  })

  it('repassa o objetivo do produtor entre as abas (tarefa 0044)', () => {
    expect(keepFlowQuery('?lat=-18.9543&lon=-48.1993&colheita=meio&objetivo=terra&ano=2016')).toBe(
      '?lat=-18.9543&lon=-48.1993&colheita=meio&objetivo=terra',
    )
  })
})

describe('objetivo do produtor na URL (tarefa 0044)', () => {
  it('lê só os objetivos conhecidos; sem objetivo vale o equilíbrio do motor', () => {
    const read = (query: string) => readFlowParams(new URLSearchParams(query))?.objetivo
    expect(read('lat=1&lon=2&objetivo=seguranca')).toBe('seguranca')
    expect(read('lat=1&lon=2&objetivo=renda')).toBe('renda')
    expect(read('lat=1&lon=2&objetivo=dinheiro')).toBeUndefined()
    expect(read('lat=1&lon=2')).toBeUndefined()
  })

  it('o objetivo vai antes das safras confirmadas', () => {
    expect(buildFlowQuery({ lat: 1, lon: 2, colheita: 'meio', objetivo: 'renda', confirmadas: '2025:parado' })).toBe(
      '?lat=1&lon=2&colheita=meio&objetivo=renda&confirmadas=2025:parado',
    )
  })
})

describe('culturas comparadas, plano editado e "como é hoje" na URL (tarefa 0045)', () => {
  const read = (query: string) => readFlowParams(new URLSearchParams(`lat=1&lon=2&${query}`))

  it('lê até 3 culturas para comparar, sem repetir, sem o pousio e só ids conhecidos', () => {
    expect(read('comparar=sorgo,milheto')?.comparar).toEqual(['sorgo', 'milheto'])
    expect(read('comparar=sorgo,sorgo,trigo,pousio,crotalaria')?.comparar).toEqual(['sorgo', 'crotalaria'])
    expect(read('comparar=sorgo,milheto,crotalaria,milho_safrinha')?.comparar).toEqual(['sorgo', 'milheto', 'crotalaria'])
    expect(read('comparar=')?.comparar).toBeUndefined()
  })

  it('lê o plano editado só com 3 culturas conhecidas (o pousio vale)', () => {
    expect(read('plano=sorgo,pousio,crotalaria')?.plano).toEqual(['sorgo', 'pousio', 'crotalaria'])
    expect(read('plano=sorgo,crotalaria')?.plano).toBeUndefined()
    expect(read('plano=sorgo,trigo,crotalaria')?.plano).toBeUndefined()
  })

  it('lê o que o produtor contou das últimas safras, em ordem de ano', () => {
    expect(read('hoje=2026:sorgo,2024:pousio,2025:trigo,x')?.hoje).toBe('2024:pousio,2026:sorgo')
    expect(read('hoje=')?.hoje).toBeUndefined()
  })

  it('monta a URL com os três no fim e sem codificar ":" e ",", para o link ficar legível', () => {
    expect(
      buildFlowQuery({
        lat: 1,
        lon: 2,
        colheita: 'meio',
        comparar: ['sorgo', 'milheto'],
        plano: ['sorgo', 'pousio', 'crotalaria'],
        hoje: '2024:pousio',
        confirmadas: '2025:parado',
      }),
    ).toBe(
      '?lat=1&lon=2&colheita=meio&confirmadas=2025:parado&comparar=sorgo,milheto&plano=sorgo,pousio,crotalaria&hoje=2024:pousio',
    )
  })

  it('repassa os três entre as abas', () => {
    expect(keepFlowQuery('?lat=1&lon=2&colheita=meio&plano=sorgo,sorgo,sorgo&ano=2016')).toBe(
      '?lat=1&lon=2&colheita=meio&plano=sorgo,sorgo,sorgo',
    )
  })
})

describe('data da colheita, últimas safras e escolha atual na URL (pacote 2, tarefa 0054)', () => {
  const read = (query: string) => readFlowParams(new URLSearchParams(`lat=1&lon=2&${query}`))

  it('lê a data da colheita da tela 2 (AAAA-MM-DD) só se for uma data de verdade', () => {
    expect(read('data=2027-03-03')?.data).toBe('2027-03-03')
    expect(read('data=2027-02-30')?.data).toBeUndefined()
    expect(read('data=3/3/2027')?.data).toBeUndefined()
    expect(read('')?.data).toBeUndefined()
  })

  it('lê as respostas das últimas safras em ordem de ano; nenhuma válida = indefinido', () => {
    expect(read('safras=2026:sem_soja,2024:milho_braquiaria,2025:pousio')?.safras).toBe(
      '2024:milho_braquiaria,2025:pousio,2026:sem_soja',
    )
    expect(read('safras=2024:feijao')?.safras).toBeUndefined()
  })

  it('lê a escolha atual: uma cultura ou "nao_sei"', () => {
    expect(read('pensa=sorgo')?.pensa).toBe('sorgo')
    expect(read('pensa=nao_sei')?.pensa).toBe('nao_sei')
    expect(read('pensa=soja')?.pensa).toBeUndefined()
  })

  it('não inventa safras a partir do confirmadas e do hoje antigos (quem lê os links velhos é o service)', () => {
    expect(read('confirmadas=2025:parado&hoje=2024:sorgo')?.safras).toBeUndefined()
  })

  it('monta a URL com a data depois da colheita e as respostas no fim, legíveis', () => {
    expect(
      buildFlowQuery({
        lat: 1,
        lon: 2,
        colheita: 'tarde',
        data: '2027-03-03',
        objetivo: 'renda',
        safras: '2024:milho_braquiaria,2025:pousio',
        pensa: 'nao_sei',
      }),
    ).toBe('?lat=1&lon=2&colheita=tarde&data=2027-03-03&objetivo=renda&safras=2024:milho_braquiaria,2025:pousio&pensa=nao_sei')
  })

  it('repassa a data, as safras e a escolha atual entre as telas', () => {
    expect(keepFlowQuery('?lat=1&lon=2&data=2027-02-18&safras=2025:soja&pensa=milheto&ano=2016')).toBe(
      '?lat=1&lon=2&data=2027-02-18&safras=2025:soja&pensa=milheto',
    )
  })
})
