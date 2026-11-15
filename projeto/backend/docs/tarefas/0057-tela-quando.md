# Tarefa 0057: Tela "Quando você colhe a soja" nova (pacote 2)

- **Identificador:** `0057`
- **Título:** A tela `/quando` fica igual ao protótipo de 15/11/2026: na tela fica só a pergunta (o dia da colheita, ou a época); o que ajuda a decidir vai para um modal grande
- **Status:** Concluída
- **Prioridade:** Alta (pacote 2 de telas, pedido do time em 15/11/2026)
- **PRD:** RF-40 (nova), RF-02 e o caminho principal (notas)
- **Módulos Afetados:**
  - front: `views/WhenView.tsx` e `views/WhenDetails.tsx` (com os `.module.css`), `controllers/useWhenController.ts`,
    `services/harvestService.ts`, `services/harvestBandsService.ts` (novo), `services/rainLeftService.ts`
    (`rainLeftCurve`), `services/methodRulesService.ts` (novo), `design-system/components/Charts.tsx`
    (`RainLeftChart` na largura real e o novo `RainEndTimeline`), `design-system/components/useElementWidth.ts`
    (novo), `i18n/format.ts`, `i18n/messages.{pt,en}.ts` e `design-system/tokens.css`;
  - back: nada (a tela usa `/api/talhao`, `/api/custo-atraso` e `/api/metodo` como estão).
- **Referências:** protótipo `tela-2-quando.html` e os pedidos `tela-2-quando-prompt.md` e
  `pacote-2-regras-gerais-prompt.md` (fora do repositório); tarefa 0042 (a tela anterior, com as contas no backend),
  tarefa 0054 (peças compartilhadas do pacote 2: `BackButton`, `GuideLink`, `Modal` grande, `useReplaceFlow`,
  `seasonService` e o `data=` do `flowParams`) e tarefa 0052 ("Ouvir resumo", cabeçalho, rodapé e `Modal`)

---

## 1. Decisão

O satélite não vê o dia da colheita: **o produtor sempre escolhe**. A tela abre **sem data** e com o "Próximo passo"
desligado. A colheita sugerida pelo NDVI (`colheita_sugerida`, RF-16) **deixa de preencher esta tela** (continua no
raio-X). Na tela fica só a pergunta; o gráfico da chuva que sobra, o gráfico mês a mês, o custo do atraso e o "Por
que perguntamos" vão para o modal grande "Nossas sugestões para a data da colheita".

O usuário decidiu seguir os prompts à risca: onde o protótipo diverge do prompt, vale o prompt.

## 2. Estrutura

| Parte | Computador (acima de 900 px) | Celular (até 900 px) |
| --- | --- | --- |
| Topo | `BackButton` (para `/onde` com o ponto), título (38 px), a frase "Escolha o dia em que a colheita costuma acontecer." e o "Ouvir resumo" na mesma linha | Título de 28 px; a frase e o "Ouvir resumo" empilhados |
| Colunas | Duas, **da mesma altura** (`align-items: stretch`): o cartão "Dia da colheita" com o "Próximo passo" embaixo, e a caixa "Ainda não decidiu?" (até 400 px). Os dois botões terminam na mesma linha (a coluna da data tem 21 px embaixo = margem interna + borda da caixa) e as margens dos lados são iguais (52 px) | Uma coluna: cartão, aviso e caixa; o "Próximo passo" fica numa barra fixa no fim da tela, com uma linha que mostra a data escolhida (ou "Escolha o dia da colheita para continuar") |

No celular, a própria tela põe espaço embaixo do `body` (`:global(body):has(...)`) para a barra não cobrir o rodapé,
como "Onde fica a lavoura".

## 3. O cartão "Dia da colheita"

| Estado | Calendário | Título | Linha de baixo | Botão |
| --- | --- | --- | --- | --- |
| Sem data | tracejado, "– –" e "?" | Escolha o dia da colheita | Toque em "Escolher data". | "Escolher data" (cheio) |
| Época | "FEV" e "1–10", "11–20" ou "21+" | Começo / Meio de fevereiro / Fim de fevereiro ou março | Época aproximada | "Escolher o dia" |
| Data | mês e dia ("MAR" e "3") | a data por extenso ("3 de março de 2027") | o dia da semana ("Quarta-feira") e o selo da época | "Trocar data" |

- O botão abre o **calendário do próprio aparelho**: um `input type=date` escondido perto do canto do cartão, de
  **1/jan a 30/abr de 2027** (`harvestDateWindow`, do `CURRENT_SEASON` do `seasonService`: safra 2026/27), aberto
  com `showPicker()`; sem ele, foco e clique no campo.
- **Faixas das épocas** (confirmadas com o motor, `regras.yaml`, grupo `colheita`): até 10/fev (e janeiro) =
  começo; de 11 a 20/fev = meio; do dia 21 em diante (março e abril também) = fim de fevereiro ou março. É o
  `harvestFromDate` de sempre, com a janela do campo.
- **"Não sei o dia exato"** (canto de baixo à direita) abre o `Modal` normal com as 3 épocas, **nenhuma marcada**,
  mesmo com uma época já escolhida; "Usar esta época" só liga depois de escolher.
- **Aviso laranja** "Pelo satélite, este ponto não parece uma lavoura de soja." com o link "Conferir no mapa" (para
  `/onde` com o ponto), quando `soja_recente.vista === false`. Sem dado (`null`) ou enquanto carrega: nada.
- **"Próximo passo · Ver a resposta"**: desligado até ter data ou época, com o motivo embaixo ("Escolha uma data ou
  toque em "Não sei o dia exato"."). Leva à missão (`/calculando`) e já pede a recomendação com a faixa.

## 4. A escolha na URL

A escolha vai para a URL **na hora**, com o `useReplaceFlow` (sem entrada nova no histórico e sem rolar a tela, regra
geral 2): `data=AAAA-MM-DD&colheita=cedo|meio|tarde`, ou só `colheita=…` quando o produtor escolheu a época. O resto
do fluxo segue (ponto, `exemplo`, `solo`, `confirmadas` etc.). Voltando da tela seguinte, a escolha continua: a data
dentro do campo vale mais que a época, e a época sai dela (`harvestChoice`); data fora do campo não vale. Um teste
de rota clica numa época e confere que `window.scrollY` não mudou.

## 5. A caixa "Ainda não decidiu?" e o modal grande

A caixa (fundo azul-claro, **inteira clicável**: o botão cobre a caixa toda) tem "Por que perguntamos isso?", a
frase, a prévia com 3 barrinhas (a chuva que sobra até junho em cada época; a do produtor em verde) e "Ver sugestões
e detalhes". As barrinhas usam o dia escolhido na época do produtor e, nas outras, o dia de colheita da época no
motor (5/fev, 15/fev e 28/fev, `bandDate`).

O modal grande (`Modal size="large"`) tem os **4 blocos com os textos sempre abertos**, em 2 colunas no computador e
1 no celular. Cada "Saiba mais" abre o artigo do Guia em nova aba (`GuideLink`):

| Bloco | O que mostra | De onde vem | Saiba mais |
| --- | --- | --- | --- |
| Compare as épocas | Para cada época: a chuva que sobra até 30/jun, a melhor opção e "deu certo em X de 20 anos"; a do produtor com "sua época", as outras com "Usar esta época" (escolhe e fecha). Embaixo, o que é "deu certo" | `chuva_que_sobra` do `/talhao` e `/api/custo-atraso` (`harvestBands`); os °C do calor do `/api/metodo` | `deu-certo` |
| Chuva que sobra para a próxima planta | A frase com os números do dia escolhido, a curva (ano normal e ano seco) com a marca e os números no dia, e o que significa cada linha | `chuva_que_sobra` (`rainLeftCurve` e `rainLeft`) | `plantar-logo-depois-da-colheita` |
| Chuva e o que a lavoura gasta, mês a mês | Barras de chuva (GPM IMERG) × gasto (ETo, NASA POWER); só o primeiro mês com chuva menor que o gasto em destaque, com a explicação | `chuva_mensal` (`mes_chuva_abaixo_eto`) | `conta-de-agua` |
| Quando a chuva acaba | A linha do tempo com o ano em que acabou mais cedo, a metade dos anos e o mais tarde, e a regra da conta | `fim_das_chuvas` | `quando-a-chuva-acaba` |

Bloco sem dado não aparece (decisão D2). Os gráficos são **desenhados na largura real do espaço**
(`useElementWidth`, com `ResizeObserver`): o texto fica com 11 a 12 px também em 360 px, sem encolher com o desenho.

## 6. "Ouvir resumo"

- **Sem data:** "Escolha o dia em que você colhe a soja. Se não souber o dia exato, escolha a época: começo, meio ou
  fim de fevereiro."
- **Com data:** "Colhendo em {data}, sobram em média {X} milímetros de chuva até o fim de junho; num ano seco, {Y}.
  Quanto mais cedo a colheita, mais chuva sobra para a próxima planta."
- **Com a época:** a mesma frase, com "Colhendo no {época}" e os números no dia de colheita da época no motor.
- **Data sem a conta da chuva** (antes de 15/jan ou em abril: a tabela vai de 15/jan a 31/mar): "Colhendo em {data}.
  Quanto mais cedo a colheita, mais chuva sobra para a próxima planta."

Em pt e en, com os números da tela.

## 7. O que saiu

- A data já preenchida pelo satélite, a faixa azul ("Pelo satélite, a soja daqui costuma secar…", "Já deixamos esse
  dia no campo", "Usar o dia do satélite"), o "não deu para ver pelo satélite / deixamos no meio de fevereiro" e as
  três épocas abertas na abertura.
- Da tela principal: o gráfico da chuva que sobra, o gráfico mês a mês, "Quanto custa colher mais tarde" e o "Por
  que perguntamos" (foram para o modal), "Pergunta 2 de 2" e a barra de progresso.
- O aviso antigo da RF-24 com "Ajustar no mapa" e "Seguir mesmo assim" vira o aviso laranja com "Conferir no mapa".
- Código sem uso, com os testes: `harvestSuggestion`, `HarvestSuggestion` e `harvestWindow` (a janela por "hoje").

## 8. Testes e conferência

- TDD: cada comportamento com o teste antes, visto falhando (`format.test.ts`, `harvestService.test.ts`,
  `harvestBandsService.test.ts`, `rainLeftService.test.ts`, `methodRulesService.test.ts`, `Charts.test.tsx`,
  `useWhenController.test.ts`, `WhenView.test.tsx`, `routes.test.tsx`). O teste da rolagem foi conferido trocando o
  `useReplaceFlow` por um `navigate` comum: ele falha.
- Front: 1192 testes passando; `npm run lint` sem erro (só o aviso antigo do `useMissionController`); `npm run build`
  passando.
- Prints no Chrome (CDP) contra o protótipo, com a API local: os estados (sem data, "Não sei o dia", época, data,
  "não parece soja" no centro de Uberlândia) e o modal grande, em 1280 × 800, 390 e 360 px, em pt e en; a lavoura de
  demonstração e um ponto perto de Araguari. Nada estoura na horizontal; em 1280 × 800, o "Próximo passo" e o "Ver
  sugestões e detalhes" terminam no mesmo pixel e as duas colunas começam juntas.

## 9. Riscos e pendências

- Sem `showPicker()` (navegadores antigos), o botão foca o campo escondido: o calendário abre, mas o foco fica num
  campo invisível.
- Datas antes de 15/jan ou em abril não têm a chuva que sobra (a tabela do backend vai de 15/jan a 31/mar): a frase
  do modal e o resumo saem sem os números, e a barrinha da época fica vazia.
- O texto do "deu certo" depende do `/api/metodo`; sem a rota, sai "calor forte demais" no lugar dos °C.
- O `AGENTS.md` do backend ainda descreve o aviso antigo da RF-24 ("Ajustar no mapa" e "Seguir mesmo assim") na
  seção da soja recente: atualizar quando alguém mexer no backend.
