# Tarefa 0052: Tela Início nova, cabeçalho e rodapé globais, "Ouvir resumo", modais e créditos

- **Identificador:** `0052`
- **Título:** A tela Início fica igual ao protótipo de 15/11/2026 (só o essencial à vista, os detalhes em modais), com o cabeçalho e o rodapé globais da remodelagem, o "Ouvir resumo" por tela, o modal reutilizável e o modal global de créditos
- **Status:** Concluída
- **Prioridade:** Alta (prompt da tela 0 e decisões do usuário de 15/11/2026)
- **PRD:** RF-36 (substitui o botão "Ouvir" do cabeçalho da RF-17 e tira da Início o selo e a frase do MVP da RF-35)
- **Módulos Afetados:** só front (`projeto/frontend/src/`): `views/StartView.tsx`, `views/ShellView.tsx`, `views/CreditsModal.tsx`, `design-system/components/{Header,Footer,Modal,ListenSummary}.tsx`, `controllers/{useShellController,useStartController,useListenSummary}.ts`, `content/credits.ts`, `services/speechService.ts`, `services/markdownService.ts`, `design-system/tokens.css`, `design-system/icons/index.tsx`, `i18n/messages.{pt,en}.ts`, `pages.tsx`
- **Referências:** protótipo `tela-0-inicio.html` e o prompt `tela-0-inicio-prompt.md` (pasta "Raiz Orbital – telas"); `projeto/frontend/AGENTS.md` ("Cabeçalho e rodapé globais", "Ouvir resumo", "Modal", "Créditos e regras do NASA Space Apps")

---

## 1. Decisões

- **Siga o prompt à risca.** Onde o protótipo e o prompt divergem, vale o prompt. O selo da foto é
  "Dados da NASA · Triângulo Mineiro · MG" (com o "+", abre "De onde vêm os dados").
- **O MVP sai da Início.** A frase de `start.mvpNote` e o selo "MVP · região de Uberlândia e Uberaba"
  (`start.region`) da tarefa 0051 saíram da tela inicial. O aviso do MVP **continua** em "Onde fica a lavoura",
  "Como a conta é feita" e no Guia.
- **Cabeçalho e rodapé são globais**, então valem para todas as telas:
  - cabeçalho só com Comunidade (pílula, com o nome também no celular), Avisos (selo com o número real de
    `/api/avisos`, tarefa 0046) e o idioma;
  - **sem o botão grande "Ouvir"** e sem o link do Telegram (o Telegram continua na Sugestão e em "Como a conta é
    feita", quando `VITE_TELEGRAM_BOT_URL` existe);
  - rodapé com o escudo e o aviso à esquerda e, à direita, "Créditos e uso de IA" (modal global) e "NASA Space Apps
    2026 · Field Shift";
  - **duas variantes do rodapé** (pedido do coordenador, alinhado ao prompt da tela 1): na Início, só isso; nas telas
    internas, também o link "Como a conta é feita ↗" (`/como-funciona` com o caminho da URL). Quem decide é o
    `useShellController`, pela rota (`/` = Início);
  - o link "Sou agrônomo(a): como a conta é feita" saiu do rodapé; a **faixa do agrônomo** existe só na Início.
- **"Ouvir resumo" (nova regra geral):** o "Ouvir" nunca lê a tela inteira. Cada tela tem um resumo falado próprio,
  de 2 ou 3 frases, em pt e en, num link discreto perto do título. Componente reutilizável `ListenSummary` (design
  system) + controller `useListenSummary(texto, idioma)`; Web Speech API em pt-BR / en-US a 0,95 de velocidade
  (`SPEECH_RATE` do `speechService`, que já escolhia a melhor voz pelo `voicePicker`). Enquanto fala, vira "Parar"
  com o quadrado e `aria-pressed="true"`; trocar o idioma ou sair da tela para; sem voz, não aparece.
- **As outras telas ficam sem "Ouvir"** até ganharem o "Ouvir resumo" delas nos próximos prompts (cada prompt traz o
  resumo da tela). O `useListen` antigo, que lia o `<main>` inteiro, saiu.
- **"Ver um exemplo pronto" sai da Início.** Pelo prompt, o exemplo passa para "Onde fica a lavoura" ("Usar a
  lavoura de demonstração"). Essa tela é refeita em outra tarefa, em paralelo; aqui ela **não** mudou. Até lá, a rota
  `/exemplo` continua com as entradas que já existiam ("Ver a fazenda de exemplo" de fora da área, em "Onde fica a
  lavoura", na missão e na tela 4).
- **Modal reutilizável** (`design-system/components/Modal.tsx`), o padrão de todo "ver detalhes": `<dialog>` nativo
  (`showModal`, com o atributo `open` como reserva), que fecha com o X, com Esc e com clique fora (no fundo
  escurecido); o foco entra no modal, fica preso nele (Tab e Shift+Tab dão a volta) e volta a quem o abriu. No
  computador, centralizado, até 560 px (640 px no `size="wide"`), cantos de 18 px e fundo escuro com desfoque leve; no
  celular (até 900 px), folha de baixo para cima com a largura toda e até 88% da altura.
- **Créditos num arquivo único** (`content/credits.ts`, pt e en, uma linha por fonte, negrito com `**…**` lido pelo
  `parseInline` do `markdownService`, sem HTML). Um teste confere que os dois idiomas têm os mesmos grupos e o mesmo
  número de linhas. Além das fontes do prompt, entraram **Leaflet** (BSD-2-Clause) e **Photon** (komoot), que o app
  já usa hoje (regra 2 do NASA Space Apps: listar tudo o que é usado).
- **Foto e logo do repositório:** a foto da Início (`assets/cerrado-field.jpg`) é gerada por IA (Lovable), então leva
  a marca d'água "Imagem gerada por IA": no computador, embaixo do selo; no celular, no canto inferior esquerdo da foto.
  O texto alternativo passou a descrever a foto de verdade: "Lavoura no Triângulo Mineiro ao amanhecer".
- **Regras do NASA Space Apps:** nada de logo, bandeira ou identificador de missão da NASA; "NASA" só como texto que
  cita a fonte; ícone de satélite genérico do Lucide.
- **Sem dependência nova:** ícones `lucide-react` (novos no design system: `ListenIcon`, `CalculatorIcon`,
  `HouseIcon`, `SparkleIcon`, `ClockIcon`; o `StopIcon` ficou cheio) e as fontes Inter e Space Grotesk do
  `@fontsource`.
- **Cores do protótipo v4** em tokens novos (`--color-info` #2c5a7d, `--color-tint-green-soft`, `--color-focus-ring`,
  `--color-backdrop`, sombras, `--page-width-v4` 1280 px com `--page-margin-v4` 52 px / 20 px). As cores iguais às de
  antes (verde, texto, bordas, laranja) reaproveitam os tokens existentes. O foco verde-claro de 3 px vale nos
  componentes novos (cabeçalho, rodapé, Início, modal, "Ouvir resumo"); as outras telas seguem com o foco azul até os
  prompts delas.
- **Idioma no cabeçalho:** continua um botão só (troca o idioma), que mostra "PT | EN" com o atual em verde; no celular
  aparece só o outro idioma. O comportamento é igual ao do protótipo, que tem dois botões.

## 2. Telas e textos

### Início (`/`)

| Onde | pt | en |
| --- | --- | --- |
| Etiqueta | Para quem planta soja no Triângulo Mineiro | For soybean growers in Triângulo Mineiro, Brazil |
| Título | O que plantar depois da soja? | What to plant after soybeans? |
| Slogan (também no cabeçalho) | Do espaço até a raiz. | Eyes on the sky, roots in the ground. |
| Frase | O satélite da NASA olha a chuva de muitos anos na sua lavoura. Veja a melhor opção. | NASA satellites look at many years of rain on your field. See the best option. |
| Link | Ouvir resumo / Parar | Listen to summary / Stop |
| Botão | Começar → | Start → |
| Selo da foto | Dados da NASA · Triângulo Mineiro · MG | NASA data · Triângulo Mineiro · MG |
| Marca d'água | Imagem gerada por IA | AI-generated image |
| Passos | Marque a lavoura · Um ponto no mapa. / Diga quando colhe · A época da colheita da soja. / Veja a resposta · O melhor caminho para a sua terra. | Mark your field · One pin on the map. / Tell us when you harvest · When your soybeans come out. / See the answer · The best path for your land. |
| Faixa do agrônomo | **É agrônomo(a) ou técnico(a)?** Veja as regras, os pesos e a fonte de cada número. · Como a conta é feita → | **Agronomist or technician?** See the rules, the weights and the source of every number. · How the math works → |

Resumo falado (`start.summary`): "O Raiz Orbital ajuda a decidir o que plantar depois da soja, com 20 anos de dados de
satélite da NASA. É só marcar a lavoura no mapa e dizer quando você colhe a soja. Em seguida, você vê a melhor opção
para a sua terra." (en: "Raiz Orbital helps you decide what to plant after soybeans, using 20 years of NASA satellite
data. Just mark your field on the map and tell us when you harvest your soybeans. Then you see the best option for your
land.")

Saíram da Início: "Ver um exemplo pronto", "2 perguntas · 1 minuto · grátis, sem cadastro", o título "Uma boa próxima
safra começa com uma boa escolha." com a seção cinza dos passos, "Da NASA para a sua lavoura", o selo e a frase do MVP
e o link do Telegram (as chaves `start.mvpNote`, `meta`, `example`, `stepsEyebrow`, `region` e `telegram.home`, e
`header.listen`, `stop`, `listenLabel`, `stopLabel` e `footer.agronomist`, saíram do dicionário).

### Modal "De onde vêm os dados" (selo da foto)

"20 anos de satélite (2005–2024) no ponto da sua lavoura." · Chuva (GPM IMERG · NASA · chuva de cada dia) · Calor e
água que a lavoura gasta (NASA POWER · temperatura, sol e vento) · Solo (SoilGrids · quanta água a terra guarda) ·
Clima de 2041 a 2060 (NEX-GDDP-CMIP6 · NASA) · quadro "Nenhum número é inventado. Se não há dado para o seu ponto,
aquela parte não aparece." · "Todas as fontes e créditos →" fecha este modal e abre o de créditos (o foco volta ao
selo quando o de créditos fecha).

### Cabeçalho e rodapé (todas as telas)

| Onde | Antes | Depois |
| --- | --- | --- |
| Cabeçalho | Comunidade, Avisos, Telegram (se configurado), botão "Ouvir", PT \| EN | Comunidade (pílula), Avisos (selo), PT \| EN |
| Rodapé, Início | aviso + "Sou agrônomo(a): como a conta é feita" + "NASA Space Apps Challenge 2026 · Field Shift" | aviso + "Créditos e uso de IA" + "NASA Space Apps 2026 · Field Shift" |
| Rodapé, telas internas | igual ao de cima | aviso + "Como a conta é feita ↗" + "Créditos e uso de IA" + "NASA Space Apps 2026 · Field Shift" |

Em inglês, o aviso passou a "Helps you decide. It does not replace your agronomist." e o slogan, a "Eyes on the
sky, roots in the ground." (trocado em 15/11/2026; o nome "Raiz Orbital" não se traduz, e só na Início em inglês a
linha "Portuguese for “Orbital Root”" aparece logo abaixo do nome).

## 3. Testes (TDD)

Cada peça começou por um teste vermelho: `speechService` (velocidade 0,95), `useListenSummary` (fala só o resumo,
para no toque, no fim, ao trocar o idioma e ao sair; o fim de uma fala antiga não desliga a nova), `ListenSummary`
("Parar" com o quadrado e `aria-pressed`, some sem voz), `Modal` (X, Esc, clique fora, foco preso e devolvido),
`content/credits` (mesmas linhas em pt e en, fontes obrigatórias, uso de IA), `CreditsModal`, `Header` (só três itens,
pílula com o nome, selo com e sem número, PT | EN), `Footer` (as duas variantes), `useShellController` (variante por
rota, modal de créditos, idioma), `ShellView`, `useStartController` (resumo em pt e en, modal das fontes, troca para os
créditos), `StartView` (ordem do texto, o que saiu, passos, foto e marca d'água, selo, modal, faixa do agrônomo, en) e
`routes.test` (rodapé interno e da Início, créditos em qualquer tela com Esc e foco, troca das fontes para os créditos).
Total do front: 1089 testes.

## 4. Conferência visual

Chrome headless com o front em `localhost:5181` e a API real (Docker, só leitura):

- 1280 × 800: a altura do documento é 800 (cabe sem rolar), em pt e en, igual ao protótipo (diferença de até 2 px).
- 390 × 844: o "Começar" e o começo dos passos aparecem sem rolar.
- Sem estouro na horizontal (scrollWidth = largura) em 360, 390, 768, 1280 e 1440 px, em pt e en; em 360 px o
  cabeçalho fica mais justo (até 380 px) para o nome "Raiz Orbital" aparecer inteiro.
- Os dois modais abertos no computador (centralizados) e no celular (folhas de baixo para cima); no Chrome de verdade,
  Tab dá a volta dentro do modal, Esc e clique fora fecham e o foco volta ao selo.

## 5. Diferenças que ficaram em relação ao protótipo

- **Foto:** a do repositório (gerada por IA no Lovable), não o recorte do print do protótipo (que ainda tinha a órbita
  desenhada da Início antiga).
- **Selo de avisos:** o protótipo mostra "1" fixo; aqui vem de `/api/avisos` e some sem ponto marcado ou sem aviso.
- **Celular, faixa do agrônomo:** no protótipo o ícone da calculadora encolhe (falta `flex: none`) e o texto cabe em 2
  linhas; aqui o ícone fica no quadrado de 40 px e o texto usa 3 linhas.
- **Celular, modal de créditos:** no protótipo a folha não ocupa a largura toda (a regra `dialog.largo` vem depois da do
  celular); aqui ocupa, como pede o prompt.
- **Telas largas (1440 px):** o selo e a marca d'água ficam alinhados à coluna de 1280 px, como o cabeçalho (no
  protótipo ficam presos à borda da janela); em 1280 px é igual.
- **Ícones:** os do Lucide (o brilho da marca d'água é o `Sparkle` cheio, um pouco mais largo que o desenho do protótipo).

## 6. O que não mudou

- Backend, API e `data/`.
- A tela "Onde fica a lavoura" (`/onde`): é refeita em outra tarefa, que traz a "lavoura de demonstração".
- O aviso do MVP em "Onde fica a lavoura", "Como a conta é feita" e no Guia (tarefa 0051).

## 7. Riscos

- **Telas sem "Ouvir" por enquanto:** quem dependia do "Ouvir" do cabeçalho nas telas 1 a 9 fica sem ele até cada
  tela ganhar o "Ouvir resumo" no prompt dela.
- **Contraste do foco:** o verde-claro do protótipo (#8fbfa6) tem contraste de cerca de 2:1 sobre o branco, abaixo dos
  3:1 que a WCAG pede para indicadores de foco; foi mantido porque o prompt pede, mas vale rever no design system.
- **Foco verde só nos componentes novos:** até as outras telas serem refeitas, a página mistura o foco verde (cabeçalho,
  rodapé, modais) com o azul (conteúdo das telas antigas).
- **`<dialog>` nativo:** em navegador sem `showModal` o modal abre pelo atributo `open`, sem deixar o resto da página
  inerte (o foco continua preso pelo próprio componente).
- **Conflitos de merge:** a tela "Onde fica a lavoura" está sendo refeita em paralelo a partir dos commits dos tokens,
  do "Ouvir resumo", do modal e dos créditos; os dicionários (`messages.{pt,en}.ts`) e o `pages.tsx` mudam nos dois
  lados.
