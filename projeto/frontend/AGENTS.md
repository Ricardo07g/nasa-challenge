# AGENTS.md: frontend (interface)

Complementa o `AGENTS.md` da raiz (leia primeiro: TDD obrigatório e arquitetura em camadas).
Aqui ficam só as regras do front.

## Stack

- **React 19** + **TypeScript**
- **Vite** (dev server e build)
- **Vitest** + **Testing Library** (testes, ambiente jsdom)
- **oxlint** (lint)
- **npm** (o `package-lock.json` é sempre commitado)
- Node **24** (mesma versão da imagem Docker)

## Estrutura (MVC + Service/Repository)

```
src/
  main.tsx              ponto de entrada do React
  App.tsx               liga o controller à view (sem lógica)
  models/               Model: tipos do domínio (ex.: CropOption)
  repositories/         Repository: ACESSO A DADOS. Único lugar com fetch (httpClient.ts)
  services/             Service: REGRAS DE NEGÓCIO do front (ex.: aplicar pesos ao ranking, RNF-02)
  controllers/          Controller: hooks use<Tela>Controller, guardam estado e chamam services
  views/                View: componentes que só desenham props, sem fetch e sem regra
  design-system/        tokens.css (cores, tipografia, raios, espaços), componentes e ícones
  test/setup.ts         configuração dos testes (jest-dom, limpeza)
  index.css             estilos globais
vite.config.ts          dev server, proxy /api -> backend e config do Vitest
```

Testes ficam **ao lado do arquivo** testado: `X.ts` → `X.test.ts`, `X.tsx` → `X.test.tsx`.

Exemplo de referência para copiar: tela inicial com as opções de entressafra
(`repositories/cropOptionRepository.ts` → `services/cropOptionService.ts` →
`controllers/useHomeController.ts` → `views/HomeView.tsx`).

## Fluxo TDD para uma funcionalidade nova

Sempre o teste antes do código, vendo ele falhar:

1. **Repository:** teste com `vi.stubGlobal('fetch', ...)` → função que chama `getJson('/api/...')`.
2. **Service:** teste com um repository falso (objeto com `vi.fn()`), criado por
   `create<X>Service(repositoryFalso)` → regra de negócio.
3. **Controller:** teste com `renderHook` passando services falsos → hook com o estado da tela.
   Crie os objetos falsos **fora** do callback do `renderHook` (senão o efeito roda em loop).
4. **View:** teste com `render` + `screen` passando props → componente.
5. **Ligação:** `App.tsx` (ou a página) chama o controller e passa o resultado para a view.

## Regras das camadas

- **Repository:** só HTTP, via `getJson` de `repositories/httpClient.ts`. Sem regra.
- **Service:** regras de negócio puras. Recebe o repository por parâmetro
  (`create<X>Service(repository = <x>Repository)`), para ser testável sem rede.
- **Controller (hook):** estado da tela, efeitos e handlers. Fala com services, nunca direto com repository.
  Recebe as dependências por parâmetro com padrão real (`use<X>Controller(deps = defaultDeps)`).
- **View:** só props → JSX. Sem `fetch`, sem `useEffect` de dados, sem regra de negócio.
- Sem classes com parameter properties nem `enum` (o `tsconfig` usa `erasableSyntaxOnly`).

## Comandos

Sem Docker:

```bash
cd projeto/frontend
npm install
npm run dev          # http://localhost:5173 (a API precisa estar em http://localhost:8000)
npm test             # testes uma vez
npm run test:watch   # testes em modo observação (bom para o ciclo TDD)
npm run lint
npm run build        # checa os tipos (tsc) e gera dist/
```

Com Docker (a partir de `projeto/`): `docker compose up --build frontend` e
`docker compose exec frontend npm test`. Depois de mudar dependências: `docker compose up --build -V`.

## Convenções

- **Chamadas à API:** sempre caminho relativo `/api/...`. O proxy do Vite encaminha para o backend
  (`API_PROXY_TARGET`, padrão `http://localhost:8000`). Não escreva URL do backend fixa no código.
- **Dados (`VITE_API_MODE`):** a **API real é o padrão** (variável vazia ou `http`, inclusive no
  `npm run dev` e no `docker compose`). Os dados de exemplo de `repositories/mocks/` só entram com
  `VITE_API_MODE=mock` explícito, e aí todas as telas mostram o aviso fixo "Modo de demonstração: dados de
  exemplo, não são da NASA". Só `repositories/index.ts` decide o modo e importa `repositories/mocks/`
  (um teste confere). Os testes rodam com `mock` (`test.env` do `vite.config.ts`), sem rede. A API só tem
  dados da área preparada: fora dela, as telas 4 a 7 mostram "Ainda não chegamos aí".
- **Dado que a API ainda não manda (decisão D2 da remodelagem, tarefa 0040 do backend):** com a API real,
  nenhuma tela mostra número de exemplo nem o selo "Ainda não conectado": **o elemento sem dado
  simplesmente não aparece** (cartão, linha, seção, fonte ou fase da missão). Um endpoint que ainda não
  existe (404 sem `code`) ou um repository sem versão http (`NotConnectedError`) vira o estado
  `not-connected` do controller (não é erro), e a view não desenha o bloco. Na tela 8, o 404
  `OUTSIDE_AREA` vira o estado `outside` (`RegionStatus`) e o bloco da região também não aparece.
  Campo novo de uma resposta que já existe (ex.: `chuva_mensal` do talhão) entra **opcional** no model
  (`campo?: X | null`): ausente (API antiga) ou `null` = o elemento não aparece. Enquanto o dado carrega,
  a tela não mostra nem o dado nem aviso. O design system não tem mais `NotConnected`, `NotConnectedCard`
  nem `status="unavailable"`: não traga de volta.
- **Nenhum valor em reais (seção 1 da remodelagem, tarefa 0040 do backend):** nenhuma tela, texto, mock ou
  teste mostra R$. A dimensão é **Renda** (eixo `renda`, motivo `mais_renda`) e só mostra fatos: o bloco
  `renda` de cada opção (`da_grao`, `anos_aperto`, `rotulo`, `texto` = "Dá grão para vender" ou "Não dá
  grão: é investimento na terra", `risco` = "Risco de perder a lavoura: … em N de 20 anos."), com os
  textos prontos da API. Reordenar por renda usa `notas.renda` (a nota do motor, sem preço nem custo). O
  bloco "Comece por um pedaço" (hectares e totais em reais, RF-21) saiu.
- **O que a URL guarda (RF-18):** `services/flowParams.ts` lê e monta `lat`, `lon`, `colheita`, `solo`,
  `exemplo` e `confirmadas` (as safras que o produtor confirmou na tela 4, `2024:plantou,2025:parado`,
  em ordem de ano e sem codificar `:` e `,`, para o link continuar legível). Toda tela que pede a
  recomendação passa o `confirmadas` da URL para o `farm.recomendacao` (o cache do `farmService` separa
  por ele). Na fazenda de exemplo, com safra confirmada, a recomendação vem do `/recomendacao` do ponto
  do exemplo, não do `/exemplo`.
- **Safras confirmadas (tarefa 0039 do backend, RF-25):** a regra fica em
  `services/confirmedSeasonsService.ts` (ler e escrever o parâmetro, pôr a resposta do produtor no
  lugar do satélite com `fonte_ano: 'produtor'`, as linhas do bloco e o aviso "Não parece uma lavoura
  de soja"). Os anos confirmáveis vêm do `/talhao` (`anos_confirmaveis`); sem o campo (API antiga), o
  bloco não aparece. A tela 4 pede o `/talhao` **sem** `confirmadas` (o que o satélite viu) e aplica as
  respostas no front, para confirmar não recarregar o talhão; o relatório também aplica. Os botões de
  cada ano são um `ChipGroup` (grupo com o rótulo do ano, `aria-pressed`); tocar de novo na resposta
  marcada volta para o satélite. O ano `sem_soja` vira o quadrinho `none` (pontilhado com "–") e a
  legenda "Sem soja"; não conta como parado, plantou nem sem certeza.
- **Gráfico com dado real:** tudo o que é desenhado vem da API, com a fonte e o período na legenda (ex.:
  "Média de 2005 a 2024, NASA POWER"). O mock traz o mesmo campo, no formato do contrato.
- **Guia (`/guia`, tarefa 0048, RF-26):** os artigos são arquivos Markdown em
  `src/content/guia/pt/<slug>.md` e `.../en/<slug>.md` (mesmo slug nos dois idiomas, carregados no build
  por `repositories/guideRepository.ts`). Cabeçalho simples entre `---`: `titulo`, `tema`
  (`culturas`, `plantar`, `terra`, `clima` ou `seguranca`), `slug` (igual ao nome do arquivo), `rascunho`
  (`sim` ou `nao`) e, nas culturas, `planta` (id do `culturas.yaml`, para a ilustração de
  `design-system/plants/PlantImage`). Título de seção fixo: "Em uma frase", "Por que importa", "Na sua
  lavoura", "Fontes" (cultura tem também "Conheça" e "Passo a passo"; em inglês "In one sentence", "Why it
  matters", "In your field", "Sources", "Get to know it", "Step by step"). De 150 a 300 palavras, frases
  curtas. Artigo de cultura, plantio e manejo tem `rascunho: sim` (a view põe "Rascunho: a revisar pela
  agrônoma." no topo). Números só de `culturas.yaml`, `regras.yaml` e do PRD. Link externo só de página
  aberta e conferida, e a página entra antes em `src/content/guia/verifiedSources.ts` (url, o que confirma,
  data); `guideContent.test.ts` barra link fora da lista, artigo fora do tamanho, sem a estrutura, sem par
  em outro idioma ou com link interno quebrado. Para ligar uma tela a um artigo, use o link
  `/guia/<slug>`. O Markdown é lido por `services/markdownService.ts` (títulos, parágrafos, listas, negrito
  e links; HTML vira texto puro e a view nunca usa `dangerouslySetInnerHTML`). Não adicione biblioteca de
  Markdown.
- **Telegram (`VITE_TELEGRAM_BOT_URL`):** link público do bot (ex.: `https://t.me/NomeDoBot`). Vazio = a interface
  não fala do Telegram. Só o link: o token do bot nunca entra no front.
- **Variáveis de ambiente:** tudo que começa com `VITE_` é **público** (vai no JavaScript do navegador).
  Nunca coloque segredo, token ou senha em `VITE_*`. Segredos ficam só no backend.
- **Idioma:** textos da interface em português (produtor) e inglês (juízes), conforme o PRD (RNF-03).
- **Celular:** a interface precisa funcionar em tela de celular (RNF-04).
- **Dependências:** `npm install <pacote>` (ou `-D` para dev). Biblioteca nova grande (mapa, gráficos,
  UI kit) → justifique na descrição do PR.
- **Visual:** cores, tamanhos e raios só por variável de `design-system/tokens.css` (nunca hex solto).
  A referência visual é a interface nova feita no Lovable (cabeçalho com slogan, rodapé com o aviso,
  cartões com borda). Veja tudo junto em `/design-system` (só no ambiente local).
- **Ícones:** sempre de `design-system/icons` (lucide por baixo, sempre `aria-hidden`). Não importe
  `lucide-react` direto nas telas: precisa de um ícone novo, adicione lá.
