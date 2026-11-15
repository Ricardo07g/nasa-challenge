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
    /** Nome do X dos modais. */
    close: 'Fechar',
    /** Texto escondido do "Saiba mais" do Guia, que abre em nova aba (regra geral 3 do pacote 2). */
    newTab: '(abre em nova aba)',
  },
  /**
   * Respostas das últimas safras (pacote 2, tarefa 0054): o formulário "Confirme as últimas safras" (telas 4
   * e 5) e o aviso "Você não preencheu as últimas safras". Os períodos vêm do `seasonService`.
   */
  seasons: {
    colSeason: 'Safra',
    colSoy: 'Soja',
    colAfter: 'Depois da soja',
    planted: 'Plantei',
    notPlanted: 'Não plantei',
    /** "de março a julho de 2024: o que você plantou". */
    afterQuestion: (months: string) => `${months}: o que você plantou`,
    noSoyAfter: 'Sem soja nessa safra: não há o que marcar aqui.',
    groupSoy: (season: string) => `Soja na safra ${season}`,
    groupAfter: (season: string) => `Depois da soja na safra ${season}`,
    groupCurrent: (season: string) => `O que você pensa plantar depois da soja ${season}`,
    /** As 6 opções, na ordem do protótipo; "Deixei parado" no passado e "Deixar parado" na safra atual. */
    options: {
      milho_safrinha: 'Milho sozinho',
      milho_braquiaria: 'Milho com braquiária',
      sorgo: 'Sorgo',
      milheto: 'Milheto',
      crotalaria: 'Crotalária',
      pousio: 'Deixei parado',
    },
    fallowFuture: 'Deixar parado',
    notSure: 'Ainda não sei',
    satellitePlanted: 'satélite viu plantio',
    satelliteFallow: 'satélite viu a terra parada',
    satelliteSoy: 'satélite viu a soja',
    satelliteNoSoy: 'satélite não viu a soja',
    /** " · verde 0,71" depois da dica do satélite. */
    green: (value: string) => `verde ${value}`,
    currentTag: 'safra atual',
    soyPlanted: 'Soja plantada',
    harvestExpected: (date: string) => `colheita prevista em ${date}`,
    harvestExpectedEarly: (year: string) => `colheita prevista no começo de ${year}`,
    /** Só com a época da tela 2 (`colheita`, sem `data`): "colheita prevista no meio de fevereiro" (`harvest.*.inline`). */
    harvestExpectedBand: (band: string) => `colheita prevista no ${band}`,
    changeDate: 'Trocar data',
    /** "depois de colher (3 de março) até julho de 2027: o que você pensa plantar". */
    currentQuestion: (date: string, year: string) => `depois de colher (${date}) até julho de ${year}: o que você pensa plantar`,
    currentQuestionNoDate: (year: string) => `depois de colher até julho de ${year}: o que você pensa plantar`,
    missing: 'Você não preencheu as últimas safras.',
    fillNow: 'Preencher agora',
    modalTitle: 'Suas últimas safras',
    modalSubtitle: 'O que você plantou depois da soja? Pode pular o que não lembrar.',
    save: 'Salvar',
  },
  header: {
    home: 'Raiz Orbital, voltar ao início',
    slogan: 'Do espaço até a raiz.',
    navLabel: 'Principal',
    /** Pílula do cabeçalho (pacote 3, tarefa 0061): o Guia no lugar da Comunidade, que está "em breve". */
    guide: 'Guia',
    langToggleLabel: 'Trocar idioma: português ou inglês',
  },
  /**
   * Comunidade "em breve" (pacote 3, tarefa 0061): a rota /comunidade mostra só este cartão, com o "Abrir o Guia".
   * Os relatos dos vizinhos saíram da interface (o backend e o código continuam no repositório).
   */
  comingSoon: {
    tag: 'Em breve',
    title: 'Comunidade da sua região',
    text: 'Um espaço para acompanhar a sua região junto com os vizinhos.',
    /** O que vai ter: só a lista, sem link para relato nenhum. */
    listLabel: 'O que vai ter na comunidade',
    planted: 'O que os vizinhos plantaram depois da soja e como foi',
    rain: 'Quanto choveu em cada lavoura',
    events: 'Granizo, fogo ou enxurrada perto de você',
    guideText: 'Enquanto isso, o Guia explica cada cultura, o plantio e o clima.',
    guideButton: 'Abrir o Guia',
    /** Resumo falado do "Ouvir resumo" (2 frases). */
    summary:
      'A comunidade da sua região chega em breve, para acompanhar com os vizinhos o que cada um plantou e quanto choveu. Enquanto isso, o Guia explica cada cultura, o plantio e o clima.',
  },
  /** "Ouvir resumo" (tarefa 0052): cada tela fala só o seu resumo; o texto falado fica no bloco da tela. */
  listen: {
    summary: 'Ouvir resumo',
    stop: 'Parar',
  },
  /** Rodapé global (tarefa 0052): "Como a conta é feita" só nas telas internas; os créditos em todas. */
  footer: {
    method: 'Como a conta é feita',
    credits: 'Créditos e uso de IA',
    project: 'NASA Space Apps 2026 · Field Shift',
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
    /** Resumo falado do "Ouvir resumo" (2 ou 3 frases, nunca a tela inteira). */
    summary:
      'O Raiz Orbital ajuda a decidir o que plantar depois da soja, com 20 anos de dados de satélite da NASA. É só marcar a lavoura no mapa e dizer quando você colhe a soja. Em seguida, você vê a melhor opção para a sua terra.',
    start: 'Começar',
    stepsTitle: 'Como funciona',
    stepMark: 'Marque a lavoura',
    stepMarkText: 'Um ponto no mapa.',
    stepHarvest: 'Diga quando colhe',
    stepHarvestText: 'A época da colheita da soja.',
    stepAnswer: 'Veja a resposta',
    stepAnswerText: 'O melhor caminho para a sua terra.',
    photoAlt: 'Lavoura no Triângulo Mineiro ao amanhecer',
    /** Selo da tela de cálculo (missão). */
    nasaData: 'dados da NASA',
    /** Selo sobre a foto: abre o modal "De onde vêm os dados". */
    seal: 'Dados da NASA',
    sealRegion: 'Triângulo Mineiro · MG',
    /** Marca d'água obrigatória (regra do NASA Space Apps): a foto foi gerada por IA. */
    aiImage: 'Imagem gerada por IA',
    agroTitle: 'É agrônomo(a) ou técnico(a)?',
    agroText: 'Veja as regras, os pesos e a fonte de cada número.',
    agroButton: 'Como a conta é feita',
    sources: {
      title: 'De onde vêm os dados',
      subtitle: '20 anos de satélite (2005–2024) no ponto da sua lavoura.',
      rain: 'Chuva',
      rainText: 'GPM IMERG · NASA · chuva de cada dia',
      heat: 'Calor e água que a lavoura gasta',
      heatText: 'NASA POWER · temperatura, sol e vento',
      soil: 'Solo',
      soilText: 'SoilGrids · quanta água a terra guarda',
      future: 'Clima de 2041 a 2060',
      futureText: 'NEX-GDDP-CMIP6 · NASA',
      note: 'Nenhum número é inventado. Se não há dado para o seu ponto, aquela parte não aparece.',
      allCredits: 'Todas as fontes e créditos',
    },
  },
  where: {
    title: 'Onde fica a lavoura?',
    lead: 'Toque no mapa em cima da sua lavoura.',
    /** Resumo falado do "Ouvir resumo" (2 ou 3 frases, nunca a tela inteira). */
    summary:
      'Marque onde fica a sua lavoura. Toque no mapa, use onde você está agora ou a lavoura de demonstração. Nesta primeira versão, o app funciona na região de Uberlândia e Uberaba. Depois, toque em Confirmar local.',
    listenSummary: 'Ouvir resumo',
    stopListening: 'Parar',
    close: 'Fechar',
    mapLabel: 'Mapa. Toque para marcar a lavoura.',
    pinLabel: 'Alfinete da lavoura. Arraste para ajustar.',
    zoomIn: 'Aproximar',
    zoomOut: 'Afastar',
    hintEmpty: 'Toque no mapa onde fica a lavoura',
    hintMarked: 'Arraste o alfinete para ajustar',
    showArea: 'Ver a área inteira',
    /** Tarefa 0051 (RF-35): legenda da linha tracejada; o texto inteiro fica no modal "Onde o app funciona". */
    areaLegend: 'Área do MVP: Uberlândia e Uberaba',
    learnMore: 'Saiba mais',
    /** Cartão do local: rótulo, título e texto de cada estado. */
    emptyLabel: 'Sua lavoura',
    emptyTitle: 'Nenhum ponto marcado',
    emptyText: 'Toque no mapa, use onde você está agora ou a lavoura de demonstração.',
    chosenLabel: 'Local escolhido',
    outsideLabel: 'Fora da área',
    near: (place: string) => `Perto de ${place}`,
    demoName: 'Lavoura de demonstração, perto de Uberlândia (MG)',
    gpsError: 'Não deu para achar onde você está. Toque no mapa ou use a lavoura de demonstração.',
    useLocation: 'Usar onde estou agora',
    locating: 'Procurando você…',
    demoBadge: 'Bom para testar',
    useDemo: 'Usar a lavoura de demonstração',
    demoNear: 'Perto de Uberlândia (MG)',
    otherWays: 'Outras formas de marcar',
    confirm: 'Confirmar local',
    needPoint: 'Marque a lavoura no mapa para continuar.',
    needInside: 'Escolha um ponto dentro da linha tracejada.',
    /** Barra fixa do celular, com o ponto fora da área. */
    outsideShort: 'Fora da área do MVP. Veja os detalhes abaixo.',
    other: {
      title: 'Outras formas de marcar',
      subtitle: 'Para quem já tem a localização da lavoura.',
      field: 'Coordenadas ou link do Google Maps',
      example: 'Exemplos: -18.9543, -48.1993 ou um link copiado do Google Maps.',
      error: 'Não entendi. Cole a latitude e a longitude, ou um link do Google Maps.',
      submit: 'Usar este ponto',
    },
    area: {
      title: 'Onde o app funciona',
      text: 'Nesta primeira versão (MVP), o app funciona na região de Uberlândia e Uberaba (MG): é lá que os dados de satélite já estão prontos. Vamos ampliar para todo o Triângulo Mineiro.',
      line: 'A linha tracejada no mapa mostra essa área.',
    },
    outsideTitle: 'Ainda não chegamos aí',
    outsideText:
      'Por enquanto, os dados estão prontos só para a região de Uberlândia e Uberaba. Vamos ampliar para todo o Triângulo Mineiro. Veja como funciona na lavoura de demonstração.',
    outsideNotice:
      'Por enquanto só temos dados da região de Uberlândia e Uberaba. Vamos ampliar para todo o Triângulo Mineiro.',
    seeExample: 'Ver a lavoura de demonstração',
  },
  when: {
    title: 'Quando você colhe a soja?',
    /** Tela 2 do pacote 2 (tarefa 0057): na tela fica só a pergunta; o que ajuda a decidir vai para o modal grande. */
    lead: 'Escolha o dia em que a colheita costuma acontecer.',
    listenSummary: 'Ouvir resumo',
    stopListening: 'Parar',
    /** "Ouvir resumo" (regra geral 9): o começo da frase com a data ou com a época. */
    summaryDate: (date: string) => `Colhendo em ${date}`,
    summaryBand: (band: string) => `Colhendo no ${band}`,
    summaryRain: (start: string, median: string, dry: string) =>
      `${start}, sobram em média ${median} milímetros de chuva até o fim de junho; num ano seco, ${dry}. Quanto mais cedo a colheita, mais chuva sobra para a próxima planta.`,
    summaryNoRain: (start: string) => `${start}. Quanto mais cedo a colheita, mais chuva sobra para a próxima planta.`,
    summaryEmpty:
      'Escolha o dia em que você colhe a soja. Se não souber o dia exato, escolha a época: começo, meio ou fim de fevereiro.',
    /** Cartão "Dia da colheita". */
    dateLabel: 'Dia da colheita',
    emptyTitle: 'Escolha o dia da colheita',
    emptyHint: 'Toque em “Escolher data”.',
    bandHint: 'Época aproximada',
    /** Os dias de cada época no calendário ("FEV 11–20"). */
    bandDays: { cedo: '1–10', meio: '11–20', tarde: '21+' },
    pickDate: 'Escolher data',
    changeDate: 'Trocar data',
    pickDay: 'Escolher o dia',
    dontKnow: 'Não sei o dia exato',
    notSoy: 'Pelo satélite, este ponto não parece uma lavoura de soja.',
    notSoyLink: 'Conferir no mapa',
    nextStep: 'Próximo passo',
    cta: 'Ver a resposta',
    needChoice: 'Escolha uma data ou toque em “Não sei o dia exato”.',
    barEmpty: 'Escolha o dia da colheita para continuar',
    /** Caixa "Ainda não decidiu?" (abre o modal grande). */
    helpEyebrow: 'Por que perguntamos isso?',
    helpTitle: 'Ainda não decidiu? Veja nossas sugestões',
    helpText: 'A data muda a chuva que sobra e a melhor opção para a sua terra.',
    previewTitle: 'Chuva que sobra até junho, em média',
    bandShort: { cedo: 'Começo de fev.', meio: 'Meio de fev.', tarde: 'Fim de fev./março' },
    helpButton: 'Ver sugestões e detalhes',
    /** Modal "Não sei o dia exato": as 3 épocas, nenhuma marcada. */
    bandsTitle: 'Quando costuma ser a sua colheita?',
    bandsSubtitle: 'Escolha a época mais perto. Dá para mudar depois.',
    bandSub: { cedo: 'Até o dia 10', meio: 'Do dia 11 ao 20', tarde: 'Do dia 21 em diante' },
    bandsNote: 'A conta usa a época escolhida. Com o dia exato, a resposta fica mais certa.',
    useBand: 'Usar esta época',
    /** Modal grande "Nossas sugestões para a data da colheita": 4 blocos com os textos abertos. */
    detailsTitle: 'Nossas sugestões para a data da colheita',
    detailsLead:
      'A chuva vai acabando depois de março. Quanto mais cedo você colhe a soja, mais chuva sobra para a próxima planta crescer.',
    compareTitle: 'Compare as épocas',
    compareText:
      'Pela conta do app, a melhor planta para depois da soja muda com a época da colheita. Quem colhe mais cedo tem mais chuva pela frente; quem colhe mais tarde precisa de uma planta que aguente mais a seca.',
    yourBand: 'sua época',
    onAverage: 'em média',
    worked: (crop: string, good: number, total: number) => `${crop} · deu certo em ${good} de ${total} anos`,
    noOption: 'Nenhuma opção cabe no prazo de plantio.',
    /** O calor vem do `/api/metodo` (`calor_temp_c`); sem ele, a frase fica sem o número. */
    workedMeans: (heat: number | null, rain: string, years: string | null) =>
      `“Deu certo” quer dizer que não faltou água nem fez ${heat === null ? 'calor forte demais' : `${heat} °C ou mais`} na floração. Conta feita com a chuva do ${rain} e o calor do NASA POWER de cada ano${years ? `, de ${years}` : ''}.`,
    years: (first: number, last: number) => `${first} a ${last}`,
    learnWorked: 'Saiba mais: o que significa “deu certo”',
    rainTitle: 'Chuva que sobra para a próxima planta',
    /** Texto com **negrito** (lido pelo parseInline, nunca HTML). */
    rainEmpty: (end: string) =>
      `É a chuva somada do dia da colheita até ${end}: a água que a próxima planta ainda vai receber. Escolha uma data para ver os números da sua colheita.`,
    rainDate: (date: string, end: string, median: string, dry: string) =>
      `Colhendo em **${date}**, a próxima planta ainda recebe **${median} mm** de chuva até ${end} num ano normal, e **${dry} mm** num ano seco.`,
    rainBand: (band: string, date: string, end: string, median: string, dry: string) =>
      `Colhendo no **${band}** (por volta de ${date}), a próxima planta ainda recebe **${median} mm** de chuva até ${end} num ano normal, e **${dry} mm** num ano seco.`,
    rainOutside: (date: string, first: string, last: string) =>
      `Colhendo em **${date}**: a conta da chuva que sobra vai de ${first} a ${last}, e esse dia fica fora dela.`,
    rainLines: (first: number, last: number, percentile: number) =>
      `A **linha azul** mostra um ano normal (a mediana de ${first} a ${last}). A **linha laranja** mostra um ano seco: só ${
        percentile % 10 === 0 ? `${percentile / 10} em cada 10 anos` : `${percentile}% dos anos`
      } tiveram menos chuva que isso. Cada semana de atraso na colheita tira chuva da próxima planta.`,
    rainSource: (source: string, first: number, last: number) =>
      `Chuva medida pelo ${source}, de ${first} a ${last}, no ponto da sua lavoura.`,
    rainChartLabel: 'Gráfico: quanto mais tarde a colheita, menos chuva sobra para a próxima planta até o fim de junho.',
    rainChartLabelDay: (date: string, median: string, dry: string) =>
      `Gráfico: quanto mais tarde a colheita, menos chuva sobra. Colhendo em ${date}, sobram ${median} mm em média e ${dry} mm num ano seco.`,
    legendMedian: 'Em média',
    legendDry: 'Ano seco',
    learnRain: 'Saiba mais: plantar logo depois da colheita',
    monthTitle: 'Chuva e o que a lavoura gasta, mês a mês',
    monthText:
      'Compara, mês a mês, a chuva que cai com a água que a lavoura gasta (o sol, o calor e o vento puxam água da planta e da terra).',
    /** O mês em que a chuva fica menor que o gasto vem do backend (`mes_chuva_abaixo_eto`). */
    monthRange: (from: string, to: string) => (from === to ? `Em ${from}` : `De ${from} a ${to}`),
    monthTurn: (range: string | null, month: string) =>
      range
        ? `${range} chove mais do que a lavoura gasta. Em **${month}** isso vira: a chuva fica menor que o gasto, e a planta passa a depender da água guardada na terra. Por isso a floração não pode cair tarde demais.`
        : `Já em **${month}** a chuva fica menor que o gasto, e a planta passa a depender da água guardada na terra. Por isso a floração não pode cair tarde demais.`,
    monthNoTurn: 'De janeiro a junho, a chuva média cobre o que a lavoura gasta.',
    learnWater: 'Saiba mais: a conta de água da lavoura',
    endTitle: 'Quando a chuva acaba',
    endText: (median: string, earliestYear: number, earliest: string, latestYear: number, latest: string) =>
      `Em **metade dos anos**, a chuva acabou até **${median}**. Mas varia muito: o ano em que acabou mais cedo foi ${earliestYear} (${earliest}) e o mais tarde, ${latestYear} (${latest}).`,
    endRule: (start: string, days: number, mm: string) =>
      `Contamos que a chuva acabou no primeiro dia, a partir de ${start.replace(/^1 /, '1º ')}, que começa **${days} dias seguidos com menos de ${mm} mm** somados. Como ninguém sabe se o ano vai ser bom ou ruim, vale olhar o pior caso também.`,
    endSource: (source: string, first: number, last: number) => `Chuva do ${source}, de ${first} a ${last}.`,
    endYear: (date: string, year: number) => `${date} · ${year}`,
    endHalf: (date: string) => `${date} · metade dos anos`,
    endChartLabel: (median: string, earliest: string, latest: string) =>
      `Linha do tempo: em metade dos anos, a chuva acabou até ${median}; o mais cedo foi ${earliest} e o mais tarde, ${latest}.`,
    learnEnd: 'Saiba mais: quando a chuva acaba',
    months: { jan: 'jan', feb: 'fev', mar: 'mar', apr: 'abr', may: 'mai', jun: 'jun' },
    etoLegendRain: 'Chuva',
    etoLegendEto: 'Gasto da lavoura',
    etoTag: 'chove menos',
    etoChartLabel: (values: string) => `Chuva e gasto da lavoura em cada mês, em milímetros: ${values}`,
    etoMonthValue: (month: string, rain: string, eto: string) => `${month}, chuva ${rain} e gasto ${eto}`,
    etoCaption: (first: number, last: number, years: number, rainSource: string, etoSource: string) =>
      `${
        years === last - first + 1 ? `Média de ${first} a ${last}` : `Média de ${years} anos entre ${first} e ${last}`
      }, em mm. Chuva: ${rainSource}. Gasto da lavoura: evapotranspiração de referência (ETo), calculada com o clima do ${etoSource}.`,
    /** Só na página do design system (exemplos dos componentes antigos). */
    dateBand: (date: string, band: string) => `Dia ${date}: conta como ${band}.`,
    defaultSuggestion: 'Não deu para ver pelo satélite. Deixamos marcado o meio de fevereiro.',
    chartLabel: 'Chuva média por mês: muita em janeiro, pouca em junho',
    chartCaption: 'Chuva de cada mês na região. Desenho de exemplo.',
  },
  mission: {
    /** "Ouvir resumo" (regra geral 9 do pacote 2): o lugar e os anos de chuva lidos. */
    summary: (place: string | null, rainYears: number | null) =>
      `O satélite está lendo a sua lavoura${place ? `, perto de ${place}` : ''}. ${
        rainYears ? `Juntamos ${rainYears} anos de chuva, o solo e o verde da lavoura, em 6 partes.` : 'Juntamos a chuva, o solo e o verde da lavoura, em 6 partes.'
      } Quando terminar, você vê o raio-X da sua terra.`,
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
    subtitle: 'Confira o raio-X da sua terra e confirme as últimas safras.',
    historyStripLabel: (planted: number, known: number, uncertain: number) =>
      `Plantou em ${planted} de ${known} anos${uncertain > 0 ? ` (${uncertain} sem certeza)` : ''}`,
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
    loading: 'Buscando dados do satélite…',
    error: 'Não conseguimos buscar os dados agora. Tente de novo ou veja a lavoura de demonstração.',
    climateTitle: 'Clima dos próximos anos',
    /** O período vem do NEX-GDDP-CMIP6 em dados[] (2041–2060). */
    climateSubtitle: (start: string, end: string) => `Como a chuva e o calor devem mudar de ${start} a ${end}.`,
    climateSubtitleGeneric: 'Como a chuva e o calor devem mudar nos próximos anos.',
    cta: 'Ver o que plantar',
    noSoyTitle: 'Não parece uma lavoura de soja. Confira o ponto no mapa.',
    noSoyDetail: 'O satélite não viu a soja crescer e ser colhida aqui nos anos que conseguiu olhar.',
    adjustMap: 'Ajustar no mapa',
    confirmTitle: 'Confirme as últimas safras',
    /** Resumo falado (tarefa 0058): com os números da tela; frase sem dado não entra. */
    summary: {
      soil: (texture: string, mm: string) => `Sua terra é ${texture} e guarda cerca de ${mm} milímetros de água.`,
      water: (mm: string) => `A terra guarda cerca de ${mm} milímetros de água.`,
      moisture: (pct: number) => `Hoje ela está mais úmida que em ${pct}% dos anos.`,
      rain: (mm: string) => `Num ano típico chovem ${mm} milímetros de janeiro a julho.`,
      rainDryspell: (mm: string, days: number) =>
        `Num ano típico chovem ${mm} milímetros de janeiro a julho, e o maior veranico foi de ${days} dias.`,
      dryspell: (days: number) => `O maior veranico foi de ${days} dias.`,
      ask: 'Confirme abaixo o que você plantou nas últimas safras.',
    },
    /** "Suas últimas safras" (pacote 2, tarefa 0058): o gráfico do satélite e as confirmações. */
    seasons: {
      title: 'Suas últimas safras',
      subtitle: (first: string) => `O que o satélite viu na sua área desde a safra ${first}, e o que você confirmou.`,
      subtitleNoReading: 'Marque o que você fez nas últimas 3 safras e o que pensa plantar nesta.',
      seenAll: 'O satélite viu a soja nas 3 últimas safras',
      seenSome: (count: number) => `O satélite viu a soja em ${count} das 3 últimas safras`,
      seenNone: 'O satélite não viu a soja nas 3 últimas safras',
      noReading: 'Sem leitura do satélite neste ponto: marque você',
      chartTitle: (idle: number, total: number) => `Na entressafra, sua área ficou parada em ${idle} de ${total} safras`,
      chartTitleNoSoy: 'O satélite não viu soja aqui nas safras que leu',
      chartTitleNoReading: 'As últimas safras, pelo que você marcar',
      colSeason: 'Safra',
      colAfter: 'Depois da soja',
      marks: { soy: 'Soja', harvest: 'Colheita', after: 'Depois da soja' },
      /** Coluna da direita: o que o satélite viu depois da soja. */
      satellite: {
        plantou: 'satélite: plantou',
        parado: 'satélite: parada',
        incerto: 'satélite: sem certeza',
        sem_dado: 'satélite: sem leitura',
        sem_soja: 'satélite: sem soja',
      },
      missing: 'Falta confirmar',
      noSoy: 'Não plantei soja',
      toPlan: 'a planejar',
      plans: (crop: string) => `pensa em ${crop}`,
      notSure: 'ainda não sabe',
      cell: (day: string, value: string) => `${day}: NDVI ${value}`,
      cellEmpty: (day: string) => `${day}: sem leitura`,
      legendTitle: 'Verde (NDVI):',
      legend: ['menos de 0,30', '0,30 a 0,45', '0,45 a 0,60', '0,60 a 0,75', '0,75 ou mais'],
      legendNoReading: 'sem leitura do satélite',
      legendCurrent: 'safra atual (ainda sem leitura)',
      chartSource: 'MODIS NDVI · NASA · 250 m',
      confirmSub: 'O satélite vê que houve plantio, mas não qual planta. Sua resposta vale no lugar dele.',
      confirmSubNoReading: 'Sem leitura do satélite neste ponto, o que vale é a sua resposta.',
      note: 'Usamos essas respostas para comparar o seu plano com “como é hoje”.',
      rotation: 'Saiba mais: rotação de culturas',
      missingAction: (count: number) =>
        `${count === 1 ? 'Falta 1 safra' : `Faltam ${count} safras`}. Pode seguir: sem resposta, usamos o que o satélite viu.`,
      missingActionNoReading: (count: number) =>
        `${count === 1 ? 'Falta 1 safra' : `Faltam ${count} safras`}. Pode seguir: sem resposta, o plano não compara com “como é hoje”.`,
      done: 'Últimas safras confirmadas.',
      barCount: (count: number) => `${count} de 3 safras confirmadas`,
      barDone: '3 safras confirmadas',
    },
    /** Sem o raio-X (falha ou API antiga): a terra, com a escolha, num cartão claro. */
    soilFallback: (texture: string) => `Terra ${texture}`,
  },
  /** Raio-X da sua terra (tela 4, remodelagem S4, tarefa 0043): os números vêm do `/api/raio-x`. */
  xray: {
    place: (name: string) => `Perto de ${name}`,
    mapLabel: (name: string) => `Miniatura do mapa com o ponto marcado, perto de ${name}`,
    latestReading: (date: string) => `Leitura mais recente: ${date}`,
    altitude: (meters: string) => `Altitude: ${meters} m`,
    learnMore: (title: string) => `Saiba mais: ${title}`,
    articles: {
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
    /** Os títulos dos "Saiba mais" do Guia nos modais dos blocos (tarefa 0058). */
    guides: {
      xray: 'como ler o raio-X da sua terra',
      rain: 'quando a chuva acaba',
      dryspell: 'veranico',
      heat: 'calor de 35 °C na floração',
    },
    textures: { arenoso: 'arenosa', medio: 'média', argiloso: 'argilosa' },
    eyebrow: 'Raio-X da sua terra',
    /** Tocar no bloco abre o modal com o texto completo (texto escondido, para o leitor de tela). */
    details: 'Ver detalhes',
    note: 'Toque num bloco para ver os detalhes. Cada dado vale para a área em volta do ponto, no tamanho indicado no selo.',
    /** Os 8 blocos (tarefa 0058): no bloco, só o nome, o número, uma linha e o selo; o resto fica no modal. */
    soil: {
      label: 'Solo',
      unit: '% de argila',
      line: (texture: string) => `Terra ${texture}`,
      lineChosen: (texture: string) => `Você escolheu: terra ${texture}`,
      title: 'Do que a sua terra é feita',
      text: (clay: number, silt: number, sand: number, texture: string, about: string) =>
        `Pelo mapa de solos SoilGrids, a terra deste ponto tem **${clay}% de argila**, ${silt}% de silte e ${sand}% de areia. É uma terra ${texture}: ${about}`,
      about: {
        arenoso: 'solta, seca rápido e guarda menos água.',
        medio: 'nem muito solta, nem pesada.',
        argiloso: 'segura bem a água, mas encharca mais fácil.',
      },
      neighbor: (km: string) => `A célula do ponto não tem dado de solo: usamos o ponto mais perto, a ${km} km.`,
      chosen: (texture: string) => `Você escolheu terra ${texture}: a conta da água usa a sua escolha.`,
      source: 'SoilGrids (ISRIC), mapa de 250 m, CC BY 4.0.',
      change: 'Sua terra é diferente?',
      options: { arenoso: 'Arenosa', medio: 'Média', argiloso: 'Argilosa' },
    },
    water: {
      label: 'Água que a terra guarda',
      unit: 'mm',
      line: (days: number) => `Aguenta ~${days} dias sem chuva na floração`,
      lineNoCrop: 'Ao alcance das raízes',
      title: 'Quanta água a terra guarda',
      text: (mm: string) => `A terra deste ponto guarda cerca de **${mm} mm** de água para a planta.`,
      flowering: (crop: string, date: string, use: string, days: number) =>
        `Na floração de ${crop}, por volta de ${date}, a planta gasta uns ${use} mm por dia. Então a terra aguenta **cerca de ${days} dias sem chuva** nessa fase.`,
      source: (eto: string, kc: string) =>
        `Textura do SoilGrids; gasto de água: evapotranspiração de ${eto} mm do NASA POWER × coeficiente da cultura ${kc}.`,
      sourceNoCrop: 'Textura do SoilGrids (ISRIC).',
    },
    moisture: {
      label: 'Umidade da terra agora',
      line: (pct: number) => `Mais úmida que em ${pct}% dos anos nesta época`,
      title: 'Como está a terra agora',
      text: (date: string, pct: number) =>
        `Na leitura de **${date}**, a terra estava **mais úmida que em ${pct}% dos anos** nesta mesma época.`,
      source: 'SMAP L4 (NASA), 9 km.',
    },
    green: {
      label: 'Verde da lavoura',
      unit: 'NDVI',
      /** "jan/2026" */
      month: (month: string, year: string) => `${month}/${year}`,
      linePeak: (value: string, month: string) => `Pico da última soja: ${value} (${month})`,
      lineNoSoy: (value: string) => `Maior verde de jan a meados de mar: ${value}`,
      lineLast: (date: string) => `Última leitura: ${date}`,
      title: 'O verde da lavoura visto do espaço',
      text: 'O NDVI mede o verde da planta: vai de **0 (terra nua)** a **1 (verde forte)**.',
      last: (value: string, date: string) => `Última leitura: ${value}, em ${date}.`,
      peak: (season: string, value: string) => `Na soja ${season}, o pico foi ${value}.`,
      peakOn: (season: string, value: string, date: string) => `Na soja ${season}, o pico foi ${value}, em ${date}.`,
      /** Sem soja no ponto (tarefa 0049): o número é só o maior verde da janela do pico da soja. */
      peakNoSoy: (season: string, value: string, date: string | null) =>
        `Maior verde de janeiro a meados de março (${season}): ${value}${date ? `, em ${date}` : ''}. O satélite não viu soja aqui.`,
      source: 'MODIS NDVI (NASA), MOD13Q1 + MYD13Q1, pixel de 250 m.',
    },
    rain: {
      label: 'Chuva num ano típico',
      unit: 'mm',
      line: (years: number) => `De janeiro a julho, média de ${years} anos`,
      title: 'Quanto chove num ano típico',
      text: (mm: string, first: number, last: number) =>
        `De janeiro a julho caem, em média, **${mm} mm** de chuva neste ponto (${first} a ${last}).`,
      end: (median: string) => `Em metade dos anos, a chuva acabou até ${median}.`,
      endRange: (early: string, late: string) => `A que acabou mais cedo foi em ${early}; a mais tarde, em ${late}.`,
      source: 'GPM IMERG Final (NASA), 10 km.',
    },
    dryspell: {
      label: 'Maior veranico',
      unit: 'dias',
      line: (year: number) => `Seguidos sem chuva, em ${year}`,
      title: 'O maior período sem chuva',
      text: (year: number, start: string, days: number, total: number) =>
        `Em ${year}, a partir de ${start}, foram **${days} dias seguidos** com menos de 1 mm de chuva por dia. Foi o maior trecho seco entre março e maio em ${total} anos.`,
      source: (total: number) => `GPM IMERG Final (NASA), 10 km, ${total} anos.`,
    },
    heat: {
      label: 'Calor forte',
      unit: (total: number) => `de ${total} anos`,
      line: (temp: string) => `Com ${temp} °C ou mais de março a maio`,
      title: 'Dias de calor forte',
      none: (total: number, temp: string) => `Em ${total} anos, nenhum teve dia de ${temp} °C ou mais entre março e maio.`,
      one: (total: number, year: string, temp: string) =>
        `Em ${total} anos, só **1 ano (${year})** teve pelo menos um dia de ${temp} °C ou mais entre março e maio.`,
      many: (total: number, count: number, years: string, temp: string) =>
        `Em ${total} anos, **${count} anos (${years})** tiveram pelo menos um dia de ${temp} °C ou mais entre março e maio.`,
      why: 'Calor assim na floração faz a planta perder flor e produção.',
      source: (total: number) => `NASA POWER, ~50 km, ${total} anos.`,
    },
    region: {
      label: 'Sua área e a região',
      lineWetter: (pct: number) => `Mais chuvosa que ${pct}% da região (mar–mai)`,
      lineDrier: (pct: number) => `Mais seca que ${pct}% da região (mar–mai)`,
      title: 'Sua área comparada com a região',
      textWetter: (pct: number, mm: string, cells: number) =>
        `Na chuva de março a maio, sua área é **mais chuvosa que ${pct}% da região**: ${mm} mm em média, comparada com ${cells} áreas de 10 km em volta.`,
      textDrier: (pct: number, mm: string, cells: number) =>
        `Na chuva de março a maio, sua área é **mais seca que ${pct}% da região**: ${mm} mm em média, comparada com ${cells} áreas de 10 km em volta.`,
      source: 'GPM IMERG Final (NASA), 10 km.',
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
  /**
   * Tela 6 "Seu planejamento" (`/planejamento`, pacote 3): a tela final do fluxo, com o resumo do plano, "O que
   * fazer agora", os alertas da área, o passado e o futuro das culturas do plano, a comunidade e o relatório
   * para imprimir (o único "Imprimir relatório" do app).
   */
  planning: {
    title: 'Seu planejamento',
    and: 'e',
    back: 'Voltar ao plano',
    ready: 'Seu planejamento está pronto',
    loading: 'Montando o seu planejamento…',
    error: 'Não deu para montar o seu planejamento agora.',
    demo: 'Lavoura de demonstração, perto de Uberlândia (MG)',
    place: (place: string) => `Sua lavoura, perto de ${place}`,
    harvest: 'colheita da soja prevista em',
    harvestBand: (band: string) => `colheita da soja prevista no ${band}`,
    summary: {
      plan: (c1: string, s1: string, c2: string, s2: string, c3: string, s3: string) =>
        `Seu plano: ${c1} depois da soja de ${s1}, ${c2} em ${s2} e ${c3} em ${s3}.`,
      plant: (date: string, crop: string, deadline: string) => `Colha a soja por volta de ${date} e plante ${crop} até ${deadline}.`,
      plantSoon: (date: string, crop: string) => `Colha a soja por volta de ${date} e plante ${crop} logo depois.`,
      plantLate: (date: string, crop: string, deadline: string) =>
        `Colha a soja por volta de ${date} e plante ${crop} logo depois; o prazo do ZARC acabou em ${deadline}.`,
      harvestOnly: (date: string) => `Colha a soja por volta de ${date}.`,
      planB: (crop: string) => `Em fevereiro, confira o sinal do outono: se o ano vier seco, troque para ${crop}.`,
      check: 'Em fevereiro, confira o sinal do outono.',
    },
    plan: {
      label: 'Seu plano de 3 anos',
      after: (season: string) => `Depois da soja ${season}`,
      worked: (good: number, total: number) => `Deu certo em ${good} de ${total} anos`,
      fallow: 'Sem lavoura: a terra fica descoberta.',
      actions: 'Guarde o plano e leve para conversar com o seu agrônomo.',
      change: 'Mudar o plano',
    },
    print: 'Imprimir relatório',
    timeline: {
      title: 'O que fazer agora',
      sub: 'Do fim desta soja até a próxima safra. As datas vêm da sua colheita e do prazo do ZARC.',
      nowTag: 'agora',
      now: {
        when: 'Agora',
        title: 'Cuide da soja e fique de olho nos avisos',
        text: 'Os avisos de calor, veranico e terra seca aparecem no sino lá em cima.',
      },
      signal: {
        when: 'Fevereiro',
        title: 'Confira o sinal do outono',
        planB: (crop: string) => `Se em fevereiro o sinal for de ano seco e a terra estiver seca, troque para o Plano B: ${crop}.`,
        notNeeded: (crop: string) => `Não precisa de Plano B: ${crop} deu certo em todos os anos.`,
        notNeededFallow: 'Não precisa de Plano B: com a terra parada, não há lavoura para perder na seca.',
        none: (crop: string) => `Nenhuma outra cultura deu mais certo nos anos em que ${crop} falhou: siga com ${crop}.`,
        check: 'Em fevereiro, confira de novo o sinal e a umidade da terra (SMAP) antes de plantar.',
        tag: (crop: string) => `Plano B: ${crop}`,
      },
      harvest: {
        sub: 'colheita',
        title: 'Colha a soja',
        text: 'Quanto mais cedo a colheita, mais chuva sobra para a próxima planta.',
      },
      plant: {
        when: (date: string) => `até ${date}`,
        sub: 'prazo ZARC',
        title: (crop: string) => `Plante ${crop}`,
        text: (date: string) => `Plante logo depois de colher: o prazo do ZARC vai até ${date}. Depois disso, o seguro rural não cobre.`,
        late: (date: string) => `Passou do prazo do ZARC (${date}): o seguro rural não cobre.`,
        lateNoDate: 'Passou do prazo do ZARC: o seguro rural não cobre.',
        soonSub: 'plantio',
        soon: 'Plante logo depois de colher a soja.',
      },
      water: {
        sub: { floracao: 'floração', pegamento: 'pegamento' },
        title: 'Fase em que a planta mais precisa de água',
        flower: (days: number) => `É quando mais aparece veranico: a floração vem por volta de ${days} dias depois do plantio.`,
        start: (days: number) => `Nos primeiros ${days} dias depois do plantio, a planta precisa de água para pegar.`,
      },
      cropHarvest: {
        grain: 'Colha e deixe a palha no chão',
        cover: 'Deixe a palha no chão',
        text: 'A palhada protege a terra na seca e ajuda a próxima soja.',
      },
      next: {
        when: 'out–nov',
        title: (crop: string) => `Próxima soja; depois dela, ${crop}`,
        titleAlone: 'Próxima soja',
        text: (year: number) => `Abra o app de novo depois da colheita de ${year} para conferir o plano com a chuva daquele ano.`,
      },
    },
    alerts: {
      title: 'Alertas da sua área',
      sub: 'O que vale acompanhar nesta lavoura.',
      seeAll: 'Ver todos os avisos',
      todo: 'O que fazer:',
      source: (source: string) => `Fonte: ${source}`,
      now: { label: 'Agora', todo: 'confira o sinal em fevereiro, antes de plantar.' },
      heavyRain: {
        label: 'Chuva forte',
        text: (days: number, total: number, limit: string) =>
          `Em ${total} anos, ${days === 1 ? 'houve 1 dia' : `houve ${days} dias`} com ${limit} mm ou mais de chuva em fevereiro e março.`,
        todo: 'não deixe a terra descoberta depois da colheita: terra nua perde solo nesses dias.',
        source: 'GPM IMERG (NASA)',
        guide: 'Saiba mais: como evitar erosão',
      },
      fire: {
        label: 'Fogo',
        text: (km: string, years: number, total: number) => `Houve fogo a até ${km} km do seu ponto em ${years} dos últimos ${total} anos.`,
        todo: 'mantenha aceiros e não queime a palha.',
        source: 'MODIS (NASA)',
        guide: 'Saiba mais: fogo na palha',
      },
      official: 'Estes avisos não substituem a Defesa Civil.',
      officialText: 'Para alertas oficiais: SMS 40199 com o seu CEP.',
      officialLink: 'Ver alertas oficiais',
    },
    past: {
      title: 'Seu plano: o que já aconteceu e o que vem',
      sub: 'Como cada cultura do plano teria se saído nos últimos 20 anos e no clima de 2041 a 2060.',
      tableTitle: 'Deu certo em quantos anos',
      season: 'Safra',
      past: '2005–2024',
      future: '2041–2060',
      value: (good: number, total: number) => `${good} de ${total}`,
      fallow: 'sem lavoura',
      source: (rain: string) => `Chuva: ${rain}. Calor e gasto de água: NASA POWER. Clima futuro: NEX-GDDP-CMIP6 (NASA).`,
      climateTitle: 'Clima de 2041 a 2060',
      climateText: 'Na sua área, comparado com 2005–2024:',
      climateRain: 'chuva de março a maio',
      climateHeat: 'temperatura máxima',
      climateGuide: 'Saiba mais: o clima de 2041 a 2060',
      climateSource: (scenario: string) => `Média dos modelos do NEX-GDDP-CMIP6 (NASA), cenário intermediário (${scenario}).`,
    },
    /** Pacote 3: a comunidade ainda não abriu ("em breve"); enquanto isso, o botão leva ao Guia. */
    community: {
      soon: 'Em breve',
      title: 'Comunidade da sua região',
      text: 'Em breve, um espaço para acompanhar a sua região e conversar com os vizinhos.',
      pills: ['O que os vizinhos plantaram depois da soja', 'Quanto choveu em cada lavoura', 'O que aconteceu perto de você'],
      guide: 'Enquanto isso, o Guia explica cada cultura, o plantio e o clima.',
      openGuide: 'Abrir o Guia',
    },
    reportCard: {
      title: 'Relatório do seu planejamento',
      text: 'Tudo numa folha para guardar ou levar ao agrônomo:',
      items: ['Sua terra', 'Últimas safras', 'Opções comparadas', 'Plano de 3 anos', 'O que fazer e quando', 'Alertas e clima'],
      missing: 'Você não preencheu as últimas safras: no relatório, entra o que o satélite viu ou "não preenchido".',
    },
    again: 'Tem outra lavoura?',
    againLink: 'Fazer um novo planejamento',
    report: {
      title: 'Raiz Orbital · Relatório do planejamento',
      demo: 'Lavoura de demonstração, perto de Uberlândia (MG)',
      point: 'Sua lavoura',
      place: (place: string) => `Sua lavoura, perto de ${place}`,
      harvest: (date: string) => `Colheita da soja prevista em ${date}`,
      harvestBand: (band: string) => `Colheita da soja prevista no ${band}`,
      generated: (date: string) => `Gerado em ${date} pelo Raiz Orbital`,
      soil: '1. Sua terra',
      soilTexture: (texture: string, clay: number, cad: string) =>
        `Terra ${texture} (${clay}% de argila), guarda cerca de ${cad} mm de água.`,
      soilMoisture: (pct: number) => `Umidade agora: mais úmida que em ${pct}% dos anos (SMAP).`,
      soilRain: (mm: string) => `Chuva num ano típico: ${mm} mm de janeiro a julho.`,
      soilDry: (days: number, year: number) => `Maior veranico de março a maio: ${days} dias (${year}).`,
      soilNone: 'O raio-X da sua terra não carregou agora.',
      seasons: '2. Últimas safras',
      season: 'Safra',
      after: 'Depois da soja',
      current: (season: string) => `${season} (o que você pensava plantar)`,
      soyOnly: 'Soja (sem dizer o que veio depois)',
      noSoy: 'Sem soja',
      notFilled: 'não preenchido',
      satellite: {
        plantou: 'plantou algo (visto pelo satélite)',
        parado: 'deixou parado (visto pelo satélite)',
        sem_soja: 'sem soja (visto pelo satélite)',
      },
      options: '3. Opções comparadas',
      crop: 'Cultura',
      worked: 'Deu certo',
      income: 'Grão',
      deadline: 'Prazo',
      grain: 'Dá grão',
      noGrain: 'Não dá grão',
      plan: '4. Plano de 3 anos',
      pros: 'Prós',
      cons: 'Contras',
      gain: {
        title: 'Como o plano ajuda a ganhar:',
        income: (crop: string, seasons: string) => `${crop} dá grão para vender em ${seasons}.`,
        noIncome: 'Nenhum ano do plano dá grão para vender: o ganho vem na terra e na soja seguinte.',
        cover: (crop: string, season: string, gives: string) => `${crop}, em ${season}, não dá grão, mas ${gives}: isso ajuda a soja seguinte.`,
        straw: 'deixa palha que protege a terra',
        nitrogen: 'deixa nitrogênio para a soja',
        nematode: 'quebra o ciclo do nematoide',
        planB: (from: string, to: string) => `Plano B: se o outono vier seco, trocar ${from} por ${to}.`,
      },
      todo: '5. O que fazer e quando',
      when: 'Quando',
      step: 'O que fazer',
      alerts: '6. Alertas e clima',
      alertsNone: 'Nenhum alerta com dado para este ponto.',
      climate: (rain: string, heat: string, agreement: string) =>
        `Clima de 2041 a 2060, comparado com 2005–2024: chuva de março a maio ${rain}%; temperatura máxima ${heat} °C. ${agreement}`,
      sources: '7. Fontes e aviso',
      sourcesText:
        'GPM IMERG, NASA POWER, NEX-GDDP-CMIP6, SMAP e MODIS (NASA); SoilGrids (ISRIC); NOAA CPC (índice ONI e previsão de El Niño / La Niña); ZARC (Ministério da Agricultura) e Embrapa.',
      disclaimer: 'Ajuda a decidir. Não substitui o seu agrônomo nem os alertas da Defesa Civil.',
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
  /** Tela 5 do pacote 2: "1. Escolher" e "2. Plano de 3 anos" (`/resposta`, `/opcoes`, `/plano`) e o relatório. */
  choose: {
    title: 'O que plantar depois da soja',
    context: (season: string, date: string) => `Safra ${season} · colheita prevista em ${date}`,
    contextBand: (season: string, band: string) => `Safra ${season} · colheita prevista no ${band}`,
    summary: (suggestion: string, idea: string | null) =>
      `A nossa sugestão para depois da soja é ${suggestion}.${idea ? ` Você pensava em ${idea}.` : ''} Compare as opções e escolha uma para o seu plano de 3 anos.`,
    tabsLabel: 'Etapas',
    tabChoose: 'Escolher',
    tabPlan: 'Plano de 3 anos',
    objective: {
      title: 'O que você quer mais?',
      note: 'A sugestão muda conforme a sua escolha. Sem escolha, o app equilibra as três.',
      seguranca: 'Mais segurança',
      renda: 'Renda',
      terra: 'Cuidar da terra',
    },
    tags: { suggestion: 'Nossa sugestão', choice: 'Sua escolha', late: 'Passou do prazo', changed: 'Você mudou' },
    pickerTags: { suggestion: 'sugestão', choice: 'sua escolha', late: 'fora do prazo' },
    card: {
      label: 'Nossa sugestão',
      why: 'Por que essa sugestão?',
      use: 'Usar no meu plano',
      inPlan: '✓ Está no seu plano',
      worked: (good: number, total: number) => `Deu certo em ${good} de ${total} anos`,
      grain: 'Dá grão para vender',
      noGrain: 'Não dá grão',
    },
    compare: {
      title: 'Compare as opções',
      sub: 'Toque em qualquer valor para ver o detalhe, com a conta e a fonte.',
      pickLabel: 'Comparar:',
      pickHint: 'Marque até 3. Já vêm marcadas a sua escolha e a nossa sugestão. Com 3 marcadas, tire uma para pôr outra.',
      region: 'Comparação lado a lado',
      swipe: 'Arraste para o lado para ver as outras',
      rows: {
        worked: 'Deu certo',
        water: 'Água',
        future: 'Clima 2041–2060',
        income: 'Renda',
        soil: 'Terra',
        deadline: 'Prazo para plantar',
        pros: 'A favor',
        cons: 'Contra',
      },
      worked: (good: number, total: number) => `${good} de ${total} anos`,
      waterShort: (mm: string) => `Falta ${mm} mm`,
      waterNone: 'Não falta em ano normal',
      waterDry: (mm: string) => `num ano seco: ${mm} mm`,
      future: (good: number, total: number) => `${good} de ${total} anos`,
      futureRange: (min: number, max: number) => `de ${min} a ${max}, conforme o modelo`,
      deadline: (date: string) => `Até ${date}`,
      deadlineLate: (date: string) => `Passou do prazo (${date})`,
      deadlineNone: 'Logo depois da colheita',
      noDeadline: 'Sem prazo',
      noCrop: 'Sem lavoura: não entra na conta',
      details: 'detalhes',
      choose: 'Essa é a escolha para o meu plano',
      chosen: 'Escolha do meu plano',
      pros: {
        safe: 'Deu certo em quase todos os anos',
        grain: 'Dá grão com pouco risco de perder',
        soil: 'Cuida bem da terra',
        littleWater: 'Pede pouca água',
      },
      cons: {
        late: (date: string) => `Passou do prazo do ZARC (${date}): o seguro não cobre`,
        lateNoDate: 'Passou do prazo do ZARC: o seguro não cobre',
        risky: 'Falhou em muitos anos',
        noGrain: 'Não dá grão para vender',
        soilWeak: 'Ajuda pouco a terra',
        muchWater: 'Pede muita água',
        futureWorse: 'No clima de 2041–2060, daria certo em menos anos',
      },
      nothing: 'Nada se destaca',
      fallowPros: ['Não tem custo de semente'],
      fallowCons: ['A chuva cai sem virar grão nem palha', 'A terra descoberta perde solo e água'],
      nextLead: (season: string) => `No seu plano, depois da soja ${season}:`,
      goPlan: 'Ver o plano de 3 anos',
    },
    cell: {
      workedText: 'Em quantos dos 20 anos a planta teve água e não pegou calor na fase que mais precisa (conta do motor).',
      workedFails: (water: number, heat: number) => `Faltou água em ${water} anos; fez calor em ${heat}.`,
      workedSource: 'Chuva: GPM IMERG (NASA). Calor e gasto de água: NASA POWER. 2005 a 2024.',
      waterText: (need: string, rain: string, normal: string, dry: string, cad: string) =>
        `A planta precisa de ${need} mm no ciclo. Nesses dias chovem, em metade dos anos, ${rain} mm. Num ano normal faltam ${normal} mm; num ano seco, ${dry} mm. A terra guarda ${cad} mm e ajuda a cobrir parte disso.`,
      waterSource: 'Chuva: GPM IMERG (NASA). Gasto de água: NASA POWER. Água que a terra guarda: SoilGrids.',
      futureText: (good: number, total: number, min: number, max: number) =>
        `Com o clima projetado para 2041–2060, daria certo em ${good} de ${total} anos (de ${min} a ${max}, conforme o modelo).`,
      futureSource: 'NEX-GDDP-CMIP6 (NASA), cenário SSP2-4.5, média dos modelos.',
      incomeText:
        '"Dá grão" quer dizer que há o que vender. O risco é em quantos dos 20 anos faltou água ou fez calor na fase que mais precisa. Sem valores em reais.',
      soilText: 'Palhada, nitrogênio e o ciclo do nematoide. Rascunho: a revisar pela agrônoma.',
      deadlineOk: (limit: string, harvest: string) =>
        `Pelo ZARC (Ministério da Agricultura), o plantio vai até ${limit}. Plantando em ${harvest}, logo depois de colher a soja, dá tempo.`,
      deadlineLate: (limit: string, harvest: string) =>
        `Pelo ZARC, o plantio ia até ${limit}. Plantando em ${harvest}, logo depois de colher a soja, passa do prazo: o risco sobe e o seguro rural não cobre. A conta mostra como seria plantando nesse dia.`,
      deadlineNone: 'O motor não tem uma data limite do ZARC para esta cultura: plante logo depois de colher a soja.',
      zarc: 'ZARC é o Zoneamento Agrícola de Risco Climático do Ministério da Agricultura: diz, para cada município, até quando plantar com o risco de clima mais baixo. Fora do prazo, o seguro rural e o Proagro não cobrem.',
      deadlineSource: 'ZARC (Ministério da Agricultura) e Embrapa.',
      engineSource: 'Conta do motor do Raiz Orbital, com dados da NASA. As regras estão em "Como a conta é feita".',
      prosCons: 'A favor e contra',
      fallow: 'Com a terra parada, não há lavoura para entrar na conta.',
    },
    why: {
      subtitle: (date: string) => `Para a sua lavoura, plantando em ${date}, logo depois de colher a soja.`,
      worked: 'Deu certo ano a ano',
      water: 'Água',
      climate: 'Clima de 2041 a 2060',
      incomeSoil: 'Renda e terra',
      how: 'Como fazer',
      learnMore: 'Saiba mais',
    },
    plan: {
      title: 'Seu plano de 3 anos',
      intro: 'O 1º ano é a sua escolha. Os outros dois são a nossa sugestão e mudam quando você troca um ano.',
      yearsLabel: 'Seu plano ano a ano',
      after: (season: string) => `Depois da soja ${season}`,
      choose: 'O que plantar',
      chooseFor: (season: string) => `depois da soja ${season}`,
      why: 'Por quê:',
      worked: (good: number, total: number) => `Deu certo em ${good} de ${total} anos`,
      fallow: 'Sem lavoura: a terra fica descoberta.',
      lateOption: (crop: string) => `${crop} (passou do prazo)`,
      alertYear1: 'Seu 1º ano mudou para',
      alertYear1After: 'Refizemos a sugestão dos outros anos.',
      alertChanged: (season: string) => `Você mudou ${season} para`,
      alertNext: (season: string) => `Para ${season} agora sugerimos`,
      reset: 'Voltar ao plano sugerido',
      loading: 'Montando o plano…',
      updating: 'Recalculando…',
      error: 'Não deu para montar o plano agora.',
      final: 'Pronto para ver tudo junto: alertas, o que fazer depois e o relatório para imprimir.',
      goPlanning: 'Ver meu planejamento',
    },
    scores: {
      title: 'Notas do plano',
      sub: 'Seu plano comparado com o que você fez nas últimas 3 safras. Toque numa nota para ver a conta.',
      label: 'Notas do seu plano ao lado de como é hoje',
      yours: 'Seu plano',
      today: 'Como é hoje',
      seguranca: 'Segurança',
      solo: 'Saúde da terra',
      futuro: 'Clima 2041–2060',
      value: (value: string) => `${value} de 100`,
      none: 'sem lavoura',
      notFilled: 'não preenchido',
      missing: 'Você não preencheu as últimas safras, então "como é hoje" fica sem nota.',
      noSoy: (seasons: string) => `Sem soja em ${seasons}: não dá para comparar`,
      rules: {
        seguranca:
          'Segurança: a média da nota de segurança do motor (quantos dos 20 anos deram certo) nos anos com lavoura. O ano parado não entra.',
        solo: 'Saúde da terra: a média da nota de solo dos 3 anos (palhada, nitrogênio, nematoide), mais os pontos por variar a função das culturas.',
        futuro: 'Clima 2041–2060: a mesma conta da segurança, com o clima projetado (NEX-GDDP-CMIP6, média dos modelos).',
      },
      yearLine: (season: string, crop: string, worked: string) => `${season}: ${crop}, ${worked}`,
      yearFallow: (season: string) => `${season}: deixar parado`,
      bonus: (points: string) => `Variar a função das culturas somou ${points} pontos à saúde da terra.`,
      source: 'Conta do motor do Raiz Orbital, com chuva do GPM IMERG e clima do NASA POWER e do NEX-GDDP-CMIP6.',
    },
    rain: {
      title: 'Chuva aproveitada',
      text: (mm: string, end: string) =>
        `Com a terra parada, ${mm} mm de chuva caem até ${end} sem virar grão nem palha. Com o plano, a lavoura usa:`,
      label: 'Chuva que a lavoura usa em cada ano',
      fallow: 'Terra parada',
      fallowValue: (mm: string) => `${mm} mm sem uso`,
      row: (season: string, crop: string) => `${season} · ${crop}`,
      mm: (mm: string) => `${mm} mm`,
      learnMore: 'Saiba mais: a conta de água da lavoura',
      source: (source: string, years: number) =>
        `Chuva do ${source} da semeadura ao fim de julho, mediana de ${years} anos. "Usa" = a água que a planta tirou da terra no ciclo (conta do motor).`,
    },
    dry: {
      title: 'E se o ano vier seco?',
      check: 'Em fevereiro, confira de novo o sinal e a umidade da terra (SMAP) antes de plantar.',
      planA: 'Plano A',
      planB: 'Plano B',
      ifNormal: 'se a chuva vier normal',
      ifDry: 'se em fevereiro o sinal for de ano seco e a terra estiver seca',
      aWorked: (good: number, total: number) => `Deu certo em ${good} de ${total} anos.`,
      bWhy: (fails: number, crop: string, good: number) => `Nos ${fails} anos em que ${crop} falhou, ela deu certo em ${good}.`,
      notNeededFallow: 'Não precisa: com a terra parada, não há lavoura para perder na seca.',
      notNeeded: (crop: string, total: number) => `Não precisa: ${crop} já é a que mais aguenta seca (deu certo nos ${total} anos).`,
      none: (crop: string) => `Nenhuma outra cultura deu mais certo nos anos em que ${crop} falhou: siga com ${crop}.`,
      source: (source: string, date: string) =>
        `Previsão de El Niño / La Niña: ${source}, publicada em ${date}. Anos de El Niño: índice ONI (NOAA). Umidade da terra: SMAP (NASA).`,
      learnMore: 'Saiba mais: veranico',
    },
  },
  telegram: {
    title: 'Receber no Telegram',
    text: 'A resposta em áudio no seu celular e um aviso se faltar chuva na sua lavoura.',
    past: 'Quer receber avisos assim na próxima safra? Ative no Telegram.',
    open: 'Abrir no Telegram',
    methodTitle: 'Também no Telegram',
    method:
      'Mande a localização da lavoura e diga quando colhe a soja. O bot responde em texto e em áudio, com o link desta página. Quem quiser recebe avisos de falta de chuva e calor. Em português e em inglês.',
  },
  community: {
    /** "Ouvir resumo" (regra geral 9 do pacote 2): 3 frases montadas com os números da tela. */
    summaryIntro: (km: number) => `Aqui você vê o que os vizinhos contam, até ${km} km da sua lavoura, e conta o que aconteceu aí.`,
    summaryPlanting: (count: number, season: string) =>
      `${count} ${count === 1 ? 'vizinho contou o que fez' : 'vizinhos contaram o que fizeram'} depois da soja ${season}.`,
    summaryRain: (count: number, mm: string) =>
      `Nos últimos 7 dias, ${count === 1 ? '1 relato de chuva' : `${count} relatos de chuva`}, com ${mm} mm em média.`,
    summaryRegion: (season: string, pct: string) =>
      `Pelo satélite, na safra ${season}, ${pct}% da área de soja da região ficou parada depois da colheita.`,
    summaryEmpty: 'Ainda não há relatos perto de você.',
    summaryNote: 'Todo relato é de vizinho e não é confirmado.',
    title: 'Na sua região',
    regionSubtitle: (km: number) => `Até ${km} km da sua lavoura · visto pelo satélite`,
    regionSubtitleAway: (km: number, distance: number) =>
      `Raio de ${km} km em volta de um ponto a ${String(distance).replace('.', ',')} km da sua lavoura · visto pelo satélite`,
    /** Porcentagem com vírgula ('0,8%'), no jeito do português. */
    regionPct: (pct: number) => `${String(pct).replace('.', ',')}%`,
    regionBig: (season: string, pct: number) =>
      `Na safra ${season}, ${String(pct).replace('.', ',')}% da área de soja ficou parada depois da colheita.`,
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
    plantingLine: (count: number, season: string, list: string) =>
      `${count} ${count === 1 ? 'vizinho contou o que fez' : 'vizinhos contaram o que fizeram'} depois da soja ${season}: ${list}.`,
    wentWell: (count: number, total: number) =>
      count === 1 ? `1 de ${total} disse que foi bem.` : `${count} de ${total} disseram que foi bem.`,
    rainLine: (average: number, count: number) =>
      `Nos últimos 7 dias, os pluviômetros marcaram em média ${String(average).replace('.', ',')} mm (${count} ${count === 1 ? 'relato' : 'relatos'}).`,
    eventsTitle: 'O que aconteceu nos últimos 30 dias',
    eventLine: (event: string, date: string) => `${event}, em ${date}`,
    mineTitle: 'Seus relatos',
    mineHint: 'Só este aparelho pode apagar.',
    myPlanting: (crop: string, season: string) => `${crop}, safra ${season}`,
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
    shareYear: (season: string) => `Safra ${season}`,
    shareIdle: 'Deixei parado',
    shareSent: 'Compartilhado. Obrigado!',
    shareSeeCommunity: 'Ver o que os vizinhos contam',
  },
  method: {
    /** "Ouvir resumo" (regra geral 9 do pacote 2): os anos de chuva e os pesos da nota (do regras.yaml). */
    summaryRain: (years: number | null) =>
      years
        ? `A conta usa ${years} anos de chuva e calor do satélite, o solo e o verde da lavoura, em 3 passos.`
        : 'A conta usa a chuva e o calor do satélite, o solo e o verde da lavoura, em 3 passos.',
    summaryWeights: (safety: string, future: string, soil: string, income: string) =>
      `A nota de cada cultura vai de 0 a 100: segurança vale ${safety}%, clima futuro ${future}%, terra ${soil}% e renda ${income}%.`,
    summaryEnd: 'Nenhum número vem de inteligência artificial: são regras fixas, com dados de satélite.',
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
    /** Tarefa 0051 (RF-35): a área do MVP, mesmo antes de as fontes chegarem. */
    sourcesArea:
      'Nesta primeira versão (MVP), os dados estão prontos para a região de Uberlândia e Uberaba (MG). Vamos ampliar para todo o Triângulo Mineiro.',
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
    exampleFarm: 'Lavoura de demonstração, perto de Uberlândia (MG).',
    disclaimer: 'Apoio à decisão: confirme com o seu agrônomo antes de comprar a semente.',
  },
  guide: {
    /** "Ouvir resumo" (regra geral 9 do pacote 2) da página inicial: o total de artigos, não o da busca. */
    summary: (count: number) =>
      `O Guia tem ${count} artigos curtos sobre culturas, plantio, terra, clima e segurança. Busque por uma palavra, como veranico ou palhada, ou escolha um tema.`,
    title: 'Guia',
    subtitle: 'Respostas curtas para as dúvidas da lavoura, com as fontes.',
    communityLink: 'Guia: dúvidas e respostas curtas',
    // Tela 8 do pacote 3 (tarefa 0063): busca, filtros por tema, "Comece por aqui" e cartões.
    searchLabel: 'Buscar no Guia',
    searchPlaceholder: 'Buscar: veranico, palhada…',
    clearSearch: 'Limpar busca',
    themesLabel: 'Temas',
    all: 'Todos',
    start: 'Comece por aqui',
    articles: (count: number) => (count === 1 ? '1 artigo' : `${count} artigos`),
    minutes: (count: number) => `${count} min de leitura`,
    /** "<b>3</b> resultados para "chuva"": o número vai em negrito na view. */
    resultsWord: (count: number) => (count === 1 ? 'resultado' : 'resultados'),
    resultsFor: (query: string) => `para "${query}"`,
    noResults: (query: string) => `Nenhum artigo encontrado para "${query}"`,
    noResultsHint: 'Tente outra palavra ou veja um destes:',
    suggestions: ['veranico', 'palhada', 'sorgo'],
    back: 'Voltar ao Guia',
    notFound: 'Não achamos esse artigo.',
    sentence: 'Em uma frase',
    sources: 'Fontes conferidas',
    toc: 'Neste artigo',
    seeAlso: 'Veja também',
    helpful: 'Este artigo ajudou?',
    helpfulYes: 'Sim',
    helpfulNo: 'Não',
    helpfulThanks: 'Obrigado!',
    /** "Na sua lavoura": a caixa azul com um número real do ponto marcado (`/api/raio-x`). */
    field: {
      place: (place: string) => `Sua lavoura, perto de ${place}`,
      /** O que o "Ouvir resumo" do artigo acrescenta ao "Em uma frase". */
      spoken: (place: string, text: string) => `Na sua lavoura, perto de ${place}: ${text}`,
      source: (source: string) => `Fonte: ${source}`,
      heavyRain: (total: number, days: number, limit: string, mean: string) =>
        `Em ${total} anos, houve ${days} dias com ${limit} mm ou mais de chuva em fevereiro e março: em média, ${mean} dia por ano.`,
      dryspell: (total: number, days: number, start: string, year: number) =>
        `O maior veranico de março a maio em ${total} anos foi de ${days} dias seguidos sem chuva, a partir de ${start} de ${year}.`,
      heatNone: (total: number, temp: string) => `Em ${total} anos, nenhum teve dia de ${temp} °C ou mais entre março e maio.`,
      heatOne: (total: number, year: string, temp: string) =>
        `Em ${total} anos, só 1 (${year}) teve dia de ${temp} °C ou mais entre março e maio.`,
      heatMany: (total: number, count: number, years: string, temp: string) =>
        `Em ${total} anos, ${count} (${years}) tiveram dia de ${temp} °C ou mais entre março e maio.`,
      future: (models: number, rain: string, heat: string) =>
        `Para 2041 a 2060, a média de ${models} modelos indica chuva de março a maio ${rain}% e máxima ${heat} °C.`,
      xraySoil: (clay: string, sand: string) => `A terra tem ${clay}% de argila e ${sand}% de areia.`,
      xrayMoisture: (pct: number) => `Agora está mais úmida que em ${pct}% dos anos nesta época.`,
      xrayRain: (mm: string) => `De janeiro a julho, chove em média ${mm} mm.`,
      and: 'e',
      years: (total: number) => `${total} anos`,
      sourceSoil: 'SoilGrids (ISRIC)',
      sourceSmap: 'SMAP (NASA)',
      sourcePower: 'NASA POWER',
      sourceFuture: 'NEX-GDDP-CMIP6 (NASA), cenário intermediário',
      rainSources: { gpm_imerg: 'GPM IMERG (NASA)', nasa_power: 'NASA POWER' } as Record<string, string>,
    },
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
    package2: 'Pacote 2: peças compartilhadas',
    package2Guide: 'Saiba mais: rotação de culturas',
    package2Large: 'Abrir o modal grande',
    package2LargeText: 'Quase a tela toda, com 24 px de borda em volta (8 px no celular). Para "ver detalhes" com gráficos.',
    sampleText: 'O satélite da NASA olha a chuva de muitos anos na sua lavoura.',
    plantPhotos: 'Fotos das plantas',
    photoFallback: 'Se a foto não carregar',
  },
  // Tela "Avisos" (seção 6 da remodelagem, tarefa 0046 do backend, RF-31)
  alerts: {
    /**
     * Tela "Avisos" (`/avisos`, tarefa 0046; refeita no pacote 3, tela 7, tarefa 0062). As frases de cada aviso são
     * montadas em `i18n/alertTexts.ts` com os `valores` de cada `tipo`.
     */
    title: 'Avisos',
    headerLabel: 'Avisos',
    headerCount: (count: number) => (count === 1 ? 'Avisos: 1 aviso ativo' : `Avisos: ${count} avisos ativos`),
    place: (place: string) => `Lavoura perto de ${place}`,
    demoPlace: (place: string) => `Lavoura de demonstração, perto de ${place}`,
    /** "{lugar} · atualizado em **{data}**" (negrito com `**…**`, lido pelo `parseInline`). */
    context: (place: string, date: string) => `${place} · atualizado em **${date}**`,
    readGuide: 'Como ler os avisos',
    needPoint:
      'Para ver os avisos, marque onde fica a sua lavoura. O ponto fica guardado só neste aparelho, sem cadastro.',
    markField: 'Marcar minha lavoura',
    /** "Ouvir resumo" (regra geral 9 do pacote 2), com os números da tela. */
    listen: {
      noPoint:
        'Aqui aparecem os avisos de terra seca, calor e chuva da sua lavoura. Marque onde ela fica para ver os avisos, sem cadastro. Em emergência, ligue 193 para os bombeiros ou 199 para a Defesa Civil.',
      waiting:
        'Aqui aparecem os avisos de terra seca, calor e chuva da sua lavoura. Para alertas oficiais, use o SMS 40199 com o seu CEP.',
      none: 'Nada fora do normal agora na sua lavoura. Os avisos aparecem aqui quando algo mudar.',
      some: (count: number, list: string) =>
        `Você tem ${count === 1 ? '1 aviso' : `${count} avisos`} agora. ${list ? `${list}. ` : ''}Para alertas oficiais, use o SMS 40199 com o seu CEP.`,
    },
    /** O cartão do resumo: verde sem aviso, azul só com "Fique de olho", laranja com algum "Atenção". */
    status: {
      noneTitle: 'Nada fora do normal agora',
      noneText: 'Os avisos aparecem aqui e no sino lá em cima quando algo mudar.',
      count: (count: number) => (count === 1 ? '1 aviso agora' : `${count} avisos agora`),
      attention: (count: number) => (count === 1 ? '1 pede atenção.' : `${count} pedem atenção.`),
      watch: 'Para ficar de olho, sem urgência.',
      legend: 'O que quer dizer cada nível',
      legendAttention: 'aja agora',
      legendWatch: 'acompanhe',
    },
    level: { atencao: 'Atenção', fique_de_olho: 'Fique de olho' },
    now: {
      title: 'Agora',
      recent: 'Leituras de satélite e previsão desta semana',
      until: (date: string) => `Leituras de satélite e previsão até ${date}`,
      details: 'Detalhes',
      todo: 'O que fazer:',
      emptyTitle: 'Nada fora do normal',
      emptyText: 'Calor, dias sem chuva e terra seca estão dentro do esperado.',
    },
    /** "Seu plano: **{cultura}**, plantio até {prazo do ZARC}." (o mesmo prazo da tela 5). */
    plan: {
      line: (crop: string, deadline: string | null) =>
        `Seu plano: **${crop}**${deadline ? `, plantio até ${deadline}` : ''}. Durante o ciclo, aparecem aqui os avisos de veranico e de calor na floração.`,
      late: (crop: string, deadline: string) =>
        `Seu plano: **${crop}**, mas já passou do prazo de plantio do ZARC (${deadline}). Durante o ciclo, aparecem aqui os avisos de veranico e de calor na floração.`,
      fallow: 'Seu plano: **deixar a terra parada** depois da soja.',
    },
    /** "Ver exemplo: avisos de 2024": o modal montado com o replay e os recordes daquele ano. */
    example: {
      link: (year: number) => `Ver exemplo: avisos de ${year}`,
      title: (year: number) => `Como teriam sido os avisos em ${year}`,
      subtitle: 'Um exemplo com o que aconteceu na sua área naquele outono.',
      loading: 'Montando o exemplo…',
      nothing: (year: number) => `Em ${year}, não houve nada fora do normal para avisar na sua área.`,
      source: (year: number) => `Fonte: GPM IMERG e NASA POWER (NASA). Exemplo montado com dados de ${year}.`,
      autumn: 'mar–mai',
      drySince: (date: string) => `O veranico tinha começado em ${date}.`,
      dryRecord: (days: number, since: number | null) =>
        `Começou um veranico de ${days} dias seguidos sem chuva, o maior de março a maio${since ? ` desde ${since}` : ''}.`,
      heatRecord: (days: number, temp: number, since: number | null) =>
        `${days} dias com ${temp} °C ou mais de março a maio, o ano com mais calor${since ? ` desde ${since}` : ''}. Na floração, calor forte derruba as flores.`,
      dryAutumnRecord: (mm: string, average: string, since: number | null) =>
        `Só ${mm} mm de chuva de março a maio (a média é ${average} mm): o outono mais seco${since ? ` desde ${since}` : ''}.`,
      rainEndRecord: (date: string, since: number | null) =>
        `A chuva do outono acabou em ${date}, o fim de chuva mais cedo${since ? ` desde ${since}` : ''}.`,
    },
    detail: { meaning: 'O que significa', todo: 'O que fazer' },
    /** "Como a sua área está mudando" (antes "O que mudou na sua área"). */
    changed: {
      title: 'Como a sua área está mudando',
      intro: (recentStart: number, recentEnd: number, beforeStart: number, beforeEnd: number) =>
        `${recentStart}–${recentEnd} comparado com ${beforeStart}–${beforeEnd}.`,
      fewYears: 'São poucos anos: mostra o que aconteceu, não uma previsão.',
      seeDetails: 'Ver detalhes',
      before: 'antes',
      after: 'depois',
      days: (value: string) => `${value} dias`,
      mm: (value: string) => `${value} mm`,
      workedValue: (good: number, total: number) => `${good} de ${total}`,
      drySpellLabel: 'Maior veranico (mar–mai)',
      rainEndLabel: 'Fim das chuvas',
      heatLabel: (temp: number) => `Dias de ${temp} °C ou mais (mar–mai)`,
      shortageLabel: (crop: string) => `Falta de água · ${crop}`,
      workedLabel: (crop: string) => `Deu certo · ${crop}`,
      drySpell: (recent: string, before: string, recentPeriod: string, beforePeriod: string, longer: boolean) =>
        `O maior período seguido sem chuva entre março e maio ficou mais ${longer ? 'longo' : 'curto'}: ${recent} dias em média em ${recentPeriod}, contra ${before} dias em ${beforePeriod}.`,
      rainEnd: (days: number, earlier: boolean, recentPeriod: string, beforePeriod: string) =>
        days === 0
          ? `A chuva do outono terminou, em média, no mesmo dia em ${recentPeriod} e em ${beforePeriod}.`
          : `A chuva do outono terminou, em média, ${days} ${days === 1 ? 'dia' : 'dias'} mais ${earlier ? 'cedo' : 'tarde'} em ${recentPeriod} do que em ${beforePeriod}.`,
      heat: (recent: string, before: string, temp: number, recentPeriod: string, beforePeriod: string) =>
        `Os dias com máxima de ${temp} °C ou mais entre março e maio passaram de ${before} por ano em ${beforePeriod} para ${recent} em ${recentPeriod}.`,
      shortage: (crop: string, recent: string, before: string, recentPeriod: string, beforePeriod: string) =>
        `Na média dos anos, faltaram ${recent} mm de água para ${crop} no ciclo em ${recentPeriod}, contra ${before} mm em ${beforePeriod}. Os anos muito secos puxam a média para cima.`,
      worked: (
        crop: string,
        recentGood: number,
        recentTotal: number,
        beforeGood: number,
        beforeTotal: number,
        recentPeriod: string,
        beforePeriod: string,
      ) =>
        `${crop} deu certo em ${recentGood} de ${recentTotal} anos em ${recentPeriod}; em ${beforeGood} de ${beforeTotal} anos em ${beforePeriod}.`,
      drySpellTodo: 'Prefira culturas que aguentam ficar sem chuva por algumas semanas e plante logo depois de colher.',
      rainEndTodo: 'Cada dia conta: quanto mais cedo plantar depois da soja, mais chuva a planta aproveita.',
      heatTodo: 'Na floração, calor forte derruba as flores. Leve isso em conta ao escolher o que plantar.',
      shortageTodo: 'Leve isso em conta ao escolher o que plantar: culturas que pedem menos água sofrem menos.',
      workedTodo: 'Leve isso em conta ao escolher o que plantar.',
      betterTodo: 'Mudou para melhor, mas são poucos anos: não conte com isso.',
    },
    /** "Já aconteceu aqui" (antes "Fora do comum"). */
    records: {
      title: 'Já aconteceu aqui',
      intro: (start: number, end: number) =>
        `O mais extremo de ${start} a ${end} na sua área. Pode voltar: planeje pensando num ano assim.`,
      introNoYears: 'O mais extremo da série na sua área. Pode voltar: planeje pensando num ano assim.',
      extreme: (start: number, end: number) => `Foi o mais extremo de ${start} a ${end} na sua área.`,
      drySpellLabel: 'Maior veranico',
      dryAutumnLabel: 'Outono mais seco',
      rainEndLabel: 'Chuva acabou mais cedo',
      heatLabel: 'Ano com mais calor',
      days: (value: string) => `${value} dias`,
      mm: (value: string) => `${value} mm`,
      drySpell: (date: string, year: number) => `seguidos sem chuva, a partir de ${date} de ${year}`,
      dryAutumn: (year: number, average: string) => `de março a maio de ${year} (a média é ${average} mm)`,
      rainEnd: (year: number) => `em ${year}`,
      heat: (temp: number, year: number) => `com ${temp} °C ou mais de março a maio de ${year}`,
      todo: 'Já aconteceu aqui e pode voltar. Prefira um plano que aguente um ano assim, como o Plano B do seu plano de 3 anos.',
    },
    readingOn: (date: string) => `leitura de ${date}`,
    dataUntil: (date: string) => `dados até ${date}`,
    oldReading: 'Leitura antiga',
    source: (names: string) => `Fonte: ${names}`,
    sources: {
      smap: 'NASA SMAP',
      nasa_power: 'NASA POWER',
      gpm_imerg: 'GPM IMERG (NASA)',
      noaa: 'NOAA CPC',
      comunidade: 'relato de vizinho',
    },
    period: (start: number, end: number) => `${start}–${end}`,
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
    /** Os cartões de "Agora": título curto, número, o que fazer (curto e no modal) e o que significa. */
    kinds: {
      dryTitle: 'A terra está mais seca que o normal',
      dryNumber: (pct: number) => `mais seca que em ${pct}% dos anos`,
      dryShort: 'Confira a umidade da terra antes de plantar ou adubar.',
      dryMeaning: (pct: number) =>
        `O satélite SMAP (NASA) estima a água na terra, na camada das raízes. Hoje a sua área está mais seca do que em ${pct}% dos anos nesta mesma época.`,
      dryTodo:
        'Confira a umidade da terra antes de plantar ou adubar. Com a terra seca, a semente pode não germinar e o adubo se perde.',
      dryGuide: 'Saiba mais: a conta de água da lavoura',
      noRainTitle: 'Dias seguidos sem chuva',
      noRainNumber: (days: number, atLeast: boolean) => `${atLeast ? 'pelo menos ' : ''}${days} dias sem chuva`,
      noRainShort: 'Converse com o agrônomo antes de plantar ou adubar.',
      noRainMeaning: (days: number, date: string, atLeast: boolean) =>
        `${atLeast ? 'Pelo menos' : 'Foram'} ${days} dias seguidos sem chuva (menos de 1 mm por dia) até ${date}.`,
      noRainTodo:
        'Converse com o agrônomo antes de plantar ou adubar. Com a terra seca, a semente pode não germinar e o adubo se perde.',
      noRainGuide: 'Saiba mais: veranico',
      heatTitle: (window: number) => `Calor forte nos últimos ${window} dias`,
      heatNumber: (days: number, temp: number) => `${days} dias com ${temp} °C ou mais`,
      heatShort: 'Se a lavoura estiver na floração, converse com o agrônomo.',
      heatMeaning: (days: number, temp: number, window: number) =>
        `Foram ${days} dias com máxima de ${temp} °C ou mais nos últimos ${window} dias. Na floração, calor forte derruba as flores e diminui a colheita.`,
      heatTodo: 'Se a lavoura estiver florindo, converse com o agrônomo. Evite aplicar produtos nas horas mais quentes.',
      heatGuide: 'Saiba mais: calor na floração',
      ensoTitle: {
        el_nino: (months: string, year: number) => `El Niño previsto para ${months} de ${year}`,
        la_nina: (months: string, year: number) => `La Niña prevista para ${months} de ${year}`,
      },
      ensoNumber: (chance: number) => `${chance}% de chance`,
      ensoShort: 'Confira o sinal em fevereiro, antes de plantar.',
      ensoForecast: (phase: string, months: string, year: number, chance: number) =>
        `A NOAA prevê ${phase} para ${months} de ${year}, com ${chance}% de chance.`,
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
      ensoGuide: 'Saiba mais: El Niño e La Niña',
      safrinhaDryTitle: (crop: string) => `Veranico na safrinha (${crop})`,
      safrinhaDryNumber: (days: number) => `${days} dias sem chuva`,
      safrinhaDryMeaning: (crop: string, days: number, date: string) =>
        `Foram ${days} dias sem chuva até ${date}, perto da fase em que a lavoura de ${crop} mais precisa de água.`,
      safrinhaHeatTitle: (crop: string) => `Calor na safrinha (${crop})`,
      safrinhaHeatNumber: (days: number, temp: number) => `${days} dias seguidos com ${temp} °C ou mais`,
      safrinhaHeatMeaning: (crop: string, days: number, temp: number, date: string) =>
        `Foram ${days} dias seguidos com ${temp} °C ou mais até ${date}, perto da fase em que a lavoura de ${crop} mais precisa de água.`,
      safrinhaShort: 'Converse com o agrônomo.',
      safrinhaTodo: 'Converse com o agrônomo.',
    },
    /** Guias dos quadros de mudança e de recordes ("Saiba mais", nova aba). */
    guides: {
      drySpell: 'Saiba mais: veranico',
      rainEnd: 'Saiba mais: quando a chuva acaba',
      water: 'Saiba mais: a conta de água da lavoura',
      worked: 'Saiba mais: o que significa "deu certo"',
      heat: 'Saiba mais: calor na floração',
    },
    /** "Alertas oficiais": sempre visível, primeiro na coluna da direita (âncora `#alertas-oficiais`). */
    official: {
      title: 'Alertas oficiais',
      notice: 'Estes avisos não substituem a Defesa Civil nem o INMET.',
      intro: 'Receba os alertas oficiais de graça:',
      smsCaption: 'SMS com o seu CEP',
      sms: 'Enviar para 40199',
      whatsappCaption: 'WhatsApp da Defesa Civil',
      whatsapp: 'Mandar "Oi"',
      fireCaption: 'Fogo',
      fire: 'Ligar 193',
      civilCaption: 'Defesa Civil',
      civil: 'Ligar 199',
      guide: 'Como receber os alertas oficiais',
    },
    /** A comunidade "em breve" no fim da página (o "Perto de você" saiu da tela). */
    soon: {
      tag: 'Em breve',
      title: 'Comunidade da sua região',
      text: 'Um espaço para acompanhar a sua região junto com os vizinhos.',
      items: [
        'O que os vizinhos plantaram depois da soja e como foi',
        'Quanto choveu em cada lavoura',
        'Granizo, fogo ou enxurrada perto de você',
      ],
    },
  },
}

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> }

export type Messages = Widen<typeof pt>
