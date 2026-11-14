# AGENTS.md: backend (API)

Complementa o `AGENTS.md` da raiz (leia primeiro: TDD obrigatório e arquitetura em camadas).
Aqui ficam só as regras da API.

## Stack

- Python **3.12** (fixado em `.python-version`)
- **FastAPI** + **uvicorn**
- **pydantic-settings** para configuração
- **PostgreSQL 17 + PostGIS 3.5** (serviço `db` do docker compose)
- **uv** para dependências e ambiente virtual
- **pytest** (testes) e **ruff** (lint + formatação)

## Estrutura (MVC + Service/Repository)

```
app/
  main.py              cria o FastAPI, CORS, tradução de erros de domínio e registro dos controllers
  config.py            Settings: toda configuração vem de variáveis de ambiente
  dependencies.py      injeção de dependências: monta service + repository para os controllers
  models/              Model: entidades do domínio (dataclasses), sem FastAPI/Pydantic de HTTP
  schemas/             View: formato do JSON de entrada/saída (Pydantic)
  controllers/         Controller: rotas FastAPI, finas (recebem, chamam o service, devolvem schema)
  services/            Service: REGRAS DE NEGÓCIO; errors.py tem os erros de domínio
  repositories/        Repository: ACESSO A DADOS (contrato em Protocol + implementações)
tests/
  unit/services/       service com repository falso (sem banco, sem HTTP)
  unit/repositories/   repository isolado
  integration/controllers/  rotas via TestClient, com dependency_overrides
pyproject.toml         dependências e configuração do ruff/pytest
uv.lock                versões exatas (sempre commitado)
requirements.txt       GERADO do uv.lock: não editar à mão
```

Exemplo de referência para copiar: opções de entressafra
(`models/crop_option.py` → `repositories/crop_option_repository.py` → `services/crop_option_service.py`
→ `controllers/crop_option_controller.py` + `schemas/crop_option.py`, e os testes em `tests/`).

## Fluxo TDD para uma funcionalidade nova

Faça de baixo para cima, sempre com o teste antes do código e vendo ele falhar:

1. **Model** da entidade (se for nova).
2. **Repository:** teste em `tests/unit/repositories/` → contrato (`Protocol`) + implementação.
3. **Service:** teste em `tests/unit/services/` usando um **repository falso** (classe simples no teste)
   → regra de negócio. Erros de regra = exceções de `app/services/errors.py` (ex.: `NotFoundError`).
4. **Controller + schema:** teste em `tests/integration/controllers/` com `TestClient` e
   `app.dependency_overrides` → rota fina + schema de resposta.
5. **Ligação:** função `get_<x>_service` em `dependencies.py` e `include_router` em `main.py`.

## Regras das camadas

- **Controller:** só HTTP. Nada de regra de negócio, SQL ou cálculo. Recebe o service via `Depends`.
  Converte o model para schema na saída. Não captura erro de domínio: o `main.py` traduz
  (`NotFoundError` → 404). Endpoints de infraestrutura (ex.: `/api/health`) podem não ter service.
- **Service:** toda regra de negócio (motor de pontuação, ISNA, ranking etc.). Não importa FastAPI,
  Pydantic de HTTP nem driver de banco. Recebe o repository no construtor (tipo = o `Protocol`).
- **Repository:** só leitura e gravação (PostGIS, Parquet, YAML, APIs externas da NASA). Sem regra de
  negócio. Toda implementação segue o `Protocol` do contrato, para o service não saber de onde vem o dado.
- **Model:** dataclasses do domínio. **Schema:** Pydantic, só formato da API.
- **Rotas:** todas sob `/api` (o `include_router` usa `prefix="/api"`).

## Banco (PostgreSQL + PostGIS)

- Conexão só por `DATABASE_URL` (em `Settings`). No compose ela já aponta para `db:5432`.
  Fora do Docker: `postgresql://raiz:raiz_local@localhost:5433/raiz_orbital`.
- Só repositories falam com o banco. Coordenadas em SRID 4326, `ST_MakePoint(lon, lat)`.
- Testes unitários não usam o banco real. Testes que precisarem do banco ficam em
  `tests/integration/` e devem ser marcados e documentados quando forem criados.
- Ainda não há ORM nem migrações. Quando entrarem (sugestão: SQLAlchemy 2 + GeoAlchemy2 + Alembic +
  psycopg), registre a decisão no PR e atualize este arquivo.

## Comandos

Com uv (fora do Docker):

```bash
cd projeto/backend
uv sync                                   # cria .venv com Python 3.12 e instala tudo
uv run uvicorn app.main:app --reload      # API em http://localhost:8000/docs
uv run pytest                             # testes
uv run ruff check . && uv run ruff format .   # lint e formatação
```

Com Docker (a partir de `projeto/`):

```bash
docker compose up --build backend         # sobe também o banco
docker compose run --rm backend pytest
docker compose run --rm backend ruff check .
docker compose exec db psql -U raiz -d raiz_orbital   # console do banco
```

## Configuração e segredos

- Variável nova → campo em `Settings` (`app/config.py`) **e** o nome (sem valor real) em `.env.example`.
  Nunca leia `os.environ` espalhado pelo código; use `get_settings()`.
- Nunca escreva credencial no código, nem em teste.

## Dependências

- Adicionar: `uv add <pacote>` (produção) ou `uv add --dev <pacote>` (só desenvolvimento).
- Remover: `uv remove <pacote>`.
- **Nunca edite `requirements.txt` à mão.** Ele é gerado do `uv.lock` e mostra, de forma legível, o que
  a API usa em produção (com `# via` dizendo quem puxou cada pacote). O hook `uv-export` do pre-commit
  regenera o arquivo quando o `uv.lock` muda. Para gerar manualmente:

  ```bash
  uv export --frozen --format requirements-txt --no-dev --no-hashes --no-emit-project --no-header -o requirements.txt
  ```

- Commite juntos: `pyproject.toml`, `uv.lock` e `requirements.txt`.
- Dependência nova pesada (ex.: xarray, earthengine-api) → justifique na descrição do PR.
