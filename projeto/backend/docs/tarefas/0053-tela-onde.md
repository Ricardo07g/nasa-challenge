# Tarefa 0053: Tela "Onde fica a lavoura" nova (3 jeitos simples de marcar)

- **Identificador:** `0053`
- **Título:** A tela `/onde` fica igual ao protótipo de 15/11/2026: tocar no mapa, usar onde está agora ou a lavoura de demonstração; coordenadas e link do Google Maps vão para um modal
- **Status:** Concluída
- **Prioridade:** Alta (remodelagem v4, pedido do time em 15/11/2026)
- **PRD:** RF-37 (nova), RF-01 (nota) e RF-35 (a frase do MVP vira legenda + modal)
- **Módulos Afetados:**
  - front: `views/WhereView.tsx` (e o `.module.css`), `controllers/useWhereController.ts`, `design-system/components/FieldMap.tsx` (novo), `services/locationService.ts`, `services/locationInputService.ts`, `services/positionService.ts`, `services/geocodingService.ts`, `repositories/geocodingRepository.ts`, `i18n/messages.{pt,en}.ts`, `design-system/tokens.css` e `icons`;
  - back: só textos (o nome do ponto de exemplo, ver a seção 6).
- **Referências:** protótipo `tela-1-onde.html` e o pedido `tela-1-onde-prompt.md` (fora do repositório); tarefa 0041 (a tela anterior), tarefa 0051 (área do MVP) e a tarefa 0052 (tela Início, que traz o modal reutilizável, o "Ouvir resumo", o cabeçalho e o rodapé novos)

---

## 1. Decisão

O produtor marca a lavoura de três jeitos simples, todos à vista:

1. **tocando no mapa** (o alfinete vai para onde tocou; arrastar o alfinete ajusta);
2. **"Usar onde estou agora"** (GPS);
3. **"Usar a lavoura de demonstração"** (o ponto de exemplo).

O que é para poucos (coordenadas e link do Google Maps) vai para o modal **"Outras formas de marcar"**. A busca por
endereço (Photon) sai da tela; o endereço aproximado do ponto marcado continua vindo do Photon, pela busca reversa.

Onde o protótipo e o pedido divergem, vale o pedido: **sem "Pergunta 1 de 2"** e sem a barra de progresso (vão sair
de todas as telas, porque o fluxo terá mais perguntas).

## 2. Estrutura

| Parte | Computador (acima de 900 px) | Celular (até 900 px) |
| --- | --- | --- |
| Topo | "← Voltar" (para `/`), título (Space Grotesk 700, 38 px), a frase e o "Ouvir resumo" na mesma linha | Igual, com o título de 28 px e a frase e o "Ouvir resumo" empilhados |
| Mapa | 470 px de altura, à esquerda; zoom no canto de cima à esquerda, "Ver a área inteira" no de cima à direita, a dica escura no topo, a área do MVP tracejada em azul e a legenda "Área do MVP: Uberlândia e Uberaba · Saiba mais" embaixo | 320 px, depois dos atalhos; sem o "Ver a área inteira" (ele continua no modal da área) |
| Painel | 380 px à direita: cartão do local, "Usar onde estou agora", "Usar a lavoura de demonstração", "Outras formas de marcar" e "Confirmar local" no fim, com o motivo embaixo quando está desligado | Atalhos, mapa e cartão, nesta ordem; o "Confirmar local" fica numa barra fixa no fim da tela, com o estado numa linha |

Sem ponto marcado, o mapa abre mostrando a área inteira. GPS, lavoura de demonstração e ponto colado chegam perto do
ponto (zoom 14); tocar e arrastar não mexem no enquadre.

No celular, a própria tela põe espaço embaixo do `body` (`:global(body):has(...)` no CSS dela) para a barra fixa não
cobrir o rodapé. Assim ela não depende da moldura (cabeçalho e rodapé são da tarefa 0052).

## 3. Os 4 estados do cartão do local

| Estado | Rótulo | Título | Texto | Confirmar |
| --- | --- | --- | --- | --- |
| Sem ponto | SUA LAVOURA (cinza) | Nenhum ponto marcado | Toque no mapa, use onde você está agora ou a lavoura de demonstração. | desligado · "Marque a lavoura no mapa para continuar." |
| Marcado | LOCAL ESCOLHIDO (verde) | "Perto de {lugar}" (Photon); na lavoura de demonstração, "Lavoura de demonstração, perto de Uberlândia (MG)" | coordenadas com 4 casas, em cinza | ligado |
| Fora da área | FORA DA ÁREA (laranja, cartão `#fdf3ea`) | o endereço aproximado | coordenadas + "**Ainda não chegamos aí.** Por enquanto só temos dados da região de Uberlândia e Uberaba. Vamos ampliar para todo o Triângulo Mineiro." | desligado · "Escolha um ponto dentro da linha tracejada." |
| Erro do GPS | igual a "sem ponto" | | + "Não deu para achar onde você está. Toque no mapa ou use a lavoura de demonstração." | desligado |

- O cartão é uma região com `aria-live="polite"`: as mudanças são anunciadas ao leitor de tela.
- Enquanto o GPS procura, o botão diz "Procurando você…" e fica com `aria-busy`. O limite é de 10 s
  (`GPS_TIMEOUT_MS` do `positionService`), que vale também com o pedido de permissão do navegador aberto.
- Se o GPS falhar com um ponto já marcado, o ponto fica e o aviso aparece embaixo dele.
- As regras ficam no `locationService`: `whereStatus` (sem ponto, marcado, fora) e `canConfirm`. Enquanto a área
  carrega, o Confirmar espera; se ela não carregar, a tela deixa seguir (o backend ainda responde `OUTSIDE_AREA`
  nas telas seguintes).
- **Confirmar** leva a `/quando?lat=…&lon=…`, como antes. Na lavoura de demonstração, vai também o `exemplo=1`: o
  fluxo usa o `/exemplo` e o ponto não vira o "ponto salvo" dos avisos.

## 4. Modais (o `Modal` reutilizável da tarefa 0052)

**"Outras formas de marcar"**: subtítulo "Para quem já tem a localização da lavoura.", campo "Coordenadas ou link do
Google Maps" e o exemplo embaixo. O `parseLocationInput` (puro) devolve o ponto ou `null`:

| Aceita | Exemplo |
| --- | --- |
| `lat, lon` com ponto decimal | `-18.9543, -48.1993`, `-18.9543,-48.1993`, `-18.9543 -48.1993`, `(-18.9543, -48.1993)` |
| `lat, lon` com vírgula decimal | `-18,9543, -48,1993`, `-18,9543,-48,1993`, `-18,9543; -48,1993`, `-18,9543 -48,1993` |
| Link com `@lat,lon` | `https://www.google.com/maps/@-18.9543,-48.1993,15z` (também `google.com.br` e sem o `https://`) |
| Link com `?q=` | `https://maps.google.com/?q=-18.9543,-48.1993` (também com `%2C` e `loc:`) |
| Link com `ll=` | `https://www.google.com/maps?ll=-18.9543,-48.1993&z=14` |
| Link com `query=` | `https://www.google.com/maps/search/?api=1&query=-18.9543,-48.1993` |
| Link com `!3d…!4d…` | o alfinete do lugar vale mais que o centro do mapa (`@…`) |

Não serve (a tela diz "Não entendi. Cole a latitude e a longitude, ou um link do Google Maps."): campo vazio, nome de
cidade ou endereço, CEP, um número só, três números, coordenadas fora do mundo, link curto (`maps.app.goo.gl`,
`goo.gl/maps`: só abre com rede), link só com o nome do lugar e link de outro site sem coordenadas. Há um teste por
formato e por entrada inválida (`locationInputService.test.ts`). "Usar este ponto" fecha o modal, marca o ponto e
centraliza o mapa.

**"Onde o app funciona"** (aberto pelo "Saiba mais" da legenda): o texto do MVP, o quadro "A linha tracejada no mapa
mostra essa área." e "Ver a área inteira", que fecha o modal e enquadra a área.

**"Créditos e uso de IA"**: o modal global do rodapé (tarefa 0052). Leaflet e Photon já estavam na lista; o Photon
passou a ser "endereço aproximado do ponto marcado".

## 5. Mapa (`FieldMap`, design system)

- Leaflet + OpenStreetMap. O crédito do Leaflet vai **sem a bandeira** que vem por padrão (regra do NASA Space
  Apps: nada de bandeiras) e o "© OpenStreetMap" fica sempre visível no canto.
- A tela pede o enquadre por `view = { target: 'area' | 'point', seq }`; cada pedido novo troca o `seq`.
- O alfinete é focável pelo teclado (nome "Alfinete da lavoura. Arraste para ajustar."); os botões do zoom têm o
  nome no idioma da tela ("Aproximar" / "Afastar").
- Com o mapa estreito (computador pequeno), a dica desce para não bater no "Ver a área inteira" e a legenda sobe
  para não encostar no crédito do mapa (container queries).

## 6. "Fazenda da UFU" vira "lavoura de demonstração" (no app todo)

O ponto de exemplo (−18,9543, −48,1993) **não é garantidamente a fazenda experimental da UFU**: ele fica cerca de 1
km a leste da Fazenda do Glória. As coordenadas continuam as mesmas, porque esse é um dos 4 pontos com histórico de
NDVI. Muda só o nome:

- pt: "Lavoura de demonstração, perto de Uberlândia (MG)" (nome completo) ou "lavoura de demonstração" (no meio da
  frase);
- en: "Demo field, near Uberlândia (MG)" ou "demo field".

Onde mudou:

- **Front:** "Como a conta é feita", o erro da missão e "Ver a lavoura de demonstração" (antes "Ver a fazenda de
  exemplo"). Um teste confere que nenhum texto da interface volta a citar a UFU, a Fazenda do Glória ou a "fazenda
  de exemplo".
- **API:** o 404 `OUTSIDE_AREA` do `/recomendacao` e do `/safra-passada` diz "Veja a lavoura de demonstração.". A
  descrição da fixture do clima e o pipeline que a gera também mudaram.
- **Docs:** PRD (RF-11, RF-23 e a nota do Plano A), plano técnico, prompt do Lovable, guia do NDVI, AGENTS.md do
  backend, ADRs, tarefas e remodelagem. Saem também o "48 ha" e a "área pública", que só valiam para o campo da UFU.

O que **não** mudou: nomes de arquivo e identificadores (`EXAMPLE_FARM`, `clima_fazenda_exemplo.json` e as
variáveis `UFU`, `UFU_POWER_CELL` e `UFU_CELL_ID` dos testes do backend). Também ficaram as menções à UFU em outro
contexto: estudos citados nos documentos de produto de origem e a sugestão de calibrar o NDVI com a área
experimental da UFU no guia do NDVI.

## 7. O que saiu

- Front: o campo "Buscar cidade, estrada ou endereço", a frase "Também dá para colar as coordenadas…", o link
  "Endereços: © OpenStreetMap", a frase longa do MVP embaixo do mapa (`where.mvpNote`), a instrução "Ou arraste o
  mapa até o alfinete ficar em cima da lavoura", "Pergunta 1 de 2" e o alfinete fixo no centro.
- Código sem uso, com os testes dele: `PlaceSearch`, `MapPicker`, a busca do Photon (`/api`, `canSearch`,
  `MIN_SEARCH_LENGTH`, `SEARCH_LIMIT`), os tipos do autocompletar, o `areaCenter` e o `SearchIcon`.

## 8. Testes e conferência

- TDD: cada comportamento com o teste antes, visto falhando (`FieldMap.test.tsx`, `useWhereController.test.ts`,
  `WhereView.test.tsx`, `locationInputService.test.ts`, `locationService.test.ts`, `positionService.test.ts`,
  `geocodingService.test.ts`, `geocodingRepository.test.ts`, `messages.test.ts`, `routes.test.tsx`).
- Front: 1096 testes passando; `npm run lint` sem erro (só o aviso antigo do `useMissionController`); `npm run build`
  passando. Back: `pytest`, `ruff check` e `ruff format --check` passando.
- Prints no Chrome (CDP) contra o protótipo: os 4 estados em 1280 × 800 e 390 × 844, em pt e en; os dois modais no
  computador e no celular; tocar, arrastar e confirmar no navegador de verdade; o GPS que acha e o que falha.
- Nada estoura na horizontal em 360, 390, 768, 1280 e 1440 px.
- Em 1280 × 800, a página tem 666 px entre o cabeçalho e o rodapé: com o cabeçalho (76 px) e o rodapé de uma linha
  (cerca de 57 px) da tarefa 0052, tudo cabe sem rolar (799 px), como no protótipo. No estado "fora da área", passa
  cerca de 70 px, o que o pedido aceita.

## 9. Riscos e pendências

- Os textos genéricos "Ouvir resumo", "Parar" e "Fechar" estão no bloco `where` (`listenSummary`, `stopListening`,
  `close`), para não conflitar com a tarefa 0052, que cria `listen.*` e `common.close`. Depois do rebase, dá para
  trocar por eles.
- No celular, o cartão fica depois do mapa (a ordem do pedido): o aviso de erro do GPS só aparece rolando. A barra
  fixa continua dizendo "Marque a lavoura no mapa para continuar.".
- O "Perto de {lugar}" usa o nome que o Photon devolve (pode ser longo, ex.: "Perto de Córrego Olho D'água,
  Miraporanga, Uberlândia, Minas Gerais"); sem resposta, a cidade de referência mais perto.
