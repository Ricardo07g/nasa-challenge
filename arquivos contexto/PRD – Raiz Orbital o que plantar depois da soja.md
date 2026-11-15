# PRD – Raiz Orbital: o que plantar depois da soja?

Nov 14, 2026 · @Rayanne · **v3 (14/nov, tarde):** fluxo simplificado para o produtor (2 perguntas, 1 resposta), correções de dados e backend detalhado no [plano técnico do backend](Raiz%20Orbital%20–%20plano%20técnico%20do%20backend.md).

> **O que mudou na v3.1 (14/nov, tarde).** (1) Tela de cálculo em forma de missão do satélite entre a pergunta 2 e a tela 4 (RF-19). (2) Tela 7: o produtor não escolhe mais "ano normal" ou "ano seco"; o app mostra o sinal para o outono (GEOS-S2S + SMAP + IMERG) e marca o Plano A ou o Plano B, com a regra do dia de plantar (RF-20). (3) Tela 7: "Quantos hectares quer testar?" com os totais em reais (RF-21). (4) As ideias para depois do MVP estão no [plano de evolução do produto](Raiz%20Orbital%20–%20plano%20de%20evolução%20do%20produto.md), fora deste PRD.

> **O que mudou na v3.** (1) O produtor responde só onde fica a lavoura e quando colhe a soja; solo, histórico, chuva, clima e até a sugestão de data vêm dos dados. (2) Notas de 0 a 100 e controles de peso saíram da tela do produtor: ele vê "deu certo em X de 20 anos", reais por hectare e Bom/Médio/Fraco. (3) A série vira 2006–2025, que são 20 anos de fato (2005–2025 eram 21). (4) O pousio sai do ranking e vira a linha de base. (5) Fator de escala do NDVI do MODIS incluído. (6) Arquitetura alinhada ao repositório (FastAPI em camadas + PostGIS). (7) Site responsivo: a mesma página serve celular e computador. (8) A tela "Mandar para o agrônomo" saiu do MVP.

## 1. Resumo e mudança de foco

**Por que reescrevemos.** O desafio Field Shift pede uma ferramenta de apoio à decisão que use observações da Terra da NASA, informação local de solo, características das culturas e prioridades do produtor para **explorar estratégias de rotação** que fortaleçam a saúde do solo e adaptem a fazenda a condições que mudam. A versão anterior (semáforo de plantio e alertas) respondia bem à parte de clima, mas não à rotação, ao solo e às prioridades. O motor de eventos climáticos continua, agora como coração do cálculo de risco.

**Problema.** No Triângulo Mineiro e no Cerrado, o sistema dominante é soja no verão seguida de milho safrinha, ou soja seguida de pousio. A Embrapa aponta que a região ainda é marcada pelo monocultivo de soja ou pela sucessão soja/milho, o que prejudica o solo e a produtividade no longo prazo. Todo ano, entre janeiro e março, o produtor decide o que plantar depois da soja. Essa decisão é tomada com pouca informação sobre o risco de faltar chuva, sobre o efeito no solo e sobre o clima que vem pela frente.

**Solução.** Para um talhão (ponto ou polígono no mapa), o Raiz Orbital compara 6 opções de entressafra (pousio, milho safrinha, sorgo, milho com braquiária, milheto e crotalária) e monta planos de rotação de 3 anos. Cada opção recebe notas em quatro eixos. O app usa pesos padrão e mostra ao produtor **uma resposta** e três alternativas (menos risco, mais dinheiro, cuidar da terra); quem quiser pode reordenar as opções por chuva, dinheiro ou terra:

| Eixo | Pergunta que responde | Dados |
| --- | --- | --- |
| Segurança climática | Em quantos dos últimos 20 anos essa opção teria passado aperto de água ou calor no florescimento? | GPM IMERG, NASA POWER, SMAP |
| Clima futuro | Esse risco aumenta em 2041–2060? | NEX-GDDP-CMIP6 |
| Saúde do solo | Quanto de palhada, nitrogênio e quebra de pragas a opção traz? | Parâmetros da Embrapa + histórico do talhão pelo MODIS/HLS |
| Renda | Quanto sobra no bolso, descontando o risco? | Preço e custo informados ou padrão regional |

Cada recomendação mostra **qual dado da NASA levou a ela** (por exemplo, "em 7 dos últimos 20 anos o florescimento do milho semeado depois de 25/fev pegou 10 dias sem chuva").

**Escopo do MVP (14 e 15 de novembro de 2026).**

| Entra no MVP | Fica para depois |
| --- | --- |
| Talhão por ponto no mapa ou GPS, no Triângulo Mineiro | Polígono do talhão; outras regiões do Cerrado |
| 6 opções de entressafra e planos de 3 anos | Algodão, feijão, trigo tropical, pecuária (ILP completa) |
| Risco climático com 20 anos de dados da NASA (2006–2025) | Modelo de produtividade calibrado |
| Clima futuro com CMIP6 (1 cenário, poucos modelos) | Todos os modelos e cenários |
| Histórico do talhão pelo NDVI (pousio ou segunda safra) | Classificação de cultura por aprendizado de máquina |
| Uma resposta, três alternativas, reordenar por eixo, explicação de cada nota, botão "Ouvir" | Pesos ajustáveis pelo produtor; conta de usuário, pagamento |
| Interface web responsiva, em inglês e português | Bot de WhatsApp e alertas diários (vira módulo 2) |

**Glossário rápido**

- **Entressafra / safrinha / segunda safra:** o que se planta depois da soja, de janeiro a março.
- **Pousio:** deixar a área sem cultivo até a próxima soja.
- **Rotação:** alternar culturas diferentes ao longo dos anos; **sucessão:** repetir a mesma sequência todo ano.
- **Planta de cobertura:** cultura plantada para proteger e melhorar o solo, sem colheita de grão (milheto, crotalária, braquiária).
- **Palhada:** restos de planta sobre o solo, que protegem da erosão e do calor e guardam umidade.
- **Fixação de nitrogênio:** leguminosas (como a crotalária) capturam nitrogênio do ar e deixam no solo.
- **ISNA:** índice de satisfação da necessidade de água, a razão entre a água que a planta usou e a que precisava (0 a 1).
- **NDVI:** índice de verde da vegetação medido por satélite; mostra se havia planta crescendo no talhão.

## 2. Critérios de avaliação e como vamos pontuar

O Space Apps avalia os projetos em cinco critérios; o guia não dá peso diferente a nenhum deles e lembra que muitos times capricham nos quatro primeiros e esquecem o último, a apresentação ([Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide)).

| Critério | O que os juízes perguntam | Como o Raiz Orbital pontua |
| --- | --- | --- |
| **Impacto** (no guia aparece como "Influence") | Quanto bem o projeto pode fazer e para quantas pessoas? | Sucessão soja/milho e pousio dominam milhões de hectares no Cerrado; mostrar o tamanho da área e o custo de uma safrinha frustrada ou de um replantio |
| **Criatividade** | A abordagem é nova ou só incremental? | Ler o histórico real do talhão pelo NDVI ("você deixou em pousio 6 dos últimos 10 anos"), testar cada opção nos 20 anos de chuva da NASA e no clima de 2050, e deixar o produtor mexer nos pesos |
| **Validade** | A solução é cientificamente correta e funciona no mundo real? | Limiares de dissertações, Embrapa e ZARC; balanço hídrico FAO-56; teste com safras passadas; limites e incertezas escritos na tela |
| **Relevância** | Responde ao desafio? Está completo, é viável e fácil de usar? | Cobre os quatro insumos pedidos (dados da NASA, solo local, culturas, prioridades) e o resultado pedido (estratégias de rotação para solo e clima) |
| **Apresentação** | O time contou bem o desafio, a solução e por que importa? | Vídeo de 30 s com a história de um produtor de Uberlândia e a tela de comparação |

### Cobertura dos pedidos do desafio

| O desafio pede | Onde está no produto |
| --- | --- |
| Observações da Terra da NASA | IMERG, POWER, SMAP, MODIS/HLS, NEX-GDDP-CMIP6 (seção 6) |
| Informação local de solo | Textura e água disponível informadas pelo produtor ou do SoilGrids; problema de nematoide (sim, não, não sei) |
| Características das culturas | Tabela de 6 opções com ciclo, água, palhada, nitrogênio e pragas (seção 5) |
| Prioridades do produtor | Controles de peso para segurança, solo, renda e futuro |
| Explorar estratégias de rotação | Ranking de opções e de planos de 3 anos, com comparação lado a lado |
| Fortalecer a saúde do solo | Nota de solo (palhada, nitrogênio, quebra de pragas) |
| Adaptar a condições que mudam | Risco nos últimos 20 anos, teste de ano seco e cenário 2041–2060 |

### Regras que eliminam do julgamento global

Segundo o guia de submissão ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)):

- **Inglês obrigatório** no formulário, nos slides e nas legendas do vídeo.
- **Demo:** vídeo de até **30 segundos** ou até **7 slides**, contando a capa. Passou disso, não concorre no global.
- **Link do projeto público**, sem senha nem cadastro (repositório no GitHub e site).
- **Uso de dados da NASA** é obrigatório para prêmio global; listar todas as outras fontes no campo de referências.
- **IA:** permitida, mas declarada no formulário; imagem ou vídeo gerado por IA leva marca d'água; não usar logo ou marca da NASA em material gerado.
- Todos os membros registrados e no evento local, sem lista de espera.
- **Prazo:** no guia de 2025, a submissão abria às 9h de sábado e fechava às 23h59 de domingo, no horário do evento local. **Confirmar o horário de 2026 com a organização de Uberlândia.**

### Prêmios globais que combinam com o projeto

- **Local Impact Award:** maior potencial de fazer diferença numa comunidade local.
- **Best Use of Data:** deixa os dados espaciais mais acessíveis ou os usa de forma única.
- **Best Use of Science:** uso mais válido do método científico.

## 3. Usuário, decisão e histórias de usuário

**A decisão que o produto apoia:** "Depois desta soja, o que eu planto neste talhão, e que sequência sigo nos próximos 3 anos para manter renda, proteger o solo e não perder dinheiro com seca?" Ela acontece de dezembro a março, quando a colheita da soja se aproxima, e é revista todo ano.

| Persona | Quem é | O que precisa |
| --- | --- | --- |
| Marcelo, produtor de grãos de sequeiro (principal) | 200 a 1.500 ha de soja no Triângulo, usa celular o dia todo, decide a safrinha com o agrônomo | Ver, em poucos minutos, qual opção e qual sequência dão mais segurança e renda no talhão dele |
| Ana, agrônoma de revenda ou cooperativa | Atende dezenas de produtores | Comparar opções com dados para justificar a recomendação e mostrar o efeito no solo |
| Jurado do Space Apps | Avalia em minutos | Entender o valor em 30 segundos e ver o dado da NASA por trás de cada nota |

### Histórias de usuário do MVP

| ID | Como... | Quero... | Para... | Prioridade |
| --- | --- | --- | --- | --- |
| US-01 | produtor | marcar minha lavoura no mapa ou pelo GPS, com um toque | o app buscar os dados daquele lugar | Must |
| US-02 | produtor | dizer quando colho a soja escolhendo entre três faixas, já sugeridas pelo satélite | o app saber quando a entressafra começa sem eu digitar data | Must |
| US-03 | produtor | ver uma resposta clara (o que plantar, até quando) com chuva, renda e terra em palavras | decidir rápido, sem precisar interpretar notas | Must |
| US-04 | produtor | ver alternativas para o que eu priorizo (menos risco, mais dinheiro, cuidar da terra) e todas as opções lado a lado | o resultado refletir o que importa para mim | Must |
| US-05 | produtor | ler por que cada opção ganhou ou perdeu nota, com o dado da NASA citado | confiar na recomendação | Must |
| US-06 | produtor | ver planos de rotação de 3 anos | sair da sucessão soja/milho ou soja/pousio | Must |
| US-07 | produtor | ver o histórico do meu talhão (anos de pousio e de segunda safra) pelo satélite | entender de onde estou partindo | Should |
| US-08 | produtor ou agrônomo | trocar a textura do solo e informar nematoide, só se eu quiser | ajustar o cálculo sem tornar o caminho principal mais longo | Could |
| US-09 | produtor | saber se vem um outono seco, ter um plano B e ver como o plano se sai no clima de 2050 | não ser pego de surpresa e saber se o plano aguenta | Should |
| US-10 | agrônomo | ~~editar produtividade, preço e custo na tela "Como a conta é feita"~~ (saiu na tarefa 0040: a renda não usa reais) | a renda ficar com a realidade do cliente | — |
| US-11 | jurado | abrir uma fazenda de exemplo em Uberlândia com um clique | ver o produto funcionando sem cadastro | Must |
| US-12 | produtor com pouca leitura | tocar em "Ouvir" e escutar a tela | entender sem depender de ler | Should |
| US-13 | produtor | usar o mesmo site no celular, no campo, e no computador, no escritório | não precisar de dois aplicativos | Must |
| US-14 | produtor | ver o que o app está fazendo enquanto calcula, de um jeito que prenda a atenção | não achar que travou e entender de onde vem a resposta | Should |
| US-15 | produtor | ~~ver em reais quanto deve sobrar e quanto arrisco testando o plano num pedaço da fazenda~~ (saiu na tarefa 0040: nenhum valor em reais no produto) | decidir quanto da área colocar no teste | — |

## 4. Como funciona: fluxo e requisitos funcionais

&#91;embedded content: fluxo do usuário · 5 passos\]

### Telas do MVP (protótipo v3)

Princípios: **site responsivo** (cada tela é uma página só, que se ajusta do celular de 360 px ao computador de 1440 px; no computador ganha duas colunas, no celular empilha na ordem de leitura), uma pergunta por tela, botões grandes (mínimo 48 px, principais 60 px), texto a partir de 15 px, frase curta, ícone + palavra + cor em cada sinal, botão "Ouvir" em todas as telas do caminho principal, nenhum número sem explicação.

**Caminho principal (5 telas):**

1. **Início:** "O que plantar depois da soja?", três passos com ícone e o botão "Começar" ("2 perguntas · 1 minuto · grátis"). Segundo botão: "Ver um exemplo pronto".
2. **Onde fica a lavoura (pergunta 1 de 2):** busca "Buscar cidade, estrada ou endereço" (que também aceita coordenadas e link do Google Maps colados), mapa com alfinete, endereço aproximado e o limite da área piloto, "Usar onde estou agora" e o botão "Confirmar local" (RF-01).
3. **Quando você colhe a soja (pergunta 2 de 2):** três botões (começo, meio, fim de fevereiro ou março), com a faixa sugerida pelo satélite já marcada.
   - **Calculando (entre as telas 3 e 4, novo na v3.1):** "Missão: sua lavoura". Enquanto a API busca os dados, o satélite entra em órbita, trava a mira na lavoura e passa por 6 fases (lavoura, terra, 20 anos de chuva e calor, histórico, clima que vem e sinal do outono, conta das 6 opções). Cada fase mostra o dado real que chegou e termina com uma conquista; no fim, "Missão completa" e o botão "Ver o que o satélite viu". Não revela a melhor opção. Tocar no satélite é só brincadeira e não acelera nada. Com `prefers-reduced-motion`, vira uma lista simples com ✓.
4. **O satélite já viu o resto:** cartões de chuva (20 anos), histórico do talhão (plantou ou ficou parado, 10 anos), terra (do mapa de solos, com "Não é? Trocar") e clima até 2050.
5. **Sugestão** (antes "A resposta"; remodelagem, RF-30): no topo das abas Sugestão · Comparar · Plano de 3 anos, o seletor "O que você quer mais?" (mais segurança, renda ou cuidar da terra). A melhor opção do objetivo como "Ano 1 do seu plano" (imagem da planta, selo "Sede da cultura" e até quando plantar), os 3 anos do plano em miniatura; as linhas Deu certo (critério do motor e o explorador ano a ano: tocar num ano abre o que aconteceu nele), Água, Clima 2041–2060, Renda e Terra; "Por quê?"; "Como fazer" em quatro partes; o aviso único da colheita tarde; alternativas "Se você prefere…".

**Telas de apoio:** 6. Comparar (antes "Todas as opções"; a ordem segue o objetivo do produtor) · 7. Plano de 3 anos (sinal para o outono, Plano A e Plano B; o Plano A começa pela sugestão) · 8. Perto de você (comunidade) · 9. Como a conta é feita (para agrônomos e jurados). O relatório para banco ou seguro (P2 do plano de evolução) saiu na remodelagem (RF-30).

A tela "Mandar para o agrônomo" (mensagem pronta para WhatsApp) saiu do MVP: confundia mais do que ajudava. O produtor pode compartilhar o link do site pelo próprio navegador.

### Requisitos funcionais

| ID | Requisito | Detalhe | História |
| --- | --- | --- | --- |
| RF-01 | Marcar talhão | Ponto (lat/long) pelo mapa (arrastar), pelo GPS ("Usar onde estou agora"), pela busca "Buscar cidade, estrada ou endereço" com autocompletar (Photon, dados do OpenStreetMap, sem chave: espera de 400 ms entre teclas, uma busca por vez com a anterior cancelada, mínimo de 3 letras, até 5 lugares, preferência pelo centro da área piloto e "© OpenStreetMap" visível) ou colando no mesmo campo coordenadas (`-18.9543, -48.1993`, `-18,9543; -48,1993`) ou um link do Google Maps (`!3d…!4d…`, `q=`, `query=`, `ll=`, `/maps/search/` e `@lat,lon`; link curto `maps.app.goo.gl` não abre sem rede, então a tela pede o link completo ou as coordenadas). Perto do alfinete, o endereço aproximado pelo *reverse* do Photon (com a mesma espera e o cancelamento; sem resposta, a cidade de referência mais perto). O botão "Confirmar local" (ícone de alfinete) substitui o "É aqui". O limite da área piloto (lat −19,90 a −18,40; lon −49,00 a −47,50) aparece tracejado no mapa, com legenda em texto e "Ver a área inteira"; os números vêm de `GET /api/area-piloto` (fonte única: `PILOT_*` do backend). Ponto fora da área não avança: "Por enquanto só temos dados da região de Uberlândia e Uberaba." (pt e en) e a fazenda de exemplo | US-01 (tarefa 0041) |
| RF-02 | Dados do talhão | Na tela 3, o dia da colheita da soja num campo de data no topo, já preenchido com o dia sugerido pela RF-16; o link "Não sei o dia exato" abre as 3 faixas (cedo, meio, tarde). O dia vira a faixa pela regra do `regras.yaml` (grupo `colheita`: até 10/fev, e janeiro, cedo; de 11 a 20/fev, meio; depois, tarde), a mesma da RF-16, e a faixa marcada é sempre a do dia no campo (sugestão = seleção); a faixa azul só diz "já deixamos esse dia no campo" quando é isso que está no campo. Textura do solo vem do SoilGrids (editável); nematoide é opcional; sem cadastro | US-02, US-08 (tarefa 0042) |
| RF-03 | Buscar dados da NASA | Séries 2006–2025 pré-carregadas por célula de 0,1° no PostGIS; NDVI do ponto sob demanda com cache; resposta da recomendação em menos de 1 s | US-03 |
| RF-04 | Notas por opção | Calcular segurança, futuro, solo e renda para as 6 opções com a regra da seção 7 | US-03 |
| RF-05 | Pesos e alternativas | Pesos padrão 30% segurança, 25% solo, 30% renda, 15% futuro para a "melhor opção"; alternativas = a melhor em cada eixo isolado. Sem controles de peso para o produtor. Desde a remodelagem (RF-30), o objetivo do produtor ("O que você quer mais?": mais segurança, renda ou cuidar da terra; sem escolha = equilíbrio) reordena pela nota do eixo, com desempate pela nota final; a ordem e o plano de cada objetivo vêm prontos do motor (`objetivos`) e trocar de objetivo é no navegador, sem pedir de novo | US-04 |
| RF-06 | Explicação | Para cada nota, 1 frase gerada por regra (sem IA generativa) citando o dado e o número | US-05 |
| RF-07 | Plano de 3 anos | Gerar as 216 combinações, aplicar as restrições da seção 7 e mostrar o melhor plano em ano normal e em ano seco | US-06 |
| RF-08 | Histórico do talhão | Classificar cada entressafra de 2015 a 2025 como pousio ou segunda safra pelo NDVI | US-07 |
| RF-09 | Testes de estresse | Recalcular com o ano mais seco da série e com o cenário 2041–2060 | US-09 |
| RF-10 | ~~Edição de economia~~ | Saiu (tarefa 0040): a renda não usa produtividade, preço nem custo, e nenhum valor em reais aparece no produto | US-10 |
| RF-11 | Fazenda de exemplo | Campo de soja de 48 ha da Fazenda Experimental do Glória (UFU), em Uberlândia (lat -18,9543, lon -48,1993), com dados pré-calculados; abre sem esperar. Área pública: não expõe dado de produtor. Confirmar com o ICIAG-UFU que o ponto cai em soja de sequeiro | US-11 |
| RF-12 | Idioma | Interface em inglês (para os juízes) com botão para português; textos da API nas duas línguas | — |
| RF-16 | Colheita sugerida | Estimar o dia em que a soja seca pela queda do NDVI de janeiro a março (seção 7.9), em `colheita_sugerida.dia` do `/api/talhao`, e a faixa desse dia pela regra da RF-02; sem dado, "meio" e sem dia | US-02 (tarefa 0042) |
| RF-17 | Ouvir | Ler a tela em voz alta pelo navegador (Web Speech API, pt-BR) | US-12 |
| RF-18 | Site responsivo | Uma página por tela, layout fluido (flex-wrap e grid automático), sem largura fixa; testado em 390 px e 1280 px; a URL guarda lat, lon e colheita, para recarregar ou compartilhar a mesma resposta | US-13 |
| RF-19 | Tela de cálculo (missão) | Rota `/calculando`: chama `/api/talhao` e `/api/recomendacao`, mostra 6 fases com os dados reais que chegam, cada fase com no mínimo 1,2 s; avança sozinha para a tela 4; depois de 20 s oferece a fazenda de exemplo; erro com mensagem calma; versão simples com `prefers-reduced-motion` | US-14 |
| RF-20 | Sinal para o outono e Plano A / Plano B | Nível `normal`, `seco` ou `incerto` com o motivo em uma frase, pela previsão oficial do El Niño / La Niña da NOAA CPC para fevereiro a abril (chance de cada fase, publicada todo mês) e por quantos anos daquela fase (ONI, 2005–2024) a opção do 1º ano do Plano A deu certo: metade ou mais com problema (e o Plano B melhor nesses anos) = `seco`; nenhuma fase chega a 50%, ou menos de 5 anos daquela fase na série = `incerto` (hipóteses do time no `regras.yaml`, a revisar). Botões "Plano A" e "Plano B, se secar" marcados pelo sinal. Regra da data: "se nos 30 dias antes da data limite do Plano A chover menos que 60% da média desses dias na série da célula, vá de Plano B". O SMAP de agora aparece só como informação. Mostra chance, nunca certeza; sem a previsão, "Ainda não conectado". Substitui a hipótese GEOS-S2S + SMAP + IMERG da seção 7.10 (decisão de 15/11/2026) | US-09 (tarefa 0038) |
| RF-21 | Renda só com fatos, sem reais | Nenhum valor em reais na API nem em tela nenhuma (seção 1 da remodelagem). A dimensão "Renda" (antes "Dinheiro") mostra só fatos: "Dá grão para vender" ou "Não dá grão: é investimento na terra" e "Risco de perder a lavoura: faltou água ou fez calor em N de 20 anos." (N = anos com aperto do motor; o total vem da série). Contrato: bloco `renda` de cada opção (`da_grao`, `anos_aperto`, `rotulo`, `texto`, `risco`). Nota de renda pela regra da seção 7.5. O campo "Quantos hectares quer testar?" e os totais em reais (antiga RF-21 e seção 7.11) saíram | US-03 (tarefa 0040) |
| RF-22 | Tocar num ano (P1) | Cada opção traz `anos_detalhe[]` em `/api/recomendacao`: para cada ano da série, se deu certo, a data da fase crítica, os dias sem chuva nela, a fase do El Niño / La Niña (ONI da NOAA, média de DJF a FMA; ±0,5), uma frase pronta em pt e en e, desde a tarefa 0044, o ISNA da fase crítica, os dias de 35 °C nela, o porquê do aperto (água e/ou calor), o dia de plantar e a umidade do SMAP no dia de plantar (2016 em diante). Na aba Sugestão, o explorador ano a ano (RF-30) substitui os quadradinhos; sem o arquivo do ONI, sem a marca do ENSO | Plano de evolução §4.1 (tarefas 0035 e 0044) |
| RF-23 | Na sua região, pelo satélite (P3) | `GET /api/regiao?lat&lon`: na região mais perto cujo raio (30 km) contém o ponto, a porcentagem da **soja do ano** que ficou parada, que plantou e sem certeza na entressafra de cada ano (os 10 anos do histórico do talhão: 2017–2026 desde a RF-25; o arquivo medido em 15/11 tem 2016–2025). Máscara: os pixels de 250 m do MODIS dentro da classe 12 (lavouras) do MCD12Q1 que mostram a soja **e** a colheita (maior NDVI de 1/jan a 15/mar ≥ 0,70 e, depois do pico até 15/mai, uma observação ≤ 0,40, cuja data é a colheita; hipótese do time a revisar pela agrônoma, no `regras.yaml`, no lugar da máscara de soja do MapBiomas); perene, pasto e solo exposto ficam fora. Cada pixel de soja é classificado com a regra do histórico do talhão só com as observações depois da colheita até 31/jul; só totais e porcentagens, nenhum pixel (RNF-10). A resposta traz o centro do círculo e a distância do ponto até ele, e a tela diz "Até 30 km da sua lavoura" ou o raio em volta de um ponto a X km. Ponto fora das regiões medidas: 404 `OUTSIDE_AREA`, e o bloco da região não aparece (o produto resolve com as perguntas; a região, por enquanto, só cobre a fazenda da UFU) | Plano de evolução P3 (tarefas 0034 e 0036) |
| RF-24 | Soja na última safra no ponto marcado | No começo do fluxo, `/api/talhao` traz `soja_recente` (`safra`, `vista`, `ndvi_pico`, `fonte`): no pixel de 250 m do MODIS, o maior NDVI das imagens boas (qualidade 0 ou 1, MOD13Q1 e MYD13Q1) de 1/jan a 15/mar da safra mais recente (2025/26) é 0,70 ou mais = soja vista; com menos de 2 imagens boas, sem dado (limites no `regras.yaml`, hipótese do time a revisar pela agrônoma). Com `vista: false`, a tela avisa e deixa seguir: "Não vimos soja neste ponto na última safra (2025/26). Confira se marcou a lavoura certa.", com "Ajustar no mapa" e "Seguir mesmo assim" (pt e en). Sem o dado ou fora da área medida: nenhum aviso | Decisão do usuário de 15/11/2026 (tarefa 0037) |
| RF-25 | Confirmar as últimas safras e conferir a soja de cada ano | Na tela 4, no cartão do histórico, o produtor confirma o que fez depois da soja nas 3 últimas entressafras (2024, 2025 e 2026, `anos_confirmaveis` do `/api/talhao`): cada ano mostra o que o satélite viu (plantou, parado, incerto ou sem soja; vazio sem dado) e os botões "Plantei" / "Deixei parado", em grupos com o rótulo do ano. A escolha fica na URL (`confirmadas=2024:plantou,2025:parado`) e vale no lugar do satélite naquele ano em `/api/talhao` e `/api/recomendacao` (`fonte_ano: "produtor"` e a frase do "Por quê?"); ano fora das 3 últimas ou outro valor: 422. O histórico vai de 2017 a 2026 e cada ano só conta como entressafra depois da soja quando o pixel mostrou a soja e a colheita (a mesma regra da RF-23); sem isso, o ano é `sem_soja`, fica fora das contas e tem legenda própria na faixa ("Sem soja"). Se nenhum ano tiver soja, o cartão diz "Não parece uma lavoura de soja. Confira o ponto no mapa." (pt e en) | Decisão do usuário de 15/11/2026 (tarefa 0039) |
| RF-26 | Guia de ajuda | `/guia` lista artigos curtos (150 a 300 palavras, pt e en) nos 5 temas (Culturas, Plantar, Cuidar da terra, Clima água e dados, Segurança), com busca por título; `/guia/<artigo>` mostra um artigo com "Em uma frase", "Por que importa", "Na sua lavoura" (com link de volta à tela) e "Fontes" (cultura também tem "Conheça" e "Passo a passo", com a ilustração da planta). Artigos de cultura, plantio e manejo levam "Rascunho: a revisar pela agrônoma.". Números só do `culturas.yaml`, `regras.yaml` e do PRD; fonte externa só de página aberta e conferida. Os artigos são Markdown no repositório; o texto é puro no DOM para o botão "Ouvir". A tela "Na sua região" liga ao Guia | Remodelagem, seção 8 (tarefa 0048) |
| RF-27 | O que a época da colheita muda (tela 3) | Na tela 3, com o dado da célula: (1) "Chuva que sobra depois da colheita": do dia escolhido até 30/jun, a chuva somada mediana e a de um ano seco (percentil 20) dos 20 anos, pelo GPM IMERG (nos anos sem IMERG, NASA POWER), com a frase "Colhendo em [data], sobram em média X mm; num ano seco, Y mm." e a curva para todos os dias de 15/jan a 31/mar (`chuva_que_sobra` do `/api/talhao`); só com a faixa, o dia de colheita da faixa no motor (5/fev, 15/fev, 28/fev); (2) por mês, de janeiro a junho, a chuva (IMERG) e o gasto da lavoura (ETo do motor, calculada com o clima do NASA POWER), destacando com texto o primeiro mês em que a chuva média fica menor que a ETo média (`eto_media_mm`, `mes_chuva_abaixo_eto` do `chuva_mensal`); (3) custo do atraso: "Colhendo cedo, deu certo em A de 20 anos; no meio, B de 20; tarde, C de 20.", com a melhor opção do motor em cada faixa e o nome dela quando muda (`GET /api/custo-atraso`); (4) fim das chuvas: o primeiro dia, a partir de 1º/mar, que começa 20 dias seguidos com menos de 10 mm somados, com "Em metade dos anos, a chuva acabou até [data]; o mais cedo foi [data] e o mais tarde [data]." (`fim_das_chuvas` do `/api/talhao`; ano sem fim na série = o bloco não aparece). Números no `regras.yaml` (grupos `colheita`, `chuva_que_sobra`, `fim_das_chuvas`), hipótese do time a revisar. Cada bloco sem dado não aparece; "Saiba mais" para o Guia ("Quando a chuva acaba", "A conta de água da lavoura", "Plantar logo depois da colheita", "O que significa 'deu certo'") | Remodelagem, seção 3 (tarefa 0042) |
| RF-28 | Comunidade: relatos sem cadastro (seção 7 da remodelagem) | Na tela "Na sua região" (`/comunidade`), o produtor que marcou a própria lavoura conta, sem cadastro e sem texto livre, em no máximo três toques: "O que plantei depois da soja" (as culturas do `culturas.yaml` com "deixei parado", mais "outra"; a safra, entre as últimas safras da RF-25; "foi bem", "mais ou menos" ou "perdi" e, se perdeu, o motivo: seca, calor, geada, granizo, praga ou outro), "Choveu aqui" (0 a 300 mm e a data, padrão hoje) e "Aconteceu aqui" (fogo, granizo, geada, vendaval, enxurrada ou erosão, praga ou doença, e a data; com fogo, "Em caso de fogo, ligue 193 (Bombeiros)"). Datas não futuras e de no máximo 30 dias. No máximo 10 relatos por aparelho em 24 horas (hipótese do time, `regras.yaml`). Rotas `POST`/`GET /api/comunidade/relatos` (raio padrão 30 km, pelas células de 0,1° cujo centro fica no raio) e `DELETE /api/comunidade/relatos/{id}` (só o aparelho que enviou), tabela `community_report`. A tela mostra o resumo "Perto de você" (o que os vizinhos plantaram na safra mais recente e quantos disseram que foi bem; a média da chuva relatada nos últimos 7 dias; os eventos dos últimos 30 dias, do mais recente ao mais antigo), o mapa de 30 km com os relatos agrupados por célula (ícone e número por tipo, legenda em texto) e os relatos do aparelho, com "Apagar". Todo relato aparece como "relato de vizinho, não confirmado" e não entra na conta do motor. Sem relatos: "Ainda não há relatos perto de você. Seja o primeiro a contar."; nenhum relato inventado (exemplos só no modo de demonstração, com o selo "Exemplo"). Na tela 4, depois de confirmar as safras (RF-25), "Compartilhar com a comunidade" grava o relato de plantio. Privacidade: RNF-10 | Remodelagem, seção 7 (tarefa 0047) |
| RF-29 | Raio-X da sua terra (tela 4) | A tela "O que o satélite viu" é o raio-X do ponto marcado (`GET /api/raio-x?lat&lon&colheita[&solo]`): um painel escuro (o único da tela) com o lugar, as coordenadas, a miniatura do mapa com o pin, a data da leitura mais recente (a altitude só se existir no `grid_cell`; hoje não existe) e 8 blocos com número, unidade, frase e selo de fonte e resolução: (1) solo do SoilGrids (argila, silte e areia em barra dividida, "Não é? Trocar"; em célula sem solo, o ponto gravado mais perto, até 15 km, dizendo a distância); (2) água que a terra guarda (CAD em mm e "aguenta cerca de N dias sem chuva na floração" = CAD ÷ (ETo do motor na floração × Kc da melhor opção do motor)); (3) umidade de agora (percentil do SMAP, em medidor); (4) verde da lavoura (última leitura do NDVI e pico da soja da última safra; sem série, o mapa da RF-24); (5) chuva de janeiro a julho e o fim das chuvas da RF-27 (GPM IMERG); (6) maior veranico de março a maio (dias abaixo de 1 mm, com o ano); (7) anos com dia de 35 °C ou mais de março a maio (NASA POWER); (8) a célula entre as da caixa piloto na chuva de março a maio ("mais seca que X%" ou "mais chuvosa que Y%"). Rodapé: cada dado vale para a área em volta do ponto, não para o talhão. Blocos em sequência e números contando, parados com "reduzir movimento". Histórico do talhão em faixa de calor do NDVI (2017–2026, uma leitura de 16 dias por coluna de janeiro a julho, legenda numérica, o que aconteceu escrito em cada linha, marcas "soja", "colheita" e "entressafra", título "Na entressafra, sua área ficou parada em X de 10 anos."), com o bloco da RF-25. Alertas da área só com risco (geada: mínima de 3 °C ou menos de maio a julho, NASA POWER; chuva forte: média de dias com 50 mm ou mais em fevereiro e março, GPM IMERG, com a frase da erosão; fogo: área queimada do MODIS MCD64A1 a até 5 km em 2016–2025; sem granizo). Cartões "20 anos de chuva" e "Clima 2041–2060" (média dos 3 modelos, concordância) com "ver na sugestão". Limites no `regras.yaml` (grupos `raio_x` e `alertas_area`, hipótese do time a revisar); bloco sem dado não aparece | Remodelagem, seção 4 (tarefa 0043) |
| RF-30 | Abas da resposta, objetivo, água e aba Sugestão | Abas "Sugestão", "Comparar" e "Plano de 3 anos" (as URLs `/resposta`, `/opcoes` e `/plano` ficam), com o seletor "O que você quer mais?" no topo das três (RF-05), guardado na URL (`objetivo=`). Imagem da planta (SVG próprio) em todo cartão, chip e artigo de cultura. **Água**, do balanço hídrico diário do motor nos dias do ciclo: selo "Sede da cultura" (pouca, média ou muita água pelo consumo ETo × Kc; cortes de 280 e 325 mm no `regras.yaml`, hipótese do time) e a linha "Precisa de X mm · Costuma chover Y mm (IMERG) · Falta Z mm em ano normal e W mm em ano seco" (mediana e o ano em que só 20% dos anos faltou mais), com a falta em 2041–2060 pelos deltas de cada modelo do CMIP6 (média e faixa); sem número para palhada, enxurrada ou água da próxima safra. **Aba Sugestão:** a melhor opção do objetivo como "Ano 1 do seu plano" e os 3 anos do plano em miniatura (o Plano A começa pela melhor opção); "deu certo" com o critério real do motor (ISNA de 0,55 ou mais na fase crítica, 0,50 na cobertura, e menos de 3 dias de 35 °C nela); explorador ano a ano (uma barra por ano com o ISNA em %, a linha de corte do motor, rótulo e desenho para "deu certo" e "faltou água / calor", El Niño e La Niña escritos) e, ao tocar, o detalhe do ano com a safra dia a dia (a antiga tela da safra passada); a frase "em anos de La Niña, deu certo em X de Y" só com diferença clara (5 anos ou mais da fase e 25 pontos, `regras.yaml`), dizendo que são poucos anos; linhas Deu certo, Água, Clima 2041–2060 (chuva de março a maio, máxima e quantos modelos concordam), Renda e Terra; "Como fazer" em quatro partes (quando plantar, quanto tempo leva, o que observar, manejo) com "Passo a passo completo" no Guia; um aviso só para a colheita tarde, com a lista das culturas fora do prazo do ZARC, a explicação do ZARC e o risco de geada quando houve. O relatório para banco ou seguro saiu; `/relatorio` e `/safra-passada` levam para a Sugestão | Remodelagem, seção 5, itens 5.1 a 5.4 (tarefa 0044) |
| RF-31 | Avisos do ponto marcado (`/avisos`) | Botão "Avisos" no cabeçalho, ao lado de "Comunidade", com o número de avisos ativos em texto (os de "Agora" e "Perto de você"; sem ponto ou sem aviso, sem número). Os avisos valem para o último ponto marcado no fluxo, guardado no aparelho sem cadastro (a fazenda de exemplo não conta); sem ponto, a tela pede "Marcar minha lavoura". Sem notificação: aparecem quando o app é aberto (`GET /api/avisos?lat&lon[&colheita][&solo][&confirmadas]`, com a melhor opção do motor do `/recomendacao`). Cada aviso tem o nível em texto ("Atenção" ou "Fique de olho"), o que o dado mostra, o que fazer em uma frase, a fonte e a data da leitura; grupo sem aviso mostra "Nada fora do normal" com a data da última leitura. Grupos: (1) **Agora**: terra seca com o percentil do SMAP de 20 ou menos ("mais seca que em X% dos anos nesta época"; leitura com mais de 15 dias marcada como antiga); dos últimos 30 dias do NASA POWER da célula, pedidos pelo backend com cache de 24 h, 10 ou mais dias seguidos com menos de 1 mm até a última leitura, ou 3 ou mais dias de 35 °C nos últimos 10 (se a API falhar, o aviso não aparece; a chuva recente nunca é comparada com "o normal"); a previsão de El Niño ou La Niña da NOAA para o outono (fevereiro a abril) com o que aconteceu com a melhor opção na célula em anos parecidos (ONI), dizendo que são poucos anos; durante a safrinha (entre a semeadura e a colheita da melhor opção), os avisos de veranico e calor do replay nos dias recentes; fora dela, o link "Ver como teriam sido os avisos em 2024" abre o ano na resposta (`/resposta?…&ano=2024`); (2) **O que mudou na sua área**: 2020–2024 contra 2005–2019 no maior veranico de março a maio, no fim das chuvas (RF-27), nos dias de 35 °C de março a maio, na falta de água da melhor opção no ciclo (mm, ETc menos ETr do balanço do motor) e nos anos em que ela deu certo, só as mudanças acima do mínimo do `regras.yaml`, com os dois números lado a lado e "São poucos anos: mostra o que aconteceu, não uma previsão."; (3) **Fora do comum**: os recordes da célula nos 20 anos (maior veranico, outono mais seco, fim das chuvas mais cedo, ano com mais dias de calor), com o ano; (4) **Perto de você**: eventos relatados pela comunidade (RF-28) nos últimos 7 dias a até 30 km, como "relato de vizinho, não confirmado" (sem banco, o grupo não aparece). Rodapé fixo "Alertas oficiais": "Estes avisos não são alertas oficiais e não substituem a Defesa Civil nem o INMET.", SMS do CEP para 40199 (botão que abre o SMS), WhatsApp "Oi" para (61) 2034-4611 (botão que abre a conversa), "Defesa Civil Alerta" sem cadastro, 193 (Bombeiros) e 199 (Defesa Civil), e o artigo do Guia. Limites no `regras.yaml` (grupo `avisos_tela`, hipótese do time a revisar); cada frase cita a fonte certa (chuva do GPM IMERG; calor e chuva recente do NASA POWER; umidade do SMAP) | Remodelagem, seção 6 (tarefa 0046) |

### Exemplo de saída (números ilustrativos, serão trocados pelos calculados)

> **A melhor opção: milho com braquiária.** Plante logo depois de colher a soja, até [data limite do ZARC].
> Chuva: deu certo em 14 de 20 anos (Médio). Renda: dá grão para vender; risco de perder a lavoura em 6 de 20 anos. Terra: fica coberta na seca (Bom).
> Por quê: plantando no meio de fevereiro, o milho floresce em abril; em 6 dos últimos 20 anos faltou chuva bem nessa hora (GPM IMERG + NASA POWER).
>
> **Se você prefere menos risco:** sorgo, deu certo em 17 de 20 anos.
>
> **Como é hoje:** sua área ficou parada em 5 dos últimos 10 anos depois da soja (NDVI do MODIS).

### Módulo 2 (depois do MVP): acompanhamento da safra

O semáforo de plantio da soja e os alertas de veranico, calor, chuva forte e fogo descritos no [Doc 5](https://claude.ai/artifact/Ub4x3JemJK2pZ6NnbqLPbh) viram o módulo que acompanha o plano ao longo do ano. No hackathon, eles aparecem só como "próximos passos".

### Comunidade "Na sua região" (Could no hackathon)

A camada comunitária fica, ligada à rotação. Ela faz duas coisas:

- **Choveu aqui:** o produtor com pluviômetro registra a chuva do dia. As leituras corrigem a chuva do GPM IMERG na região e entram no cálculo de risco, o que mostra aos jurados que o dado da NASA é conferido com medição de campo (critério Validade).
- **O que os vizinhos plantaram:** depois da entressafra, o produtor conta em dois toques o que plantou e se ficou satisfeito. O app mostra, num raio de 30 km, quantos vizinhos fizeram cada opção e quantos gostaram. Junta o dado do satélite com a experiência local e responde à desconfiança do produtor em tecnologia (critérios Impacto e Criatividade).

| ID | Requisito | Detalhe | Prioridade |
| --- | --- | --- | --- |
| RF-13 | Registrar chuva | Valor em mm e data, ligado ao ponto do talhão; aparece no mapa da região. Feito no RF-28 ("Choveu aqui", tarefa 0047) | Could |
| RF-14 | Contar a entressafra | Opção plantada e satisfação (sim, mais ou menos, não). Feito no RF-28 ("O que plantei depois da soja": foi bem, mais ou menos, perdi) | Could |
| RF-15 | Tela "Na sua região" | Mapa com pluviômetros e escolhas dos vizinhos; resumo por opção. Feito no RF-28 (mapa por célula e resumo "Perto de você") | Could |
| RNF-10 | Privacidade da comunidade | Sem cadastro, sem nome, sem texto livre e sem dado pessoal. O relato guarda só a célula de 0,1° do ponto marcado (cerca de 11 km × 10,5 km), nunca a coordenada exata, e o mapa mostra só o centro de cada célula, nunca uma fazenda; antes do primeiro envio, a tela avisa "Seus vizinhos veem a região, não o seu ponto.". O aparelho é um identificador aleatório criado no próprio aparelho, que só serve para limitar a quantidade de relatos e para apagar os próprios; o banco guarda só o hash (HMAC-SHA-256 com um sal secreto do servidor) e a listagem nunca mostra o aparelho, o hash nem a hora do envio (tarefa 0047) | Must se a tela existir |

Na remodelagem (seção 7, tarefa 0047, RF-28), a tela deixa de ser simulada: os relatos são de verdade, guardados no banco por célula de 0,1°, e aparecem como "relato de vizinho, não confirmado". Eles ainda **não** corrigem a chuva do IMERG nem entram no cálculo de risco: sem confirmação, servem para o produtor ver a redondeza. O relato de fogo já existe ("Aconteceu aqui"); estrada ruim e os tipos de troca (oferta, troca, empréstimo de insumos e equipamentos) ficam para depois.

## 5. Opções de entressafra e parâmetros das culturas

Todos os números ficam em `culturas.yaml`, para a agrônoma do time ajustar sem mexer no código. O que está marcado como hipótese precisa ser conferido antes da demo.

| Opção | Função | Semeadura até | Dias até florescer / ciclo | Kc no pico (FAO-56) | Palhada | Nitrogênio deixado | Nematoide | Renda |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pousio | Nenhuma | — | — | — | Muito baixa | 0 | Não quebra o ciclo e deixa o solo exposto | Não dá grão (nota 0) |
| Milho safrinha | Grão | \~28/fev (**hipótese otimista**: um estudo da UFU sobre o ZARC em Uberlândia sugere fechar até o 1º decêndio de fevereiro; conferir na Portaria SPA/MAPA nº 388/2025) | \~60 / \~120 dias | 1,20 | Média (cerca de 2,7 t/ha num estudo em Goiás) | 0 | Hospedeiro (o milho é altamente suscetível ao nematoide das lesões, como a soja) | Dá grão (nota = segurança, 7.5) |
| Sorgo granífero | Grão | \~20 dias depois do limite do milho (Embrapa) | \~65 / \~115 dias | 1,05 | Média | 0 | Reduz o nematoide reniforme | Dá grão (nota = segurança, 7.5) |
| Milho + braquiária ruziziensis | Grão + cobertura | Igual ao milho | Igual ao milho | 1,20 | Alta, com cobertura na seca | 0 | Braquiárias multiplicam alguns nematoides, mas reduzem o reniforme | Dá grão (nota = segurança, 7.5) |
| Milheto | Cobertura | Até março (hipótese) | \~50 / \~90 dias | 1,00 | Alta | 0 | Ajuda no controle do Pratylenchus | Não dá grão (nota 0) |
| Crotalária spectabilis | Cobertura leguminosa | Até fevereiro (hipótese) | \~60 / \~100 dias | 1,00 | 3 a 6 t/ha de matéria seca | 60 a 100 kg/ha | Altamente resistente; quebra o ciclo | Não dá grão (nota 0) |

**Base das referências.** Milho também suscetível e crotalária resistente ao nematoide ([Revista Cultivar / Embrapa](https://revistacultivar.com.br/noticias/rotacao-de-culturas-e-uma-das-indicacoes-para-controle-de-nematoides-fitoparasitos)); milheto contra Pratylenchus e braquiárias ([Agrolink / Embrapa](https://www.agrolink.com.br/noticias/rotacao-de-culturas-controla-nematoides-fitoparasitos_453196.html)); sorgo, nabo e gramíneas forrageiras reduzem o reniforme ([Notícias Agrícolas / Embrapa](https://www.noticiasagricolas.com.br/noticia/283964)); sorgo semeado até 20 dias depois do milho na segunda safra ([Notícias Agrícolas / Embrapa](https://www.noticiasagricolas.com.br/noticia/292308)); crotalária com 60 a 100 kg/ha de nitrogênio e 3 a 6 t/ha de matéria seca ([Aegro](https://aegro.com.br/tags/crotalaria-spectabilis/)); palhada de milho de 2,7 t/ha ([Pesquisa Agropecuária Tropical, UFG](https://revistas.ufg.br/pat/article/download/75032/39853/368616)). Preço, custo e produtividade saíram da conta na tarefa 0040 (nenhum valor em reais no produto; renda pela seção 7.5).

**Efeito na soja seguinte (para a nota de solo e para o pitch).** Num estudo no Cerrado, a soja depois de grão consorciado com braquiária ruziziensis rendeu 3.196 kg/ha, 11% a mais que depois do pousio ([Revista Cultivar](https://revistacultivar.com.br/noticias/consorcio-de-graos-com-forrageiras-controla-plantas-daninhas-na-soja)).

### Solo

| Textura | Água disponível (CAD) usada no balanço hídrico |
| --- | --- |
| Arenoso | 40 mm |
| Médio | 50 mm |
| Argiloso | 60 mm |

Valores na ordem de grandeza das reservas úteis usadas pelo ZARC. Se o produtor marcar "não sei", usar a textura do SoilGrids (ISRIC) no ponto.

## 6. Dados da NASA e externos: o que usar e como

| Fonte | Para que serve | Resolução e período | Acesso | Prioridade |
| --- | --- | --- | --- | --- |
| NASA POWER (API diária) | Temperatura máx./mín., umidade, vento, radiação e chuva; base da ETo | \~0,5°; diário desde 1981 | API REST aberta, sem chave | Must |
| GPM IMERG Final Daily (GPM\_3IMERGDF v07) | Chuva diária de 2006 a 2025 para o risco por ano | 0,1° (\~10 km); desde 2000 | Earthdata Login + `earthaccess`, ou Earth Engine | Must |
| SMAP L4 (SPL4SMGP v8) | Umidade da zona das raízes para calibrar o balanço hídrico e mostrar o solo na entressafra | 9 km; a cada 3 h; desde 2015 | Earth Engine `NASA/SMAP/SPL4SMGP/008` | Should |
| MODIS MOD13Q1 (NDVI 16 dias) | Histórico do talhão (segunda safra ou pousio) e estimativa da faixa de colheita da soja | 250 m; desde 2000 | Earth Engine `MODIS/061/MOD13Q1` | Must |
| HLS (Landsat + Sentinel-2) | O mesmo histórico em talhões pequenos, nas safras recentes | 30 m; a cada 2–3 dias | Earthdata / Earth Engine | Could |
| NEX-GDDP-CMIP6 | Chuva e temperatura diárias projetadas para 2041–2060 | \~27,8 km; 1950–2100; cenários SSP2-4.5 e SSP5-8.5 | Earth Engine `NASA/GDDP-CMIP6` | Must |
| GEOS-S2S-2 (NASA GMAO) | Previsão de chuva de março a maio, com a chance de ficar abaixo ou acima do normal, para o sinal do outono (RF-20) | 0,5°; mensal, alguns meses à frente; previsões retrospectivas para validar | Página de downloads do GMAO (conferir o formato dos arquivos) | Should |
| SoilGrids (ISRIC, não NASA) | Textura do solo quando o produtor não sabe | 250 m | API REST | Should |

O MODIS Terra deve parar de coletar em 2027, mas o histórico continua disponível e é isso que o MVP usa. Para o presente, o caminho é o HLS.

### Contas que o time precisa hoje

1. **Earthdata Login** (grátis), para IMERG e SMAP pelos servidores da NASA.
2. **Google Earth Engine** com um projeto do Google Cloud (grátis para uso não comercial). É o caminho mais rápido para MODIS, SMAP e CMIP6 sem baixar arquivos globais.
3. Repositório **público** no GitHub desde o início (exigência da entrega).

### 6.1 NASA POWER: clima diário de 20 anos

```
GET https://power.larc.nasa.gov/api/temporal/daily/point
  ?parameters=PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M,WS2M,ALLSKY_SFC_SW_DWN
  &community=AG&latitude=-18.9543&longitude=-48.1993
  &start=20060101&end=20251231&format=JSON
```

Com esses campos, calcular a ETo diária pelo FAO-56 Penman-Monteith (biblioteca `pyet`). O valor `-999` é dado ausente.

### 6.2 IMERG Final: chuva diária

```python
import earthaccess, xarray as xr
earthaccess.login()
res = earthaccess.search_data(short_name="GPM_3IMERGDF", version="07",
                              temporal=("2006-01-01", "2025-12-31"),
                              bounding_box=(-51.0, -20.5, -46.0, -17.5))
ds = xr.open_mfdataset(earthaccess.open(res))
chuva = ds["precipitation"].sel(lat=-18.9543, lon=-48.1993, method="nearest")
```

São cerca de 7.300 arquivos diários: **baixar uma vez só para a caixa (pipeline `fetch_imerg.py`) e gravar no PostGIS (`climate_season`)**. Se travar, usar a chuva do POWER (PRECTOTCORR) no hackathon e trocar depois.

### 6.3 Earth Engine: MODIS, SMAP e CMIP6

```python
import ee
ee.Initialize(project="SEU-PROJETO")
ponto = ee.Geometry.Point(-48.1993, -18.9543)

# NDVI de 16 dias, 2015-2025
ndvi = (ee.ImageCollection("MODIS/061/MOD13Q1").filterDate("2015-01-01", "2025-12-31")
        .select("NDVI").getRegion(ponto, 250).getInfo())

# Projecao diaria 2041-2060, um modelo e um cenario
cmip = (ee.ImageCollection("NASA/GDDP-CMIP6")
        .filter(ee.Filter.eq("model", "ACCESS-CM2"))
        .filter(ee.Filter.eq("scenario", "ssp245"))
        .filterDate("2041-01-01", "2061-01-01")
        .select(["pr", "tasmax"]).getRegion(ponto, 27830).getInfo())
```

No MOD13Q1, o NDVI vem como inteiro com **fator de escala 0,0001** (7.100 = 0,71): aplicar antes de usar os limiares da seção 7.8. No CMIP6, `pr` vem em kg/m²/s (multiplicar por 86.400 para mm/dia) e `tasmax` em Kelvin (subtrair 273,15). Usar 3 a 5 modelos e mostrar a média e a faixa, nunca um modelo só como verdade. Para o SMAP, a coleção `NASA/SMAP/SPL4SMGP/008`, banda `sm_rootzone`. O `getRegion` tem limite de linhas por chamada: quebrar o pedido por ano se der erro.

### 6.4 SoilGrids

```
GET https://rest.isric.org/soilgrids/v2.0/properties/query
  ?lon=-48.1993&lat=-18.9543&property=clay&property=sand&depth=0-30cm&value=mean
```

Regra simples: argila acima de 35% = argiloso; areia acima de 70% = arenoso; o resto = médio.

## 7. Motor de pontuação

Tudo é regra transparente, sem modelo de caixa-preta: cada nota tem uma conta que cabe numa frase. Os limiares são a **versão 0** e ficam em `regras.yaml`.

### 7.1 Data de semeadura de cada opção

Semeadura = data de colheita da soja + 3 dias. O produtor escolhe uma faixa, e cada faixa tem uma data de referência: `cedo` = colheita 5/fev, `meio` = 15/fev, `tarde` = 28/fev (em `regras.yaml`). Se passar do limite da opção (seção 5), a opção aparece como "fora da janela" e não entra no ranking daquele ano.

### 7.2 Segurança climática (0 a 100)

Para cada ano de 2006 a 2025 (20 anos), simular a opção com a chuva real daquele ano:

1. **Balanço hídrico diário ("balde")** a partir da semeadura, com chuva do IMERG, ETo do POWER, Kc da cultura e CAD da textura. O balde começa em 50% da CAD, ou no valor estimado pelo SMAP quando houver.
2. **Janela crítica:** 15 dias antes e 15 depois do florescimento.
3. **Ano com aperto** se, na janela crítica, o ISNA ficar abaixo de 0,55 **ou** houver 3 dias ou mais com máxima de 35 °C ou mais.
4. **Coberturas** (milheto, crotalária) não têm grão: o aperto delas é falhar no estabelecimento (ISNA abaixo de 0,50 nos primeiros 30 dias).
5. **Segurança = 100 × (1 − anos com aperto ÷ anos simulados).** O pousio não tem o que perder e recebe 100.

```python
def simular(chuva, eto, kc, cad, arm0=None):
    arm = cad * 0.5 if arm0 is None else arm0
    etr_l, etc_l = [], []
    for p, e, k in zip(chuva, eto, kc):
        etc = k * e
        disp = arm + p
        etr = min(etc, disp)
        arm = min(cad, disp - etr)
        etr_l.append(etr); etc_l.append(etc)
    return etr_l, etc_l

def isna(etr_l, etc_l, ini, fim):
    return sum(etr_l[ini:fim]) / max(sum(etc_l[ini:fim]), 1e-6)
```

Base: limiar de ISNA de 0,55 usado pelo ZARC da soja em Minas na floração e no enchimento (aplicado aqui ao milho e ao sorgo como hipótese); calor acima de 35 °C na floração ligado a aborto de flores; balanço hídrico FAO-56. Detalhes no [Doc 5, seção "Como identificar os eventos"](https://claude.ai/artifact/Ub4x3JemJK2pZ6NnbqLPbh).

### 7.3 Clima futuro (0 a 100)

Repetir 7.2 com o clima de 2041–2060. Para não herdar o erro dos modelos, usar o **método do delta**: calcular, mês a mês, quanto a chuva e a máxima mudam entre 1995–2014 e 2041–2060 em cada modelo do CMIP6, e aplicar essa mudança à série observada da NASA. Nota = média de 3 a 5 modelos, cenário SSP2-4.5; mostrar também a faixa entre modelos.

### 7.4 Saúde do solo (0 a 100)

Nota relativa entre as opções, a validar com a agrônoma:

| Opção | Palhada (até 40) | Nitrogênio (até 30) | Quebra de pragas (até 30) | Total |
| --- | --- | --- | --- | --- |
| Pousio | 0 | 0 | 0 | 0 |
| Milho safrinha | 20 | 0 | 0 | 20 |
| Sorgo | 20 | 0 | 15 | 35 |
| Milho + braquiária | 40 | 0 | 10 | 50 |
| Milheto | 35 | 0 | 20 | 55 |
| Crotalária | 25 | 30 | 30 | 85 |

Se o produtor marcar nematoide = sim, a coluna de pragas vale 1,5 vez e o total é reescalado para 0 a 100.

### 7.5 Renda (0 a 100)

Sem preço, custo nem produtividade: nenhum valor em reais entra na conta (tarefa 0040, seção 1 da remodelagem). Quem dá grão para vender (milho safrinha, sorgo e milho + braquiária: `tipo` `grao` ou `consorcio` no `culturas.yaml`) tem a renda que o clima deixa colher: **nota de renda = segurança climática da própria opção** (anos sem aperto ÷ anos simulados × 100; no cenário seco do plano, só os anos secos). Quem não dá grão (milheto, crotalária e o pousio no plano) fica com uma nota fixa, hoje **0** (como a coluna Renda da seção 5): é investimento na terra, e isso conta no eixo do solo. A nota final continua com os mesmos eixos e pesos (7.6). Os números ficam no grupo `renda` do `regras.yaml` (`tipos_com_grao`, `nota_sem_grao`), hipótese do time a revisar. Na tela, a renda mostra só fatos (RF-21). A margem esperada e a perda de produtividade pelo ISNA (0%, 30% e 60%) saíram.

### 7.6 Nota final e explicação

Nota final = soma de (peso × nota) nos quatro eixos. **O pousio fica fora do ranking** e aparece como linha de base ("como é hoje"): com segurança e futuro 100, ele subia na lista no perfil de menos risco, o que seria uma recomendação ruim. O produtor não vê a nota de 0 a 100; vê rótulos:

| Eixo | Bom | Médio | Fraco |
| --- | --- | --- | --- |
| Chuva | 17 a 20 anos sem aperto | 12 a 16 | menos de 12 |
| Renda (nota de renda, antes "Dinheiro") | 70 ou mais | 30 a 69 | menos de 30 |
| Terra (nota de solo) | 50 ou mais | 20 a 49 | menos de 20 |

Limiares em `regras.yaml` (hipótese do time). Cada nota gera uma frase por modelo de texto:

- Segurança: "Em {n} dos últimos {N} anos, o florescimento de {opção} semeado em {data} ficou com falta de água (GPM IMERG + NASA POWER)."
- Futuro: "No clima de 2041–2060 (NEX-GDDP-CMIP6), isso subiria para {m} em {N} anos."
- Solo: "Deixa {palhada} de palhada e {n} kg/ha de nitrogênio; {quebra ou não} o ciclo do nematoide."
- Histórico: "Seu talhão ficou em pousio em {k} das últimas {K} entressafras (NDVI do MODIS)."

### 7.7 Planos de rotação de 3 anos

1. Gerar as 6 × 6 × 6 = 216 sequências de entressafra.
2. Descartar: opção fora da janela; mais de 2 pousios seguidos; se nematoide = sim, 3 anos sem crotalária ou milheto.
   Cenário **ano seco**: a mesma conta usando só os 4 anos mais secos da série (menor chuva de fevereiro a abril).
3. Nota do plano = média das notas finais dos 3 anos + bônus de diversidade (+5 se tiver 2 funções diferentes, +10 se tiver 3: grão, cobertura gramínea, cobertura leguminosa).
4. Mostrar o melhor plano (ano normal e ano seco) e, ao lado, a sequência atual do produtor (soja/milho ou soja/pousio) para comparação.

> **A sugestão é o ano 1 (remodelagem, RF-30, tarefa 0044).** O plano do ano normal (Plano A) é o melhor entre as sequências que começam pela melhor opção; o do ano seco (Plano B) continua livre. Para cada objetivo do produtor (mais segurança, renda, cuidar da terra), o motor monta também a ordem das opções (nota do eixo, desempate pela nota final) e um plano que começa pela 1ª dessa ordem, com a média da nota do eixo + o mesmo bônus de diversidade e sem o pousio (com segurança 100, o pousio ganharia o "mais segurança" sem ter lavoura). Na fazenda da UFU, o Plano A não mudou em nenhuma faixa de colheita.

### 7.8 Histórico do talhão pelo NDVI

Para cada ano, olhar o NDVI (já com o fator 0,0001) entre 1º de abril e 31 de julho (entressafra). Se o maior valor passar de 0,6, houve segunda safra ou cobertura; se ficar abaixo de 0,45, pousio; entre os dois, "incerto". Limiares a calibrar olhando 5 talhões conhecidos da região. Estudos da Embrapa já usaram séries do MODIS para separar soja-milho, soja-milheto e soja-pousio no Cerrado, com acurácia de 84% a 100% nessas classes ([Embrapa, 2021](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1135867/1/Big-Earth-Observation-Data-e-aprendizado-de-maquina-2021.pdf)).

> **Soja de cada ano e safras confirmadas (decisão de 15/11/2026, RF-25, tarefa 0039).** Os anos vão de 2017 a 2026 (10 anos; a entressafra de 2026 já aconteceu). Antes da regra acima, o ano precisa mostrar a soja, como na região (RF-23): maior NDVI de 1/jan a 15/mar de 0,70 ou mais e, depois do pico, até 15/mai, alguma imagem com 0,40 ou menos (a colheita). A entressafra usa só as imagens depois da colheita até 31/jul, e não mais a janela fixa a partir de abril (que pegava a soja tardia ainda verde). Sem a soja, o ano é "sem soja" e fica fora das contas: com os dados reais, um ponto urbano de Uberlândia, que saía "parado em 10 de 10", passa a "sem soja", e um ponto de cana ou pasto, que saía "plantou", fica quase todo "sem soja". Nas 3 últimas entressafras, o produtor confirma o que fez, e a resposta dele vale no lugar do satélite naquele ano (inclusive na frase do "Por quê?"). Números no `regras.yaml` (grupos `historico_ndvi` e `regiao_ndvi`), hipótese do time a revisar pela agrônoma.

### 7.9 Faixa de colheita sugerida pelo NDVI (novo na v3)

Em cada ano, a primeira imagem de janeiro a março em que o NDVI cai abaixo de 50% do pico do verão marca a soja secando. A mediana dos anos (contada num ano comum, arredondada para baixo) é o dia sugerido, que já vem no campo de data da pergunta 2; a faixa (`cedo`, `meio`, `tarde`) sai desse dia pela regra da RF-02 (tarefa 0042: antes, o limite do meio era 22/fev e a tela chamava o mesmo dia de "tarde"). Com menos de 5 anos válidos, usar `meio`, sem dia. Como o MOD13Q1 é de 16 dias, o dia é uma estimativa: o produtor corrige no campo.

### 7.10 Sinal para o outono (novo na v3.1)

Hipótese a calibrar antes de publicar (detalhe no plano de evolução, ajuste A2):

- **Seco:** GEOS-S2S com chance de chuva abaixo do normal em março a maio ≥ 50%, **ou** terra seca agora (SMAP `sm_rootzone_pctl` abaixo de 20 e chuva dos últimos 30 dias pelo IMERG abaixo de 60% da média).
- **Normal:** chance de chuva abaixo do normal < 33% **e** terra sem falta de água.
- **Incerto:** qualquer outro caso.
- **Regra do dia de plantar:** se no dia da semeadura (até a data limite da cultura) a terra estiver seca pelo mesmo critério do SMAP, usar o Plano B.
- **Validação:** rodar a regra nas previsões retrospectivas do GMAO para os anos da série e publicar na tela 9 em quantos anos o sinal teria acertado o ano seco. Com acerto baixo, a tela mostra só a regra do dia de plantar.
- O Plano B é o melhor plano do cenário de ano seco da seção 7.7. A tela não usa El Niño como sinônimo de ano seco.

### 7.11 Totais para o pedaço de teste (saiu)

Saiu na tarefa 0040 (seção 1 da remodelagem): nenhum valor em reais no produto. O bloco "Comece por um pedaço" (hectares, sobra, custo da semente e pior ano seco) foi removido da tela 7, e a API não manda mais `margem_ha` nem `pior_ano_seco_ha`.

## 8. Arquitetura, modelo de dados e requisitos não funcionais

**Ideia central:** baixar e preparar os dados pesados **antes** (pipeline por célula de 0,1° na caixa do Triângulo, gravado no PostGIS) e fazer a conta **na hora**, no service. Assim a demo não depende da velocidade dos servidores da NASA e a resposta muda na hora quando o produtor troca a faixa de colheita. O detalhe (contratos da API, tabelas, camadas, pipeline e plano de horas) está no [plano técnico do backend](Raiz%20Orbital%20–%20plano%20técnico%20do%20backend.md).

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Pipeline (offline) | Scripts Python em `projeto/backend/pipeline/` (earthaccess, xarray, pyet, earthengine-api), grupo de dependências separado | Gera as séries por célula e os deltas do CMIP6 sem pesar a imagem da API |
| Banco | PostgreSQL 17 + PostGIS 3.5 (já no docker compose); uma linha por célula e ano, com arrays diários | Consulta única por talhão; ~15 MB para a caixa de Uberlândia e Uberaba |
| API | FastAPI em camadas (MVC + service/repository, TDD): `GET /api/talhao`, `GET /api/recomendacao`, `GET /api/exemplo` | Regra de negócio testável no service; GET com parâmetros na URL permite recarregar e compartilhar a resposta |
| Front-end | React + TypeScript + Vite, mapa com Leaflet e OpenStreetMap | Só desenha o que a API devolve; reordenar opções é no navegador |
| Hospedagem | Vercel (front), Render ou Railway (API), Neon ou Render (Postgres com PostGIS) | Link público, sem senha, no plano grátis |
| Código | GitHub público, licença MIT | Exigência da entrega e transparência |

### Modelo de dados (PostGIS)

| Tabela | Campos |
| --- | --- |
| `grid_cell` | id, geom (polígono 0,1°), center |
| `climate_season` | cell\_id, year, start\_date, rain\_mm[], rain\_source, tmax\_c[], tmin\_c[], eto\_mm[] (1/jan a 31/jul) |
| `cmip6_delta` | cell\_id, model, scenario, month, rain\_pct, tmax\_c |
| `soil_point` | key, geom, clay\_pct, sand\_pct, texture (cache do SoilGrids) |
| `ndvi_point` | key, date, ndvi (cache do Earth Engine) |
| `data_run` | source, params, finished\_at (versão dos dados mostrada na tela) |
| `culturas.yaml` e `regras.yaml` | Parâmetros da seção 5 e limiares da seção 7, com fonte ao lado de cada número |

### Requisitos não funcionais

| ID | Requisito | Meta |
| --- | --- | --- |
| RNF-01 | Tempo da primeira resposta | recomendação em menos de 1 s; dados do talhão (NDVI, solo) em até 10 s, buscados enquanto o produtor responde a pergunta 2; fazenda de exemplo instantânea |
| RNF-02 | Recálculo ao mexer nos pesos | menos de 1 s, no navegador |
| RNF-03 | Idioma | inglês para os juízes, português para o produtor |
| RNF-04 | Responsivo e leitura | mesmo site no celular (a partir de 360 px) e no computador (até 1440 px, conteúdo limitado a 1120 px); uma pergunta por tela; texto a partir de 15 px; botões de 48 px ou mais; botão "Ouvir"; resposta da API pequena (gzip) para sinal fraco |
| RNF-05 | Transparência | toda nota com fórmula, fonte e incerteza visíveis; aviso "apoio à decisão, não substitui o agrônomo" |
| RNF-06 | Privacidade | sem cadastro e sem dado pessoal; o talhão fica só na sessão |
| RNF-07 | Atribuição | citar NASA POWER, GPM IMERG, SMAP, MODIS, NEX-GDDP-CMIP6 e SoilGrids na tela "Sobre os dados"; não usar logotipo da NASA; mapa e busca de endereço com "© OpenStreetMap" visível (tarefa 0041) |
| RNF-08 | Segredos | credenciais do Earthdata e do Earth Engine fora do repositório |
| RNF-09 | Custo | tudo no plano grátis durante o hackathon |

## 9. Backlog e plano até a entrega

Time: **Rayanne** (produto, parâmetros, pitch e submissão), **Dev 1** (dados e motor), **Dev 2** (API, front-end e deploy).

### Backlog priorizado

| # | Tarefa | Quem | Estimativa | Pronto quando |
| --- | --- | --- | --- | --- |
| T-01 | Repositório público, `.env`, contas Earthdata e Earth Engine | Dev 1 | 30 min | todos rodam o projeto |
| T-02 | `culturas.yaml` e `regras.yaml` com as tabelas das seções 5 e 7 e a fonte de cada número | Rayanne | 1 h | revisado por alguém de agronomia, se possível |
| T-03 | Clima diário 2006–2025: POWER (todas as variáveis + ETo) para a caixa de Uberlândia e Uberaba | Dev 1 | 1,5 h | `climate_season` carregada no PostGIS |
| T-04 | Chuva IMERG Final para a caixa (ou plano B: chuva do POWER), em segundo plano | Dev 1 | 2 h | `rain_source = imerg_final` nas células |
| T-05 | Motor (services): balde, ISNA da janela crítica, aperto por ano, notas, rótulos, ranking sem pousio, alternativas e frases | Dev 1 + Dev 2 | 4 h | testes da seção 11 passam |
| T-06 | Deltas do CMIP6 (3 modelos, SSP2-4.5) e nota de futuro | Dev 1 | 2 h | nota de futuro para as 6 opções |
| T-07 | API: `/api/talhao`, `/api/recomendacao`, `/api/exemplo` (fixture) | Dev 2 | 2 h | JSON do plano técnico do backend para o exemplo |
| T-08 | Front responsivo: as 5 telas do caminho principal (mapa, colheita, satélite, resposta) + "Ouvir" | Dev 2 | 4 h | caminho completo no celular (390 px) e no computador (1280 px) com a fazenda de exemplo |
| T-09 | Plano de 3 anos (normal e seco) e todas as opções | Dev 2 | 2 h | telas 6 e 7 ligadas na API |
| T-10 | Histórico do talhão e faixa de colheita sugerida pelo NDVI do MODIS | Dev 1 | 2 h | `/api/talhao` devolve histórico e colheita sugerida |
| T-11 | Textos de explicação e tela "Sobre os dados" em inglês e português | Rayanne | 2 h | todas as frases da seção 7.6 |
| T-12 | Validação: comparar o risco calculado com a produtividade do milho 2ª safra de Uberlândia no IBGE (PAM) | Dev 1 + Rayanne | 1,5 h | gráfico "anos de aperto x anos de quebra" para o pitch |
| T-13 | Deploy front e API | Dev 2 | 1 h | links públicos funcionando em aba anônima |
| T-14 | Vídeo de 30 s com legenda em inglês e página do projeto | Rayanne | 3 h | submetido |

**Ordem de corte se o tempo apertar:** T-06 usa 1 modelo só; T-10 só na fazenda de exemplo (fixture); T-04 usa a chuva do POWER; T-09 sem plano seco. **Nunca cortar:** T-05, T-07 (com a fazenda de exemplo), T-08, T-12, T-13 e T-14.

**T-15 (Could):** tela "Na sua região" com dados simulados, só no front-end (Dev 2, 1 h), e 5 segundos dela no vídeo. Entra apenas depois de T-13 pronta.

**Novas na v3.1:**

| # | Tarefa | Quem | Estimativa | Pronto quando |
| --- | --- | --- | --- | --- |
| T-16 | Tela de cálculo em forma de missão (RF-19) | Dev 2 | 2 a 3 h | missão roda com o exemplo em uns 9 s e cai na tela 4; versão simples com reduced motion |
| T-17 | ~~Hectares para testar (RF-21): `custo_semente_ha` e `pior_ano_seco_ha` na API e o campo na tela 7~~ (saiu na tarefa 0040) | Dev 1 + Dev 2 | 2 a 3 h | trocar os hectares muda os três valores na hora |
| T-18 | Sinal para o outono (RF-20): GEOS-S2S no pipeline, regra da seção 7.10, campo `sinal` na API e o cartão Plano A / Plano B | Dev 1 + Dev 2 | 4 a 6 h | sinal aparece para o exemplo, com o motivo e a regra do dia de plantar |

**Corte das novas:** T-16 vira a lista simples com ✓ (a versão de reduced motion); T-18 fica só com a regra do dia de plantar (SMAP) e o sinal sai da tela; T-17 mostra só a sobra em reais.

### Plano de horas

| Bloco | Horário | Entregas |
| --- | --- | --- |
| 1 | sáb 10h–14h | T-01, T-02, T-03; esqueleto do front com mapa |
| 2 | sáb 14h–20h | T-04, T-05; API devolvendo o exemplo |
| 3 | sáb 20h–2h | T-06, T-08, T-11 |
| 4 | dom 2h–8h | T-09, T-10 (revezamento de sono) |
| 5 | dom 8h–14h | T-12 (validação com o IBGE: é a prova do critério Validade), T-13, testes de ponta a ponta; congelar funcionalidades |
| 6 | dom 14h–entrega | T-14, ensaio do pitch, revisão da submissão com 2 horas de folga antes do prazo |

## 10. Demo de 30 segundos, página do projeto e checklist de entrega

### Roteiro do vídeo (até 30 s, legenda em inglês)

Segue a divisão de tempo sugerida pelo guia de submissão.

| Tempo | Imagem | Fala (inglês) |
| --- | --- | --- |
| 0:00–0:02 | Time | "We are Raiz Orbital, from Uberlândia, Brazil." |
| 0:02–0:05 | Talhão em pousio na seca | "Every year, Cerrado farmers decide what to plant after soybeans, often guessing." |
| 0:05–0:10 | Logo do projeto e frase | "Raiz Orbital: NASA data to choose the rotation that protects your soil and your income." |
| 0:10–0:20 | Tela: marcar talhão, cartões, mexer no peso, plano de 3 anos | "We replay 20 years of NASA rainfall, soil moisture and satellite greenness, plus 2050 climate projections, to score each option." |
| 0:20–0:30 | Antes e depois: pousio x milho + braquiária | "Less risk, healthier soil, a plan the farmer can trust, starting with the Cerrado." |

### Campos da página do projeto (em inglês)

| Campo | O que escrever |
| --- | --- |
| Project Name | Raiz Orbital – Field Shift for the Brazilian Cerrado |
| High-Level Summary | O que é, para quem, como responde ao Field Shift e por que importa (5 a 6 frases) |
| Link to Project Demo | Vídeo de até 30 s, público |
| Link to Final Project | Site publicado + GitHub público |
| Detailed Description | Fluxo, motor de pontuação, limites, ferramentas e linguagens |
| NASA Data | POWER, GPM IMERG, SMAP L4, MODIS MOD13Q1, NEX-GDDP-CMIP6 (e HLS se entrar): o que cada um mede e como entra na nota |
| Space Agency Partner & Other Data | SoilGrids (ISRIC), Embrapa, ZARC/MAPA, Safras & Mercado, IBGE, OpenStreetMap, bibliotecas usadas |
| Use of AI | Declarar as ferramentas de IA usadas na pesquisa, no código e nos textos, e como foram usadas |

### Checklist antes de clicar em "Submit for Judging"

- [ ] Os três membros registrados e na página do time.
- [ ] Vídeo com 30 s ou menos e legenda em inglês (ou até 7 slides em inglês).
- [ ] Todos os links abrem numa aba anônima, sem senha.
- [ ] Dados da NASA descritos; todas as outras fontes nas referências.
- [ ] Uso de IA declarado; nenhuma imagem gerada por IA sem marca d'água; nenhum logo da NASA.
- [ ] Caixas de termos e "trabalho original" marcadas.
- [ ] Enviado com folga antes do prazo confirmado com a organização local.

## 11. Testes, riscos e fontes

### Critérios de aceite do MVP

- Um jurado abre o link, toca em "Ver um exemplo pronto" e vê a resposta em menos de 5 segundos.
- Um produtor marca o ponto, escolhe a faixa de colheita e chega à resposta com 2 respostas e no máximo 4 toques.
- Trocar a faixa de colheita muda a resposta (por exemplo, o milho sai da janela em "tarde").
- Cada nota mostra a frase "por quê" com o dado da NASA e o número.
- O plano de 3 anos aparece ao lado da sequência atual do talhão, em ano normal e em ano seco.
- A tela "Sobre os dados" lista fontes, limites e o aviso de apoio à decisão.

### Testes unitários obrigatórios

| Função | Entrada | Esperado |
| --- | --- | --- |
| `simular` | chuva 10 mm/dia, ETo 5, Kc 1, CAD 50 | ETr = ETc todos os dias; ISNA = 1 |
| `simular` | chuva 0, ETo 5, Kc 1, CAD 50, balde inicial 25 | ETr = 5 por 5 dias, depois 0; ISNA de 10 dias = 0,5 |
| aperto | ISNA crítico 0,50 | ano com aperto |
| aperto | ISNA 0,70 e 3 dias com 36 °C | ano com aperto (calor) |
| janela | colheita `tarde` (semeadura 3/mar), milho até 28/fev | milho "fora da janela" |
| pesos | 30/25/30/15 | soma 100; nota final = soma ponderada |
| planos | nematoide = sim | nenhum plano sem crotalária ou milheto nos 3 anos |
| planos | sem restrição | 216 combinações antes do filtro |
| ranking | qualquer entrada | pousio nunca é a "melhor opção" nem alternativa |
| rótulos | 17, 16 e 11 anos sem aperto | Bom, Médio e Fraco |
| explicação | resultado com 6 anos de aperto | a frase cita "6 dos últimos 20 anos" |
| NDVI | valor bruto 7100 | 0,71 depois do fator de escala |
| colheita sugerida | menos de 5 anos válidos | faixa `meio`, fonte `padrao` |

### Riscos

| Risco | Mitigação |
| --- | --- |
| Download do IMERG lento demais | Plano B com a chuva do POWER; IMERG só para a fazenda de exemplo |
| Earth Engine sem acesso a tempo | Plano B: NDVI via AppEEARS ou imagem estática do histórico; CMIP6 baixado de 1 modelo |
| Parâmetros das culturas errados | Fonte ao lado de cada número; marcar hipóteses na tela; validar com agrônomo da região |
| Escala do satélite maior que o talhão (chuva \~10 km, CMIP6 \~28 km) | Dizer isso na tela; o NDVI de 250 m ou 30 m é o único dado no nível do talhão |
| Jurado não entender o Cerrado | Primeiros 10 s do vídeo explicam o problema com uma imagem |
| Pesos parecem arbitrários | Mostrar a conta na tela "Como a conta é feita"; os pesos padrão são hipótese do time, a validar nas entrevistas |
| Produtor com pouca leitura não entende a tela | Uma pergunta por tela, ícone + palavra + cor, botão "Ouvir", resposta antes dos detalhes |

### Fontes

- [Judging & Awards Guide (Space Apps)](https://www.spaceappschallenge.org/resources/judging-awards-guide)
- [Project Submission Guide (Space Apps)](https://www.spaceappschallenge.org/resources/project-submission-guide/)
- [Descrição do desafio Field Shift (evento Sonoma State)](https://edeon.sonoma.edu/nasaspaceapps-26/)
- [Sistema de plantio direto e rotação no Cerrado (Embrapa, 2022)](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1149543/1/rsd-2022.pdf)
- [Rotação e nematoides (Revista Cultivar / Embrapa)](https://revistacultivar.com.br/noticias/rotacao-de-culturas-e-uma-das-indicacoes-para-controle-de-nematoides-fitoparasitos)
- [Consorcio de grãos com braquiária e soja seguinte (Revista Cultivar)](https://revistacultivar.com.br/noticias/consorcio-de-graos-com-forrageiras-controla-plantas-daninhas-na-soja)
- [Zoneamento do sorgo e semeadura mais tardia (Notícias Agrícolas / Embrapa)](https://www.noticiasagricolas.com.br/noticia/292308)
- [Crotalária spectabilis: nitrogênio e biomassa (Aegro)](https://aegro.com.br/tags/crotalaria-spectabilis/)
- [MODIS para separar sistemas de cultivo (Embrapa, 2021)](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1135867/1/Big-Earth-Observation-Data-e-aprendizado-de-maquina-2021.pdf)
- [NEX-GDDP-CMIP6 no Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/NASA_GDDP-CMIP6)
- [SMAP L4 no Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/NASA_SMAP_SPL4SMGP_008)
- [GPM IMERG (NASA Earthdata)](https://www.earthdata.nasa.gov/data/catalog/ges-disc-gpm-3imergdl-07)
- [NASA POWER](https://power.larc.nasa.gov/)
- [Portaria SPA/MAPA nº 388/2025: ZARC milho 2ª safra MG 2025/26](https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/2025-2026/minas-gerais-mg/POF5FF1.PDF)
- [Estudo de caso do ZARC do milho em Uberlândia (TCC, UFU)](https://repositorio.ufu.br/bitstream/123456789/38140/1/EstudoCasoZoneamento.pdf)
- [Plano técnico do backend](Raiz%20Orbital%20–%20plano%20técnico%20do%20backend.md)
- [Portaria ZARC soja Minas Gerais 2026/27](https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/safra-vigente/minas-gerais/PORTN200SOJAMG.pdf)
- [Preço do milho em Uberlândia (Safras & Mercado)](https://safras.com.br/?p=90328)
- [Doc 5: critérios dos eventos climáticos e business plan](https://claude.ai/artifact/Ub4x3JemJK2pZ6NnbqLPbh)
- [Discovery do público e das dores](https://claude.ai/artifact/G3DVwtrQ6RCVSA7jTKQidD)
