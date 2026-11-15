# AGENTS.md

Instruções para qualquer agente de código (Claude Code, Gemini CLI e outros) e para pessoas do time.
**Este arquivo é a fonte única das regras.** `CLAUDE.md` e `GEMINI.md` só importam este arquivo:
nunca escreva regras neles. Cada pasta com regras próprias tem o seu `AGENTS.md`
(`projeto/backend/AGENTS.md`, `projeto/frontend/AGENTS.md`). Leia o desta raiz **e** o da pasta onde vai trabalhar.

## O projeto

**Raiz Orbital** (hackathon da NASA): ajuda o produtor a decidir **o que plantar depois da soja**
usando dados de satélite e clima (NASA POWER, IMERG, MODIS, SMAP, CMIP6, SoilGrids).

A fonte de verdade do produto está em `arquivos contexto/`:
- `PRD – Raiz Orbital o que plantar depois da soja.md`: requisitos, motor de pontuação, arquitetura, backlog.
- `Raiz Orbital – Protótipo das telas.html`: protótipo das telas (v3: 2 perguntas, 1 resposta).
- `Raiz Orbital – plano técnico do backend.md`: contratos da API, banco, pipeline de dados e motor (leia antes de mexer no backend).
- `Raiz Orbital – prompt do Lovable.md`: prompt completo para gerar o protótipo no Lovable (telas, visual, dados de exemplo, contrato da API).
- `Raiz Orbital discovery de produto (dores, personas e hipóteses).md`
- `Raiz Orbital planejamento de produto, business case e business plan.md`
- `prompt-raiz-orbital.md`: **remodelagem do produto pedida em 15/11/2026** (9 seções: sem R$, busca no
  mapa, "Quando" novo, raio-X do satélite, abas Sugestão/Comparar/Plano, avisos, comunidade, guia). O roteiro,
  o estado de cada seção, as decisões e a revisão ficam em `projeto/backend/docs/remodelagem.md`.
- `Raiz Orbital – plano de evolução do produto.md`: evolução depois do MVP, **por ordem de prioridade** (ajustes A1 e A2, depois P1 a P6; WhatsApp como desejável). Cada item vira requisito no PRD no PR que o implementar.

Leia o PRD antes de implementar qualquer regra de negócio. Se o código e o PRD discordarem, pergunte.

## Mapa do repositório

```
AGENTS.md                 regras gerais (este arquivo)
arquivos contexto/        PRD, protótipo, discovery e business plan
projeto/
  docker-compose.yml      sobe banco (PostGIS) + backend + frontend para desenvolvimento
  .env.example            variáveis opcionais do compose (banco local)
  backend/                API em Python (FastAPI)   -> ver projeto/backend/AGENTS.md
  frontend/               interface em React + Vite -> ver projeto/frontend/AGENTS.md
.pre-commit-config.yaml   checagens antes de cada commit (segredos, lint)
```

## Como rodar

```bash
cd projeto
docker compose up --build        # front :5173, API :8000/docs, banco localhost:5433
docker compose run --rm backend pytest          # testes do backend
docker compose exec frontend npm test           # testes do frontend (com o compose rodando)
docker compose down              # para tudo (os dados do banco ficam no volume db_data)
docker compose down -v           # para tudo e APAGA o banco local
```

Mudou dependência do frontend? Rode `docker compose up --build -V` para recriar o `node_modules` do container.

Deploy na Railway (banco PostGIS, backend e front, que dormem depois de ~10 min sem uso): veja
`projeto/backend/docs/deploy-railway.md`. Nenhuma credencial vai para o git: segredos só nas variáveis da Railway.

Dados locais para testar com dado real (clima, solo, CMIP6, NDVI; pasta `data/baixados`, fora do git):
veja `projeto/backend/docs/como-preparar-os-dados-locais.md`.

## TDD é obrigatório

Todo código novo (backend e frontend) é desenvolvido com **TDD**, sem exceção para regra de negócio:

1. **Red:** escreva o teste que descreve o comportamento e rode. Ele **precisa falhar**, e pelo motivo certo.
2. **Green:** escreva o mínimo de código para o teste passar.
3. **Refactor:** melhore o código com todos os testes verdes.

Regras:
- Nada de implementação sem teste falhando antes. Correção de bug começa com um teste que reproduz o bug.
- Cada camada tem o seu tipo de teste (ver tabela abaixo e o `AGENTS.md` da pasta).
- Teste não depende do ambiente: nada de rede real, banco real ou variáveis da máquina em teste unitário.
- PR sem teste para o comportamento novo não está pronto.

## Arquitetura: MVC + Service/Repository

Backend e frontend usam a **mesma divisão em camadas**. As regras de negócio ficam **sempre no service**;
o acesso a dados fica **sempre no repository**.

| Camada | Responsabilidade | Backend (`app/`) | Frontend (`src/`) | Teste |
| --- | --- | --- | --- | --- |
| **Model** | Entidades e tipos do domínio | `models/` | `models/` | (usado pelos outros) |
| **View** | Como os dados são apresentados | `schemas/` (JSON da API) | `views/` (componentes) | render / contrato do JSON |
| **Controller** | Recebe a entrada, chama o service, devolve a view | `controllers/` (rotas FastAPI) | `controllers/` (hooks `use...`) | integração / `renderHook` |
| **Service** | **Regras de negócio** | `services/` | `services/` | unitário, com repository falso |
| **Repository** | **Acesso a dados** (banco, arquivos, HTTP) | `repositories/` | `repositories/` (chamadas à API) | unitário |

Direção das dependências (nunca ao contrário):

```
View  <-  Controller  ->  Service  ->  Repository  ->  dados (PostGIS, arquivos, API)
                              \-> Model <-/
```

- **Controller** é fino: sem regra de negócio, sem SQL, sem `fetch`.
- **Service** não conhece HTTP, FastAPI, React nem banco: recebe o repository por injeção.
- **Repository** não tem regra de negócio: só lê e grava.
- Exemplo completo para copiar: opções de entressafra (`crop_option` no backend, `cropOption` no frontend).

## Banco de dados: PostgreSQL + PostGIS

- Banco local: **PostgreSQL 17 + PostGIS 3.5** (serviço `db` do compose), porque os dados da NASA são
  geográficos (pontos, grades de 0,1°, polígonos de talhão).
- Coordenadas sempre em **WGS 84 (SRID 4326)**, ordem **longitude, latitude** (`ST_MakePoint(lon, lat)`).
- Distâncias e áreas em metros: use `geography` ou projete antes de medir.
- Só os **repositories** acessam o banco. A conexão vem de `DATABASE_URL` (nunca fixa no código).
- Usuário e senha do compose são **só para uso local**. Credencial de banco de produção nunca entra no repo.

## Repositório PÚBLICO: o que nunca vai para o git

Tudo o que é commitado fica público para sempre, mesmo se apagado depois (robôs varrem o GitHub em minutos).

- **Nunca commitar:** `.env`, senhas, tokens, chaves de API, JSON de service account do Google,
  credenciais do Earthdata, chaves privadas, dados pessoais, dados brutos ou pesados (`*.parquet`, `data/`),
  dumps do banco.
- **Segredos vivem só em variáveis de ambiente.** Variável nova → adicionar o **nome** (sem valor real) no
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

- Feito com TDD: teste novo para cada comportamento novo, escrito antes do código.
- Código na camada certa (MVC + service/repository).
- Backend: `pytest` + `ruff check` + `ruff format --check` passando.
- Frontend: `npm test` + `npm run lint` + `npm run build` passando.
- `pre-commit run --all-files` sem erros.
- `docker compose up --build` continua subindo.
- README e `AGENTS.md` atualizados se algo mudou.

## Idioma e estilo

- Documentação, comentários, commits e PRs em **português**.
- Código (nomes de variáveis, funções, classes) em **inglês**. Termos de domínio do PRD podem ficar em
  português quando forem o nome do conceito (ex.: `talhao`, `isna`).
- A interface tem português (produtor) e inglês (juízes), conforme o PRD (RNF-03).
