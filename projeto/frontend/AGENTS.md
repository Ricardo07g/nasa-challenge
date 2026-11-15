# AGENTS.md: frontend (interface)

Complementa o `AGENTS.md` da raiz (leia primeiro: TDD obrigatório e arquitetura em camadas).
Aqui ficam só as regras do front.

## Stack

- **React 19** + **TypeScript**
- **Vite** (dev server e build)
- **Vitest** + **Testing Library** (testes, ambiente jsdom)
- **oxlint** (lint)
- **npm** (o `package-lock.json` é sempre commitado)
- Node **24** (mesma versão da imagem Docker)

## Estrutura (MVC + Service/Repository)

```
src/
  main.tsx              ponto de entrada do React
  App.tsx               liga o controller à view (sem lógica)
  models/               Model: tipos do domínio (ex.: CropOption)
  repositories/         Repository: ACESSO A DADOS. Único lugar com fetch (httpClient.ts)
  services/             Service: REGRAS DE NEGÓCIO do front (ex.: aplicar pesos ao ranking, RNF-02)
  controllers/          Controller: hooks use<Tela>Controller, guardam estado e chamam services
  views/                View: componentes que só desenham props, sem fetch e sem regra
  design-system/        tokens.css (cores, tipografia, raios, espaços), componentes e ícones
  test/setup.ts         configuração dos testes (jest-dom, limpeza)
  index.css             estilos globais
vite.config.ts          dev server, proxy /api -> backend e config do Vitest
```

Testes ficam **ao lado do arquivo** testado: `X.ts` → `X.test.ts`, `X.tsx` → `X.test.tsx`.

Exemplo de referência para copiar: tela inicial com as opções de entressafra
(`repositories/cropOptionRepository.ts` → `services/cropOptionService.ts` →
`controllers/useHomeController.ts` → `views/HomeView.tsx`).

## Fluxo TDD para uma funcionalidade nova

Sempre o teste antes do código, vendo ele falhar:

1. **Repository:** teste com `vi.stubGlobal('fetch', ...)` → função que chama `getJson('/api/...')`.
2. **Service:** teste com um repository falso (objeto com `vi.fn()`), criado por
   `create<X>Service(repositoryFalso)` → regra de negócio.
3. **Controller:** teste com `renderHook` passando services falsos → hook com o estado da tela.
   Crie os objetos falsos **fora** do callback do `renderHook` (senão o efeito roda em loop).
4. **View:** teste com `render` + `screen` passando props → componente.
5. **Ligação:** `App.tsx` (ou a página) chama o controller e passa o resultado para a view.

## Regras das camadas

- **Repository:** só HTTP, via `getJson` (e `sendJson`, para POST e DELETE) de `repositories/httpClient.ts`. Sem regra.
- **Service:** regras de negócio puras. Recebe o repository por parâmetro
  (`create<X>Service(repository = <x>Repository)`), para ser testável sem rede.
- **Controller (hook):** estado da tela, efeitos e handlers. Fala com services, nunca direto com repository.
  Recebe as dependências por parâmetro com padrão real (`use<X>Controller(deps = defaultDeps)`).
- **View:** só props → JSX. Sem `fetch`, sem `useEffect` de dados, sem regra de negócio.
- Sem classes com parameter properties nem `enum` (o `tsconfig` usa `erasableSyntaxOnly`).

## Comandos

Sem Docker:

```bash
cd projeto/frontend
npm install
npm run dev          # http://localhost:5173 (a API precisa estar em http://localhost:8000)
npm test             # testes uma vez
npm run test:watch   # testes em modo observação (bom para o ciclo TDD)
npm run lint
npm run build        # checa os tipos (tsc) e gera dist/
```

Com Docker (a partir de `projeto/`): `docker compose up --build frontend` e
`docker compose exec frontend npm test`. Depois de mudar dependências: `docker compose up --build -V`.

## Convenções

- **Chamadas à API:** sempre caminho relativo `/api/...`. O proxy do Vite encaminha para o backend
  (`API_PROXY_TARGET`, padrão `http://localhost:8000`). Não escreva URL do backend fixa no código.
- **Dados (`VITE_API_MODE`):** a **API real é o padrão** (variável vazia ou `http`, inclusive no
  `npm run dev` e no `docker compose`). Os dados de exemplo de `repositories/mocks/` só entram com
  `VITE_API_MODE=mock` explícito, e aí todas as telas mostram o aviso fixo "Modo de demonstração: dados de
  exemplo, não são da NASA". Só `repositories/index.ts` decide o modo e importa `repositories/mocks/`
  (um teste confere). Os testes rodam com `mock` (`test.env` do `vite.config.ts`), sem rede. A API só tem
  dados da área preparada: fora dela, as telas 4 a 7 mostram "Ainda não chegamos aí".
- **Dado que a API ainda não manda (decisão D2 da remodelagem, tarefa 0040 do backend):** com a API real,
  nenhuma tela mostra número de exemplo nem o selo "Ainda não conectado": **o elemento sem dado
  simplesmente não aparece** (cartão, linha, seção, fonte ou fase da missão). Um endpoint que ainda não
  existe (404 sem `code`) ou um repository sem versão http (`NotConnectedError`) vira o estado
  `not-connected` do controller (não é erro), e a view não desenha o bloco. Na tela 8, o 404
  `OUTSIDE_AREA` vira o estado `outside` (`RegionStatus`) e o bloco da região também não aparece.
  Campo novo de uma resposta que já existe (ex.: `chuva_mensal` do talhão) entra **opcional** no model
  (`campo?: X | null`): ausente (API antiga) ou `null` = o elemento não aparece. Enquanto o dado carrega,
  a tela não mostra nem o dado nem aviso. O design system não tem mais `NotConnected`, `NotConnectedCard`
  nem `status="unavailable"`: não traga de volta.
- **Nenhum valor em reais (seção 1 da remodelagem, tarefa 0040 do backend):** nenhuma tela, texto, mock ou
  teste mostra R$. A dimensão é **Renda** (eixo `renda`, motivo `mais_renda`) e só mostra fatos: o bloco
  `renda` de cada opção (`da_grao`, `anos_aperto`, `rotulo`, `texto` = "Dá grão para vender" ou "Não dá
  grão: é investimento na terra", `risco` = "Risco de perder a lavoura: … em N de 20 anos."), com os
  textos prontos da API. Reordenar por renda usa `notas.renda` (a nota do motor, sem preço nem custo). O
  bloco "Comece por um pedaço" (hectares e totais em reais, RF-21) saiu.
- **O que a URL guarda (RF-18):** `services/flowParams.ts` lê e monta `lat`, `lon`, `colheita`, `solo`,
  `exemplo` e `confirmadas` (as safras que o produtor confirmou na tela 4, `2024:plantou,2025:parado`,
  em ordem de ano e sem codificar `:` e `,`, para o link continuar legível). Toda tela que pede a
  recomendação passa o `confirmadas` da URL para o `farm.recomendacao` (o cache do `farmService` separa
  por ele). Na fazenda de exemplo, com safra confirmada, com a terra trocada (`solo`) ou com uma faixa
  na URL diferente da do `/exemplo` (a do satélite), a recomendação vem do `/recomendacao` do ponto do
  exemplo, não do `/exemplo` (tarefa 0049: a resposta e a URL dizem a mesma faixa). O exemplo pronto
  (`/exemplo`, `useExampleController`) abre a resposta com a faixa do satélite do exemplo
  (`colheita_sugerida.faixa`; sem ela ou com falha, `meio`), não mais com `colheita=meio` fixo. Desde a
  tarefa 0052, a tela inicial não tem mais o botão "Ver um exemplo pronto": o exemplo entra por "Onde fica a lavoura".
  Desde o pacote 2 (tarefa 0054), a URL guarda também `data` (a data da colheita da tela 2, `AAAA-MM-DD`, só
  data que existe), `safras` e `pensa` (as respostas das últimas safras, ver "Pacote 2" abaixo), no fim e
  legíveis. O `confirmadas` e o `hoje` continuam no `FlowParams` para as telas que ainda não mudaram.
- **Safras confirmadas (tarefa 0039 do backend, RF-25):** a regra antiga (`confirmadas=2024:plantou,2025:parado`)
  fica em `services/confirmedSeasonsService.ts` (ler e escrever o parâmetro, pôr a resposta do produtor no
  lugar do satélite com `fonte_ano: 'produtor'` e o aviso "Não parece uma lavoura de soja", `noSoyAtPoint`). **Desde
  o pacote 2 (tarefas 0054 e 0058), a tela 4 confirma por safra:** a cultura do depois de cada uma das 3 últimas
  safras (`safras=2024:milho_braquiaria,2025:pousio,2026:sem_soja`) e o que o produtor pensa plantar na atual
  (`pensa`), com o `SeasonAnswersForm` e o `seasonAnswersService` (lê também o `confirmadas` e o `hoje` dos links
  antigos; responder grava `safras` e tira os dois). Para a API, `confirmadasFromAnswers`. As linhas são as
  `LAST_SEASONS` com o que o satélite viu (`seasonRows(historico)`). A tela 4 pede o `/talhao` e o `/raio-x`
  **sem** as respostas (o que o satélite viu) e aplica as respostas no front, para responder não recarregar nada.
  Tudo vai para a URL pelo `useReplaceFlow` (clicar não mexe na rolagem; teste em `pages.satellite.test.tsx`).
- **Comunidade "em breve" (pacote 3, tarefa 0061, RF-44):** a interface **não mostra** a comunidade. A rota
  `/comunidade` continua (links antigos, com ou sem o caminho da lavoura) e mostra só o cartão "Em breve ·
  Comunidade da sua região" com "Abrir o Guia" (`CommunitySoonPage` → `useCommunitySoonController` →
  `CommunitySoonView`, textos no bloco `comingSoon`), com o "← Voltar" e o "Ouvir resumo". A tela 4 não oferece
  "Compartilhar com a comunidade" e a vitrine `/design-system` não mostra os vizinhos. Nenhuma tela leva a relatos de
  vizinhos: não crie link, botão nem texto que chame para eles. **O código continua no repositório**, com os testes,
  para voltar fácil: o backend inteiro e, no front, repository, service, models, `CommunityForms`, `ShareSeasons`,
  `CommunityView`, `useCommunityController`, `CommunityPage` e os componentes dos vizinhos do design system. Quem
  desliga é uma constante só, `COMMUNITY_OPEN` (`services/communityService.ts`, `false`): o `routes.tsx` escolhe a
  tela de `/comunidade` por ela e o `useSatelliteController` só oferece compartilhar com ela ligada (`communityOpen`
  nas dependências, para os testes). Não apague esse código. O que vem abaixo descreve a comunidade como funciona
  quando ligada.
- **Comunidade ("Na sua região", tarefa 0047 do backend, RF-27):** relatos sem cadastro, sem texto livre e
  sem dado pessoal. O contrato está em `models/community.ts` (`RelatoComunidade`, `RelatosVizinhos`,
  `NovoRelato` e as listas fechadas `CULTURAS_RELATO`, `RESULTADOS`, `MOTIVOS`, `EVENTOS`, iguais às do
  backend). `repositories/communityRepository.ts` lista, envia e apaga (`GET`/`POST
  /api/comunidade/relatos`, `DELETE …/{id}`), sempre com o cabeçalho `X-Aparelho`; o `POST`/`DELETE`
  passa pelo `sendJson` do `httpClient.ts` (o único lugar com `fetch`). O identificador do aparelho é
  um UUID v4 aleatório (`crypto.getRandomValues`, que funciona fora de HTTPS) guardado no `localStorage`
  por `repositories/deviceRepository.ts`, com toda leitura e escrita em try/catch (sem `localStorage`,
  vale só para a visita); o mesmo repository lembra que o aviso "Seus vizinhos veem a região, não o seu
  ponto." já apareceu antes de um envio. As regras ficam em `services/communityService.ts`: os
  rascunhos viram relato só quando completos (`plantingReport`, `rainReport`, `eventReport`: chuva de 0
  a 300 mm, com vírgula ou ponto; data de 30 dias atrás até hoje; motivo só com "Perdi"; "Deixei
  parado" sem "Como foi"), o resumo "Perto de você" (`nearbySummary`: plantio da safra mais recente,
  chuva dos 7 dias, eventos dos 30), o mapa por célula (`cellMarkers`) e o motivo da falha
  (`reportErrorKind`: 429 = limite, 422 = valor recusado). Quem decide é o backend; os limites do front
  só desligam o "Enviar". Só conta quem marcou a própria lavoura (sem ponto ou na fazenda de exemplo, a
  tela pede "Marcar minha lavoura"). Todo relato aparece com o selo "Relato de vizinho, não confirmado";
  nunca crie relato de exemplo com a API real: os exemplos ficam em `repositories/mocks/mockCommunity.ts`
  (só no modo `mock`), cada um com `exemplo: true`, e a tela põe o selo "Exemplo". Sem relatos: "Ainda
  não há relatos perto de você. Seja o primeiro a contar." Sem banco no servidor (503
  `COMMUNITY_UNAVAILABLE`) ou sem a rota (404 sem código), a comunidade fica `not-connected` e não
  aparece. O mapa (`design-system/components/ReportsMap.tsx`) desenha o círculo do raio e um marcador
  por célula de 0,1° (nunca uma fazenda), com ícone e número por tipo e a legenda em texto. Na tela 4,
  depois de confirmar as safras, "Compartilhar com a comunidade" (`views/ShareSeasons.tsx`, estado no
  `useSatelliteController`) grava o relato de plantio de cada safra confirmada. Os campos dos relatos
  ficam em `views/CommunityForms.tsx`, usados pelas duas telas. Pacote 2: o ano do relato de plantio aparece pela
  safra (`seasonName`: "depois da soja 2025/26", "Em que safra?" com "2025/26", "Milheto, safra 2025/26"), e a
  região pelo satélite também ("Na safra 2024/25, …").
- **Avisos (`/avisos`, tarefa 0046 do backend, RF-31; refeita no pacote 3, tarefa 0062, RF-45):** o contrato está em
  `models/avisos.ts`; as regras do que vira aviso e do nível ficam no backend (`GET /api/avisos`). O front arruma a
  tela no `services/avisosService.ts` e escreve as frases em `i18n/alertTexts.ts` (bloco `alerts` das mensagens, com os
  `valores` de cada `tipo`; a view e o "Ouvir resumo" usam as mesmas). **Nenhum número inventado:** sem dado, o item
  não aparece. **Ponto:** a tela e o sino valem para o ponto da URL (`viewPointFromFlow`, **inclusive a lavoura de
  demonstração**, `exemplo=1`, que aparece como "Lavoura de demonstração, perto de Uberlândia (MG)") ou, sem ele, o
  salvo no aparelho; sem nenhum, "Marcar minha lavoura" (`/onde`). **Ponto salvo, sem cadastro:**
  `repositories/savedPointRepository.ts` (chave `raiz-orbital.avisos.ponto`, toda leitura e escrita em try/catch)
  guarda o último ponto do fluxo com a colheita, o solo, as safras, a escolha atual e, desde o pacote 3, a `escolha` e
  o `objetivo` da tela 5; **nunca a lavoura de demonstração** (`pointFromFlow`). Quem guarda é o
  `controllers/useAlertsBadge.ts`, usado pelo `useShellController`. O `avisosService` faz um pedido por ponto e idioma
  na visita (o sino e a tela usam o mesmo). **Número do sino = número do resumo** (`activeCount`, usado pelo
  `headerCount` e pelo `alertsSummary`): só os avisos que a tela mostra, os cartões de "Agora". **O `contador` da API
  ainda soma o "Perto de você"** (relatos de vizinhos), que saiu da tela: não use esse número. Sem aviso, sem número.
  O botão do cabeçalho fica logo depois do Guia. **Tela** (protótipo `tela-7-avisos.html`): "← Voltar", "Avisos",
  "{lugar} · atualizado em **{data}**", "Ouvir resumo" e "Como ler os avisos" (`GuideLink`); o **resumo** (verde sem
  aviso, azul só com "Fique de olho", laranja com algum "Atenção"; `data-summary` com o tom) com a legenda dos níveis
  (some sem aviso); a grade **"Agora" + "Alertas oficiais"** (uma coluna até 900 px): cartões-botão com "Atenção"
  primeiro (`nowAlerts`; tipo desconhecido não aparece), cada um com o nível escrito e o ícone (a cor só reforça), o
  título curto com o número, "O que fazer:" e a fonte com a data; sem aviso, a caixa verde; no fim, "Seu plano:
  **{cultura}**, plantio até {prazo}" (`planCropOf` + `planLine`: a cultura da tela 5, `planChoice`, e o `data_limite`
  da opção, do `farmService.recomendacao`; sem prazo, sem a parte do prazo) e "Ver exemplo: avisos de {ano}" (o
  `safrinha.explorar_ano`, só fora da safrinha), que abre o modal com o replay daquele ano (`pastSeasonService`,
  `/api/safra-passada` com a cultura do plano, pedido só com o modal aberto) e os recordes do mesmo ano
  (`exampleRows`); nunca escreva os números do protótipo. "Alertas oficiais" (sempre visível, `id="alertas-oficiais"`,
  a âncora do "Ver alertas oficiais" da tela 6; o controller rola até ela de novo quando os dados chegam): `sms:40199`,
  `https://wa.me/556120344611?text=Oi` (nova aba), `tel:193`, `tel:199` e o Guia `alertas-defesa-civil`. **"Como a sua
  área está mudando"** (`changeTiles`: até 4 quadros, veranico, fim das chuvas, falta de água, deu certo e o calor se
  couber; os da cultura só quando a conta da API é da cultura do 1º ano do plano) e **"Já aconteceu aqui"**
  (`recordTiles`, os 4 recordes): o valor antigo riscado, o novo em laranja quando piorou, "2005–19 → 2020–24".
  Cada cartão e cada quadro abre o mesmo `Modal` (o controller guarda `detail = {kind, index}`): nível, título, número
  grande, "O que significa", "O que fazer", fonte com a data ("leitura de" em "Agora", "dados até" nas séries) e o
  "Saiba mais" em nova aba (`conta-de-agua`, `veranico`, `calor-35-graus`, `el-nino-la-nina`, `quando-a-chuva-acaba`,
  `deu-certo`). No fim, a comunidade **"Em breve"** (sem botão). **O "Perto de você" saiu da tela** (a API ainda manda
  `perto`; o backend da comunidade continua). "Ouvir resumo": `alertsListen` (quantos avisos e o "título: o que fazer"
  de cada cartão; sem aviso, "Nada fora do normal agora…"). No El Niño / La Niña, o "o que fazer" do modal segue o
  `valores.sinal` (o mesmo conselho do Plano de 3 anos). Cores novas no bloco "Pacote 3 · tela 7" do `tokens.css`.
- **Pacote 2: regras gerais de todas as telas (tarefa 0054, RF-38).** Valem para toda tela nova ou refeita:
  - **Navegação:** nada de "Pergunta X de 2" nem barra de progresso. Toda tela interna tem o "← Voltar" de
    verdade acima do título: `BackButton` do design system (`to`, `children` = `t.nav.back`); não desenhe outro.
    Para voltar à tela anterior de verdade, o `onClick` opcional chama `preventDefault` e `navigate(-1)` (o `to`
    fica como reserva, ex.: o início do Guia).
  - **Clicar não rola:** escolha que vai para a URL usa `useReplaceFlow()` (mesma rota, recebe o `FlowParams`)
    ou `useReplaceUrl()` (endereço pronto), que trocam com `replace` e `preventScrollReset` (o `ScrollRestoration`
    do `ShellPage` sobe a tela em toda outra navegação). Listas com `key` estável e botão que muda de estado sem
    mudar de tamanho. Teste de referência: `useReplaceFlow.test.tsx` (confere o `window.scrollY`). Para ir a outra
    tela, `navigate` comum.
  - **"Saiba mais" do Guia:** sempre `GuideLink` (`slug`, `newTabLabel={t.common.newTab}`, `children`), que abre em
    nova aba com o ícone e "(abre em nova aba)" escondido. O `slug` é tipado por `content/guia/slugs.ts`
    (`GUIDE_SLUGS`, igual aos arquivos, com teste): artigo novo entra lá no mesmo PR. Link de navegação dentro do
    Guia (lista e links do texto) continua no app.
  - **Safra, não ano:** toda tela nomeia pela safra, contada pelo ano da colheita da soja (2026 = "2025/26"), com
    o `seasonService`: `CURRENT_SEASON` (2027 = safra 2026/27, a única constante), `LAST_SEASONS` (2024 a 2026),
    `seasonName`, `satellitePeriod` ("jan–jul 2024"), `afterSoyPeriod` ("mar–jul de 2027"), `afterSoyMonths`
    ("de março a julho de 2024") e `soyPeriod` ("plantada no fim de 2023, colhida no começo de 2024"), em pt e en.
  - **Respostas das últimas safras** (o contrato das telas 4 e 5): `models/seasonAnswers.ts` e
    `services/seasonAnswersService.ts`. Na URL, `safras=2024:milho_braquiaria,2025:pousio,2026:sem_soja` (cultura
    do `culturas.yaml`, `soja` = plantou a soja e não disse o depois, `sem_soja` = não plantou) e
    `pensa=<cultura>|nao_sei` (a "escolha atual" da safra 2026/27); no aparelho, junto com o ponto salvo. Leia com
    `seasonAnswersFromFlow` (lê também o `confirmadas` e o `hoje` dos links velhos) e grave com
    `flowWithSeasonAnswers` + `useReplaceFlow` (tira o `confirmadas` e o `hoje`). Para a API: `confirmadasFromAnswers`
    (o `confirmadas` do `/recomendacao`) e `todayCrops` (as 3 culturas do "como é hoje" do `/api/plano`, ou `null`).
    `answeredCount` conta as safras respondidas; `currentChoiceCrop`, a cultura do `pensa`; `seasonRows(historico)`,
    as linhas do formulário pelo `/talhao`. A tela usa o `SeasonAnswersForm` (controlado: `seasons`, `answers`,
    `onAnswer`, `current?`), que serve a tela 4 e o modal da tela 5.
  - **Resposta que faltou não trava:** pergunta opcional sem resposta fica indefinida e o produtor segue. Onde a
    informação faz falta, `MissingSeasonsNotice` ("Você não preencheu as últimas safras" + "Preencher agora", que
    abre o modal com o formulário; `text?` para dizer o que faltou).
  - **Modais:** o mesmo `Modal`, normal (padrão) ou `size="large"` para "ver detalhes" com gráficos.
  - **360 px:** nada rola para o lado de 360 a 1440 px; confira em print.
  - **"Ouvir resumo" em toda tela** (ver o item abaixo).
  - A vitrine `/design-system` tem a seção "Pacote 2: peças compartilhadas" com tudo isso funcionando.
- **Gráfico com dado real:** tudo o que é desenhado vem da API, com a fonte e o período na legenda (ex.:
  "Média de 2005 a 2024, NASA POWER"). O mock traz o mesmo campo, no formato do contrato.
- **Guia (`/guia`, tarefas 0048 e 0063, RF-26 e RF-46):** os artigos são arquivos Markdown em
  `src/content/guia/pt/<slug>.md` e `.../en/<slug>.md` (mesmo slug nos dois idiomas, carregados no build
  por `repositories/guideRepository.ts`). Cabeçalho simples entre `---`: `titulo`, `resumo` (uma linha para o
  cartão: **só o "Em uma frase" do próprio artigo, encurtado**, sem afirmação nem número novo), `tema` (`culturas`,
  `plantar`, `terra`, `clima` ou `seguranca`), `slug` (igual ao nome do arquivo), `rascunho` (`sim` ou `nao`; desde
  15/11/2026 **nenhuma tela mostra**: nada de "em revisão" nem de "a revisar pela agrônoma"), `relacionados` (até 3
  slugs, o "Veja também"; sem eles, outros do mesmo tema) e, nas culturas, `planta` (id do `culturas.yaml`, para a
  foto real do `PlantPhoto`, no cartão e no artigo). **O tempo de leitura não vai no cabeçalho:** `readingMinutes`
  conta as palavras do texto (~200 por minuto, para cima, mínimo 1). `guideMeta.test.ts` confere o `resumo` e os
  `relacionados`. Título de seção fixo: "Em uma frase", "Por que importa", "Na sua lavoura", "Fontes" (cultura tem
  também "Conheça" e "Passo a passo"; em inglês "In one sentence", "Why it matters", "In your field", "Sources",
  "Get to know it", "Step by step"). De 100 a 300 palavras, frases
  curtas. Desde 15/11/2026 nenhum artigo é rascunho (`rascunho: nao`) e nenhum texto cita revisão pendente
  da agrônoma (nem nas telas: o `messages.test.ts` barra "rascunho" e revisão pendente; o número que é hipótese do
  time aparece como "ainda não validado em campo"); em compensação, **o artigo só afirma o que uma fonte conferida confirma**: artigo científico
  revisado por pares, livro técnico ou fonte oficial do governo (lei, ZARC, Defesa Civil, NOAA). Nada de
  notícia nem de número que seja hipótese do time (prazos do ZARC por cultura, coeficientes, pontos da nota,
  limites do `regras.yaml`): esses ficam na tela "Como a conta é feita". Link externo só de publicação
  aberta e conferida, e ela entra antes em `src/content/guia/verifiedSources.ts` (url, `kind` = `article`,
  `book` ou `official`, `citation`, o que confirma, data); `guideContent.test.ts` barra link fora da lista, artigo fora do tamanho, sem a estrutura, sem par
  em outro idioma ou com link interno quebrado. Para ligar uma tela a um artigo, use o `GuideLink` (pacote 2: abre em nova
  aba; o `slug` só aceita os de `GUIDE_SLUGS`): não mude slug nem a rota `/guia/{slug}`. O Markdown é lido por
  `services/markdownService.ts` (títulos, parágrafos, listas, negrito e links; HTML vira texto puro e a view nunca
  usa `dangerouslySetInnerHTML`). Não adicione biblioteca de Markdown.
  - **Início (`GuideView`, `useGuideController`, pacote 3):** "← Voltar" (com tela anterior no app, volta para ela
    pelo `onClick` do `BackButton`; aberto direto, vai para a Início), título, "Ouvir resumo" e a busca grande à
    direita (no celular, embaixo). Pílulas "Todos" e os 5 temas com ícone e contagem (`themeCounts`), `aria-pressed`
    na escolhida; no celular, rolam para o lado dentro da própria fileira. "Comece por aqui" (`FEATURED_SLUGS`: raio-X,
    "deu certo" e ZARC) só em "Todos". Seções por tema com "{n} artigos" e cartões (3, 2 ou 1 coluna): o título é o
    link (`::after` cobre o cartão, que pode abrir em nova aba), com o resumo e "{n} min de leitura"; as culturas têm o
    `PlantPhoto` (o crédito fica fora do link, por cima; no celular, a foto à esquerda com 96 px). A frase do MVP saiu.
  - **Busca:** `searchGuides` no título e no resumo, sem acento e sem maiúscula; `highlight` devolve os trechos
    para o `<mark>` (no texto original, mesmo com acento antes). Com busca, os temas somem e aparecem "**{n}**
    resultados para "{busca}"" e os cartões com o nome do tema; sem resultado, 3 sugestões (`guide.suggestions`).
    **A busca e o tema ficam no estado da tela e são copiados para a URL** (`q`, `tema` em português) com
    `useReplaceUrl`: digitar ou trocar de filtro não rola nem cria entrada no histórico (teste em
    `pages.guide.test.tsx`); a tela abre com o que vier na URL, e uma navegação que não é `replace` relê a URL.
  - **Artigo (`GuideArticleView`, `useGuideArticleController`):** `articleLayout` separa o "Em uma frase" (caixa com
    borda verde), as seções (com âncora, `sectionId`) e as "Fontes" (num `<details>` fechado, "Fontes conferidas");
    lista de 2 a 4 itens "**Nome:** texto" vira cartões com ícone. Artigo de cultura mostra a foto real
    (`PlantPhoto`, com o crédito) logo abaixo do título, no lugar do desenho. Coluna lateral fixa no computador com "Neste
    artigo" (rolagem suave, ou direta com menos movimento) e "Veja também" (`relatedArticles`); no celular, o índice
    some e o "Veja também" vai para o fim. "Este artigo ajudou? Sim / Não" só marca e diz "Obrigado!": **nenhuma
    contagem guardada**. Os links internos (e o "Voltar ao Guia") levam o fluxo da URL (`keepFlowQuery`).
  - **"Na sua lavoura" (`services/guideFieldService.ts`, frases em `i18n/guideTexts.ts`):** caixa azul com **um
    número real do ponto**, do `GET /api/raio-x`, com o lugar (`nearestPlace`) e a fonte do dado. Vale o ponto da
    URL ou o salvo no aparelho (`savedPointRepository`, o mesmo dos avisos), **nunca a fazenda de exemplo**; sem
    ponto, sem dado ou com falha, a caixa não aparece. Só os artigos de `FIELD_SLUGS` pedem o raio-X: erosão (dias
    de chuva forte), veranico (o maior), calor de 35 °C (anos com o dia), clima de 2041 a 2060 (média dos modelos) e
    raio-X (argila e areia do SoilGrids, umidade do SMAP e chuva média). **Nada que dependa de hipótese do time**
    (geada de 3 °C, fogo a 5 km, água por textura, fim das chuvas) e nenhuma frase de recomendação. **A frase não traz
    o limite da conta** (os mm da chuva forte, os °C do calor): "13 dias de chuva forte em fevereiro e março", "dia de
    calor forte entre março e maio" (em inglês, "heavy rain" e "strong heat"). O número do ponto (dias, anos) continua;
    quem escolhe o limite é a conta, não a frase. O "Ouvir" do artigo lê o título, o "Em uma frase" e o número da caixa.
- **Endereço aproximado (serviço externo, tela "Onde fica a lavoura", tarefas 0041 e 0053, RF-01):** instância
  pública do **Photon** (komoot, `https://photon.komoot.io`, dados do OpenStreetMap), **sem chave e sem cadastro**:
  nada de token nem variável `VITE_*` para ela. Desde a tarefa 0053 só a busca **reversa** (`/reverse`, o "Perto
  de {lugar}" do cartão do local); a busca por endereço saiu da tela. É compartilhada e corta quem abusa, então o
  uso justo é regra: espera de 400 ms depois de o ponto parar (`SEARCH_DELAY_MS` em
  `services/geocodingService.ts`), **um pedido por vez** com o anterior cancelado
  (`controllers/useDebouncedRequest.ts`, com `AbortController`), nada ao abrir a tela sem ponto, nada para a
  lavoura de demonstração (tem nome próprio) e nada em laço. Sem resposta, a cidade de referência mais perto
  (`nearestPlace`). O Photon não tem português: em pt vai `lang=default` (nomes locais), em en `lang=en`. O
  `fetch` fica no `httpClient.ts` (`getExternalJson`, URL completa e `signal`; continua sendo o único lugar com
  `fetch`) e o pedido em `repositories/geocodingRepository.ts`. No modo `mock` e nos testes,
  `repositories/mocks/mockLocation.ts` devolve a cidade de exemplo mais perto, sem rede; teste de repository usa
  `vi.stubGlobal('fetch', ...)`. O Photon está nos créditos (`content/credits.ts`). Serviço externo novo segue o
  mesmo molde; se precisar de chave ou de uso em escala, a chamada vai para o backend.
- **Tela "Onde fica a lavoura" (`/onde`, tarefa 0053, RF-37):** três jeitos simples de marcar: tocar no mapa
  (`design-system/components/FieldMap.tsx`: tocar põe o alfinete, arrastar ajusta), "Usar onde estou agora" (GPS,
  no máximo 10 s: `GPS_TIMEOUT_MS` do `positionService`, que vale também com o pedido de permissão aberto) e "Usar
  a lavoura de demonstração" (`EXAMPLE_FARM`; confirmar leva `exemplo=1`, para não virar o ponto salvo dos
  avisos). Coordenadas e link do Google Maps ficam no modal "Outras formas de marcar", lidos por
  `services/locationInputService.ts` (`parseLocationInput`, puro: o ponto ou `null`; um teste por formato aceito
  e por entrada que não serve). O estado do cartão (`empty`, `marked`, `outside`) e quando o "Confirmar local" liga
  ficam no `locationService` (`whereStatus`, `canConfirm`); o erro do GPS é o `empty` com o aviso. Quem decide o
  enquadre do mapa é o controller (`view = { target: 'area' | 'point', seq }`: GPS, demonstração, ponto colado e
  "Ver a área inteira" trocam o `seq`; tocar e arrastar não mexem). O crédito do Leaflet vai sem a bandeira (regra
  do NASA Space Apps) e o "© OpenStreetMap" fica sempre visível. Os dois modais usam o `Modal` do design system.
  No celular (até 900 px), o "Confirmar local" fica numa barra fixa com o estado numa linha, e a própria tela põe o
  espaço embaixo do `body` (`:global(body):has(...)` no CSS dela) para a barra não cobrir o rodapé. **Pacote 2:** sem
  `lat`/`lon` na URL, a tela abre com a lavoura de demonstração marcada e o "Confirmar" ligado
  (`VITE_ABRIR_COM_DEMONSTRACAO`, ligado por padrão; `OPEN_WITH_DEMO` do `locationService`, que o controller recebe
  como `openWithDemo` nas dependências); o botão da demonstração fica em destaque, com o selo "Bom para testar".
- **"Como a conta é feita" (tela 9, tarefa 0049 do backend):** as regras novas (deu certo, pesos da nota, renda sem
  preço, água, sede da cultura, nota da rotação, Plano B, geada, chuva forte, fogo, avisos, sinal do outono e raio-X)
  aparecem no bloco "As regras da conta", com os números de `GET /api/metodo` (`repositories/metodoRepository.ts`,
  lidos do `regras.yaml`; o mock em `repositories/mocks/mockMetodo.ts`). A tela nunca repete número de regra: sem a
  rota (API antiga) ou com falha, o bloco não aparece e o texto da renda fica sem o número. **Sem os relatos de
  vizinhos** (15/11/2026, comunidade "em breve"): a regra dos avisos fala só do SMAP e do NASA POWER, e o
  `avisos.vizinhos_dias` e o `avisos.raio_km` da API não aparecem (continuam no model, que é o contrato); o
  `messages.test.ts` barra "vizinh"/"relato" (e "neighbo"/"report") no bloco `method`.
- **Área piloto:** os limites vêm só de `GET /api/area-piloto` (`services/pilotAreaService.ts`, um pedido por
  visita). O front não repete os números (só o mock, que imita a API). Na tela "Onde fica a lavoura", o
  limite aparece tracejado com legenda em texto, e o ponto fora dele desliga o "Confirmar local"; enquanto a
  área carrega, o botão espera; se ela não carregar, a tela deixa seguir (o backend ainda responde
  `OUTSIDE_AREA` nas telas seguintes). **Área do MVP (tarefa 0051 do backend, RF-35):** a área não muda e as telas
  dizem que esta primeira versão funciona na região de Uberlândia e Uberaba (MG) e que vamos ampliar para todo o
  Triângulo Mineiro: a legenda do mapa de `/onde` e o modal "Onde o app funciona" (`where.areaLegend`,
  `where.area.text`), os avisos de fora da área (`where.outsideNotice`, `outsideText`), "De onde vem cada dado"
  (`method.sourcesArea`). A tela inicial e o Guia não falam mais do MVP (tarefa 0052 e, no Guia, tarefa 0063). Mudou a área? Troque esses textos junto, em pt e en.
- **Tela 3 "Quando você colhe" (`/quando`; tarefa 0042 do backend e, desde o pacote 2, tarefa 0057, RF-40):**
  na tela fica **só a pergunta**; o que ajuda a decidir vai para o modal grande. O satélite não vê o dia da
  colheita: a tela **abre sem data** e com o "Próximo passo" desligado (a `colheita_sugerida` do NDVI não
  preenche mais nada; saíram o `harvestSuggestion`, o `harvestWindow` e a faixa azul). O campo
  (`input type=date` escondido, aberto pelo botão com `showPicker()`) vai de 1/jan a 30/abr da safra atual
  (`harvestDateWindow`, do `CURRENT_SEASON`); a época sai da data pelo `harvestFromDate` (a regra do
  `regras.yaml`, grupo `colheita`: até 10/fev e janeiro = cedo; 11 a 20 = meio; do 21 em diante, março e abril
  = tarde). "Não sei o dia exato" abre o `Modal` com as 3 épocas **sem nenhuma marcada** (sempre), e "Usar esta
  época" só liga depois de escolher (o rascunho fica no controller). **A escolha fica na URL**, gravada na hora
  com o `useReplaceFlow` (sem rolar, com teste de rolagem no `routes.test.tsx`): `data` + `colheita`, ou só
  `colheita` com a época; ao voltar, `harvestChoice` lê a URL (a data dentro do campo vale mais, data fora não
  vale). O "Próximo passo" leva as duas para `/calculando`. Aviso laranja com "Conferir no mapa" só com
  `soja_recente.vista === false`. Duas colunas da **mesma altura** no computador (a coluna da data tem 21 px
  embaixo para os dois botões terminarem na mesma linha); no celular, o "Próximo passo" fica numa barra fixa
  com a data escolhida. A caixa "Ainda não decidiu?" é inteira clicável (o `::after` do botão cobre a caixa).
  **Modal grande** (`views/WhenDetails.tsx`), 4 blocos com os textos abertos, cada um some sem dado: Compare as
  épocas (`services/harvestBandsService.ts`: a chuva que sobra de cada época, no dia escolhido para a do
  produtor e no dia da época no motor, `bandDate`, para as outras, e a melhor opção do
  `GET /api/custo-atraso` → `delayCostService`), a chuva que sobra (`rainLeftCurve` + `rainLeft` do
  `rainLeftService`: a tabela do backend vai de 15/jan a 31/mar; fora dela, sem números), a chuva × gasto
  (`rainChart`, só o `mes_chuva_abaixo_eto` em destaque) e o fim das chuvas (`rainEnd`). Os °C do "deu certo"
  vêm do `/api/metodo` (`services/methodRulesService.ts`, um pedido por visita; sem a rota, a frase fica sem o
  número). As contas continuam no backend. Gráficos do design system **na largura real do espaço**
  (`useElementWidth`, `ResizeObserver`; o texto não encolhe no celular): `RainLeftChart` (eixo dos mm de 200
  em 200, marca opcional com os números), `RainEtoChart` (legenda da fonte opcional) e `RainEndTimeline`
  (mais cedo, metade dos anos, mais tarde). Os "Saiba mais" são `GuideLink` (`deu-certo`,
  `plantar-logo-depois-da-colheita`, `conta-de-agua`, `quando-a-chuva-acaba`). "Ouvir resumo" próprio
  (`when.summary*`): com a data ou a época, os números da chuva que sobra; sem nada, pede o dia ou a época.
  Textos com negrito no modal usam `**…**` lido pelo `parseInline` (nunca HTML).
- **Tela 4 "Raio-X da sua terra" (tarefas 0043 e 0058, RF-29 e RF-41):** os números vêm
  de `GET /api/raio-x` (`repositories/raioXRepository.ts` → `services/raioXService.ts`), pedido com a
  colheita e a terra da URL e **sem** as respostas das safras (como o talhão: responder não recarrega o
  painel; trocar a terra recarrega, mas o painel e o modal ficam na tela com o último raio-X). O service só
  ordena e prepara (`xRayBlocks`, `alertList`, `regionSide`, `futureAgreement`, `soilParts`, `ndviLevel`).
  **Pacote 2 (tarefa 0058):** o painel escuro (tokens `--xray-*` e `--color-xray-*` do `tokens.css`) tem 8 blocos
  enxutos (`InstrumentPanel` e `InstrumentBlock` do design system): só o nome, o número (`CountUp`), uma linha e o
  selo da fonte, e **o bloco inteiro é um botão** que abre o `Modal` com o texto completo (negrito `**…**` pelo
  `parseInline`), a fonte e o "Saiba mais" (`GuideLink`, nova aba). As frases ficam em `i18n/xrayTexts.ts`
  (`xrayText`, testado com os números da lavoura de demonstração); o "Sua terra é diferente?" fica no modal do Solo.
  O gráfico "Suas últimas safras" é o `SeasonChart` do design system, com a regra em `services/seasonChartService.ts`
  (`seasonChart`): com NDVI, todas as safras com leitura; sem NDVI, as 3 últimas listradas; sempre a safra atual
  tracejada; **nada dentro das barras** (regra geral 5); a coluna da direita traz a resposta do produtor ou o que o
  satélite viu (no celular, sai da vista e fica para o leitor de tela); o título conta as safras paradas pelas
  respostas. As 5 cores do NDVI (`--color-ndvi-1..5`, cortes `NDVI_BREAKS`) têm legenda numérica. Embaixo, o
  `SeasonAnswersForm` com a safra atual (data do `data` da tela 2 ou, só com a época, `harvestBand` = `colheita`:
  "colheita prevista no meio de fevereiro", com o `harvest.*.inline`; e "Trocar data" para `/quando` com o fluxo).
  "Ver o que plantar" leva o fluxo inteiro para `/resposta`; no celular, fica preso embaixo com "{n} de 3 safras
  confirmadas" e a tela põe o espaço embaixo do `body` (`:global(body):has(...)`). "Ouvir resumo": `xraySummary`.
  Sem o raio-X (API antiga ou falha), o painel não aparece e a terra fica num cartão claro com a troca. O
  `MiniMap` mostra o crédito do Leaflet sem a bandeira. Bloco sem dado não aparece; aviso nunca leva o selo de
  "pronto" (✓).
- **Tela 6 "Seu planejamento" (`/planejamento`, pacote 3, tarefa 0060, RF-43):** a tela final do fluxo (`PlanningPage` →
  `controllers/usePlanningController.ts` → `views/PlanningView.tsx`, com o `PlanReport`). **O plano é o mesmo da tela 5:**
  as duas telas chamam o `controllers/usePlanFlow.ts` (recomendação, escolha do 1º ano, comparação, sugestão em cadeia do
  `/api/plano/sugestao` e, com `ano3`, o `/api/plano`) com a mesma URL; não recalcule o plano em outro lugar. As regras da
  tela ficam em `services/planningService.ts` (`harvestDay` = a `data` ou o dia da época no motor, `bandDate`;
  `sowingDay` = a `data` ou a `entrada.semeadura`; `planTimeline`, `planningAlerts`, `pastFutureRows`, `planGain`,
  `lastSeasons`) e as frases, usadas pela tela, pelo relatório e pelo "Ouvir resumo", em `i18n/planningTexts.ts`
  (`stepText`, `planningAlertText`, `gainText`, `planningSummary`, `scenarioName`); os textos no bloco `planning` das
  mensagens. Ordem dos blocos: topo ("← Voltar ao plano" para `/plano` com o fluxo, "✓ Seu planejamento está pronto", o
  lugar: "Lavoura de demonstração, perto de Uberlândia (MG)" com `exemplo=1`, senão "Sua lavoura, perto de {lugar}" pelo
  reverse do Photon com o uso justo, um pedido com o `useDebouncedRequest`, e o `nearestPlace` sem resposta; "colheita da
  soja prevista em {data}" ou a época), resumo do plano (3 cartões com `PlantPhoto` e o cartão das ações: "Imprimir
  relatório" e "Mudar o plano"), "O que fazer agora" (passos por regra: agora, fevereiro com a previsão da NOAA do
  `sinal` e a etiqueta "Plano B: X" do `plano_ab`, que some sem Plano B ou com o 1º ano igual a ele; colheita; plantio
  até o `data_limite`, em laranja com `fora_do_prazo`; a fase da água pelo `ciclo` e o `criterio` do `/recomendacao`;
  o fim do ciclo pelo `renda.da_grao`; out–nov; **sem "Adicionar à agenda"**), alertas da área (até 3, cada um só com
  dado: o `sinal`, `alertas.chuva_forte` e `alertas.fogo` do raio-X; "Saiba mais" pelo `GuideLink` com os slugs
  `como-evitar-erosao` e `fogo-na-palha`; a faixa da Defesa Civil com "Ver alertas oficiais" para
  `/avisos…#alertas-oficiais`, o id do bloco oficial da tela de Avisos), passado e futuro (`anos[].anos_bons` e
  `futuro_anos_bons` do `/api/plano`; o `cartoes.clima_futuro` do raio-X, com `clima-2041-2060`), comunidade "em breve"
  com "Abrir o Guia" (`/guia`; **nenhum link para `/comunidade`**) e o cartão do relatório (sem as 3 safras respondidas,
  o `MissingSeasonsNotice`). **Relatório:** os dois "Imprimir relatório" chamam `window.print()` (injetado no controller);
  o `PlanReport` fica num portal no `<body>`, `hidden` na tela, e o CSS de impressão esconde o resto (cabeçalho em
  `<div>`: o `global.css` esconde todo `<header>`); 7 seções (Sua terra, Últimas safras, Opções comparadas, Plano de 3 anos
  com Prós e Contras pelos `prosTexts`/`consTexts` da tela 5 e "Como o plano ajuda a ganhar", O que fazer e quando,
  Alertas e clima, Fontes e aviso), 2 folhas A4 na lavoura de demonstração. Os cartões dos anos no celular: foto de 108 px
  à esquerda; a 360 px as barras do "Deu certo" ficam com 56 px e o "X de 20" desce se não couber (sem rolagem lateral).
  É a **única tela com "Imprimir relatório"**.
- **Tela 5 "Escolher" + "Plano de 3 anos" (pacote 2, tarefa 0059, RF-42; motor na tarefa 0056 do backend):** as
  antigas abas Sugestão, Comparar e Plano (tarefas 0044 e 0045) viraram **uma tela com 2 abas** (`ChoosePlanPage` →
  `controllers/useChoosePlanController.ts` → `views/ChoosePlanView.tsx`, com `ChooseTab`, `PlanTab` e `ChooseModals`).
  O plano vem do `usePlanFlow` (o mesmo da tela 6). `/resposta` e `/opcoes` abrem "1. Escolher"; `/plano`, "2. Plano de 3 anos". As abas são o `Tabs` do
  design system (`tablist`; setas, Home e End); trocar de aba é `useReplaceUrl` (sem rolar); o botão do fim da aba 1
  abre a aba 2 do topo. O "Voltar" vai para `/satelite`. **O que fica na URL** (`flowParams.ts`): `objetivo`,
  `comparar` (até 3, o pousio vale), `escolha` (o 1º ano do plano; sem ela, o `pensa` do raio-X e, com "Ainda não
  sei", a sugestão), `ano2` e `ano3` (os anos que o produtor mudou para outra cultura que não a sugestão do ano) e
  `ano` (o ano aberto no "Por que essa sugestão?", que os links antigos usam). Escolher para o plano congela a comparação da tela com a cultura e solta
  `ano2`/`ano3`; trocar o objetivo solta a comparação (e os anos, sem `escolha`). Regras: `services/choiceService.ts`
  (ordem com as fora do prazo no fim, `isLate` = `fora_do_prazo` ou, na API antiga, `!na_janela`; a sugestão é sempre
  a 1ª no prazo; comparação de partida, caixinhas, fluxos) e `services/planService.ts` (o que fixar no
  `/api/plano/sugestao`, o plano final com o 3º ano mudado no `/api/plano`, os cartões, `todayState`, o sinal em 2
  frases, o Plano B do `plano_ab` e a chuva aproveitada). **Aba Escolher:** "O que você quer mais?" (3 botões
  `aria-pressed`), o cartão "Nossa sugestão" com o modal grande (explorador `YearBarsChart` com o detalhe do ano e a
  safra dia a dia, `WaterBar`, clima, renda e terra, como fazer, Saiba mais) e "Usar no meu plano" → "✓ Está no seu
  plano" (mesmo tamanho), "Comparar:" com as 6 culturas em caixinhas (até 3, mínimo 1) e o `CompareCards` do design
  system (um DOM só: tabela com `subgrid` no computador, cartões com `scroll-snap`, bolinhas e a dica no celular; a
  coluna dos nomes das linhas é `aria-hidden` e cada célula repete o nome). Toda célula é um botão que abre um modal
  com o número, a explicação e a fonte. Fora do prazo pode ser comparada e escolhida, sempre com "Passou do prazo
  ({data})"; "Deixar parado" não tem conta ("Sem lavoura: não entra na conta", a terra pelo `pousio.texto`).
  Nenhum corte novo no front: os rótulos Bom/Médio/Fraco são os da API e o clima 2041–2060 fica sem rótulo.
  **Aba Plano:** 3 cartões em cadeia (o "Por quê:" é o `motivo` do motor), "O que plantar" nativo em cada ano,
  alerta (`role="status"`) com "Voltar ao plano sugerido". **A nossa sugestão de cada ano fica sempre à vista
  (pacote 3, tarefa 0064, RF-47):** uma regra só, `suggestedFor(ano)` no `planService`: 1º ano = a sugestão da aba
  Escolher (`suggestionOf`); 2º = o `anos[1]` do `/api/plano/sugestao?fixos=<1º>`; 3º = o `anos[2]` dessa resposta
  com o 2º sugerido ou, com o 2º mudado, o do `fixos=<1º>,<2º>`; o porquê vem da mesma resposta, e resposta de um
  pedido anterior não vale (a sugestão fica `null`). O `usePlanFlow` pede sempre a sugestão com o 1º ano (sem o 2º
  mudado, o cache junta com o plano mostrado) e cada `PlanCard` traz o `suggested`. No select, a opção sugerida tem
  " · nossa sugestão" (`choose.plan.option`, junto com " · passou do prazo"); quando a cultura não é a sugestão,
  embaixo do select vem a linha "Nossa sugestão" (etiqueta verde) + cultura + "Usar a sugestão" (`useSuggestion`,
  com a safra escondida no nome), que chama o mesmo `chooseYear`. Etiqueta: "Sua escolha" no 1º ano; nos outros,
  **"Você mudou" só quando a cultura é diferente da sugestão daquele ano** (sem a sugestão carregada, vale a URL), e o
  "Voltar ao plano sugerido" aparece quando algum cartão diz "Você mudou" (`planEdited`). Escolher de novo a sugestão
  (`yearFlow` com a sugestão) tira o `ano2`/`ano3` da URL (o 2º continua soltando o 3º) e o alerta some; no 1º ano,
  muda a `escolha` (como na aba 1). Depois de trocar, o foco volta ao select com `focus({ preventScroll: true })`.
  Com o 3º ano mudado, enquanto o `/api/plano` carrega, ficam os cartões e as notas do sugerido (sem piscar); se ele
  falhar, o erro. A tela 6 usa os mesmos cartões, sem etiqueta nem porquê. Notas "Seu plano × Como é hoje" (cada nota abre a conta),
  chuva aproveitada, "E se o ano vier seco?" (o `sinal`, o SMAP, o Plano A e o **Plano B do motor**, nunca fixo;
  "Não precisa" com `motivo` `pousio` ou `nunca_falhou`) e "Ver meu planejamento →" (`/planejamento` com o fluxo). **"Como é
  hoje"** = as 3 últimas safras do raio-X (`todayCrops`): sem resposta, "não preenchido" com o
  `MissingSeasonsNotice` (grava `safras` sem rolar); com "Não plantei" (`sem_soja`), "Sem soja em {safra}: não dá para
  comparar", **sem** o aviso. **Sem relatório nem "Imprimir relatório"** desde o pacote 3
  (tarefa 0060): as abas ficam sozinhas à esquerda e a frase antes de "Ver meu planejamento →" fala do relatório para
  imprimir, que fica só na tela 6. Com a recomendação na
  mão, um novo pedido não apaga a tela (sem pisca nem rolagem). Fotos: `PlantPhoto` no cartão, nas colunas e nos
  anos. Links do Guia: `GuideLink` (nova aba), slugs em `CROP_GUIDE` (`views/choiceTexts.ts`) e `PLAN_ARTICLES`.
  **Não há mais relatório antigo nem a tela solta da safra passada:** `/relatorio` e `/safra-passada?…&ano=X` levam
  para `/resposta` (com o `ano`, que abre o "Por que essa sugestão?" naquele ano). Não crie link para elas.
- **Cabeçalho e rodapé globais (remodelagem, tarefa 0052, RF-36):** valem para todas as telas (`ShellView`, estado no
  `useShellController`). **Cabeçalho** (`design-system/components/Header.tsx`): logo, "Raiz Orbital" (nunca quebra
  linha) e o slogan (some no celular) à esquerda; à direita, **só três itens**: **Guia** (desde o pacote 3, tarefa
  0061, no lugar da Comunidade: pílula verde-clara com o livro, `BookIcon`, e o nome escrito também no celular; leva a
  `/guia`), Avisos (sino, nome e o selo laranja com o `contador` de `/api/avisos`; sem aviso, sem selo; no celular, só
  o sino com o selo) e o idioma ("PT | EN"; no celular, só o outro idioma). A página atual fica marcada com
  `aria-current="page"` (o `NavLink`): em `/guia` e nos artigos, a pílula fica verde cheia; em `/avisos`, o sino ganha
  o fundo verde-claro (no computador, o respiro em volta do sino é compensado por margem negativa, para nada mudar de
  lugar). Não ponha outro item nem botão grande no cabeçalho, nem a Comunidade (está "em breve"). Abaixo de 380 px
  (pacote 2): logo de 30 px, nome de 15,5 px e a pílula do Guia de 12,5 px; cabe em 360 px sem rolar para o lado. **Rodapé** (`Footer.tsx`, uma linha só): escudo com "Ajuda a decidir. Não
  substitui o seu agrônomo." à esquerda; à direita, "Créditos e uso de IA" (abre o modal global) e "NASA Space Apps
  2026 · Field Shift". Tem **duas variantes**, escolhidas pela rota no `useShellController`: na Início (`/`), só isso
  (a faixa grande do agrônomo, logo acima, existe só lá); nas telas internas, também "Como a conta é feita ↗"
  (`/como-funciona` com o caminho da URL). Contêiner das telas novas: `--page-width-v4` (1280 px) com
  `--page-margin-v4` (52 px; 20 px até 900 px), que dá a mesma coluna de conteúdo das telas antigas.
- **"Ouvir resumo" (regra geral, tarefa 0052):** o "Ouvir" **nunca lê a tela inteira**. Cada tela tem um resumo
  falado próprio, de 2 ou 3 frases curtas, em pt e en (no bloco da tela das mensagens, ex.: `start.summary`), e o
  botão é sempre o link discreto "Ouvir resumo" perto do título, nunca um botão no cabeçalho. Use o controller
  `useListenSummary(texto, idioma)` (no controller da tela) e o componente `ListenSummary` do design system (só
  props). A fala é a Web Speech API pelo `speechService` (melhor voz do `voicePicker`, pt-BR ou en-US, velocidade
  0,95); enquanto fala, o link vira "Parar" com o quadrado e `aria-pressed="true"`; trocar o idioma ou sair da tela
  para a fala; sem voz no navegador, o link não aparece. **Desde o pacote 2, toda tela tem o seu**, montado com os números
  dela no controller (ex.: avisos = o lugar e quantos avisos ativos; comunidade = o raio e o plantio da safra mais
  recente; artigo do Guia = o título, o "Em uma frase" (`articleSummary`) e o número de "Na sua lavoura"). O texto
  não deve mudar a cada segundo (cada troca para a fala): na missão, nada de fase; no Guia, o total de artigos, não o
  da busca. O da tela 4 fica em `i18n/xrayTexts.ts`; o da tela 6, em `i18n/planningTexts.ts` (`planningSummary`).
- **Modal reutilizável (`design-system/components/Modal.tsx`, tarefa 0052):** o padrão de todo "ver detalhes".
  `<dialog>` nativo (`showModal`; sem ele, o atributo `open`): fecha com o X, com Esc e com clique fora (no fundo
  escurecido); o foco entra no modal, fica preso nele (Tab e Shift+Tab dão a volta) e volta a quem o abriu. Quem
  abre e fecha é o controller da tela (`open` / `onClose`); o conteúdo só existe com o modal aberto. No computador,
  centralizado, até 560 px (`size="wide"`: 640 px), cantos de 18 px e fundo escuro com desfoque leve; até 900 px,
  folha de baixo para cima, com a largura toda e até 88% da altura. `size="large"` (pacote 2): quase a tela toda,
  centralizado também no celular, com `--modal-large-gap` em volta (24 px; 8 px até 900 px), título fixo e o miolo
  rolando sobre o fundo da página. Não crie outro modal: use este.
- **Créditos e regras do NASA Space Apps (tarefa 0052):** o modal "Créditos e uso de IA" é **global**
  (`views/CreditsModal.tsx`, estado no `useShellController`, aberto pelo rodapé de todas as telas; a tela que quiser
  abri-lo usa o `openCredits` do contexto do `<Outlet>`, como o "Todas as fontes e créditos" da Início). O conteúdo
  fica num arquivo só, `content/credits.ts`, em pt e en, **uma linha por fonte** (negrito com `**…**`, lido pelo
  `parseInline` do `markdownService`, nunca HTML); um teste confere que os dois idiomas têm as mesmas linhas.
  Fonte, código, fonte tipográfica, ícone ou imagem nova no app? Acrescente a linha lá, em pt e en. Regras do
  NASA Space Apps em todas as telas: (1) nada de logo, bandeira ou identificador de missão da NASA: "NASA" só como
  texto que cita a fonte do dado, e o ícone de satélite é o genérico do Lucide; (2) listar toda fonte, código, texto e
  imagem usados (o modal de créditos), e mapa com OpenStreetMap mostra "© OpenStreetMap" sobre o próprio mapa; (3)
  toda imagem ou vídeo gerado por IA leva a marca d'água visível "Imagem gerada por IA" (a foto da Início, do
  Lovable, leva), e o uso de IA em código e textos fica declarado nos créditos.
- **Fotos das plantas (tarefa 0055):** toda foto de cultura nas telas novas é o `PlantPhoto` (a tela 5 usa no cartão
  da sugestão, na comparação e no plano; a tela 6, nos cartões do resumo do plano; o Guia, nos cartões das culturas).
  Fotos reais do Wikimedia Commons, **baixadas** para `public/fotos/` (nunca
  link direto), só CC BY, CC BY-SA ou domínio público, sem logo nem marca, com até 800 px de largura e 250 KB. Os dados
  de cada cultura (`images`: 1 imagem ou 2, cada uma com arquivo, autor, licença, link do Commons e `alt` em pt e en)
  ficam só em `content/plantPhotos.ts`; a tela mostra com `<PlantPhoto {...plantPhotoProps(cultura, lang)} height={…} />`
  (`design-system/components/PlantPhoto.tsx`: crédito "Foto: autor · licença" em cima da imagem, embaixo, o autor
  ligando ao Commons em nova aba com " (abre em nova aba)" escondido e, se a foto não carregar, o bloco verde com o
  nome). **Foto de 2 imagens (tarefa 0064):** sem foto aberta da cultura inteira, 2 imagens lado a lado (`display:
  grid` de 2 colunas, `--photo-pair-gap` de 2 px) num bloco com `role="img"` e o nome da cultura (as metades com
  `alt=""`) e um crédito só com os 2 autores ("Foto: A · licença | B · licença", cada um com o seu link). Hoje só o
  milho com braquiária: o milho de "Milho sozinho" (o mesmo objeto, Christian Fischer) à esquerda e a braquiária à
  direita; uma foto aberta do consórcio, se aparecer, substitui as duas. **Não há legenda** ("na foto: …"): o campo
  saiu do tipo e do componente. O modal de créditos lista cada foto (grupo `photos` do `credits.ts`, montado do
  `plantPhotos.ts`; a de 2 imagens numa linha só, separadas por " | "); os links
  `[texto](https://…)` das linhas dos créditos abrem em nova aba. Foto nova ou trocada: confira a licença na página
  do Commons, atualize o `plantPhotos.ts` e a tabela da tarefa 0055 (o `plantPhotos.test.ts` confere arquivo, tipo,
  tamanho, licença e alt de todas as imagens). O `PlantImage` (SVG) continua onde já está.
- **Telegram (`VITE_TELEGRAM_BOT_URL`):** link público do bot (ex.: `https://t.me/NomeDoBot`). Vazio = a interface
  não fala do Telegram. Só o link: o token do bot nunca entra no front. Desde a tarefa 0052, o link não fica no
  cabeçalho nem na tela inicial: só na Sugestão e em "Como a conta é feita".
- **Variáveis de ambiente:** tudo que começa com `VITE_` é **público** (vai no JavaScript do navegador).
  Nunca coloque segredo, token ou senha em `VITE_*`. Segredos ficam só no backend. Os nomes ficam em
  `projeto/frontend/.env.example` (para o `npm run dev`, copie para `.env.local`) e em `projeto/.env.example` (compose):
  `VITE_API_MODE`, `VITE_TELEGRAM_BOT_URL` e `VITE_ABRIR_COM_DEMONSTRACAO` (pacote 2; só `false`, `0` ou `nao`
  desligam). Nos testes, o `test.env` do `vite.config.ts` fixa o valor.
- **Idioma:** textos da interface em português (produtor) e inglês (juízes), conforme o PRD (RNF-03).
  **O inglês é o padrão do site** (15/11/2026): sem escolha salva, abre em inglês, seja qual for o idioma do navegador
  (`detectLanguage` em `i18n/language.ts`; o `index.html` começa com `lang="en"`). Quem troca para PT no cabeçalho
  continua em PT (a escolha fica no `localStorage`, `raiz-orbital:lang`).
- **Celular:** a interface precisa funcionar em tela de celular (RNF-04).
- **Dependências:** `npm install <pacote>` (ou `-D` para dev). Biblioteca nova grande (mapa, gráficos,
  UI kit) → justifique na descrição do PR.
- **Visual:** cores, tamanhos e raios só por variável de `design-system/tokens.css` (nunca hex solto).
  A referência visual são os protótipos da remodelagem (v4, 15/11/2026: tela Início, cabeçalho, rodapé e modais),
  com as cores novas no bloco "Remodelagem v4" do `tokens.css` (`--color-info`, `--color-tint-green-soft`,
  `--color-focus-ring` etc.; as cores iguais às de antes reaproveitam os tokens existentes). Nos componentes novos,
  o foco visível é o contorno verde-claro de 3 px (`--color-focus-ring`). Veja tudo junto em `/design-system` (só no
  ambiente local).
- **Ícones:** sempre de `design-system/icons` (lucide por baixo, sempre `aria-hidden`). Não importe
  `lucide-react` direto nas telas: precisa de um ícone novo, adicione lá.
