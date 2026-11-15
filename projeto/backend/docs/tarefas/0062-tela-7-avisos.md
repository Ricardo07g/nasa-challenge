# Tarefa 0062: Tela 7 "Avisos" refeita (pacote 3)

- **Identificador:** `0062`
- **Título:** A página de Avisos (`/avisos`) com o resumo no topo (o mesmo número do sino), a grade "Agora" + "Alertas
  oficiais", os quadros "Como a sua área está mudando" e "Já aconteceu aqui", os detalhes em modais, a linha "Seu
  plano", o exemplo de 2024 com dado real e a comunidade "Em breve", em pt e en
- **Status:** Concluída
- **Prioridade:** Alta (pacote 3 de telas, passo 4)
- **PRD:** RF-45 (nova; muda a tela da RF-31)
- **Módulos Afetados:** só o front (`projeto/frontend/src`): `controllers/useAvisosController.ts`,
  `controllers/useAlertsBadge.ts` (o número do sino), `services/avisosService.ts`, `i18n/alertTexts.ts` (novo; saiu
  `views/alertTexts.ts`), `views/AvisosView.tsx` e `.module.css`, `models/avisos.ts`,
  `repositories/savedPointRepository.ts`, `repositories/mocks/mockAvisos.ts`, `i18n/messages.{pt,en}.ts` (bloco
  `alerts`), `design-system/tokens.css`, `pages.tsx`
- **Referências:** `tela-7-avisos-prompt.md`, `tela-7-avisos.html`, `pacote-3-LEIA-ME.md`,
  `pacote-3-cabecalho-comunidade-prompt.md` e `pacote-2-regras-gerais-prompt.md` (fora do repositório); tarefa 0046
  (`/api/avisos`), 0059 (a tela 5: `escolha` e o "Prazo para plantar"), 0019 e 0044 (o replay `/api/safra-passada`)

---

## 1. O que mudou

- **Topo:** "← Voltar", "Avisos", "{lugar} · atualizado em **{data}**" (o `hoje` da API), "Ouvir resumo" e "Como ler
  os avisos" (`GuideLink`, nova aba).
- **Resumo** (`alertsSummary`): verde sem aviso ("Nada fora do normal agora"), azul só com "Fique de olho" ("Para
  ficar de olho, sem urgência.") e laranja com algum "Atenção" ("{a} pede(m) atenção."), com a legenda dos níveis à
  direita (some sem aviso).
- **Número do sino = número do resumo** (`activeCount`): conta só os avisos que a tela mostra, os cartões de "Agora".
  O `headerCount` (o sino, pelo `useAlertsBadge`) e o resumo usam a mesma função. **O `contador` da API ainda soma o
  "Perto de você"** (os relatos de vizinhos), que saiu da tela: o front não usa mais esse número, para o sino não
  mostrar um aviso que não aparece. O backend não mudou.
- **Grade "Agora" + "Alertas oficiais":** cartões-botão com "Atenção" primeiro (`nowAlerts`); tipo que a tela não
  sabe escrever não aparece. Cada cartão e cada quadro abre o mesmo `Modal` (nível, título, número grande, "O que
  significa", "O que fazer", fonte com a data e "Saiba mais" em nova aba). Sem aviso, a caixa verde. "Leituras de
  satélite e previsão desta semana" só com a última leitura até 7 dias antes de hoje; senão, "até {data}".
  "Alertas oficiais" com `id="alertas-oficiais"`; o controller rola até ele de novo quando os dados chegam (o resumo
  e os cartões empurram o bloco depois da rolagem do roteador).
- **"Seu plano: {cultura}, plantio até {prazo}":** a cultura é a do 1º ano do plano, como na tela 5 (`planChoice`:
  `escolha`, senão `pensa`, senão a sugestão do objetivo); sem a recomendação (sem colheita), a `escolha`, o `pensa`
  ou o `safrinha.cultura` dos avisos (`planCropOf`). O prazo é o `data_limite` da opção (o "Prazo para plantar" da tela
  5; `planLine`); fora do prazo, "mas já passou do prazo de plantio do ZARC ({data})"; sem prazo, a frase fica sem ele;
  com "Deixar parado", "Seu plano: deixar a terra parada depois da soja.". A recomendação vem do `farmService` (quase
  sempre já no cache).
- **"Ver exemplo: avisos de {ano}"** (o `safrinha.explorar_ano`, só fora da safrinha): modal montado com dado real
  (`exampleRows`): os `aviso_veranico` e `aviso_calor` do replay daquele ano (`GET /api/safra-passada?…&ano&colheita&
  opcao=<cultura do plano>`, pedido só com o modal aberto), com o dia em que parou de chover, e os recordes da área
  que caíram naquele ano. Sem o replay (cultura fora do prazo, "Deixar parado" ou falha), ficam os recordes.
- **"Como a sua área está mudando"** (até 4 quadros: veranico, fim das chuvas, falta de água, deu certo e, se couber,
  o calor) e **"Já aconteceu aqui"** (os 4 recordes), com o valor antigo riscado, o novo em laranja quando piorou e
  "2005–19 → 2020–24".
- **Comunidade "Em breve"** no fim, sem botão. **Saiu o "Perto de você"** (a API continua mandando `perto`; a tela
  não mostra) e o link "Ver como teriam sido os avisos em <ano>" para `/resposta` (`explorerLink`).
- **Lavoura de demonstração:** com `exemplo=1` na URL, a tela (e o número do sino) mostram os avisos dela, com o nome
  "Lavoura de demonstração, perto de Uberlândia (MG)" (`viewPointFromFlow`); ela continua **nunca** sendo guardada no
  aparelho (`pointFromFlow`).
- **Ponto salvo:** guarda também a `escolha` e o `objetivo` da tela 5, para a linha "Seu plano" sem o ponto na URL.
- **"Ouvir resumo":** sem aviso, "Nada fora do normal agora na sua lavoura. Os avisos aparecem aqui quando algo
  mudar."; com avisos, "Você tem {n} aviso(s) agora. {título: o que fazer de cada um}. Para alertas oficiais, use o SMS
  40199 com o seu CEP." (`alertsListen`).

## 2. Decisões

- **Quadros da cultura só da cultura do plano.** A API conta a falta de água e o "deu certo" para a melhor opção do
  motor; quando a cultura do 1º ano do plano é outra, o quadro não aparece (sem dado, o item não aparece), em vez de
  mostrar a conta de outra cultura. Para mostrar, o `/api/avisos` precisaria aceitar a cultura (fica para depois).
- **"Já aconteceu aqui" e o exemplo usam o nível da API** (`fique_de_olho` nos recordes); só os avisos do replay vão
  como "Atenção" (são os avisos que o produtor teria recebido). O protótipo marcava o calor de 2024 como "Atenção":
  no replay real, nenhuma cultura teve aviso de calor em 2024 na lavoura de demonstração.
- **SMAP:** o texto diz "na camada das raízes" (o aviso usa o `sm_rootzone_pctl`), não "primeiros centímetros" como
  no protótipo.
- **"Confira o sinal em fevereiro"** no cartão do El Niño (o mesmo "Em fevereiro" do Plano de 3 anos); no modal, o
  conselho do sinal do outono (`valores.sinal`), como antes.
- **Etiqueta do nível acima do título** ficou dentro do miolo do modal (abaixo do título): o `Modal` do design system
  não tem espaço acima do título, e mexer nele afetaria as outras telas.
- **Datas curtas** ("24 de abr", "20 de mar") num ajudante do `alertTexts.ts`, para não mexer no `i18n/format.ts`.
- Os rótulos da janela de março a maio ("mar–mai") seguem os textos que já existiam (os recordes e as mudanças são
  contados nessa janela).

## 3. Testes (TDD)

| Teste | Red |
| --- | --- |
| `avisosService.test.ts` (resumo nos 3 estados, `activeCount`, o relato de vizinho fora da conta, "Atenção" antes, quadros e filtro da cultura, recordes, `planCropOf`, `planLine`, `exampleYear`, `exampleRows`, `viewPointFromFlow`) | 20 falhas (funções inexistentes) e depois 2 (contagem) |
| `savedPointRepository.test.ts` (`escolha` e `objetivo`; `exemplo` nunca volta) | 1 falha |
| `i18n/alertTexts.test.ts` (17 casos: cartões, quadros, recordes, plano, exemplo, "Ouvir resumo", pt e en) | módulo inexistente |
| `useAvisosController.test.ts` (14 casos, inclusive a rolagem até `#alertas-oficiais`) | 13 falhas |
| `useAlertsBadge.test.ts` (o número da lavoura de demonstração; o relato de vizinho não conta) | 1 falha |
| `AvisosView.test.tsx` (20 casos: resumo com a cor, cartões, modais com fonte e data, quadros, oficiais, "Em breve", sem "Perto de você", en) | escrito antes da view nova |
| `routes.test.tsx` (`/avisos` com o ponto e na lavoura de demonstração, pt e en) | — |

`npm test` (1258 testes), `npm run lint`, `npm run build` e `pre-commit run --all-files` passando.

## 4. Conferência visual

API de revisão (cópia do banco) na porta 8013, front na 5196, Chrome headless: lavoura de demonstração
(`colheita=tarde&exemplo=1`: 1 aviso, azul), ponto perto de Prata (`lat=-19.3&lon=-48.9`: 2 avisos, 1 "Atenção",
laranja) e o mesmo ponto com `colheita=tarde&escolha=sorgo` (linha do plano com "plantio até 20 de mar", o quadro da
falta de água do milho escondido e o exemplo de 2024 com o aviso de veranico do replay em 28/abr). Em 1280, 390 e
360 px, pt e en, com os 4 modais abertos: `scrollWidth` igual à largura em todos. A âncora `#alertas-oficiais` deixa o
bloco no topo depois de carregar. Nenhum ponto da área deu zero avisos (a previsão de El Niño vale para todos): o
estado verde está só nos testes.

## 5. Riscos

- **O `contador` do `/api/avisos` ainda soma o `perto`.** O front não usa mais esse número; se outra tela voltar a
  usar o `contador`, vai contar relato de vizinho.
- **Conflitos prováveis:** o bloco `alerts` das mensagens foi reescrito (o cabeçalho usa só `headerLabel` e
  `headerCount`, que ficaram); o `useAlertsBadge` passou a contar o ponto da URL com a lavoura de demonstração; o
  `tokens.css` ganhou um bloco entre o pacote 2 e a tela 4; o `routes.test.tsx` mudou só os testes de `/avisos`.
- Os avisos da safrinha (`safrinha_veranico`, `safrinha_calor`) continuam sendo os da melhor opção do motor, não os da
  cultura do plano (a frase diz o nome da cultura).
