# Tarefa 0054: Pacote 2 de telas: regras gerais, peças compartilhadas e o ajuste da tela 1

- **Identificador:** `0054`
- **Título:** As regras gerais do pacote 2 (Voltar, navegar sem rolar, "Saiba mais" em nova aba, safra no lugar
  do ano, resposta que faltou não trava, modal grande, 360 px e "Ouvir resumo" em toda tela), as peças que as
  telas 2, 4 e 5 usam e a tela 1 abrindo com a lavoura de demonstração
- **Status:** Concluída (parte da base; as telas 2, 4 e 5 ficam com os outros agentes do pacote)
- **Prioridade:** Alta (pacote 2 de telas, pedido do time em 15/11/2026)
- **PRD:** RF-38 (nova); RF-37 (nota: a demonstração já marcada)
- **Módulos Afetados (só front):**
  - peças: `design-system/components/BackButton.tsx`, `GuideLink.tsx`, `Modal.tsx` (`size="large"`),
    `controllers/useReplaceFlow.ts`, `services/seasonService.ts`, `models/seasonAnswers.ts`,
    `services/seasonAnswersService.ts`, `services/flowParams.ts`, `views/SeasonAnswersForm.tsx`,
    `views/MissingSeasonsNotice.tsx`, `content/guia/slugs.ts`;
  - telas: `/onde`, `/calculando`, `/avisos`, `/comunidade`, `/guia`, `/guia/:artigo`, `/como-funciona`, o cabeçalho
    (abaixo de 380 px) e a vitrine `/design-system`;
  - configuração: `VITE_ABRIR_COM_DEMONSTRACAO` (`projeto/frontend/.env.example` novo, `projeto/.env.example` e o
    `docker-compose.yml`).
- **Referências:** `pacote-2-LEIA-ME.md`, `pacote-2-regras-gerais-prompt.md`, `tela-1-onde-ajuste-prompt.md` e os
  protótipos `tela-4-raio-x.html` e `tela-5-escolher-plano.html` (fora do repositório); tarefas 0052 (modal, "Ouvir
  resumo", cabeçalho) e 0053 (tela "Onde fica a lavoura").

---

## 1. Regras gerais e onde cada uma ficou

| Regra | O que vale | Onde |
| --- | --- | --- |
| 1. Navegação | Sem "Pergunta X de 2" nem barra de progresso. "← Voltar" de verdade em toda tela interna, acima do título: 42 px, borda `#cfdcd4`, fundo branco, texto e seta verdes, hover `#e6efea` | `BackButton` (`to`, `children`, `className?`) |
| 2. Clicar não rola | Escolha que vai para a URL troca com `replace` e `preventScrollReset`; listas com `key` estável; botão que muda de estado não muda de tamanho | `useReplaceFlow()` (mesma rota, `FlowParams`) e `useReplaceUrl()` (endereço pronto); teste com `window.scrollY` |
| 3. "Saiba mais" | Artigo do Guia abre em nova aba (`target="_blank" rel="noopener"`), ícone de abrir fora e "(abre em nova aba)" escondido | `GuideLink` (`slug`, `newTabLabel`, `children`); o `slug` só aceita os artigos que existem (`GUIDE_SLUGS`, com teste) |
| 4. Safra | Nome pela safra (2026 = "2025/26"); a atual é a 2026/27 numa constante só | `seasonService` (`CURRENT_SEASON`, `LAST_SEASONS`, `seasonName`, `satellitePeriod`, `afterSoyPeriod`, `afterSoyMonths`, `soyPeriod`) |
| 6. Resposta que faltou | Pergunta opcional sem resposta fica indefinida e o produtor segue; onde a informação faz falta, o aviso "Você não preencheu as últimas safras" com "Preencher agora" (modal) | `MissingSeasonsNotice` + `SeasonAnswersForm` |
| 7. Modais | O mesmo `Modal`; normal (até 560 px, folha de baixo no celular) e grande (quase a tela toda, 24 px de borda, 8 px no celular, centralizado também no celular) | `Modal size="large"` (o normal é o padrão; `wide` continua para os créditos) |
| 8. 360 px | Nada rola para o lado de 360 a 1440 px; abaixo de 380 px, logo de 30 px, nome de 15,5 px e "Comunidade" de 12,5 px | `Header.module.css`; conferido nas telas da base |
| 9. "Ouvir resumo" | Cada tela com um resumo falado próprio, de 2 ou 3 frases, montado com os números dela, em pt e en | Controllers da base (`useListenSummary`) |

As regras 5 (gráfico do satélite) e 10 (créditos das fotos) ficam com os agentes das telas 4 e 5.

## 2. Respostas das últimas safras (o contrato das telas 4 e 5)

O ano é o da **colheita da soja** (2026 = safra 2025/26). As safras passadas são as 3 antes da atual
(`LAST_SEASONS` = 2024, 2025 e 2026).

- **Na URL:** `safras=2024:milho_braquiaria,2025:pousio,2026:sem_soja`, em ordem de ano e sem codificar `:` e `,`.
  Cada valor é um id de cultura do `culturas.yaml` (`pousio` = "Deixei parado": plantou a soja e, depois dela,
  isso), `soja` (plantou a soja e não disse o que veio depois) ou `sem_soja` (não plantou a soja). E
  `pensa=<cultura>|nao_sei`: o que o produtor pensa plantar depois da soja 2026/27 (a "escolha atual" da tela 5).
  O `data=AAAA-MM-DD` guarda a data da colheita da tela 2.
- **No aparelho:** junto com o ponto salvo (`savedPointRepository`: `data`, `safras` e `pensa`), como já era
  com o `confirmadas`; nunca a fazenda de exemplo.
- **Regras (`seasonAnswersService`, puras):**
  - `parseSeasonAnswers` / `formatSeasonAnswers` / `withSeasonAnswer`, `parseCurrentChoice` / `formatCurrentChoice`;
  - `seasonAnswersFromFlow(params)`: o `safras` ou, sem ele, os links velhos (`confirmadas` e `hoje`: a cultura do
    `hoje` vale; senão `parado` = `pousio` e `plantou` = `soja`);
  - `flowWithSeasonAnswers(params, answers)`: grava o `safras` e tira o `confirmadas` e o `hoje`, para a
    resposta ficar num lugar só;
  - `answeredCount`: conta a safra com cultura ou com "Não plantei"; só "Plantei" (`soja`) ainda falta o depois;
  - `confirmadasFromAnswers`: o `confirmadas` que o `/api/recomendacao` aceita hoje (outra cultura = `plantou`,
    `pousio` = `parado`; `soja` e `sem_soja` ficam sem confirmação, vale o satélite);
  - `todayCrops`: as 3 culturas do "como é hoje" para o `/api/plano`, ou `null` ("não preenchido") se alguma safra
    não tem a cultura (sem resposta, só "Plantei" ou "Não plantei");
  - `currentChoiceCrop`: a cultura do `pensa` ("Ainda não sei" e sem resposta = `null`, a tela usa a sugestão);
  - `soyState`, `nextSoyAnswer`, `nextAfterAnswer`: os botões (o satélite só pré-marca "Plantei"; tocar de novo
    na resposta marcada tira a resposta; escolher o depois marca a soja junto; tocar de novo na cultura tira só o
    depois);
  - `seasonRows(historico)`: as linhas do formulário com o que o satélite viu no `/talhao` (`plantou`/`parado` =
    viu a soja e o depois; `incerto` = viu a soja; `sem_soja` = não viu; `sem_dado` = sem leitura).

## 3. As peças de tela

- **`SeasonAnswersForm`** (controlado, sem buscar dados): uma linha por safra passada, "Soja: Plantei / Não
  plantei" (pré-marcado quando o satélite viu, com a dica "satélite viu plantio · verde 0,71") e "Depois da soja"
  com as 6 opções; com "Não plantei", o depois fica desligado. Com `current`, a linha da safra 2026/27: "✓ Soja
  plantada · colheita prevista em {data}", "Trocar data" e "o que você pensa plantar" com as 6 opções ("Deixar
  parado") e "Ainda não sei". Quando o espaço é estreito (celular ou modal; *container query* de 720 px), as
  perguntas ficam uma embaixo da outra. Não tem título: a tela põe o seu.
- **`MissingSeasonsNotice`**: a faixa amarela com o texto (padrão "Você não preencheu as últimas safras.") e o
  "Preencher agora", que abre o `Modal` (`wide`) com o formulário e o "Salvar" (fecha; as respostas já foram).

## 4. Tela 1 (ajuste)

- `VITE_ABRIR_COM_DEMONSTRACAO` (ligado por padrão; só `false`, `0` ou `nao` desligam): sem `lat`/`lon` na URL, a
  tela abre com a lavoura de demonstração marcada, o mapa perto dela e o "Confirmar local" ligado. Com `lat`/`lon`,
  vale o ponto da URL. A regra fica no `locationService` (`opensWithDemo`, `OPEN_WITH_DEMO`); o controller recebe
  `openWithDemo` pelas dependências (nos testes, ausente = desligado).
- "Usar a lavoura de demonstração" em destaque: borda verde de 2 px, fundo `#f1f5f2`, sombra leve e o selo "Bom
  para testar" / "Good for testing" no canto de cima (entra no nome do botão para o leitor de tela).

## 5. Telas da base

- **Voltar:** o `BackButton` em `/onde`, `/calculando`, `/avisos`, `/comunidade`, `/guia`, `/guia/:artigo` e
  `/como-funciona`. Nenhuma delas tinha "Pergunta X de 2" (ele só existe na tela 2, que é de outro agente).
- **"Saiba mais":** os links do Guia em `/avisos` ("como ler os avisos" e "alertas oficiais") e nos relatos de evento
  da comunidade (fogo, erosão) viram `GuideLink`. Links de navegação dentro do Guia continuam no app.
- **Safra:** na comunidade, "depois da soja 2025/26", "Em que safra?" com "2025/26", "Milheto, safra 2025/26" e a
  região pelo satélite "Na safra 2024/25, …" (pt e en).
- **"Ouvir resumo"** (texto no bloco de cada tela das mensagens):
  - `/calculando`: o lugar e os anos de chuva lidos (não muda a cada fase, para a fala não parar no meio);
  - `/avisos`: sem ponto, o que a tela faz; com ponto, o lugar e quantos avisos ativos; sempre o 193 e o 199;
  - `/comunidade`: o raio, o plantio da safra mais recente (ou a chuva, ou "ainda não há relatos", ou a região
    pelo satélite) e "todo relato é de vizinho";
  - `/guia`: quantos artigos (todos, para a busca não trocar a fala) e como achar; `/guia/:artigo`: o título e o
    "Em uma frase" (`articleSummary` do `guideService`);
  - `/como-funciona`: os anos de chuva, os pesos da nota (do `/api/metodo`) e "nenhum número vem de IA".
- **Vitrine:** `/design-system` (só local) tem a seção "Pacote 2: peças compartilhadas" com tudo funcionando.

## 6. Testes

- `seasonService.test.ts`, `seasonAnswersService.test.ts`, `flowParams.test.ts` (data, safras, pensa),
  `savedPointRepository.test.ts`, `avisosService.test.ts` (o ponto salvo com as respostas);
- `BackButton.test.tsx`, `GuideLink.test.tsx`, `slugs.test.ts`, `Modal.test.tsx` (`large`);
- `useReplaceFlow.test.tsx`: com o `ScrollRestoration` da moldura, a navegação comum sobe a tela, e o hook (e o
  formulário das safras ligado à URL) mantém o `window.scrollY`;
- `SeasonAnswersForm.test.tsx` (inclusive "trocar a resposta não remonta os botões") e `MissingSeasonsNotice.test.tsx`;
- os testes das telas da base (Voltar, "Ouvir resumo", `GuideLink`, safra) e dos controllers (o texto falado, em pt e en).

## 7. Riscos e pendências

- `sem_soja` numa das 3 safras deixa o "como é hoje" sem nota (`todayCrops` = `null`): o produtor respondeu, mas o
  aviso "não preenchido" não serve para esse caso. A tela 5 decide a frase.
- Link velho com `confirmadas=…:plantou` vira `soja` (plantou algo depois, sem dizer o quê): a confirmação "plantou"
  some na API até ele escolher a cultura.
- As telas 2, 4 e 5 ainda gravam a URL com `navigate(…, { replace: true })` (sem `preventScrollReset`) e usam o
  `confirmadas` e o `hoje`: os agentes delas trocam pelo `useReplaceFlow` e pelo `safras`.
- O tamanho do modal grande é só CSS (`[data-size='large']`): o teste confere a variante; o resto foi conferido em
  print (1280, 390 e 360 px).
