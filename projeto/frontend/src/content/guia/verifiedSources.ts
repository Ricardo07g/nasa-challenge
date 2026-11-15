/**
 * Fontes que o Guia pode citar em "Fontes". Só entra publicação que alguém abriu e conferiu (data e o que
 * ela confirma). O teste do conteúdo barra qualquer link externo que não esteja nesta lista.
 *
 * Tipos aceitos: artigo científico revisado por pares (`article`), livro técnico ou capítulo de livro
 * (`book`) e fonte oficial do governo (`official`: lei, portaria, Defesa Civil, NOAA). Notícia e página de
 * divulgação não entram: a regra de 15/11/2026 é usar só fonte acadêmica ou oficial.
 */
export type SourceKind = 'article' | 'book' | 'official'

export type VerifiedSource = {
  url: string
  kind: SourceKind
  /** Referência curta: autores, ano, revista ou livro. */
  citation: string
  confirms: string
  checkedOn: string
}

const CHECKED = '2026-11-15'

export const VERIFIED_SOURCES: VerifiedSource[] = [
  // Fontes oficiais (governo): telefones, cadastro de alertas, lei de sementes, ZARC e índice ONI.
  {
    url: 'https://www.gov.br/mdr/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes-defesa-civil/alertas',
    kind: 'official',
    citation: 'Ministério da Integração e do Desenvolvimento Regional: perguntas frequentes sobre alertas',
    confirms: 'Alertas por SMS: "Envie um SMS com seu CEP para o número 40199". WhatsApp: cadastro pelo telefone (61) 2034-4611, com uma mensagem de saudação ao chatbot.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.gov.br/mdr/pt-br/assuntos/protecao-e-defesa-civil/alertas-de-desastres-1',
    kind: 'official',
    citation: 'Ministério da Integração e do Desenvolvimento Regional: alertas de desastres',
    confirms: 'Página do Ministério da Integração sobre os alertas: SMS 40199 com o CEP, WhatsApp (61) 2034-4611 (link wa.me/556120344611), Telegram e o Defesa Civil Alerta (cell broadcast, dispensa cadastro).',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.gov.br/mcom/pt-br/noticias/noticias_alt/2026/julho/como-receber-alertas-da-defesa-civil-sobre-situacoes-de-emergencia-no-celular',
    kind: 'official',
    citation: 'Ministério das Comunicações: como receber alertas da Defesa Civil no celular',
    confirms: 'Como receber alertas no celular: SMS com o CEP para 40199 (pode cadastrar mais de um CEP), WhatsApp (61) 2034-4611 e o cell broadcast, que dispensa cadastro em celulares compatíveis, redes 4G e 5G.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.gov.br/mcom/pt-br/noticias/2026/setembro/emergencia-voce-sabe-para-quem-ligar-quando-precisa-de-ajuda',
    kind: 'official',
    citation: 'Ministério das Comunicações: para quem ligar em emergência',
    confirms: '193 é o Corpo de Bombeiros (incêndios, acidentes, resgates) e 199 é a Defesa Civil (enchentes, deslizamentos e áreas de risco).',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/zoneamento-agricola',
    kind: 'official',
    citation: 'Ministério da Agricultura e Pecuária: Zoneamento Agrícola de Risco Climático',
    confirms: 'O ZARC é um instrumento de política agrícola e gestão de riscos; analisa clima, solo e ciclos das cultivares, e cada município identifica a melhor época de plantio. Resultado publicado em portarias do MAPA.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://planalto.gov.br/ccivil_03/leis/2003/l10.711.htm',
    kind: 'official',
    citation: 'Lei nº 10.711, de 5 de agosto de 2003 (Sistema Nacional de Sementes e Mudas)',
    confirms: 'Inscrição no Renasem para quem produz e comercializa sementes (art. 8º); identificação obrigatória na embalagem, carimbo, rótulo ou etiqueta (art. 21); definição do processo de certificação e das sementes certificadas (art. 2º); documentos que acompanham a semente no transporte e na venda (art. 31).',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/oni/v5/',
    kind: 'official',
    citation: 'NOAA Climate Prediction Center: Oceanic Niño Index (ONI), definição oficial',
    confirms: 'O ONI é a média de 3 meses da anomalia da temperatura do mar na região Niño 3.4; limiar de +0,5 °C (El Niño) e -0,5 °C (La Niña), por pelo menos 5 estações seguidas.',
    checkedOn: CHECKED,
  },

  // Culturas e manejo: artigos revisados por pares e livros técnicos.
  {
    url: 'https://www.alice.cnptia.embrapa.br/handle/doc/882280',
    kind: 'article',
    citation: 'Pacheco, L. P. et al. Produção de fitomassa e acúmulo e liberação de nutrientes por plantas de cobertura na safrinha. Pesquisa Agropecuária Brasileira, v. 46, n. 1, p. 17-25, 2011.',
    confirms: 'Em Santo Antônio de Goiás e Rio Verde (GO), no Cerrado, o milheto (Pennisetum glaucum) teve a maior fitomassa seca no início da entressafra; as braquiárias (Urochloa brizantha, U. ruziziensis) acumularam fitomassa e nutrientes de forma significativa no fim da entressafra; comparação incluiu o pousio com vegetação espontânea.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://apct.sede.embrapa.br/pab/article/download/7551/4470/23900',
    kind: 'article',
    citation: 'Borghi, E.; Crusciol, C. A. C. Produtividade de milho, espaçamento e modalidade de consorciação com Brachiaria brizantha em sistema plantio direto. Pesquisa Agropecuária Brasileira, v. 42, n. 2, p. 163-171, 2007.',
    confirms: 'No consórcio de milho com Brachiaria brizantha em plantio direto, a forrageira fornece alimento para o gado do fim do verão ao início da primavera e, depois, forma a palhada para a cultura de grãos no plantio direto.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/982617/1/Cap2.pdf',
    kind: 'book',
    citation: 'Ceccon, G.; Borghi, E.; Crusciol, C. A. C. Modalidades e métodos de implantação do consórcio milho-braquiária. In: Consórcio Milho-Braquiária. Embrapa, cap. 2.',
    confirms: 'O consórcio de milho com Brachiaria foi denominado Sistema Santa Fé (Kluthcouski et al., 2000), por ter sido avaliado na Fazenda Santa Fé (GO); recomenda-se a implantação simultânea de milho e braquiária; o consórcio de milho safrinha com braquiária foi incluído no ZARC.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.1093/jxb/erad390',
    kind: 'article',
    citation: 'Hostetler, A. N.; Tinoco, S. M. S.; Sparks, E. E. Root responses to abiotic stress: a comparative look at root system architecture in maize and sorghum. Journal of Experimental Botany, v. 75, n. 2, p. 553-562, 2024.',
    confirms: 'Revisão (Universidade de Delaware e Embrapa Milho e Sorgo): "sorghum has greater tolerance to abiotic stress than maize"; sob déficit hídrico, sistemas radiculares mais profundos são vantajosos porque alcançam a água do subsolo.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/203830/1/CAv30n5costa.pdf',
    kind: 'article',
    citation: 'Costa, K. A. P. et al. Adubação fosfatada e potássica no crescimento e nutrição da Crotalaria juncea L. Ciência e Agrotecnologia, v. 30, n. 5, p. 827-831, 2006.',
    confirms: 'A crotalária é uma leguminosa muito usada em rotação e no enriquecimento do solo por apresentar grande potencial de fixação biológica de N; o aproveitamento da fixação biológica pelas leguminosas é considerado uma das opções mais viáveis para reduzir o custo de produção e o risco de poluição ambiental.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.1590/1983-21252019v32n201rc',
    kind: 'article',
    citation: 'Santana-Gomes, S. M. et al. Reproduction of Pratylenchus zeae and P. brachyurus in cover crops. Revista Caatinga, v. 32, n. 2, p. 295-301, 2019.',
    confirms: 'Crotalaria juncea, C. spectabilis e guandu IPR 43 tiveram fator de reprodução baixo para P. zeae e P. brachyurus e são opções de plantas antagonistas para rotação ou sucessão visando controlar esses nematoides das lesões radiculares. O artigo lembra estudos anteriores que viram multiplicação de P. brachyurus em C. juncea.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://scielo.br/j/sp/i/2011.v37n3/',
    kind: 'article',
    citation: 'Reis, E. M.; Casa, R. T.; Bianchin, V. Controle de doenças de plantas pela rotação de culturas. Summa Phytopathologica, v. 37, n. 3, p. 85-91, 2011.',
    confirms: 'Revisão: a rotação elimina os restos culturais do hospedeiro como fonte de alimento dos fitopatógenos, que ficam sujeitos a competição microbiana e inanição; a rotação também pode aumentar a supressividade do solo (microrganismos antagonistas). É menos eficaz contra patógenos com muitos hospedeiros ou esporos levados pelo vento.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.redalyc.org/pdf/2530/253028469004.pdf',
    kind: 'article',
    citation: 'Oliveira, P. et al. Crescimento e produtividade de milho em função da cultura antecessora. Pesquisa Agropecuária Tropical, v. 43, n. 3, p. 239-246, 2013.',
    confirms: 'O sistema plantio direto preconiza o mínimo revolvimento do solo, a presença de palhada na superfície e a rotação de culturas; ele reduz a densidade populacional de plantas daninhas e possibilita maior conservação da umidade do solo.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/927317/1/Milhosafrinha.pdf',
    kind: 'book',
    citation: 'Cruz, J. C. et al. (ed.). Milho: o produtor pergunta, a Embrapa responde. Brasília: Embrapa Informação Tecnológica; Embrapa Milho e Sorgo, 2011. Capítulo Milho safrinha, p. 308-324.',
    confirms: 'Risco de geada cresce em direção ao Sul a partir do fim de maio; o dano depende da fase, da intensidade e da duração do frio; a geada quase não afeta a planta até cerca de cinco folhas ou perto da maturação, mas pode reduzir muito a produção perto da floração ou no início do enchimento de grãos; semear tarde aumenta o risco de perdas; em áreas altas do Paraná o risco de geada impede a safrinha.',
    checkedOn: CHECKED,
  },

  // Solo, água e erosão.
  {
    url: 'https://www.redalyc.org/pdf/1802/180221126032.pdf',
    kind: 'article',
    citation: 'Panachuki, E. et al. Perdas de solo e de água e infiltração de água em Latossolo Vermelho sob sistemas de manejo. Revista Brasileira de Ciência do Solo, v. 35, n. 5, p. 1777-1785, 2011.',
    confirms: 'A cobertura por resíduos culturais é o fator mais importante na dissipação da energia de impacto das gotas de chuva, evitando a desagregação das partículas do solo; sistemas que mexem pouco no solo e mantêm os resíduos na superfície controlam melhor as perdas de solo e água por erosão.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.1002/hyp.14286',
    kind: 'article',
    citation: 'Londero, A. L. et al. Quantifying the impact of no-till on sediment yield in southern Brazil at the hillslope and catchment scales. Hydrological Processes, v. 35, e14286, 2021.',
    confirms: 'O plantio direto isolado não basta para controlar a erosão causada por escoamento excessivo; os terraços reduziram a produção de sedimentos em 58,7%, principalmente pelo controle da enxurrada; o estudo recomenda combinar terraços com muita fitomassa sobre o solo.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.36783/18069657rbcs20210046',
    kind: 'article',
    citation: 'Freitas, L. R. et al. Terracing increases soil available water to plants in no-tillage. Revista Brasileira de Ciência do Solo, v. 45, e0210046, 2021.',
    confirms: 'Pilares do plantio direto: mínimo revolvimento do solo, resíduos na superfície e rotação de culturas; o terraceamento no plantio direto transformou o excesso de chuva em aumento perceptível da água disponível às plantas nos períodos seguintes de falta de chuva.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.alice.cnptia.embrapa.br/handle/doc/485595',
    kind: 'article',
    citation: 'Sans, L. M. A. et al. Zoneamento de riscos climáticos para a cultura de milho na região Centro-Oeste do Brasil e para o estado de Minas Gerais. Revista Brasileira de Agrometeorologia, v. 9, n. 3, p. 527-535, 2001.',
    confirms: 'No milho, a água é fator limitante principalmente na germinação, na floração e no enchimento de grãos; o zoneamento usou o balanço hídrico (ETr/ETm) e a capacidade de armazenamento de água de cada tipo de solo (classificados pelo teor de argila); atrasar a semeadura aumentou o risco de estresse hídrico no enchimento de grãos, mais ainda nos solos que guardam menos água.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.1590/S1678-3921.pab1993.v28.3962',
    kind: 'article',
    citation: 'Assad, E. D. et al. Veranicos na região dos cerrados brasileiros: frequência e probabilidade de ocorrência. Pesquisa Agropecuária Brasileira, v. 28, n. 9, p. 993-1003, 1993.',
    confirms: 'Dados diários de 100 estações pluviométricas do Cerrado, com séries de 20 anos ou mais, identificaram veranicos de 10, 15 e 20 dias; o estudo mapeia períodos de risco para a agricultura de sequeiro, tratando o veranico como limitação climática crítica no Cerrado.',
    checkedOn: CHECKED,
  },

  // Dados de satélite e clima usados pelo app: os artigos e livros que descrevem cada produto.
  {
    url: 'https://ntrs.nasa.gov/api/citations/20205003356/downloads/2.2.1_Springer_Book_Precip_IMERG_rev2.pdf',
    kind: 'book',
    citation: 'Huffman, G. J. et al. Integrated Multi-satellitE Retrievals for the Global Precipitation Measurement (GPM) mission (IMERG). In: Levizzani, V. et al. (ed.). Satellite Precipitation Measurement. Springer, 2020. cap. 19.',
    confirms: 'O IMERG é o produto de chuva da equipe científica do GPM; usa estimativas intercalibradas da constelação internacional de satélites de precipitação, combinadas com outros dados.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.1002/joc.5282',
    kind: 'article',
    citation: 'Monteiro, L. A.; Sentelhas, P. C.; Pedra, G. U. Assessment of NASA/POWER satellite-based weather system for Brazilian conditions and its impact on sugarcane yield simulation. International Journal of Climatology, v. 38, p. 1571-1581, 2018.',
    confirms: 'Comparando o NASA POWER com as estações do INMET (1997 a 2016), o desempenho foi satisfatório para temperatura média, mínima e máxima; o NASA POWER pode ser usado como fonte de dados de clima para a agricultura com confiança razoável em escala regional e nacional.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.1038/s41597-022-01393-4',
    kind: 'article',
    citation: 'Thrasher, B. et al. NASA Global Daily Downscaled Projections, CMIP6. Scientific Data, v. 9, 262, 2022.',
    confirms: 'NEX-GDDP-CMIP6: projeções diárias de 35 modelos do CMIP6, com correção de viés (BCSD) e grade de 1/4 de grau (0,25°, cerca de 25 km).',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.5194/soil-7-217-2021',
    kind: 'article',
    citation: 'Poggio, L. et al. SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty. SOIL, v. 7, p. 217-240, 2021.',
    confirms: 'SoilGrids mapeia propriedades do solo no mundo todo em células de 250 m, com aprendizado de máquina; avalia frações de textura (argila, silte, areia) e outras propriedades em seis profundidades padrão (até 200 cm).',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.1029/2019MS001729',
    kind: 'article',
    citation: 'Reichle, R. H. et al. Version 4 of the SMAP Level-4 Soil Moisture Algorithm and Data Product. Journal of Advances in Modeling Earth Systems, v. 11, n. 10, p. 3106-3130, 2019.',
    confirms: 'O SMAP L4_SM fornece estimativas globais de umidade do solo na superfície (0-5 cm) e na zona das raízes (0-100 cm), a cada 3 horas e em resolução de 9 km.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.1016/0034-4257(79)90013-0',
    kind: 'article',
    citation: 'Tucker, C. J. Red and photographic infrared linear combinations for monitoring vegetation. Remote Sensing of Environment, v. 8, n. 2, p. 127-150, 1979.',
    confirms: 'O índice de vegetação (diferença entre infravermelho e vermelho dividida pela soma) é sensível principalmente à área foliar verde ou à biomassa de folhas verdes, e serve para monitorar a biomassa fotossinteticamente ativa.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://doi.org/10.1016/j.rse.2018.08.005',
    kind: 'article',
    citation: 'Giglio, L. et al. The Collection 6 MODIS burned area mapping algorithm and product. Remote Sensing of Environment, v. 217, p. 72-85, 2018.',
    confirms: 'MCD64A1 Coleção 6: área queimada global a 500 m, dos sensores MODIS dos satélites Terra e Aqua, com data da queimada; detecta muito mais queimadas pequenas que a versão 5.1.',
    checkedOn: CHECKED,
  },
]
