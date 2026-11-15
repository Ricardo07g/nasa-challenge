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
  por ele). Na fazenda de exemplo, com safra confirmada, a recomendação vem do `/recomendacao` do ponto
  do exemplo, não do `/exemplo`.
- **Safras confirmadas (tarefa 0039 do backend, RF-25):** a regra fica em
  `services/confirmedSeasonsService.ts` (ler e escrever o parâmetro, pôr a resposta do produtor no
  lugar do satélite com `fonte_ano: 'produtor'`, as linhas do bloco e o aviso "Não parece uma lavoura
  de soja"). Os anos confirmáveis vêm do `/talhao` (`anos_confirmaveis`); sem o campo (API antiga), o
  bloco não aparece. A tela 4 pede o `/talhao` **sem** `confirmadas` (o que o satélite viu) e aplica as
  respostas no front, para confirmar não recarregar o talhão. Os botões de
  cada ano são um `ChipGroup` (grupo com o rótulo do ano, `aria-pressed`); tocar de novo na resposta
  marcada volta para o satélite. O ano `sem_soja` vira o quadrinho `none` (pontilhado com "–") e a
  legenda "Sem soja"; não conta como parado, plantou nem sem certeza.
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
  ficam em `views/CommunityForms.tsx`, usados pelas duas telas.
- **Gráfico com dado real:** tudo o que é desenhado vem da API, com a fonte e o período na legenda (ex.:
  "Média de 2005 a 2024, NASA POWER"). O mock traz o mesmo campo, no formato do contrato.
- **Guia (`/guia`, tarefa 0048, RF-26):** os artigos são arquivos Markdown em
  `src/content/guia/pt/<slug>.md` e `.../en/<slug>.md` (mesmo slug nos dois idiomas, carregados no build
  por `repositories/guideRepository.ts`). Cabeçalho simples entre `---`: `titulo`, `tema`
  (`culturas`, `plantar`, `terra`, `clima` ou `seguranca`), `slug` (igual ao nome do arquivo), `rascunho`
  (`sim` ou `nao`) e, nas culturas, `planta` (id do `culturas.yaml`, para a ilustração de
  `design-system/plants/PlantImage`). Título de seção fixo: "Em uma frase", "Por que importa", "Na sua
  lavoura", "Fontes" (cultura tem também "Conheça" e "Passo a passo"; em inglês "In one sentence", "Why it
  matters", "In your field", "Sources", "Get to know it", "Step by step"). De 150 a 300 palavras, frases
  curtas. Artigo de cultura, plantio e manejo tem `rascunho: sim` (a view põe "Rascunho: a revisar pela
  agrônoma." no topo). Números só de `culturas.yaml`, `regras.yaml` e do PRD. Link externo só de página
  aberta e conferida, e a página entra antes em `src/content/guia/verifiedSources.ts` (url, o que confirma,
  data); `guideContent.test.ts` barra link fora da lista, artigo fora do tamanho, sem a estrutura, sem par
  em outro idioma ou com link interno quebrado. Para ligar uma tela a um artigo, use o link
  `/guia/<slug>`. O Markdown é lido por `services/markdownService.ts` (títulos, parágrafos, listas, negrito
  e links; HTML vira texto puro e a view nunca usa `dangerouslySetInnerHTML`). Não adicione biblioteca de
  Markdown.
- **Busca de endereço (serviço externo, tela "Onde fica a lavoura", tarefa 0041, RF-01):** instância pública
  do **Photon** (komoot, `https://photon.komoot.io`, dados do OpenStreetMap), **sem chave e sem cadastro**:
  nada de token nem variável `VITE_*` para ela. É compartilhada e corta quem abusa, então o uso justo é
  regra: espera de 400 ms depois da última tecla (e depois de o mapa parar, no endereço aproximado do
  *reverse*), **um pedido por vez** com o anterior cancelado (`controllers/useDebouncedRequest.ts`, com
  `AbortController`), mínimo de 3 letras, `limit=5`, nenhuma busca ao abrir a tela nem em laço
  (`SEARCH_DELAY_MS` e `MIN_SEARCH_LENGTH` em `services/geocodingService.ts`). O Photon não tem português:
  em pt vai `lang=default` (nomes locais), em en `lang=en`. **Atribuição** "Endereços: © OpenStreetMap"
  sempre visível junto da busca, com link para `https://www.openstreetmap.org/copyright` (o mapa tem a
  dele). O `fetch` fica no `httpClient.ts` (`getExternalJson`, URL completa e `signal`; continua sendo o
  único lugar com `fetch`), o pedido em `repositories/geocodingRepository.ts` e as regras (rótulos, 3
  letras) no service. No modo `mock` e nos testes, `repositories/mocks/mockLocation.ts` busca em cidades de
  exemplo, sem rede; teste de repository usa `vi.stubGlobal('fetch', ...)`. Coordenadas e link do Google
  Maps colados são lidos por `services/locationInputService.ts` (puro; formatos na tarefa 0041). Serviço
  externo novo segue o mesmo molde; se precisar de chave ou de uso em escala, a chamada vai para o backend.
- **Área piloto:** os limites vêm só de `GET /api/area-piloto` (`services/pilotAreaService.ts`, um pedido por
  visita). O front não repete os números (só o mock, que imita a API). Na tela "Onde fica a lavoura", o
  limite aparece tracejado com legenda em texto, e o ponto fora dele desliga o "Confirmar local"; enquanto a
  área carrega, o botão espera; se ela não carregar, a tela deixa seguir (o backend ainda responde
  `OUTSIDE_AREA` nas telas seguintes).
- **Tela 3 "Quando você colhe" (tarefa 0042 do backend, RF-02, RF-16 e RF-27):** o campo do dia vem no
  topo, já com o dia do satélite (`colheita_sugerida.dia`, posto no ano da época da colheita por
  `services/harvestService.ts`); "Não sei o dia exato" abre as 3 faixas. **Sugestão = seleção:** a faixa
  marcada é sempre a do dia no campo (`harvestFromDate`, a mesma regra do backend) e a faixa azul só diz
  "Já deixamos esse dia no campo" quando o campo tem o dia do satélite; a faixa da URL (voltando da tela 4)
  vale mais que a sugestão, e aí a faixa azul oferece "Usar o dia do satélite". As contas ficam no backend:
  o front só procura o dia na tabela `chuva_que_sobra` (`services/rainLeftService.ts`; só com a faixa, usa o
  dia de colheita da faixa no motor, `bandDate`), lê o `fim_das_chuvas` e o mês em destaque
  (`mes_chuva_abaixo_eto`) e pede o custo do atraso a `GET /api/custo-atraso`
  (`repositories/custoAtrasoRepository.ts` → `services/delayCostService.ts`). Gráficos do design system:
  `RainLeftChart` (mediana em linha cheia, ano seco tracejado) e `RainEtoChart` (chuva cheia, gasto
  listrado, mês em destaque com contorno e texto). Cada bloco sem dado não aparece.
- **Tela 4 "O que o satélite viu" = raio-X da sua terra (tarefa 0043 do backend, RF-29):** os números vêm
  de `GET /api/raio-x` (`repositories/raioXRepository.ts` → `services/raioXService.ts`), pedido com a
  colheita e a terra da URL e **sem** as safras confirmadas (como o talhão: confirmar não recarrega o
  painel). O service só ordena e prepara (`xRayBlocks`, `heatmap`, `alertList`, `regionSide`,
  `futureAgreement`, `soilParts`, `ndviLevel`); as frases ficam no bloco `xray` das mensagens. O painel é
  o **único elemento escuro da tela**, com os tokens `--color-instrument-*` (contraste conferido) e o
  design system `Instrument` (`InstrumentPanel`, `InstrumentBlock` com selo de fonte e resolução,
  `SplitBar`, `Meter`, `CountUp`, `NdviHeatmap`) e o `MiniMap` (Leaflet parado). A entrada em sequência é
  CSS e o `CountUp` só conta com `matchMedia` e sem "reduzir movimento"; o texto no DOM é sempre o valor
  final ("Ouvir", leitor de tela e testes). Bloco sem dado não aparece. A faixa de calor do NDVI tem 5
  cores que sempre escurecem (`--color-ndvi-1..5`, cortes `NDVI_BREAKS`), legenda numérica, "sem leitura"
  listrado e o que aconteceu no ano escrito em cada linha (nada só por cor). Alertas (só os que o backend
  manda, sem granizo) e cartões menores com "ver na sugestão". Os "Saiba mais" só apontam para artigos
  que existem. Sem o raio-X (API antiga ou falha), a tela volta aos cartões de antes. Aviso nunca leva o
  selo de "pronto" (✓).
- **Abas da resposta e aba Sugestão (tarefa 0044 do backend, RF-05, RF-22 e RF-30):** as abas são
  "Sugestão", "Comparar" e "Plano de 3 anos", nessa ordem (`controllers/useAnswerNav.ts`); as URLs
  continuam `/resposta`, `/opcoes` e `/plano`. O topo das três (`views/AnswerHeader.tsx`) tem o "Voltar",
  as abas e o seletor "O que você quer mais?" ("Mais segurança", "Renda", "Cuidar da terra"; sem escolha =
  equilíbrio). O objetivo fica na URL (`objetivo=seguranca|renda|terra`, lido e escrito pelo
  `flowParams.ts`, então segue em todas as telas) e **não pede nada à API**: a ordem e o plano de cada
  objetivo vêm prontos do motor (`objetivos` do `/recomendacao`); `services/suggestionService.ts` só
  escolhe (sem o campo, API antiga, reordena pelo eixo como antes). Na Sugestão: a 1ª opção do objetivo é o
  "Ano 1 do seu plano" e o plano do objetivo aparece em miniatura (`MiniPlan`); "deu certo" é explicado com
  o `criterio` da API (nunca número fixo na tela); o explorador ano a ano (`YearBarsChart`: barra =
  `anos_detalhe[].isna`, linha de corte = `criterio.isna_min`, ano com aperto listrado, "N"/"L" escritos
  para El Niño/La Niña) abre o detalhe do ano tocado, com o `ano` na URL; o detalhe pede a safra dia a dia
  a `GET /api/safra-passada` com a `colheita` da URL e a `opcao` mostrada (`pastSeasonService`). A frase de
  El Niño / La Niña só aparece com `enso_acerto[].clara`. A linha "Água" (`WaterBar`) e o selo "Sede da
  cultura" (`ThirstBadge`, 1 a 3 gotas e o texto) vêm de `opcoes[].agua`; sem o campo, não aparecem. O
  aviso da colheita tarde é um só, com as culturas de `fora_da_janela` juntas pela `data_limite`
  (`lateNotice`). Toda imagem de cultura é o `PlantImage` do design system. Os links "Saiba mais" da aba
  ficam em `SUGGESTION_ARTICLES` e `cropArticle` (um teste confere que o artigo existe em pt e en).
  **Não há mais relatório nem a tela solta da safra passada:** `/relatorio` e `/safra-passada?…&ano=X`
  levam para `/resposta` (com o `ano`, na safra passada). Não crie link para elas.
- **Telegram (`VITE_TELEGRAM_BOT_URL`):** link público do bot (ex.: `https://t.me/NomeDoBot`). Vazio = a interface
  não fala do Telegram. Só o link: o token do bot nunca entra no front.
- **Variáveis de ambiente:** tudo que começa com `VITE_` é **público** (vai no JavaScript do navegador).
  Nunca coloque segredo, token ou senha em `VITE_*`. Segredos ficam só no backend.
- **Idioma:** textos da interface em português (produtor) e inglês (juízes), conforme o PRD (RNF-03).
- **Celular:** a interface precisa funcionar em tela de celular (RNF-04).
- **Dependências:** `npm install <pacote>` (ou `-D` para dev). Biblioteca nova grande (mapa, gráficos,
  UI kit) → justifique na descrição do PR.
- **Visual:** cores, tamanhos e raios só por variável de `design-system/tokens.css` (nunca hex solto).
  A referência visual é a interface nova feita no Lovable (cabeçalho com slogan, rodapé com o aviso,
  cartões com borda). Veja tudo junto em `/design-system` (só no ambiente local).
- **Ícones:** sempre de `design-system/icons` (lucide por baixo, sempre `aria-hidden`). Não importe
  `lucide-react` direto nas telas: precisa de um ícone novo, adicione lá.
