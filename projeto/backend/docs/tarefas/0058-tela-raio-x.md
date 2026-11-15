# Tarefa 0058: Tela "Raio-X da sua terra" nova e a rota `/planejamento`

- **Identificador:** `0058`
- **Título:** A tela 4 (`/satelite`) fica igual ao protótipo do pacote 2: blocos enxutos que abrem o detalhe num
  modal, o gráfico das safras e as confirmações por safra; os alertas e os cartões de clima vão para `/planejamento`
- **Status:** Concluída
- **Prioridade:** Alta (pacote 2 de telas, pedido do time em 15/11/2026)
- **PRD:** RF-41 (nova); RF-25 e RF-29 continuam valendo, com as respostas da tarefa 0054
- **Módulos Afetados:** só o front.
  - `views/SatelliteView.tsx` (refeita) e `controllers/useSatelliteController.ts`;
  - `views/PlanningView.tsx` e `controllers/usePlanningController.ts` (novos), `pages.tsx` e `routes.tsx`;
  - `services/seasonChartService.ts` (novo), `services/raioXService.ts` (sai a `heatmap`);
  - `i18n/xrayTexts.ts` (novo: as frases dos blocos e os resumos falados) e `i18n/messages.{pt,en}.ts`;
  - design system: `Instrument.tsx` (bloco = botão), `SeasonChart.tsx` (novo; sai o `NdviHeatmap`), `MiniMap.tsx`
    (crédito sem bandeira) e `tokens.css`;
  - `views/ShareSeasons.tsx` (a safra pelo nome, "Safra 2023/24").
- **Referências:** `pacote-2-regras-gerais-prompt.md`, `tela-4-raio-x-prompt.md` e o protótipo `tela-4-raio-x.html`
  (fora do repositório); tarefa 0043 (o raio-X anterior), tarefa 0054 (as respostas das safras e as peças do pacote
  2: `BackButton`, `GuideLink`, `Modal` grande, `useReplaceFlow`, `seasonService` e `SeasonAnswersForm`).

---

## 1. Decisão

O raio-X continua, mas mais limpo: menos texto à vista e o detalhe em modais. A confirmação das últimas safras passa
a ser feita aqui, por safra (a cultura de cada uma, não só "plantou / parado"). Onde o protótipo e o pedido
divergem, vale o pedido.

## 2. Estrutura

| Parte | O que tem |
| --- | --- |
| Topo | `BackButton` para `/quando` com o fluxo, "Pronto. O satélite já viu o resto.", "Confira o raio-X da sua terra e confirme as últimas safras." e "Ouvir resumo" |
| Painel escuro | Mapinha, "RAIO-X DA SUA TERRA", o lugar ("Lavoura de demonstração, perto de Uberlândia (MG)" ou "Perto de {cidade}"), as coordenadas e o selo "Leitura mais recente". 8 blocos (4 por linha; 2 até 1100 px) e a nota "Toque num bloco para ver os detalhes…" |
| Suas últimas safras | Título, de quando o satélite olha e o selo do que ele viu da soja; o gráfico; "Confirme as últimas safras" (o `SeasonAnswersForm`, com a safra atual); o "Compartilhar com a comunidade"; "Usamos essas respostas…" e "Saiba mais: rotação de culturas" (nova aba) |
| Ação | "Ver o que plantar →" com o que falta ao lado; no celular, preso embaixo com "{n} de 3 safras confirmadas" |

## 3. Os 8 blocos

No bloco, só o nome, o número, uma linha e o selo da fonte. **O bloco inteiro é um botão** (`aria-haspopup`) que
abre o `Modal` com o título, o nome, o número, o texto completo (negrito pelo `parseInline`), a fonte e o "Saiba
mais" (`GuideLink`, nova aba). As frases ficam em `i18n/xrayTexts.ts` (`xrayText`), testadas com os números da
lavoura de demonstração.

| Bloco | Número | Linha | Saiba mais |
| --- | --- | --- | --- |
| Solo | % de argila, com a barra argila/silte/areia | "Terra argilosa" (ou "Você escolheu: terra arenosa") | `raio-x` |
| Água que a terra guarda | mm | "Aguenta ~16 dias sem chuva na floração" | `raio-x` |
| Umidade da terra agora | %, com a barra | "Mais úmida que em 59% dos anos nesta época" | — |
| Verde da lavoura | NDVI | "Pico da última soja: 0,90 (jan/2026)" | — |
| Chuva num ano típico | mm | "De janeiro a julho, média de 20 anos" | `quando-a-chuva-acaba` |
| Maior veranico | dias | "Seguidos sem chuva, em 2024" | `veranico` |
| Calor forte | "1 de 20 anos" | "Com 35 °C ou mais de março a maio" | `calor-35-graus` |
| Sua área e a região | % | "Mais chuvosa que 62% da região (mar–mai)" | — |

- O "Não é? Trocar" do solo virou **"Sua terra é diferente?"**, dentro do modal do Solo (arenosa / média /
  argilosa). Escolher grava `solo` na URL pelo `useReplaceFlow` (sem rolar), o modal fica aberto e o painel continua
  na tela enquanto o raio-X recarrega (vale o último que chegou).
- O protótipo diz "(2016 a 2025)" no texto da umidade: a API não manda esses anos, então o texto não diz.
- Sem o raio-X (falha ou API antiga), o painel não aparece e a terra fica num cartão claro com a mesma troca.

## 4. O gráfico das safras

A regra fica em `services/seasonChartService.ts` (`seasonChart`), o desenho no `SeasonChart` do design system.

- **Com NDVI** (`historico_ndvi` do `/raio-x`): todas as safras com leitura (2016/17 a 2025/26), uma linha por safra,
  com "jan–jul 2024" embaixo do nome (`satellitePeriod`) e as 14 leituras de janeiro a julho nas 5 cores do NDVI.
  Em cima, as faixas Soja / Colheita / Depois da soja (a colheita é a coluna do dia em que a soja seca) e os meses.
  As 3 safras que o produtor confirma têm um destaque leve. A safra confirmável que o NDVI não trouxe entra listrada.
- **Sem NDVI:** só as 3 últimas safras, listradas ("sem leitura do satélite"), nas colunas de sempre do MODIS, com a
  colheita na data do produtor (sem data, o depois da soja começa em abril).
- **Safra atual 2026/27:** sempre a última linha, tracejada, com "a planejar", "pensa em {cultura}" ou "ainda não sabe".
- **Dentro das barras não entra nenhum texto** (regra geral 5): o teste confere que a barra está vazia de texto.
- **Coluna da direita:** a resposta do produtor ("✓ Milho com braquiária"; "✓ Deixei parado" em laranja; "✓ Não
  plantei soja") ou o que o satélite viu ("satélite: plantou", "parada", "sem certeza", "sem leitura", "sem soja").
  Só "Plantei" (sem o depois) mostra o que o satélite viu. Sem os dois, "Falta confirmar". No celular, a coluna sai
  da vista (como no protótipo), mas continua para o leitor de tela.
- **Título que conta pelas respostas:** "Na entressafra, sua área ficou parada em {p} de {n} safras": `n` são as
  safras com soja (pela resposta ou, sem ela, pelo satélite) e `p`, em quantas a terra ficou parada (a resposta vale
  no lugar do satélite). Sem soja em nenhuma: "O satélite não viu soja aqui nas safras que leu". Sem NDVI: "As
  últimas safras, pelo que você marcar".

## 5. As confirmações

- O formulário é o `SeasonAnswersForm` da tarefa 0054, com as 3 últimas safras (`seasonRows(historico)`, o que o
  satélite viu no `/talhao`, pedido **sem** as respostas) e a linha da safra atual (`current`).
- Responder grava `safras` na URL (`flowWithSeasonAnswers`, que tira o `confirmadas` e o `hoje` dos links antigos);
  a safra atual grava `pensa`. Tudo pelo `useReplaceFlow`: **clicar não mexe na rolagem** (teste com o roteador e
  o `ScrollRestoration` em `pages.satellite.test.tsx`, e conferido no Chrome em 1280 e 390 px).
- A data da colheita vem do `data` da tela 2 ("colheita prevista em 3 de março de 2027"). Com só a época, o
  formulário diz "colheita prevista no começo de 2027" (ver os riscos). "Trocar data" volta para `/quando` com o
  fluxo inteiro.
- O texto acima da tabela e o da ação mudam sem leitura do satélite ("o que vale é a sua resposta"; "o plano não
  compara com “como é hoje”").
- As respostas também ficam no aparelho: a moldura guarda o fluxo da URL no ponto salvo dos avisos (tarefa 0054).
- "Ver o que plantar" leva para `/resposta` com o fluxo inteiro (`safras`, `pensa`, `data`, `colheita`, `solo`) e já
  pede a recomendação com o `confirmadas` que sai das respostas (`confirmadasFromAnswers`). Nada é obrigatório.
- "Compartilhar com a comunidade" (tarefa 0047) continua: uma linha por safra respondida com soja, com a cultura já
  marcada ("Deixei parado" vai pronto); não aparece na lavoura de demonstração.

## 6. "Ouvir resumo"

Pelo texto do protótipo, com os números da tela (`xraySummary`): "Sua terra é argilosa e guarda cerca de 60
milímetros de água. Hoje ela está mais úmida que em 59% dos anos. Num ano típico chovem 862 milímetros de janeiro a
julho, e o maior veranico foi de 43 dias. Confirme abaixo o que você plantou nas últimas safras." Frase sem o bloco
não entra; com a terra escolhida, fala a escolha.

## 7. `/planejamento`

"Alertas da sua área", "20 anos de chuva" e "Clima 2041–2060" saíram do raio-X e foram para a nova rota
`/planejamento` (`PlanningView`, `usePlanningController`), **como eram**: os mesmos textos, os mesmos dados do
`/raio-x` e, sem ele, os cartões de antes (anos de chuva e clima). Tem o `BackButton` para `/resposta` com o fluxo,
o título "Seu planejamento" e o "Ouvir resumo" (`planningSummary`: os alertas, os 20 anos de chuva e o clima). Os
"Saiba mais" dos alertas passaram a abrir em nova aba (`GuideLink`, regra geral 3). A tela será refeita no próximo
pacote; o link "Ver meu planejamento →" do Plano é da tela 5.

## 8. Testes

- `seasonChartService.test.ts`: linhas com e sem NDVI, faixas e meses, safra que falta, coluna da direita, título.
- `i18n/xrayTexts.test.ts`: cada bloco (pt e en) e os dois resumos falados.
- `Instrument.test.tsx`, `SeasonChart.test.tsx`, `MiniMap.test.tsx` (crédito sem bandeira).
- `useSatelliteController.test.ts`, `usePlanningController.test.ts`, `SatelliteView.test.tsx`, `PlanningView.test.tsx`,
  `ShareSeasons.test.tsx`, `routes.test.tsx` e `pages.satellite.test.tsx` (a rolagem não muda).

## 9. Riscos

- **Época sem data:** o `SeasonAnswersForm` só aceita a data (`harvestDate`); com só a época, a linha diz "no começo
  de 2027" em vez do texto da época. Pede uma prop de texto no formulário (peça da tarefa 0054).
- **Telas 5 a 7:** a URL agora leva `safras` e não `confirmadas`. O `useFlowRecomendacao` ainda lê o `confirmadas`;
  ele precisa passar a usar `confirmadasFromAnswers(seasonAnswersFromFlow(params))` (trabalho das telas da resposta).
