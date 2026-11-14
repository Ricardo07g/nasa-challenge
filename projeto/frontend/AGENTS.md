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
- **Dados (`VITE_API_MODE`):** `http` usa a API real (padrão no `docker compose`); `mock` usa os dados de
  exemplo de `repositories/mocks/` (sem backend; padrão no `npm run dev` sem a variável). A API só tem
  dados da célula da fazenda de exemplo: fora dela, as telas 4 a 7 mostram "Ainda não chegamos aí".
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
