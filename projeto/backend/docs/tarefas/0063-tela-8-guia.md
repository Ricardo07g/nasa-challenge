# Tarefa 0063: Tela 8 "Guia" refeita (início, busca e artigo)

- **Identificador:** `0063`
- **Título:** O Guia (`/guia` e `/guia/{artigo}`) ganha busca no título e no resumo, filtros por tema, "Comece por
  aqui", cartões com resumo, tempo de leitura e foto das culturas, e o artigo com "Em uma frase" em destaque, a caixa
  "Na sua lavoura" com um número real do ponto, fontes recolhidas, "Este artigo ajudou?", índice e "Veja também"
- **Status:** Concluída
- **Prioridade:** Alta (pacote 3 de telas, passo 5)
- **PRD:** RF-46 (nova)
- **Módulos Afetados:** só o front (`projeto/frontend/src`): `content/guia/pt|en/*.md` (só o cabeçalho: `resumo` e
  `relacionados`; e a troca mínima do "Perto de você" em `como-ler-os-avisos`), `content/guia/guideMeta.test.ts`
  (novo), `models/guide.ts`, `services/guideService.ts`, `services/guideFieldService.ts` (novo),
  `i18n/guideTexts.ts` (novo), `controllers/useGuideController.ts`, `views/GuideView.tsx`,
  `views/GuideArticleView.tsx` e `views/GuideThemeIcon.tsx` (novos, o artigo saiu do `GuideView.tsx`),
  `design-system/components/BackButton.tsx` (`onClick` opcional), `design-system/icons` (`SearchIcon`,
  `PlantingIcon`), `design-system/tokens.css` (bloco da tela 8), `i18n/messages.{pt,en}.ts` (bloco `guide`),
  `pages.tsx`, `pages.guide.test.tsx` (novo)
- **Referências:** `tela-8-guia-prompt.md`, `tela-8-guia.html`, `pacote-3-LEIA-ME.md`,
  `pacote-3-cabecalho-comunidade-prompt.md` e `pacote-2-regras-gerais-prompt.md` (fora do repositório); as regras do
  usuário para o Guia de 15/11/2026 (valem mais que o prompt da tela 8); tarefas 0048 (Guia), 0055 (fotos), 0046
  (ponto salvo no aparelho) e 0058 (`/api/raio-x`)

---

## 1. O que mudou

- **Início (`/guia`).** "← Voltar" (com tela anterior no app, volta para ela; aberto direto, vai para a Início),
  "Guia", "Respostas curtas para as dúvidas da lavoura, com as fontes.", "Ouvir resumo" e a busca grande à direita (no
  celular, embaixo), com a lupa, "Buscar: veranico, palhada…" e o "×". A frase do MVP saiu do Guia (`guide.mvpArea`;
  nenhum outro lugar usava essa chave: o "Onde fica a lavoura" e o "Como a conta é feita" têm as suas). Pílulas
  "Todos 27", "Culturas 6", "Plantar 4", "Cuidar da terra 5", "Clima, água e dados 9" e "Segurança 3", com ícone e
  `aria-pressed` (no celular, rolam para o lado dentro da fileira). "Comece por aqui" (só em "Todos") com o raio-X, o
  "deu certo" e o ZARC. Seções por tema com "{n} artigos" e cartões em 3, 2 ou 1 coluna: o título é o link (o `::after`
  dele cobre o cartão, que pode abrir em nova aba), com o resumo e "{n} min de leitura". As 6 culturas têm o
  `PlantPhoto` da tela 5, com o crédito (fora do link, por cima); no celular, a foto fica à esquerda com 96 px.
- **Busca.** Enquanto digita, no título e no resumo, sem diferenciar acentos nem maiúsculas (`searchGuides`). Esconde
  os temas e mostra "**{n}** resultados para "{busca}"", os cartões com o nome do tema e a palavra marcada (`<mark>`,
  pelo `highlight`, que acha o trecho no texto sem acento e devolve o pedaço do texto original). Sem resultado:
  "Nenhum artigo encontrado para "{busca}"" com 3 sugestões clicáveis (veranico, palhada, sorgo; em inglês, dry
  spell, straw, sorghum).
- **Artigo (`/guia/{slug}`).** "← Voltar ao Guia" (com o fluxo da URL), tema com ícone, título, "{n} min de leitura" e
  "Ouvir resumo"; "Em uma frase" numa caixa branca com a borda verde; as seções (a lista curta "**Nome:** texto" de 2 a
  4 itens vira cartões com ícone, como "Os três cuidados" da erosão); "Na sua lavoura" com a caixa azul; "Fontes
  conferidas" num `<details>` fechado (links em nova aba); "Este artigo ajudou? Sim / Não", que só marca e diz
  "Obrigado!". Coluna lateral fixa no computador com "Neste artigo" (rolagem suave até a seção; direta com menos
  movimento) e "Veja também" (até 3); no celular, o índice some e o "Veja também" vai para o fim. As culturas
  continuam com o desenho (`PlantImage`) ao lado do título.
- **"Na sua lavoura".** Caixa azul com o lugar ("Sua lavoura, perto de {cidade}"), a frase com o número do ponto e a
  fonte. O ponto é o da URL (`lat`, `lon`) ou, sem ele, o salvo no aparelho (`savedPointRepository`, o mesmo dos
  avisos); a lavoura de demonstração (`exemplo=1`) nunca conta. Os números vêm do `GET /api/raio-x` (colheita e terra
  do ponto; sem colheita, `meio`), e só os artigos com dado ligado pedem o raio-X (`FIELD_SLUGS`). Sem ponto, sem dado
  ou com falha da API, a caixa não aparece. "Ouvir resumo" do artigo: o título, o "Em uma frase" e o número da caixa.

| Artigo | Dado do `/api/raio-x` | Exemplo (lavoura de demonstração, 15/11/2026) |
| --- | --- | --- |
| `como-evitar-erosao` | `alertas.chuva_forte` | Em 20 anos, houve 5 dias com 50 mm ou mais de chuva em fevereiro e março: em média, 0,25 dia por ano. |
| `veranico` | `veranico` | O maior veranico de março a maio em 20 anos foi de 43 dias seguidos sem chuva, a partir de 19 de abril de 2024. |
| `calor-35-graus` | `calor` | Em 20 anos, só 1 (2024) teve dia de 35 °C ou mais entre março e maio. |
| `clima-2041-2060` | `cartoes.clima_futuro` | Para 2041 a 2060, a média de 3 modelos indica chuva de março a maio +2,2% e máxima +1,3 °C. |
| `raio-x` | `solo`, `umidade`, `chuva` | A terra tem 42% de argila e 40% de areia. Agora está mais úmida que em 59% dos anos nesta época. De janeiro a julho, chove em média 862 mm. |

## 2. Campos novos dos artigos

| Campo | Onde | Regra |
| --- | --- | --- |
| `resumo` | cabeçalho, pt e en | uma linha (até 90 caracteres) para o cartão: só o "Em uma frase" do próprio artigo, encurtado |
| `relacionados` | cabeçalho, iguais em pt e en | até 3 slugs que existem, sem o próprio; sem eles, o "Veja também" usa outros do mesmo tema |
| tempo de leitura | calculado (`readingMinutes`) | palavras do texto ÷ 200, para cima, mínimo 1; nunca escrito à mão |
| `rascunho` | cabeçalho (já existia) | continua no arquivo e no `guideService` (`draft`), mas **nenhuma tela mostra** |

**Os resumos ainda precisam ser conferidos pelo time** (e refeitos se o "Em uma frase" mudar no patch dos textos).

## 3. O que fica na URL

| Parâmetro | Tela | O que é |
| --- | --- | --- |
| `q` | `/guia` | a busca (copiada com `useReplaceUrl`, sem rolar nem criar entrada no histórico) |
| `tema` | `/guia` | o filtro, com o nome do cabeçalho dos artigos (`culturas`, `plantar`, `terra`, `clima`, `seguranca`) |
| `lat`, `lon`… | `/guia` e `/guia/{slug}` | o fluxo, quando vier: segue nos links do Guia e define a lavoura da caixa |

A busca e o tema ficam no estado da tela (o campo não perde o cursor) e são copiados para a URL; a tela abre com o que
vier na URL, e uma navegação que não é `replace` (ex.: o botão Guia do cabeçalho) relê a URL.

## 4. Decisões

- **Regras do usuário de 15/11 (depois do prompt da tela 8, valem mais que ele):** sem a faixa "Em revisão", sem o
  pontinho "em revisão" e sem a nota do rodapé (nada na tela fala de revisão; o `rascunho` só fica no arquivo); o
  `resumo` é só o "Em uma frase" encurtado (as sugestões do protótipo que diziam coisa que o artigo não diz ficaram de
  fora); o corpo dos artigos, o `verifiedSources.ts` e o `guideContent.test.ts` não mudaram (os testes do cabeçalho
  novo ficam no `guideMeta.test.ts`), a não ser a troca mínima do "Perto de você" no `como-ler-os-avisos` (sem os
  relatos de vizinhos: "três grupos" e o "Em uma frase" sem "os vizinhos"); e, na caixa "Na sua lavoura", só número do
  ponto com a fonte, **nada que dependa de hipótese do time**: saíram a geada (limite de 3 °C), o fogo (raio de 5 km),
  a água que a terra guarda (tabela de CAD por textura) e o fim das chuvas (regra dos 20 dias com menos de 10 mm); no
  raio-X, a terra aparece pela argila e pela areia do SoilGrids, não pela textura nem pela CAD.
- **"Este artigo ajudou?":** só marca e agradece; nenhuma contagem guardada (sem backend novo e sem dado guardado).
- **"← Voltar" do início:** volta à tela anterior com `navigate(-1)` quando há tela anterior do app nesta aba
  (`history.state.idx > 0` do roteador); aberto direto (ou em nova aba), segue o link para a Início. Para isso, o
  `BackButton` ganhou um `onClick` opcional (o `to` fica como reserva). A busca e o filtro não contam como tela.
- **Plural certo** em "1 resultado" / "3 resultados" (o protótipo escreve "resultado(s)").
- **Cartão = título com link que cobre o cartão:** o crédito da foto é um link (Commons), e link dentro de link não
  vale em HTML; o nome acessível do cartão fica curto (o título).
- **Links internos do artigo levam o fluxo da URL** (`keepFlowQuery`), para a caixa e o "Voltar" continuarem com a
  mesma lavoura.
- **"Com o seu agrônomo":** nenhum artigo tem essa seção hoje; se ela entrar no texto, aparece como as outras.
- **Ícones novos:** `SearchIcon` (lupa) e `PlantingIcon` (pá, tema Plantar), num bloco no fim do `icons/index.tsx`; os
  outros temas reaproveitam os ícones que já existiam (broto, camadas, nuvem com chuva, escudo).

## 5. Testes (TDD)

| Teste | Red |
| --- | --- |
| `guideService.test.ts`: `readingMinutes`, resumo, relacionados, `searchGuides` no resumo, `highlight`, `themeCounts`, `filterByTheme`, `readGuideFilters`, `guideIndexUrl`, `relatedArticles`, `featuredArticles`, `articleLayout`, `sectionId` | 20 + 1 falhas (funções inexistentes) |
| `guideMeta.test.ts`: resumo de uma linha, relacionados válidos e iguais em pt e en, sem `min` à mão | falhou antes de os cabeçalhos ganharem os campos |
| `guideFieldService.test.ts`: o dado de cada artigo, sem caixa sem dado, ponto da URL antes do salvo, fazenda de exemplo nunca, sem hipótese do time | módulo inexistente; depois, 3 falhas com a regra das hipóteses |
| `guideTexts.test.ts`: as frases e as fontes em pt e en | módulo inexistente; depois, 1 falha (terra pela argila e areia) |
| `useGuideController.test.tsx` (17 casos: filtro e busca na URL, fluxo nos links, "Voltar" com e sem tela anterior, caixa com o ponto da URL ou o salvo, sem caixa sem ponto ou com falha, "ajudou?", "Ouvir") | 14 falhas; depois, 2 (Voltar) e 1 (resumo falado sem a revisão) |
| `GuideView.test.tsx` e `GuideArticleView.test.tsx` (busca, sugestões, pílulas, cartões, foto, caixa, fontes recolhidas, índice, "Veja também", nada de revisão, pt e en) | escritos antes das views; 1 + 2 falhas na regra sem revisão |
| `BackButton.test.tsx`: `onClick` opcional | 1 falha |
| `pages.guide.test.tsx`: contagem das 27 pílulas, filtro e busca **sem mexer no `scrollY`** e com `replace`, "erosao" acha "Como evitar erosão", sugestões, caixa com o ponto e sem ele | escrito depois das views (ver riscos) |

`npm test` (141 arquivos, 1286 testes), `npm run lint` (só o aviso antigo do `useMissionController`), `npm run build` e
`pre-commit run --all-files` passando.

## 6. Conferência visual

API deste worktree na porta 8014 (cópia do banco), front na 5197, Chrome headless: `/guia`, a busca ("chuva",
"erosao" e uma sem resultado), o filtro "Clima", `/guia/como-evitar-erosao` com e sem o ponto, um artigo de cultura
(antes rascunho, agora sem faixa), o raio-X e o veranico com o ponto salvo no aparelho, em 1280, 390 e 360 px, em pt e
en. Em todos, `scrollWidth` igual à largura (sem rolagem lateral).

## 7. Riscos

- **Cabeçalho (outra branch):** o botão Guia e o `aria-current` em `/guia` são da tarefa 0061; o "Voltar" do Guia
  segue a decisão da 0061 (tela anterior ou Início). `BackButton` ganhou um `onClick` opcional (aditivo).
- **Avisos (outra branch):** o `como-ler-os-avisos` ainda cita os grupos "O que mudou na sua área" e "Fora do comum";
  se a tela 7 trocar os nomes, o texto precisa acompanhar (fica para o patch dos textos).
- **Patch dos textos (outra branch):** reescreve o corpo dos artigos; os `resumo` saem do "Em uma frase" de hoje e
  precisam ser refeitos se ele mudar. Os conflitos ficam nas duas linhas novas do cabeçalho de cada artigo e no
  `como-ler-os-avisos`.
- **Caixa "Na sua lavoura":** o limite de 50 mm da chuva forte e os 35 °C do calor vêm da API (`limite_mm`,
  `temp_c`), do pedido da remodelagem e do PRD 7.2, não de hipótese do time; o corpo dos artigos ainda tem números do
  `regras.yaml` e do `culturas.yaml` (coeficientes, prazos do ZARC), que o patch dos textos vai tratar.
- **Teste de página escrito depois das views** (o resto seguiu o red-green); cobre o que o prompt pede.
