# Raiz Orbital

**O que plantar depois da soja?** Projeto do hackathon da NASA que usa dados de satélite e clima
(NASA POWER, IMERG, MODIS, SMAP, CMIP6, SoilGrids) para ajudar o produtor a escolher a cultura de
entressafra com menos risco.

## Estrutura

```
projeto/
  docker-compose.yml   ambiente local (PostgreSQL + PostGIS, backend e frontend)
  backend/             API em Python 3.12 + FastAPI (dependências com uv)
  frontend/            interface em React + TypeScript + Vite
AGENTS.md              regras para pessoas e agentes de IA (Claude, Gemini)
```

### Como o código é organizado

- **TDD obrigatório:** todo comportamento novo começa por um teste que falha.
- **MVC + Service/Repository**, igual no backend e no frontend: controllers finos, **regras de negócio nos
  services** e **acesso a dados nos repositories**. Detalhes e exemplo em [`AGENTS.md`](AGENTS.md).

## Rodando localmente

Pré-requisito: Docker (Docker Desktop ou OrbStack).

```bash
cd projeto
docker compose up --build
```

- Interface: http://localhost:5173
- API (documentação interativa): http://localhost:8000/docs
- Health check: http://localhost:8000/api/health
- Banco (PostgreSQL 17 + PostGIS 3.5): `localhost:5433`, banco `raiz_orbital`, usuário `raiz`,
  senha `raiz_local` (credenciais **só para uso local**; para mudar, copie `projeto/.env.example` para `projeto/.env`)

Testes:

```bash
docker compose run --rm backend pytest     # backend
docker compose exec frontend npm test      # frontend (com o compose rodando)
```

`docker compose down` para tudo e mantém os dados do banco; `docker compose down -v` apaga o banco local.

Para rodar sem Docker, veja [`projeto/backend/AGENTS.md`](projeto/backend/AGENTS.md) (precisa de
[uv](https://docs.astral.sh/uv/)) e [`projeto/frontend/AGENTS.md`](projeto/frontend/AGENTS.md) (precisa de Node 24).

### Variáveis de ambiente

Copie `projeto/backend/.env.example` para `projeto/backend/.env` e preencha **só na sua máquina**.
O `.env` nunca é commitado.

## Antes do primeiro commit (uma vez por clone)

Este repositório é **público**. Os hooks barram commits com senhas, tokens ou chaves:

```bash
uv tool install pre-commit   # ou: pipx install pre-commit
pre-commit install
```

## Trabalhando com agentes de IA

As regras do projeto ficam em [`AGENTS.md`](AGENTS.md) (raiz) e em um `AGENTS.md` por pasta
(`projeto/backend`, `projeto/frontend`). `CLAUDE.md` e `GEMINI.md` apenas importam esses arquivos, então
Claude Code e Gemini CLI seguem as mesmas regras. Altere sempre o `AGENTS.md`, nunca os ponteiros.

## Licença

[MIT](LICENSE)
