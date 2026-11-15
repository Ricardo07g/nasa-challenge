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
    delayRow: (crop: string, good: number, total: number) => `${crop}, deu certo em ${good} de ${total} anos`,
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
      'Fazendo a conta',
    ],
    /** Tarefa 0049: o número de opções vem da conta (as que cabem na janela e deixar parado). */
    phaseOptions: (count: number) => `Fazendo a conta das ${count} opções`,
    found: (lat: string, lon: string) => `Lavoura encontrada: ${lat} / ${lon}`,
    /** Os anos vêm da conta (anos de chuva usados de fato). */
    /** A fonte da chuva vem da série (GPM IMERG ou NASA POWER); o calor é sempre do NASA POWER. */
    rain: (years: number, source: string | null) =>
      source === 'GPM IMERG'
        ? `Chuva do GPM IMERG e calor do NASA POWER: ${years} anos lidos, dia a dia`
        : source
          ? `Chuva e calor do ${source}: ${years} anos lidos, dia a dia`
          : `Chuva e calor de ${years} anos lidos, dia a dia`,
    history: (years: number) => `${years} anos de histórico do satélite (MODIS NDVI)`,
    soilFrom: (soil: string, source: string) => `${soil} (${source})`,
    burned: (start: string, end: string) => `Área queimada: MODIS MCD64A1, de ${start} a ${end}`,
    smap: (start: string, end: string) => `Umidade da terra no dia de plantar: SMAP, de ${start} a ${end}`,
    /** Clima de 2041–2060 (NEX-GDDP-CMIP6); a previsão do outono aparece à parte. */
    future: (start: string, end: string) => `Clima de ${start} a ${end} lido (NEX-GDDP-CMIP6)`,
    futureRead: 'Clima do futuro lido (NEX-GDDP-CMIP6)',
    forecast: (signal: string, source: string | null) =>
      source ? `Previsão do outono (${source}): ${signal}` : `Previsão do outono: ${signal}`,
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
  /** Raio-X da sua terra (tela 4, remodelagem S4, tarefa 0043): os números vêm do `/api/raio-x`. */
  xray: {
    panelTitle: 'Raio-X da sua terra',
    place: (name: string) => `Perto de ${name}`,
    coordinates: (coords: string) => `Ponto marcado: ${coords}`,
    mapLabel: (name: string) => `Miniatura do mapa com o ponto marcado, perto de ${name}`,
    latestReading: (date: string) => `Leitura mais recente: ${date}`,
    altitude: (meters: string) => `Altitude: ${meters} m`,
    footer:
      'Cada dado vale para a área em volta do ponto, no tamanho indicado em cada selo, e não para o talhão exato.',
    learnMore: (title: string) => `Saiba mais: ${title}`,
    articles: {
      xray: 'Como ler o raio-X da sua terra',
      dryspell: 'Veranico',
      heat: 'Calor de 35 °C na floração',
      frost: 'Geada na safrinha',
      fire: 'Fogo na palha',
      erosion: 'Como evitar erosão',
    },
    badges: {
      soil: 'SoilGrids · ISRIC · 250 m',
      water: 'SoilGrids + NASA POWER',
      moisture: 'SMAP · NASA · 9 km',
      green: 'MODIS · NASA · 250 m',
      rain: 'GPM IMERG · NASA · 10 km',
      dryspell: 'GPM IMERG · NASA · 10 km',
      heat: 'NASA POWER · ~50 km',
      region: 'GPM IMERG · NASA · 10 km',
    },
    soil: {
      label: 'Solo',
      unit: '% de argila',
      sentence: (texture: string) => `Terra ${texture}, pelo mapa de solos.`,
      neighbor: (km: string) => `A célula do ponto não tem dado de solo: usamos o ponto mais perto, a ${km} km.`,
      parts: { clay: 'Argila', silt: 'Silte', sand: 'Areia' },
      barLabel: (clay: number, silt: number, sand: number) => `Argila ${clay}%, silte ${silt}% e areia ${sand}%`,
      chosen: (texture: string) => `Você escolheu terra ${texture}: a conta da água usa a sua escolha.`,
    },
    water: {
      label: 'Água que a terra guarda',
      unit: 'mm',
      days: (days: number, crop: string, date: string) =>
        `Aguenta cerca de ${days} dias sem chuva na floração de ${crop}, por volta de ${date}.`,
      use: (use: string, eto: string, kc: string) =>
        `Nessa fase a planta gasta ${use} mm por dia (evapotranspiração de ${eto} mm do NASA POWER × Kc ${kc}).`,
      noCrop: 'É a água que a terra segura ao alcance das raízes.',
    },
    moisture: {
      label: 'Umidade da terra agora',
      sentence: (pct: number, date: string) => `Mais úmida que em ${pct}% dos anos nesta época. Leitura de ${date}.`,
      meterLabel: (pct: number) => `Umidade da terra agora: mais úmida que em ${pct}% dos anos nesta época`,
      low: 'mais seca',
      high: 'mais úmida',
    },
    green: {
      label: 'Verde da lavoura',
      unit: 'NDVI',
      last: (value: string, date: string) => `Última leitura: ${value}, em ${date}.`,
      peak: (value: string, season: string) => `Pico da soja ${season}: ${value}.`,
      peakOn: (value: string, season: string, date: string) => `Pico da soja ${season}: ${value}, em ${date}.`,
      /** Sem soja no ponto (tarefa 0049): o número é só o maior verde da janela do pico da soja. */
      peakNoSoy: (value: string, season: string, date: string | null) =>
        `Maior verde de janeiro a meados de março (${season}): ${value}${date ? `, em ${date}` : ''}. O satélite não viu soja aqui.`,
      scale: 'O NDVI vai de 0 (terra nua) a 1 (verde forte).',
    },
    rain: {
      label: 'Chuva de um ano típico',
      unit: 'mm de janeiro a julho',
      years: (years: number) => `Média de ${years} anos, medida pelo satélite GPM IMERG.`,
      end: (median: string, early: string, earlyYear: number, late: string, lateYear: number) =>
        `Em metade dos anos, a chuva acabou até ${median}; o mais cedo foi ${early} de ${earlyYear} e o mais tarde ${late} de ${lateYear}.`,
    },
    dryspell: {
      label: 'Maior veranico',
      unit: 'dias seguidos sem chuva',
      sentence: (year: number, start: string) =>
        `Em ${year}, a partir de ${start}: o maior trecho com menos de 1 mm por dia entre março e maio (GPM IMERG).`,
    },
    heat: {
      label: 'Calor',
      unit: (total: number) => `de ${total} anos`,
      sentence: (temp: string) => `Anos com algum dia de ${temp} °C ou mais entre março e maio (NASA POWER).`,
      years: (years: string) => `Foi em ${years}.`,
    },
    region: {
      label: 'Sua área e a região',
      drier: (pct: number) => `Em chuva de março a maio, sua área é mais seca que ${pct}% da região.`,
      wetter: (pct: number) => `Em chuva de março a maio, sua área é mais chuvosa que ${pct}% da região.`,
      detail: (mm: string, cells: number) =>
        `${mm} mm em média, comparada com ${cells} áreas de 10 km da região (GPM IMERG).`,
    },
    history: {
      title: (idle: number, total: number) => `Na entressafra, sua área ficou parada em ${idle} de ${total} anos.`,
      others: (uncertain: number, noSoy: number) =>
        [
          uncertain > 0 ? `${uncertain === 1 ? '1 ano' : `${uncertain} anos`} sem certeza` : '',
          noSoy > 0 ? `${noSoy === 1 ? '1 ano' : `${noSoy} anos`} sem soja` : '',
        ]
          .filter(Boolean)
          .join('; '),
      subtitle:
        'Cada linha é um ano. Cada quadrinho é uma leitura do satélite a cada 16 dias, de janeiro a julho: quanto mais escuro, mais verde.',
      label: (from: number, to: number, idle: number, total: number) =>
        `Verde da lavoura pelo satélite MODIS, de ${from} a ${to}: parada na entressafra em ${idle} de ${total} anos.`,
      marks: { soy: 'soja', harvest: 'colheita', offseason: 'entressafra' },
      tags: { plantou: 'plantou', parado: 'parada', incerto: 'sem certeza', sem_dado: 'sem leitura', sem_soja: 'sem soja' },
      byProducer: (tag: string) => `${tag} (você)`,
      legend: ['menos de 0,30', '0,30 a 0,45', '0,45 a 0,60', '0,60 a 0,75', '0,75 ou mais'],
      noData: 'sem leitura (nuvem)',
      cell: (column: string, value: string) => `${column}: NDVI ${value}`,
      cellEmpty: (column: string) => `${column}: sem leitura`,
      source:
        'NDVI do satélite MODIS (NASA), MOD13Q1 + MYD13Q1, pixel de 250 m. A colheita é o dia em que a soja costuma secar.',
    },
    alerts: {
      title: 'Alertas da sua área',
      frost: {
        title: 'Geada',
        text: (years: number, total: number, temp: string) =>
          `Em ${years} de ${total} anos, a mínima chegou a ${temp} °C ou menos entre maio e julho (NASA POWER).`,
      },
      heavyRain: {
        title: 'Chuva forte',
        text: (mean: string, limit: string, days: number, total: number) =>
          `Em média, ${mean} dia por ano com ${limit} mm ou mais em fevereiro e março (${days} dias em ${total} anos, GPM IMERG). Terra descoberta perde solo nesses dias.`,
      },
      fire: {
        title: 'Fogo',
        text: (km: string, years: number, total: number) =>
          `Houve fogo a até ${km} km do seu ponto em ${years} de ${total} anos (MODIS, NASA).`,
      },
    },
    cards: {
      rainTitle: (total: number) => `${total} anos de chuva`,
      rainValue: (good: number, total: number) => `${good} de ${total}`,
      rainText: (crop: string) => `anos em que ${crop} deu certo (GPM IMERG e NASA POWER).`,
      futureTitle: 'Clima 2041–2060',
      futureRain: (pct: string) => `Chuva de março a maio: ${pct}%`,
      futureHeat: (degrees: string) => `Máxima: ${degrees} °C`,
      agreeLess: (count: number, models: number) => `${count} de ${models} modelos indicam menos chuva`,
      agreeMore: (count: number, models: number) => `${count} de ${models} modelos indicam mais chuva`,
      agreeSplit: (models: number) => `os ${models} modelos não concordam sobre a chuva`,
      agreeHeat: (count: number, models: number) => `${count} de ${models}, mais calor`,
      futureSource: 'Média dos modelos do NEX-GDDP-CMIP6 (NASA), cenário intermediário.',
      seeAnswer: 'ver na sugestão',
    },
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
    prefer: 'Se você prefere…',
  },
  options: {
    sortLabel: 'Colocar na frente quem é melhor em:',
    rank: (position: number) => `${position}º`,
    legend: (period: string) =>
      `Cada quadrinho é um ano (${period}). Cheio: choveu o bastante. Vazio: faltou chuva na hora que a planta mais precisa.`,
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
    regionLink: 'Ver o que acontece na sua região',
  },
  /** Abas da resposta e aba Sugestão (seção 5 da remodelagem, tarefa 0044). */
  suggestion: {
    tabs: { suggestion: 'Sugestão', compare: 'Comparar', plan: 'Plano de 3 anos' },
    compareTitle: 'Comparar',
    objective: {
      label: 'O que você quer mais?',
      seguranca: 'Mais segurança',
      renda: 'Renda',
      terra: 'Cuidar da terra',
      hintNone: 'Sem escolha, o app equilibra as três coisas. Toque de novo para tirar a escolha.',
      hint: {
        seguranca: 'Na frente, quem deu certo em mais anos.',
        renda: 'Na frente, quem dá grão com menos risco.',
        terra: 'Na frente, quem mais cuida da terra.',
      },
    },
    lead: (year: number) => `Depois da soja de ${year}, na sua lavoura:`,
    year1: 'Ano 1 do seu plano',
    plantImage: (crop: string) => `Desenho da planta: ${crop}`,
    planTitle: 'Seu plano de 3 anos',
    planYear: (year: number, crop: string) => `${year}: ${crop}`,
    explorePlan: 'Explorar o plano',
    thirst: {
      label: 'Sede da cultura',
      pouca: 'Sede: pouca água',
      media: 'Sede: água média',
      muita: 'Sede: muita água',
    },
    worked: {
      title: 'Deu certo',
      criterionGrain: (isna: number, temp: string, days: number, half: number) =>
        `Deu certo = a planta teve pelo menos ${isna}% da água que precisa na fase que mais precisa de água (${half} dias antes e depois da floração) e não fez ${temp} °C em ${days} dias ou mais nessa fase.`,
      criterionCover: (isna: number, temp: string, days: number, window: number) =>
        `Deu certo = nos primeiros ${window} dias, quando a planta pega, ela teve pelo menos ${isna}% da água que precisa e não fez ${temp} °C em ${days} dias ou mais.`,
      chartLabel: (good: number, total: number) =>
        `Água na fase que mais precisa, ano a ano. Deu certo em ${good} de ${total} anos.`,
      cutLabel: (pct: number) => `Limite: ${pct}%`,
      good: 'Deu certo',
      water: 'Faltou água',
      heat: 'Fez calor',
      both: 'Faltou água e fez calor',
      yearButton: (year: number, pct: number, state: string, enso: string) =>
        `${year}: ${pct}% da água que a planta precisa. ${state}.${enso ? ` ${enso}.` : ''}`,
      ensoNino: 'Ano de El Niño',
      ensoNina: 'Ano de La Niña',
      markNino: 'N',
      markNina: 'L',
      legendEnso: 'N: El Niño · L: La Niña (NOAA)',
      axisNote: (period: string) =>
        `Altura da barra: a água que a planta teve na fase que mais precisa, em % do que ela precisa (conta do motor). ${period}.`,
      tapHint: 'Toque num ano para ver o que aconteceu.',
      ensoNote: (phase: string, good: number, total: number, goodOthers: number, totalOthers: number) =>
        `Em anos de ${phase}, deu certo em ${good} de ${total}; nos outros anos, em ${goodOthers} de ${totalOthers}.`,
      ensoPhase: { el_nino: 'El Niño', la_nina: 'La Niña' },
      ensoFew: 'São poucos anos: mostra o que aconteceu, não é previsão.',
    },
    year: {
      title: (year: number) => `O que aconteceu em ${year}`,
      close: 'Fechar',
      sowing: 'Semeadura',
      flowering: 'Floração, a fase que mais precisa de água',
      establishment: 'Começo dos dias em que a planta pega',
      dry: 'Maior sequência sem chuva nessa fase',
      days: (n: number) => (n === 1 ? '1 dia' : `${n} dias`),
      heat: (temp: string) => `Dias de ${temp} °C ou mais nessa fase`,
      enso: 'El Niño ou La Niña',
      ensoNone: 'Nenhum dos dois (ano neutro)',
      soil: 'Umidade da terra no dia de plantar (SMAP)',
      soilValue: (pct: number) => `${pct}% da água que a terra guarda`,
      why: 'O motivo',
      timeline: 'A safra dia a dia',
      timelineError: 'Não deu para carregar a safra dia a dia.',
    },
    water: {
      title: 'Água',
      need: (mm: string) => `Precisa de ${mm} mm`,
      rain: (mm: string) => `Costuma chover ${mm} mm`,
      short: (normal: string, dry: string) => `Falta ${normal} mm em ano normal e ${dry} mm em ano seco`,
      noShort: (dry: string) => `Em ano normal não falta; em ano seco, faltam ${dry} mm`,
      barLabel: (need: string, rain: string, normal: string) =>
        `Barra da água: precisa de ${need} mm, costuma chover ${rain} mm, falta ${normal} mm em ano normal.`,
      why: (cad: string) =>
        `Mesmo quando chove mais do que a planta precisa, pode faltar: a chuva vem toda no começo e a terra só guarda ${cad} mm.`,
      future: (normal: string, min: string, max: string) =>
        `Em 2041–2060, a falta em ano normal seria de ${normal} mm (de ${min} a ${max} mm, conforme o modelo).`,
      futureMore: (mm: string) => `${mm} mm a mais que hoje.`,
      futureLess: (mm: string) => `${mm} mm a menos que hoje.`,
      futureSame: 'Igual a hoje.',
      note: (years: number) =>
        `Conta do motor nos dias do ciclo: chuva do GPM IMERG e gasto da lavoura com o clima do NASA POWER. Ano normal = em metade dos anos faltou isso ou menos (mediana de ${years} anos); ano seco = só 1 em cada 5 anos teve falta maior.`,
      guide: 'A umidade que a palhada segura, a enxurrada e a água que fica para a próxima safra estão no Guia, sem número: não temos esse dado.',
    },
    climate: {
      title: 'Clima 2041–2060',
      source: 'NEX-GDDP-CMIP6 (NASA), cenário SSP2-4.5, média dos modelos, contra 1995–2014.',
    },
    how: {
      title: 'Como fazer',
      when: 'Quando plantar',
      whenText: (date: string) => `Logo depois de colher a soja, até ${date} (data limite do ZARC na conta).`,
      whenSoon: 'Logo depois de colher a soja.',
      duration: 'Quanto tempo leva',
      durationText: (cycle: number, flowering: number) =>
        `Cerca de ${cycle} dias da semeadura ao fim do ciclo; floresce por volta do dia ${flowering}.`,
      watch: 'O que observar',
      watchDry: (days: number) =>
        `Veranico: em metade dos anos, a planta ficou ${days} dias ou mais sem chuva na fase que mais precisa de água.`,
      watchDryNone: 'Veranico: em metade dos anos ou mais, não ficou nenhum dia sem chuva na fase que mais precisa de água.',
      watchHeat: (years: number, total: number, temp: string, days: number) =>
        `Calor: em ${years} de ${total} anos fez ${temp} °C em ${days} dias ou mais nessa fase.`,
      watchHeatNone: (total: number, temp: string, days: number) =>
        `Calor: em nenhum dos ${total} anos fez ${temp} °C em ${days} dias ou mais nessa fase.`,
      watchRainEnd: (date: string) => `Fim das chuvas: em metade dos anos, a chuva acabou até ${date}.`,
      manage: 'Manejo',
      draft: 'Rascunho: a revisar pela agrônoma.',
      fullGuide: 'Passo a passo completo',
    },
    late: {
      title: 'Colheita tarde',
      when: { cedo: 'até 10 de fevereiro', meio: 'entre 11 e 20 de fevereiro', tarde: 'depois de 20 de fevereiro' },
      group: (crops: string, date: string) => `${crops} (ZARC, ${date})`,
      text: (when: string, list: string, count: number) =>
        `Colhendo ${when}, já passou o prazo seguro de plantio para ${list}. Por isso ${count === 1 ? 'ela não aparece' : 'elas não aparecem'}.`,
      /** Todas com a mesma data limite: a data vai logo depois do prazo, como no pedido da seção 5.4. */
      textOneDate: (when: string, date: string, list: string, count: number) =>
        `Colhendo ${when}, já passou o prazo seguro de plantio (ZARC, ${date}) para ${list}. Por isso ${count === 1 ? 'ela não aparece' : 'elas não aparecem'}.`,
      zarc: 'ZARC é o Zoneamento Agrícola de Risco Climático do Ministério da Agricultura: diz, para cada município, até quando plantar com o risco de clima mais baixo.',
      frost: (years: number, total: number, temp: string) =>
        `Geada: em ${years} de ${total} anos a mínima chegou a ${temp} °C ou menos entre maio e julho (NASA POWER).`,
      and: 'e',
    },
    learnMore: (title: string) => `Saiba mais: ${title}`,
    articles: {
      worked: 'O que significa "deu certo"',
      water: 'A conta de água da lavoura',
      enso: 'El Niño e La Niña',
      future: 'O clima de 2041 a 2060',
      zarc: 'O prazo de plantio e o ZARC',
      frost: 'Geada na safrinha',
      rotation: 'Rotação de culturas',
    },
  },
  /** Aba Comparar (seção 5.5 da remodelagem, tarefa 0045). */
  compare: {
    lead: 'Escolha até 3 culturas para ver lado a lado.',
    pickLabel: 'Culturas para comparar',
    pickHint: 'Toque para pôr ou tirar. No máximo 3.',
    full: 'Já são 3. Tire uma para pôr outra.',
    lateChip: (date: string) => `Passou do prazo (${date})`,
    lateChipNoDate: 'Passou do prazo desta colheita',
    lateNote: 'Culturas com "passou do prazo" não cabem na janela de plantio desta colheita (ZARC).',
    preferTitle: 'Se você prefere…',
    preferHint: 'Comece por aqui: cada cartão põe a cultura ao lado da sugestão.',
    preferAction: (crop: string) => `Comparar ${crop} com a sugestão`,
    tableLabel: (crops: string) => `Lado a lado: ${crops}`,
    rows: {
      worked: 'Deu certo',
      failed: 'Por que falhou',
      water: 'Água',
      future: 'Clima 2041–2060',
      income: 'Renda',
      soil: 'Terra',
      deadline: 'Prazo para plantar',
      use: 'Por que usar',
      avoid: 'Por que evitar',
      more: 'Saiba mais',
    },
    worked: (good: number, total: number) => `${good} de ${total} anos`,
    failedWater: (years: number) => `Falta de água: ${years === 1 ? '1 ano' : `${years} anos`}`,
    failedHeat: (years: number) => `Calor: ${years === 1 ? '1 ano' : `${years} anos`}`,
    failedNone: 'Não falhou em nenhum ano',
    waterNeed: (mm: string) => `Precisa de ${mm} mm`,
    waterRain: (mm: string) => `Chove ${mm} mm`,
    waterShort: (normal: string, dry: string) => `Falta ${normal} mm (ano seco: ${dry} mm)`,
    future: (good: number, total: number) => `Daria certo em ${good} de ${total} anos (média dos modelos)`,
    futureRange: (min: number, max: number) => `De ${min} a ${max}, conforme o modelo.`,
    deadline: (date: string) => `Até ${date}`,
    deadlineNone: 'Logo depois da colheita',
    use: {
      safe: 'Deu certo em quase todos os anos.',
      grain: 'Dá grão com pouco risco de perder.',
      soil: 'Cuida bem da terra.',
      littleWater: 'Pede pouca água.',
    },
    avoid: {
      risky: 'Falhou em muitos anos.',
      noGrain: 'Não dá grão para vender.',
      soilWeak: 'Ajuda pouco a terra.',
      muchWater: 'Pede muita água.',
      futureWorse: 'No clima de 2041–2060, daria certo em menos anos.',
    },
    nothing: 'Nada se destaca.',
    usePlan: 'Usar no meu plano',
    usePlanLabel: (crop: string) => `Usar ${crop} no ano 1 do meu plano`,
    soilGuide: 'Palhada, adubo verde e nematoide, no Guia:',
    articles: { straw: 'Palhada', greenManure: 'Adubo verde', nematode: 'Nematoide' },
    source:
      'Números do motor: chuva do GPM IMERG, calor e gasto da lavoura do NASA POWER, clima 2041–2060 do NEX-GDDP-CMIP6 (NASA). "Por que usar" e "Por que evitar" saem dos rótulos Bom e Fraco do motor.',
  },
  /** Aba "Plano de 3 anos" (seção 5.6 da remodelagem, tarefa 0045). */
  rotation: {
    subtitle: 'Monte a rotação: troque a cultura de cada ano e veja as notas na hora.',
    yearsLabel: 'Seu plano ano a ano',
    choose: (year: number) => `O que plantar em ${year}`,
    yearWorked: (good: number, total: number) => `Deu certo em ${good} de ${total} anos`,
    yearFallow: 'Sem lavoura: a terra fica descoberta.',
    suggested: 'Este é o plano sugerido para o que você quer mais.',
    edited: 'Você mudou o plano sugerido.',
    reset: 'Voltar ao plano sugerido',
    scoresTitle: 'Notas do plano',
    scoresLabel: 'Notas do seu plano ao lado de como é hoje',
    yourPlan: 'Seu plano',
    today: 'Como é hoje',
    scores: { seguranca: 'Segurança climática', solo: 'Saúde da terra', futuro: 'Clima 2041–2060' },
    score: (value: string) => `${value} de 100`,
    scoreNone: 'Sem lavoura',
    updating: 'Recalculando…',
    scoresNote:
      'De 0 a 100. Segurança e clima 2041–2060: média das notas do motor nos anos com lavoura. Saúde da terra: média da nota de solo dos 3 anos, mais os pontos por variar a função das culturas.',
    scoresError: 'Não deu para recalcular agora.',
    soilTitle: 'Saúde da terra na rotação',
    covered: (years: number, total: number) =>
      years === total ? `Terra coberta nos ${total} anos` : `Terra coberta em ${years} de ${total} anos`,
    nitrogen: (years: number) =>
      years === 0 ? 'Nenhum ano deixa nitrogênio na terra' : years === 1 ? '1 ano deixa nitrogênio na terra' : `${years} anos deixam nitrogênio na terra`,
    nematode: (years: number) =>
      years === 0
        ? 'Nenhum ano quebra o ciclo do nematoide'
        : years === 1
          ? '1 ano quebra o ciclo do nematoide'
          : `${years} anos quebram o ciclo do nematoide`,
    repeat: (crops: string) => `Repete a mesma cultura: ${crops}`,
    noRepeat: 'Nenhuma cultura se repete',
    bonus: (points: string) => `Variar a função das culturas (grão, gramínea e leguminosa) soma ${points} pontos à saúde da terra.`,
    rainTitle: 'Chuva aproveitada',
    rainSentence: (fallow: string, used: string) =>
      `Com a terra parada, ${fallow} mm de chuva por ano caem sem virar grão nem palha. Com o plano, a lavoura usa ${used} mm.`,
    rainFallowOnly: (fallow: string) => `Com a terra parada, ${fallow} mm de chuva por ano caem sem virar grão nem palha.`,
    rainYear: (year: number, crop: string, mm: string) => `${year}, ${crop}: a planta usa ${mm} mm`,
    rainYearFallow: (year: number, mm: string) => `${year}, deixar parado: ${mm} mm caem sem cultura`,
    rainYearOut: (year: number, crop: string) => `${year}, ${crop}: fora do prazo de plantio, sem a conta`,
    rainToday: (mm: string) => `Como é hoje, a lavoura usa ${mm} mm por ano.`,
    rainNote: (source: string, date: string, years: number) =>
      `Chuva do ${source} de ${date} (dia de plantar da conta) até o fim de julho, mediana de ${years} anos. "Usa" = a água que a planta tirou da terra no ciclo (conta do motor, com o gasto da lavoura do NASA POWER). Na terra parada, não estimamos a água que evapora.`,
    abTitle: 'Plano A e Plano B',
    articleDry: 'Veranico',
    planA: (crop: string) => `Plano A: ${crop}, se a chuva vier normal.`,
    planAFallow: 'Plano A: deixar a terra parada.',
    planB: (crop: string) => `Plano B: ${crop}, se secar.`,
    planBRule: (mm: string, days: number) =>
      `Secar = menos de ${mm} mm no pluviômetro nos ${days} dias antes de plantar.`,
    planBEvidence: (hits: number, fails: number, crop: string, total: number) =>
      `Nos ${total} anos, esse limite pegou ${hits} dos ${fails} anos em que ${crop} falhou.`,
    planBWhy: (fails: number, cropA: string, good: number, cropB: string) =>
      `Nos ${fails} anos em que ${cropA} falhou, ${cropB} deu certo em ${good}.`,
    planBNoNumber: (days: number, cropA: string, total: number) =>
      `Não damos um número para "secar": nos ${total} anos, a chuva dos ${days} dias antes de plantar não separou bem os anos em que ${cropA} deu certo dos anos em que falhou. Use o Plano B se a terra estiver seca no dia de plantar.`,
    planBFewFails: (cropA: string, fails: number, total: number) =>
      `Não damos um número para "secar": ${cropA} falhou em só ${fails} de ${total} anos, pouco para achar um limite. Use o Plano B se a terra estiver seca no dia de plantar.`,
    planBNever: (crop: string, total: number) => `Não precisou de Plano B: ${crop} deu certo nos ${total} anos.`,
    planBNone: (crop: string) =>
      `Nenhuma outra cultura que cabe na janela deu certo nos anos em que ${crop} falhou: siga com ${crop}.`,
    planBSource: (source: string) => `Chuva do ${source} no seu ponto; anos bons e ruins da conta do motor.`,
    todayTitle: 'Como é hoje',
    todaySeen: (years: string) => `O satélite viu plantio na entressafra de ${years}. O que foi?`,
    todayNotSeen: 'Conte o que você fez nas últimas entressafras.',
    todayAsk: 'Sem o satélite para o seu ponto: conte o que você fez nas últimas entressafras.',
    todayYear: (year: number) => `O que foi em ${year}?`,
    todayStatus: {
      plantou: 'o satélite viu plantio',
      parado: 'o satélite viu a terra parada',
      incerto: 'o satélite não teve certeza',
      sem_soja: 'o satélite não viu soja',
    },
    todayYou: 'você confirmou',
    todayNdvi: (value: string) => `verde máximo ${value} (MODIS)`,
    todayReference: (text: string) => `Enquanto você não conta as 3 safras, "Como é hoje" é uma referência. ${text}`,
    todayYours: 'Como é hoje = o que você plantou nas últimas 3 entressafras, com o clima da sua faixa de colheita.',
    todayCrops: (crops: string) => `Hoje: ${crops}.`,
    todayCropsSame: (crop: string, years: number) => `Hoje: ${crop} nos ${years} anos.`,
    and: 'e',
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
    subtitle: (km: number, place: string, count: number) =>
      `Até ${km} km de ${place} · ${count} produtores participando`,
    liked: (liked: number, total: number) =>
      total === 1 ? `${liked} de 1 gostou` : `${liked} de ${total} gostaram`,
    dotsLabel: (liked: number, total: number) => `${liked} de ${total} vizinhos gostaram`,
    tellMine: 'Contar como foi a minha',
    mapLabel: 'Mapa da região com pluviômetros e o que cada vizinho plantou',
    legendGauge: 'Pluviômetro',
    legendPlanted: 'Plantou',
    legendIdle: 'Parado',
    rainTitle: 'Choveu aqui',
    reading: (gauge: number, satellite: number) => `${gauge} mm · satélite ${satellite} mm`,
    rainNote:
      'O pluviômetro de vocês corrige a chuva do satélite na região e melhora a conta de risco de todo mundo.',
    privacy:
      'O mapa mostra a região, nunca a posição exata das fazendas. Nome só aparece com autorização. Valores ilustrativos.',
    reportsSubtitle: (km: number) => `O que os vizinhos contam, até ${km} km da sua lavoura`,
    tellTitle: 'Conte o que aconteceu aí',
    tellHint: 'Sem cadastro, sem nome e sem texto: só toques.',
    tellPlanting: 'O que plantei depois da soja',
    tellRain: 'Choveu aqui',
    tellEvent: 'Aconteceu aqui',
    needPoint: 'Para contar, primeiro marque onde fica a sua lavoura.',
    markField: 'Marcar minha lavoura',
    cropLabel: 'O que você plantou?',
    reportCrops: {
      milho_safrinha: 'Milho sozinho',
      milho_braquiaria: 'Milho com braquiária',
      sorgo: 'Sorgo',
      milheto: 'Milheto',
      crotalaria: 'Crotalária',
      outra: 'Outra',
      pousio: 'Deixei parado',
    },
    /** Os nomes no meio da frase do resumo ("3 milheto, 1 deixou parado"). */
    reportCropsInList: {
      milho_safrinha: 'milho sozinho',
      milho_braquiaria: 'milho com braquiária',
      sorgo: 'sorgo',
      milheto: 'milheto',
      crotalaria: 'crotalária',
      outra: 'outra cultura',
      pousio: 'deixou parado',
    },
    yearLabel: 'Em que safra?',
    outcomeLabel: 'Como foi?',
    outcomes: { bem: 'Foi bem', mais_ou_menos: 'Mais ou menos', perdi: 'Perdi' },
    reasonLabel: 'Por que perdeu?',
    reasons: {
      seca: 'Seca',
      calor: 'Calor',
      geada: 'Geada',
      granizo: 'Granizo',
      praga: 'Praga',
      outro: 'Outro motivo',
    },
    mmLabel: 'Quantos milímetros choveu?',
    mmUnit: 'mm',
    mmHint: 'De 0 a 300 mm, como marcou o pluviômetro.',
    dateLabel: 'Que dia?',
    dateHint: 'Hoje ou até 30 dias atrás.',
    /** Tarefa 0049: o artigo do Guia de cada evento relatado (só os que existem). */
    eventArticles: { fogo: 'Fogo na palha', enxurrada_erosao: 'Como evitar erosão' },
    learnMore: (title: string) => `Saiba mais: ${title}`,
    eventLabel: 'O que aconteceu?',
    events: {
      fogo: 'Fogo',
      granizo: 'Granizo',
      geada: 'Geada',
      vendaval: 'Vendaval',
      enxurrada_erosao: 'Enxurrada ou erosão',
      praga_doenca: 'Praga ou doença',
    },
    fireCall: 'Em caso de fogo, ligue 193 (Bombeiros).',
    fireCallButton: 'Ligar 193',
    privacyNotice: 'Seus vizinhos veem a região, não o seu ponto.',
    send: 'Enviar',
    sending: 'Enviando…',
    sent: 'Pronto! Seu relato já aparece para os vizinhos.',
    errorLimit: 'Você já mandou 10 relatos hoje. Tente de novo amanhã.',
    errorInvalid: 'Algum valor não foi aceito. Confira e tente de novo.',
    errorOther: 'Não deu para enviar agora. Tente de novo.',
    nearbyTitle: 'Perto de você',
    unconfirmed: 'Relato de vizinho, não confirmado',
    example: 'Exemplo',
    empty: 'Ainda não há relatos perto de você. Seja o primeiro a contar.',
    plantingLine: (count: number, year: number, list: string) =>
      `${count} ${count === 1 ? 'vizinho contou o que fez' : 'vizinhos contaram o que fizeram'} depois da soja em ${year}: ${list}.`,
    wentWell: (count: number, total: number) =>
      count === 1 ? `1 de ${total} disse que foi bem.` : `${count} de ${total} disseram que foi bem.`,
    rainLine: (average: number, count: number) =>
      `Nos últimos 7 dias, os pluviômetros marcaram em média ${String(average).replace('.', ',')} mm (${count} ${count === 1 ? 'relato' : 'relatos'}).`,
    eventsTitle: 'O que aconteceu nos últimos 30 dias',
    eventLine: (event: string, date: string) => `${event}, em ${date}`,
    mineTitle: 'Seus relatos',
    mineHint: 'Só este aparelho pode apagar.',
    myPlanting: (crop: string, year: number) => `${crop}, safra ${year}`,
    myRain: (mm: number, date: string) => `${String(mm).replace('.', ',')} mm de chuva, em ${date}`,
    remove: 'Apagar',
    removeLabel: (what: string) => `Apagar o relato: ${what}`,
    reportsMapLabel: (km: number) => `Mapa dos relatos até ${km} km da sua lavoura`,
    circleLabel: (km: number) => `Círculo de ${km} km em volta da sua lavoura`,
    mapNote: 'Cada marca é um quadrado de cerca de 10 km, nunca uma fazenda.',
    mapLegend: 'Legenda do mapa',
    mapLegendPlanting: 'Plantio',
    mapLegendRain: 'Chuva',
    mapLegendEvent: 'Evento',
    mapPlanting: (count: number) => `${count} de plantio`,
    mapRain: (count: number) => `${count} de chuva`,
    mapEvent: (count: number) => (count === 1 ? '1 evento' : `${count} eventos`),
    shareTitle: 'Compartilhar com a comunidade',
    shareHint: 'Conte aos vizinhos o que você fez nessas safras.',
    shareYear: (year: number) => `Safra ${year}`,
    shareIdle: 'Deixei parado',
    shareSent: 'Compartilhado. Obrigado!',
    shareSeeCommunity: 'Ver o que os vizinhos contam',
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
    /** Tarefa 0040: a nota de renda sem preço nem custo (regra no regras.yaml do backend, grupo `renda`). */
    incomeTitle: 'Renda sem valores em reais',
    incomeText:
      'A renda não usa preço nem custo. Quem dá grão para vender ganha na renda a mesma nota da segurança: em quantos anos deu certo, de 0 a 100. Quem não dá grão (as plantas de cobertura e a terra parada) fica com uma nota fixa na renda: é investimento na terra, e isso conta na nota da terra.',
    /** Tarefa 0049: a nota de quem não dá grão vem do regras.yaml (`renda.nota_sem_grao`). */
    incomeTextScore: (score: string) =>
      `A renda não usa preço nem custo. Quem dá grão para vender ganha na renda a mesma nota da segurança: em quantos anos deu certo, de 0 a 100. Quem não dá grão (as plantas de cobertura e a terra parada) fica com nota ${score} na renda: é investimento na terra, e isso conta na nota da terra.`,
    incomeShown:
      'Na resposta, a renda mostra só fatos: se dá grão para vender e em quantos anos faltou água ou fez calor.',
    blindTitle: 'O que o satélite não enxerga',
    /** O tamanho vem da fonte de chuva conectada: IMERG (10 km) ou NASA POWER (~50 km). */
    blindRain: (km: number) =>
      `A chuva vem em quadrados de cerca de ${km} km, não do seu talhão: seu pluviômetro vale mais.`,
    blindRainGeneric: 'A chuva vem de quadrados de vários quilômetros, não do seu talhão: seu pluviômetro vale mais.',
    blindRest:
      'O clima de 2041 a 2060 é uma faixa entre modelos, não uma previsão. Os limites ainda serão ajustados com agrônomos da região.',
    /** Tarefa 0049: as regras novas, com os números do regras.yaml (`GET /api/metodo`), nunca fixos aqui. */
    rules: {
      title: 'As regras da conta',
      intro: 'Cada número abaixo vem do arquivo de regras do motor (regras.yaml). Os marcados como hipótese do time ainda serão revistos pela agrônoma.',
      worked: (grain: string, days: string, cover: string, coverDays: string, temp: string, heatDays: string) =>
        `Deu certo: a planta teve pelo menos ${grain}% da água que precisava na fase em que mais precisa (a floração, ${days} dias antes e depois; nas plantas de cobertura, ${cover}% nos primeiros ${coverDays} dias) e não fez ${temp} °C em ${heatDays} dias ou mais nessa fase.`,
      weights: (safety: string, future: string, soil: string, income: string) =>
        `Nota final: segurança ${safety}%, clima 2041–2060 ${future}%, terra ${soil}% e renda ${income}%.`,
      income: (score: string) =>
        `Renda: quem dá grão para vender tem na renda a nota da segurança; quem não dá grão fica com ${score}. Nenhum preço, custo ou valor em reais entra na conta.`,
      water: (pct: string) =>
        `Água: o motor soma, dia a dia, o que a planta gasta (ETo do NASA POWER × Kc) e o que chove (GPM IMERG), com o que a terra guarda. Ano normal é o do meio; ano seco é aquele em que só ${pct}% dos anos tiveram falta maior.`,
      thirst: (low: string, high: string) =>
        `Sede da cultura: pouca água abaixo de ${low} mm no ciclo; muita, a partir de ${high} mm (hipótese do time).`,
      rotation: (two: string, three: string, crops: string) =>
        `Nota da rotação: a média das notas dos 3 anos, com +${two} pontos para 2 funções diferentes e +${three} para 3 (grão, capim de cobertura, leguminosa). Quebram o ciclo do nematoide: ${crops}.`,
      planB: (days: string, fails: string, catches: string, precision: string, chance: string) =>
        `Plano B: a cultura que mais deu certo nos anos em que a do Plano A falhou. "Secar" vira um número do pluviômetro (a chuva dos ${days} dias antes de plantar) só com ${fails} anos de falha ou mais, pegando ${catches}% das falhas, com ${precision}% dos anos marcados sendo de falha e chance de acaso de até ${chance}%. Senão, o Plano B aparece sem número.`,
      frost: (temp: string, from: string, to: string) =>
        `Geada (raio-X): algum ano com mínima de ${temp} °C ou menos de ${from} a ${to} (NASA POWER).`,
      heavyRain: (mm: string, from: string, to: string) =>
        `Chuva forte (raio-X): dias com ${mm} mm ou mais de ${from} a ${to} (GPM IMERG), quando a terra descoberta perde solo.`,
      fire: (km: string) =>
        `Fogo (raio-X): fogo a até ${km} km do ponto (MODIS MCD64A1, área queimada). Só aparece quando o arquivo da área queimada foi baixado.`,
      alerts: (pct: string, dry: string, hot: string, temp: string, window: string, days: string, km: string) =>
        `Avisos: terra seca com o SMAP no percentil ${pct} ou menos; ${dry} dias seguidos sem chuva ou ${hot} dias de ${temp} °C nos últimos ${window} (NASA POWER); relatos de vizinhos dos últimos ${days} dias, a até ${km} km, sempre como não confirmados.`,
      signal: (chance: string, years: string, bad: string) =>
        `Sinal do outono: previsão da NOAA de El Niño ou La Niña com ${chance}% ou mais e pelo menos ${years} anos daquela fase na série. Se a cultura do Plano A teve problema em ${bad}% ou mais desses anos e a do Plano B se saiu melhor, o sinal marca o Plano B.`,
      xray: 'Raio-X: cada bloco mostra a fonte e o tamanho do quadrado medido (ex.: SMAP 9 km, NASA POWER cerca de 50 km). Vale para a área em volta do ponto, não para o talhão exato.',
      and: 'e',
    },
    sourcesTitle: 'De onde vem cada dado',
    /** Uma por fonte do produto; a tela mostra só as que a API manda de fato (decisão D2). */
    sources: {
      nasa_power: {
        what: 'Calor e gasto de água da lavoura (ETo), dia a dia; a chuva, só nos anos sem o GPM IMERG',
        source: 'NASA POWER',
        scale: 'cerca de 50 km, por dia',
      },
      gpm_imerg: { what: 'Chuva mais detalhada', source: 'GPM IMERG (NASA)', scale: 'quadrados de 10 km, por dia' },
      smap: { what: 'Umidade da terra', source: 'SMAP L4 (NASA)', scale: '9 km, a cada 3 horas' },
      modis: { what: 'Histórico do talhão', source: 'MODIS (NASA)', scale: '250 m, a cada 16 dias' },
      modis_mcd64a1: { what: 'Fogo perto do ponto (área queimada)', source: 'MODIS MCD64A1 (NASA)', scale: '500 m, por mês' },
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
  // Tela "Avisos" (seção 6 da remodelagem, tarefa 0046 do backend, RF-31)
  alerts: {
    title: 'Avisos',
    subtitle: 'Para a lavoura marcada neste aparelho. Os avisos aparecem quando você abre o app.',
    headerLabel: 'Avisos',
    headerCount: (count: number) => (count === 1 ? 'Avisos: 1 aviso ativo' : `Avisos: ${count} avisos ativos`),
    place: (place: string) => `Lavoura perto de ${place}`,
    needPoint:
      'Para ver os avisos, marque onde fica a sua lavoura. O ponto fica guardado só neste aparelho, sem cadastro.',
    markField: 'Marcar minha lavoura',
    level: { atencao: 'Atenção', fique_de_olho: 'Fique de olho' },
    groups: {
      agora: 'Agora',
      mudou: 'O que mudou na sua área',
      recordes: 'Fora do comum',
      perto: 'Perto de você',
    },
    nothing: 'Nada fora do normal.',
    lastReading: (date: string) => `Última leitura: ${date}.`,
    readingOn: (date: string) => `leitura de ${date}`,
    dataUntil: (date: string) => `dados até ${date}`,
    reportedOn: (date: string) => `relato de ${date}`,
    oldReading: 'Leitura antiga',
    todo: 'O que fazer:',
    source: (names: string) => `Fonte: ${names}`,
    sources: {
      smap: 'NASA SMAP',
      nasa_power: 'NASA POWER',
      gpm_imerg: 'GPM IMERG (NASA)',
      noaa: 'NOAA',
      comunidade: 'relato de vizinho',
    },
    changedIntro: (recentStart: number, recentEnd: number, beforeStart: number, beforeEnd: number) =>
      `${recentStart} a ${recentEnd} comparado com ${beforeStart} a ${beforeEnd}, na sua área.`,
    fewYears: 'São poucos anos: mostra o que aconteceu, não uma previsão.',
    recordsIntro: (start: number, end: number) => `O que aconteceu de mais extremo na sua área de ${start} a ${end}.`,
    nearbyIntro: (km: number, days: number) => `Eventos contados por vizinhos até ${km} km, nos últimos ${days} dias.`,
    unconfirmed: 'Relato de vizinho, não confirmado',
    period: (start: number, end: number) => `${start}–${end}`,
    safrinhaRunning: (crop: string) =>
      `Safrinha em andamento (${crop}): os avisos do plantio usam a chuva e o calor dos últimos dias.`,
    safrinhaNext: (crop: string, date: string) =>
      `A próxima safrinha (${crop}) começa por volta de ${date}. Durante ela, os avisos do plantio aparecem aqui.`,
    safrinhaLink: (year: number) => `Ver como teriam sido os avisos em ${year}`,
    guideLink: 'Saiba mais: como ler os avisos',
    phases: { el_nino: 'El Niño', la_nina: 'La Niña' },
    seasons: {
      DJF: 'dezembro a fevereiro',
      JFM: 'janeiro a março',
      FMA: 'fevereiro a abril',
      MAM: 'março a maio',
      AMJ: 'abril a junho',
      MJJ: 'maio a julho',
      JJA: 'junho a agosto',
      JAS: 'julho a setembro',
      ASO: 'agosto a outubro',
      SON: 'setembro a novembro',
      OND: 'outubro a dezembro',
      NDJ: 'novembro a janeiro',
    },
    kinds: {
      dry: (pct: number) => `A terra está mais seca que em ${pct}% dos anos nesta época.`,
      dryTodo: 'Confira a umidade da terra antes de plantar ou adubar.',
      noRain: (days: number, date: string, atLeast: boolean) =>
        `${atLeast ? 'Pelo menos ' : ''}${days} dias seguidos sem chuva (menos de 1 mm por dia) até ${date}.`,
      noRainTodo: 'Converse com o agrônomo antes de plantar ou adubar.',
      heat: (days: number, window: number, temp: number) =>
        `${days} dias com ${temp} °C ou mais nos últimos ${window} dias.`,
      heatTodo: 'Se a lavoura estiver na floração, calor forte derruba as flores. Converse com o agrônomo.',
      ensoForecast: (phase: string, months: string, year: number, chance: number) =>
        `Previsão da NOAA para ${months} de ${year}: ${phase}, com ${chance}% de chance.`,
      ensoHistory: (
        years: number,
        phase: string,
        start: number,
        crop: string,
        good: number,
        others: number,
        goodOthers: number,
      ) =>
        `Nos ${years} anos de ${phase} desde ${start}, ${crop} deu certo em ${good} aqui; nos outros ${others} anos, em ${goodOthers}. São poucos anos.`,
      /** O mesmo conselho do sinal do outono no Plano de 3 anos (tarefa 0049). */
      ensoTodo: {
        normal: 'O sinal do outono marca o Plano A. Confira o plano no Plano de 3 anos.',
        seco: 'O sinal do outono marca o Plano B. Veja o Plano B no Plano de 3 anos antes de decidir o que plantar.',
        incerto: 'Sem sinal claro para o outono. Veja o Plano A e o Plano B no Plano de 3 anos antes de decidir o que plantar.',
      },
      safrinhaDry: (crop: string, days: number, date: string) =>
        `${crop}: ${days} dias sem chuva perto da fase que mais precisa de água (até ${date}).`,
      safrinhaHeat: (crop: string, days: number, temp: number, date: string) =>
        `${crop}: ${days} dias seguidos com ${temp} °C ou mais perto da fase que mais precisa de água (até ${date}).`,
      safrinhaTodo: 'Converse com o agrônomo.',
      changedDrySpell: (recent: string, before: string, recentPeriod: string, beforePeriod: string) =>
        `Maior veranico de março a maio: ${recent} dias em média em ${recentPeriod}; ${before} dias em ${beforePeriod}.`,
      changedRainEnd: (
        recent: string,
        before: string,
        recentPeriod: string,
        beforePeriod: string,
        days: number,
        earlier: boolean,
      ) =>
        `Fim das chuvas: ${recent} em ${recentPeriod}; ${before} em ${beforePeriod} (${days} dias mais ${earlier ? 'cedo' : 'tarde'}).`,
      changedHeat: (recent: string, before: string, temp: number, recentPeriod: string, beforePeriod: string) =>
        `Dias de ${temp} °C ou mais de março a maio: ${recent} por ano em ${recentPeriod}; ${before} em ${beforePeriod}.`,
      changedShortage: (crop: string, recent: string, before: string, recentPeriod: string, beforePeriod: string) =>
        `Falta de água de ${crop} no ciclo, na média dos anos: ${recent} mm por ano em ${recentPeriod}; ${before} mm em ${beforePeriod}. Os anos muito secos puxam a média para cima.`,
      changedWorked: (
        crop: string,
        recentGood: number,
        recentTotal: number,
        beforeGood: number,
        beforeTotal: number,
        recentPeriod: string,
        beforePeriod: string,
      ) =>
        `${crop} deu certo em ${recentGood} de ${recentTotal} anos em ${recentPeriod}; em ${beforeGood} de ${beforeTotal} anos em ${beforePeriod}.`,
      changedWorseTodo: 'Leve isso em conta ao escolher o que plantar.',
      changedBetterTodo: 'Mudou para melhor, mas são poucos anos: não conte com isso.',
      recordDrySpell: (days: number, date: string, year: number) =>
        `Maior veranico de março a maio: ${days} dias seguidos sem chuva a partir de ${date} de ${year}.`,
      recordDryAutumn: (mm: string, year: number, average: string) =>
        `Outono mais seco: ${mm} mm de março a maio de ${year} (a média é ${average} mm).`,
      recordRainEnd: (date: string, year: number) => `Chuva que acabou mais cedo: ${date} de ${year}.`,
      recordHeat: (days: number, temp: number, year: number) =>
        `Ano com mais calor: ${days} dias de ${temp} °C ou mais de março a maio de ${year}.`,
      recordTodo: 'Já aconteceu aqui e pode voltar: planeje pensando num ano assim.',
      neighbor: (event: string, count: number, km: number, date: string) =>
        count === 1
          ? `${event}: 1 relato de vizinho até ${km} km, em ${date}.`
          : `${event}: ${count} relatos de vizinhos até ${km} km; o mais recente em ${date}.`,
      neighborTodo: 'Olhe a sua lavoura para conferir.',
      neighborFireTodo: 'Em caso de fogo, ligue 193 (Bombeiros).',
    },
    official: {
      title: 'Alertas oficiais',
      notice: 'Estes avisos não são alertas oficiais e não substituem a Defesa Civil nem o INMET.',
      intro: 'Para receber os alertas oficiais da Defesa Civil no celular, de graça:',
      sms: 'SMS: envie o CEP do lugar para 40199 (na área rural, use o CEP da sua cidade).',
      smsButton: 'Enviar SMS para 40199',
      whatsapp: 'WhatsApp: mande "Oi" para (61) 2034-4611.',
      whatsappButton: 'Abrir conversa no WhatsApp',
      app: 'Alertas graves chegam sozinhos pelo "Defesa Civil Alerta", sem cadastro.',
      calls: 'Em caso de fogo, ligue 193 (Bombeiros). Emergência da Defesa Civil: 199.',
      call193: 'Ligar 193 (Bombeiros)',
      call199: 'Ligar 199 (Defesa Civil)',
      guide: 'Como receber os alertas oficiais da Defesa Civil',
    },
  },
}

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> }

export type Messages = Widen<typeof pt>
