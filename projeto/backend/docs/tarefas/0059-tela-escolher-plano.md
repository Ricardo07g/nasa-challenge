# Tarefa 0059: Tela 5 "Escolher" + "Plano de 3 anos" e o relatório para imprimir

- **Identificador:** `0059`
- **Título:** As 3 abas da resposta (Sugestão, Comparar, Plano) viram 2 abas numa tela só ("1. Escolher" e "2. Plano
  de 3 anos"), com o plano em cadeia do motor, culturas fora do prazo comparáveis e escolhíveis e o relatório para
  imprimir em pt e en
- **Status:** Em Progresso (branch `feat/tela-escolher-plano`, sem merge)
- **Prioridade:** Alta (pacote 2 de telas, tela 5)
- **PRD:** RF-42 (nova)
- **Módulos Afetados:** só o front (`projeto/frontend/src`): `controllers/useChoosePlanController.ts` (novo),
  `services/choiceService.ts` (novo), `services/planService.ts`, `services/compareService.ts`,
  `services/suggestionService.ts`, `services/recomendacaoRules.ts`, `services/flowParams.ts` (`escolha`, `ano2`,
  `ano3`), `services/cropListParams.ts` (o pousio vale no `comparar`), `repositories/planoRepository.ts` (`suggest`),
  `repositories/mocks/` (sugestão em cadeia e cultura fora do prazo), `models/plano.ts`, `models/recomendacao.ts`,
  `views/ChoosePlanView.tsx`, `ChooseTab.tsx`, `PlanTab.tsx`, `ChooseModals.tsx`, `PlanReport.tsx`, `choiceTexts.ts`
  (novos), `design-system/components/Tabs.tsx` e `CompareCards.tsx` (novos), `design-system/icons`,
  `design-system/tokens.css`, `i18n/messages.{pt,en}.ts` (bloco `choose`), `pages.tsx`, `routes.tsx`
- **Referências:** `tela-5-escolher-plano-prompt.md`, `tela-5-escolher-plano.html` e `pacote-2-regras-gerais-prompt.md`
  (fora do repositório); tarefa 0056 (motor: fora do prazo, `/api/plano/sugestao`), 0055 (fotos), 0054 (respostas das
  safras, `seasonAnswersService`, `MissingSeasonsNotice`), 0044 e 0045 (as abas antigas, substituídas)

---

## 1. O que mudou

- **Uma tela, duas abas.** `/resposta` e `/opcoes` abrem "1. Escolher"; `/plano` abre "2. Plano de 3 anos". As abas
  são um `tablist` acessível (`design-system/components/Tabs`: setas, Home e End trocam de aba). Trocar de aba troca
  o endereço sem rolar; o botão do fim da aba 1 ("Ver o plano de 3 anos →") abre a aba 2 do topo. Topo comum: "←
  Voltar" (para `/satelite`), "O que plantar depois da soja", "Safra 2026/27 · colheita prevista em {data}" (o
  `data` da tela 2; sem ele, a faixa), "Ouvir resumo" e "Imprimir relatório" à direita.
- **Aba "Escolher".** "O que você quer mais?" em destaque (3 botões iguais; tocar de novo tira; no celular, ícone em
  cima). Cartão "Nossa sugestão" (foto, frase do porquê com os pontos a favor do motor, deu certo, sede, grão) com
  "Por que essa sugestão?" (modal grande) e "Usar no meu plano" → "✓ Está no seu plano" (mesmo tamanho). "Comparar:"
  com as 6 culturas (as 5 do motor e "Deixar parado") em caixinhas com as etiquetas "sua escolha", "sugestão" e
  "fora do prazo"; até 3 e pelo menos 1. Comparação (`design-system/components/CompareCards`): tabela no computador
  (linhas alinhadas com `subgrid`), cartões que arrastam no celular (`scroll-snap`, 86%, bolinhas e a dica); um DOM só.
  Linhas: Deu certo, Água, Clima 2041–2060, Renda, Terra, Prazo, A favor, Contra. Toda célula abre um modal com o
  número, a explicação e a fonte; o do Prazo explica o ZARC e que o seguro não cobre fora dele. Cada coluna termina
  com "Essa é a escolha para o meu plano" (escolha única). Embaixo: "No seu plano, depois da soja 2026/27: **X**."
- **Aba "Plano de 3 anos".** Os 3 anos vêm do `/api/plano/sugestao` com o 1º ano fixo (a escolha). Cada cartão: foto,
  "Depois da soja 2026/27 · mar–jul de 2027", nome, etiqueta (Sua escolha / Nossa sugestão / Você mudou), deu certo,
  sede, "Por quê:" (o `motivo` do motor, só nos anos sugeridos) e "O que plantar". Mudar o 2º ano pede a sugestão com
  os 2 fixos e mostra o alerta (`role="status"`) "Você mudou 2027/28 para **Deixar parado**. Para 2028/29 agora
  sugerimos **Milheto**: a terra ficou descoberta; cobre rápido e aguenta a seca." com "Voltar ao plano sugerido";
  mudar o 3º ano pede o plano inteiro ao `/api/plano`; mudar o 1º muda a escolha da aba 1 (e põe a cultura na
  comparação). Notas "Seu plano × Como é hoje" (cada nota abre o modal com a conta), chuva aproveitada (uma barra por
  ano), "E se o ano vier seco?" (o sinal da NOAA em duas frases, a orientação de fevereiro, o SMAP de agora, o Plano A
  e o Plano B do motor) e "Ver meu planejamento →" (`/planejamento` com o fluxo).
- **"Como é hoje".** Sai a seção com as perguntas. As notas usam as 3 últimas safras do raio-X (`safras`): com as 3
  culturas, o `/api/plano` delas; faltou resposta (ou só "Plantei"), "não preenchido" com o `MissingSeasonsNotice`
  (o "Preencher agora" grava as respostas na URL sem sair da tela nem rolar); com "Não plantei" (`sem_soja`) numa
  safra, "Sem soja em {safra}: não dá para comparar", **sem** o aviso de não preenchido (`todayState` no `planService`).
- **Relatório para imprimir.** "Imprimir relatório" (nas duas abas) chama `window.print()`. O relatório
  (`views/PlanReport.tsx`) fica direto no `<body>` (portal), escondido na tela (`hidden`); o CSS de impressão esconde
  o resto do `<body>` e mostra só ele: cabeçalho (lugar, safra, data), 1. Sua terra (do `/api/raio-x`), 2. Suas últimas
  safras (e o que ele pensava para 2026/27, ou "não preenchido"), 3. Opções comparadas (marcando a sugestão e a
  escolha), 4. Plano de 3 anos (cultura, deu certo, motivo e as notas), 5. E se o ano vier seco?, 6. Fontes e "Não
  substitui o seu agrônomo". Sai no idioma da tela.
- **Fotos:** `PlantPhoto` (tarefa 0055) no cartão da sugestão, nas colunas da comparação e nos cartões do plano.
- **"Ouvir resumo":** "A nossa sugestão para depois da soja é {sugestão}. Você pensava em {escolha atual}. Compare as
  opções e escolha uma para o seu plano de 3 anos." (sem escolha atual, sem a frase do meio).
- **Saíram:** `AnswerView`, `OptionsView`, `PlanView`, `AnswerHeader`, `useAnswerController`, `useOptionsController`,
  `usePlanController`, `useAnswerNav` (com os testes), e as funções que só elas usavam (`buildSuggestion`,
  `lateNotice`, `suggestedPlan`, `thirstByCrop`, `rankForObjective`, `compareChips`, `comparedCrops`, `currentPlan`,
  `todayRows`, `todayPlan`, `alternativeSummary`, `futureSummary`, `harvestYear`…). Ficaram o explorador ano a ano
  (`yearBars`, `selectedYear`, `clearEnsoNotes`) e os pontos a favor e contra (`whyUse`, `whyAvoid`, `failureCounts`).

## 2. O que fica na URL

| Parâmetro | O que é | Sem ele |
| --- | --- | --- |
| `objetivo` | "O que você quer mais?" (já existia) | equilíbrio |
| `comparar` | até 3 culturas comparadas (o pousio agora vale) | a escolha e a sugestão (se forem a mesma, a próxima do ranking) |
| `escolha` | **novo**: a cultura do 1º ano do plano | a escolha atual do raio-X (`pensa`); com "Ainda não sei" ou sem resposta, a sugestão |
| `ano2`, `ano3` | **novos**: o 2º e o 3º ano que o produtor mudou | a sugestão em cadeia |
| `ano` | o ano aberto no "Por que essa sugestão?" (link dos avisos) | modal fechado |

Escolher para o plano congela a comparação que está na tela com a cultura escolhida (a coluna não some debaixo do
dedo) e solta `ano2` e `ano3`. Trocar o objetivo solta a comparação e, sem `escolha` gravada, também os anos.

## 3. Decisões

- **Plano B:** o `plano_ab` da API (a cultura que mais deu certo quando a do Plano A falhou), não "milheto" fixo como
  no protótipo. "Não precisa" com `plano_ab.motivo` = `pousio` ou `nunca_falhou`; com `nenhuma_melhor`, "siga com…".
- **Fora do prazo:** pode ser comparada e escolhida (inclusive em qualquer ano do plano, com "(passou do prazo)" na
  lista), sempre com "Passou do prazo ({data})"; a sugestão nunca é uma delas (a API garante e o front confere).
- **"Deixar parado" na comparação:** sem conta do motor; as linhas dizem "Sem lavoura: não entra na conta", a terra
  usa o `pousio.texto` da API e "A favor" / "Contra" são os fatos fixos do protótipo (sem número).
- **Sem corte novo no front:** os rótulos Bom/Médio/Fraco são os da API (deu certo, renda, terra); o clima 2041–2060
  não ganha rótulo (o protótipo inventava um corte).
- **Tela não pisca ao recarregar:** com a recomendação já na mão, um novo pedido (ex.: respostas novas das safras)
  mantém a tela; enquanto o plano recalcula, fica o último resultado com "Recalculando…".
- **Relatório num portal no `<body>`:** o CSS global já esconde `header` e `footer` na impressão; por isso o cabeçalho
  do relatório é um `<div>`.
- `useFlowRecomendacao` não mudou nesta tarefa (a correção do `confirmadas` pelas respostas entra pelo `main`).

## 4. Testes (TDD)

| Teste | Red |
| --- | --- |
| `planoRepository.test.ts`: `suggest` chama `/api/plano/sugestao`; mock da cadeia e da cultura fora do prazo | 3 falhas (`suggest` não existia) |
| `flowParams.test.ts`: `escolha`, `ano2`, `ano3`; pousio no `comparar` | 3 falhas |
| `choiceService.test.ts` (16 casos: ordem com as fora do prazo no fim, sugestão só no prazo, escolha, comparação de partida, caixinhas, fluxos) | módulo inexistente |
| `planService.test.ts` (cadeia, cartões, anos mudados, sinal em 2 frases, Plano B, chuva, cache, `todayState` com `sem_soja`) | 14 + 3 falhas |
| `Tabs.test.tsx`, `CompareCards.test.tsx` | módulos inexistentes |
| `useChoosePlanController.test.ts` (20 casos) | módulo inexistente |
| `ChoosePlanView.test.tsx` (18 casos, com o `ScrollRestoration`: clicar numa opção não muda o `scrollY`) | escrito depois das views (ver riscos) |
| `routes.test.tsx`: as rotas abrem a aba certa, Voltar, título | 4 falhas |

`npm test`, `npm run lint`, `npm run build` e `pre-commit run --all-files` passando.

## 5. Conferência visual

API deste worktree na porta 8009 (cópia do banco), front na 5189, Chrome headless. Lavoura de demonstração, colheita
tarde (3/mar/2027), com e sem as respostas das safras: as duas abas, o modal grande, o modal do prazo, a cadeia com o
alerta, "não preenchido", os cartões arrastando no celular (sem rolagem lateral em 390 e 360 px: `scrollWidth` igual à
largura) e o relatório em PDF, em pt e en.

## 6. Riscos

- **Conflito com o agente Base e as telas 2 e 4:** `flowParams.ts` ganhou 3 campos (aditivo) e `cropListParams.ts`
  aceita o pousio no `comparar`; o mock do `/recomendacao` na colheita tarde agora traz a cultura fora do prazo (como
  a API). "Como a conta é feita" (`scoreRows`) não mudou e passa a listar a fora do prazo junto (risco da tarefa 0056).
- **`/planejamento`** ainda não existe nesta branch (é do agente da tela 4): o link aponta para lá mesmo assim.
- **Testes das views escritos depois do código** (o resto da tarefa seguiu o red-green); cobrem os comportamentos do
  prompt, mas não viram vermelho antes.
- A frase "caem até junho" do prompt virou "caem até 31 de julho": o número da API (`chuva.fim`) vai até o fim de julho.
