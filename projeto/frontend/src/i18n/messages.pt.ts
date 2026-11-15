/**
 * Dicionário base (português). O tipo `Messages` sai daqui; o inglês precisa ter as mesmas chaves.
 * Textos do protótipo v3 (arquivos contexto/Raiz Orbital – Protótipo das telas.html).
 */
export const pt = {
  common: {
    appName: 'Raiz Orbital',
    loading: 'Carregando…',
    loadError: 'Não foi possível carregar agora.',
    retry: 'Tentar de novo',
    sampleValues: 'Valores de exemplo.',
    /** Aviso fixo em todas as telas com VITE_API_MODE=mock. */
    demoMode: 'Modo de demonstração: dados de exemplo, não são da NASA',
    disclaimer: 'Ajuda a decidir. Não substitui o seu agrônomo.',
    ready: 'Pronto',
  },
  header: {
    home: 'Raiz Orbital, voltar ao início',
    slogan: 'Do espaço até a raiz.',
    community: 'Comunidade',
    listen: 'Ouvir',
    stop: 'Parar',
    listenLabel: 'Ouvir esta tela',
    stopLabel: 'Parar a leitura',
    langToggleLabel: 'Trocar idioma: português ou inglês',
  },
  footer: {
    agronomist: 'Sou agrônomo(a): como a conta é feita',
    project: 'NASA Space Apps Challenge 2026 · Field Shift',
  },
  nav: {
    back: 'Voltar',
    backToAnswer: 'Resposta',
    backToPlan: 'Plano',
  },
  answerTabs: {
    label: 'Telas da resposta',
    answer: 'Resposta',
    plan: 'Plano de 3 anos',
    options: 'Todas as opções',
  },
  stepper: {
    label: (current: number, total: number) => `Pergunta ${current} de ${total}`,
  },
  labels: {
    bom: 'Bom',
    medio: 'Médio',
    fraco: 'Fraco',
  },
  axes: {
    chuva: 'Chuva',
    renda: 'Renda',
    terra: 'Terra',
  },
  harvest: {
    cedo: { title: 'Começo de fevereiro', sub: 'até dia 10', inline: 'começo de fevereiro' },
    meio: { title: 'Meio de fevereiro', sub: 'dia 11 a 20', inline: 'meio de fevereiro' },
    tarde: { title: 'Fim de fevereiro ou março', sub: 'depois do dia 20', inline: 'fim de fevereiro ou em março' },
  },
  soil: {
    arenoso: 'arenosa',
    medio: 'média',
    argiloso: 'argilosa',
  },
  motives: {
    menos_risco: 'Menos risco de seca',
    mais_renda: 'Mais renda',
    cuidar_da_terra: 'Cuidar da terra',
  },
  crops: {
    names: {
      milho_braquiaria: 'Milho com braquiária',
      milho_safrinha: 'Milho sozinho',
      sorgo: 'Sorgo',
      milheto: 'Milheto',
      crotalaria: 'Crotalária',
      pousio: 'Deixar parado',
    },
    taglines: {
      milho_braquiaria: 'Dá grão e cobre a terra.',
      milho_safrinha: 'Dá grão, mas deixa pouca palha.',
      sorgo: 'Dá grão com menos risco de seca.',
      milheto: 'Muita palha para cobrir a terra.',
      crotalaria: 'Adubo natural e quebra o nematoide.',
      pousio: 'A terra fica descoberta.',
    },
  },
  start: {
    pageTitle: 'Início',
    eyebrow: 'Para quem planta soja no Triângulo Mineiro',
    title: 'O que plantar depois da soja?',
    lead: 'O satélite da NASA olha a chuva de muitos anos na sua lavoura. Veja a melhor opção.',
    start: 'Começar',
    meta: '2 perguntas · 1 minuto · grátis, sem cadastro',
    example: 'Ver um exemplo pronto',
    stepMark: '1. Marque a lavoura',
    stepHarvest: '2. Diga quando colhe',
    stepAnswer: '3. Veja a resposta',
    stepMarkText: 'Um ponto no mapa. É só isso.',
    stepHarvestText: 'A época da sua colheita de soja.',
    stepAnswerText: 'O melhor caminho para a sua terra.',
    stepsTitle: 'Uma boa próxima safra começa com uma boa escolha.',
    stepsEyebrow: 'Da NASA para a sua lavoura',
    photoAlt: 'Fileiras de lavoura no Cerrado brasileiro',
    nasaData: 'dados da NASA',
    region: 'Triângulo Mineiro · MG',
  },
  where: {
    title: 'Onde fica a lavoura?',
    mapLabel: 'Mapa para marcar a lavoura. Arraste o mapa ou o alfinete até a lavoura.',
    near: (place: string) => `Perto de ${place}`,
    searchLabel: 'Buscar cidade, estrada ou endereço',
    searchHint: 'Também dá para colar as coordenadas, como -18.9543, -48.1993, ou um link do Google Maps.',
    searchList: 'Lugares encontrados',
    searching: 'Procurando…',
    searchFound: (count: number) =>
      count === 1
        ? 'Achamos 1 lugar. Toque nele, ou use as setas e o Enter.'
        : `Achamos ${count} lugares. Toque num deles, ou use as setas e o Enter.`,
    searchEmpty: 'Não achamos esse lugar. Tente outro nome ou arraste o mapa.',
    searchError: 'A busca não respondeu agora. Arraste o mapa ou cole as coordenadas.',
    goToCoordinates: 'Ir para as coordenadas',
    goToLink: 'Ir para o ponto do link',
    shortLink:
      'Esse é um link curto, e daqui não dá para ver o ponto dele. Abra o link no Google Maps, copie o endereço completo da barra do navegador e cole aqui. Ou cole as coordenadas do ponto.',
    linkWithoutPoint:
      'Não achamos as coordenadas nesse link. Cole o link completo do Google Maps ou as coordenadas, como -18.9543, -48.1993.',
    invalidCoordinates: 'Essas coordenadas não existem. A latitude vai de -90 a 90, e a longitude, de -180 a 180.',
    attribution: 'Endereços: © OpenStreetMap',
    areaLegend: 'Linha tracejada: área com dados',
    showArea: 'Ver a área inteira',
    useLocation: 'Usar onde estou agora',
    locating: 'Procurando onde você está…',
    locationError: 'Não conseguimos achar onde você está. Arraste o mapa até a lavoura.',
    help: 'Ou arraste o mapa até o alfinete ficar em cima da lavoura.',
    selected: (coordinates: string) => `Local escolhido: ${coordinates}`,
    confirm: 'Confirmar local',
    outsideTitle: 'Ainda não chegamos aí',
    outsideText:
      'Por enquanto, os dados estão prontos só para a região de Uberlândia e Uberaba. Veja como funciona na fazenda de exemplo.',
    outsideNotice: 'Por enquanto só temos dados da região de Uberlândia e Uberaba.',
    seeExample: 'Ver a fazenda de exemplo',
  },
  when: {
    title: 'Quando você colhe a soja?',
    /** Faixa azul: o que o satélite viu (tarefa 0042). Com o dia, a faixa vem do próprio dia. */
    suggestionDate: (date: string, band: string) =>
      `Pelo satélite (NDVI do MODIS), a soja daqui costuma secar por volta de ${date} (${band}).`,
    suggestionPrefix: 'Pelo satélite, a soja daqui costuma secar no',
    suggestionApplied: 'Já deixamos esse dia no campo.',
    suggestionSuffix: 'Já deixamos marcado.',
    useSuggestion: 'Usar o dia do satélite',
    /** Sem dado do satélite; "deixamos marcado" só enquanto o meio de fevereiro está marcado. */
    noSatellite: 'Não deu para ver pelo satélite quando a soja daqui seca.',
    defaultMarked: 'Deixamos marcado o meio de fevereiro.',
    defaultSuggestion: 'Não deu para ver pelo satélite. Deixamos marcado o meio de fevereiro.',
    hint: 'Não tem certeza? Deixe como está. Dá para mudar depois.',
    nextStep: 'Próximo passo',
    cta: 'Ver a resposta',
    dateLabel: 'Dia da colheita',
    dateBand: (date: string, band: string) => `Dia ${date}: conta como ${band}.`,
    dateNeed: 'Escolha um dia dentro da época de colheita.',
    dateEmpty: 'Coloque o dia ou toque em "Não sei o dia exato".',
    dontKnow: 'Não sei o dia exato',
    whyTitle: 'Por que perguntamos isso?',
    whyText:
      'A chuva vai acabando depois de março. Quanto mais cedo você colhe a soja, mais chuva sobra para a próxima planta.',
    /** Desenho de exemplo (só na página do design system). */
    chartLabel: 'Chuva média por mês: muita em janeiro, pouca em junho',
    chartCaption: 'Chuva de cada mês na região. Desenho de exemplo.',
    months: { jan: 'Jan', feb: 'Fev', mar: 'Mar', apr: 'Abr', may: 'Mai', jun: 'Jun' },
    /** "Saiba mais" para os artigos do Guia (seção 8). */
    learnMore: (title: string) => `Saiba mais: ${title}`,
    articles: {
      rainEnd: 'Quando a chuva acaba',
      sowSoon: 'Plantar logo depois da colheita',
      water: 'A conta de água da lavoura',
      worked: 'O que significa "deu certo"',
    },
    /** Chuva que sobra depois da colheita (até 30/jun; mediana e ano seco, tarefa 0042). */
    leftTitle: 'Chuva que sobra depois da colheita',
    leftExact: (date: string, median: string, dry: string) =>
      `Colhendo em ${date}, sobram em média ${median} mm; num ano seco, ${dry} mm.`,
    leftBand: (band: string, date: string, median: string, dry: string) =>
      `Colhendo no ${band} (por volta de ${date}), sobram em média ${median} mm; num ano seco, ${dry} mm.`,
    leftChartLabel: (date: string, median: string, dry: string) =>
      `Gráfico: quanto mais tarde a colheita, menos chuva sobra. Colhendo em ${date}, sobram ${median} mm em média e ${dry} mm num ano seco.`,
    leftLegendMedian: 'Em média',
    leftLegendDry: 'Ano seco',
    leftCaption: (end: string, first: number, last: number, source: string, pct: number) =>
      `Chuva somada do dia da colheita até ${end}. "Em média" é a mediana de ${first} a ${last}; num "ano seco", só ${pct}% dos anos tiveram menos chuva. Chuva medida pelo ${source}.`,
    /** Fim das chuvas na célula (regra no regras.yaml do backend). */
    endTitle: 'Quando a chuva acaba',
    endText: (median: string, earliest: string, latest: string) =>
      `Em metade dos anos, a chuva acabou até ${median}; o mais cedo foi ${earliest} e o mais tarde ${latest}.`,
    endYear: (date: string, year: number) => `${date} de ${year}`,
    endRule: (start: string, days: number, mm: string, source: string, first: number, last: number) =>
      `Fim da chuva: o primeiro dia, a partir de ${start}, que começa ${days} dias seguidos com menos de ${mm} mm somados. Chuva do ${source}, de ${first} a ${last}.`,
    /** Chuva e o que a lavoura gasta (ETo), mês a mês. */
    etoTitle: 'Chuva e o que a lavoura gasta, mês a mês',
    etoDeficit: (month: string) => `Em ${month}, a chuva média fica menor que o que a lavoura gasta.`,
    etoNoDeficit: 'De janeiro a junho, a chuva média cobre o que a lavoura gasta.',
    etoLegendRain: 'Chuva',
    etoLegendEto: 'Gasto da lavoura',
    etoTag: 'chove menos',
    etoChartLabel: (values: string) => `Chuva e gasto da lavoura em cada mês, em milímetros: ${values}`,
    etoMonthValue: (month: string, rain: string, eto: string) => `${month}, chuva ${rain} e gasto ${eto}`,
    etoCaption: (first: number, last: number, years: number, rainSource: string, etoSource: string) =>
      `${
        years === last - first + 1 ? `Média de ${first} a ${last}` : `Média de ${years} anos entre ${first} e ${last}`
      }, em mm. Chuva medida pelo ${rainSource}. Gasto da lavoura: a evapotranspiração de referência (ETo), calculada com o clima do ${etoSource}.`,
    /** Custo do atraso: a melhor opção do motor em cada faixa (tarefa 0042). */
    delayTitle: 'Quanto custa colher mais tarde',
    delayBand: { cedo: 'cedo', meio: 'no meio', tarde: 'tarde' },
    delayFirst: (band: string, good: number, total: number, crop: string | null) =>
      crop
        ? `Colhendo ${band}, ${crop} deu certo em ${good} de ${total} anos`
        : `Colhendo ${band}, deu certo em ${good} de ${total} anos`,
    delayNext: (band: string, good: number, total: number, crop: string | null) =>
      crop ? `${band}, ${crop}, ${good} de ${total}` : `${band}, ${good} de ${total}`,
    delaySame: (crop: string) => `A melhor opção é ${crop} nas três épocas.`,
    delayDiffers: 'A melhor opção muda com a época da colheita.',
    delayRow: (crop: string, good: number, total: number) => `${crop}: deu certo em ${good} de ${total} anos`,
    delayYours: 'sua escolha',
    delayNote: 'Resultado da conta do app para a melhor opção de cada época, com a chuva e o calor de cada ano.',
    /** RF-24: o satélite não viu soja no ponto marcado na última safra (aviso que deixa seguir). */
    soyWarning: (safra: string) =>
      `Não vimos soja neste ponto na última safra (${safra}). Confira se marcou a lavoura certa.`,
    soyAdjust: 'Ajustar no mapa',
    soyContinue: 'Seguir mesmo assim',
  },
  mission: {
    title: 'Missão: sua lavoura',
    intro: 'Estamos olhando sua lavoura do espaço',
    phases: [
      'Satélite em órbita',
      'Lendo a terra',
      'Chuva e calor de cada ano',
      'O que cresceu na sua área',
      'O clima que vem',
      'Fazendo a conta das 6 opções',
    ],
    found: (lat: string, lon: string) => `Lavoura encontrada: ${lat} / ${lon}`,
    /** Os anos vêm da conta (anos de chuva usados de fato). */
    rain: (years: number) => `Chuva e calor de ${years} anos lidos, dia a dia`,
    history: (years: number) => `${years} anos de histórico do satélite`,
    /** Clima de 2041–2060 (NEX-GDDP-CMIP6); a previsão do outono aparece à parte. */
    future: (start: string, end: string) => `Clima de ${start} a ${end} lido`,
    futureRead: 'Clima do futuro lido',
    forecast: (signal: string) => `Previsão do outono: ${signal}`,
    ready: 'Resposta pronta',
    collected: (count: number) => `Dados coletados ${count}/6`,
    complete: 'Missão completa!',
    continue: 'Ver o que o satélite viu',
    weak: 'O sinal está fraco. O satélite continua tentando.',
    wait: 'Esperar mais',
    touch: 'Toque no satélite 🙂',
    satellite: 'Satélite (toque para girar)',
  },
  signal: {
    normal: 'Sinal de ano normal',
    seco: 'Sinal de ano seco',
    incerto: 'Sem sinal claro',
  },
  satellite: {
    title: 'Pronto. O satélite já viu o resto.',
    subtitle: 'Você não precisa preencher mais nada.',
    /** Conta só os anos certos; os sem certeza vão no parêntese. */
    historyTitle: (idle: number, known: number, uncertain: number) =>
      `Sua área ficou parada em ${idle} de ${known} anos${uncertain > 0 ? ` (${uncertain} sem certeza)` : ''}`,
    historySubtitle: 'O que cresceu depois da soja, ano a ano:',
    historyStripLabel: (planted: number, known: number, uncertain: number) =>
      `Plantou em ${planted} de ${known} anos${uncertain > 0 ? ` (${uncertain} sem certeza)` : ''}`,
    historySource: (from: string, to: string) => `Visto pelo satélite MODIS (NASA), de ${from} a ${to} de cada ano`,
    planted: 'Plantou',
    idle: 'Ficou parado',
    uncertain: 'Sem certeza',
    /** O número vem do dado: o backend descarta ano com dia faltando. */
    rainTitle: (years: number) => `${years} anos de chuva daqui`,
    rainSubtitle: (start: string, end: string, skipped: number) =>
      `De ${start} a ${end}, dia por dia.${
        skipped > 0 ? ` ${skipped === 1 ? '1 ano ficou' : `${skipped} anos ficaram`} de fora por falta de dado.` : ''
      }`,
    rainDaily: 'Dia por dia.',
    soilTitle: (texture: string) => `Terra ${texture}`,
    soilFromMap: 'Do mapa de solos.',
    soilFromUser: 'Você escolheu.',
    soilDefault: 'Não achamos no mapa de solos; usamos terra média.',
    soilChange: 'Não é? Trocar',
    soilChoose: 'Qual é a sua terra?',
    soilOptions: {
      arenoso: { title: 'Arenosa', sub: 'Solta, seca rápido' },
      medio: { title: 'Média', sub: 'Nem muito solta, nem pesada' },
      argiloso: { title: 'Argilosa', sub: 'Pesada, gruda na bota' },
    },
    close: 'Fechar',
    loading: 'Buscando dados do satélite…',
    error: 'Não conseguimos buscar os dados agora. Tente de novo ou veja a fazenda de exemplo.',
    climateTitle: 'Clima dos próximos anos',
    /** O período vem do NEX-GDDP-CMIP6 em dados[] (2041–2060). */
    climateSubtitle: (start: string, end: string) => `Como a chuva e o calor devem mudar de ${start} a ${end}.`,
    climateSubtitleGeneric: 'Como a chuva e o calor devem mudar nos próximos anos.',
    cta: 'Ver o que plantar',
    /** Tarefa 0039: ano em que o satélite não viu a soja e a colheita (legenda da faixa). */
    noSoy: 'Sem soja',
    noSoyTitle: 'Não parece uma lavoura de soja. Confira o ponto no mapa.',
    noSoyDetail: 'O satélite não viu a soja crescer e ser colhida aqui nos anos que conseguiu olhar.',
    adjustMap: 'Ajustar no mapa',
    /** Legenda da faixa: anos em que vale a resposta do produtor. */
    historyConfirmed: (count: number) => (count === 1 ? '1 ano confirmado por você' : `${count} anos confirmados por você`),
    confirmTitle: 'Confirme as últimas safras',
    confirmHint: 'O que você fez depois da soja? Sua resposta vale no lugar do satélite.',
    /** Rótulo do grupo de botões de cada ano (leitor de tela). */
    confirmYear: (year: number) => `Depois da soja de ${year}`,
    confirmPlanted: 'Plantei',
    confirmIdle: 'Deixei parado',
    satelliteSaw: (what: string) => `O satélite viu: ${what}`,
    satelliteSawLabels: { plantou: 'plantou', parado: 'ficou parado', incerto: 'sem certeza', sem_soja: 'sem soja' },
  },
  answer: {
    lead: (year: number) => `Depois da soja de ${year}, na sua lavoura:`,
    best: 'A melhor opção',
    plantUntil: 'Plante logo depois de colher a soja, até',
    plantSoon: 'Plante logo depois de colher a soja.',
    rainStripLabel: (good: number, total: number) =>
      `${good} anos bons e ${total - good} anos com falta de água`,
    why: 'Por quê?',
    close: 'Fechar',
    lateWarning: (crops: string, count: number) =>
      `Já não dá tempo: ${crops} ${count === 1 ? 'fica' : 'ficam'} fora da janela de plantio.`,
    rainEnough: 'Choveu o bastante',
    rainShort: 'Faltou chuva',
    /** O período vem do talhão (dados[]); o backend pode descartar ano com dia faltando. */
    rainYears: (years: number, start: string, end: string) => `${years} anos entre ${start} e ${end}`,
    rainYearsCount: (years: number) => `${years} anos`,
    /** Clima de 2041–2060 (NEX-GDDP-CMIP6), no cartão da resposta e em cada opção. */
    future: 'Clima 2041–2060',
    /** O total é o mesmo da chuva; sem faixa quando todos os modelos dão o mesmo número. */
    futureYears: (good: number, total: number, range: { min: number; max: number } | null) =>
      `Daria certo em ${good} de ${total} anos${range ? ` (de ${range.min} a ${range.max}, conforme o modelo)` : ''}`,
    yearOpen: (year: number) => `Ver o ano ${year}`,
    ensoNino: 'El Niño',
    ensoNina: 'La Niña (NOAA)',
    howTitle: 'Como fazer',
    howNote: 'Dose de semente e herbicida: combine com o seu agrônomo.',
    seePlan: 'Ver plano de 3 anos',
    seeAll: 'Ver todas as opções',
    prefer: 'Se você prefere…',
  },
  options: {
    title: 'Todas as opções',
    sortLabel: 'Colocar na frente quem é melhor em:',
    rank: (position: number) => `${position}º`,
    fallowRain: 'Não depende de chuva',
    fallowIncome: 'Não dá grão',
    fallowSoil: 'Fica descoberta',
    legend: (period: string) =>
      `Cada quadrinho é um ano (${period}). Cheio: choveu o bastante. Vazio: faltou chuva na hora que a planta mais precisa.`,
    outOfWindowTitle: 'Fora da janela de plantio',
    seePlan: 'Ver plano de 3 anos',
  },
  plan: {
    title: 'Plano de 3 anos',
    subtitle: 'O que plantar depois da soja, um ano de cada vez.',
    timelineLabel: 'Plano ano a ano',
    signalTitle: (year: number) => `Sinal para o outono de ${year}`,
    signalSource: (source: string, date: string) => `Chance de El Niño e La Niña publicada por ${source} em ${date}.`,
    signalMarks: (plan: string) => `O sinal marca o ${plan}.`,
    smapNote: 'A umidade de agora só informa: não muda o plano.',
    planChoice: 'Qual plano seguir',
    planA: 'Plano A',
    planB: 'Plano B, se secar',
    keepPlanB: 'Deixe o plano B na manga.',
    swapTagline: (from: string) => `No lugar de ${from}: aguenta mais a seca.`,
    plantingRule: (date: string, planA: string, planB: string) =>
      `No dia de plantar (até ${date}), se a terra estiver seca, use o plano B: ${planB} no lugar de ${planA}.`,
    rootWater: 'O satélite mede a água na raiz. Você não precisa adivinhar.',
    rainRuleNote: 'Meça a chuva no seu pluviômetro. A média vem da série de chuva do satélite no seu ponto.',
    withPlan: 'Com plano',
    today: 'Como é hoje',
    coveredAll: (total: number) => `Terra coberta nos ${total} anos`,
    coveredSome: (covered: number, total: number) => `Terra coberta em ${covered} de ${total} anos`,
    grainYears: (grain: number, total: number) => `Grão em ${grain} de ${total} anos`,
    gainTitle: 'O ganho vem na soja seguinte',
    gainText:
      'Num estudo no Cerrado, a soja depois de grão com braquiária rendeu 11% a mais do que depois de terra parada.',
    gainNote: 'Referência ilustrativa; estudo a confirmar.',
    regionLink: 'Ver o que acontece na sua região',
  },
  past: {
    button: (year: number) => `Como teria sido em ${year}?`,
    title: (year: number) => `Como teria sido a safrinha de ${year}`,
    text: (year: number) =>
      `Repetimos a chuva e o calor de ${year} (dados da NASA) com a melhor opção. Estes são os avisos que você teria recebido.`,
    choose: 'Escolha o ano',
    seco: (year: number) => `${year} · ano seco`,
    bom: (year: number) => `${year} · ano bom`,
    noWarnings: 'Nenhum aviso nesta safra.',
    note: 'Valores de exemplo. No app, o ano e as datas vêm dos dados reais.',
  },
  telegram: {
    title: 'Receber no Telegram',
    text: 'A resposta em áudio no seu celular e um aviso se faltar chuva na sua lavoura.',
    past: 'Quer receber avisos assim na próxima safra? Ative no Telegram.',
    open: 'Abrir no Telegram',
    home: 'Prefere conversar? Fale com o Raiz Orbital no Telegram',
    methodTitle: 'Também no Telegram',
    method:
      'Mande a localização da lavoura e diga quando colhe a soja. O bot responde em texto e em áudio, com o link desta página. Quem quiser recebe avisos de falta de chuva e calor. Em português e em inglês.',
  },
  report: {
    button: 'Relatório para banco ou seguro',
    savePdf: 'Salvar em PDF',
    title: 'Relatório da lavoura · Raiz Orbital',
    place: 'Local e data',
    coords: (coords: string) => `Coordenadas: ${coords}`,
    today: (date: string) => `Data de hoje: ${date}`,
    dataVersion: (version: string) => `Versão dos dados: ${version}`,
    best: 'Opção recomendada e semeadura planejada',
    sowing: (date: string) => `Semeadura em ${date} · dentro da janela de plantio`,
    sowingOut: (date: string) => `Semeadura em ${date} · fora da janela de plantio`,
    table: 'Todas as opções',
    headers: {
      crop: 'Opção',
      years: 'Anos que deram certo',
      future: 'Clima 2041–2060',
      income: 'Renda',
      soil: 'Terra',
    },
    /** Anos bons de N: os dois números vêm da API (chuva.anos_bons e chuva.anos). */
    yearsOf: (good: number, total: number) => `${good} de ${total}`,
    /** Clima de 2041–2060: média dos modelos e, quando eles discordam, a faixa entre eles. */
    futureOf: (good: number, total: number, range: { min: number; max: number } | null) =>
      `${good} de ${total}${range ? ` (de ${range.min} a ${range.max})` : ''}`,
    history: 'Histórico da área',
    idle: (idle: number, known: number, uncertain: number) =>
      `Ficou parada em ${idle} de ${known} anos${uncertain > 0 ? ` (${uncertain} sem certeza)` : ''}`,
    sources: 'Fontes',
    footer: 'Ajuda a decidir. Não é laudo técnico, não substitui o ZARC oficial nem o agrônomo responsável.',
  },
  community: {
    title: 'Na sua região',
    regionSubtitle: (km: number) => `Até ${km} km da sua lavoura · visto pelo satélite`,
    regionSubtitleAway: (km: number, distance: number) =>
      `Raio de ${km} km em volta de um ponto a ${String(distance).replace('.', ',')} km da sua lavoura · visto pelo satélite`,
    /** Porcentagem com vírgula ('0,8%'), no jeito do português. */
    regionPct: (pct: number) => `${String(pct).replace('.', ',')}%`,
    regionBig: (year: number, pct: number) =>
      `Em ${year}, ${String(pct).replace('.', ',')}% da área de soja ficou parada depois da colheita.`,
    regionCompare: (idle: number, known: number, uncertain: number, average: number) =>
      `Sua área: parada em ${idle} de ${known} anos${uncertain > 0 ? ` (${uncertain} sem certeza)` : ''}. Na região, em média ${String(average).replace('.', ',')}% da área fica parada.`,
    regionAverage: (average: number) =>
      `Na região, em média ${String(average).replace('.', ',')}% da área fica parada depois da soja.`,
    regionChart: '% da área de soja parada depois da colheita, ano a ano.',
    regionNote: (pct: number) =>
      `Estimativa pelo satélite MODIS (NASA), pixel de 250 m. Em ${String(pct).replace('.', ',')}% da área o satélite não conseguiu dizer. Mostramos só o total da região, nunca uma fazenda.`,
    bridge: 'O satélite mostra quanto a região deixa a terra parada. Os vizinhos contam se valeu a pena plantar.',
    communityTitle: 'O que os vizinhos contam',
    illustrative: 'Valores ilustrativos',
    subtitle: (km: number, place: string, count: number) =>
      `Até ${km} km de ${place} · ${count} produtores participando`,
    neighborsTitle: (year: number) => `O que os vizinhos plantaram depois da soja em ${year}`,
    liked: (liked: number, total: number) =>
      total === 1 ? `${liked} de 1 gostou` : `${liked} de ${total} gostaram`,
    dotsLabel: (liked: number, total: number) => `${liked} de ${total} vizinhos gostaram`,
    dotsCaption: 'Cada bolinha é um vizinho. Cheia = gostou do resultado.',
    tellMine: 'Contar como foi a minha',
    mapLabel: 'Mapa da região com pluviômetros e o que cada vizinho plantou',
    legendGauge: 'Pluviômetro',
    legendPlanted: 'Plantou',
    legendIdle: 'Parado',
    rainTitle: 'Choveu aqui',
    yesterday: 'ontem',
    reading: (gauge: number, satellite: number) => `${gauge} mm · satélite ${satellite} mm`,
    rainNote:
      'O pluviômetro de vocês corrige a chuva do satélite na região e melhora a conta de risco de todo mundo.',
    registerRain: 'Registrar a chuva de hoje',
    privacy:
      'O mapa mostra a região, nunca a posição exata das fazendas. Nome só aparece com autorização. Valores ilustrativos.',
    simulated: 'Tela simulada: o registro ainda não está ligado.',
    demoOnly: 'Esta é uma demonstração. Nenhum dado será enviado ou guardado.',
  },
  method: {
    title: 'Como a conta é feita',
    subtitle: 'Em três passos, e o que o satélite não enxerga.',
    /** O período vem do talhão (dados[]) e dos anos usados de fato. */
    step1: (years: string) => `Pegamos a chuva e o calor de cada ano (${years}), no ponto do seu talhão.`,
    step1Generic: 'Pegamos a chuva e o calor de cada ano no ponto do seu talhão.',
    step2: 'Para cada opção, simulamos a água na terra dia a dia, a partir da data de semeadura.',
    step3: 'Contamos em quantos anos faltou água ou sobrou calor na fase em que a planta mais precisa.',
    noAiTitle: 'Sem inteligência artificial, conta aberta',
    noAiText:
      'Cada nota é uma regra que cabe numa frase. Os limites de falta de água e de calor vêm da Embrapa e do ZARC, o zoneamento usado no seguro e no crédito rural.',
    validationTitle: 'Bateu com o que aconteceu?',
    validationText:
      'Em breve: os anos de aperto calculados comparados com os anos de quebra do milho 2ª safra em Uberlândia (IBGE).',
    /** Tarefa 0040: a nota de renda sem preço nem custo (regra no regras.yaml do backend, grupo `renda`). */
    incomeTitle: 'Renda sem valores em reais',
    incomeText:
      'A renda não usa preço nem custo. Quem dá grão para vender ganha na renda a mesma nota da segurança: em quantos anos deu certo, de 0 a 100. Quem não dá grão (as plantas de cobertura e a terra parada) fica com nota fixa na renda, hoje zero: é investimento na terra, e isso conta na nota da terra.',
    incomeShown:
      'Na resposta, a renda mostra só fatos: se dá grão para vender e em quantos anos faltou água ou fez calor.',
    blindTitle: 'O que o satélite não enxerga',
    /** O tamanho vem da fonte de chuva conectada: IMERG (10 km) ou NASA POWER (~50 km). */
    blindRain: (km: number) =>
      `A chuva vem em quadrados de cerca de ${km} km, não do seu talhão: seu pluviômetro vale mais.`,
    blindRainGeneric: 'A chuva vem de quadrados de vários quilômetros, não do seu talhão: seu pluviômetro vale mais.',
    blindRest:
      'O clima de 2041 a 2060 é uma faixa entre modelos, não uma previsão. Os limites ainda serão ajustados com agrônomos da região.',
    sourcesTitle: 'De onde vem cada dado',
    /** Uma por fonte do produto; a tela mostra só as que a API manda de fato (decisão D2). */
    sources: {
      nasa_power: { what: 'Chuva e calor, dia a dia', source: 'NASA POWER', scale: 'cerca de 50 km, por dia' },
      gpm_imerg: { what: 'Chuva mais detalhada', source: 'GPM IMERG (NASA)', scale: 'quadrados de 10 km, por dia' },
      smap: { what: 'Umidade da terra', source: 'SMAP L4 (NASA)', scale: '9 km, a cada 3 horas' },
      modis: { what: 'Histórico do talhão', source: 'MODIS (NASA)', scale: '250 m, a cada 16 dias' },
      nex_gddp_cmip6: { what: 'Clima de 2041 a 2060', source: 'NEX-GDDP-CMIP6 (NASA)', scale: 'cerca de 28 km, por dia' },
      soilgrids: { what: 'Tipo de terra', source: 'SoilGrids (ISRIC)', scale: '250 m' },
    },
    scoresTitle: 'Notas de cada opção (0 a 100)',
    scoresHeaders: {
      crop: 'Opção',
      safety: 'Segurança',
      future: 'Futuro',
      soil: 'Terra',
      income: 'Renda',
      final: 'Final',
    },
    exampleFarm: 'Fazenda de exemplo: área experimental da UFU, Uberlândia (MG).',
    disclaimer: 'Apoio à decisão: confirme com o seu agrônomo antes de comprar a semente.',
  },
  guide: {
    title: 'Guia',
    subtitle: 'Respostas curtas para as dúvidas mais comuns da lavoura.',
    communityLink: 'Guia: dúvidas e respostas curtas',
    searchLabel: 'Buscar pelo título',
    searchPlaceholder: 'Buscar artigo',
    noResults: 'Nenhum artigo com esse título.',
    back: 'Voltar ao Guia',
    notFound: 'Não achamos esse artigo.',
    draft: 'Rascunho: a revisar pela agrônoma.',
    draftBadge: 'Rascunho',
    plantAlt: (name: string) => `Desenho de ${name}`,
    themes: {
      cultures: 'Culturas',
      planting: 'Plantar',
      soil: 'Cuidar da terra',
      climate: 'Clima, água e dados',
      safety: 'Segurança',
    },
    plants: {
      milho_safrinha: 'milho safrinha',
      milho_braquiaria: 'milho com braquiária',
      sorgo: 'sorgo',
      milheto: 'milheto',
      crotalaria: 'crotalária',
      pousio: 'terra parada',
    },
  },
  designSystem: {
    title: 'Design system',
    intro: 'Tokens e componentes da interface. Esta página só existe no ambiente local.',
    colors: 'Cores',
    typography: 'Tipografia',
    shapes: 'Raios e espaços',
    icons: 'Ícones',
    components: 'Componentes',
    environment: 'Ambiente',
    apiMode: (mode: string) => `Modo dos dados: ${mode}`,
    backendStatus: (status: string) => `Backend: ${status}`,
    cropOptions: 'Opções de entressafra (API real)',
    sampleText: 'O satélite da NASA olha a chuva de muitos anos na sua lavoura.',
  },
}

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> }

export type Messages = Widen<typeof pt>
