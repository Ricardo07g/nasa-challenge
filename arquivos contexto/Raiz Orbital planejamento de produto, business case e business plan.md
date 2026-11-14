# Raiz Orbital: planejamento de produto, business case e business plan

Nov 14, 2026 · @Rayanne

## Resumo

**Foco atualizado (14/nov):** para responder ao desafio Field Shift, o produto principal passa a ser **"o que plantar depois da soja?"**. Para cada talhão, o Raiz Orbital compara opções de entressafra e planos de rotação de 3 anos com notas de segurança climática (20 anos de dados da NASA), clima futuro (CMIP6), saúde do solo e renda, ajustadas às prioridades do produtor. O semáforo "hoje dá para plantar?" e os alertas descritos aqui viram o módulo 2, que acompanha o plano ao longo do ano. Os critérios de eventos climáticos deste documento são o motor de risco das duas partes. O contexto e as evidências estão no [discovery de produto](https://claude.ai/artifact/G3DVwtrQ6RCVSA7jTKQidD), e o detalhamento para os devs no [PRD](https://claude.ai/artifact/ER9Gmh7FQDvPHkaXjcPeyd).

- **Por que agora:** a safra 2026/27 começa sob El Niño forte, com chuva irregular, e só 3,3% da área plantada do país tinha seguro em 2025.
- **Quem usa e quem paga:** o produtor usa de graça; revendas, cooperativas e agrônomos pagam por hectare dos clientes que acompanham (referência de mercado: R$ 1 a 2 por hectare por ano).
- **O retorno para o produtor:** a R$ 1,50 por hectare, o serviço se paga se evitar perder menos de 1 kg de soja por hectare. Um único replantio evitado em 100 hectares vale cerca de R$ 72 mil.
- **O negócio:** é um mercado regional pequeno se cobrado só por hectare. O plano mira 200 mil hectares no ano 3 e o equilíbrio perto de 280 mil hectares, com subvenção (Centelha, Compete Minas) cobrindo os dois primeiros anos.
- **Próximo passo:** piloto com 20 produtores de Uberlândia e Uberaba ainda neste plantio e no período crítico de fevereiro e março de 2027.
- **Como o app detecta os eventos:** com critérios de dissertações, teses, Embrapa e ZARC: dia seco = menos de 5 mm; alerta de veranico com 10 dias secos ou mais na floração e no enchimento; índice de água (ISNA) abaixo de 0,55; calor de 35 °C ou mais por 2 dias; chuva de 50 mm ou mais em 24 h; foco de fogo a menos de 10 km.
- **Para os devs:** dados, regras e backlog estão no [PRD – Raiz Orbital: o que plantar depois da soja?](PRD%20–%20Raiz%20Orbital%20o%20que%20plantar%20depois%20da%20soja.md); arquitetura, API e banco no [plano técnico do backend](Raiz%20Orbital%20–%20plano%20técnico%20do%20backend.md).

Todos os números de projeção são hipóteses do time, marcadas como tal, e devem ser revistos depois do piloto. Os termos técnicos estão explicados no glossário logo abaixo.

**O que muda no negócio com o novo foco:** pouco. Quem paga continua sendo a revenda, a cooperativa ou a seguradora, por hectare acompanhado, e o produtor usa de graça. O valor para o pagante cresce: a revenda passa a vender sementes de sorgo, braquiária e cobertura com base no plano, e a seguradora ganha o histórico de risco por talhão. O roadmap, o Lean Canvas e o business case abaixo foram escritos para a versão do semáforo e devem ser revistos depois do hackathon.

## Glossário

Todos os conceitos usados neste documento e no discovery, em linguagem simples.

### Agricultura

| Termo | O que é |
| --- | --- |
| Sequeiro | Lavoura que depende só da chuva, sem irrigação. É a maior parte da soja e do milho do Triângulo. |
| Irrigado ou pivô | Lavoura com irrigação; o pivô central é o equipamento que gira regando um círculo. Escapa da falta de chuva, mas custa caro. |
| Safra ou 1ª safra | O plantio principal do verão, na estação chuvosa. No Triângulo, quase sempre soja. |
| Safrinha ou 2ª safra | O plantio feito logo depois da colheita da soja, quase sempre milho ou sorgo, aproveitando o fim das chuvas. |
| Janela de plantio | O período em que plantar dá mais chance de boa colheita. Fora dela, o risco aumenta. |
| Vazio sanitário | Período em que é proibido ter soja viva no campo, para quebrar o ciclo da ferrugem. Em Minas vai até 30 de setembro. |
| Veranico | Sequência de dias sem chuva no meio da estação chuvosa, normalmente com calor. Prejudica mais na floração e no enchimento de grãos. |
| Estiagem ou seca | Falta de chuva mais longa; um veranico que passa de 30 dias já é tratado como seca. |
| Floração e enchimento de grãos | As fases em que a planta forma e enche os grãos. São as que mais precisam de água. |
| Replantio | Plantar de novo uma área em que a semente não nasceu bem, por exemplo depois de um veranico logo após o plantio. Custa semente, adubo, diesel e tempo. |
| Saca e sc/ha | Saca = 60 kg de grão. Sc/ha = sacas por hectare, a medida de produtividade e de custo do produtor. |
| Hectare (ha) | 10 mil metros quadrados, mais ou menos um campo e meio de futebol. |
| ZARC | Zoneamento Agrícola de Risco Climático do Ministério da Agricultura e da Embrapa: diz, por município e solo, em que datas plantar tem menor risco. Plantar dentro dele é exigência para seguro e crédito. |
| El Niño e Super El Niño | Aquecimento do Oceano Pacífico que muda o clima no Brasil. No Sudeste costuma trazer calor e chuva irregular. "Super" é o nome popular de um evento muito forte. |
| Cigarrinha-do-milho | Inseto que transmite doenças ao milho e pode causar grandes perdas, sobretudo na safrinha. |
| Emater, Conab, Epamig, Embrapa | Emater-MG: assistência técnica do estado. Conab: acompanha as safras. Epamig e Embrapa: pesquisa agropecuária estadual e federal. |

### Dados de satélite e clima

| Termo | O que é |
| --- | --- |
| Sensoriamento remoto | Medir a Terra de longe, com satélites, sem ir ao campo. |
| Observação x previsão | Observação é o que já aconteceu, medido pelo satélite. Previsão é o que deve acontecer, calculado por modelos do tempo. A NASA entrega observação; a previsão vem de outro serviço. |
| Resolução espacial | O tamanho do "quadradinho" que o satélite enxerga. 9 km = um valor para uma área de 9 por 9 km; 30 m é quase o talhão. |
| Latência | Quanto tempo o dado demora para ficar disponível depois de medido. |
| NRT | Near Real Time, quase tempo real: dado disponível em horas ou poucos dias. |
| GPM IMERG | Produto da NASA que estima a chuva por satélite a cada 30 minutos. Tem versões Early (4 h de atraso), Late (14 h) e Final (cerca de 3,5 meses, mais precisa). |
| SMAP | Satélite da NASA que mede a umidade do solo. A versão L4 dá a umidade na superfície (0 a 5 cm) e na zona das raízes (até 1 m). |
| NASA POWER | Serviço da NASA que entrega chuva, temperatura e radiação diárias por ponto, desde 1981, por uma API simples. |
| FIRMS | Sistema da NASA que mostra focos de fogo detectados por satélite quase em tempo real. |
| NDVI | Índice que mede o quanto a vegetação está verde e viva, calculado de imagens de satélite. |
| HLS, MODIS, VIIRS | Fontes de imagem: HLS junta Landsat e Sentinel-2 (30 m); MODIS é a série antiga, sendo desligada; VIIRS é a sucessora. |
| API | Uma "porta" para um programa pedir dados a outro automaticamente. |
| Backtest ou modo replay | Rodar a regra do app em safras passadas para ver se ela teria acertado. |
| Acerto e falso alarme | Acerto: o app avisou e o evento aconteceu. Falso alarme: avisou e não aconteceu. Muitos falsos alarmes fazem o produtor parar de confiar. |

### Produto

| Termo | O que é |
| --- | --- |
| Discovery | Fase de entender o problema e o público antes de construir. |
| Persona e proto-persona | Retrato de um usuário típico. Proto-persona é a versão feita com dados secundários, ainda sem entrevistas. |
| Hipótese | Uma aposta que pode ser testada: "se fizermos X, acontece Y, e saberemos por Z". |
| MVP | Produto mínimo viável: a menor versão que resolve uma dor real e permite aprender. |
| Piloto | Uso real com um grupo pequeno, por tempo limitado, para medir efeito. |
| North Star | A métrica principal que mostra se o produto entrega valor. |
| OKR | Objetivos e Resultados-Chave: um objetivo qualitativo e de 2 a 4 resultados medidos que dizem se ele foi atingido. |
| Árvore de oportunidades | Mapa que liga o resultado desejado às dores (oportunidades) e às soluções e testes para cada uma. |
| RICE | Forma de priorizar: Alcance × Impacto × Confiança ÷ Esforço. Quanto maior a nota, antes entra. |
| Roadmap e gate | Roadmap: a sequência de fases no tempo. Gate: o critério que precisa ser atingido para passar à fase seguinte. |
| Lean Canvas | Uma página com os nove blocos de um negócio: problema, clientes, proposta, solução, canais, receitas, custos, métricas e vantagem. |

### Negócio

| Termo | O que é |
| --- | --- |
| Business case | A justificativa para investir: o problema, as alternativas, quanto custa, quanto retorna e os riscos. Responde "vale a pena fazer?". |
| Business plan | O plano do negócio: mercado, como ganha dinheiro, como vende, quem faz, quanto custa e como se financia. Responde "como vai funcionar?". |
| B2B2C | Vender para empresas (revendas, cooperativas) que levam o produto ao usuário final (o produtor). |
| TAM, SAM e SOM | Tamanho do mercado em três níveis: total possível (TAM), o que dá para atender com este produto e região (SAM) e o que dá para conquistar em poucos anos (SOM). |
| ROI | Retorno sobre o investimento: quanto volta para cada real investido. |
| Ponto de equilíbrio (break-even) | Quando a receita passa a cobrir os custos. |
| CAC e LTV | CAC: quanto custa conquistar um cliente. LTV: quanto um cliente gera de receita enquanto fica. O negócio é saudável quando o LTV é bem maior que o CAC. |
| Subvenção | Dinheiro público não reembolsável para inovação, como o Centelha e o Compete Minas, ambos da Fapemig. |

### Detecção de eventos

| Termo | O que significa |
| --- | --- |
| Dia seco | Dia com menos de 5 mm de chuva, mais ou menos o que a planta consome por dia no Cerrado |
| Sequência seca | Dias secos seguidos até hoje somados aos dias secos seguidos previstos a partir de amanhã |
| Fases R1 a R6 | Da floração ao fim do enchimento de grãos da soja, quando a planta mais precisa de água (7 a 8 mm por dia) |
| ETo (evapotranspiração de referência) | Quanto de água o ar "puxa" do solo e das plantas por dia, em mm |
| Kc (coeficiente da cultura) | Multiplicador da ETo para cada fase da lavoura; na soja chega a cerca de 1,15 na floração |
| CAD (água disponível no solo) | Quanto de água o solo guarda para a planta; solo arenoso guarda menos e sente o veranico antes |
| Balanço hídrico ("balde") | Conta diária: água no solo + chuva − consumo da planta |
| ISNA | Índice de satisfação da necessidade de água: água que a planta usou dividida pela que precisava (0 a 1). O ZARC da soja em Minas exige 0,55 ou mais na floração e no enchimento |
| Percentil | Posição de um valor no histórico do lugar; percentil 30 da umidade do solo = mais seco que 70% dos dias daquela época |
| R50mm | Índice usado em estudos de extremos: dia com 50 mm de chuva ou mais |

## O problema em números

&#91;embedded content: UFU (Roldão e Ferreira, 2015), Estudos Geográficos · 30 postos da ANA, 1980 a 2013\]

A maioria dos veranicos é curta e faz pouco estrago; o perigo está nos longos, sobretudo em fevereiro, quando o estudo da UFU registrou 37% dos casos. Por isso o alerta do app só dispara para veranicos de 10 dias ou mais em fase sensível da lavoura.

&#91;embedded content: CNseg e MAPA, via CNA e Brasil 61 · área segurada pelo PSR, Brasil\]

Com cada vez menos seguro, o prejuízo do clima cai direto no caixa do produtor, que já está endividado: a inadimplência rural chegou a 8,8% no 1º trimestre de 2026. Evitar a perda passa a valer mais do que tentar recuperá-la depois.

| Indicador da safra 2026/27 | Valor | Fonte |
| --- | --- | --- |
| Soja plantada em Minas | 2,52 milhões de hectares (2,9% a mais) | [Safras & Mercado](https://safras.com.br/?p=88965) |
| Preço da soja em Uberlândia, nov/2026 | R$ 144,17 por saca | [Agrolink / Grainsights](https://www.agrolink.com.br/noticias/soja-chega-a-r--161-60-por-saca-no-porto-de-santos_519756.html) |
| Produtividade esperada em Uberlândia | 4.300 kg/ha (cerca de 72 sacas) | [Canal Rural / Emater](https://www.canalrural.com.br/agricultura/projeto-soja-brasil/plantio-de-soja-em-mg-avanca-lentamente-aponta-emater/) |
| Custo extra de um replantio de soja | Até 7,4 sacas por hectare | [CNA / Campo Futuro](https://cnabrasil.org.br/publicacoes/replantio-da-soja-pode-elevar-custos-em-ate-7-4-sacas-por-hectare) |
| Custo dos insumos da soja | 5,7 sacas/ha acima da média de sete anos | [Agrolink](https://www.agrolink.com.br/noticias/soja-pode-ter-a-safra-mais-cara-da-decada_515056.html) |

## Planejamento de produto

### Visão e North Star

**Visão:** nenhum produtor do Cerrado perde a safra por uma decisão de clima que podia ter sido tomada com informação.

**North Star:** número de decisões de campo por semana que o produtor diz ter tomado por causa do Raiz Orbital (plantar, esperar, trocar o milho por sorgo, se preparar para o fogo). Mede valor real, não só uso.

**Métricas de apoio:** leitura da mensagem das 6h, registros de "Choveu aqui" por semana e acerto do semáforo.

### Roadmap

&#91;embedded content: roadmap · 5 fases, 4 gates (critérios para avançar)\]

Cada fase só começa quando o critério da anterior é atingido. O piloto do plantio coincide com o momento atual: a soja de sequeiro do Triângulo está sendo plantada agora.

### OKRs dos próximos 6 meses (nov/2026 a abr/2027)

| Objetivo | Resultados-chave |
| --- | --- |
| **O1. Provar que o semáforo muda decisões reais** | 20 produtores no piloto até 15/dez/2026 · 70% leem a mensagem ao menos 4 dias na semana · 1 em cada 3 relata ter mudado uma decisão |
| **O2. Provar que o alerta acerta** | Backtest 2015 a 2025 com 8 em cada 10 verdes sem veranico de 5 dias ou mais depois · no máximo 1 alarme falso de veranico por produtor na safra |
| **O3. Validar quem paga** | Conversa com 3 revendas ou cooperativas · 1 piloto pago ou com contrapartida até jun/2027 · proposta submetida a um edital da Fapemig |

As metas são propostas do time, para discutir.

### Árvore de oportunidades

O resultado que se quer: **menos perda por clima na soja e no milho de sequeiro.** Cada oportunidade é uma dor encontrada nas reportagens e pesquisas; abaixo dela, a solução e o teste.

- **"Não sei se a chuva firmou para plantar"**
  - Solução: semáforo diário de plantio
  - Teste: piloto de novembro e dezembro
- **"O veranico me pega sem aviso"**
  - Solução: alerta de veranico de 10 dias ou mais na fase sensível
  - Teste: backtest e piloto de fevereiro e março
- **"Não sei se ainda dá tempo da safrinha"**
  - Solução: risco por data de plantio do milho e quando trocar por sorgo
  - Teste: modo replay na safra 2023/24
- **"Choveu no vizinho e aqui não"**
  - Solução: "Choveu aqui", a rede de pluviômetros dos produtores
  - Teste: registros por semana no piloto
- **"O fogo vem de fora da minha fazenda"**
  - Solução: alerta de foco de fogo do FIRMS num raio de 10 km
  - Teste: piloto na seca de 2027

### Priorização RICE

Nota = Alcance × Impacto × Confiança ÷ Esforço. Alcance em produtores do piloto por trimestre; Impacto de 0,25 (mínimo) a 3 (enorme); Confiança em %; Esforço em pessoas-semana. As notas são estimativas do time.

| Funcionalidade | Alcance | Impacto | Confiança | Esforço | Nota | Decisão |
| --- | --- | --- | --- | --- | --- | --- |
| Semáforo de plantio | 20 | 3 | 80% | 2 | **24** | MVP |
| Alerta de fogo (FIRMS) | 20 | 1 | 80% | 1 | **16** | MVP |
| Alerta de veranico | 20 | 2 | 70% | 2 | **14** | MVP, se der tempo |
| "Choveu aqui" | 20 | 1 | 60% | 1 | **12** | MVP |
| Risco da safrinha | 15 | 2 | 50% | 3 | **5** | Fase 3 |
| Painel do agrônomo | 5 | 2 | 60% | 3 | **2** | Fase 4 |
| NDVI do talhão | 10 | 1 | 50% | 4 | **1,25** | Depois |

O alerta de fogo pontua alto porque é barato: o FIRMS já entrega o foco pronto. O NDVI pontua baixo porque exige mais trabalho e muda poucas decisões na hora.

## Lean Canvas

&#91;embedded content: Lean Canvas · 9 blocos, versão de hipóteses antes do piloto\]

O canvas mostra a escolha central do negócio: quem usa não é quem paga. O produtor recebe de graça porque custo é a primeira barreira para ele adotar tecnologia; a revenda e a cooperativa pagam porque ganham um motivo diário para falar com o cliente e uma visão de risco da carteira. Todos os blocos são hipóteses até o piloto.

## Business case

**A pergunta:** vale a pena investir no piloto do Raiz Orbital nesta safra?

**A resposta:** sim. O custo é baixo, o ganho potencial para o produtor é dezenas de vezes maior que o preço, e os critérios do roadmap permitem parar cedo se a hipótese não se confirmar.

### O problema que justifica o investimento

O produtor de sequeiro decide plantio e safrinha sem ver o risco de clima com antecedência; a safra 2026/27 começa sob El Niño, e quase ninguém tem seguro. Os detalhes estão na seção "O problema em números" e no discovery.

### Alternativas consideradas

| Opção | Custo para o produtor | O que resolve | O que não resolve |
| --- | --- | --- | --- |
| 1. Não fazer nada (experiência, vizinho, app de previsão) | Zero | Nada novo | Continua decidindo sem umidade do solo nem risco por fase |
| 2. App de previsão genérico | Grátis ou baixo | Previsão dos próximos dias | Não diz se o solo está pronto nem cruza com a fase da lavoura |
| 3. Plataformas de satélite pagas (ex.: Agronow, a partir de R$ 1/ha/ano) | Cerca de R$ 1 a 2/ha/ano | Saúde da lavoura (NDVI) e estimativa de produtividade | Não respondem "planto hoje?" nem avisam veranico por fase |
| 4. AgroClimatic Monitor (Inpe, Cemaden, Leeds) | Grátis | Panorama de seca para gestores | Não é uma decisão diária no celular do produtor |
| **5. Raiz Orbital** | **Grátis (a revenda paga)** | **Decisão diária de plantio, veranico, safrinha e fogo, com chuva local dos vizinhos** | NDVI e produtividade ficam para depois |

### Benefício para o produtor

&#91;embedded content: cálculo do time · preço Agrolink/Grainsights nov/2026, replantio CNA/Campo Futuro\]

| Premissa | Valor | Origem |
| --- | --- | --- |
| Preço da soja | R$ 144,17 por saca | Uberlândia, nov/2026 (Agrolink/Grainsights) |
| Custo extra de um replantio | 5 sacas/ha (a CNA aponta até 7,4) | Hipótese conservadora a partir da CNA |
| Área replantada evitada | 10% de uma fazenda de 1.000 ha | Hipótese do time |
| Preço do serviço | R$ 1,50/ha/ano | Hipótese, dentro da faixa de mercado de R$ 1 a 2 |

**Ponto de equilíbrio para o produtor:** a R$ 1,50 por hectare, o serviço se paga se evitar perder 0,0104 saca por hectare, ou seja, **cerca de 0,6 kg de soja por hectare**, menos de 1% de uma saca.

### Investimento do piloto (12 meses, estimativa)

| Item | Valor estimado |
| --- | --- |
| Time de 3 pessoas em meio período (bolsas ou dedicação parcial) | R$ 90 mil |
| Nuvem, domínio e serviços (APIs da NASA são gratuitas; a Open-Meteo é grátis só para uso não comercial, então o piloto pago precisa do plano comercial ou de servidor próprio) | R$ 6 mil |
| Viagens de campo, encontros com sindicatos e Emater | R$ 12 mil |
| Pluviômetros para produtores sem um e reserva | R$ 12 mil |
| **Total** | **R$ 120 mil** |

### Riscos e como mitigar

| Risco | Chance | Mitigação |
| --- | --- | --- |
| O semáforo errar e gerar desconfiança | Média | Backtest antes do piloto, alertar só veranicos longos, mostrar a fonte do dado e corrigir com a chuva dos vizinhos |
| O produtor não mudar a decisão (insumo já comprado) | Média | Focar em decisões que ainda dá para mudar: data de plantio e milho ou sorgo |
| Ninguém pagar | Média | Validar com revendas e cooperativas antes de escalar; plano B com editais e dados para crédito |
| Responsabilidade pela decisão do produtor | Baixa | Deixar claro que é apoio à decisão, com recomendação de consultar o agrônomo |
| Mudança nos dados da NASA (fim do MODIS, Suomi NPP) | Baixa | Usar VIIRS NOAA-20/21, HLS e SMAP; manter alternativa de previsão externa |
| Copiado por empresa maior | Alta, no longo prazo | Rede local de pluviômetros e parcerias regionais são difíceis de copiar |

### Recomendação

Fazer o piloto nesta safra, com investimento de até R$ 120 mil em 12 meses, e decidir pela continuidade nos gates do roadmap: se em março de 2027 menos de 1 em cada 5 produtores relatar uma decisão mudada, ou se o acerto ficar abaixo de 70%, o projeto para ou muda de direção.

## Como identificar os eventos que mais impactam

A pesquisa (dissertações, teses, Embrapa e as portarias do ZARC) aponta uma ordem clara de impacto na soja e no milho de sequeiro do Cerrado. O app só é útil se detectar cada evento com um critério reconhecido e no momento em que ele pesa.

&#91;embedded content: como o app detecta um evento · 5 etapas\]

### Os eventos, do maior para o menor impacto

| # | Evento | Por que pesa | Fonte |
| --- | --- | --- | --- |
| 1 | Falta de água na floração e no enchimento de grãos da soja (veranico longo) | Em experimento da Embrapa Cerrados, o estresse hídrico na fase reprodutiva causou perdas de 30% a 40%; nessa fase a soja precisa de 7 a 8 mm de água por dia | [Revista Cultivar / Embrapa Cerrados](https://revistacultivar.com.br/artigos/impacto-do-deficit-hidrico-em-diferentes-fases-do-desenvolvimento-da-soja), [ZARC soja MG](https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/safra-vigente/minas-gerais/PORTN200SOJAMG.pdf) |
| 2 | Falta de água no florescimento do milho safrinha | Dois dias de estresse hídrico no florescimento reduzem o rendimento em mais de 20%; de 4 a 8 dias de seca, em mais de 50% | [Embrapa Milho e Sorgo](https://www.alice.cnptia.embrapa.br/bitstream/doc/927283/1/Fisiologiaproducao1.pdf) |
| 3 | Calor extremo na fase reprodutiva | Acima de 35 °C na floração e no enchimento, a soja perde flores e vagens; entre 35 e 38 °C a germinação do pólen cai | [Agrolink](https://www.agrolink.com.br/noticias/nova-onda-de-calor-sera-critica-para-soja_488995.html), [Revista Cultivar](https://revistacultivar.com.br/noticias/estresse-climatico-provoca-aborto-floral-em-lavouras) |
| 4 | Início irregular das chuvas (plantio e replantio) | Chuva que não firma leva a replantio, que custa até 7,4 sacas/ha; com calor, um veranico logo após o plantio pode matar a semente | [CNA](https://cnabrasil.org.br/publicacoes/replantio-da-soja-pode-elevar-custos-em-ate-7-4-sacas-por-hectare), [Estado de Minas / Faemg](https://www.em.com.br/agropecuario/2026/06/7441533-alerta-para-os-efeitos-do-el-nino-na-agricultura-e-pecuaria-em-mg.html) |
| 5 | Fim antecipado das chuvas (safrinha) | Em Ituiutaba, o período seco começou em abril em 63,4% dos anos; o milho plantado tarde pega a seca no florescimento | [Revista Brasileira de Climatologia (UFU e IFTM)](https://ojs.ufgd.edu.br/rbclima/article/download/14572/7715/46644) |
| 6 | Chuva em excesso (colheita) | Já causou perda média de 40% na soja do Triângulo, com grão apodrecendo no campo | [Canal Rural](https://www.canalrural.com.br/agricultura/excesso-chuva-provoca-perda-nas-lavouras-soja-triangulo-mineiro-16112/) |
| 7 | Fogo na seca | Cerca de 45 mil hectares de cana queimados no Triângulo em 2024 | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/prejuizos-incendios-cana-superam-180-milhoes-reais/) |

### O que é um "dia seco": os estudos não concordam

A definição de veranico muda de autor para autor, e isso muda quantos veranicos se contam. Uma revisão publicada na Revista Ceres (UFV) reúne os critérios mais usados: dia seco com menos de 1 mm (Assad e Sano), menos de 3 mm (Castro Neto e Vilella), menos de 5 mm em sete dias (Sansigolo), ou quando a evapotranspiração real supera a chuva do dia (Silva) ([Revista Ceres](https://ojs.ceres.ufv.br/ceres/article/download/3139/1034/4717)). O estudo da UFU no Triângulo usou o dia em que a chuva é menor ou igual à evapotranspiração potencial ([Estudos Geográficos / UFU](https://periodicos.rc.biblioteca.unesp.br/index.php/estgeo/article/download/10210/7360)). Um estudo clássico da Embrapa justificou o limite de 5 mm porque a evapotranspiração costuma ficar em torno de 5 mm por dia ([Pesquisa Agropecuária Brasileira / Embrapa](https://seer.sct.embrapa.br/index.php/pab/article/download/17226/11540)).

As classes de duração também variam: a dissertação de Porto (UFV, 2024) sobre o Cerrado usa seis classes, de 5 a 6 dias até 15 dias ou mais ([Locus UFV](https://locus.ufv.br/items/b2a14644-2cda-490a-aa87-7b351bfac8cc/full)); a UFU usou de 5 a 9, 10 a 14, 15 a 19 e mais de 19 dias.

**Escolha do Raiz Orbital:** dia seco = menos de 5 mm de chuva (IMERG corrigido pelo pluviômetro do vizinho), porque é o que a planta consome por dia no Cerrado; veranico que gera alerta = 10 dias secos ou mais. A escolha é do time e será testada no backtest.

### Como o app identifica cada evento

| Evento | Regra de detecção (versão 0) | Base científica | Dados |
| --- | --- | --- | --- |
| Semáforo de plantio | Verde: depois de 10/set, dentro da janela do ZARC, 20 mm ou mais nos últimos 2 dias e previsão sem 7 dias secos seguidos nos próximos 10. Amarelo: choveu 20 mm, mas a previsão traz 7 dias secos ou mais; ou choveu entre 10 e 20 mm. Vermelho: menos de 10 mm em 3 dias, antes de 10/set ou fora do ZARC | Critério de Sansigolo, citado na Revista Ceres; ZARC soja MG | IMERG, pluviômetro, Open-Meteo |
| Veranico na soja | Sequência seca (observada + prevista) de 10 dias ou mais entre R1 e R6, com o balanço hídrico abaixo de 50% da CAD ou a umidade da zona das raízes (SMAP) abaixo do percentil 30. Com 15 dias ou mais, nível alto | UFU 2015; Embrapa Cerrados; ZARC | IMERG, Open-Meteo, SMAP L4, data de plantio |
| Déficit hídrico (ISNA) | ISNA projetado da fase R1–R6 (observado + 10 dias de previsão) abaixo de 0,55 | Portaria ZARC soja MG 2026/27; Embrapa | POWER ou Open-Meteo (ETo), IMERG, SMAP |
| Calor extremo | Máxima prevista de 35 °C ou mais por 2 dias seguidos em R1–R6, ou nos 10 dias após o plantio com o solo secando. Com 38 °C ou mais, nível alto | Agrolink, Revista Cultivar, Faemg | Open-Meteo, POWER |
| Florescimento do milho safrinha | Data de florescimento estimada pelo ciclo do híbrido; alerta com 4 dias secos ou mais previstos em torno dela | Embrapa Milho e Sorgo | IMERG, previsão, data de plantio |
| Fim das chuvas | Primeiro período seco de 15 dias ou mais que termine depois de 15 de março; usado para o risco da safrinha | Critério da Revista Ceres; UFU e IFTM em Ituiutaba | Histórico do POWER e do IMERG |
| Chuva intensa | Previsão ou observação de 50 mm ou mais em 24 h (índice R50mm) | Dissertações da UFCG e da Unifei sobre extremos no Sudeste | IMERG, Open-Meteo |
| Fogo | Foco VIIRS a menos de 10 km com confiança nominal ou alta; a menos de 3 km, nível alto. O índice de risco de fogo do Inpe (dias de secura, temperatura e umidade) fica para a fase 2 | Inpe, Programa Queimadas | FIRMS, IMERG, POWER |

As regras completas, com o código do balanço hídrico e os testes, estão no [PRD](https://claude.ai/artifact/ER9Gmh7FQDvPHkaXjcPeyd). Para não encher o celular do produtor, vale no máximo 1 alerta do mesmo tipo a cada 5 dias e 2 mensagens por dia.

### Cuidados

- **Os limites variam por estudo e por solo.** O ZARC, por exemplo, usa seis classes de água disponível no solo; um solo arenoso sente o veranico antes de um argiloso. O app deve deixar o produtor informar o tipo de solo ou usar o mapa de solos da região.
- **A pesquisa da região mostra tendência de queda nos extremos de chuva no Triângulo** (redução de 0,1 mm por dia por ano em um estudo com 309 postos em Minas), então o percentil local deve ser recalculado com dados recentes ([Revista Brasileira de Meteorologia](https://scielo.br/j/rbmet/a/J7YhvRZRjLJrQZL3YjJNPSd)).
- **Nenhuma regra entra no app sem backtest** nas safras de 2015 a 2025, medindo acertos e falsos alarmes.

## Business Plan

O Business case mostrou que o serviço vale a pena para quem usa. O Business Plan responde se ele se sustenta como negócio: quem paga, quanto, como chega ao produtor e quanto dinheiro falta até empatar.

**Conceitos usados aqui**

- **B2B2C:** a empresa vende para um parceiro (revenda, cooperativa, seguradora), e o parceiro entrega o serviço ao produtor. O produtor usa de graça.
- **Break-even (ponto de equilíbrio):** o tamanho em que a receita iguala o custo.
- **Subvenção:** dinheiro público não reembolsável para inovação, como o Centelha e o Compete Minas.

### Mercado

&#91;embedded content: mercado em hectares · Minas, região e meta\]

A soja de Minas deve ocupar 2,52 milhões de hectares em 2026/27, segundo a Safras & Mercado ([Safras](https://safras.com.br/plantio-da-safra-2026-27-de-soja-em-patos-de-minas-mg-deve-ocupar-33-mil-hectares/)); a Conab estima 2,4 milhões ([Diário do Comércio](https://diariodocomercio.com.br/agronegocio/producao-graos-minas-gerais-cresce/)). A fatia do Triângulo e Alto Paranaíba é uma estimativa do time a partir da participação medida pela UFU, que precisa ser atualizada com o IBGE.

### Modelo de receita

| Fonte | Quem paga | Preço (hipótese) | Por que pagaria |
| --- | --- | --- | --- |
| Licença por hectare | Revenda, cooperativa ou trading que oferece o alerta aos clientes | R$ 1,50 por hectare por ano | Fideliza o produtor e reduz replantio na carteira |
| Relatório de eventos | Seguradora e banco de crédito rural | Pacote anual por região (cerca de R$ 60 mil no ano 3) | Histórico de veranico, calor e chuva por talhão ajuda a precificar e regular sinistro |
| Produtor | Não paga | R$ 0 | A adoção depende de não ter barreira |

**Referência de preço:** a Agronow cobra R$ 1 por hectare por ano no plano anual de monitoramento por satélite ([Revista Cultivar](https://revistacultivar.com.br/index.php/noticias/agronow-lanca-plano-anual-a-partir-de-r-1-por-hectare)). R$ 1,50 é a hipótese do time, a validar com revendas.

### Go-to-market (como chegar ao produtor)

1. **Safra 2026/27, piloto:** 20 a 30 produtores via Sindicato Rural de Uberlândia e Emater, com alerta no WhatsApp.
2. **Safra 2027/28, primeiro parceiro pagante:** uma revenda ou cooperativa da região oferece o serviço à base de clientes.
3. **Safra 2028/29, escala:** 3 a 5 parceiros e o primeiro contrato com seguradora.

### Concorrência e diferencial

| Alternativa | O que faz | Nosso diferencial |
| --- | --- | --- |
| Previsão do tempo genérica (apps e TV) | Diz se vai chover | Não diz se dá para plantar nem considera o solo e a fase da lavoura |
| Plataformas de monitoramento por satélite | Mostram o vigor da lavoura depois do problema | O app avisa antes, com regra de evento baseada em estudo |
| Agrônomo da revenda | Orientação de confiança | O app é a ferramenta dele, não um substituto |

### Projeção de 3 anos

&#91;embedded content: receita e custo · 3 anos · projeção\]

|  | Ano 1 | Ano 2 | Ano 3 |
| --- | --- | --- | --- |
| Hectares pagos | 0 (piloto) | 60 mil | 200 mil |
| Receita | R$ 0 | R$ 120 mil | R$ 360 mil |
| Composição da receita (hipótese) | — | R$ 90 mil de licenças (60 mil ha × R$ 1,50) + R$ 30 mil de relatórios | R$ 300 mil de licenças (200 mil ha × R$ 1,50) + R$ 60 mil de relatórios |
| Custo (time, nuvem, campo) | R$ 120 mil | R$ 300 mil | R$ 480 mil |
| Resultado | −R$ 120 mil | −R$ 180 mil | −R$ 120 mil |

**Break-even:** com o custo do ano 3 e R$ 60 mil de relatórios, o negócio empata com cerca de 280 mil hectares pagos, perto de 20% da soja estimada da região. Leitura honesta: só com preço por hectare, o mercado regional é pequeno; o crescimento vem de expandir para outras regiões do Cerrado ou de vender dados para seguradoras.

### Financiamento

| Fonte | O que é | Situação |
| --- | --- | --- |
| Centelha 3 MG (Fapemig) | Apoio a empreendimentos inovadores em fase de ideia, aberto a pessoas físicas | Edital 010/2026 publicado ([Fapemig](https://api.site.fapemig.br/wp-content/uploads/Chamada-e-termo-de-outorga.pdf)) |
| Compete Minas (Fapemig, Sede-MG e Sebrae) | R$ 50 milhões em subvenção para inovação em empresas e startups mineiras, com bolsa de R$ 6,5 mil por mês por até seis meses | Rodada 2026 encerrada em 30/7; acompanhar a próxima ([Agência Minas](https://www.agenciaminas.mg.gov.br/noticia/novo-edital-do-compete-minas-oferece-r-50-milhoes-para-impulsionar-a-inovacao-tecnologica-no-setor-produtivo-130257)) |
| Minas pelo Clima (Fapemig) | R$ 50 milhões para pesquisa e inovação ligadas às mudanças climáticas | Edital lançado em março de 2026 ([Agência Minas](https://agenciaminas.mg.gov.br/noticia/governo-de-minas-destina-r-50-milhoes-para-iniciativas-inovadoras-sobre-mudancas-climaticas-no-estado)) |

Confirmar prazos e valores em cada edital antes de submeter.

### Time necessário

- **Produto e negócio:** discovery, parceiros e pitch.
- **Dados e clima:** pipeline NASA, regras de evento e backtest.
- **Desenvolvimento:** bot de WhatsApp e painel simples.
- **Agronomia (parceiro ou mentor):** valida limiares e fala a língua do produtor.

### Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Falso alarme derruba a confiança | Alto | Backtest 2015–2025 e alerta só quando muda a decisão |
| Revenda não paga | Alto | Validar preço com 5 revendas antes de escalar |
| Dado de satélite com atraso ou falha | Médio | Pluviômetro do vizinho e previsão como segunda fonte |
| Fim de satélites (MODIS) | Baixo | O MVP não depende do MODIS |

### Marcos

| Quando | Marco | Critério de sucesso |
| --- | --- | --- |
| Nov/2026 | Protótipo no Space Apps | "O que plantar depois da soja?" funcionando para Uberlândia e Uberaba, com 20 anos de dados da NASA |
| Mar/2027 | Backtest das regras | Acerto e falsos alarmes medidos em 10 safras |
| Out/2027 | Piloto com produtores | 60% abrem o alerta; 1 decisão mudada por produtor |
| Jun/2028 | Primeiro parceiro pagante | Contrato assinado com revenda ou cooperativa |

## Fontes

A lista completa de fontes do público, das dores e da imprensa está no [discovery](https://claude.ai/artifact/G3DVwtrQ6RCVSA7jTKQidD). Aqui ficam as usadas neste documento.

**Eventos climáticos e como identificá-los**

- [Portaria ZARC soja Minas Gerais 2026/27 (MAPA)](https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/safra-vigente/minas-gerais/PORTN200SOJAMG.pdf)
- [Zoneamento de risco climático para a soja no Cerrado (Nativa / Embrapa Cerrados)](https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/estudos_observatorio-do-zarc/estudos-2020/2020-ana-clara-alves-de-melo-zoneamento-de-risco-climatico-para-cultivo-da-soja-no-cerrado.pdf)
- [Impacto do déficit hídrico nas fases da soja (Revista Cultivar / Embrapa Cerrados)](https://revistacultivar.com.br/artigos/impacto-do-deficit-hidrico-em-diferentes-fases-do-desenvolvimento-da-soja)
- [Fisiologia da produção de milho (Embrapa Milho e Sorgo)](https://www.alice.cnptia.embrapa.br/bitstream/doc/927283/1/Fisiologiaproducao1.pdf)
- [Ecofisiologia do milho segunda safra (Embrapa Milho e Sorgo, 2023)](https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1156268/1/Ecofisiologia-do-milho-segunda-safra-para-alta-produtividade.pdf)
- [Onda de calor e soja (Agrolink)](https://www.agrolink.com.br/noticias/nova-onda-de-calor-sera-critica-para-soja_488995.html)
- [Estresse climático e aborto floral (Revista Cultivar)](https://revistacultivar.com.br/noticias/estresse-climatico-provoca-aborto-floral-em-lavouras)
- [Critérios de veranico e estação chuvosa (Revista Ceres, UFV)](https://ojs.ceres.ufv.br/ceres/article/download/3139/1034/4717)
- [Duração da estação chuvosa e veranicos no Cerrado (Porto, dissertação UFV, 2024)](https://locus.ufv.br/items/b2a14644-2cda-490a-aa87-7b351bfac8cc/full)
- [Veranicos no Triângulo Mineiro (Estudos Geográficos, UFU)](https://periodicos.rc.biblioteca.unesp.br/index.php/estgeo/article/download/10210/7360)
- [Estação chuvosa em Ituiutaba (Revista Brasileira de Climatologia)](https://ojs.ufgd.edu.br/rbclima/article/download/14572/7715/46644)
- [Precipitação e períodos secos em Brasília (Pesquisa Agropecuária Brasileira, Embrapa)](https://seer.sct.embrapa.br/index.php/pab/article/download/17226/11540)
- [Tendências de chuva intensa em Minas Gerais (Revista Brasileira de Meteorologia)](https://scielo.br/j/rbmet/a/J7YhvRZRjLJrQZL3YjJNPSd)
- [Índices de extremos climáticos no Sudeste (dissertação UFCG, 2013)](https://bdtd.ufcg.edu.br/jspui/bitstream/riufcg/5664/3/MARCOS%20RENATO%20BAS%c3%8dLIO%20AMORIM%20-%20DISSERTA%c3%87%c3%83O%20%28PPGMet%29%202013.pdf)
- [Metodologia do Risco de Fogo (Inpe, Programa Queimadas)](https://dataserver-coids.inpe.br/queimadas/queimadas/Publicacoes-Impacto/documentos/RiscoFogo_Sucinto_20171121.pdf)

**Impactos e custos na região**

- [Replantio da soja pode custar até 7,4 sacas/ha (CNA)](https://cnabrasil.org.br/publicacoes/replantio-da-soja-pode-elevar-custos-em-ate-7-4-sacas-por-hectare)
- [Excesso de chuva e perdas na soja do Triângulo (Canal Rural)](https://www.canalrural.com.br/agricultura/excesso-chuva-provoca-perda-nas-lavouras-soja-triangulo-mineiro-16112/)
- [Prejuízo com incêndios em canaviais (Diário do Comércio)](https://diariodocomercio.com.br/agronegocio/prejuizos-incendios-cana-superam-180-milhoes-reais/)
- [Alerta da Faemg para o El Niño (Estado de Minas)](https://www.em.com.br/agropecuario/2026/06/7441533-alerta-para-os-efeitos-do-el-nino-na-agricultura-e-pecuaria-em-mg.html)

**Mercado, preço e financiamento**

- [Área de soja em Minas 2026/27 (Safras & Mercado)](https://safras.com.br/plantio-da-safra-2026-27-de-soja-em-patos-de-minas-mg-deve-ocupar-33-mil-hectares/)
- [Safra de grãos de Minas 2026/27, Conab (Diário do Comércio)](https://diariodocomercio.com.br/agronegocio/producao-graos-minas-gerais-cresce/)
- [Agronow: plano anual a R$ 1 por hectare (Revista Cultivar)](https://revistacultivar.com.br/index.php/noticias/agronow-lanca-plano-anual-a-partir-de-r-1-por-hectare)
- [Edital Centelha 3 MG (Fapemig)](https://api.site.fapemig.br/wp-content/uploads/Chamada-e-termo-de-outorga.pdf)
- [Compete Minas 2026 (Agência Minas)](https://www.agenciaminas.mg.gov.br/noticia/novo-edital-do-compete-minas-oferece-r-50-milhoes-para-impulsionar-a-inovacao-tecnologica-no-setor-produtivo-130257)
- [Minas pelo Clima (Agência Minas)](https://agenciaminas.mg.gov.br/noticia/governo-de-minas-destina-r-50-milhoes-para-iniciativas-inovadoras-sobre-mudancas-climaticas-no-estado)

**Dados**

- [NASA POWER](https://power.larc.nasa.gov/)
- [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg)
- [NASA SMAP](https://smap.jpl.nasa.gov/)
- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/)
- [Open-Meteo](https://open-meteo.com/)
