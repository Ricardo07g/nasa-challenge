# Tarefa 0064: Plano de 3 anos com a nossa sugestão sempre à vista e a foto do milho com braquiária em 2 imagens (pacote 3)

- **Identificador:** `0064`
- **Título:** Na aba "2. Plano de 3 anos" da tela 5, a nossa sugestão de cada ano fica sempre visível (no select e
  embaixo dele, com "Usar a sugestão"); "Você mudou" só quando a cultura é outra; a foto do milho com braquiária vira o
  milho e a braquiária lado a lado, sem a legenda "na foto: a braquiária"
- **Status:** Concluída
- **Prioridade:** Alta (pacote 3 de telas, ajuste da tela 5)
- **PRD:** RF-47 (nova); ajusta a RF-42 (a etiqueta "Você mudou" e o "Voltar ao plano sugerido" do plano)
- **Módulos Afetados:** só o front (`projeto/frontend/src`): `services/planService.ts` (`suggestedFor`, `PlanSources`,
  `planCards` com a sugestão de cada ano, `planEdited`, `yearFlow` com a sugestão, `suggestionFixos` e `finalCrops`),
  `controllers/usePlanFlow.ts` (pede a sugestão com o 1º ano sempre; cartões do sugerido enquanto o `/api/plano`
  carrega), `controllers/useChoosePlanController.ts` (`chooseYear` com a sugestão do ano), `views/PlanTab.tsx` e
  `views/ChoosePlanView.module.css` (a opção sugerida e a linha "Nossa sugestão · Usar a sugestão"),
  `i18n/messages.{pt,en}.ts` (`choose.plan.option` no lugar do `lateOption`, `choose.plan.useSuggestion`),
  `design-system/components/PlantPhoto.tsx` e `.module.css` (1 ou 2 imagens, sem a legenda),
  `design-system/tokens.css` (`--photo-pair-gap`), `content/plantPhotos.ts` (`images` por cultura), `content/credits.ts`
  (a linha da foto de 2 imagens), `views/DesignSystemView.tsx` (o exemplo da foto que não carrega)
- **Referências:** `tela-5-plano-sugestao-prompt.md`, `tela-5-escolher-plano.html` (versão de 15/11, 14:55, estado "Aba
  Plano" com uma cultura trocada no 2º ano) e `pacote-2-regras-gerais-prompt.md` (fora do repositório); tarefas 0059
  (tela 5), 0060 (o `usePlanFlow`, igual nas telas 5 e 6), 0056 (motor: `/api/plano/sugestao` com o `motivo`), 0055
  (fotos das plantas)

---

## 1. A nossa sugestão de cada ano

**Uma regra só, `suggestedFor(ano)`** (`planService.ts`), usada pela etiqueta, pelo select e pela linha embaixo dele:

- **1º ano:** a sugestão da aba Escolher (`suggestionOf`: a 1ª no prazo na ordem do objetivo).
- **2º ano:** o `anos[1]` de `GET /api/plano/sugestao?fixos=<1º ano>`.
- **3º ano:** se o 2º ano é a sugestão, o `anos[2]` dessa mesma resposta; senão, o `anos[2]` de
  `GET /api/plano/sugestao?fixos=<1º ano>,<2º ano>`.
- O "Por quê:" de um ano sugerido é o `motivo` da mesma resposta.
- Resposta que ainda é de um pedido anterior (o `useAsync` guarda a última enquanto a nova carrega) não vale: a
  sugestão do ano fica desconhecida (`null`) até a certa chegar.

**Pedidos:** o `usePlanFlow` pede sempre a sugestão com o 1º ano fixo. Sem o 2º ano mudado, é o mesmo pedido do plano
que a tela mostra (o cache do `planService` junta os dois: uma chamada só). Com o 2º mudado, a sugestão com os dois
fixos dá o plano mostrado e a sugestão do 3º. O 3º ano mudado continua indo para o `/api/plano`, como antes.

**Na tela:**

- No "O que plantar" de cada ano, a opção da cultura sugerida ganha " · nossa sugestão" (en: " · our suggestion"),
  junto com " · passou do prazo" (en: " · past the deadline") quando for o caso. O aviso do prazo passou de
  "(passou do prazo)" para o mesmo formato do protótipo.
- Embaixo do select, quando a cultura escolhida não é a sugestão: a etiqueta verde "Nossa sugestão", o nome da cultura
  e o link-botão "Usar a sugestão" (en: "Use the suggestion"; o nome acessível leva a safra: "Usar a sugestão (depois
  da soja 2027/28)"). Cultura, ponto e link ficam juntos: numa tela estreita, descem inteiros para a linha de baixo.
- No 1º ano a etiqueta do cartão continua "Sua escolha"; a linha aparece igual quando a escolha é diferente da
  sugestão, e "Usar a sugestão" ali é o mesmo que escolher a cultura no select do 1º ano (muda a `escolha`).

## 2. "Você mudou" só quando o ano é outra cultura

- Etiqueta dos anos 2 e 3: "Você mudou" só quando a cultura do ano é diferente da sugestão dele; senão, "Nossa
  sugestão", com o "Por quê:". Sem a sugestão carregada ainda, vale a URL (ano em `ano2`/`ano3` = "Você mudou").
- **Escolher de novo a sugestão** (pelo select ou por "Usar a sugestão") tira o ano da URL (`ano2` ou `ano3`): o ano
  volta a ser sugerido de verdade. Trocar o 2º ano continua soltando o 3º, inclusive quando ele volta para a sugestão
  (o 3º é refeito pela sugestão com o 1º ano).
- O alerta "Você mudou {safra} para {cultura}…" some quando o ano volta para a sugestão. "Voltar ao plano sugerido"
  aparece quando algum cartão diz "Você mudou" (`planEdited`).
- Um link antigo com o `ano2` igual à sugestão é o plano sugerido: o 2º ano é "Nossa sugestão" e o 3º vem da sugestão
  com o 1º ano.
- **Rolagem:** gravar na URL usa o `useReplaceFlow` (sem rolar); depois de trocar, o foco volta ao select com
  `focus({ preventScroll: true })` (o botão "Usar a sugestão" some quando o ano volta para a sugestão).
- **Tela 6:** usa o mesmo `usePlanFlow` (os mesmos cartões e culturas), mas não mostra etiqueta nem porquê dos anos;
  nada a mudar nela.

## 3. Foto do milho com braquiária em 2 imagens

- **Por quê:** a única foto aberta que temos dessa cultura mostra só a braquiária; a legenda "na foto: a braquiária"
  explicava isso.
- **Agora:** a foto é dividida ao meio. À esquerda, o milho de "Milho sozinho" (`fotos/milho.jpg`, do
  [ZeaMays.jpg](https://commons.wikimedia.org/wiki/File:ZeaMays.jpg), Christian Fischer, CC BY-SA 3.0); à direita, a
  braquiária (`fotos/braquiaria.jpg`, do
  [Strip of Brachiaria brizantha (signal grass).jpg](https://commons.wikimedia.org/wiki/File:Strip_of_Brachiaria_brizantha_%28signal_grass%29.jpg),
  Ethan Bass, CC BY-SA 4.0). Nenhum arquivo novo: as duas imagens já estavam em `public/fotos/`.
- **`PlantPhoto`:** aceita 1 ou 2 imagens (`images`). Com 2, `display: grid` de 2 colunas com 2 px entre elas
  (`--photo-pair-gap`, fundo branco no fio), num bloco com `role="img"` e `aria-label` com o nome da cultura (as
  metades com `alt=""`); um crédito só, embaixo: "Foto: Christian Fischer · CC BY-SA 3.0 | Ethan Bass · CC BY-SA 4.0",
  cada autor ligando à sua página do Commons em nova aba. Se uma das duas não carregar, o bloco verde com o nome.
- **Créditos:** a linha da cultura no modal lista as duas imagens (arquivo, autor e licença), separadas por " | ".
- **Sai a legenda:** o campo (no código, `caption`; no prompt, `nota`) saiu da cultura, do tipo, do `PlantPhoto` e do
  CSS: nenhuma outra cultura usava.
- **Onde vale:** em todo lugar que usa o `PlantPhoto`: cartão da sugestão, comparação (tabela e cartões do celular),
  cartões do plano, cartões do Guia, tela 6 e a vitrine `/design-system`.
- Se aparecer uma foto aberta do consórcio milho + braquiária, ela substitui as duas metades (uma imagem só em
  `images`).

## 4. Decisões

- **Autor do milho = "Christian Fischer", não "Fice":** o prompt escreve "Foto: Fice · {licença}", mas o
  `plantPhotos.ts` e a tarefa 0055 já registram que "Fice" é o nome de usuário e que a licença pede a atribuição
  "Christian Fischer" (`{{cc-by-sa-3.0|attribution=Christian Fischer}}`). A foto de 2 imagens usa o mesmo objeto da de
  "Milho sozinho", então o crédito fica igual nos dois lugares.
- **Uma linha por cultura nos créditos**, com as duas imagens nela (e não uma linha por imagem): o modal continua com
  uma linha por foto da tela, e o ZeaMays.jpg aparece em "Milho sozinho" e em "Milho com braquiária".
- **O 1º ano não tem "Por quê:" no plano:** a sugestão do 1º ano vem da aba Escolher (o porquê fica no cartão de lá).
- **Sem cartões piscando com o 3º ano mudado:** antes, ao mudar o 3º ano pela 1ª vez, os cartões davam lugar a
  "Montando o plano…" até o `/api/plano` responder (a tela pulava). Agora ficam os cartões e as notas do plano sugerido
  com "Recalculando…"; se o `/api/plano` falhar, a tela mostra o erro (nunca o sugerido no lugar do plano dele).
- **"Usar a sugestão" com a safra escondida** no nome acessível: são até 3 botões iguais na tela.

## 5. Testes (TDD)

| Teste | Red |
| --- | --- |
| `planService.test.ts`: 13 casos novos de `suggestedFor`, etiqueta, `planEdited` e `yearFlow` com a sugestão; os cartões ficam com o 3º ano carregando; o `suggestionFixos` com o 2º igual à sugestão; os 3 casos de cartões com a assinatura nova | `suggestedFor`/`planEdited` inexistentes, `ano2` não saía da URL |
| `usePlanFlow.test.ts`: os 2 pedidos de sugestão com o 2º ano mudado e a sugestão em cada cartão; o `ano2` igual à sugestão é "Nossa sugestão"; o `/api/plano` com erro = sem cartão | assinatura velha do `planCards`; cartões do sugerido no erro |
| `useChoosePlanController.test.ts`: escolher de novo a sugestão do 2º ano (tira `ano2` e `ano3`, 3º refeito, sem alerta) e do 3º (tira só o `ano3`) | `ano2=`/`ano3=` continuavam na URL |
| `ChoosePlanView.test.tsx`: "Você mudou" + a linha "Nossa sugestão: Milheto · Usar a sugestão"; volta pelo select e pelo link (etiqueta, linha, porquê, alerta, 3º ano refeito, foco no select com `preventScroll` e o `window.scrollY` igual); 1º ano com a linha; " · nossa sugestão" com " · passou do prazo" em pt e en; a foto de 2 imagens no cartão da sugestão | 5 falhas (sem a linha e sem o texto da opção) |
| `PlantPhoto.test.tsx`: 1 imagem (alt, crédito, fallback, altura) e 2 imagens (bloco `role="img"` com o nome, um crédito com os 2 autores e links, fallback) | props novas (`images`) |
| `plantPhotos.test.ts`: arquivo, tipo, tamanho, licença e alt de todas as imagens; a mesma imagem nas duas culturas do milho; milho com braquiária = milho + braquiária, sem legenda | estrutura nova (`images`) |
| `credits.test.ts`, `CreditsModal.test.tsx`, `DesignSystemView.test.tsx`: as duas imagens na linha dos créditos (7 links), a foto de 2 imagens na vitrine, sem "na foto: a braquiária" | estrutura nova |

`npm test` (147 arquivos, 1429 testes), `npx tsc -b`, `npm run lint`, `npm run build` e `pre-commit run --all-files`
passando.

## 6. Conferência visual

API de revisão na porta 8011 (cópia do banco `raiz_orbital_remodelagem`), front na 5194, Chrome headless (CDP), lavoura
de demonstração com colheita em 3/mar/2027, `safras=2024:milho_braquiaria,2025:pousio,2026:sorgo` e `pensa=sorgo`, em
1280, 390 e 360 px, pt e en:

- **Plano:** 1º ano (sorgo) diferente da sugestão (milheto) com a linha; o 2º ano trocado no select (sorgo) com "Você
  mudou", a linha e o alerta; de volta por "Usar a sugestão" (clique de verdade) e pelo select: "Nossa sugestão", o
  porquê, sem a linha, sem o alerta, sem `ano2` na URL, o 3º ano igual ao do começo e o foco no select. Também com
  `ano2=crotalaria` direto na URL.
- **Rolagem:** o app não rola. No computador, o `scrollY` fica igual em todas as trocas. O que anda é o conteúdo que
  o prompt manda mudar acima do select: o alerta (101 px no computador, 167 px no celular) e o "Por quê:" do cartão.
  No celular, a ancoragem de rolagem do navegador ajusta o `scrollY` para segurar o conteúdo.
- **Foto:** o milho com braquiária na comparação da aba Escolher (`comparar=milho_braquiaria,milho_safrinha,sorgo`),
  no plano (`escolha=milho_braquiaria`), no Guia e na tela 6; o crédito com os 2 autores (cortado com reticências nas
  fotos estreitas, com o texto inteiro no `title` e no leitor de tela) e nenhum "na foto: a braquiária".
- O `scrollWidth` é igual à largura em todos os prints (sem rolagem lateral).

## 7. Riscos

- **Crédito cortado nas fotos estreitas:** com 2 autores, o crédito passa da largura da foto na comparação (312 px), no
  Guia (96 px) e na tela 6 do celular; segue a regra que já existia (uma linha, reticências, texto inteiro no `title`,
  no leitor de tela e nos créditos).
- **O select anda um pouco ao trocar:** o alerta e o "Por quê:" aparecem e somem acima dele (é o que o prompt pede).
  No celular a ancoragem do navegador segura quase tudo; no computador o select anda o tamanho do alerta.
- **Conflito na integração:** `messages.{pt,en}.ts` (bloco `choose.plan`: `lateOption` virou `option`),
  `planService.ts` (assinatura nova do `planCards`) e `PlantPhoto` (props novas: quem chamar com `src`/`alt`/`credit`
  precisa do `plantPhotoProps`).
