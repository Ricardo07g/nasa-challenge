# AGENTS.md: frontend (interface)

Complementa o `AGENTS.md` da raiz (leia primeiro). Aqui ficam só as regras do front.

## Stack

- **React 19** + **TypeScript**
- **Vite** (dev server e build)
- **oxlint** (lint)
- **npm** (o `package-lock.json` é sempre commitado)
- Node **24** (mesma versão da imagem Docker)

## Estrutura

```
index.html          página base (título, idioma)
src/main.tsx        ponto de entrada do React
src/App.tsx         componente raiz (hoje mostra o status da API)
src/index.css       estilos globais
public/             arquivos estáticos servidos como estão
vite.config.ts      dev server e proxy /api -> backend
```

## Comandos

Sem Docker:

```bash
cd projeto/frontend
npm install
npm run dev      # http://localhost:5173 (a API precisa estar em http://localhost:8000)
npm run lint
npm run build    # checa os tipos (tsc) e gera dist/
```

Com Docker (a partir de `projeto/`): `docker compose up --build frontend`.

## Convenções

- **Chamadas à API:** sempre por caminho relativo `/api/...` (ex.: `fetch('/api/health')`).
  O proxy do Vite encaminha para o backend (`API_PROXY_TARGET`, padrão `http://localhost:8000`).
  Não escreva URL do backend fixa no código.
- **Variáveis de ambiente:** tudo que começa com `VITE_` é **público** (vai no JavaScript do navegador).
  Nunca coloque segredo, token ou senha em `VITE_*`. Segredos ficam só no backend.
- **Idioma:** textos da interface em português (produtor) e inglês (juízes), conforme o PRD (RNF-03).
- **Celular:** a interface precisa funcionar em tela de celular (RNF-04).
- **Dependências:** `npm install <pacote>` (ou `-D` para dev). Biblioteca nova grande (mapa, gráficos,
  UI kit) → justifique na descrição do PR.
