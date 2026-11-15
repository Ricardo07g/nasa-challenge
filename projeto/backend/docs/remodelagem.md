# Remodelagem do produto (iniciada em 15/11/2026)

Pedido do usuário de 15/11/2026 (9 seções). Este arquivo é o roteiro, o estado de cada entrega, o registro
das decisões e a revisão. Quem trabalhar numa seção lê esta página (as "Regras gerais" valem para todas) e os
`AGENTS.md`.

## Como trabalhamos

- **Uma branch e um PR só, sem merge** (pedido do usuário, 15/11 ~02:10): tudo entra em `feat/remodelagem`;
  o PR para o `main` fica aberto para o usuário revisar e decidir. Cada seção é uma branch
  `feat/remodelagem-sN-...` criada de `feat/remodelagem` e juntada nela com merge, sem PR próprio.
- **Ordem do pedido, uma entrega por seção.** No máximo duas seções em paralelo, só quando não mexem
  nos mesmos arquivos (coluna "Junto com").
- **TDD e camadas** como em todo o repositório. Cada seção tem a tarefa em `docs/tarefas/` (número abaixo)
  e o requisito na própria tarefa, no mesmo PR.
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
| S5a | 5. Abas: objetivo, Sugestão e Água | 0044 | abas Sugestão / Comparar / Plano, seletor "O que você quer mais?", linha Água e sede da cultura, explorador ano a ano (substitui `/safra-passada`), "Como fazer" em 4 partes, aviso único da colheita tarde, sem relatório | — | ✅ na branch (15/11 ~04:12), revisada; irrigação opcional não feita |
| S5b | 5. Comparar e Plano de 3 anos | 0045 | Comparar (até 3 culturas, colunas, "Usar no meu plano"), Plano editável com notas na hora, saúde da terra da rotação, chuva aproveitada, "Como é hoje" com o NDVI e a confirmação, Plano A/B com número derivado da série, sem "Comece por um pedaço" | — | ✅ na branch (15/11 ~05:05), revisada; Plano B sem número (nenhum limite separou bem) |
| S6 | 6. Avisos | 0046 | `/avisos` com contador, grupos Agora / O que mudou / Fora do comum / Perto de você, POWER recente com cache de 24 h, rodapé "Alertas oficiais" | S7 | ✅ na branch (15/11 ~04:50), revisada |
| S7 | 7. Comunidade | 0047 | relatos (plantio, chuva, evento) sem cadastro, tabela `community_report`, endpoints, mapa de 30 km, resumo "Perto de você" | S6 | ✅ na branch (15/11 ~03:10), revisada |
| S9 | 9. Consistência e revisão final | 0049 | missão com as fontes certas, "Como a conta é feita" com as regras novas, nenhum link para telas removidas, lista final do pedido | — | ✅ na branch (15/11 ~06:50, merge d565192), revisada |

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
| D55 | 15/11 | O raio-X é um endpoint novo, `GET /api/raio-x?lat&lon[&colheita][&solo][&confirmadas]`, e não campos do `/talhao`. | Ele roda o motor uma vez (a melhor opção vai no bloco da água e no cartão dos 20 anos), ~0,5 s na lavoura de demonstração; o `/talhao`, pedido já na tela 2, continua leve (mesmo motivo do D34). |
| D56 | 15/11 | A tela 4 pede o raio-X sem as safras confirmadas; a faixa de calor junta o NDVI do raio-X com o histórico do `/talhao` já com as respostas do produtor (no front). | Confirmar uma safra não recarrega o painel (o mesmo do talhão, tarefa 0039); as confirmações só mudam a frase do "Por quê?", não a melhor opção do motor. |
| D57 | 15/11 | "Aguenta cerca de N dias sem chuva na floração" = ⌊CAD ÷ (ETo média do motor nos dias da janela do aperto, floração ± 15 dias, nos 20 anos × `kc_pico`)⌋ da melhor opção do motor, arredondado para baixo. Vale também para a cobertura (floração estimada); no pousio, só a CAD. **A revisar.** | É a conta do pedido com os números do motor; arredondar para baixo não promete água que a terra não tem. |
| D58 | 15/11 | Célula sem solo: o raio-X usa o ponto gravado mais perto, de qualquer célula, até 15 km (`raio_x.solo_vizinho_max_km`), e diz a distância; o motor continua só com o solo da célula (ou o padrão). A CAD do bloco 2 é a do solo mostrado ou, se o produtor trocou a terra, a da escolha dele (a do motor). | Pedido da seção 4; mudar o solo do motor mexeria em todas as telas. Na caixa, 2 das 225 células não têm solo (ex.: −19,75 / −47,95 usa o ponto a 10,5 km). |
| D59 | 15/11 | Bloco 8: compara só células da caixa com a mesma fonte de chuva (IMERG) e com a janela inteira; diz "mais seca que X%" quando a maioria chove mais e "mais chuvosa que Y%" quando a maioria chove menos. Mínimo de 10 células. | A frase do pedido ("mais seca que X%") viraria "mais seca que 38%" na lavoura de demonstração, que lê como seca quando a área é das mais chuvosas. |
| D60 | 15/11 | Maior veranico: o dia seco é o dos avisos (menos de 1 mm); empate entre anos fica com o mais recente. | Uma regra só de dia seco; o ano mais recente é o que o produtor lembra. |
| D61 | 15/11 | Faixa de calor: 14 colunas de 16 dias desde 1º/jan pelo dia do ano (o calendário do MODIS), Terra e Aqua juntos (fica o maior NDVI bom do intervalo); 5 cores que sempre escurecem, cortes 0,30 / 0,45 / 0,60 / 0,75 (0,45 e 0,60 são os do histórico do talhão), "sem leitura" listrado. "Colheita" = a coluna do dia em que a soja costuma secar (RF-16); sem ele, a entressafra começa em abril (janela do histórico) e não há marca de colheita. | Escala acessível sem depender de cor (legenda numérica e o resultado do ano escrito em cada linha). |
| D62 | 15/11 | Título do histórico: "Na entressafra, sua área ficou parada em X de N anos.", com N = todos os anos (10); os anos sem certeza e sem soja vão numa linha embaixo. | Texto do pedido ("X de 10 anos"); antes o total eram só os anos certos. |
| D63 | 15/11 | Alertas (hipótese do time, grupo `alertas_area`): geada com 1 ano ou mais; chuva forte com média de 0,1 dia por ano ou mais (2 dias em 20 anos); fogo a até 5 km, com 1 ano ou mais. O MCD64A1 existe na ORNL: entrou o script, e **não** o índice substituto de tempo seco. Sem granizo. | "Cada um só aparece se o dado indicar risco": um ano já é risco; a chuva forte precisa de um piso para não aparecer por 1 dia em 20 anos. |
| D64 | 15/11 | Cartão "Clima 2041–2060": a chuva de março a maio de cada modelo é a variação de cada mês pesada pela chuva média do mês na célula; a máxima, a média simples dos meses; o cartão mostra a média dos modelos e quantos indicam menos chuva, mais chuva e mais calor. | Março chove mais que maio: a média simples das porcentagens exageraria o mês mais seco. |
| D65 | 15/11 | Cabeçalho do painel: o lugar é a cidade de referência mais perto (lista do front, sem rede), não o endereço do Photon; altitude não aparece (o `grid_cell` não tem a coluna e o pedido manda não buscar fora). | Evita um pedido externo a cada visita da tela 4; a altitude do POWER chega na busca, mas não é gravada. |
| D66 | 15/11 | Sem o raio-X (API antiga ou falha), a tela 4 volta aos cartões de antes (chuva, terra e clima) e à faixa de quadrinhos. O mock do raio-X fica num arquivo próprio (`repositories/mocks/raioXFixture.ts`). O RF-29 é o próximo livre do PRD: se a S7 também pegar o RF-29 (ou o D55 a D66), renumerar no merge. | A tela nunca fica vazia; arquivos próprios evitam conflito com a S7 (que mexe nos fixtures da comunidade). |
| D67 | 15/11 | S5a: as abas mudam de nome e de ordem (Sugestão, Comparar, Plano de 3 anos), mas as URLs ficam (`/resposta`, `/opcoes`, `/plano`). | Links já compartilhados não quebram e a S5b trabalha nas mesmas rotas. |
| D68 | 15/11 | A reordenação pelo objetivo é **no motor**: o `/recomendacao` traz `objetivos` (equilíbrio, segurança, renda e terra), cada um com a ordem das opções e o plano; o navegador só escolhe. Sem o campo (API antiga), o front reordena pelo eixo como antes. | O plano do objetivo usa a regra do PRD 7.7 (restrições, nematoide, bônus de diversidade), que só existe no backend; refazer no front duplicaria a regra. O RNF-02 continua: trocar de objetivo não pede nada à API. |
| D69 | 15/11 | O objetivo vai na URL (`objetivo=` com `seguranca`, `renda` ou `terra`, pelo `flowParams`, segue em todas as telas); sem objetivo = equilíbrio (pesos padrão, a melhor opção do motor), e tocar de novo tira a escolha. Ordem = nota do eixo (segurança, renda ou solo), desempate pela final. | "Se mantém entre as abas" (pedido 5.1). A escolha nula preserva a melhor opção do motor como padrão. |
| D70 | 15/11 | Plano de um objetivo: a melhor sequência do PRD 7.7 que começa pela 1ª da ordem, com a média da nota do eixo + o bônus de diversidade **sem o teto de 100** na comparação, desempate pela mesma conta com a nota final; **sem o pousio** nos objetivos. **A revisar.** | Com o teto, planos diferentes empatavam em 100; com o pousio (segurança 100, PRD 7.2), "mais segurança" sugeria deixar a terra parada no 3º ano (lavoura de demonstração, colheita meio), o que não é proteger a lavoura. |
| D71 | 15/11 | O Plano A (`plano_3_anos.normal`) passou a ser o plano do equilíbrio: começa pela melhor opção. O Plano B continua livre. O sinal do outono usa esse Plano A. | "A sugestão é o ano 1 de uma rotação" (pedido 5). Na lavoura de demonstração, o Plano A não mudou em nenhuma faixa. |
| D72 | 15/11 | Linha Água: "ano seco" = o percentil 80 da falta (só 20% dos anos faltou mais), com a mesma interpolação da tela 3; `agua.percentil_seco` = 20. | O pedido diz "percentil 20 dos 20 anos"; para a falta (mais é pior), o percentil 20 seria um ano úmido. Mantém o sentido do ano seco da S3 (percentil 20 da chuva). |
| D73 | 15/11 | Sede da cultura pelo consumo mediano no ciclo (ETc): pouca abaixo de 280 mm, muita de 325 mm para cima (hipótese do time, `regras.yaml`). | Na lavoura de demonstração: milho 332–359 mm, sorgo 289–316, crotalária 249–272, milheto 231–248, conforme a data de plantio; os cortes deixam a sede estável entre as faixas de colheita. |
| D74 | 15/11 | "Deu certo" é explicado com o critério que vem da API (`criterio`: ISNA mínimo, 35 °C, **3 dias**, janela), não com o texto do pedido ("nenhum dia de 35 °C"). | Pedido da tarefa: usar o critério do motor (está nos números estranhos). A tela nunca repete número fixo. |
| D75 | 15/11 | Explorador: a barra é o ISNA do motor (já limitado a 100%); o detalhe do ano abre na própria Sugestão, com o `ano` na URL, e pede a safra dia a dia ao `/api/safra-passada` com a `opcao` mostrada e a `colheita` da URL. `/safra-passada?…&ano=X` e `/relatorio` levam para `/resposta`. | "Reaproveite a tela `/safra-passada`": a linha do tempo, o service e o endpoint ficam, como parte do detalhe. Antes, o front não mandava a colheita (o replay era sempre do meio) nem a opção. |
| D76 | 15/11 | El Niño / La Niña: a frase só aparece com pelo menos 5 anos da fase e 25 pontos percentuais de diferença contra os outros anos (neutros e a outra fase) (`enso_acerto`, hipótese do time). | O mínimo de 5 anos é o do sinal do outono; 25 pontos é ~2 anos de diferença em 7. |
| D77 | 15/11 | Clima 2041–2060 e geada: cálculo pequeno da S5a (`clima_futuro_sugestao`, `geada_sugestao`), na célula, com os meses e o limite da seção 4 (março a maio; 3 °C de maio a julho); média simples dos meses de cada modelo. A geada só aparece no aviso da colheita tarde, e só se algum ano teve geada. **Unificar com a S4 na S9.** | A S4 rodava em paralelo; nomes de grupo diferentes evitam chave repetida no `regras.yaml` no merge. |
| D78 | 15/11 | O aviso único da colheita tarde é montado no front (pt e en) com `fora_da_janela[].data_limite`; o "quando" vem da faixa da URL ("depois de 20 de fevereiro") e as datas vão por extenso ("28 de fevereiro"), não "28/02". | A data exata não vai para a URL (D33); por extenso é o que o "Ouvir" lê bem. |
| D79 | 15/11 | O relatório saiu inteiro (tela, botão, controller e service); as chaves de i18n `report`, `past` e `answerTabs.answer/options` ficaram sem uso até a S9. O RF novo é o RF-30 (renumerar no merge se a S4 também pegar o RF-30, como no D13). | Regra de só acrescentar no i18n enquanto a S4 roda. |
| D80 | 15/11 | "Como fazer": manejo = os passos do `culturas.yaml` com "Rascunho: a revisar pela agrônoma." (são rascunho no YAML); "o que observar" = veranico típico (mediana, para baixo) e anos de calor da fase crítica, do motor, e o fim das chuvas do `/talhao` (S3). Irrigação (opcional da 5.3) não foi feita. | Regra geral: nada de recomendação agronômica nova. A irrigação fica atrás de uma opção desligada e não muda o "deu certo"; ficou para depois por tempo. |
| D90 | 15/11 | S6: os limites da tela "Avisos" ficam num grupo novo, `avisos_tela`, do `regras.yaml` (logo depois do `avisos`, também no model e no carregador); o grupo `avisos` (replay P4 e acompanhamento P6, com o `dia_seco_abaixo_mm` que o raio-X usa) não muda. | O `avisos` já existia com outro sentido; um grupo à parte não mexe em quem já usa. A posição logo depois do `avisos` evita conflito com a S5a, que acrescenta no fim. |
| D91 | 15/11 | S6: o ponto dos avisos é o último ponto do fluxo (com a colheita, o solo e as safras confirmadas), guardado no `localStorage` (`raiz-orbital.avisos.ponto`, com try/catch) pelo botão do cabeçalho em toda tela que tem o ponto na URL; a fazenda de exemplo (`exemplo=1`) nunca é guardada. A tela usa o ponto da URL e, sem ele, o salvo; sem nenhum, pede "Marcar minha lavoura". | Sem cadastro, como pede a seção 6. A S7 só guardava o identificador do aparelho (`deviceRepository`), e nada no fluxo guardava o ponto. O cabeçalho está em todas as telas. |
| D92 | 15/11 | S6: o contador do botão "Avisos" conta só os avisos de "Agora" e de "Perto de você"; mudanças e recordes são informação. A conta é do backend (`contador`). O número fica num selo e no nome acessível ("Avisos: 2 avisos ativos"); sem ponto, sem aviso ou com falha, o botão fica sem número. | Os grupos 2 e 3 não mudam até a série ganhar um ano: contar com eles deixaria o botão sempre aceso. Uma regra só, no backend. |
| D93 | 15/11 | S6: um endpoint, `GET /api/avisos?lat&lon[&colheita][&solo][&confirmadas]`, com os 4 grupos, o `periodo`, a `safrinha` e o `contador`. Cada aviso: `tipo`, `nivel`, `fontes`, `data`, `antiga` e `valores`; as frases ficam no front (pt e en), como no raio-X. Grupo `null` = sem dado; `avisos: []` = "Nada fora do normal" com a `ultima_leitura`. | Um pedido serve o botão e a tela; roda o motor uma vez (~0,5 s com o POWER em cache). Frases no front trocam de língua sem pedir de novo. |
| D94 | 15/11 | S6: nível "Atenção" para o que pede ação agora (terra seca, dias sem chuva, calor, avisos do replay na safrinha); "Fique de olho" para a previsão do ENSO, as mudanças, os recordes e os relatos de vizinhos (não confirmados). As mudanças para melhor também aparecem, com "Mudou para melhor, mas são poucos anos: não conte com isso." | O pedido só permite os dois níveis; os grupos 2 a 4 são contexto ou relato sem confirmação. O pedido manda mostrar as mudanças acima do limite, não só as ruins. |
| D95 | 15/11 | S6: o NASA POWER recente é pedido pelo backend no centro da célula de 0,1°, para os 30 dias até ontem (dia de Uberlândia), com cache na memória do processo por 24 h (por célula e janela), no máximo 8 s, e 15 min de espera depois de uma falha. A última leitura é o último dia com chuva e máxima; dia sem dado no meio para a contagem dos dias secos; a janela inteira seca vira "pelo menos N dias". | O botão do cabeçalho espera essa resposta: não pode ficar 24 s nas novas tentativas do cliente. O POWER sai com ~2 a 3 dias de atraso (em 15/11, o último dia é 12/11). |
| D96 | 15/11 | S6: "mais seca que em X% dos anos nesta época" usa X = 100 − percentil do SMAP, arredondado (o percentil do arquivo é a parte dos dias da climatologia com a umidade abaixo da de agora). | É a leitura certa do percentil; "anos" é o texto do pedido (a climatologia são janelas de 7 dias de 2016 a 2025). |
| D97 | 15/11 | S6: o aviso de El Niño / La Niña usa a mesma estação e a mesma chance mínima do sinal (FMA, 50%); neutro mais provável, nenhuma fase com 50% ou a estação já passada = sem aviso. O histórico é a melhor opção do motor (`bom` do `anos_detalhe`) nos anos da fase (ONI) e nos outros; sem o ONI, só a previsão. | Uma regra só para a previsão; comparar com os outros anos mostra se a fase pesa, sem chamar El Niño de "ano seco" (PRD 7.10). |
| D98 | 15/11 | S6: safrinha em andamento = hoje entre a semeadura do motor para a faixa (no ano de hoje) e a colheita (semeadura + ciclo da melhor opção), com o "hoje" injetado. Fora dela, a tela mostra a próxima safrinha e "Ver como teriam sido os avisos em 2024" para `/resposta?<parâmetros do fluxo>&ano=2024` (o último ano da série). Pousio: sem safrinha. | A URL guarda só a faixa, e a semeadura é a mesma da conta. Ajuste do orquestrador: a S5a tirou a tela solta da safra passada, e o `ano` da `/resposta` abre o detalhe do ano no explorador. |
| D99 | 15/11 | S6, "O que mudou": média por ano no veranico, no calor e na falta de água; mediana no fim das chuvas (como na tela 3); parte dos anos no "deu certo". Mínimos (hipótese do time): 5 dias, 10 dias, 1 dia por ano, 25 mm e 25 pontos percentuais. Janelas de março a maio do raio-X. Falta de água = ETc − ETr no ciclo, com o balde do motor (`cycle_deficits`). | Com 5 anos recentes, um ano só vale 20 pontos: o mínimo de 25 pede mais que um ano. A falta de água em mm não existia no motor; a conta usa o mesmo balde do `simulate_historical`. |
| D100 | 15/11 | S6, "Fora do comum": só temporadas inteiras; empate fica com o ano mais recente (D60); o fim das chuvas mais cedo é o `mais_cedo` do `RainEndService` (sem ele, a linha não aparece, D36); o recorde de calor só aparece com 1 dia ou mais. | As mesmas regras do raio-X e da tela 3: o número bate nas três telas. |
| D101 | 15/11 | S6, "Perto de você": eventos da comunidade no raio da comunidade (30 km), dos últimos 7 dias (hoje e os 6 antes, no dia de Uberlândia), um aviso por tipo de evento com o número de relatos e o mais recente. Sem banco, o grupo não aparece. | Uma linha por tipo não repete "geada" cinco vezes; o dia é o mesmo do resumo da comunidade (D52). |
| D102 | 15/11 | S6: o "rodapé fixo" é o último bloco da tela, que aparece sempre (com ou sem ponto e com ou sem avisos), e não uma barra presa na tela. Botões: `sms:40199`, `https://wa.me/556120344611` (sem texto pronto), `tel:193` e `tel:199`, e o artigo do Guia. | Uma barra presa cobriria os avisos no celular. Os links são os do pedido e do orquestrador. |
| D103 | 15/11 | S6: até 480 px o cabeçalho fica mais justo (menos respiro, nome em 18 px, logo em 34 px) e, se ainda não couber, os botões descem uma linha. Em 390 px cabe numa linha; em 360 px desce. | Com o botão novo, o nome "Raiz Orbital" ficava por baixo do ícone da Comunidade em 390 px. |
| D104 | 15/11 | S6: artigo novo do Guia "Como ler os avisos" (tema clima, sem rascunho, por ser de dados), só com fontes já conferidas em `verifiedSources.ts`; a tela liga com "Saiba mais". O RF novo é o RF-31 (a S5a usa o RF-30). | Explica os níveis, os grupos e as fontes sem número novo. |
| D110 | 15/11 | S5b: endpoint novo `GET /api/plano?lat&lon&anos=a,b,c[&colheita][&solo]` (`PlanEvaluationService`) para avaliar qualquer plano: a conta de cada cultura é a do motor (`RecommendationService.recommend`, a mesma faixa e o mesmo solo) e o bônus é o do `RotationPlanService`. O front pede de novo a cada troca (~0,3 s), com cache em memória por plano e o último resultado na tela enquanto recalcula. | As regras do plano (PRD 7.7) ficam no backend (D68); devolver todas as 216 sequências no `/recomendacao` pesaria a resposta de todas as telas. |
| D111 | 15/11 | Notas do plano: segurança climática e clima 2041–2060 = média das notas do motor só nos anos com lavoura na janela; saúde da terra = média da nota de solo dos 3 anos (PRD 7.4; pousio = 0) + o bônus de diversidade do PRD 7.7, até 100. **A revisar.** | O pousio tem segurança 100 (PRD 7.2) e subiria a nota do plano sem ter lavoura para proteger (o mesmo motivo do D70); na terra, o pousio conta como terra descoberta, e a diversidade da rotação é o que o pedido quer mostrar. |
| D112 | 15/11 | Fatos da terra do plano: coberta = palhada > 0 no `culturas.yaml`; deixa nitrogênio = `n_deixado_kg` > 0; quebra o ciclo do nematoide = as supressoras do PRD 7.7 (`rotacao.culturas_supressoras_nematoide`: crotalária e milheto); repetida = a mesma cultura (sem o pousio) em mais de um ano. | Números e listas que já estão no `culturas.yaml` e no `regras.yaml`; o pousio repetido já aparece como terra descoberta. |
| D113 | 15/11 | Chuva aproveitada: da semeadura do motor (colheita + 3 dias) até 31/jul (fim da série guardada; 30/jul nos anos bissextos), mediana dos anos. "Usa" = mediana da ETr do ciclo (`agua.usa_mm`, novo no `WaterNeedService`); a frase usa a média dos 3 anos do plano (pousio = 0). No pousio, só a chuva que cai sem cultura. Ano fora da janela: sem número e sem a média. | Texto do pedido ("Com a terra parada, X mm… Com o plano, a lavoura usa Y mm"), sem estimar a evaporação da terra; a ETr é a mesma conta da linha Água. |
| D114 | 15/11 | Plano A = a cultura do 1º ano do plano que a tela mostra (o sugerido ou o editado). Plano B = a cultura na janela (sem o pousio) que mais deu certo nos anos em que a do Plano A falhou, com desempate pela nota final do motor; sem ela, a tela diz por quê (deixar parado, nunca falhou, nenhuma melhor). O `plano_3_anos.seco` do motor não muda e continua no sinal do outono. | O 1º ano do plano seco do motor era igual ao do Plano A nas 3 faixas da lavoura de demonstração ("Plano B: milho com braquiária, se secar" não diz nada); o Plano B segue o Plano A quando o produtor troca o ano 1. |
| D115 | 15/11 | "Secar" com número = menos de L mm de chuva nos 15 dias antes da semeadura (o que o produtor confere no pluviômetro). L é o limite que mais acerta os anos de falha da cultura do Plano A (acertos − alarmes falsos; empate = menos anos marcados). **Separa bem** = 3 anos de falha ou mais, pega 50% das falhas ou mais, 60% ou mais dos anos marcados são falha, e a chance de pegar tantas falhas marcando o mesmo número de anos ao acaso (hipergeométrica) é de 10% ou menos (grupo `plano_b`, hipótese do time). Senão, o Plano B aparece sem número. | O pedido manda não inventar. As três primeiras condições foram fixadas antes de olhar os dados; a da chance foi acrescentada depois de ver que o sorgo da colheita tarde passava nelas com um limite que o acaso explica em 18,5% das vezes (está em "O que não foi possível"). |
| D116 | 15/11 | Saíram da tela do Plano: a escolha "Plano A / Plano B" da linha do tempo, a regra antiga da data (30 dias antes da data limite, 60% da média; tarefa 0038), o botão "Como teria sido em 2024?" e o estudo ilustrativo do ganho na soja (só no modo de demonstração). O cartão do sinal do outono (previsão do ENSO, motivo, SMAP de agora) ficou. O `regra_dia_plantar` segue na API, sem uso na tela. | O pedido troca o Plano A/B por uma frase cada, com o número derivado da série; o estudo não tinha fonte conferida. |
| D117 | 15/11 | "Como é hoje": as 3 safras de `anos_confirmaveis` com o NDVI do `/talhao` e as confirmações da tela 4; "O que foi?" com as culturas do relato de plantio da S7 (sem "outra", com "Deixei parado") e os `QuestionChips` da S7. Ano parado vale "Deixei parado" sem perguntar (dá para trocar). A resposta fica na URL (`hoje=`) e não vira relato nem confirmação. Com as 3 conhecidas, "Como é hoje" = essas culturas com a faixa de colheita de agora; senão, a referência do motor (`plano_3_anos.hoje`) com o aviso. | Reaproveita a forma de perguntar da S7 (o pedido não quer uma terceira); "outra" o motor não sabe avaliar. |
| D118 | 15/11 | Estado na URL pelo `flowParams`: `comparar` (até 3, sem o pousio), `plano` (3 culturas, o pousio vale) e `hoje`, sem codificar `:` e `,`; seguem entre as abas. Trocar o objetivo limpa `comparar` e `plano`. O plano da URL com cultura fora da janela (ex.: depois de trocar a colheita) volta ao sugerido. | O "Voltar" e o compartilhar funcionam (pedido); sem limpar, tocar em "Mais segurança" não mudaria nada no Comparar nem no Plano. |
| D119 | 15/11 | Comparar: "Por que usar" = chuva Bom, grão com renda Bom, terra Bom, pouca sede; "Por que evitar" = chuva Fraco, sem grão, terra Fraco, muita sede, menos anos bons em 2041–2060 que hoje. O pousio não entra no Comparar. A tabela põe o rótulo da linha em cima das células. | "Gerados das notas do motor": os rótulos já saem das notas com os cortes do `regras.yaml`, então o front não cria corte novo; com o rótulo em cima, 3 colunas cabem em 390 px sem rolar a página. |
| D120 | 15/11 | "Usar no meu plano" põe a cultura no ano 1 e mantém os anos 2 e 3 do plano atual (o editado ou o sugerido do objetivo). | "Leva a cultura para o ano 1" (pedido); trocar os outros anos sem o produtor pedir mudaria o plano dele. |
| D121 | 15/11 | A cultura de cada ano do Plano é escolhida numa lista nativa (`SelectField`, novo no design system); o "O que foi?" continua com botões. | Seis botões em cada um dos 3 anos seriam 18 botões no celular; o "O que foi?" usa a forma da S7. |
| D122 | 15/11 | O requisito novo é o RF-32 (reservado pelo orquestrador; a S6 usa outro). Se colidir no merge, renumerar como no D13. | Regra de números reservados para seções em paralelo. |
| D130 | 15/11 | S9: o `/recomendacao` manda em `clima_futuro` e `geada` **os mesmos objetos do raio-X** (`FutureClimateService` e `RaioXClimateService.frost`); saem o `CellClimateFactsService` e os grupos `clima_futuro_sugestao` e `geada_sugestao`. No front, as duas telas escrevem com o mesmo helper (`futureClimateText`), com o hífen como sinal de menos (o que o "Ouvir" lê, decisão da S4). | A média simples dos meses dava −0,7% e "2 de 3, menos chuva" na Sugestão contra +2,2% e "2 de 3, mais chuva" no raio-X na mesma célula; a conta da S4 pesa cada mês pela chuva (a certa para o total de março a maio). Uma conta só não diverge de novo. |
| D131 | 15/11 | S9: o sinal do outono recebe as **culturas** do Plano A e do Plano B (`cultura_a`, `cultura_b`), e o Plano B é o do `PlanBService` (a cultura que mais deu certo quando a do A falhou, o mesmo do cartão "Plano A e Plano B"), não mais o 1º ano do plano seco do motor. Sem Plano B, o ano ruim fica `incerto` ("Nenhuma outra cultura se saiu melhor nesses anos."). **A revisar.** | O sinal falava de um Plano B que a tela não mostrava (D114). Com a mesma regra, o sinal e o cartão contam a mesma história; sem Plano B, marcar "Plano B" seria apontar para nada. |
| D132 | 15/11 | S9: o `/api/plano` devolve o `sinal` do plano que a tela mostra (o sugerido ou o editado; nenhum no pousio ou fora da janela). O front usa o sinal da avaliação; sem o campo (API antiga) ou enquanto carrega, o do `/recomendacao`, **só no plano sugerido** (`planSignal`). | "Se o plano foi editado, o sinal fala do Plano A que a tela mostra" (pedido da tarefa). Com o plano sugerido, o sinal do `/api/plano` é igual ao do `/recomendacao` (teste de rota). |
| D133 | 15/11 | S9: o aviso de El Niño / La Niña leva `valores.sinal` (o veredito do sinal do `/recomendacao`) e o "O que fazer" tem uma frase por veredito: normal = "O sinal do outono marca o Plano A…", seco = "…marca o Plano B…", incerto ou sem sinal = "Veja o Plano A e o Plano B…". | Os Avisos não sabem do plano editado (o ponto salvo guarda colheita, solo e safras, não o `plano=`); o aviso nomeia a cultura (a melhor opção), e é ela o Plano A sugerido (D71). |
| D134 | 15/11 | S9: saem da API o `regra_dia_plantar` e o `regra_data` (e o `dias_regra_data`); o `sinal_outono.chuva_fracao_seco` fica no YAML marcado sem uso, como o `chance_seco_min`. No front, saem as funções e chaves sem uso (lista da tarefa) e também as chaves da comunidade simulada que nada usava (uma dizia "not connected yet"). | Nada na tela usava a regra antiga desde a S5b (D116). O D53 guardava as chaves da comunidade simulada para o `/design-system`, mas as removidas não eram usadas nem lá. |
| D135 | 15/11 | S9: a falta de água não muda de conta: os Avisos dizem "na média dos anos" (e que os anos muito secos puxam a média), e a nota da linha Água diz "Ano normal = em metade dos anos faltou isso ou menos (mediana)". | As duas contas estão certas (média × mediana); o que parecia contradição era a palavra. |
| D136 | 15/11 | S9: "quebra o ciclo do nematoide" = as supressoras do PRD 7.7 (`rotacao.culturas_supressoras_nematoide`: crotalária e milheto), na linha Terra e no Plano; os outros "não quebra". Os pontos de pragas da nota de solo (PRD 7.4) não mudam. **A revisar pela agrônoma.** | Uma regra só nas duas telas (pedido). O PRD 5 diz que sorgo e braquiária reduzem o reniforme: se a agrônoma quiser, a lista do YAML muda as duas telas juntas. |
| D137 | 15/11 | S9: `verde.soja_vista` no raio-X, pela regra da faixa do histórico (`soy_harvest_date`: pico e colheita; sem série, o `vista` do mapa da soja recente). Sem soja, o rótulo é "Maior verde de janeiro a meados de março" (a janela do pico é 1/jan a 15/mar), com "O satélite não viu soja aqui". | O pedido diz "maior verde de jan–mar"; a janela real termina em 15/mar, e a frase diz isso. A mesma regra da faixa evita a tela dizer "sem soja" na faixa e "pico da soja" no bloco. |
| D138 | 15/11 | S9: "Ver um exemplo pronto" (`/exemplo`) pede o talhão do exemplo e abre a resposta com a `colheita_sugerida.faixa` (sem ela ou com falha, `meio`). O `farmService` só usa a resposta pronta do `/exemplo` quando a faixa da URL é a dela e a terra não foi trocada; senão, `/recomendacao` do ponto do exemplo. | Com `colheita=meio` fixo, a URL dizia meio e a resposta era da faixa tarde (a do satélite). O segundo ajuste também corrige quem volta à tela 3 no exemplo e troca a faixa. |
| D139 | 15/11 | S9: a missão cita a fonte de cada fase só com o dado no talhão e no sinal (SoilGrids só com o mapa de solos; SMAP do balde; chuva do GPM IMERG ou do NASA POWER, calor sempre do POWER; MODIS NDVI; NEX-GDDP-CMIP6; previsão da NOAA) e conta as opções da conta (as que cabem na janela + deixar parado: 6 no meio, 3 na tarde da lavoura de demonstração). O MCD64A1 entra nas `dados` do `/talhao` quando o arquivo cobre o ponto (pedido de ±0,5 km ao repository). | "Só as fontes realmente usadas e o número certo de opções" (pedido 9). O talhão é a lista de fontes que as telas já liam (D2); com o arquivo pronto às 05:56, o MCD64A1 aparece na missão e em "De onde vem cada dado". |
| D140 | 15/11 | S9: endpoint novo `GET /api/metodo` (`MethodService`, RF-33) com os números das regras que "Como a conta é feita" explica; a tela escreve uma frase por regra e nunca repete número. Schemas com o prefixo `Metodo`. Sai o cartão "Bateu com o que aconteceu? Em breve…" (IBGE). | "Com os números lidos do regras.yaml ou da API, nunca fixos na tela" (pedido da tarefa). O cartão "em breve" era promessa de algo não ligado (regra geral: só o que está ligado). |
| D141 | 15/11 | S9: no celular, cada botão do `ChipGroup` cresce pelo tamanho do texto (`flex: 1 1 auto`, `white-space: nowrap`, respiro `--space-3`) e desce para a linha de baixo quando não cabe. Vale para todos os grupos de botões. | Em 390 px, "Cuidar da terra" e "Deixei parado" quebravam em 2 ou 3 linhas dentro do botão; agora "Mais segurança" e "Renda" ficam na 1ª linha e "Cuidar da terra" na 2ª, inteiro. |
| D142 | 15/11 | S9: os 3 artigos que faltavam (erosão, plantio direto, sementes) saem como rascunho, com fontes abertas e conferidas em 15/11 (Embrapa 2019: terraços e plantio direto; Embrapa 2014: dia de campo do plantio direto; Lei 10.711/2003). No de sementes, germinação e vigor sem número nem norma: a IN MAPA 17/2017 é um PDF que não deu para abrir. | Regra do Guia: só fonte aberta; melhor dizer "pergunte ao vendedor" do que citar o que não foi lido. |
| D143 | 15/11 | S9: as regras gerais viram teste: no front, `consistency.test.ts` (sem R$, sem "Ainda não conectado" nos textos, sem link para `/relatorio` e `/safra-passada`, sem texto das telas removidas, NASA POWER não é a fonte da chuva da série); no backend, `test_regras_gerais.py` (sem R$ e sem "Ainda não conectado" no código e nas regras). | O pedido mandou conferir no código inteiro; o teste impede a volta. |
| D144 | 15/11 | S9: o RF novo é o RF-33 ("Como a conta é feita" com as regras novas); RF-19 e RF-20 foram reescritos e o PRD 7.6 ganhou a nota do nematoide. | Pedido da tarefa (RF-33 reservado). |

## Revisão por seção

### S9 — Consistência e revisão final (revisada em 15/11 ~06:40)

Conferida com dado real (API 8005 no banco `raiz_orbital_remodelagem`, só leitura, com o MCD64A1) na fazenda de exemplo
(cedo, meio e tarde), no ponto da cidade (−18,9149 / −48,2568) e no ponto da terra seca (−19,55 / −48,95), em 1280 e
390 px, pt e en (prints `scratchpad/shots/s9-*.png`).

- ✅ **Clima 2041–2060 igual nas duas telas:** Sugestão e raio-X "+2,2%, 2 de 3 modelos indicam mais chuva; 3 de 3, mais
  calor" na fazenda (antes −0,7% e "menos chuva" na Sugestão); +2,1% no ponto da terra seca nas duas. A geada é o mesmo
  alerta (nenhum ano nos 3 pontos).
- ✅ **Sinal × aviso de El Niño:** o aviso diz "O sinal do outono marca o Plano A" quando o Plano diz "Sinal de ano
  normal" (fazenda, El Niño 98%, milho com braquiária 5 de 7). Com o plano editado (sorgo no ano 1), o sinal fala do
  sorgo ("deu certo em 4"). Com o plano sugerido, o sinal do `/api/plano` é igual ao do `/recomendacao` nos 5 casos.
- ✅ **Falta de água:** "na média dos anos" nos Avisos (101,6 → 177,4 mm) e "ano normal = em metade dos anos" na linha
  Água (116 mm).
- ✅ **Nematoide:** crotalária e milheto "quebra o ciclo"; sorgo, milho e milho com braquiária "não quebra", nas duas telas.
- ✅ **Verde sem soja:** na cidade, "Maior verde de janeiro a meados de março (2025/26): 0,33, em 18 de fevereiro de
  2026. O satélite não viu soja aqui." Na fazenda continua "Pico da soja 2025/26: 0,90".
- ✅ **Exemplo pronto:** `/exemplo` abre `/resposta?…&colheita=tarde&exemplo=1` (a faixa do satélite, 25/02).
- ✅ **Missão:** fontes com o nome (SoilGrids, SMAP de 2016 a 2025, GPM IMERG e NASA POWER, MODIS NDVI, MCD64A1 de 2016 a
  2025, NEX-GDDP-CMIP6, NOAA) e "Fazendo a conta das 3 opções" na colheita tarde.
- ✅ **Como a conta é feita:** 13 regras com os números do `/api/metodo` (55%, 15 dias, 50% em 30 dias, 35 °C em 3 dias,
  pesos 30/15/25/30, 280 e 325 mm, +5/+10, Plano B 15 dias/3 falhas/50%/60%/10%, geada 3 °C de 1/mai a 31/jul, chuva
  forte 50 mm em fev–mar, fogo 5 km, avisos e sinal); MCD64A1 em "De onde vem cada dado".
- ✅ **Fogo (MCD64A1):** com o arquivo, a fazenda tem fogo a até 5 km em 5 de 10 anos (2016, 2018, 2019, 2020, 2024); a
  cidade e o ponto da terra seca, nenhum ano.
- ✅ Nenhum link para as telas removidas; nenhum R$; nenhum "Ainda não conectado" (testes nos dois lados).
- ✅ Em 390 px, os botões do objetivo não quebram o texto.
- ✅ Guia com os 3 artigos que faltavam (27 artigos em pt e en) e os "Saiba mais" de chuva forte, erosão e fogo.
- ⚠️ O mapa da comunidade ainda não mostra a área queimada (o arquivo ficou pronto durante a S9; ver a lista final).

### S9 — Consistência e revisão final (revisada em 15/11 ~07:00)

Revisão final de todas as telas na branch inteira (API 8001 com o banco `raiz_orbital_remodelagem` e o arquivo do
MCD64A1; front 5174), em 1280 px (pt e en) e 390 px. Pontos: fazenda de exemplo (colheitas cedo, meio e tarde), a
cidade de Uberlândia e o ponto da terra seca perto de Prata.

- ✅ As contradições da lista foram corrigidas e conferidas na tela:
  - clima 2041–2060 "+2,2%, 2 de 3 modelos indicam mais chuva" na Sugestão e no raio-X;
  - o aviso de El Niño segue o sinal do outono ("marca o Plano A");
  - falta de água com "na média" × "em metade dos anos";
  - só crotalária e milheto "quebram o nematoide", nas duas telas;
  - "maior verde" no ponto da cidade;
  - o exemplo abre na faixa do satélite.
- ✅ Missão com as fontes usadas e o número de opções da conta; "Como a conta é feita" com 13 regras lidas do
  `regras.yaml` (`GET /api/metodo`).
- ✅ Nenhum link para `/relatorio` ou `/safra-passada` (os endereços antigos só redirecionam), nenhum R$ e nenhum
  "Ainda não conectado", com testes no front e no backend que barram a volta.
- ✅ Alerta de fogo com o MCD64A1 na fazenda: "Houve fogo a até 5 km do seu ponto em 5 de 10 anos (MODIS, NASA)",
  com "Saiba mais: Fogo na palha". Na cidade e em Prata, nenhum ano.
- ✅ Guia com os 3 artigos que faltavam (erosão, plantio direto e sementes, em rascunho). O "Saiba mais" da chuva
  forte e os relatos de erosão e fogo da comunidade estão ligados.
- ⚠️ O que ficou de fora está na "Lista final do pedido" abaixo: irrigação opcional, área queimada no mapa da
  comunidade, número do Plano B e o resto, cada item com o motivo.

### S5b — Comparar e Plano de 3 anos (revisada em 15/11 ~05:15)

Conferida em 1280 e 390 px, pt e en, com dado real na fazenda de exemplo (colheita meio).

- ✅ Comparar:
  - até 3 culturas por chips com imagem e sede; por padrão, as 3 melhores do objetivo; a 4ª pede para tirar uma;
  - culturas fora da janela desligadas, com o motivo;
  - colunas com deu certo, por que falhou (água × calor), água, clima 2041–2060 por cultura, renda, terra,
    prazo, "Por que usar", "Por que evitar" e "Saiba mais";
  - "Se você prefere…" abre a aba e "Usar no meu plano" leva a cultura para o ano 1.
  - Em 390 px, as 3 colunas cabem sem rolagem lateral.
- ✅ Plano de 3 anos:
  - troca da cultura de cada ano numa lista (D121); as notas recalculam pelo `GET /api/plano` (~0,4 s), lado a lado
    com o "Como é hoje" (sorgo, milheto e crotalária: segurança 88, terra 68, clima 2041–2060 88; hoje: 80, 20, 80);
  - "Voltar ao plano sugerido";
  - saúde da terra com fatos (terra coberta, nitrogênio, nematoide, repetição).
- ✅ Chuva aproveitada: "Com a terra parada, 413 mm de chuva por ano caem sem virar grão nem palha. Com o plano, a
  lavoura usa 216 mm.", ano a ano e com a fonte. No pousio, só a chuva que caiu, sem estimar evaporação.
- ✅ "Como é hoje" com o NDVI das 3 últimas safras (0,71, 0,80 e 0,89 no MODIS) e "O que foi?" em cada ano. Sem
  resposta, fica a referência (milho sozinho nos 3 anos), dita como referência.
- ✅ Plano A e Plano B numa frase cada. O Plano B sai **sem número**: na série, nenhum limite de chuva nos 15 dias
  antes de plantar (nem o SMAP) separou os anos ruins dos bons (D115). A tela diz isso.
- ✅ Saiu o botão "Como teria sido em 2024?" (o detalhe de 2024 está no explorador da Sugestão).
- ⚠️ **Sinal do outono × Avisos:** o Plano diz "Sinal de ano normal. O sinal marca o Plano A." com El Niño de 98%, e
  o aviso de El Niño da S6 diz "Veja o Plano B no Plano de 3 anos antes de decidir". As duas telas precisam dar o
  mesmo conselho (S9).
- ⚠️ No Comparar, "Por que usar: Dá grão com pouco risco de perder" aparece ao lado de "Deu certo: Médio" (16 de
  20). Vem dos rótulos diferentes de chuva e renda, já anotados na S1.
- ⚠️ O sinal do outono ainda fala do Plano A sugerido, mesmo depois de o produtor trocar o ano 1 (S9).

### S6 — Avisos (revisada em 15/11 ~04:55)

Conferida em 1280 e 390 px, pt e en, com dado real na fazenda de exemplo e num ponto perto de Prata
(−19,55 / −48,95), um dos 3 com a terra seca no SMAP de 10/11.

- ✅ Botão "Avisos" ao lado de "Comunidade", com o contador em número e no nome acessível (fazenda: 1; Prata: 3).
  No celular, o cabeçalho cabe em uma linha (só os ícones).
- ✅ Ponto salvo no aparelho, sem cadastro (D91). Sem ponto, a tela pede "Marcar minha lavoura". Não há push.
- ✅ Cada aviso tem o nível em texto ("Atenção" ou "Fique de olho"), o que o dado mostra, "O que fazer:", a fonte
  e a data da leitura. Grupo sem aviso: "Nada fora do normal." com a data.
- ✅ Agora:
  - terra seca em Prata: "mais seca que em 85% dos anos nesta época", SMAP de 10/11;
  - calor: "5 dias com 35 °C ou mais nos últimos 10", NASA POWER de 12/11, pedido pelo backend com cache de 24 h;
  - El Niño: previsão de 98% para fev–abr de 2027 e "nos 7 anos de El Niño… 5; nos outros 13, 11. São poucos anos.";
  - fora da safrinha, o link "Ver como teriam sido os avisos em 2024" abre o detalhe de 2024 no explorador da
    Sugestão (S5a);
  - nenhuma comparação da chuva recente com "o normal".
- ✅ O que mudou (2020–2024 × 2005–2019), com os dois números e "São poucos anos": veranico 20,8 → 27,2 dias, fim
  das chuvas 24/abr → 13/abr, falta de água 101,6 → 177,4 mm, deu certo 13 de 15 → 3 de 5.
- ✅ Fora do comum: veranico de 43 dias (2024), outono mais seco (178 mm em 2021), chuva que acabou mais cedo
  (16/mar/2021) e ano com mais calor (2024). Os números batem com o raio-X.
- ✅ Perto de você: eventos de vizinhos dos últimos 7 dias a até 30 km, com "Relato de vizinho, não confirmado".
  Hoje não há relatos.
- ✅ "Alertas oficiais": texto do pedido, botões de SMS para 40199, WhatsApp, 193 e 199, e o link do Guia. Artigo
  novo "Como ler os avisos".
- ⚠️ "Falta de água no ciclo" aqui é a **média por ano** (101,6 e 177,4 mm), e na linha "Água" da Sugestão é a
  **mediana** (116 mm) dos 20 anos. As duas estão certas, mas lado a lado parecem discordar. Alinhar a palavra
  ("em média" × "em metade dos anos") na S9.
- ⚠️ O rodapé é o último bloco da tela, não uma barra presa (D102): uma barra cobriria os avisos no celular.
- ⚠️ O aviso de calor aparece também fora da safrinha (novembro), com o "o que fazer" condicional ("Se a lavoura
  estiver na floração…").

### S5a — Abas, objetivo, Sugestão e Água (revisada em 15/11 ~04:20)

Conferida em 1280 e 390 px, pt e en, com dado real na fazenda de exemplo (colheita meio e tarde).

- ✅ Abas "Sugestão", "Comparar" e "Plano de 3 anos", nessa ordem. As URLs ficaram (`/resposta`, `/opcoes`,
  `/plano`); `/safra-passada?…&ano=2024` leva para `/resposta?…&ano=2024` e `/relatorio` saiu.
- ✅ 5.1 "O que você quer mais?" no topo das três abas, guardado na URL. A ordem e o plano de cada objetivo vêm
  prontos do motor. Com "Mais segurança", a 1ª opção vira crotalária (19 de 20).
- ✅ 5.2 Imagem da planta (SVG próprio) nos cartões, na miniatura do plano, em "Se você prefere…", no Comparar e
  no Plano.
- ✅ 5.3 Selo de sede (milho com braquiária: muita; sorgo: média; crotalária e milheto: pouca) e linha Água:
  "Precisa de 346 mm · Costuma chover 400 mm · Falta 116 mm em ano normal e 158 mm em ano seco" e a versão
  2041–2060 (128 mm, de 112 a 143). Palhada, enxurrada e água da próxima safra só no Guia, sem número.
- ✅ 5.4 "Ano 1 do seu plano" com os 3 anos em miniatura e "Explorar o plano"; "deu certo" explicado com o
  critério da API (55% da água e menos de 3 dias de 35 °C); explorador com barras de 2005 a 2024, linha de
  corte de 55%, "N" e "L" escritos e anos de aperto listrados.
- ✅ Detalhe do ano (2024): semeadura 18/fev, floração 18/abr, 14 dias sem chuva, 0 dias de 35 °C, El Niño,
  SMAP de 35% da água que a terra guarda, o motivo e a safra dia a dia (aviso de 10 dias sem chuva em 28/abr).
- ✅ Linhas na ordem pedida (Deu certo, Água, Clima 2041–2060, Renda, Terra); "Como fazer" em 4 partes com
  "Passo a passo completo"; na colheita tarde, um aviso só ("milho sozinho, milho com braquiária e
  crotalária") com a linha do ZARC e o link; o relatório saiu.
- ❌ **Clima 2041–2060 diz coisas diferentes em duas telas para a mesma célula:** na Sugestão, "Chuva de março
  a maio: −0,7%, 2 de 3 modelos indicam menos chuva"; no raio-X (S4), "+2,2%, 2 de 3 modelos indicam mais
  chuva". A S4 pesa a variação de cada mês pela chuva média do mês (D64); a S5a faz uma conta própria
  (`clima_futuro_sugestao`, D77). A conta da S4 é a certa para o total de março a maio. Corrigir na S9: a
  Sugestão passa a usar o `FutureClimateService`.
- ⚠️ No celular, os botões do objetivo quebram em 2 ou 3 linhas ("Cuidar da terra").
- ⚠️ O Plano ainda tem o botão "Como teria sido em 2024?" e o Plano A/B antigo: ficam para a S5b.
- ⚠️ Irrigação opcional (5.3) não feita (ver "O que não foi possível").

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

- ✅ Dia da colheita no topo, preenchido com o dia do satélite (lavoura de demonstração: 25/02, fim de fevereiro ou março); "Não sei o dia exato" abre as 3 faixas; saiu "Colocar a data exata".
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
- ✅ "Renda" com fatos: "Dá grão para vender" ou "Não dá grão: é investimento na terra" e "Risco de perder a lavoura: faltou água ou fez calor em N de 20 anos" (na lavoura de demonstração, colheita meio: milho com braquiária, 4 de 20).
- ✅ Nota de renda sem preço nem custo, no grupo `renda` do `regras.yaml` (D14 a D16), explicada em "Como a conta é feita".
- ✅ "Comece por um pedaço" saiu inteiro (D20). Nenhum selo "Ainda não conectado" na tela; só comentários no código citam a regra (D18, D19).
- ⚠️ A melhor opção da lavoura de demonstração mudou com a renda nova: colheita cedo e meio passaram de milho sozinho para **milho com braquiária**; tarde continua milheto.
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

## Lista final do pedido

Cada item do pedido de 15/11/2026, conferido depois da S9: ✅ feito, ⚠️ feito com ressalva, ❌
não feito. A linha diz o porquê; o detalhe está na revisão da seção e nas decisões.

### Regras gerais

- ✅ Nenhum dado inventado: todo número vem do banco, de `data/baixados/` ou do motor, com a fonte; sem dado, o elemento some (D2).
- ✅ Nenhum selo "Ainda não conectado" (D18; teste do front e do backend na S9, D143).
- ✅ Nenhum valor em reais (S1; teste do front e do backend na S9).
- ⚠️ Texto novo em pt e en e compatível com o "Ouvir": as chaves são iguais nos dois (teste de paridade); o sinal de menos é o hífen, que o "Ouvir" lê (D130); a leitura em voz alta não foi ouvida tela a tela.
- ⚠️ Responsivo, celular primeiro: conferido em 390 e 1280 px; contraste de 4,5:1 medido no painel do raio-X (tokens `--color-instrument-*`), não em todas as telas; nenhuma informação só por cor (legendas e texto).
- ✅ Nenhuma recomendação agronômica nova: manejo e artigos de plantio são rascunho "a revisar pela agrônoma".
- ✅ Limites novos no `regras.yaml` com fonte ou "hipótese do time" (o `YamlRulesRepository` recusa número sem fonte).
- ✅ Fonte certa em cada frase: chuva do GPM IMERG, calor e ETo do NASA POWER, umidade do SMAP, NDVI do MODIS (conferido na S9; cartão do NASA POWER corrigido, D143).
- ✅ Testes atualizados e criados para as regras novas (backend 1.771, front 1.045 na S9).
- ✅ Lista do que foi feito, do que não foi possível e dos números estranhos: esta seção e as duas abaixo.

### 1. Valores em reais

- ✅ Nenhum R$ no front nem nas respostas da API (cartões, plano, "Por quê?").
- ✅ A dimensão é "Renda", com "Dá grão para vender" / "Não dá grão: é investimento na terra" e "Risco de perder a lavoura: … em N de 20 anos.".
- ✅ Nota de renda sem preço nem custo (D14, D15), no grupo `renda` do `regras.yaml` e em "Como a conta é feita" com o número do YAML (D140).

### 2. Onde fica a lavoura

- ✅ Busca "Buscar cidade, estrada ou endereço" com autocompletar pelo Photon, com espera entre teclas e uma busca por vez (D3).
- ⚠️ Coordenadas e link do Google Maps colados: funcionam; link curto (`maps.app.goo.gl`) e graus/minutos/segundos em texto não (D26).
- ✅ "Usar onde estou agora" e o arrastar do mapa.
- ✅ "Confirmar local" com pin e o endereço aproximado (o texto e o ponto vão para o Photon: RNF-07).
- ✅ Limite da área piloto no mapa e bloqueio com "Por enquanto só temos dados da região de Uberlândia e Uberaba." (D21).

### 3. Quando você colhe a soja

- ✅ Campo de data no topo com o dia do satélite; "Não sei o dia exato" abre as 3 faixas; saiu "Colocar a data exata".
- ✅ Sugestão = seleção (D31 a D33).
- ⚠️ "Chuva que sobra depois da colheita" (mediana e ano seco, IMERG) com a frase: "em média" é a mediana, explicado na legenda (D37).
- ✅ Chuva (IMERG) × ETo (POWER) por mês, com o mês em que a chuva fica menor (D39, D40).
- ⚠️ Custo do atraso pelo motor: feito, mas a melhor cultura muda entre as faixas e a colheita tarde parece melhor (milheto 20 de 20; números estranhos).
- ⚠️ Fim das chuvas com a regra do pedido: feito; a regra é sensível (16/mar a 22/jun na lavoura de demonstração), a calibrar pela agrônoma.

### 4. O que o satélite viu (raio-X)

- ✅ Painel escuro, números grandes em fonte tabular, grade de blocos e selo de fonte e resolução em cada um.
- ⚠️ Cabeçalho com lugar, coordenadas, miniatura e leitura mais recente; a altitude não aparece (o `grid_cell` não tem a coluna e o pedido manda não buscar fora, D65).
- ✅ Animação na chegada, respeitando "reduzir movimento".
- ✅ Bloco 1, solo (SoilGrids, barra dividida, "Não é? Trocar"), com a vizinha mais perto até 15 km dita no bloco (D58).
- ✅ Bloco 2, água que a terra guarda e "aguenta cerca de N dias" (D57, a revisar).
- ✅ Bloco 3, umidade do SMAP em medidor (a leitura é de novembro, não da época do plantio).
- ✅ Bloco 4, verde da lavoura: último NDVI e pico da soja; sem soja no ponto, "maior verde" (S9, D137).
- ✅ Bloco 5, chuva de um ano típico e o fim das chuvas.
- ⚠️ Bloco 6, maior veranico de março a maio: feito; o trecho mais longo costuma ser o começo da seca, não um veranico na chuva.
- ✅ Bloco 7, anos com 35 °C de março a maio (POWER).
- ⚠️ Bloco 8, a área e a região: "mais seca que X%" vira "mais chuvosa que Y%" quando a maioria chove menos (D59).
- ✅ Rodapé "Cada dado vale para a área em volta do ponto…".
- ⚠️ Histórico em faixa de calor do NDVI com "soja / colheita / entressafra" e o título: com os anos 2017–2026 (D5), não 2016–2025.
- ✅ Alerta de geada (só com risco; nenhum ano nos 3 pontos de teste).
- ✅ Alerta de chuva forte, com a frase da terra descoberta e o "Saiba mais: Como evitar erosão" (S9).
- ✅ Alerta de fogo pelo MCD64A1 da ORNL (o produto existe; sem o índice substituto, D63): arquivo pronto em 15/11 05:56 (22.415 pixels, 2016–2025); na fazenda, fogo a até 5 km em 5 de 10 anos.
- ✅ Sem alerta de granizo.
- ✅ Cartões menores "20 anos de chuva" e "Clima 2041–2060" com "ver na sugestão"; o clima agora é o mesmo da Sugestão (S9, D130).
- ✅ Botão "Ver o que plantar".

### 5. Abas da resposta

- ✅ Ordem e nomes "Sugestão", "Comparar", "Plano de 3 anos", contando a mesma história (URLs antigas mantidas, D67).
- ✅ 5.1 "O que você quer mais?" ("Mais segurança", "Renda", "Cuidar da terra") reordena as três abas e fica entre elas; no celular, os botões não quebram o texto (S9, D141).
- ✅ 5.2 Imagem da planta em todo cartão, chip e artigo de cultura (SVG próprio, D4).
- ✅ 5.3 Selo "Sede da cultura" (cortes no `regras.yaml`, hipótese do time, D73).
- ⚠️ 5.3 Linha "Água" (precisa, costuma chover, falta em ano normal e seco): o "ano seco" da falta é o percentil 80 (D72), e a nota diz que o ano normal é a mediana (S9, D135).
- ✅ 5.3 Versão 2041–2060 da falta de água, com a faixa entre os modelos.
- ✅ 5.3 Nenhum número para palhada, enxurrada ou água da próxima safra: só no Guia.
- ❌ 5.3 Irrigação opcional ("Você irriga essa área?", "Água a repor", m³/ha): não feita, por tempo; o "deu certo" não muda com ela.
- ✅ 5.4 "Ano 1 do seu plano" com os 3 anos em miniatura e "Explorar o plano".
- ⚠️ 5.4 "Deu certo" explicado com o critério real do motor (55% da água e menos de 3 dias de 35 °C), não com o "nenhum dia de 35 °C" do texto do pedido (D74).
- ✅ 5.4 Explorador ano a ano (barras 2005–2024, linha de corte, El Niño e La Niña escritos) e o detalhe do ano (a antiga `/safra-passada`).
- ✅ 5.4 Frase de El Niño / La Niña só com diferença clara (D76).
- ✅ 5.4 Linhas na ordem Deu certo, Água, Clima 2041–2060, Renda e Terra (o clima e o nematoide coerentes com as outras telas desde a S9).
- ✅ 5.4 "Como fazer" em 4 partes, com "Passo a passo completo".
- ✅ 5.4 Aviso único da colheita tarde com a lista, a linha do ZARC com o link e a geada quando houve.
- ✅ 5.4 Botão e tela "Relatório para banco ou seguro" removidos.
- ✅ 5.5 Até 3 culturas por chips com imagem e sede; por padrão as 3 melhores do objetivo; fora da janela, desligadas com o motivo.
- ⚠️ 5.5 Colunas com as mesmas linhas: feitas; "Por que usar" e "Por que evitar" saem dos rótulos do motor e podem dizer "pouco risco" ao lado de "Deu certo: Médio" (rótulos diferentes de chuva e renda).
- ✅ 5.5 "Se você prefere…" é o ponto de partida do Comparar; "Usar no meu plano" leva a cultura ao ano 1.
- ❌ 5.5 "[A] no lugar de [B] economiza N mm por safra": depende da irrigação opcional, não feita.
- ✅ 5.6 Montar a rotação com as notas na hora, ao lado do "Como é hoje", e "Voltar ao plano sugerido".
- ✅ 5.6 Saúde da terra com fatos (coberta, nitrogênio, nematoide com a regra única desde a S9, repetição).
- ✅ 5.6 "Chuva aproveitada" com a frase do pedido, sem estimar a evaporação no pousio.
- ✅ 5.6 "Como é hoje" com o NDVI das 3 últimas safras e "O que foi?"; sem resposta, a referência dita como referência.
- ⚠️ 5.6 Plano A e Plano B numa frase cada; "secar" sem número, porque nenhum limite separou bem os anos (D115), e a tela diz isso.
- ✅ 5.6 "Comece por um pedaço" e "Como teria sido em 2024?" removidos.

### 6. Avisos

- ✅ Botão "Avisos" ao lado de "Comunidade" com o contador.
- ✅ Ponto salvo no aparelho, sem cadastro; sem ponto, pede para marcar; sem push.
- ✅ Cada aviso com o nível em texto, o que o dado mostra, o que fazer, a fonte e a data; grupo vazio com "Nada fora do normal" e a data.
- ✅ Agora: terra seca pelo SMAP (leitura antiga marcada).
- ✅ Agora: dias sem chuva e calor pelo NASA POWER recente, no backend, com cache de 24 h; sem o POWER, o aviso some.
- ✅ Agora: nenhuma comparação da chuva recente com "o normal".
- ✅ Agora: El Niño / La Niña com a previsão e os anos parecidos; o "o que fazer" segue o sinal do Plano (S9, D133).
- ⚠️ Agora: regra do replay durante a safrinha: só testada com o "hoje" injetado (em novembro não há safrinha); fora dela, o link "Ver como teriam sido os avisos em 2024" funciona.
- ✅ O que mudou (2020–2024 × 2005–2019) com os dois números e "são poucos anos"; a falta de água diz "na média dos anos" (S9).
- ✅ Fora do comum: recordes com o ano.
- ✅ Perto de você: eventos dos vizinhos dos últimos 7 dias a até 30 km, "relato de vizinho, não confirmado".
- ⚠️ Rodapé "Alertas oficiais" com todo o texto, os botões de SMS, WhatsApp, 193 e 199 e o artigo: é o último bloco da tela, não uma barra presa (D102).

### 7. Comunidade

- ✅ Três relatos sem cadastro e sem texto livre, em até 3 toques; fogo mostra o 193 e agora o "Saiba mais: Fogo na palha"; enxurrada ou erosão liga para "Como evitar erosão" (S9).
- ✅ Só a célula de 0,1°; "Seus vizinhos veem a região, não o seu ponto." antes do primeiro envio.
- ✅ Sem login: identificador aleatório no aparelho, limite de 10 em 24 h, apagar os próprios relatos.
- ✅ Validação (chuva de 0 a 300 mm; datas até 30 dias atrás, nunca futuras).
- ✅ Todo relato como "relato de vizinho, não confirmado".
- ⚠️ Tabela `community_report` com o tipo aberto: feita; a migração não foi aplicada no banco do Docker do usuário (rodar `docker compose run --rm migration` depois do merge).
- ✅ Endpoints enviar, listar por ponto e raio, apagar.
- ✅ Mapa de 30 km com os relatos por célula, ícone e texto por tipo.
- ⚠️ Resumo "Perto de você": plantio e eventos feitos; a chuva dos vizinhos não tem o satélite ao lado (não há chuva recente do satélite ligada: o IMERG Late saiu do sinal e o banco só tem jan–jul).
- ❌ Área queimada do MODIS no mapa da comunidade: o arquivo ficou pronto durante a S9 e o raio-X já usa; o mapa da comunidade ainda não lê (fica para uma próxima tarefa, com um endpoint dos pixels por perto).
- ✅ Região pelo satélite (NDVI) continua escondida até a calibração.
- ✅ Sem relatos falsos; exemplos só no modo `mock`, com o selo "Exemplo".
- ✅ "Compartilhar com a comunidade" depois de confirmar as safras (na tela 4, onde a confirmação acontece).
- ✅ Entrada para o Guia no fim da tela.

### 8. Guia

- ✅ `/guia` com os 5 temas e busca por título; `/guia/<artigo>` com a estrutura fixa, 150 a 300 palavras.
- ✅ Fontes só de páginas abertas e conferidas (`verifiedSources.ts`, com teste).
- ✅ "Rascunho: a revisar pela agrônoma." nos artigos de cultura, plantio e manejo; artigos de cultura com a imagem da planta; texto puro para o "Ouvir".
- ✅ Tema A (6 culturas), Tema C (erosão, palhada, adubo verde, nematoide, rotação), Tema D (deu certo, conta de água, veranico, calor de 35 °C, quando a chuva acaba, El Niño e La Niña, clima 2041–2060, raio-X) e Tema E (alertas, fogo na palha, geada), mais "Como ler os avisos".
- ⚠️ Tema B: plantio direto, ZARC e plantar logo depois da colheita feitos; "Sementes" feito sem número de germinação e vigor (a norma é um PDF que não deu para abrir, D142).
- ✅ Links "Saiba mais" da tabela da seção 8, todos ligados desde a S9 (chuva forte, erosão e fogo da comunidade eram os que faltavam).

### 9. Consistência

- ✅ A tela de missão lista só as fontes usadas de fato e o número certo de opções (D139).
- ✅ "Como a conta é feita" reflete as regras novas (deu certo, renda sem preço, água, sede da cultura, nota da rotação, Plano B, fogo, geada, avisos, sinal e raio-X), com os números do `/api/metodo` (D140).
- ✅ Nenhum link para as telas removidas (relatório e safra passada solta); os redirecionamentos das URLs antigas ficam (teste, D143).

## Números estranhos encontrados

### Resumo organizado (depois da S9)

Os mesmos itens do histórico abaixo, agrupados, com o estado de cada um. O histórico fica como foi anotado em cada seção.

**Resolvidos na S9**

- Clima 2041–2060 com sinais opostos na Sugestão (−0,7%) e no raio-X (+2,2%): as duas telas mostram +2,2% (D130).
- Sinal do outono × aviso de El Niño e sinal falando do Plano A sugerido com o plano editado: o mesmo conselho e o Plano A da tela (D131 a D133).
- Falta de água "média" × "mediana": palavras alinhadas (D135).
- "Quebra o nematoide" em dois sentidos: uma regra só (D136).
- "Pico da soja 0,33" no ponto da cidade: "maior verde" quando não há soja (D137).
- "Ver um exemplo pronto" com a faixa errada na URL: a faixa do satélite (D138).

**Continuam (decisão da agrônoma ou do produto)**

- Critérios diferentes de "deu certo" para grão e cobertura: milheto e crotalária ficam em 1º no "Mais segurança" e no custo do atraso (colher tarde parece melhor), e o explorador fica "achatado" nas coberturas.
- Rótulos diferentes de chuva (85/60) e renda (70/30) na mesma opção ("Médio" × "Bom", "pouco risco" no Comparar).
- "Deu certo" do pedido ("nenhum dia de 35 °C") × motor (3 dias ou mais).
- Planos que repetem a mesma cultura (crotalária × 3, milho com braquiária × 3) e a saúde da terra que não pune a repetição.
- Fim das chuvas sensível a um veranico em março ou a chuva fora de época (16/mar a 22/jun na lavoura de demonstração); maior veranico de março a maio que mede o começo da seca.
- "Parado em 0 de 10 anos" na lavoura de demonstração e soja recente pegando pasto e cerrado verdes (96% da caixa).
- Clima 2041–2060 muda pouco a falta de água e a nota de futuro sai igual à de segurança na lavoura de demonstração.
- Plano B sem número em todas as faixas da lavoura de demonstração; queda do "deu certo" para 3 de 5 em 2020–2024.
- SMAP "de agora" em novembro; POWER recente com 2 a 3 dias de atraso; calor de 35 °C em novembro fora da safrinha.
- Bloco 8: 1,6% de chuva a mais vira "mais chuvosa que 62% da região" (a caixa é pouco variada).

**Novos na S9**

- **Fogo perto da lavoura de demonstração:** com o MCD64A1, fogo a até 5 km em 5 de 10 anos (2016, 2018, 2019, 2020 e 2024). É muito; o raio de 5 km pega pasto, cerrado e beira de estrada em volta. Vale a agrônoma olhar o raio (`alertas_area.fogo_raio_km`).
- **Sinal do outono "normal" nos 3 pontos de teste:** com El Niño de 98%, a melhor opção deu certo em 5 a 7 dos 7 anos de El Niño; nenhum ponto chega ao `seco`. Com o Plano B da tela (D131), o `seco` pede a cultura do Plano B melhor nesses anos.
- **Colheita tarde e ponto da terra seca sem Plano B:** o milheto (tarde) e a crotalária (terra seca) nunca falharam na série; o sinal fica `normal` e o cartão diz que não há Plano B.

### Histórico (como anotado em cada seção)


- **Renda e chuva com rótulos diferentes na mesma opção:** milho com braquiária na lavoura de demonstração (16 de 20) sai "Médio" na chuva e "Bom" na renda, porque os cortes são 85/60 na chuva e 70/30 na renda. A segurança pesa duas vezes para quem dá grão (segurança 30% + renda 30%).
- **Plano A da lavoura de demonstração (colheita cedo e meio):** milho com braquiária em 2027 e 2028; e a regra da data diz "siga o plano B; o 1º ano continua com milho com braquiária", porque o 1º ano do Plano B é a mesma cultura. A frase fica estranha; a S5b refaz o Plano A/B.
- **CMIP6 na lavoura de demonstração:** a nota de futuro sai igual à de segurança em todas as opções (os deltas não mudam nenhum ano de "deu certo" para "faltou" nesse ponto). Conferir na S4/S5a.
- **"Deu certo" no pedido × motor:** o pedido diz "nenhum dia de 35 °C nessa fase"; o motor (`regras.yaml`, `calor_min_dias`) conta aperto com **3 dias ou mais** de 35 °C na fase crítica. Os textos seguem o motor; mudar a regra é decisão da agrônoma.
- **Soja recente (RF-24):** 96% dos pixels da caixa piloto têm pico de NDVI ≥ 0,70 em jan–mar de 2026 (pasto e cerrado também ficam verdes na chuva). O aviso do começo pega cidade, água e solo exposto, mas não distingue soja de pasto.
- **Região pelo satélite calibrada (tarefa 0036):** depois de tirar cana, café e pasto, a soja do ano é 45–58% da lavoura, mas "parado" ainda fica entre 0,7% e 6% (plantou 72–96%). Só 2 de 10 anos passam no critério de crível combinado com o usuário (parado entre 5% e 80%), então a região continua escondida. Pode ser real (safrinha comum no Triângulo) ou mato que rebrota com a chuva de março.
- **S1, lavoura de demonstração (banco local):** a nota "futuro" (CMIP6) sai igual à "segurança" em todas as
  opções nos 3 cenários de colheita (ex.: milho 90/90, 80/80). Os deltas do CMIP6 não mudam nenhum ano
  de "deu certo" para "faltou" nesse ponto; vale conferir na S4/S5a (linha "Clima 2041–2060").
- **S1, Plano A da colheita cedo na lavoura de demonstração:** com a renda nova, milho com braquiária nos 3 anos (nota 85,0
  contra 84,7 com crotalária no 3º ano). O PRD 7.7 não pune repetição; a S5b mostra a repetição como fato.
- **S3, custo do atraso na lavoura de demonstração parece "premiar" a colheita tarde:** cedo, milho com braquiária deu certo
  em 18 de 20; meio, milho com braquiária, 16 de 20; tarde, **milheto, 20 de 20**. A melhor muda para uma
  cobertura, que tem outro critério de "deu certo" (ISNA 0,50 nos primeiros 30 dias, contra 0,55 na
  floração do grão). A frase diz a cultura de cada faixa, mas a leitura rápida é "colher tarde é melhor".
  Vale decidir (agrônoma/produto) se o custo do atraso deve comparar a mesma cultura nas três faixas.
- **S3, fim das chuvas na lavoura de demonstração vai de 16/mar (2021) a 22/jun (2012)**, com a mediana em 21/abr. A regra pega
  o primeiro trecho de 20 dias com menos de 10 mm a partir de 1º/mar: um veranico em março já conta como
  fim (2005: 26/mar, apesar de 94 mm em maio e junho), e uma chuva fora de época empurra o fim (2012: 108 mm
  em maio e junho, fim em 22/jun). O IMERG da célula confirma a chuva; o número é real, mas a regra é
  sensível. Cabe à agrônoma calibrar (ex.: exigir também pouca chuva nos 30 dias seguintes).
- **S3, "em média" é a mediana:** o texto pedido diz "sobram em média X mm", e o número é a mediana (367 mm
  em 25/fev na lavoura de demonstração). A legenda explica; se preferirem a média de verdade, é uma linha no service.
- **S3, dia sugerido na lavoura de demonstração é 25/fev** (10 anos de NDVI), na faixa "fim de fevereiro ou março". O MOD13Q1 é
  de 16 dias (Terra e Aqua defasados em 8): o dia é a data da composição em que o NDVI caiu, não o dia exato
  da colheita. Com a regra nova (D31), um ponto com mediana em 21 ou 22/fev passa de "meio" para "tarde".
- **S5a, falta água mesmo chovendo mais do que a planta precisa:** na lavoura de demonstração, colheita meio, o milho com
  braquiária precisa de 346 mm no ciclo, costuma chover 400 mm e ainda faltam 116 mm (158 num ano seco). A
  chuva se concentra em fevereiro e março, a terra só guarda 60 mm (solo argiloso) e o excesso escorre; no fim
  do ciclo (abril a junho) falta. É a conta do balde do PRD 7.2; a tela explica numa frase.
- **S5a, explorador "achatado" nas coberturas:** milheto e crotalária têm ISNA de 1,0 em todos os 20 anos na
  lavoura de demonstração (a fase crítica da cobertura são os 30 primeiros dias, os mais chuvosos), então todas as barras ficam no
  topo. O "deu certo" delas quase só depende do calor. O mesmo motivo põe a crotalária em 1º no "Mais
  segurança" (19 de 20, contra 16 de 20 do milho com braquiária no meio): critérios diferentes para grão e
  cobertura (como no custo do atraso da S3).
- **S5a, clima 2041–2060 muda pouco a falta de água:** de +1 a +12 mm em ano normal (chuva de março a maio
  −0,7%, máxima +1,3 °C, média dos 3 modelos); a faixa entre os modelos (ex.: 112 a 143 mm no milho) é maior
  que a mudança. Coerente com a nota de futuro igual à de segurança (S1).
- **S5a, sede da crotalária perto do corte:** 272 mm na colheita cedo contra o corte de 280 mm; a sede pode
  virar "média" em outro ponto ou com outro solo. Os cortes são hipótese do time (D73).
- **S5a, planos dos objetivos repetem a cultura:** renda = milho com braquiária nos 3 anos; terra =
  crotalária nos 3 anos (lavoura de demonstração, meio). O PRD 7.7 não pune repetição; a S5b mostra a repetição como fato.
- **S5a, El Niño / La Niña:** a frase não aparece para a melhor opção em nenhuma faixa na lavoura de demonstração; aparece para o
  sorgo (meio: El Niño 4 de 7 contra 11 de 13; tarde: La Niña 6 de 8 contra 5 de 12). Em La Niña o sorgo da
  colheita tarde se sai **melhor** que nos outros anos: são poucos anos, a tela diz isso.

- **S4, histórico da lavoura de demonstração: parada em 0 de 10 anos.** O NDVI depois da colheita fica entre 0,7 e 0,9 em abril e
  maio todos os anos (a faixa de calor mostra isso): o pixel plantou (ou tem capim) em todas as
  entressafras de 2017 a 2026. Pode ser real (o ponto fica perto da Fazenda do Glória, área experimental, mas não
  garantidamente dentro dela); vale conferir no campo.
- **S4, região na lavoura de demonstração:** 330,7 mm de março a maio contra a mediana da caixa de 325,6 mm (1,6% a mais), e a
  frase diz "mais chuvosa que 62% da região". A caixa é pouco variada nessa época: a porcentagem parece
  maior que a diferença em mm (o bloco escreve os mm logo depois).
- **S4, chuva forte na lavoura de demonstração:** 5 dias com 50 mm ou mais em fevereiro e março em 20 anos = 0,25 dia por ano,
  que a tela escreve "0,3 dia por ano" (o pedido pede a média por ano). "5 dias em 20 anos", que a frase
  também diz, é mais fácil de ler.
- **S4, maior veranico na lavoura de demonstração: 43 dias, a partir de 19/abr/2024.** De março a maio, o trecho seco mais
  longo quase sempre é o começo da seca no fim de abril e em maio, não um veranico dentro da época de
  chuva. O número é real (IMERG), mas a janela do pedido mistura as duas coisas.
- **S4, água que a terra guarda depende da faixa de colheita:** na colheita tarde (a do satélite na lavoura de demonstração) a
  melhor opção é milheto (Kc 1,0, 16 dias); no cedo e no meio, milho com braquiária (Kc 1,2, 13 dias). É
  o mesmo efeito do custo do atraso da S3 (a melhor cultura muda).
- **S4, clima 2041–2060 na lavoura de demonstração:** chuva de março a maio +2,2% (2 de 3 modelos indicam mais chuva) e máxima
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

- **S5a × S4, clima 2041–2060 com sinais opostos na mesma célula:** −0,7% na Sugestão e +2,2% no raio-X
  (chuva de março a maio). Ver a revisão da S5a; corrigir na S9.
- **S5a, plano "Cuidar da terra" na fazenda: crotalária nos 3 anos.** Repetir a mesma cobertura três vezes
  vai contra a diversidade que o próprio PRD 7.7 premia na rotação; o plano de renda repete milho com
  braquiária. Vale a S5b (plano editável) e a agrônoma olharem.
- **S6, falta de água no ciclo é grande na lavoura de demonstração:** milho com braquiária, 101,6 mm por ano em 2005–2019 e 177,4 mm
  em 2020–2024. O ciclo (18/fev + 120 dias = 18/jun) entra na seca, então a conta junta a falta do fim do ciclo,
  quando o grão já está formado; o "deu certo" olha só a fase crítica. Vale comparar com a linha "Água" da S5a.
- **S6, "deu certo" caiu de 13 de 15 para 3 de 5 na lavoura de demonstração** (milho com braquiária), e no ponto da terra seca de 15 de
  15 para 3 de 5 (milheto). São 5 anos: a frase diz que é pouco, mas a queda chama a atenção.
- **S6, El Niño na lavoura de demonstração:** milho com braquiária deu certo em 5 de 7 anos de El Niño e em 11 de 13 nos outros (71% ×
  85%). Com 7 anos, 1 ano a mais muda a leitura.
- **S6, maior veranico de março a maio subiu de 20,8 para 27,2 dias na lavoura de demonstração, e o fim das chuvas veio 11 dias mais
  cedo (24/abr → 13/abr):** os dois medem quase a mesma coisa (o começo da seca cai dentro da janela de março a
  maio, como já anotado na S4).
- **S6, POWER recente com atraso:** em 15/11, o último dia com dado no POWER é 12/11; 13 e 14/11 voltam −999. A
  data da leitura vai em cada aviso.
- **S6, calor em novembro:** no ponto −19,55 / −48,95, 5 dias de 35 °C ou mais de 3 a 12/11, e o aviso de calor
  aparece fora da safrinha. O "o que fazer" ficou condicional ("Se a lavoura estiver na floração…").
- **S6, terra seca:** só 3 das 225 células têm o SMAP de 10/11 no percentil 20 ou menos, todas no sudoeste da caixa
  (−19,55 / −48,95: 15,3). A lavoura de demonstração está no 59,3.

- **S5b, Plano B sem número em todas as faixas da lavoura de demonstração:** na colheita meio, as 4 falhas do milho com braquiária
  tiveram 77, 102, 129 e 164 mm nos 15 dias antes de plantar, no meio dos anos bons (31 a 181 mm): nenhum limite acerta
  mais do que erra. A falha da safrinha vem da floração, ~2 meses depois do plantio; a chuva antes de plantar quase não
  diz nada sobre ela.
- **S5b, "quebra o ciclo do nematoide" em dois sentidos:** a linha Terra (frase do PRD 7.6, `solo_pragas` > 0) diz que
  sorgo e milho com braquiária "ajudam a quebrar"; os fatos do Plano contam só crotalária e milheto (as supressoras do
  PRD 7.7). A agrônoma decide qual vale.
- **S5b, "usa" × linha Água:** o milho com braquiária usa 221 mm (mediana da ETr) e a linha Água diz precisa 346 − falta
  116 = 230 mm. São medianas de coisas diferentes (a mediana da diferença não é a diferença das medianas).
- **S5b, "Cuidar da terra" ainda ganha repetindo:** crotalária nos 3 anos tem saúde da terra 85 (sem bônus); o plano do
  equilíbrio (milho com braquiária, milho com braquiária, crotalária) tem 71,7 com +10 de diversidade. A repetição aparece
  como fato.
- **S5b, "Como é hoje" na colheita tarde:** a referência do motor é deixar parado nos 3 anos (o milho não cabe na janela),
  então as notas de hoje saem "Sem lavoura" e a terra 0, contra 85 / 53 / 85 do plano. A tela diz que é referência.
- **S5b, sinal do outono × Plano A editado:** com sorgo no ano 1, a frase do sinal ainda fala do milho com braquiária (o
  Plano A sugerido); o Plano B da tela (crotalária) também não é o do sinal. Unificar na S9.
- **S5b, na lavoura de demonstração o satélite viu plantio nas 3 últimas entressafras** (verde máximo 0,71, 0,80 e 0,89): a tela pergunta "O
  que foi?" nos 3 anos. Coerente com o "parada em 0 de 10 anos" da S4.

- **S5b, saúde da terra do plano editado:** sorgo, milheto e crotalária (nenhuma repetição, 2 anos que quebram o
  nematoide) dá 68, menos que o plano sugerido (72), que repete milho com braquiária; e o "Cuidar da terra"
  (crotalária × 3) dá 85. A nota é a média da nota de solo de cada cultura mais o bônus de diversidade (D111):
  a repetição não perde ponto. Vale a agrônoma calibrar.
- **S5b, chuva aproveitada:** o plano sugerido usa 216 mm e o "Como é hoje" (milho sozinho) usa 221 mm. A frase
  não diz que o plano usa mais, mas a comparação lado a lado pode confundir.

## O que não foi possível e por quê

### Resumo organizado (depois da S9)

**Não feito**

- **Irrigação opcional** (5.3) e o "[A] no lugar de [B] economiza N mm" do Comparar (5.5): tempo; o "deu certo" não muda com ela.
- **Área queimada no mapa da comunidade** (7): o arquivo do MCD64A1 ficou pronto às 05:56 de 15/11, durante a S9; o raio-X, a missão e "Como a conta é feita" já usam, o mapa da comunidade ainda não (precisa de um endpoint com os pixels perto do ponto).
- **Chuva do satélite ao lado da chuva relatada** (7): não há chuva recente do satélite ligada (o IMERG Late saiu do sinal; o banco só tem jan–jul).
- **Número para "secar" no Plano B** (5.6): nenhum limite de chuva nem o SMAP separou bem os anos (D115).
- **Altitude no raio-X** (4): o `grid_cell` não tem a coluna e o pedido manda não buscar fora.

**Feito com limite**

- Link curto do Google Maps e graus/minutos/segundos em texto (2); o dia exato não volta da tela 4 (3, D33).
- Safrinha em andamento nos Avisos só testada com o "hoje" injetado (6); cache do POWER só na memória do processo.
- "Sementes" sem número de germinação e vigor (8, D142).
- Migração da comunidade não aplicada no banco do Docker do usuário: rodar `docker compose run --rm migration` depois do merge; configurar o `COMMUNITY_DEVICE_SALT` em produção.
- Conferência em 390 px: o Chrome sem interface desta máquina deixou de cortar em ~500 px (na S9 os prints de 390 px saíram certos).

**Resolvido na S9 (estava aqui antes)**

- Limpeza do front e o `regra_dia_plantar` (S5b): feita (D134).
- "Ver um exemplo pronto" com `colheita=meio` fixo (S3): corrigido (D138).
- Artigos que faltavam (plantio direto, sementes, erosão) e os "Saiba mais" de chuva forte e dos relatos de fogo e erosão (S4, S7, S8): feitos (D142).
- Extração completa do MCD64A1 (S4): pronta; o alerta de fogo aparece com o arquivo.

### Histórico (como anotado em cada seção)


- **S5b, número para "secar":** nenhum limite de chuva dos 15 dias antes da semeadura separa bem (D115). Colheita meio,
  milho com braquiária: 4 falhas, nenhum limite com mais acertos que alarmes falsos. Cedo: só 2 falhas (mínimo 3). Tarde:
  o milheto nunca falhou (sem Plano B). O sorgo da tarde (1º ano do plano "Renda") tem 9 falhas e o melhor limite (100 mm)
  marca 10 anos com 6 falhas: pega 67% das falhas, 60% dos marcados são falha, **mas o acaso faz o mesmo em 18,5% das
  vezes** (o critério pede 10% ou menos). O Plano B aparece sem número, com a regra da terra seca no dia de plantar.
- **S5b, SMAP como indicador:** só 9 anos na série do motor (2016 a 2024); na colheita meio, as falhas do milho com
  braquiária tiveram 40%, 40% e 44% da água que a terra guarda, no meio dos anos bons (35% a 46%). Também não separa, e o
  produtor não confere o SMAP no pluviômetro.
- **S5b, irrigação** (opcional da 5.3, com o "[A] no lugar de [B] economiza N mm" do Comparar): não feita (tempo).
- **S5b, "outra" cultura no "Como é hoje":** fora, o motor não avalia; cultura respondida que não cabe na janela da faixa
  de agora entra sem números.
- **S5b, limpeza:** `buildPlan`, `planSwaps`, `planSummary`, `initialScenario`, `plantingRule`, `optionsSummary`,
  `buildAnswer`, `optionsForObjective`, `PAST_YEARS` e as chaves `plan.*` antigas ficaram sem uso no front; o
  `regra_dia_plantar` do sinal segue na API sem uso na tela. Fica para a S9.

- **S5a, irrigação (opcional da 5.3):** "Você irriga essa área?" atrás de uma opção desligada não foi feita
  (tempo); fica para a S5b ou depois. O "deu certo" não muda com ela.
- **S5a, geada na lavoura de demonstração:** nenhum ano com mínima de 3 °C ou menos de maio a julho no POWER da célula; a linha
  da geada não aparece na fazenda de exemplo (o código e os testes cobrem quando há).
- **S5a, Comparar e Plano completos:** só ganharam o objetivo, a imagem da planta, o selo de sede e (no
  Comparar) a linha Água; o resto é da S5b. O "Como teria sido em 2024?" do Plano abre o detalhe de 2024 no
  explorador (a S5b tira o botão).

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
  recomenda com a faixa do satélite (tarde na lavoura de demonstração). Na tela 3 isso já não engana (D33), mas a resposta do
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

- **S6, safrinha em andamento com dado real:** em 15/11 não há safrinha; a regra dos avisos do replay nos dias
  recentes foi conferida só com o "hoje" injetado nos testes (fev a jun de 2027).
- **S6, link do ano antes da S5a:** `/resposta?…&ano=2024` abre a Sugestão sem o detalhe do ano até a S5a entrar.
- **S6, cache do POWER:** fica na memória do processo; reiniciar a API (ou ter mais de um processo) pede o POWER de
  novo. Um cache em arquivo ou no banco pediria migração ou caminho novo, e o pedido não exige.
- **S6, chuva recente × normal:** não comparada, como manda o pedido (a série guardada só tem janeiro a julho).
- **S6, notificação:** sem push, como no pedido; os avisos aparecem quando o app é aberto.
- **S6, falta de água da linha "Água":** o grupo 2 tem a conta dele (`cycle_deficits`, mesmo balde do motor); se a
  S5a trouxer a falta de água por ano, unificar no merge.
