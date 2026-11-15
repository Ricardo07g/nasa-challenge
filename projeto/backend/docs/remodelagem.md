# Remodelagem do produto (iniciada em 15/11/2026)

Pedido do usuário: `arquivos contexto/prompt-raiz-orbital.md` (9 seções). Este arquivo é o roteiro, o
estado de cada entrega, o registro das decisões e a revisão. Quem trabalhar numa seção lê o pedido
inteiro (as "Regras gerais" valem para todas), os `AGENTS.md` e esta página.

## Como trabalhamos

- **Uma branch e um PR só, sem merge** (pedido do usuário, 15/11 ~02:10): tudo entra em `feat/remodelagem`;
  o PR para o `main` fica aberto para o usuário revisar e decidir. Cada seção é uma branch
  `feat/remodelagem-sN-...` criada de `feat/remodelagem` e juntada nela com merge, sem PR próprio.
- **Ordem do pedido, uma entrega por seção.** No máximo duas seções em paralelo, só quando não mexem
  nos mesmos arquivos (coluna "Junto com").
- **TDD e camadas** como em todo o repositório. Cada seção tem a tarefa em `docs/tarefas/` (número abaixo)
  e o requisito no PRD no mesmo PR.
- **Só dados que já temos** (banco e `data/baixados/`). Sem dado para o ponto, o elemento não aparece.
- **Revisão de cada seção** depois do merge: testes, telas no Chrome sem interface (pt e en, celular e
  computador) e a lista de itens do pedido marcada aqui (✅ feito, ⚠️ feito com ressalva, ❌ não feito e
  por quê).

## Roteiro

| # | Seção do pedido | Tarefa | O que entra | Junto com | Estado |
| --- | --- | --- | --- | --- | --- |
| S1 | 1. Valores em reais (e a regra geral de esconder "Ainda não conectado") | 0040 | nota de renda sem preço nem custo no motor (`regras.yaml`), "Renda" com fatos, nenhum R$ na API nem no front, selos "Ainda não conectado" escondidos, "Como a conta é feita" | S8 | ✅ na branch (15/11 ~02:10), revisada |
| S8 | 8. Guia | 0048 | `/guia` e `/guia/<artigo>`, artigos em Markdown pt/en (primeiro os da lista prioritária), busca por título, imagens das plantas (SVG próprio) | S1 | feito na branch `feat/remodelagem-s8-guia` (19 artigos em pt e en; faltam 7 do tema, ver a tarefa 0048) |
| S2 | 2. Onde fica a lavoura | 0041 | busca com autocompletar (Photon/OSM), coordenadas e link do Google Maps colados, "Confirmar local" com pin, endereço aproximado, limite da área piloto e bloqueio fora dela | S3 | ✅ na branch (15/11 ~02:17), revisada |
| S3 | 3. Quando você colhe | 0042 | data exata + "Não sei o dia exato", sugestão = seleção, chuva que sobra (mediana e ano seco), chuva × ETo por mês, custo do atraso, fim das chuvas | S2 | ✅ na branch (15/11 ~02:57), revisada |
| S4 | 4. O que o satélite viu (raio-X) | 0043 | painel escuro com 8 blocos, histórico em faixa de calor do NDVI, alertas (geada, chuva forte, fogo: MCD64A1 na ORNL ou índice substituto), cartões menores | — | ✅ na branch (15/11 ~04:00), revisada; extração completa do MCD64A1 rodando |
| S5a | 5. Abas: objetivo, Sugestão e Água | 0044 | abas Sugestão / Comparar / Plano, seletor "O que você quer mais?", linha Água e sede da cultura, explorador ano a ano (substitui `/safra-passada`), "Como fazer" em 4 partes, aviso único da colheita tarde, sem relatório | — | a fazer |
| S5b | 5. Comparar e Plano de 3 anos | 0045 | Comparar (até 3 culturas, colunas, "Usar no meu plano"), Plano editável com notas na hora, saúde da terra da rotação, chuva aproveitada, "Como é hoje" com o NDVI e a confirmação, Plano A/B com número derivado da série, sem "Comece por um pedaço" | — | a fazer |
| S6 | 6. Avisos | 0046 | `/avisos` com contador, grupos Agora / O que mudou / Fora do comum / Perto de você, POWER recente com cache de 24 h, rodapé "Alertas oficiais" | S7 | a fazer |
| S7 | 7. Comunidade | 0047 | relatos (plantio, chuva, evento) sem cadastro, tabela `community_report`, endpoints, mapa de 30 km, resumo "Perto de você" | S6 | ✅ na branch (15/11 ~03:10), revisada |
| S9 | 9. Consistência e revisão final | 0049 | missão com as fontes certas, "Como a conta é feita" com as regras novas, nenhum link para telas removidas, lista final do pedido | — | a fazer |

Ordem de merge: S1 → S8 → S2 → S3 → S4 → S5a → S5b → S6 → S7 → S9. Se a janela de uso acabar, a
retomada automática continua da primeira seção não terminada (arquivo de retomada do orquestrador).

## Decisões (registro)

Cada decisão tomada sem o usuário entra aqui, com o porquê. Decisões de produto ficam "a revisar".

| # | Data | Decisão | Por quê |
| --- | --- | --- | --- |
| D1 | 15/11 | A S8 (Guia) roda junto da S1 e sai antes das outras telas. | É conteúdo em arquivos próprios, sem conflito, e as outras seções linkam para os artigos. |
| D2 | 15/11 | "Esconda todos os selos 'Ainda não conectado'" (regra geral do pedido) substitui a regra do `projeto/frontend/AGENTS.md` que mandava mostrar o selo. Feito na S1, com o AGENTS do front atualizado no mesmo PR. | O pedido é a decisão mais recente do usuário. |
| D3 | 15/11 | Busca de endereço pelo **Photon** (komoot, OpenStreetMap, sem chave), com espera de ~400 ms entre teclas e uma busca por vez; endereço aproximado do pin pelo *reverse* do Photon; atribuição "© OpenStreetMap". | Feito para autocompletar e sem cadastro; uma fonte só para buscar e para o endereço. |
| D4 | 15/11 | Imagens das plantas: ilustrações próprias em SVG, simples, feitas no repositório. | O pedido proíbe IA sem marca d'água; SVG próprio não tem licença a conferir. |
| D5 | 15/11 | O histórico usa **2017–2026** (10 anos até a entressafra mais recente, decisão de 15/11, tarefa 0039), não 2016–2025 como está escrito na seção 4. | Decisão mais recente do usuário. |
| D6 | 15/11 | O Guia (S8) é escrito com o modelo Sonnet; as seções de código, com o modelo padrão. | Poupa a janela de uso no trabalho de texto, sem perder a revisão (o orquestrador revisa). |
| D8 | 15/11 | Tudo numa branch (`feat/remodelagem`) e num PR sem merge; as telas são revisadas num segundo ambiente local (API na porta 8001 e front na 5174, a partir do worktree da branch), sem mexer no checkout que o Docker do usuário usa. | Pedido do usuário; o checkout principal segue no `main`, que ele usa para testar. |
| D7 | 15/11 | O orquestrador não consegue ler o percentual da janela de 5 horas. Mitigação: no máximo 2 subagentes ao mesmo tempo, entregas pequenas e commitadas, e a retomada automática a cada 30 min continua depois que a janela libera. | Não há ferramenta que mostre o uso; o que dá para garantir é não perder trabalho. |
| D9 | 15/11 | O Guia tem 19 artigos em pt e en: os 12 prioritários e 7 de apoio (palhada, adubo verde, nematoide, geada, El Niño e La Niña, calor de 35 °C, clima de 2041 a 2060). Faltam 7 (plantio direto, sementes, plantar logo depois da colheita, erosão, quando a chuva acaba, raio-X, fogo na palha). | Os que faltam dependem de uma fonte conferida ou de telas das seções 3 e 4, ainda não feitas; é melhor faltar artigo do que citar o que não foi aberto. |
| D10 | 15/11 | Todo link externo dos artigos precisa estar em `src/content/guia/verifiedSources.ts` (data e o que a página confirma); um teste barra qualquer outro. | Garante a regra "só cite página que você abriu". |
| D11 | 15/11 | Artigos de cultura, plantio e manejo, e também os de geada, conta de água e palhada, saem como rascunho (`rascunho: sim`); a view põe "Rascunho: a revisar pela agrônoma." no topo. | Pedido do usuário; os números são hipótese do time. |
| D12 | 15/11 | O Markdown vira uma árvore de blocos (`markdownService`) e a view desenha com React: nunca há `dangerouslySetInnerHTML`, e HTML no texto vira texto puro. | Segurança sem biblioteca nova. |
| D13 | 15/11 | O Guia usa o requisito RF-26 do PRD. | Próximo RF livre no PRD. Se outra seção também pegar o RF-26, renumerar na hora do merge. |
| D14 | 15/11 | Nota de renda (S1): quem dá grão tem a segurança climática da própria opção (anos bons ÷ total × 100; no cenário seco, só os anos secos); cobertura e pousio ficam com `renda.nota_sem_grao` = 0. Mesmos eixos e pesos na nota final. **A revisar.** | É a proposta do pedido; o PRD 5 já dava renda 0 às coberturas, e uma nota maior faria a cobertura subir duas vezes (ela já ganha no eixo do solo). |
| D15 | 15/11 | "Dá grão" = `tipo` `grao` ou `consorcio` do `culturas.yaml` (`renda.tipos_com_grao`): o milho com braquiária dá grão. | PRD 5: "Grão + cobertura"; a lista fica no `regras.yaml` para a agrônoma mudar. |
| D16 | 15/11 | Saem do `culturas.yaml` e do `CropParams` o preço, o custo e a produtividade, e do motor a perda de produtividade pelo ISNA (`perda_*`, `fator_perda`). | Nada mais usava depois da margem; o pedido manda remover o que ficar sem uso. |
| D17 | 15/11 | Contrato: `dinheiro` vira `renda` (`da_grao`, `anos_aperto`, `rotulo`, `texto`, `risco`), o motivo `mais_dinheiro` vira `mais_renda` e os rótulos `dinheiro_*` viram `renda_*` (os mesmos 70 e 30). O selo Bom/Médio/Fraco da renda ficou. | A dimensão mudou de nome e o nome fica igual em toda a pilha; o selo mantém o cartão como está até a S5a redesenhar as linhas. |
| D18 | 15/11 | "Ainda não conectado" saiu do design system (`NotConnected`, `NotConnectedCard` e o `status="unavailable"`), não só das telas; o estado interno `not-connected` dos controllers ficou. | Garante que nenhuma tela volte a mostrar o selo; o estado interno ainda separa "endpoint que não existe" de erro. |
| D19 | 15/11 | D2 elemento a elemento: sem histórico do satélite, a tela 4 mostra só "Confirme as últimas safras"; na missão, a fase sem dado fica sem resultado; no relatório, as seções sem dado somem e a célula do clima futuro vira "—"; em "Como a conta é feita", só as fontes ligadas; na comunidade com a API real, os blocos dos vizinhos não aparecem. | "O elemento sem dado não aparece" (D2); a 5.6 do pedido manda perguntar direto quando não há NDVI. A comunidade é refeita na S7. |
| D20 | 15/11 | O bloco "Comece por um pedaço" saiu inteiro já na S1 (a S5b também previa). | É todo em reais (hectares × sobra, semente e pior ano seco). |
| D21 | 15/11 | Limites da área piloto numa fonte só (S2): `GET /api/area-piloto` devolve os `PILOT_*` do `app/constants.py` e o front lê a rota, sem repetir os números (só o mock, que imita a API). Nenhum RF novo: o RF-01 foi reescrito. | Não acopla o build do front aos arquivos do backend (o container do front só monta `projeto/frontend`); mudar a caixa é mudar só as constantes. |
| D22 | 15/11 | Enquanto a área piloto carrega, o "Confirmar local" espera; se ela não carregar (API fora do ar), a tela deixa seguir. | O backend continua respondendo `OUTSIDE_AREA` nas telas seguintes; travar o fluxo por uma rota auxiliar não protege nada a mais. |
| D23 | 15/11 | Photon em pt com `lang=default` (nomes locais); em en, `lang=en`. | O Photon não aceita `pt` (400, conferido em 15/11) e, no Brasil, os nomes locais já são em português. |
| D24 | 15/11 | A preferência da busca é o centro da área piloto (`lat`/`lon`), não o `bbox`. | O `bbox` corta os lugares de fora, e a pessoa precisa achar o lugar dela mesmo fora da área para ver o aviso. |
| D25 | 15/11 | Coordenadas e link colados viram uma opção da lista ("Ir para as coordenadas" / "Ir para o ponto do link"), escolhida com Enter ou toque, e não um salto automático do mapa. | Enquanto a pessoa digita, "-18.95, -4" já é um par válido: pular a cada tecla levaria o mapa para o lugar errado e dispararia o endereço aproximado à toa. |
| D26 | 15/11 | No link do Google Maps, o pino do lugar (`!3d`/`!4d`) vale mais que `q`/`query`/`ll`, que valem mais que o caminho `/maps/search/` e o centro do mapa (`@`). Link curto não é aberto: a tela pede o link completo ou as coordenadas. | O `@` é o centro da tela de quem copiou, não o lugar marcado; o link curto só abre com um redirecionamento que o navegador não pode seguir. |
| D27 | 15/11 | Endereço aproximado: enquanto o *reverse* não chega, ou se falhar, aparece a cidade de referência mais perto (lista que já existia no front). | O "Perto de…" nunca some, mesmo sem rede ou com o Photon fora do ar. |
| D28 | 15/11 | Botão "Ver a área inteira" na legenda do mapa: afasta o mapa até a área caber, sem tirar o alfinete do ponto. | No zoom de marcar a lavoura (12), a caixa de 1,5° fica fora da tela: sem o botão, o limite desenhado quase nunca seria visto. |
| D29 | 15/11 | O aviso "Por enquanto só temos dados da região de Uberlândia e Uberaba." entrou numa chave nova (`where.outsideNotice`); o `where.outsideText`, usado pelas telas 4 a 7 (`FlowStates`), ficou igual. | Mudar o texto antigo mexeria em telas e testes da S1 e da S4. |
| D30 | 15/11 | No modo `mock` (e nos testes), a busca e o endereço aproximado são de exemplo (6 cidades, sem rede), escolhidos em `repositories/index.ts` como os outros dados. | Nenhum teste pode chamar o Photon de verdade, e as telas abertas nos testes de rota usam os repositories padrão. |
| D31 | 15/11 | A regra das faixas da tela 3 (até 10/fev, e janeiro, cedo; 11 a 20/fev meio; depois, tarde) foi para o `regras.yaml` (grupo `colheita`) e vale também para a faixa sugerida pelo NDVI; saiu o limite de 22/fev (`MID_HARVEST_DOY_LIMIT`) do backend. | Sugestão = seleção: com 22/fev, o satélite dizia "meio" para um dia que o campo de data chamava de "tarde". A regra é a que a tela e os rótulos ("dia 11 a 20") já usavam. |
| D32 | 15/11 | O dia sugerido é a mediana dos dias de queda do NDVI, contada num ano comum (29/fev = 28/fev) e arredondada para baixo; a faixa sai do dia. | O campo de data precisa de um dia que existe, e o mesmo dia não pode cair em faixas diferentes no backend e no front. |
| D33 | 15/11 | A faixa da URL (voltando da tela 4 ou o `colheita=meio` do "Ver um exemplo pronto") continua valendo mais que o dia do satélite; aí o campo fica vazio, a faixa azul não diz "já deixamos" e oferece "Usar o dia do satélite". O dia exato não vai para a URL. | Era a causa da inconsistência da faixa azul. Mantém a escolha de quem volta da tela 4 sem a faixa azul mentir, e não mexe no `flowParams` (comum a todas as telas). |
| D34 | 15/11 | Chuva que sobra, ETo de cada mês e fim das chuvas vão no `/talhao`; o custo do atraso é um endpoint novo, `GET /api/custo-atraso`. | As três primeiras são contas leves da mesma série; o custo roda o motor 3 vezes (~1 s) e deixaria lento o `/talhao`, pedido já na tela 2. |
| D35 | 15/11 | "20 dias seguidos com menos de 10 mm" = a soma dos 20 dias abaixo de 10 mm. | Com 10 mm por dia, quase todo dia de março já "acabaria" a chuva; a soma pega o fim do período chuvoso. |
| D36 | 15/11 | Fim das chuvas: mediana arredondada para baixo (num ano comum); se algum ano não tem fim dentro da série (até 31/jul), o bloco não aparece. | "Em metade dos anos, a chuva acabou até [data]" continua verdade; sem o fim de um ano, a mediana e o mais tarde sairiam errados. |
| D37 | 15/11 | Ano seco = percentil 20 com interpolação linear entre os anos ordenados (o padrão do numpy); a frase diz "em média" (texto do pedido), e a legenda explica que é a mediana e o que é o ano seco ("só 20% dos anos tiveram menos chuva"). | É o texto pedido; a legenda deixa claro o número. |
| D38 | 15/11 | Só com a faixa ("Não sei o dia exato"), a chuva que sobra usa o dia de colheita da faixa no motor: 5/fev, 15/fev e 28/fev. | PRD 7.1: semeadura = colheita + 3 dias (08/02, 18/02 e 03/03); é o mesmo dia da conta da recomendação. |
| D39 | 15/11 | A ETo de cada mês é a do motor (`ClimateRiskService.reference_eto`: a gravada, POWER com FAO-56, ou Hargreaves-Samani), e o mês em destaque, o primeiro em que a chuva média fica menor que a ETo média, sai do backend (`mes_chuva_abaixo_eto`). | O mesmo número da conta de água; a regra fica num lugar só. |
| D40 | 15/11 | Gráficos: a chuva que sobra é uma curva de 15/jan a 31/mar (mediana em linha cheia, ano seco tracejado, marca no dia escolhido); a chuva × ETo tem a chuva cheia e o gasto listrado, e o mês em destaque ganha contorno e o texto "chove menos". | Nenhuma informação só por cor; a curva mostra que cada dia de atraso tira chuva. |
| D41 | 15/11 | Os dois artigos novos do Guia ("Quando a chuva acaba", sem rascunho por ser de clima e dados; "Plantar logo depois da colheita", rascunho por ser de plantio) citam só páginas já na lista conferida, reabertas em 15/11. | Regra do Guia: só fonte aberta e conferida; números só do `regras.yaml`, `culturas.yaml` e PRD. |
| D42 | 15/11 | S7: o relato de plantio não tem data do fato; o ano da safra vai em `valores.ano` e precisa ser uma das últimas safras (`FieldHistoryService.confirmable_years()`, as mesmas da tela 4: 2024, 2025 e 2026). A resposta traz `anos_safra` para o front. | Uma fonte só para "as últimas safras"; plantar depois da soja não é um fato de um dia. |
| D43 | 15/11 | "Deixei parado" é o `pousio` do `culturas.yaml` (não um valor novo) e não pergunta "Como foi" nem o motivo. A lista do plantio é: as 6 culturas do `culturas.yaml` e "outra". | O pedido diz "as do `culturas.yaml`, mais 'outra' e 'deixei parado'", e o pousio já é o "deixar a terra parada"; "foi bem" não faz sentido para a terra parada. **A revisar.** |
| D44 | 15/11 | Hash do aparelho: HMAC-SHA-256 com o sal `COMMUNITY_DEVICE_SALT` (só o nome no `.env.example`). Sem sal configurado, a API usa um sal aleatório por processo, com aviso no log, em vez de recusar os relatos ou de usar um sal fixo no código. | Funciona no ambiente local sem configuração e nunca guarda hash sem sal; o custo é o limite por dia e o "apagar o meu" recomeçarem quando a API reinicia. Em produção, configurar o sal. |
| D45 | 15/11 | O limite de 10 relatos por aparelho vale para as **últimas 24 horas** (janela que corre), não para o dia do calendário. | Evita 20 relatos em volta da meia-noite. O número é hipótese do time (`regras.yaml`). |
| D46 | 15/11 | O "hoje" das datas dos relatos é o dia de Uberlândia (UTC−3 fixo, `PILOT_UTC_OFFSET_HOURS`), não o do servidor. | O servidor roda em UTC; às 22 h no Brasil já seria amanhã e a data de hoje sairia como "30 dias" errados. O Brasil não tem horário de verão desde 2019. |
| D47 | 15/11 | Um novo relato de plantio do mesmo aparelho e da mesma safra substitui o anterior. | O "Compartilhar com a comunidade" pode ser tocado de novo, e "N vizinhos contaram" não deve contar o mesmo aparelho duas vezes no mesmo ano. |
| D48 | 15/11 | Sem banco (`DATABASE_URL` vazia), as três rotas respondem 503 `COMMUNITY_UNAVAILABLE` (problem+json); o front trata como `not-connected` e não mostra nem o "Conte" nem a redondeza. Mais de 10 relatos: 429 `TOO_MANY_REPORTS`. | Mesma regra do D2: o que não está ligado não aparece. Os relatos precisam do banco; guardar em memória perderia tudo a cada reinício. |
| D49 | 15/11 | Ponto fora da área piloto é recusado (422), e o raio da listagem vai até 50 km (`raio_max_km`, hipótese do time). | Mesma área das outras telas; a consulta não varre a caixa inteira. |
| D50 | 15/11 | Só conta quem marcou a própria lavoura: sem ponto na URL ou na fazenda de exemplo, a tela mostra a redondeza e pede "Marcar minha lavoura". No "Compartilhar" da tela 4, idem. | "O relato vale para o ponto marcado"; a fazenda de exemplo não é a lavoura de ninguém. |
| D51 | 15/11 | O aparelho vai no cabeçalho `X-Aparelho` (não na query); a listagem marca `meu` comparando o hash e nunca devolve o hash, a hora do envio nem o ponto exato (só a célula e o centro dela). | O cabeçalho não vai para o log de acesso; a hora exata junto da célula ajudaria a achar quem enviou. |
| D52 | 15/11 | Tela: o resumo de plantio usa a safra mais recente com relatos; a chuva é a média dos relatos de hoje e dos 6 dias anteriores; o selo "Exemplo" vai em cada linha do resumo que tem algum relato de exemplo e em cada evento. Mapa: etiqueta com ícone e número por tipo, legenda em texto e a lista completa para o leitor de tela; abre enquadrando o círculo de 30 km. | Etiquetas com o texto inteiro se sobrepunham no celular (células a ~10 km); o nome de cada ícone fica na legenda, então nada depende só de cor. |
| D53 | 15/11 | i18n só com acréscimos no bloco `community`; as chaves da comunidade simulada ficaram (a página `/design-system` ainda usa algumas). O RF novo é o RF-28; se outra seção também pegar o RF-28, renumerar no merge (como no D13). | Regra de só acrescentar com a S3 rodando em paralelo. |
| D54 | 15/11 | Migração `3f7c2a9d4e81` revisa a `6e961f333ddc`. Se outra seção criar migração com a mesma base, o merge deixa duas cabeças no Alembic: a segunda a entrar passa a revisar a outra. O teste antigo da R1.6 passou a descer até a migração inicial (não mais `downgrade -1`). | O `alembic upgrade head` falha com duas cabeças; melhor resolver no merge do que travar as seções. |
| D55 | 15/11 | O raio-X é um endpoint novo, `GET /api/raio-x?lat&lon[&colheita][&solo][&confirmadas]`, e não campos do `/talhao`. | Ele roda o motor uma vez (a melhor opção vai no bloco da água e no cartão dos 20 anos), ~0,5 s na UFU; o `/talhao`, pedido já na tela 2, continua leve (mesmo motivo do D34). |
| D56 | 15/11 | A tela 4 pede o raio-X sem as safras confirmadas; a faixa de calor junta o NDVI do raio-X com o histórico do `/talhao` já com as respostas do produtor (no front). | Confirmar uma safra não recarrega o painel (o mesmo do talhão, tarefa 0039); as confirmações só mudam a frase do "Por quê?", não a melhor opção do motor. |
| D57 | 15/11 | "Aguenta cerca de N dias sem chuva na floração" = ⌊CAD ÷ (ETo média do motor nos dias da janela do aperto, floração ± 15 dias, nos 20 anos × `kc_pico`)⌋ da melhor opção do motor, arredondado para baixo. Vale também para a cobertura (floração estimada); no pousio, só a CAD. **A revisar.** | É a conta do pedido com os números do motor; arredondar para baixo não promete água que a terra não tem. |
| D58 | 15/11 | Célula sem solo: o raio-X usa o ponto gravado mais perto, de qualquer célula, até 15 km (`raio_x.solo_vizinho_max_km`), e diz a distância; o motor continua só com o solo da célula (ou o padrão). A CAD do bloco 2 é a do solo mostrado ou, se o produtor trocou a terra, a da escolha dele (a do motor). | Pedido da seção 4; mudar o solo do motor mexeria em todas as telas. Na caixa, 2 das 225 células não têm solo (ex.: −19,75 / −47,95 usa o ponto a 10,5 km). |
| D59 | 15/11 | Bloco 8: compara só células da caixa com a mesma fonte de chuva (IMERG) e com a janela inteira; diz "mais seca que X%" quando a maioria chove mais e "mais chuvosa que Y%" quando a maioria chove menos. Mínimo de 10 células. | A frase do pedido ("mais seca que X%") viraria "mais seca que 38%" na UFU, que lê como seca quando a área é das mais chuvosas. |
| D60 | 15/11 | Maior veranico: o dia seco é o dos avisos (menos de 1 mm); empate entre anos fica com o mais recente. | Uma regra só de dia seco; o ano mais recente é o que o produtor lembra. |
| D61 | 15/11 | Faixa de calor: 14 colunas de 16 dias desde 1º/jan pelo dia do ano (o calendário do MODIS), Terra e Aqua juntos (fica o maior NDVI bom do intervalo); 5 cores que sempre escurecem, cortes 0,30 / 0,45 / 0,60 / 0,75 (0,45 e 0,60 são os do histórico do talhão), "sem leitura" listrado. "Colheita" = a coluna do dia em que a soja costuma secar (RF-16); sem ele, a entressafra começa em abril (janela do histórico) e não há marca de colheita. | Escala acessível sem depender de cor (legenda numérica e o resultado do ano escrito em cada linha). |
| D62 | 15/11 | Título do histórico: "Na entressafra, sua área ficou parada em X de N anos.", com N = todos os anos (10); os anos sem certeza e sem soja vão numa linha embaixo. | Texto do pedido ("X de 10 anos"); antes o total eram só os anos certos. |
| D63 | 15/11 | Alertas (hipótese do time, grupo `alertas_area`): geada com 1 ano ou mais; chuva forte com média de 0,1 dia por ano ou mais (2 dias em 20 anos); fogo a até 5 km, com 1 ano ou mais. O MCD64A1 existe na ORNL: entrou o script, e **não** o índice substituto de tempo seco. Sem granizo. | "Cada um só aparece se o dado indicar risco": um ano já é risco; a chuva forte precisa de um piso para não aparecer por 1 dia em 20 anos. |
| D64 | 15/11 | Cartão "Clima 2041–2060": a chuva de março a maio de cada modelo é a variação de cada mês pesada pela chuva média do mês na célula; a máxima, a média simples dos meses; o cartão mostra a média dos modelos e quantos indicam menos chuva, mais chuva e mais calor. | Março chove mais que maio: a média simples das porcentagens exageraria o mês mais seco. |
| D65 | 15/11 | Cabeçalho do painel: o lugar é a cidade de referência mais perto (lista do front, sem rede), não o endereço do Photon; altitude não aparece (o `grid_cell` não tem a coluna e o pedido manda não buscar fora). | Evita um pedido externo a cada visita da tela 4; a altitude do POWER chega na busca, mas não é gravada. |
| D66 | 15/11 | Sem o raio-X (API antiga ou falha), a tela 4 volta aos cartões de antes (chuva, terra e clima) e à faixa de quadrinhos. O mock do raio-X fica num arquivo próprio (`repositories/mocks/raioXFixture.ts`). O RF-29 é o próximo livre do PRD: se a S7 também pegar o RF-29 (ou o D55 a D66), renumerar no merge. | A tela nunca fica vazia; arquivos próprios evitam conflito com a S7 (que mexe nos fixtures da comunidade). |

## Revisão por seção

### S4 — Raio-X da sua terra (revisada em 15/11 ~04:10)

Conferida em 1280 e 390 px, em pt e en, com dado real em dois pontos: a fazenda de exemplo (−18,9543 / −48,1993)
e um ponto dentro da cidade de Uberlândia (−18,9149 / −48,2568).

- ✅ Painel escuro (o único da tela) com números grandes, grade de 8 blocos e selo de fonte e resolução em cada um
  ("SMAP · NASA · 9 km"). Rodapé "Cada dado vale para a área em volta do ponto…". Animação respeita "reduzir movimento".
- ✅ Cabeçalho com lugar ("Perto de Uberlândia (MG)"), coordenadas, miniatura do mapa com o pin e leitura mais recente.
  A altitude não aparece porque o `grid_cell` não tem a coluna, e o pedido diz "não busque fora" (D65).
- ✅ Os 8 blocos na fazenda: solo 42% de argila em barra (com "Não é? Trocar"), 60 mm e "aguenta cerca de 13 dias"
  (milho com braquiária, meio), SMAP no percentil 59, NDVI 0,42 com pico da soja 0,90, 862 mm e fim das chuvas
  (21/abr; 16/mar/2021 a 22/jun/2012), veranico de 43 dias em 2024, calor 1 de 20 e "mais chuvosa que 62% da região".
  O solo da célula vizinha (até 15 km) aparece com a distância (D58).
- ✅ Histórico em faixa de calor do NDVI (2017–2026, D5), com "soja / colheita / entressafra" no topo e o título
  "Na entressafra, sua área ficou parada em 0 de 10 anos.". As safras confirmadas entram na faixa ("plantou (você)").
- ✅ No ponto da cidade, "Não parece uma lavoura de soja. Confira o ponto no mapa." com "Ajustar no mapa", e a faixa
  diz "sem soja" em todos os anos.
- ✅ "Confirme as últimas safras" continua no cartão do histórico, e o "Compartilhar com a comunidade" da S7 aparece
  depois de confirmar. A junção das duas seções foi feita no merge.
- ✅ Alertas aparecem só com risco: chuva forte (0,3 dia por ano, 5 dias em 20 anos), sem geada (mínima de 4,1 °C)
  e sem granizo.
- ✅ Fogo: a ORNL oferece o MCD64A1, então o caminho é o do produto e não o do índice substituto. O script
  `pipeline/fetch_area_queimada.py` está rodando na caixa piloto (240 pedidos, ~2,3 h, com linha no `data_run` do
  banco de revisão). Até o arquivo existir, o alerta de fogo não aparece.
- ✅ Cartões menores com "ver na sugestão": "20 anos de chuva" (16 de 20 na fazenda, colheita meio) e "Clima
  2041–2060" (+2,2% de chuva, +1,3 °C, "2 de 3 modelos indicam mais chuva; 3 de 3, mais calor"). Botão "Ver o que
  plantar" mantido.
- ✅ Dois artigos novos no Guia: "Como ler o raio-X da sua terra" e "Fogo na palha" (rascunho, com o 193).
- ⚠️ Bloco 8: o pedido diz "mais seca que X%"; quando a maioria das células chove menos, a frase vira "mais chuvosa
  que Y%" (D59). Com a frase fixa, a fazenda apareceria como "mais seca que 38%".
- ⚠️ No ponto da cidade, o bloco "Verde da lavoura" diz "Pico da soja 2025/26: 0,33" embora o satélite não tenha
  visto soja ali. O número é o maior NDVI de jan–mar; o rótulo devia ser "maior verde" quando não há soja. Fica
  para a S9 (consistência).
- ⚠️ No celular, a faixa de calor fica pequena (14 colunas em ~200 px), mas é legível. "Deixei parado" quebra em
  duas linhas.

### S7 — Comunidade (revisada em 15/11 ~03:11)

- ✅ Três relatos sem cadastro e sem texto livre (plantio, "Choveu aqui", "Aconteceu aqui"), em até 3 toques; aviso "Seus vizinhos veem a região, não o seu ponto."; fogo mostra "ligue 193".
- ✅ Tabela `community_report` (migração `3f7c2a9d4e81`, com `downgrade`) só com a célula de 0,1° e o HMAC do aparelho; endpoints conferidos de ponta a ponta no banco de revisão: enviar (volta só o centro da célula), listar (sem o hash), apagar (204), validação (500 mm → 422 "A chuva vai de 0 a 300 mm por dia.").
- ✅ Sem relatos: "Ainda não há relatos perto de você. Seja o primeiro a contar." (nenhum relato falso); exemplos só no modo mock, com o selo "Exemplo". Região pelo satélite continua escondida.
- ✅ "Compartilhar com a comunidade" depois de confirmar as safras na tela 4; link do Guia no fim.
- ⚠️ **A migração NÃO foi aplicada no banco `raiz_orbital`** (o Docker do usuário roda o `main`, que não a conhece: o serviço `migration` do compose quebraria). A revisão usa a cópia `raiz_orbital_remodelagem`. Ao fazer o merge do PR, rode `docker compose run --rm migration`.
- ⚠️ Configure o `COMMUNITY_DEVICE_SALT` no servidor; sem ele, o sal muda a cada reinício (o limite por dia e o "apagar o meu" recomeçam).
- ⚠️ Os links do Guia para "Fogo na palha" e "Como evitar erosão" esperam esses artigos. "Fogo na palha" entrou
  com a S4; "Como evitar erosão" ainda falta.

### S3 — Quando você colhe (revisada em 15/11 ~02:58)

- ✅ Dia da colheita no topo, preenchido com o dia do satélite (UFU: 25/02, fim de fevereiro ou março); "Não sei o dia exato" abre as 3 faixas; saiu "Colocar a data exata".
- ✅ Sugestão = seleção: a faixa azul só diz "já deixamos esse dia" quando é verdade; regra única das faixas no `regras.yaml` (D31).
- ✅ Chuva que sobra até 30/jun (mediana e ano seco, IMERG): "Colhendo em 25 de fevereiro, sobram em média 367 mm; num ano seco, 276 mm.", com a curva.
- ✅ Chuva (IMERG) × gasto da lavoura (ETo do POWER) por mês; abril destacado com texto e contorno (90 × 109 mm).
- ✅ Custo do atraso pelo motor (`/api/custo-atraso`): cedo 18, meio 16, tarde 20 de 20, dizendo que a melhor opção muda.
- ✅ Fim das chuvas: "Em metade dos anos, a chuva acabou até 21 de abril; o mais cedo foi 16 de março de 2021 e o mais tarde 22 de junho de 2012."
- ✅ Dois artigos novos no Guia ("Quando a chuva acaba" e "Plantar logo depois da colheita") e os links "Saiba mais". Conferido em 1280 e 390 px com dados reais.
- ⚠️ O dia exato não vai para a URL (só a faixa): ao voltar da tela 4, volta a faixa (D33).

### S2 — Onde fica a lavoura (revisada em 15/11 ~02:18)

- ✅ Busca "Buscar cidade, estrada ou endereço" com autocompletar pelo Photon (espera de 400 ms, uma busca por vez, mínimo de 3 letras), lista acessível e "© OpenStreetMap" visível.
- ✅ Coordenadas e link do Google Maps colados (31 casos testados: `!3d!4d`, `q=`, `ll=`, `/search/`, `@lat,lon`); link curto pede o link completo.
- ✅ "Usar onde estou agora" e o arrastar do mapa continuam; "Confirmar local" com ícone de pin; endereço aproximado perto do pin (no ambiente de revisão, com o Photon de verdade: "Perto de Fazenda Maria Dória, Uberlândia, Minas Gerais").
- ✅ Limite da área piloto tracejado no mapa, vindo de `GET /api/area-piloto` (fonte única: `PILOT_*` do backend); ponto fora (Rio Verde) bloqueia o botão com "Por enquanto só temos dados da região de Uberlândia e Uberaba."
- ✅ Conferido em 1280 e 390 px.
- ⚠️ Privacidade: o texto buscado e o ponto do pin vão para o Photon (komoot). Está no RNF-07 do PRD.

### S1 — Renda sem reais e sem "Ainda não conectado" (revisada em 15/11 ~02:11)

- ✅ Nenhum `R$` na API (conferido no JSON de `/recomendacao` nos 3 cenários de colheita) nem no front (busca no código, fora dos testes).
- ✅ "Renda" com fatos: "Dá grão para vender" ou "Não dá grão: é investimento na terra" e "Risco de perder a lavoura: faltou água ou fez calor em N de 20 anos" (na UFU, colheita meio: milho com braquiária, 4 de 20).
- ✅ Nota de renda sem preço nem custo, no grupo `renda` do `regras.yaml` (D14 a D16), explicada em "Como a conta é feita".
- ✅ "Comece por um pedaço" saiu inteiro (D20). Nenhum selo "Ainda não conectado" na tela; só comentários no código citam a regra (D18, D19).
- ⚠️ A melhor opção da UFU mudou com a renda nova: colheita cedo e meio passaram de milho sozinho para **milho com braquiária**; tarde continua milheto.
- ⚠️ Ainda na tela até as próximas seções: o botão "Relatório para banco ou seguro" (sai na S5a) e "Como teria sido em 2024?" (sai na S5b).

### S8 — Guia (revisada em 15/11 ~01:47)

- ✅ `/guia` com os 5 temas e busca por título; `/guia/<artigo>` com a estrutura fixa (Em uma frase, Por que importa, Na sua lavoura, Fontes; nas culturas, Conheça e Passo a passo). Conferido no Chrome sem interface em 1280 e 390 px.
- ✅ 19 artigos em pt e en: os 12 prioritários (6 culturas, deu certo, conta de água, rotação, prazo/ZARC, veranico, alertas da Defesa Civil) e 7 de apoio (palhada, adubo verde, nematoide, geada, El Niño/La Niña, calor de 35 °C, clima 2041–2060). Entre 156 e 214 palavras.
- ✅ "Rascunho: a revisar pela agrônoma" no topo dos de cultura, plantio e manejo.
- ✅ Números conferidos contra o `culturas.yaml` (Kc 1,20 do milho, floração 60 e ciclo 120 dias, limite 28/02) e o `regras.yaml` (ISNA 0,55 / 0,50, fase crítica ±15 dias, 35 °C em 3 dias).
- ✅ Fontes só de páginas abertas e conferidas (gov.br, Embrapa, NASA, NOAA), com um teste que barra link externo fora da lista `verifiedSources.ts`. Os números da Defesa Civil (SMS 40199, WhatsApp (61) 2034-4611, 193 e 199) foram conferidos no gov.br.
- ✅ Ilustrações próprias em SVG das 6 opções (D4); Markdown renderizado sem `innerHTML` e sem biblioteca nova.
- ⚠️ Faltaram 7 artigos: plantio direto, sementes e erosão (sem fonte aberta conferida); "quando a chuva acaba" e "raio-X" (descrevem telas das seções 3 e 4, que ainda não existem); "plantar logo depois da colheita" (sem fonte e depende do custo do atraso da S3); fogo na palha (só guias estaduais, não conferidos). Os links das telas para esses artigos entram quando as seções 3, 4 e 6 forem feitas.
- ⚠️ A S8 entrou antes da S1 (a S1 ainda estava rodando). Não há conflito: arquivos diferentes.

## Números estranhos encontrados

- **Renda e chuva com rótulos diferentes na mesma opção:** milho com braquiária na UFU (16 de 20) sai "Médio" na chuva e "Bom" na renda, porque os cortes são 85/60 na chuva e 70/30 na renda. A segurança pesa duas vezes para quem dá grão (segurança 30% + renda 30%).
- **Plano A da UFU (colheita cedo e meio):** milho com braquiária em 2027 e 2028; e a regra da data diz "siga o plano B; o 1º ano continua com milho com braquiária", porque o 1º ano do Plano B é a mesma cultura. A frase fica estranha; a S5b refaz o Plano A/B.
- **CMIP6 na UFU:** a nota de futuro sai igual à de segurança em todas as opções (os deltas não mudam nenhum ano de "deu certo" para "faltou" nesse ponto). Conferir na S4/S5a.
- **"Deu certo" no pedido × motor:** o pedido diz "nenhum dia de 35 °C nessa fase"; o motor (`regras.yaml`, `calor_min_dias`) conta aperto com **3 dias ou mais** de 35 °C na fase crítica. Os textos seguem o motor; mudar a regra é decisão da agrônoma.
- **Soja recente (RF-24):** 96% dos pixels da caixa piloto têm pico de NDVI ≥ 0,70 em jan–mar de 2026 (pasto e cerrado também ficam verdes na chuva). O aviso do começo pega cidade, água e solo exposto, mas não distingue soja de pasto.
- **Região pelo satélite calibrada (tarefa 0036):** depois de tirar cana, café e pasto, a soja do ano é 45–58% da lavoura, mas "parado" ainda fica entre 0,7% e 6% (plantou 72–96%). Só 2 de 10 anos passam no critério de crível combinado com o usuário (parado entre 5% e 80%), então a região continua escondida. Pode ser real (safrinha comum no Triângulo) ou mato que rebrota com a chuva de março.
- **S1, fazenda da UFU (banco local):** a nota "futuro" (CMIP6) sai igual à "segurança" em todas as
  opções nos 3 cenários de colheita (ex.: milho 90/90, 80/80). Os deltas do CMIP6 não mudam nenhum ano
  de "deu certo" para "faltou" nesse ponto; vale conferir na S4/S5a (linha "Clima 2041–2060").
- **S1, Plano A da colheita cedo na UFU:** com a renda nova, milho com braquiária nos 3 anos (nota 85,0
  contra 84,7 com crotalária no 3º ano). O PRD 7.7 não pune repetição; a S5b mostra a repetição como fato.
- **S3, custo do atraso na UFU parece "premiar" a colheita tarde:** cedo, milho com braquiária deu certo
  em 18 de 20; meio, milho com braquiária, 16 de 20; tarde, **milheto, 20 de 20**. A melhor muda para uma
  cobertura, que tem outro critério de "deu certo" (ISNA 0,50 nos primeiros 30 dias, contra 0,55 na
  floração do grão). A frase diz a cultura de cada faixa, mas a leitura rápida é "colher tarde é melhor".
  Vale decidir (agrônoma/produto) se o custo do atraso deve comparar a mesma cultura nas três faixas.
- **S3, fim das chuvas na UFU vai de 16/mar (2021) a 22/jun (2012)**, com a mediana em 21/abr. A regra pega
  o primeiro trecho de 20 dias com menos de 10 mm a partir de 1º/mar: um veranico em março já conta como
  fim (2005: 26/mar, apesar de 94 mm em maio e junho), e uma chuva fora de época empurra o fim (2012: 108 mm
  em maio e junho, fim em 22/jun). O IMERG da célula confirma a chuva; o número é real, mas a regra é
  sensível. Cabe à agrônoma calibrar (ex.: exigir também pouca chuva nos 30 dias seguintes).
- **S3, "em média" é a mediana:** o texto pedido diz "sobram em média X mm", e o número é a mediana (367 mm
  em 25/fev na UFU). A legenda explica; se preferirem a média de verdade, é uma linha no service.
- **S3, dia sugerido na UFU é 25/fev** (10 anos de NDVI), na faixa "fim de fevereiro ou março". O MOD13Q1 é
  de 16 dias (Terra e Aqua defasados em 8): o dia é a data da composição em que o NDVI caiu, não o dia exato
  da colheita. Com a regra nova (D31), um ponto com mediana em 21 ou 22/fev passa de "meio" para "tarde".

- **S4, histórico da UFU: parada em 0 de 10 anos.** O NDVI depois da colheita fica entre 0,7 e 0,9 em abril e
  maio todos os anos (a faixa de calor mostra isso): o pixel plantou (ou tem capim) em todas as
  entressafras de 2017 a 2026. Pode ser real (área experimental), mas vale conferir com o ICIAG-UFU.
- **S4, região na UFU:** 330,7 mm de março a maio contra a mediana da caixa de 325,6 mm (1,6% a mais), e a
  frase diz "mais chuvosa que 62% da região". A caixa é pouco variada nessa época: a porcentagem parece
  maior que a diferença em mm (o bloco escreve os mm logo depois).
- **S4, chuva forte na UFU:** 5 dias com 50 mm ou mais em fevereiro e março em 20 anos = 0,25 dia por ano,
  que a tela escreve "0,3 dia por ano" (o pedido pede a média por ano). "5 dias em 20 anos", que a frase
  também diz, é mais fácil de ler.
- **S4, maior veranico na UFU: 43 dias, a partir de 19/abr/2024.** De março a maio, o trecho seco mais
  longo quase sempre é o começo da seca no fim de abril e em maio, não um veranico dentro da época de
  chuva. O número é real (IMERG), mas a janela do pedido mistura as duas coisas.
- **S4, água que a terra guarda depende da faixa de colheita:** na colheita tarde (a do satélite na UFU) a
  melhor opção é milheto (Kc 1,0, 16 dias); no cedo e no meio, milho com braquiária (Kc 1,2, 13 dias). É
  o mesmo efeito do custo do atraso da S3 (a melhor cultura muda).
- **S4, clima 2041–2060 na UFU:** chuva de março a maio +2,2% (2 de 3 modelos indicam mais chuva) e máxima
  +1,3 °C (3 de 3). Com chuva quase igual, combina com a nota "futuro" igual à "segurança" já anotada
  na S1.
- **S4, "Umidade da terra agora" é de novembro:** o SMAP recente é de 10/11/2026 (percentil 59, "nesta
  época" = novembro), longe da época de plantio da safrinha; e a "última leitura" do NDVI é de
  28/07/2026, porque a série só vai até julho.
- **S4, MCD64A1 na conferência:** nenhum pixel queimado em 2016 num quadrado de ~10 km perto da fazenda
  (2 pedidos). O alerta de fogo só vai ter número depois da extração completa.

- **S4, ponto dentro da cidade de Uberlândia (−18,9149 / −48,2568):** o raio-X mostra solo, água, chuva e
  região normalmente, e o bloco do verde diz "Pico da soja 2025/26: 0,33" mesmo sem soja (ver a revisão da S4).
  O aviso "Não parece uma lavoura de soja" aparece certo.

## O que não foi possível e por quê

- **S7, chuva do satélite ao lado da chuva relatada:** não há chuva recente do satélite ligada (o
  IMERG Late saiu do sinal na tarefa 0038 e o banco só tem janeiro a julho). O pedido diz "quando
  houver dado recente": a frase não aparece.
- **S7, área queimada do MODIS no mapa:** depende da seção 4. O MCD64A1 está sendo baixado (15/11 ~04:05,
  ~2,3 h); o mapa da comunidade ainda não lê esse arquivo.
- **S7, links "Fogo na palha" e "Como evitar erosão":** os artigos ainda não existem no Guia (D9).
  O relato de fogo e o de enxurrada ou erosão ficam sem link até eles serem escritos.
- **S7, relatos na conta do motor:** os relatos não corrigem a chuva do IMERG nem entram no risco
  (o PRD 4 ainda fala disso): sem confirmação, só informam.

- **S2, link curto do Google Maps** (`maps.app.goo.gl`, `goo.gl/maps`): não dá para abrir sem rede, e o
  navegador não pode seguir o redirecionamento do Google. A tela explica: abrir o link no Google Maps e
  colar o link completo, ou colar as coordenadas.
- **S2, graus, minutos e segundos** colados como texto (`18°57'15.6"S 48°11'57.4"W`) não são lidos (o
  pedido só cita o formato decimal). O link do Google com esse nome funciona, pelo pino `!3d`/`!4d`.
- **S3, o dia exato não sobrevive à volta da tela 4:** a URL guarda só a faixa (D33). Voltando, o campo traz
  o dia do satélite (se a faixa é a dele) ou fica vazio com a faixa marcada.
- **S3, "Ver um exemplo pronto" continua com `colheita=meio` fixo** (`ExamplePage`), enquanto o `/exemplo`
  recomenda com a faixa do satélite (tarde na UFU). Na tela 3 isso já não engana (D33), mas a resposta do
  exemplo e a URL dizem faixas diferentes; fica para a S9 (consistência) ou para quem mexer no exemplo.
- **Artigos do Guia:** com os dois da S3 e os dois da S4 (raio-X e fogo na palha), faltam 3: plantio direto,
  sementes e erosão (D9).
- **S4, altitude no cabeçalho do raio-X:** o `grid_cell` não tem altitude (o POWER devolve na busca, mas
  ela não é gravada) e o pedido manda não buscar fora. Para ter, seria uma migração e a pré-carga de
  novo.
- **S4, extração completa do MCD64A1:** o script está pronto e conferido com 2 pedidos (131 s); a caixa
  inteira são 240 pedidos (~2,3 h) e fica com o orquestrador:
  `uv run python -m pipeline.fetch_area_queimada`. Até lá, o alerta de fogo não aparece.
- **S4, "Saiba mais" do alerta de chuva forte:** o artigo "Como evitar erosão" não existe (D9); o link
  entra quando ele for escrito.
- **S4, conferência em 390 px:** o Chrome sem interface desta máquina não abre janela mais estreita que
  ~500 px (o Guia, já revisado, sai cortado do mesmo jeito). A tela foi vista em 1280 e ~500 px; a
  revisão no celular fica para a revisão da seção.
