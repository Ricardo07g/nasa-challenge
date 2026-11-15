# Tarefa 0060: Tela 6 "Seu planejamento" e o relatório só nela (pacote 3)

- **Identificador:** `0060`
- **Título:** A `/planejamento` provisória vira a tela final do fluxo (resumo do plano, "O que fazer agora" por regra,
  alertas da área, passado e futuro das culturas do plano, comunidade "em breve" com o Guia e o relatório de 7
  seções); o "Imprimir relatório" e o relatório saem da tela 5
- **Status:** Concluída
- **Prioridade:** Alta (pacote 3 de telas, passos 2 e 3: ajuste da tela 5 e tela 6)
- **PRD:** RF-43 (nova); ajusta a RF-42 (tela 5 sem o relatório) e a RF-41 (a `/planejamento` refeita)
- **Módulos Afetados:** só o front (`projeto/frontend/src`): `controllers/usePlanFlow.ts` (novo: o plano da URL,
  igual nas telas 5 e 6), `controllers/useChoosePlanController.ts` (usa o `usePlanFlow`; sem `print`, `today`,
  `raioX` e `report`), `controllers/usePlanningController.ts` (refeito), `services/planningService.ts` (novo),
  `i18n/planningTexts.ts` (novo), `i18n/format.ts` (`formatShortMonth`, `formatMonthRange`), `i18n/xrayTexts.ts` (sai
  o resumo provisório da `/planejamento`), `i18n/messages.{pt,en}.ts` (bloco `planning` refeito, com o `report`
  que veio do `choose`; nova frase do `choose.plan.final`), `views/PlanningView.tsx` e `.module.css` (refeitos),
  `views/PlanReport.tsx` e `.module.css` (vieram da tela 5, agora com 7 seções), `views/ChoosePlanView.tsx` e
  `.module.css` (sem o botão e o relatório), `design-system/icons` (`CycleIcon`, `BookIcon`),
  `design-system/tokens.css` (bloco "Tela 6"), `pages.tsx`
- **Referências:** `pacote-3-LEIA-ME.md`, `tela-5-ajuste-prompt.md`, `tela-5-escolher-plano.html`,
  `tela-6-planejamento-prompt.md`, `tela-6-planejamento.html` (versão de 15/11, 14:13, com a comunidade "em breve")
  e `pacote-2-regras-gerais-prompt.md` (fora do repositório); tarefas 0059 (tela 5), 0058 (a `/planejamento`
  provisória), 0056 (motor: prazo, `/api/plano/sugestao`), 0055 (fotos), 0054 (respostas das safras)

---

## 1. Ajuste da tela 5 (`/resposta`, `/opcoes`, `/plano`)

- Sai o "Imprimir relatório" da linha das abas (as abas ficam sozinhas à esquerda; no celular, continuam em 2
  colunas), sai o relatório (`PlanReport`, o `@media print` e o `<div>` no `<body>`) e saem do controller o `print`,
  o `today`, o pedido do raio-X e o `report`.
- A frase antes de "Ver meu planejamento →" muda: "Pronto para ver tudo junto: alertas, o que fazer depois e o
  relatório para imprimir." / "Ready to see it all together: alerts, what to do next and the report to print."
- **Movido, não apagado:** o `PlanReport`, o CSS de impressão, os textos (`choose.report` → `planning.report`,
  `choose.print` → `planning.print`) e os testes do relatório foram para a tela 6 num commit só deste passo; depois o
  relatório ganhou as 7 seções.

## 2. Tela 6 "Seu planejamento" (`/planejamento`)

**O plano é exatamente o da tela 5.** O cálculo do plano saiu do `useChoosePlanController` para o `usePlanFlow`
(recomendação, escolha do 1º ano, comparação, sugestão em cadeia do `/api/plano/sugestao` e, com o 3º ano mudado, o
`/api/plano`); as duas telas chamam o mesmo hook com a mesma URL (`escolha`, `ano2`, `ano3`, `comparar`, `objetivo`,
`safras`, `pensa`, `data`, `colheita`, `solo`, `exemplo`).

Blocos, nesta ordem:

1. **Topo:** "← Voltar ao plano" (`/plano` com o fluxo inteiro), "✓ Seu planejamento está pronto", "Seu
   planejamento", o lugar ("Lavoura de demonstração, perto de Uberlândia (MG)" com `exemplo=1`; fora dela, "Sua
   lavoura, perto de {lugar}" com o mesmo nome da tela 1: o reverse do Photon, um pedido depois de 400 ms, e sem
   resposta o `nearestPlace`) e "colheita da soja prevista em **{data}**" (só com a época: "no meio de fevereiro"), e
   "Ouvir resumo".
2. **Resumo do plano:** um cartão por ano (`PlantPhoto` com o crédito, "Depois da soja {safra}", "mar–jul de {ano}",
   a cultura, "Deu certo em X de 20 anos") e o cartão das ações ("Imprimir relatório" e "Mudar o plano", que leva a
   `/plano`). No celular, foto de 108 px à esquerda e as ações embaixo com botões de largura total.
3. **"O que fazer agora"** (`planTimeline`, por regra): Agora (de hoje até a colheita, marcador cheio e "agora");
   Fevereiro (a 1ª frase do `sinal`, a previsão da NOAA com fase e %, e o Plano B do `plano_ab`; a etiqueta azul
   "Plano B: X" some sem Plano B ou quando o 1º ano já é ele); a colheita da soja (a `data` ou o dia da época no motor,
   `bandDate`); "Plante X até {prazo do ZARC}" (o `data_limite` da cultura no `/recomendacao`; fora do prazo,
   `fora_do_prazo`, em laranja: "Passou do prazo do ZARC ({data}): o seguro rural não cobre."); a fase em que a planta
   mais precisa de água (plantio = a `data` ou a `entrada.semeadura`; na floração, plantio + `ciclo.floracao_dias` com
   a `criterio.janela_dias` antes e depois; no pegamento das coberturas, do plantio ao fim da janela; cartão laranja);
   o fim do ciclo (plantio + `ciclo.dias`: "Colha e deixe a palha no chão" ou, sem grão, "Deixe a palha no chão"); e
   out–nov, "Próxima soja; depois dela, {2º ano}". No celular, a data sobe para cima do cartão. Sem "Adicionar à
   agenda".
4. **Alertas da sua área** (`planningAlerts`, até 3, cada um só com dado): Agora (o `sinal`, borda azul, sem "Saiba
   mais"), Chuva forte (`raio-x` `alertas.chuva_forte`, "Saiba mais: como evitar erosão") e Fogo (`alertas.fogo`,
   "Saiba mais: fogo na palha"), cada um com o rótulo e o ícone, a frase com o número, "O que fazer:" e a fonte. "Ver
   todos os avisos →" (`/avisos` com o fluxo) e a faixa laranja da Defesa Civil com "Ver alertas oficiais"
   (`/avisos…#alertas-oficiais`).
5. **"Seu plano: o que já aconteceu e o que vem":** a tabela "Deu certo em quantos anos" (uma linha por ano do plano,
   `anos[].anos_bons`, `futuro_anos_bons` e `total_anos` do `/api/plano`, barra verde e azul) e "Clima de 2041 a
   2060" (`cartoes.clima_futuro` do raio-X; sem ele, o `clima_futuro` do `/recomendacao`, o mesmo número), com a
   concordância dos modelos, "Saiba mais" (`clima-2041-2060`) e o cenário (`ssp245` → "SSP2-4.5").
6. **Comunidade (em breve) e Guia:** "Em breve", "Comunidade da sua região", o texto e 3 pílulas; à direita, "Enquanto
   isso, o Guia explica cada cultura, o plantio e o clima." e "Abrir o Guia" (`/guia`). Nenhum link para
   `/comunidade`.
7. **Relatório:** o cartão "Relatório do seu planejamento" com a lista do que vai na folha e "Imprimir relatório"
   (sem as 3 últimas safras respondidas, o `MissingSeasonsNotice` com "Preencher agora", que grava `safras` sem
   rolar) e "Tem outra lavoura? Fazer um novo planejamento" (`/onde`).

**Relatório impresso** (os dois botões chamam `window.print()`; o `PlanReport` num portal no `<body>`, `hidden` na
tela; margem de 16 mm, `break-inside: avoid` por seção; 2 folhas A4 na lavoura de demonstração): cabeçalho "Raiz
Orbital · Relatório do planejamento", o lugar com as coordenadas, a colheita e "Gerado em". 1. Sua terra (solo e
água, SMAP, chuva típica, maior veranico, do raio-X); 2. Últimas safras (a resposta, ou o que o satélite viu, ou "não
preenchido", e o que ele pensava para 2026/27); 3. Opções comparadas (as colunas da tela 5, com deu certo, grão e
prazo, marcando "Sua escolha", "Nossa sugestão" e "Passou do prazo"); 4. Plano de 3 anos (Safra, 2005–2024,
2041–2060, Prós e Contras com os mesmos textos "A favor" e "Contra" da tela 5) e "Como o plano ajuda a ganhar"
(`planGain`: as safras com grão pelo `renda.da_grao`, o que as coberturas devolvem pelos fatos `cobre_terra`,
`deixa_nitrogenio` e `quebra_nematoide` do `/api/plano`, e o Plano B); 5. O que fazer e quando (a linha do tempo em
tabela); 6. Alertas e clima; 7. Fontes e aviso ("Não substitui o seu agrônomo nem os alertas da Defesa Civil").

**"Ouvir resumo":** "Seu plano: {cultura 1} depois da soja de {safra 1}, {cultura 2} em {safra 2} e {cultura 3} em
{safra 3}. Colha a soja por volta de {data} e plante {cultura 1} até {prazo}. Em fevereiro, confira o sinal do outono:
se o ano vier seco, troque para {Plano B}." (sem prazo, "logo depois"; fora do prazo, "o prazo do ZARC acabou em
{data}"; sem Plano B, só "confira o sinal do outono").

## 3. Decisões

- **Um hook para o plano (`usePlanFlow`):** garante que a tela 6 mostra o mesmo plano da tela 5, sem copiar a lógica.
  Refactor sem mudar a tela 5 (os testes dela passaram antes e depois).
- **Datas da linha do tempo:** a colheita é a `data` ou o dia da época no motor (`bandDate`: 5/fev, 15/fev, 28/fev); o
  plantio é a `data` ou a `entrada.semeadura` (o mesmo "Plantando em" da tela 5). "Agora" vai do mês de hoje ao mês da
  colheita ("nov–mar" para 3/mar; "nov–fev" só com a época tarde), não "nov–fev" fixo como no protótipo. A colheita da
  cultura mostra o mês do fim do ciclo ("jun"), não uma faixa de dois meses (o motor só dá os dias do ciclo).
- **Fase da água pelo critério do motor:** as coberturas (milheto, crotalária) apertam no pegamento (`criterio.fase =
  pegamento`, os primeiros 30 dias), então o passo diz isso em vez de falar de floração. Sem o critério, só a data
  da floração.
- **Texto da floração sem o nome da cultura** ("a floração vem por volta de 65 dias depois do plantio"): evita o artigo
  (o/a) e não repete número de regra no front (os dias vêm do `ciclo`).
- **"Agora" do alerta e do passo de fevereiro:** a frase da previsão vem pronta do `sinal` do `/api/plano` (ou do
  `/recomendacao` no plano sugerido), com fase, % e fonte; não pedimos o `/api/avisos` de novo.
- **Alertas:** chuva forte com os números da API ("Em 20 anos, houve 5 dias com 50 mm ou mais…"), não "em 5 dos últimos
  20 anos" do protótipo (a API conta dias, não anos). A geada (que existia na provisória) não está entre os 3 do prompt.
- **Âncora dos alertas oficiais:** o link usa `#alertas-oficiais`; o id fica na tela de Avisos (outro agente do pacote 3
  cria). Esta tarefa não mexe em `/avisos`.
- **Clima de 2041 a 2060:** sem a frase "Por isso o plano prefere culturas que aguentam calor e seca." do protótipo (não
  sai de uma regra). Os meses (março a maio) continuam no texto, como no raio-X: o `/api/metodo` não manda o
  `raio_x.futuro_mes_inicio/fim`.
- **360 px:** as barras ficam com 56 px; quando não cabe, o "X de 20" desce para baixo da barra em vez de rolar.
- **"Você não preencheu as últimas safras"** no cartão do relatório quando faltam respostas (regra geral 6); o texto
  diz que o relatório usa o que o satélite viu ou "não preenchido".
- **Ícones novos** (`CycleIcon` = `RefreshCw`, `BookIcon` = `BookText`) num `import` separado no fim do bloco do
  lucide, para conflitar menos com o agente do cabeçalho (que também mexe nos ícones).

## 4. Testes (TDD)

| Teste | Red |
| --- | --- |
| `usePlanFlow.test.ts` (3 casos: escolha + cadeia, 3º ano no `/api/plano`, sem ponto) | módulo inexistente |
| `ChoosePlanView.test.tsx`: sem "Imprimir relatório" e sem relatório nas duas abas; a frase nova em pt e en | 4 falhas |
| `PlanningView.test.tsx` / `usePlanningController.test.ts`: os testes do relatório que vieram da tela 5 | `deps.today` não existia / sem o botão |
| `planningService.test.ts` (19 casos: colheita cedo, meio e tarde; fora do prazo; etiqueta do Plano B que some; pegamento; pousio; alerta sem dado; ganho; últimas safras) | módulo inexistente |
| `format.test.ts`: `formatShortMonth`, `formatMonthRange` | 1 falha |
| `planningTexts.test.ts` (11 casos em pt e en: passos, alertas, ganho, resumo, cenário) | módulo inexistente |
| `usePlanningController.test.ts` (14 casos: mesmo plano da tela 5, links, datas com e sem `data`, fora do prazo, alertas, lugar com e sem demonstração, resumo, impressão, últimas safras, estados) | reescrito antes do controller |
| `PlanningView.test.tsx` (17 casos: topo, ordem dos blocos, cartões, linha do tempo, aviso laranja, alertas, passado e futuro, comunidade sem link, relatório de 7 seções em pt e en com prós e contras, estados) | escrito antes da view |
| `routes.test.tsx`: `/planejamento` abre a tela final | 1 falha (descrevia a provisória) |

`npm test` (139 arquivos, 1258 testes), `npm run lint`, `npm run build` e `pre-commit run --all-files` passando.

## 5. Conferência visual

API de revisão na porta 8011 (cópia do banco `raiz_orbital_remodelagem`), front na 5194, Chrome headless. Lavoura de
demonstração, colheita em 3/mar/2027, sorgo → milheto → sorgo, em 1280, 390 e 360 px, pt e en; também só com a época
(cedo, meio e tarde), com o 1º ano fora do prazo (`escolha=milho_braquiaria`) e sem respostas das safras. A 360 px, o
`scrollWidth` é igual à largura (360) em pt e en, nos três casos. Relatório em PDF (A4): 2 folhas em pt e en.

## 6. Riscos

- **Âncora `#alertas-oficiais`:** só funciona quando a tela de Avisos tiver o id (outro agente do pacote 3).
- **Conflito na integração:** `messages.{pt,en}.ts` (bloco `planning` inteiro refeito; o `choose.report` saiu),
  `design-system/icons/index.tsx` (dois ícones novos) e `tokens.css` (bloco novo no fim). O cabeçalho, a
  `/comunidade`, os Avisos e o Guia não foram tocados.
- **Textos a confirmar com a agrônoma:** os prós e contras (os mesmos da tela 5) e o "Como o plano ajuda a ganhar".
- O relatório cabe em 2 folhas na lavoura de demonstração; com nomes longos ou mais culturas comparadas, pode passar.
