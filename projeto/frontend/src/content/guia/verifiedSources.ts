/**
 * Páginas externas que o Guia pode citar em "Fontes". Só entra aqui página que alguém abriu e conferiu
 * (data e o que ela confirma). O teste do conteúdo barra qualquer link externo que não esteja nesta lista.
 */
export type VerifiedSource = { url: string; confirms: string; checkedOn: string }

const CHECKED = '2026-11-15'

export const VERIFIED_SOURCES: VerifiedSource[] = [
  {
    url: 'https://www.gov.br/mdr/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes-defesa-civil/alertas',
    confirms: 'Alertas por SMS: "Envie um SMS com seu CEP para o número 40199". WhatsApp: cadastro pelo telefone (61) 2034-4611, com uma mensagem de saudação ao chatbot.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.gov.br/mdr/pt-br/assuntos/protecao-e-defesa-civil/alertas-de-desastres-1',
    confirms: 'Página do Ministério da Integração sobre os alertas: SMS 40199 com o CEP, WhatsApp (61) 2034-4611 (link wa.me/556120344611), Telegram e o Defesa Civil Alerta (cell broadcast, dispensa cadastro).',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.gov.br/mcom/pt-br/noticias/noticias_alt/2026/julho/como-receber-alertas-da-defesa-civil-sobre-situacoes-de-emergencia-no-celular',
    confirms: 'Como receber alertas no celular: SMS com o CEP para 40199 (pode cadastrar mais de um CEP), WhatsApp (61) 2034-4611 e o cell broadcast, que dispensa cadastro em celulares compatíveis, redes 4G e 5G.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.gov.br/mcom/pt-br/noticias/2026/setembro/emergencia-voce-sabe-para-quem-ligar-quando-precisa-de-ajuda',
    confirms: '193 é o Corpo de Bombeiros (incêndios, acidentes, resgates) e 199 é a Defesa Civil (enchentes, deslizamentos e áreas de risco).',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/zoneamento-agricola',
    confirms: 'O ZARC é um instrumento de política agrícola e gestão de riscos; analisa clima, solo e ciclos das cultivares, e cada município identifica a melhor época de plantio. Resultado publicado em portarias do MAPA.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.embrapa.br/en/busca-de-noticias/-/noticia/1461750/milheto-e-cultura-alternativa-para-cobertura-de-solo',
    confirms: 'Milheto: baixa exigência de água, boa persistência em solo fraco e com déficit hídrico, muita biomassa para a palhada do plantio direto e útil na rotação de culturas.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.embrapa.br/en/busca-de-noticias/-/noticia/18856249/sorgo-e-recomendado-para-a-safrinha',
    confirms: 'O sorgo é mais tolerante ao estresse hídrico que outros cereais; a recomendação de plantio vem do zoneamento climático e considera o solo.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.embrapa.br/en/web/portal/busca-de-noticias/-/noticia/17942460/santa-fe-integra-agropecuaria-e-aumenta-a-sustentabilidade-do-agronegocio',
    confirms: 'Sistema Santa Fé: consórcio de grãos (milho, sorgo) com capim, principalmente braquiária; a palhada espessa evita erosão e controla mato, e ao se decompor devolve parte dos nutrientes.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.embrapa.br/en/tema-integracao-lavoura-pecuaria-floresta-ilpf/busca-de-noticias/-/noticia/31795514/braquiaria-muito-alem-da-alimentacao-animal',
    confirms: 'A braquiária entrou nos sistemas agrícolas por causa do plantio direto; o Santa Fé tinha dois propósitos: forragem para a entressafra e palhada para o plantio direto.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.embrapa.br/en/busca-de-noticias/-/noticia/2380275/crotalaria-e-uma-boa-alternativa-para-a-renovacao-de-canaviais',
    confirms: 'Crotalária: fixação biológica de nitrogênio (reduz a necessidade de adubo nitrogenado), controle de nematoides do solo e boa cobertura do solo.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.embrapa.br/en/busca-de-noticias/-/noticia/18156046/problemas-com-nematoides-na-cultura-do-milho-se-agravam-no-centro-oeste',
    confirms: 'Nematoides: rotação com espécie não hospedeira, como a crotalária, é medida de controle; a rotação de culturas explica parte dos menores problemas no Sul.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.embrapa.br/en/busca-de-noticias/-/noticia/114595766/artigo---rotacao-de-culturas-e-plantas-de-cobertura--fundamentais-para-o-sistema-plantio-direto',
    confirms: 'Rotação de culturas e plantas de cobertura são pilares do plantio direto, ajudam no controle de pragas, doenças, mato e nematoides e protegem o solo do calor e ajudam a reter umidade; a escolha das plantas pede planejamento.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.embrapa.br/en/busca-de-noticias/-/noticia/43736399/soja-tolerante-a-veranicos-e-lancada-na-bahia',
    confirms: 'Veranicos são curtos períodos de estiagem na época de chuvas e prejudicam o desenvolvimento da soja.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.embrapa.br/en/busca-de-noticias/-/noticia/42464503/novo-metodo-e-capaz-de-prever-a-ocorrencia-de-geada-em-mato-grosso-do-sul',
    confirms: 'Em junho o milho safrinha está em fase sensível e a geada pode prejudicar o enchimento dos grãos; semear escalonado, conforme a colheita da soja, evita perda total.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://gpm.nasa.gov/data/imerg',
    confirms: 'O IMERG estima a chuva na maior parte da Terra, atualizada a cada meia hora; tem as versões Early, Late e Final (a Final é a de maior qualidade, indicada para pesquisa).',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.earthdata.nasa.gov/news/feature-articles/power-earth-science-data',
    confirms: 'O NASA POWER é um projeto da NASA com foco em agroclimatologia, entre outros; dados diários de clima desde 1981, com a chuva vinda do GEOS e do IMERG.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6',
    confirms: 'NEX-GDDP-CMIP6: projeções dos modelos climáticos do CMIP6 refinadas para 0,25 grau (cerca de 25 km), com passo diário. A página não traz o período nem o número de modelos.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/oni/v5/',
    confirms: 'O ONI é a média de 3 meses da anomalia da temperatura do mar na região Niño 3.4; limiar de +0,5 °C (El Niño) e -0,5 °C (La Niña), por pelo menos 5 estações seguidas.',
    checkedOn: CHECKED,
  },
  // Tarefa 0043 (raio-X da sua terra e fogo na palha), páginas abertas em 15/11/2026
  {
    url: 'https://www.isric.org/explore/soilgrids',
    confirms: 'SoilGrids é o mapa mundial de solos do ISRIC, feito com aprendizado de máquina e perfis de solo do WoSIS, com 250 m de resolução e seis profundidades; mapeia argila, silte, areia, pH, carbono e outras propriedades.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://nsidc.org/data/spl4smgp/versions/8',
    confirms: 'SMAP L4 (SPL4SMGP) versão 8: campos da superfície de 3 em 3 horas, em grade EASE-Grid 2.0 global de 9 km, com a umidade da zona das raízes (root zone soil moisture) entre os parâmetros.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi',
    confirms: 'NDVI = (infravermelho próximo − visível) ÷ (infravermelho próximo + visível), de −1 a +1; 0,1 ou menos é área sem vegetação (rocha, areia, neve) e perto de +1 (0,8 a 0,9) é a maior densidade de folhas verdes.',
    checkedOn: CHECKED,
  },
  {
    url: 'https://www.earthdata.nasa.gov/data/catalog/lpcloud-mcd64a1-061',
    confirms: 'MCD64A1 versão 6.1: área queimada mensal, global, a 500 m, dos sensores MODIS dos satélites Terra e Aqua; a camada Burn Date dá o dia do ano da queimada, com valores especiais para não queimado, sem dado e água.',
    checkedOn: CHECKED,
  },
]
