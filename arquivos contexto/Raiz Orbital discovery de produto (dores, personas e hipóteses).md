# Raiz Orbital: discovery de produto (dores, personas e hipóteses)

Nov 14, 2026 · @Rayanne

## Resumo executivo

**Hipótese principal:** o produtor de grãos de sequeiro do Triângulo repete a sucessão soja/milho ou deixa o talhão em pousio depois da soja porque não enxerga, para a área dele, o risco climático e o ganho de solo das outras opções (sorgo, consorcio com braquiária, plantas de cobertura). Uma comparação com 20 anos de dados da NASA, o clima projetado e o efeito no solo, ajustada às prioridades dele e endossada pelo agrônomo, faz pelo menos 1 em cada 3 testar outra rotação em parte da área. Esse foco responde ao desafio Field Shift, que pede estratégias de rotação para a saúde do solo e a adaptação ao clima.

O momento é favorável e urgente ao mesmo tempo. A safra 2025/26 teve lavouras de sequeiro do Triângulo severamente afetadas por estiagem, e a 2026/27 começa sob El Niño forte, com projeção de 1,5 milhão de toneladas de soja a menos em Minas. O produtor está endividado e, em 2025, apenas 3,3% da área plantada do país tinha seguro rural, então o risco climático cai direto no caixa dele.

O canal está resolvido: 98% das propriedades têm internet ao menos no celular, e 96% dos produtores usam o WhatsApp para decisões de negócio. O que falta é confiança: só 6% confiam em IA para decidir, e a recomendação técnica é o principal motivo para mudar de prática. Por isso o produto deve chegar junto com o agrônomo, não contra ele.

Três personas guiam o MVP: o produtor médio de grãos (usuário principal), o agricultor familiar diversificado (camada comunitária) e a agrônoma de revenda ou cooperativa (canal e fonte de confiança). As personas e hipóteses são construídas a partir de dados secundários e precisam ser validadas em entrevistas.

**Documentos ligados a este discovery:** o [planejamento, business case e business plan](https://claude.ai/artifact/Ub4x3JemJK2pZ6NnbqLPbh), que traz os critérios científicos para identificar veranicos e outros eventos, e o [PRD – Raiz Orbital: o que plantar depois da soja?](https://claude.ai/artifact/ER9Gmh7FQDvPHkaXjcPeyd), com os critérios de avaliação do Space Apps, os dados da NASA, o motor de pontuação e o backlog.

## Quem é o público e o que faz

O Triângulo e o Alto Paranaíba têm 55.428 estabelecimentos agropecuários: 64% são de agricultura familiar, mas ocupam só 18% da área. Na prática são dois públicos: muitos pequenos, mais ligados à pecuária e ao leite, e um grupo menor de médios e grandes que planta a maior parte dos grãos, da cana e do café. Os detalhes por microrregião estão no doc [Raiz Orbital: perfil do produtor rural do Triângulo Mineiro](https://claude.ai/artifact/6j9yCD6nHtHpUAxLGgc76V).

### Quem são

| Indicador | Valor | Recorte | Fonte |
| --- | --- | --- | --- |
| Estabelecimentos agropecuários | 55.428 em 66 municípios e 7 microrregiões | Triângulo e Alto Paranaíba, 2017 | [UFU / Censo Agro](https://seer.ufu.br/index.php/Observatorium/article/download/70868/37022/322940) |
| Agricultura familiar | 64% dos estabelecimentos e 18% da área | Triângulo e Alto Paranaíba, 2017 | [UFU / Censo Agro](https://seer.ufu.br/index.php/Observatorium/article/download/70868/37022/322940) |
| Tamanho médio (cálculo próprio) | Cerca de 34 ha no familiar e 284 ha no não familiar | Triângulo e Alto Paranaíba, 2017 | [UFU / Censo Agro](https://seer.ufu.br/index.php/Observatorium/article/download/70868/37022/322940) |
| Idade | 76% dos produtores têm mais de 45 anos | Minas, 2017 | [Diário do Comércio](https://diariodocomercio.com.br/economia/especial-numero-de-estabelecimentos-rurais-avanca-no-estado/) |
| Sexo | 14,4% dos estabelecimentos dirigidos por mulheres | Minas, 2017 | [Diário do Comércio](https://diariodocomercio.com.br/?p=14274) |
| Escolaridade | 64,2% até o fundamental; 16,1% com ensino médio | Minas, 2017 | [Diário do Comércio](https://diariodocomercio.com.br/?p=152380) |
| Cor ou raça | 45,4% brancos, 44,5% pardos, 8,4% pretos; em fazendas de mais de 500 ha, 72,2% dos proprietários são brancos | Brasil, 2017 | [Agência Brasil](https://agenciabrasil.ebc.com.br/geral/noticia/2019-10/campo-esta-mais-feminino-e-mais-velho), [IBGE](https://agenciadenoticias.ibge.gov.br/pt/agencia-noticias/29724-atlas-do-espaco-rural-retrata-diversidade-e-desigualdade-do-campo-brasileiro.html?lang=pt-BR) |
| Internet na população rural | 84,8% usam internet; 82% só pelo celular | Brasil, 2024 | [Agência Gov](https://agenciagov.ebc.com.br/noticias/202507/acesso-a-internet-nas-areas-rurais-dispara-150-em-oito-anos-e-alcanca-84-8-da-populacao), [Mobile Time / TIC Domicílios](https://www.mobiletime.com.br/?p=807296) |

Não há dado publicado de renda ou classe social só do produtor do Triângulo; o recorte por município de idade, sexo e escolaridade pode ser extraído do Censo Agro no SIDRA.

### O que eles fazem

| Atividade | Peso na região | Fonte |
| --- | --- | --- |
| Soja no verão e milho safrinha em seguida | Sistema mais comum dos grãos; Minas deve colher 9,1 milhões de toneladas de soja e 7 milhões de milho em 2025/26 | [Agência Minas](https://agenciaminas.mg.gov.br/news/pdf/129946.pdf) |
| Milho | Uberaba lidera o milho em Minas, com 289 mil toneladas em 2024/25 | [Revista Cultivar](https://revistacultivar.com.br/noticias/uberaba-e-paracatu-lideram-producao-de-graos-em-mg) |
| Cana | O Triângulo produziu 67% da cana de Minas em 2020 | [Agência Minas](https://www.agenciaminas.mg.gov.br/news/pdf/113556.pdf) |
| Café | Região do Cerrado Mineiro: cerca de 4.500 produtores em 55 municípios | [Notícias Agrícolas](https://www.noticiasagricolas.com.br/noticia/425481) |
| Pecuária | A pastagem ocupa 67% da área da agricultura familiar da região | [UFU / Censo Agro](https://seer.ufu.br/index.php/Observatorium/article/download/70868/37022/322940) |

### Quando fazem

Chove de outubro a março, com cerca de 85% da chuva do ano, e os veranicos de 7 a 12 dias aparecem sobretudo em fevereiro e março ([UFU](https://oasisbr.ibict.br/vufind/Record/UFU_d39712b9c5446201d9da06f307e717c6)). A soja é plantada de outubro a dezembro, depois do vazio sanitário, e colhida de fevereiro a abril; o milho safrinha entra logo depois, a partir do fim de janeiro, com janela ideal em fevereiro ([Agência Minas](https://www.agenciaminas.mg.gov.br/news/pdf/125025.pdf), [Conab](https://antigo.conab.gov.br/agricultura-familiar/paanet/entregas/item/download/41254_cc29ff7045edd03921b8f8ca97caa1bc)). O café é colhido de maio a setembro, e a seca do meio do ano é a temporada de queimadas. O calendário desenhado está no doc de perfil.

## Contexto e mercado

Minas cresce em grãos, mas o risco climático e financeiro do produtor de sequeiro está no ponto mais alto da década. O perfil de quem são e quantos são está no doc [Raiz Orbital: perfil do produtor rural do Triângulo Mineiro](https://claude.ai/artifact/6j9yCD6nHtHpUAxLGgc76V).

| Tema | Dado mais recente | Fonte |
| --- | --- | --- |
| Produção de grãos em Minas, safra 2025/26 | 19 milhões de toneladas, alta de 3,5% | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/producao-graos-minas-gerais-safra-2025-26/) |
| Sequeiro no Triângulo, safra 2025/26 | Lavouras de sequeiro do Noroeste e do Triângulo severamente afetadas por estiagens, com baixa expectativa de produtividade; veranico em abril e maio | [Diário do Comércio / Conab](https://diariodocomercio.com.br/agronegocio/conab-projeta-alta-producao-graos-safra/) |
| Milho safrinha 2025/26 | Colheita mais lenta que no ano anterior e lavouras que perderam a janela ideal de plantio | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/producao-graos-minas-gerais-safra-2025-26/) |
| El Niño, safra 2026/27 | Projeção de 1,5 milhão de toneladas de soja a menos em Minas, com menos chuva e possíveis veranicos | [Diário do Comércio / Serasa Experian](https://diariodocomercio.com.br/agronegocio/el-nino-safra-soja-minas-gerais/) |
| Preocupação com o clima | 86% dos produtores acham que eventos extremos vão afetar sua produção (9ª Pesquisa ABMRA, 3.100 entrevistas em 16 estados, divulgada em dez/2025) | [Diário do Comércio / ABMRA](https://diariodocomercio.com.br/agronegocio/mudancas-climaticas-preocupam-86-produtores-rurais/) |
| Seguro rural | 3,2 milhões de hectares segurados em 2025, 3,3% da área plantada do país | [Brasil 61 / MAPA](https://brasil61.com/n/seguro-rural-parlamentares-de-mg-e-do-pr-cobram-fortalecimento-da-politica-para-dar-previsibilidade-ao-agro-cacb260201) |
| Seguro estadual | O programa mineiro Minas + Seguro está sem aportes nos últimos anos | [Band](https://www.band.com.br/agro/noticias/sao-paulo-lidera-em-recursos-investidos-em-seguro-rural-202509051521) |
| Inadimplência rural | 8,8% no 1º trimestre de 2026, alta de 1,2 ponto em um ano | [Compre Rural / Serasa](https://comprerural.com/antes-de-vender-a-fazenda-para-pagar-dividas-produtor-precisa-conhecer-seus-direitos/) |
| Recuperação judicial em Minas | 54 pedidos no 2º trimestre de 2026, 12,1% do país | [Canal Rural / Serasa](https://www.canalrural.com.br/diversos/pedidos-de-recuperacao-judicial-no-agro-caem-207-no-segundo-trimestre-aponta-serasa/) |
| Cigarrinha-do-milho | Perdas estimadas em cerca de 31 milhões de toneladas de milho por ano no Brasil; projeto de monitoramento lançado no Triângulo | [Canal Rural](https://www.canalrural.com.br/agricultura/milho/projeto-monitora-avanco-da-cigarrinha-do-milho-no-triangulo-mineiro/) |
| Queimadas | Cerca de 45 mil hectares de cana queimados no Triângulo em 2024 | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/prejuizos-incendios-cana-superam-180-milhoes-reais/) |

A leitura de produto: o veranico não é um evento raro, é recorrente, e o produtor tem cada vez menos colchão (seguro e crédito) para absorver o prejuízo. Isso aumenta o valor de decidir melhor antes da perda.

## O Super El Niño como caso de uso

O El Niño 2026/27 não é o produto, é o melhor exemplo do problema. Veranico, chuva irregular, calor e fogo acontecem todo ano no Triângulo; um El Niño forte só aumenta a chance e a intensidade de tudo isso ao mesmo tempo. O Raiz Orbital resolve o risco climático de qualquer safra, e o El Niño é o "teste de estresse" que mostra por que isso importa agora.

O timing é forte: hoje, 14 de novembro de 2026, a soja está sendo plantada sob o fenômeno, e o período crítico (enchimento da soja e plantio da safrinha) vai cair em fevereiro e março de 2027.

### O que se espera para a região

| Aspecto | O que dizem as fontes | Fonte |
| --- | --- | --- |
| Intensidade | A NOAA estima 63% de chance de El Niño muito forte entre novembro de 2026 e janeiro de 2027; o Inmet ainda não crava se será um "Super El Niño" | [Itaú BBA](https://www.itau.com.br/media/dam/m/5bde3c83e3780878/original/Radar-El-Nino_Junho26_ItauBBA.pdf), [Itatiaia](https://www.itatiaia.com.br/economia/negocios/eloos/alerta-de-el-nino-e-crise-de-custos-ameacam-proxima-safra-de-graos-e-cafe-em-mg/) |
| Chuva e calor em Minas | Nota técnica de Inpe, Inmet e Funceme prevê condições mais secas de setembro a dezembro e temperaturas mais altas de setembro a fevereiro | [O Fator / Nota Técnica Conjunta](https://ofator.com.br/?p=70362) |
| Sudeste | Calor, ondas de calor mais longas e chuvas irregulares, principalmente no começo da estação chuvosa | [Itatiaia / Painel El Niño](https://www.itatiaia.com.br/brasil/brasil-geral/el-nino-2026-2027-brasil-em-alerta-para-fenomeno-muito-forte/) |
| Soja no Cerrado | Chuva pode chegar cedo, mas sem se regularizar; se o plantio se espalha, a colheita atrasa e empurra a safrinha | [Canal Rural / Rural Clima](https://www.canalrural.com.br/agricultura/el-nino-forte-amplia-risco-para-soja-do-cerrado-e-safrinha-2026-27-diz-rural-clima/) |
| Calor no plantio | Mesmo com solo úmido, um veranico logo após o plantio com calor extremo pode "cozinhar" a semente | [Estado de Minas / Faemg](https://www.em.com.br/agropecuario/2026/06/7441533-alerta-para-os-efeitos-do-el-nino-na-agricultura-e-pecuaria-em-mg.html) |
| Milho safrinha | É a cultura mais sensível: plantio comprimido e estresse hídrico e térmico no enchimento de grãos; o El Niño pode cortar a chuva já no começo de abril de 2027 | [Itaú BBA](https://www.itau.com.br/media/dam/m/5bde3c83e3780878/original/Radar-El-Nino_Junho26_ItauBBA.pdf), [Nova Cana / Rural Clima](https://www.novacana.com/noticias/el-nino-forte-aumenta-risco-milho-safrinha-2026-27-rural-clima-220626) |
| Café | Risco alto para o arábica do Cerrado Mineiro: floração sob seca e abortamento de flores | [The AgriBiz](https://www.theagribiz.com/agronegocio/commodities-agricolas/o-impacto-do-super-el-nino-nas-commodities-o-que-dizem-a-historia-e-as-previsoes/) |
| Fogo | Atraso das chuvas, calor e seca prolongada favorecem queimadas; o governo de Minas lançou um plano estadual de enfrentamento a incêndios | [Agência Minas](https://www.agenciaminas.mg.gov.br/news/pdf/130454.pdf) |
| Soja em Minas | Projeção de 1,5 milhão de toneladas a menos na safra 2026/27 | [Diário do Comércio / Serasa](https://diariodocomercio.com.br/agronegocio/el-nino-safra-soja-minas-gerais/) |

**O que a história mostra.** No El Niño forte de 2023/24, a produtividade da soja caiu 16% em Mato Grosso e 8% no Brasil ([Itaú BBA](https://www.itau.com.br/media/dam/m/5bde3c83e3780878/original/Radar-El-Nino_Junho26_ItauBBA.pdf)), e em Minas o plantio e o replantio da soja se arrastaram até o fim de dezembro ([Conab](https://antigo.conab.gov.br/agricultura-familiar/paanet/entregas/item/download/53042_eb88936ad20d499a8ad92065474fb5ad)). Em novembro de 2023, o Triângulo estava entre as regiões mais afetadas por uma onda de calor com máximas previstas de 39 °C a 44 °C ([Agência Minas](https://www.agenciaminas.mg.gov.br/news/pdf/119863.pdf)). O efeito não é uniforme: naquela safra o Triângulo e o Alto Paranaíba se saíram melhor no milho do que outras regiões, o que reforça a necessidade de informação local, e não de alarme genérico.

### O medo do produtor (e da população)

- **Dúvida sobre quando plantar.** Uma sojicultora resumiu o dilema: talvez seja preciso atrasar o plantio da soja, e isso impacta diretamente o milho ([Canal Rural](https://www.canalrural.com.br/radar/el-nino-pior-do-que-o-previsto-sojicultora-comenta-precaucao-necessaria-na-safra-26-27-de-soja/)).
- **Cautela para gastar.** Com custo alto e risco climático maior, o produtor segura a compra de insumos e a entrada das máquinas ([Compre Rural](https://www.comprerural.com/trends/?p=2402)).
- **Perder o que já não tem como repor.** Endividamento alto e seguro raro fazem uma quebra virar risco de perder a fazenda (veja Contexto e mercado).
- **Insegurança constante.** 86% já acham que eventos extremos vão afetar sua produção ([ABMRA](https://diariodocomercio.com.br/agronegocio/mudancas-climaticas-preocupam-86-produtores-rurais/)).
- **Para quem vive no campo:** calor extremo, fogo perto de casa e falta de água.

O medo vem menos do El Niño em si e mais da incerteza: "vai acontecer aqui? quando? o que eu faço?". É exatamente essa pergunta que o app responde, com dado local e uma ação.

### Como se preparar (o que recomendam as fontes)

- Acompanhar as previsões meteorológicas para orientar as decisões no campo ([Governo de Minas](https://www.agenciaminas.mg.gov.br/news/pdf/130454.pdf)).
- Evitar antecipar a semeadura da soja no Centro-Oeste e no Sudeste ([Canal Rural](https://www.canalrural.com.br/agricultura/projeto-soja-brasil/el-nino-vai-comprometer-a-safra-de-soja-meteorologista-explica-os-riscos-para-o-proximo-ciclo/)).
- Escolher cultivares mais tolerantes ao estresse hídrico ([Notícias Agrícolas / MPrado](https://www.noticiasagricolas.com.br/artigos/artigos-geral/421658-el-nino-pode-desafiar-safra-brasileira-em-2026-27.amp.html)).
- Planejar desde já a sequência soja, safrinha ou sorgo, prevendo replantio (inferência do [Itaú BBA](https://www.itau.com.br/media/dam/m/5bde3c83e3780878/original/Radar-El-Nino_Junho26_ItauBBA.pdf)).
- Se preparar para o fogo na seca seguinte, com vizinhos e brigadas.

### Como o Raiz Orbital entra (sem depender do El Niño)

| Efeito do El Niño | Acontece também em anos normais? | O que o app faz |
| --- | --- | --- |
| Chuva irregular no começo da safra | Sim, todo ano o produtor espera a chuva firmar | Mostra a umidade do solo (SMAP) e a chance de chuva firme para decidir a data de plantio |
| Veranico com calor | Sim, sobretudo em fevereiro e março | Alerta de risco de veranico com antecedência e o que fazer |
| Janela da safrinha espremida | Sim, sempre que a soja atrasa | Planejamento: risco de cada data de plantio do milho e quando vale trocar por sorgo |
| Corte precoce da chuva em abril | Sim, em anos de estação curta | Tendência de umidade do solo para o fim do ciclo do milho |
| Ondas de calor | Sim, cada vez mais | Alerta de calor extremo nos dias críticos da lavoura |
| Fogo | Sim, toda seca | Foco de fogo do FIRMS e relatos dos vizinhos |

**Como usar no pitch:** abrir com o El Niño 2026/27 como a urgência do momento ("a soja está sendo plantada agora sob o fenômeno"), mostrar a demo com um veranico de uma safra passada, e fechar com a mensagem de que o app vale para qualquer safra, porque o veranico vem todo ano. A linha sugerida: **"O El Niño passa. O veranico volta todo ano. O Raiz Orbital fica."**

## Como o produtor decide e se informa hoje

O produtor está conectado e vive no WhatsApp, mas decide com base em gente em quem confia. Tecnologia que chega sozinha tende a ser ignorada; tecnologia que chega pela mão do agrônomo tende a ser usada.

| Comportamento | Dado | Fonte |
| --- | --- | --- |
| Internet na propriedade | 98% das propriedades, ao menos pelo celular (eram 39% há cerca de 12 anos) | [Canal Rural / 9ª ABMRA](https://www.canalrural.com.br/agricultura/quase-100-das-propriedades-rurais-conta-com-internet-mostra-pesquisa/) |
| WhatsApp | Principal ferramenta de consulta para decisões de negócio, usado por 96% | [O Presente Rural / 9ª ABMRA](https://opresenterural.com.br/internet-chega-a-98-das-propriedades-rurais-no-brasil-revela-estudo-da-abmra/) |
| Smartphone | 94% dos produtores (8ª ABMRA) | [Mundo Coop / ABMRA](https://mundocoop.com.br/agronegocio/diversificar-estrategias-de-comunicacao-e-via-principal-para-chegar-ao-produtor/) |
| Ferramentas digitais na lavoura | 55% dos agricultores brasileiros em 2024, contra 42% em 2022 | [BrasilAgro / McKinsey](https://brasilagro.com.br/conteudo/mais-da-metade-dos-agricultores-espera-aumento-dos-lucros-em-2-anos.html) |
| Pesquisa e comparação digital (2026) | 31% usam canais digitais para pesquisar produtos e 36% para comparar alternativas | [AgFeed / McKinsey](https://agfeed.com.br/economia/mais-seletivos-com-gastos-produtores-rurais-adotam-ia-com-rapidez-aponta-estudo-da-mckinsey) |
| Confiança em IA | Só 6% citam IA generativa ou busca com IA como fonte confiável para decidir | [AgFeed / McKinsey](https://agfeed.com.br/economia/mais-seletivos-com-gastos-produtores-rurais-adotam-ia-com-rapidez-aponta-estudo-da-mckinsey) |
| O que faz o produtor mudar de prática | 65% citam a recomendação técnica como principal motivação | [Diário do Comércio / 9ª ABMRA](https://diariodocomercio.com.br/agronegocio/mudancas-climaticas-preocupam-86-produtores-rurais/) |
| Barreiras para se adaptar ao clima | Entre os que veem barreiras altas, a maioria cita acesso limitado a suporte técnico, crédito ou confiança nos resultados | [Diário do Comércio / 9ª ABMRA](https://diariodocomercio.com.br/agronegocio/mudancas-climaticas-preocupam-86-produtores-rurais/) |
| Assistência técnica | Só 20,2% dos estabelecimentos do país receberam orientação técnica em 2017 | [Ipea](https://repositorio.ipea.gov.br/server/api/core/bitstreams/3122370b-8af7-4af7-867b-43ea9b422968/content) |
| Valor da assistência | Em Minas, agricultores familiares com assistência técnica tinham renda média de R$ 2.139 por mês, contra R$ 700 sem ela (dado do censo de 2006); a Emater-MG atende cerca de 400 mil produtores por ano | [Agência Minas](https://www.agenciaminas.mg.gov.br/news/pdf/105767.pdf) |
| Barreira de custo | 67,1% apontam o valor do investimento como dificuldade para a agricultura digital (Embrapa, Sebrae e Inpe, 2020) | [Canal Rural / Embrapa](https://www.canalrural.com.br/agronegocio/pesquisa-embrapa-tecnologias-digitais/) |

Três implicações para o produto. Primeiro, o alerta precisa nascer no WhatsApp ou chegar a ele, não depender de abrir um app. Segundo, "feito com IA" não vende; "dado de satélite da NASA, explicado pelo seu agrônomo" vende. Terceiro, o produto tem que ser gratuito ou quase para o produtor, porque custo é a primeira barreira.

## Mapa de dores

São dez dores com evidência. As quatro primeiras são o núcleo do MVP; as outras moldam o canal, o tom e o roadmap.

| # | Dor | Evidência | O que o Raiz Orbital faz | Fonte |
| --- | --- | --- | --- | --- |
| 1 | Veranico na fase crítica da lavoura | Sequeiro do Triângulo severamente afetado na safra 2025/26; veranicos de 7 a 12 dias são comuns em fevereiro e março; em Unaí, um produtor relatou o terceiro veranico da mesma safra | Alerta de risco de veranico com 7 a 14 dias de antecedência (MVP) | [Conab](https://diariodocomercio.com.br/agronegocio/conab-projeta-alta-producao-graos-safra/), [UFU](https://oasisbr.ibict.br/vufind/Record/UFU_d39712b9c5446201d9da06f307e717c6), [Notícias Agrícolas](https://www.noticiasagricolas.com.br/noticia/250424) |
| 2 | Janela do milho safrinha incerta | Quando a soja atrasa, a janela encurta; lavouras de 2025/26 perderam a janela ideal e parte dos produtores troca para sorgo | Planejamento: risco por data de plantio da safrinha (MVP) | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/producao-graos-minas-gerais-safra-2025-26/), [Conab](https://antigo.conab.gov.br/agricultura-familiar/paanet/entregas/item/download/41897_232e5c614fb2289821f6c046cf9d3a04) |
| 3 | Esperar a chuva para plantar a soja | Perto de Uberlândia, um produtor de 3 mil hectares atrasou o plantio em 15 dias por causa da seca | Planejamento: chance de chuva firme nas próximas semanas (MVP) | [Canal Rural](https://www.canalrural.com.br/agricultura/com-plantio-atrasado-produtor-repensa-a-safrinha-em-mg/) |
| 4 | Chuva em excesso e tempestade | Excesso de chuva já causou perda média de 40% na soja do Triângulo; chuva na colheita derruba café no chão | Alerta de chuva intensa (MVP) | [Canal Rural](https://www.canalrural.com.br/agricultura/excesso-chuva-provoca-perda-nas-lavouras-soja-triangulo-mineiro-16112/), [Canal Rural](https://www.canalrural.com.br/agricultura/colheita-de-cafe-arabica-atinge-99-na-area-da-expocacer/) |
| 5 | Fogo vindo de fora da propriedade | Cerca de 45 mil hectares de cana queimados no Triângulo em 2024; um produtor disse que só tinha a usina parceira a quem recorrer | Alerta de foco de fogo (FIRMS) e relatos dos vizinhos | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/prejuizos-incendios-cana-superam-180-milhoes-reais/), [Nova Cana](https://www.novacana.com/noticias/incendios-afetar-disponibilidade-insumos-cana-de-acucar-especialista-230924) |
| 6 | Pouca orientação técnica e desconfiança de ferramentas | Só 20,2% receberam orientação técnica; só 6% confiam em IA para decidir | Canal via agrônomo e fonte do dado sempre visível | [Ipea](https://repositorio.ipea.gov.br/server/api/core/bitstreams/3122370b-8af7-4af7-867b-43ea9b422968/content), [AgFeed / McKinsey](https://agfeed.com.br/economia/mais-seletivos-com-gastos-produtores-rurais-adotam-ia-com-rapidez-aponta-estudo-da-mckinsey) |
| 7 | Sem colchão financeiro para a perda | 3,3% da área com seguro em 2025; inadimplência rural de 8,8% | Reduzir a perda evitável; no futuro, histórico de risco para seguro e crédito | [Brasil 61 / MAPA](https://brasil61.com/n/seguro-rural-parlamentares-de-mg-e-do-pr-cobram-fortalecimento-da-politica-para-dar-previsibilidade-ao-agro-cacb260201), [Compre Rural / Serasa](https://comprerural.com/antes-de-vender-a-fazenda-para-pagar-dividas-produtor-precisa-conhecer-seus-direitos/) |
| 8 | Sinal fraco no campo | 66,9% da produção de soja fora da cobertura 4G e 5G; só 65,8% dos domicílios rurais têm rede móvel | App leve, alerta pelo WhatsApp, funciona offline | [Canal Rural](https://www.canalrural.com.br/agricultura/projeto-soja-brasil/conectividade-nao-acompanha-tecnologia-e-acesso-a-internet-nas-lavouras-de-soja-ainda-e-limitado/), [Teletime / PNAD](https://teletime.com.br/24/07/2025/internet-chega-a-93-dos-domicilios-mas-51-milhoes-de-lares-seguem-offline/) |
| 9 | Pragas que viajam com o clima | Cigarrinha-do-milho com ataques severos no Triângulo e perdas de 70% a 90% em certos híbridos | Fora do MVP; relatos de praga na comunidade são um próximo passo | [Agrolink](https://www.agrolink.com.br/noticias/perdas-de-milho--a-ameaca-da-cigarrinha_495661.html), [Canal Rural](https://www.canalrural.com.br/agricultura/milho/projeto-monitora-avanco-da-cigarrinha-do-milho-no-triangulo-mineiro/) |
| 10 | Estresse e alerta permanente | Psicóloga descreve o produtor como "estressado crônico"; perdas acumuladas afetam família e motivação | Tom calmo, sem alarmismo, e alerta só quando muda uma decisão | [Notícias Agrícolas](https://www.noticiasagricolas.com.br/noticia/404114) |

Uma dor que apareceu na ideia original, mas sem dado nesta pesquisa: estradas rurais intransitáveis na chuva. Ela vale como pergunta nas entrevistas antes de entrar no pitch.

## Relatos da imprensa regional

O site da Globo Rural bloqueia acesso automático, então não consegui ler as reportagens de lá; fica como tarefa para o time abrir no navegador (vale buscar também o MG Rural, da TV Integração, afiliada Globo em Uberlândia e Uberaba). Os relatos abaixo vêm do Canal Rural, de jornais locais repercutidos pelo Diário do Comércio e de revistas regionais. Muitos são de safras passadas, mas mostram que as mesmas dores se repetem.

| Relato | O que mostra | Fonte |
| --- | --- | --- |
| Um produtor perto de Uberlândia, com 3 mil hectares, começou o plantio 15 dias depois do previsto por causa da seca | O dilema de "quando plantar" é diário em outubro e novembro | [Canal Rural](https://www.canalrural.com.br/agricultura/com-plantio-atrasado-produtor-repensa-a-safrinha-em-mg/) |
| O mesmo produtor arriscou plantar 40 hectares sob pivô e deixou a área de sequeiro sem data para começar | Só quem irriga escapa; o sequeiro espera a chuva | [Canal Rural](https://www.canalrural.com.br/agricultura/atraso-plantio-soja-mg-safrinha/) |
| Em outra safra, ele contou que a média em Uberlândia é semear entre 10 e 15 de outubro; no ano anterior só começou em 25 de outubro | A janela varia semanas de um ano para outro | [Canal Rural](https://www.canalrural.com.br/agricultura/preco-baixo-desestimula-sojicultura-em-minas-gerais/) |
| Uberlândia teve chuva 20% acima da média num mês em que Uberaba, a menos de 100 km, ficou 30% abaixo | A chuva é local; a previsão regional não basta | [Canal Rural](https://www.canalrural.com.br/agricultura/preco-baixo-desestimula-sojicultura-em-minas-gerais/) |
| O presidente do Sindicato Rural de Uberaba descreveu as chuvas como esparsas, localizadas e sem consistência | Mesmo líderes do setor não têm visão clara da chuva | [Nova Cana / Canal Rural](https://www.novacana.com/noticias/falta-chuvas-minas-gerais-risco-sucessao-soja-cana-211119) |
| Um produtor de cana em Uberaba explicou que, se a soja atrasa, a reforma da cana também atrasa e o prejuízo dura alguns anos | O erro de calendário se propaga | [Nova Cana / Canal Rural](https://www.novacana.com/noticias/falta-chuvas-minas-gerais-risco-sucessao-soja-cana-211119) |
| Um produtor calculou perda de até 50% em 250 hectares; um agrônomo relatou lavouras do Triângulo com perdas de 10% a 80% | A perda vira problema de dívida | [Canal Rural](https://www.canalrural.com.br/agricultura/milho-soja-sao-culturas-mais-atingidas-pela-seca-minas-gerais-24403/) |
| O sindicato rural de Uberlândia disse que, após dois anos seguidos de perdas, os produtores ainda não tinham conseguido saldar os prejuízos | Perdas se acumulam de safra em safra | [Notícias Agrícolas](https://www.noticiasagricolas.com.br/noticia/166903) |
| Um produtor de Patrocínio escreveu que nunca tinha visto um veranico como aquele | O veranico surpreende até quem tem experiência | [Notícias Agrícolas](https://www.noticiasagricolas.com.br/fala-produtor/mensagem-30697/) |
| Em junho de 2026, a Conab registrou lavouras de sequeiro com menor porte por falta de chuva no Triângulo | A dor é atual | [Conab](https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/safras/progresso-de-safra/acompanhamento-das-lavouras-01-06-a-07-06-26/monitoramento-das-condicoes-das-lavouras) |
| Um analista apontou o Triângulo como a região mais afetada no milho, pela combinação de calor e menos chuva sobre lavouras de sequeiro | O sequeiro concentra o risco | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/agronegocio-mineiro-custos-clima-desafiam-produtores/) |
| Numa seca, a produção de leite do Triângulo caiu 20%, e a falta de pasto encareceu a atividade | O pequeno pecuarista também sofre | [Canal Rural](https://canalrural.com.br/programas/rural-noticias/seca-reduz-producao-leite-triangulo-mineiro-63958/amp) |
| O Jornal da Manhã, de Uberaba, noticiou ar insalubre por causa das queimadas e queda crítica na vazão dos rios | O fogo e a seca atingem toda a população, não só a lavoura | [Diário do Comércio / Jornal da Manhã](https://diariodocomercio.com.br/economia/estiagem-provoca-racionamento-agua-caete/) |
| Na revista TecnoAgro Uberaba 2024, o secretário de Agricultura de Minas descreveu secas prolongadas alternadas com chuvas intensas e concentradas em curtos intervalos | Os dois extremos convivem | [TecnoAgro Uberaba](https://midias.agazeta.com.br/2024/11/19/revista-tecnoagro-uberaba-2024-2507652.pdf) |

O que muda no produto: o relato mais forte é que a chuva varia muito de uma fazenda para outra. Isso justifica deixar o produtor registrar a chuva do próprio pluviômetro no app, o que vira a camada comunitária com uso diário real.

## Pesquisa científica regional

A pesquisa da região dá base para as regras do app e evita um erro comum: alertar todo período seco curto.

| Estudo | Achado | Implicação para o produto | Fonte |
| --- | --- | --- | --- |
| UFU (Roldão e Ferreira, 2015): veranico e produtividade da soja no Triângulo, 30 postos da ANA de 1980 a 2013 | A estação chuvosa vai em média de 19 de outubro a 11 de abril. Foram 3.553 veranicos, 77% de 5 a 9 dias; fevereiro concentrou 37% | Usar esse histórico como linha de base do modelo | [Estudos Geográficos / UFU](https://periodicos.rc.biblioteca.unesp.br/index.php/estgeo/article/download/10210/7360) |
| O mesmo estudo | 21 de 30 localidades tiveram correlação negativa entre veranico e produtividade, mas só 10 moderadas; veranicos curtos causam pouco dano, e a tecnologia reduziu a dependência da chuva | Alertar só veranicos longos (10 dias ou mais) em fase sensível, para não gerar alarme falso | [Estudos Geográficos / UFU](https://periodicos.rc.biblioteca.unesp.br/index.php/estgeo/article/download/10210/7360) |
| UFU, tese de Roldão (2020), aplicada ao Tocantins | Veranicos de 11 a 15 dias em novembro e de 16 a 20 dias em janeiro reduziram a produtividade da soja | Método de classes de duração útil para o Triângulo | [Repositório UFU](https://repositorio.ufu.br/handle/123456789/29256?mode=full) |
| UFU e IFTM (Costa e Queiroz, 2021), Ituiutaba | O período seco começou em abril em 63,4% dos anos e em maio em 33,3% | Ajuda a dar o risco de fim de chuva para o milho safrinha | [Revista Brasileira de Climatologia](https://ojs.ufgd.edu.br/rbclima/article/download/14572/7715/46644) |
| UFV, Revista Ceres: veranicos em Minas | Usa como início da estação chuvosa a primeira chuva de 20 mm em um ou dois dias após 10 de setembro, com ao menos um dia de chuva em cada 10 dias nos 30 seguintes; períodos secos de 3 a 6 dias são mais frequentes no Triângulo | Base para a regra "já dá para plantar?" do MVP | [Revista Ceres](https://ojs.ceres.ufv.br/ceres/article/download/3139/1034/4717) |
| Embrapa, Epamig e IFTM (2014): zoneamento da soja para semente em Minas | Média de março acima de 25 °C é pouco favorável na maturação | Alerta de calor na reta final da soja | [Journal of Seed Science / Embrapa](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1009216/1/AgroclimaticzoningofthestateofMinasGeraisfortheproduction.pdf) |
| Embrapa Soja (Dall'Agnol) | Cerca de 400 mm bem distribuídos ao longo do ciclo fazem a soja ir bem | Referência para o acompanhamento de chuva acumulada | [Nova Cana / Canal Rural](https://www.novacana.com/noticias/falta-chuvas-minas-gerais-risco-sucessao-soja-cana-211119) |
| Embrapa: cigarrinha-do-milho | Perdas importantes no Triângulo e no Noroeste de Minas | Relato de praga é um próximo passo da camada comunitária | [Embrapa](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1186237/1/Cap31-294-301.pdf) |
| FAZU (Uberaba): boletim de monitoramento de cigarrinhas, jan/2026 | Armadilhas no Triângulo registraram aumento da população, com risco de intensificar na safrinha | Parceiro local possível | [FAZU](https://fazu.br/wp-content/uploads/2026/02/Boletim-MENSAL-de-Monitoramento-de-Cigarrinhas-do-Milho_Janeiro-2026.pdf) |
| Inpe, Cemaden e Universidade de Leeds: AgroClimatic Monitor | Plataforma que combina indicadores, como vegetação verde com solo seco, para avisar seca em quase tempo real | Referência e concorrente; o diferencial do Raiz Orbital é a decisão diária no celular | [AgClimate BR](https://agclimatebr.leeds.ac.uk/data/pdfs/ficha_tecnica_1_apresentacao_PT.pdf) |

Parceiros para validar e dar credibilidade: o Instituto de Geografia da UFU (laboratório de climatologia), o IFTM Uberaba, a FAZU, a Epamig Oeste e a Emater de Uberlândia.

## Personas

As três personas são proto-personas: nomes e histórias são fictícios, mas cada traço vem de um dado das seções acima ou do [perfil do produtor](https://claude.ai/artifact/6j9yCD6nHtHpUAxLGgc76V). Elas precisam ser confirmadas em entrevistas.

### 1. Marcelo, produtor de grãos de sequeiro (usuário principal)

**Perfil.** 52 anos, ensino médio, cerca de 600 hectares entre terra própria e arrendada perto de Uberlândia. Planta soja no verão e milho safrinha em seguida, sem irrigação. Financia a safra com banco e CPR na revenda; não tem seguro neste ano.

**Rotina digital.** Celular o dia todo, WhatsApp com a revenda, o agrônomo e o grupo do sindicato. Olha a previsão de manhã num app gratuito. No talhão, o sinal some.

**O que ele quer.** Plantar na hora certa, não perder a janela da safrinha e fechar a safra sem aumentar a dívida.

**Dores.** Esperar a chuva firmar sem saber se ela vai continuar; veranico na floração e no enchimento; decidir em fevereiro entre milho e sorgo; medo de uma quebra no ano do El Niño com crédito caro.

**Frase provável:** "Previsão eu tenho. O que eu não sei é se vai dar para plantar o milho."

**O que o Raiz Orbital entrega.** Alerta de veranico com antecedência no WhatsApp; risco por data de plantio da safrinha; umidade do solo da região; tudo com a fonte do dado visível.

### 2. Seu José e Dona Cida, agricultores familiares (camada comunitária)

**Perfil.** Ele com 63 anos, ela com 58; estudaram até o fundamental. 30 hectares próprios na região de Patos de Minas: gado de leite, milho para silagem e uma horta. Recebem visita da Emater de vez em quando.

**Rotina digital.** Um celular pré-pago na casa, só WhatsApp e áudio. Usa o grupo da associação para saber de tudo.

**O que eles querem.** Manter o pasto e a silagem para o gado atravessar a seca, e não perder nada para o fogo.

**Dores.** Seca que chega cedo e esgota o pasto; fogo que vem do vizinho; estrada de terra ruim na chuva (a confirmar); pouca orientação técnica; aplicativo complicado.

**Frase provável:** "Se pegar fogo aqui, quem me avisa é o vizinho."

**O que o Raiz Orbital entrega.** Alerta de fogo por perto e de seca prolongada, em texto curto ou áudio; mural de relatos dos vizinhos; um caminho para pedir e oferecer ajuda.

### 3. Ana, agrônoma de revenda ou cooperativa (canal e fonte de confiança)

**Perfil.** 32 anos, agrônoma, atende cerca de 80 produtores no Triângulo pela revenda ou pela cooperativa. Passa o dia na estrada e no WhatsApp.

**O que ela quer.** Dar recomendações certeiras para muitos produtores ao mesmo tempo e ser vista como quem avisou antes.

**Dores.** Recebe as mesmas perguntas sobre chuva de dezenas de clientes; não tem um painel regional de risco; não consegue visitar todos no período crítico.

**Frase provável:** "Em fevereiro todo mundo me liga perguntando se planta o milho."

**O que o Raiz Orbital entrega.** Um painel da sua carteira com o risco de cada região e alertas prontos para repassar com a marca dela ou da cooperativa. Ela é o atalho para a confiança: 65% dos produtores mudam de prática por recomendação técnica.

## Dados da NASA: o que usar e como

Conferi nas páginas oficiais o que cada dado mede, em que resolução, com quanto atraso e como acessar. Duas mudanças recentes afetam o projeto: o FIRMS deixou de publicar os focos do satélite Suomi NPP em 2 de novembro de 2026, e o MODIS está sendo desligado.

**Com o foco em rotação**, dois dados ganham peso: o **MODIS MOD13Q1** (NDVI desde 2000) para mostrar se o talhão teve segunda safra ou pousio em cada ano, e o **NEX-GDDP-CMIP6** (chuva e temperatura diárias projetadas até 2100, a cerca de 28 km) para testar cada opção no clima de 2041–2060. O MODIS está sendo desligado, mas o histórico continua disponível, e é ele que o MVP usa. Detalhes de acesso no [PRD](https://claude.ai/artifact/ER9Gmh7FQDvPHkaXjcPeyd).

### O que cada dado entrega

| Dado | O que mede | Resolução e frequência | Atraso | Como acessar | Fonte |
| --- | --- | --- | --- | --- | --- |
| NASA POWER | Chuva, temperatura, umidade, vento e radiação por ponto, desde 1981 | Cerca de meio grau; diário | 2 a 3 dias (meteorologia); 5 a 7 dias (radiação) | API REST diária por ponto, sem login, com comunidade "AG" | [POWER FAQ](https://power.larc.nasa.gov/docs/faqs/data/), [POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) |
| GPM IMERG | Chuva por satélite | 0,1° (cerca de 10 km); a cada 30 minutos | Early: cerca de 4 h; Late: cerca de 14 h; Final: cerca de 3,5 meses | Earthdata Login; GES DISC ou `earthaccess` | [IMERG Tech Doc](https://www.cen.uni-hamburg.de/en/icdc/data/atmosphere/docs-atmo/imerg-v07-technical-documentation.pdf), [GPM / NASA](https://gpm.nasa.gov/taxonomy/term/1417) |
| SMAP L4 (SPL4SMGP) | Umidade do solo na superfície (0 a 5 cm) e na zona das raízes (0 a 100 cm), desde 2015 | 9 km; a cada 3 horas | Há versão de quase tempo real (NRT); a versão 8 é a atual | Earthdata Login; NSIDC, Earthdata Search ou AppEEARS | [NSIDC](https://nsidc.org/data/spl4smgp), [descrição das camadas](https://gillilanda.github.io/geol5093/about_the_data.html) |
| FIRMS (VIIRS) | Focos de fogo ativos | 375 m (VIIRS) ou 1 km (MODIS) | Quase tempo real; mapa atualizado a cada 15 minutos | `MAP_KEY` gratuita; API `/api/area/csv/`; limite de 5.000 transações a cada 10 minutos | [FIRMS API](https://firms.modaps.eosdis.nasa.gov/api/area/csv), [NASA Applied Sciences](https://appliedsciences.nasa.gov/sites/default/files/2025-05/Part%203%20FIRMS%202025%20Q&A%20Session.docx.pdf) |
| HLS (Landsat + Sentinel-2) | Imagem para índice de vegetação (NDVI) por talhão | 30 m; a cada 2 a 3 dias | 2 a 4 dias | LP DAAC, Earthdata Search ou AppEEARS | [Earthdata HLS](https://www.earthdata.nasa.gov/data/projects/hls?page=3), [NASA NTRS](https://ntrs.nasa.gov/api/citations/20220007971/downloads/LPS_freitag_final.pdf) |
| MODIS MOD13Q1 | NDVI e EVI, desde 2000 | 250 m; composição de 16 dias | Sendo descontinuado | AppEEARS (ponto ou polígono) | [data.nasa.gov](https://data.nasa.gov/dataset/modis-terra-vegetation-indices-16-day-l3-global-250m-sin-grid-v061-2eb0d) |

### Alertas de continuidade

- **FIRMS:** a entrega dos focos do Suomi NPP parou em 2 de novembro de 2026. Na API, troque `VIIRS_SNPP_NRT` por `VIIRS_NOAA20_NRT` ou `VIIRS_NOAA21_NRT`, que têm a mesma resolução ([Earthdata](https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know)).
- **MODIS:** a NASA planeja parar a coleta do Terra em fevereiro de 2027 e do Aqua em setembro de 2027 ([LAADS DAAC](https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/)). Use o MODIS só para o histórico do NDVI; para o presente, use HLS ou VIIRS.
- **SMAP:** o radar parou em 2015, e a umidade do solo vem do radiômetro, que segue operando ([JPL](https://www.jpl.nasa.gov/news/nasa-soil-moisture-radar-ends-operations-mission-science-continues/)). Confira no primeiro dia se o NRT da versão 8 cobre as datas recentes.

### Como cada dado vira funcionalidade

| Função do app | Dor que resolve | Dados | Como usar (regra versão 0) |
| --- | --- | --- | --- |
| Semáforo "hoje dá para plantar?" | Esperar a chuva firmar sem replantar | IMERG Late, pluviômetro do produtor, Open-Meteo, janela do ZARC | Verde com 20 mm ou mais nos últimos 2 dias, depois de 10/set, dentro do ZARC e sem 7 dias secos seguidos previstos nos próximos 10 |
| Alerta de veranico | Veranico na floração e no enchimento | IMERG + Open-Meteo + SMAP L4 (zona das raízes) + balanço hídrico com ETo | 10 dias ou mais com menos de 5 mm (observados + previstos) entre R1 e R6, com balanço abaixo de 50% da água disponível ou SMAP abaixo do percentil 30 |
| Déficit hídrico (ISNA) | Perda de produtividade por falta de água na fase crítica | POWER ou Open-Meteo (ETo), IMERG, SMAP | ISNA projetado da fase R1–R6 abaixo de 0,55, o limite do ZARC soja em Minas |
| Janela da safrinha | Janela comprimida | SMAP zona das raízes + POWER (histórico) + ZARC | Para cada data de plantio, a chance histórica de faltar água no florescimento; fim das chuvas = primeiro período seco de 15 dias ou mais depois de 15/mar |
| Chuva intensa | Excesso de chuva na colheita | IMERG + Open-Meteo | 50 mm ou mais em 24 h, previstos ou observados |
| Calor extremo | Ondas de calor do El Niño | Open-Meteo + POWER (T2M\_MAX) | 35 °C ou mais por 2 dias seguidos em R1–R6 ou logo após o plantio com solo secando |
| Fogo por perto | Queimadas | FIRMS (VIIRS NOAA-20 e NOAA-21) | Foco a menos de 10 km com confiança nominal ou alta; nível alto abaixo de 3 km |
| Saúde da lavoura (fase 2) | Saber se a lavoura sofreu | HLS (NDVI a 30 m) | Curva de NDVI do talhão contra a mesma época dos anos anteriores |

### Limites que precisam aparecer no pitch

- **A NASA observa; não prevê o tempo.** A previsão dos próximos dias vem de serviço externo. O valor do Raiz Orbital está em juntar o que o satélite mediu com a previsão e com o calendário da lavoura.
- **Escala.** SMAP (9 km) e IMERG (cerca de 10 km) mostram a região, não o talhão. Só o HLS chega perto do talhão.
- **Nuvem.** HLS e MODIS são óticos e ficam cegos em semanas nubladas, justamente na estação chuvosa.
- **IMERG em tempo real é menos preciso** que a versão Final; para treinar o modelo use a Final e, para o alerta, a Early ou a Late.
- **Previsão grátis só no uso não comercial.** A Open-Meteo libera até 10.000 chamadas por dia sem chave para uso não comercial; quando o serviço for cobrado, é preciso o plano pago ou servidor próprio.

### O que fazer no primeiro dia do hackathon

1. Criar o Earthdata Login e pedir a `MAP_KEY` do FIRMS (ambos gratuitos).
2. Testar uma chamada do POWER para Uberlândia (latitude -18,9; longitude -48,3) com chuva e temperatura diárias de 2015 a 2025.
3. Baixar o IMERG só para um quadrado do Triângulo com `earthaccess` e pegar o SMAP L4 pelo Google Earth Engine (coleção `NASA/SMAP/SPL4SMGP/008`), para não lidar com arquivos globais.
4. Testar a API do FIRMS com `VIIRS_NOAA20_NRT` na mesma área.
5. Separar uma safra passada com veranico conhecido para a demo ("modo replay").
6. Seguir o backlog e o plano das 36 horas do [PRD](https://claude.ai/artifact/ER9Gmh7FQDvPHkaXjcPeyd).

## Hipóteses

### Hipótese principal

**Acreditamos que** produtores de grãos de sequeiro do Triângulo (persona Marcelo) mantêm a sucessão soja/milho ou soja/pousio porque não enxergam, para o talhão deles, o risco climático e o ganho de solo das outras opções de entressafra.

**Se** eles receberem uma comparação das opções com 20 anos de dados da NASA, o clima projetado e o efeito no solo, ajustada às prioridades deles e com o porquê de cada nota,

**então** pelo menos 1 em cada 3 vai testar outra opção (sorgo, consorcio com braquiária ou planta de cobertura) em parte da área na próxima entressafra.

**Saberemos que é verdade quando** 10 entrevistas e um piloto com 15 a 20 produtores na entressafra de 2027 mostrarem que 30% ou mais mudaram parte da área, e quando os anos de aperto calculados pelo app baterem com os anos de quebra do milho 2ª safra registrados pelo IBGE. A meta de 30% é ponto de partida para discussão, não número de mercado.

### Hipóteses secundárias

| # | Hipótese | Por que acreditamos | Como testar |
| --- | --- | --- | --- |
| H2 | O WhatsApp entrega mais valor que um app próprio | 96% usam o WhatsApp para decisões de negócio; sinal fraco no campo | Comparar abertura e resposta do alerta pelo WhatsApp e pelo app |
| H3 | O produtor confia mais no alerta quando ele vem do agrônomo | 65% mudam de prática por recomendação técnica; só 6% confiam em IA | Enviar o mesmo alerta com e sem endosso do agrônomo e medir ação |
| H4 | Agrônomos e cooperativas pagam pelo painel, não o produtor | Custo é a primeira barreira para 67,1% dos produtores | Oferecer a licença por hectare (hipótese de R$ 1,50 por hectare por ano, ver Business Plan) a 3 revendas ou cooperativas e medir interesse e preço |
| H5 | Relatos dos vizinhos mantêm o app vivo fora do período crítico | Fogo e eventos locais não aparecem no satélite; 57,5% já usam WhatsApp e redes para informação da propriedade | Medir relatos por semana num grupo piloto durante a seca |
| H6 | Em anos de El Niño forte, o produtor busca ativamente esse tipo de ferramenta | 86% preocupados com o clima; cautela e dúvida sobre quando plantar na safra 2026/27 | Comparar a taxa de cadastro numa campanha com e sem o gancho do El Niño |

### Premissas de maior risco

1. **O produtor já não tem essa informação.** Talvez o consultor ou um app de clima já resolva. Essa é a primeira pergunta das entrevistas.
2. **Ainda dá para mudar a decisão.** Se o insumo já foi comprado e a semente já está na fazenda, o alerta pode chegar tarde para agir.
3. **O alerta acerta o suficiente.** Muitos falsos alarmes destroem a confiança. O modelo precisa ser testado com as safras passadas antes do piloto.
4. **A escala do satélite serve ao produtor.** SMAP e IMERG enxergam quilômetros; o produtor pensa em talhão.

## Como validar

A validação vai do mais barato ao mais caro: conversar, testar o modelo com o passado, simular o serviço à mão e só então construir.

| Etapa | O que fazer | Métrica de sucesso | Quando |
| --- | --- | --- | --- |
| 1. Entrevistas | 10 conversas: 5 produtores de grãos, 3 agricultores familiares, 2 agrônomos | 7 de 10 descrevem uma perda recente por veranico ou chuva fora de hora e dizem que um aviso antes teria mudado algo | Antes e logo após o hackathon |
| 2. Teste com o passado | Rodar o modelo nas safras de 2015 a 2025 e comparar com os veranicos que aconteceram | Acertar mais que a média histórica e ter poucos falsos alarmes | Durante o hackathon |
| 3. Serviço à mão | Grupo de WhatsApp com 20 produtores e 1 ou 2 agrônomos; o time manda o alerta manualmente com base nos dados | 70% ou mais leem o alerta; 50% ou mais relatam ter mudado uma decisão | Fevereiro e março de 2027 |
| 4. Teste de canal | Mesmo alerta com e sem endosso do agrônomo; pelo WhatsApp e pelo app | Diferença clara de resposta a favor de um formato | Junto com a etapa 3 |
| 5. Disposição a pagar | Apresentar o painel a 3 revendas ou cooperativas | Ao menos 1 aceita um piloto pago ou com contrapartida | Após a safra |

As metas são propostas do time para guiar a decisão, não dados de mercado.

### Roteiro de entrevista (30 minutos)

1. Me conta como foi a última safra. O que deu certo e o que deu errado?
2. Qual foi o último prejuízo que você teve por causa do clima? Quando percebeu que ia dar problema?
3. Como você decide a data de plantio da soja? E do milho safrinha? Quem você consulta?
4. Onde você olha a previsão do tempo hoje? O que falta nela?
5. O que você está fazendo diferente nesta safra por causa do El Niño?
6. Se alguém te avisasse 10 dias antes que vinha um veranico, o que você faria de diferente? Ainda daria tempo?
7. Quando tem fogo, estrada ruim ou granizo por perto, como você fica sabendo? Quem você avisa?
8. Você confiaria num aviso que vem de satélite? E se viesse do seu agrônomo?
9. Hoje você paga por alguma informação ou consultoria? Quanto?
10. Posso te mandar um aviso desses em fevereiro para ver se ajuda?

Evite perguntar "você usaria um app assim?": a resposta é quase sempre sim e vale pouco. O que vale é a história concreta da última perda e o que a pessoa fez de fato.

## MVP prático: "O que plantar depois da soja?"

**Por que mudou.** Ao reler o desafio Field Shift, vimos que ele pede uma ferramenta para **explorar estratégias de rotação** que fortaleçam a saúde do solo e adaptem a fazenda ao clima, usando dados da NASA, solo local, características das culturas e prioridades do produtor. O semáforo "hoje dá para plantar?" respondia ao clima, mas não à rotação. O motor de eventos climáticos continua, agora para calcular o risco de cada opção de rotação.

### A dor escolhida

Todo ano, de dezembro a março, o produtor de soja de sequeiro decide o que fazer com o talhão depois da colheita: milho safrinha, sorgo, consorciar com braquiária, plantar cobertura ou deixar em pousio. Ela foi escolhida porque reúne as evidências da pesquisa:

- A sucessão soja/milho ou o pousio depois da soja ainda dominam o Cerrado, e a Embrapa aponta que isso prejudica o solo e a produtividade no longo prazo.
- O fim das chuvas manda no risco da safrinha: em Ituiutaba, o período seco começou em abril em 63,4% dos anos; o milho plantado tarde pega a seca no florescimento, quando 4 a 8 dias sem água cortam mais da metade da produção.
- Milho e soja são hospedeiros do nematoide das lesões, enquanto a crotalária quebra o ciclo; a cigarrinha do milho já é monitorada no Triângulo.
- O El Niño 2026/27 aumenta a incerteza justamente sobre a safrinha.

### Como funciona

1. O produtor marca o talhão no mapa e informa a data de colheita da soja, a textura do solo e se tem nematoide.
2. O app busca 20 anos de chuva e clima da NASA (IMERG, POWER), a umidade do solo (SMAP), o histórico de verde do talhão (MODIS) e o clima projetado para 2041–2060 (NEX-GDDP-CMIP6).
3. Seis opções de entressafra recebem notas de segurança climática, clima futuro, saúde do solo e renda.
4. O produtor ajusta o peso de cada eixo, e o app monta os melhores planos de rotação de 3 anos, ao lado da sequência que ele já faz.
5. Cada nota explica qual dado da NASA levou a ela.

O semáforo de plantio da soja e os alertas de veranico, calor, chuva forte e fogo viram o **módulo 2**, que acompanha o plano durante o ano.

### Como medir efeito real

| Métrica | Meta inicial (proposta do time) | Como medir |
| --- | --- | --- |
| Produtores que mudariam a entressafra em parte da área | 1 em cada 3 | Entrevista depois de usar o app |
| Área de pousio trocada por cobertura ou consorcio no piloto | 10% da área dos participantes | NDVI do talhão na entressafra seguinte |
| Acerto do risco | Anos de aperto calculados batem com os anos de quebra do milho 2ª safra no IBGE | Comparação com a Produção Agrícola Municipal |
| Confiança | 7 em cada 10 dizem entender o "por quê" da nota | Pergunta de um toque |

**Piloto:** 15 a 20 produtores de Uberlândia e Uberaba, com sindicato rural, Emater ou revenda, na decisão da entressafra de 2027.

### Frase do pitch

"Todo ano, o produtor do Cerrado decide o que plantar depois da soja quase no chute. O Raiz Orbital usa 20 anos de dados da NASA e o clima de 2050 para mostrar, no talhão dele, qual rotação protege o solo e o bolso."

Requisitos, dados, regras e backlog dos devs: [PRD – Raiz Orbital](https://claude.ai/artifact/ER9Gmh7FQDvPHkaXjcPeyd).

## Fontes

Priorizei fontes oficiais (IBGE, Conab, MAPA, Inmet, Inpe, Embrapa, Governo de Minas, NASA), pesquisas de mercado com metodologia publicada (ABMRA com S&P Global, McKinsey, Serasa, Itaú BBA) e universidades (UFU, Ipea). Matérias de imprensa foram usadas para relatos e para repassar dados dessas instituições.

**Perfil e números do produtor**

- [UFU, Observatorium: agricultura familiar no Triângulo (Censo Agro 2006 e 2017)](https://seer.ufu.br/index.php/Observatorium/article/download/70868/37022/322940)
- [IBGE: Censo Agro 2017, resultados definitivos](https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-denoticias/releases/25789-censo-agro-2017-populacao)
- [IBGE: Atlas do Espaço Rural](https://agenciadenoticias.ibge.gov.br/pt/agencia-noticias/29724-atlas-do-espaco-rural-retrata-diversidade-e-desigualdade-do-campo-brasileiro.html?lang=pt-BR)
- [Ipea: assistência técnica no Censo Agro 2017](https://repositorio.ipea.gov.br/server/api/core/bitstreams/3122370b-8af7-4af7-867b-43ea9b422968/content)
- [Diário do Comércio: estabelecimentos rurais em Minas](https://diariodocomercio.com.br/economia/especial-numero-de-estabelecimentos-rurais-avanca-no-estado/)
- [Agência Minas: Emater e renda da agricultura familiar](https://www.agenciaminas.mg.gov.br/news/pdf/105767.pdf)

**Comportamento, tecnologia e confiança**

- [9ª Pesquisa ABMRA: clima e práticas (Diário do Comércio)](https://diariodocomercio.com.br/agronegocio/mudancas-climaticas-preocupam-86-produtores-rurais/)
- [9ª Pesquisa ABMRA: internet e WhatsApp (O Presente Rural)](https://opresenterural.com.br/internet-chega-a-98-das-propriedades-rurais-no-brasil-revela-estudo-da-abmra/)
- [McKinsey: a mente do agricultor brasileiro](https://www.mckinsey.com/br/our-insights/all-insights/agricultor-brasileiro-investe-no-aumento-da-produtividade)
- [AgFeed: McKinsey 2026, canais digitais e IA](https://agfeed.com.br/economia/mais-seletivos-com-gastos-produtores-rurais-adotam-ia-com-rapidez-aponta-estudo-da-mckinsey)
- [Canal Rural: pesquisa Embrapa, Sebrae e Inpe](https://www.canalrural.com.br/agronegocio/pesquisa-embrapa-tecnologias-digitais/)
- [Agência Gov: internet na área rural](https://agenciagov.ebc.com.br/noticias/202507/acesso-a-internet-nas-areas-rurais-dispara-150-em-oito-anos-e-alcanca-84-8-da-populacao)
- [Teletime: rede móvel em domicílios rurais (PNAD)](https://teletime.com.br/24/07/2025/internet-chega-a-93-dos-domicilios-mas-51-milhoes-de-lares-seguem-offline/)

**Safra, risco e finanças**

- [Diário do Comércio / Conab: safra 2025/26 e sequeiro no Triângulo](https://diariodocomercio.com.br/agronegocio/conab-projeta-alta-producao-graos-safra/)
- [Diário do Comércio: safra mineira fecha em 19 milhões de toneladas](https://diariodocomercio.com.br/agronegocio/producao-graos-minas-gerais-safra-2025-26/)
- [Brasil 61 / MAPA: seguro rural em 2025](https://brasil61.com/n/seguro-rural-parlamentares-de-mg-e-do-pr-cobram-fortalecimento-da-politica-para-dar-previsibilidade-ao-agro-cacb260201)
- [Canal Rural / Serasa: recuperação judicial no 2º trimestre de 2026](https://www.canalrural.com.br/diversos/pedidos-de-recuperacao-judicial-no-agro-caem-207-no-segundo-trimestre-aponta-serasa/)
- [Compre Rural / Serasa: inadimplência rural](https://comprerural.com/antes-de-vender-a-fazenda-para-pagar-dividas-produtor-precisa-conhecer-seus-direitos/)
- [Canal Rural: cigarrinha-do-milho no Triângulo](https://www.canalrural.com.br/agricultura/milho/projeto-monitora-avanco-da-cigarrinha-do-milho-no-triangulo-mineiro/)
- [Notícias Agrícolas: saúde mental do produtor](https://www.noticiasagricolas.com.br/noticia/404114)

**El Niño 2026/27**

- [Itaú BBA: Radar El Niño, junho de 2026](https://www.itau.com.br/media/dam/m/5bde3c83e3780878/original/Radar-El-Nino_Junho26_ItauBBA.pdf)
- [O Fator: Nota Técnica Conjunta Inpe, Inmet e Funceme](https://ofator.com.br/?p=70362)
- [Itatiaia: Painel El Niño 2026-2027 (Inmet)](https://www.itatiaia.com.br/brasil/brasil-geral/el-nino-2026-2027-brasil-em-alerta-para-fenomeno-muito-forte/)
- [Agência Minas: ações do Governo de Minas para o El Niño](https://www.agenciaminas.mg.gov.br/news/pdf/130454.pdf)
- [Canal Rural / Rural Clima: risco para soja e safrinha no Cerrado](https://www.canalrural.com.br/agricultura/el-nino-forte-amplia-risco-para-soja-do-cerrado-e-safrinha-2026-27-diz-rural-clima/)
- [Estado de Minas / Faemg: efeitos na agricultura de Minas](https://www.em.com.br/agropecuario/2026/06/7441533-alerta-para-os-efeitos-do-el-nino-na-agricultura-e-pecuaria-em-mg.html)
- [Diário do Comércio / Serasa: soja em Minas](https://diariodocomercio.com.br/agronegocio/el-nino-safra-soja-minas-gerais/)
- [Conab: soja em Minas na safra 2023/24](https://antigo.conab.gov.br/agricultura-familiar/paanet/entregas/item/download/53042_eb88936ad20d499a8ad92065474fb5ad)

**Dados da NASA**

- [NASA POWER: latência dos dados](https://power.larc.nasa.gov/docs/faqs/data/)
- [NASA POWER: API diária](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)
- [NSIDC: SMAP L4 SPL4SMGP](https://nsidc.org/data/spl4smgp)
- [GPM: IMERG Final Run](https://gpm.nasa.gov/taxonomy/term/1417)
- [IMERG V07: documentação técnica](https://www.cen.uni-hamburg.de/en/icdc/data/atmosphere/docs-atmo/imerg-v07-technical-documentation.pdf)
- [FIRMS: API de área](https://firms.modaps.eosdis.nasa.gov/api/area/csv)
- [Earthdata: fim do Suomi NPP no FIRMS](https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know)
- [LAADS DAAC: transição do MODIS para o VIIRS](https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/)
- [Earthdata: HLS](https://www.earthdata.nasa.gov/data/projects/hls?page=3)
- [data.nasa.gov: MODIS MOD13Q1](https://data.nasa.gov/dataset/modis-terra-vegetation-indices-16-day-l3-global-250m-sin-grid-v061-2eb0d)

**Imprensa e pesquisa regional**

- [Estudos Geográficos: veranico e soja no Triângulo (UFU)](https://periodicos.rc.biblioteca.unesp.br/index.php/estgeo/article/download/10210/7360)
- [Revista Brasileira de Climatologia: estações em Ituiutaba (UFU e IFTM)](https://ojs.ufgd.edu.br/rbclima/article/download/14572/7715/46644)
- [Revista Ceres: veranicos em Minas (UFV)](https://ojs.ceres.ufv.br/ceres/article/download/3139/1034/4717)
- [Embrapa, Epamig e IFTM: zoneamento da soja em Minas](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1009216/1/AgroclimaticzoningofthestateofMinasGeraisfortheproduction.pdf)
- [FAZU: boletim de cigarrinhas, jan/2026](https://fazu.br/wp-content/uploads/2026/02/Boletim-MENSAL-de-Monitoramento-de-Cigarrinhas-do-Milho_Janeiro-2026.pdf)
- [AgroClimatic Monitor (Inpe, Cemaden, Leeds)](https://agclimatebr.leeds.ac.uk/data/pdfs/ficha_tecnica_1_apresentacao_PT.pdf)
- [Canal Rural: chuva desigual entre Uberlândia e Uberaba](https://www.canalrural.com.br/agricultura/preco-baixo-desestimula-sojicultura-em-minas-gerais/)
- [Nova Cana / Canal Rural: chuvas esparsas em Uberaba](https://www.novacana.com/noticias/falta-chuvas-minas-gerais-risco-sucessao-soja-cana-211119)
- [Canal Rural: perdas de milho e soja no Triângulo](https://www.canalrural.com.br/agricultura/milho-soja-sao-culturas-mais-atingidas-pela-seca-minas-gerais-24403/)
- [Conab: monitoramento das lavouras, jun/2026](https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/safras/progresso-de-safra/acompanhamento-das-lavouras-01-06-a-07-06-26/monitoramento-das-condicoes-das-lavouras)
- [Revista TecnoAgro Uberaba 2024](https://midias.agazeta.com.br/2024/11/19/revista-tecnoagro-uberaba-2024-2507652.pdf)
- [Diário do Comércio: destaques do Jornal da Manhã (Uberaba)](https://diariodocomercio.com.br/economia/estiagem-provoca-racionamento-agua-caete/)

**Como identificar os eventos e documentos do time**

- [Planejamento, business case e business plan do Raiz Orbital](https://claude.ai/artifact/Ub4x3JemJK2pZ6NnbqLPbh)
- [PRD – Hoje dá para plantar?](https://claude.ai/artifact/ER9Gmh7FQDvPHkaXjcPeyd)
- [Portaria ZARC soja Minas Gerais 2026/27 (MAPA)](https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/safra-vigente/minas-gerais/PORTN200SOJAMG.pdf)
- [Déficit hídrico nas fases da soja (Embrapa Cerrados, via Revista Cultivar)](https://revistacultivar.com.br/artigos/impacto-do-deficit-hidrico-em-diferentes-fases-do-desenvolvimento-da-soja)
- [Fisiologia da produção de milho (Embrapa Milho e Sorgo)](https://www.alice.cnptia.embrapa.br/bitstream/doc/927283/1/Fisiologiaproducao1.pdf)
- [Duração da estação chuvosa e veranicos no Cerrado (Porto, dissertação UFV, 2024)](https://locus.ufv.br/items/b2a14644-2cda-490a-aa87-7b351bfac8cc/full)
- [Tendências de chuva intensa em Minas Gerais (Revista Brasileira de Meteorologia)](https://scielo.br/j/rbmet/a/J7YhvRZRjLJrQZL3YjJNPSd)
- [Metodologia do Risco de Fogo (Inpe)](https://dataserver-coids.inpe.br/queimadas/queimadas/Publicacoes-Impacto/documentos/RiscoFogo_Sucinto_20171121.pdf)
- [Termos de uso da Open-Meteo](https://open-meteo.com/en/terms)
