# AGENTS.md

Instruções para qualquer agente de código (Claude Code, Gemini CLI e outros) e para pessoas do time.
**Este arquivo é a fonte única das regras.** `CLAUDE.md` e `GEMINI.md` só importam este arquivo:
nunca escreva regras neles. Cada pasta com regras próprias tem o seu `AGENTS.md`
(`projeto/backend/AGENTS.md`, `projeto/frontend/AGENTS.md`).

## O projeto

**Raiz Orbital** (hackathon da NASA): ajuda o produtor a decidir **o que plantar depois da soja**
usando dados de satélite e clima (NASA POWER, IMERG, MODIS, SMAP, CMIP6, SoilGrids).

A fonte de verdade do produto está em `arquivos contexto/`:
- `PRD – Raiz Orbital o que plantar depois da soja.md`: requisitos, motor de pontuação, arquitetura, backlog.
- `Raiz Orbital discovery de produto (dores, personas e hipóteses).md`
- `Raiz Orbital planejamento de produto, business case e business plan.md`

Leia o PRD antes de implementar qualquer regra de negócio. Se o código e o PRD discordarem, pergunte.

## Mapa do repositório

```
AGENTS.md                 regras gerais (este arquivo)
arquivos contexto/        PRD, discovery e business plan
projeto/
  docker-compose.yml      sobe backend + frontend para desenvolvimento
  backend/                API em Python (FastAPI)  -> ver projeto/backend/AGENTS.md
  frontend/               interface em React + Vite -> ver projeto/frontend/AGENTS.md
.pre-commit-config.yaml   checagens antes de cada commit (segredos, lint)
```

## Como rodar

```bash
cd projeto
docker compose up --build        # front em http://localhost:5173, API em http://localhost:8000/docs
docker compose run --rm backend pytest    # testes do backend dentro do container
docker compose down
```

Sem Docker: veja os comandos em cada `AGENTS.md` de `projeto/backend` e `projeto/frontend`.

## Repositório PÚBLICO: o que nunca vai para o git

Tudo o que é commitado fica público para sempre, mesmo se apagado depois (robôs varrem o GitHub em minutos).

- **Nunca commitar:** `.env`, senhas, tokens, chaves de API, JSON de service account do Google,
  credenciais do Earthdata, chaves privadas, dados pessoais, dados brutos ou pesados (`*.parquet`, `data/`).
- **Segredos vivem só em variáveis de ambiente.** Variável nova → adicionar o **nome** (sem valor) no
  `.env.example` da pasta.
- **Front-end:** toda variável `VITE_*` vai parar no navegador. Nunca coloque segredo nela.
- **Nunca usar `git commit --no-verify`** nem desligar hooks. Se o gitleaks barrar, remova o segredo;
  se for falso positivo, avise a pessoa responsável antes de qualquer coisa.
- **Antes de commitar:** `git add` por caminho (evite `git add -A`/`git add .`) e revise `git diff --staged`.
- **Se um segredo vazar:** avise o time na hora e revogue/troque a credencial. Apagar o commit não basta.

## Trabalho com vários agentes e pessoas

O time usa Claude e Gemini ao mesmo tempo. Para não pisar no trabalho um do outro:

1. `git pull` no `main` antes de começar.
2. Uma branch por tarefa: `feat/<descricao>`, `fix/<descricao>`, `chore/<descricao>`, `docs/<descricao>`.
3. Commits pequenos, mensagem em português no formato Conventional Commits
   (ex.: `feat(backend): adiciona endpoint do talhão`).
4. Mexa só no que a tarefa pede. Não reformate nem reorganize arquivos fora do escopo.
5. Integração no `main` sempre por pull request.
6. Mudou uma convenção, comando ou estrutura? Atualize o `AGENTS.md` certo **no mesmo PR**.
7. Decisões importantes (biblioteca nova, mudança de arquitetura) vão na descrição do PR.

## Definição de pronto

- Testes e lint passando (backend: `pytest` + `ruff`; frontend: `npm run lint` + `npm run build`).
- `pre-commit run --all-files` sem erros.
- `docker compose up --build` continua subindo.
- README e `AGENTS.md` atualizados se algo mudou.

## Idioma e estilo

- Documentação, comentários, commits e PRs em **português**.
- Código (nomes de variáveis, funções, classes) em **inglês**. Termos de domínio do PRD podem ficar em
  português quando forem o nome do conceito (ex.: `talhao`, `isna`).
- A interface tem português (produtor) e inglês (juízes), conforme o PRD (RNF-03).
