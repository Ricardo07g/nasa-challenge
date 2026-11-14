# AGENTS.md: backend (API)

Complementa o `AGENTS.md` da raiz (leia primeiro: TDD obrigatório e arquitetura em camadas).
Aqui ficam só as regras da API.

O que falta implementar, em que ordem e o que pode ser feito em paralelo: `docs/roteiro-de-implementacao.md`.

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
  config_data/         culturas.yaml (parâmetros das culturas) e regras.yaml (limiares, pesos e
                       frases do motor), editáveis pela agrônoma
  fixtures/            clima da fazenda de exemplo (gerado pelo pipeline; ver "Dados da API")
pipeline/              scripts offline que preparam os dados (não entram na imagem da API)
tests/
  unit/services/       service com repository falso (sem banco, sem HTTP)
  unit/repositories/   repository isolado
  unit/pipeline/       funções do pipeline
  integration/controllers/  rotas via TestClient, com dependency_overrides (conftest.py tem os falsos)
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
- Migrações gerenciadas via **Alembic** (`migrations/`).
  No compose: o serviço `migration` executa automaticamente `alembic upgrade head` antes de iniciar a API.
  Para aplicar manualmente com Docker: `docker compose run --rm migration`
  Para aplicar com uv (fora do Docker): `uv run alembic upgrade head`
  Para ver SQL gerado sem rodar: `uv run alembic upgrade head --sql`
  Para criar nova migração: `uv run alembic revision -m "descricao"`
  Para popular dados iniciais dos satélites: `uv run python -m scripts.seed_db`
- Script DDL standalone também disponível em `scripts/init_db.sql`.

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

## Dados da API

- A API lê **só** o que está em `Settings` (`DATABASE_URL`, `CULTURAS_PATH`, `REGRAS_PATH`,
  `CLIMA_PATH`, `SOLO_CACHE_PATH`, `NDVI_CACHE_PATH`). Nunca coloque caminho fixo (como `/workspace/...`)
  num repository.
- `app/config_data/culturas.yaml`: parâmetros do PRD (seção 5 e nota de solo da 7.4).
- `app/config_data/regras.yaml`: limiares, pesos, rótulos e modelos de frase pt/en do motor (PRD 7),
  cada número com `valor` e `fonte` (o `YamlRulesRepository` recusa número sem fonte). Regra de
  negócio nova com número vai para lá, não para `app/constants.py`. Os services recebem as regras
  por parâmetro (padrão: este arquivo) e `dependencies.py` injeta as do `REGRAS_PATH`.
- **Com banco** (`DATABASE_URL` preenchida; `DATABASE_URL=` vazia vale como sem banco), o
  `dependencies.py` liga o PostGIS e a **busca sob demanda** (tarefas 0001 e 0003):
  - clima e solo vêm de `PostgisClimateRepository` e `PostgisSoilRepository`, com a fixture de clima
    e o cache de solo (`SOLO_CACHE_PATH`) como **reserva**. A fazenda de exemplo funciona com o banco vazio;
  - ponto sem célula no banco: `/talhao` ou `/recomendacao` (o que vier primeiro) chama o
    `SatelliteIngestionService`, que busca NASA POWER (20 anos) e SoilGrids em paralelo, no máximo
    `INGESTION_TOTAL_TIMEOUT_SECONDS` (9 s) juntos, e grava `grid_cell`, `climate_season` e `soil_point`.
    Os pedidos seguintes saem do banco;
  - POWER sem resposta no limite: usa a célula vizinha já gravada; sem nenhuma, não grava nada e o
    ponto fica fora da área (o próximo pedido tenta de novo);
  - SoilGrids com falha ou sem resposta: o ponto fica com o solo padrão (`fonte: padrao`), que **não é
    gravado** (o `soil_point` não tem coluna de fonte e tudo nele é lido como `soilgrids`);
  - id da célula: só `cell_id_for` (`floor` de lat/lon × 10, plano técnico §5). O polígono vai de
    `idx/10` a `(idx + 1)/10` e a latitude da série lida do banco é a do centro da célula.
- **Sem banco**, só arquivos, como antes: nada de busca sob demanda, solo padrão fora do cache e, fora da
  célula da fixture, a API responde que ainda não tem dados (`dentro_da_area: false` / 404 `OUTSIDE_AREA`).
- `app/fixtures/clima_fazenda_exemplo.json`: NASA POWER diário (chuva, máxima e mínima),
  1/jan a 31/jul de 2005 a 2024, da célula do POWER da Fazenda do Glória (UFU).
  Para gerar de novo a partir da saída do `data/extract_historical_20y.py`:

  ```bash
  uv run python -m pipeline.export_climate_fixture \
    --entrada ../../data/output/historico_uberlandia_20anos_diario.json \
    --saida app/fixtures/clima_fazenda_exemplo.json
  ```

- A pasta `data/output/` (dados brutos) **não vai para o git**. Só a fixture pequena e derivada
  acima fica no repositório (exceção prevista no plano técnico §5 e §11).
- **Nunca** use dado sintético com rótulo de fonte real (ex.: "NASA SMAP"). Sem dado real, a
  conta segue o PRD sem aquela fonte (balde começa em 50% da CAD; futuro `null` sem CMIP6).
- **NASA POWER sob demanda** (tarefas 0004 e 0005): o `NasaPowerClient` só traz a série bruta
  (`-999` vira `None`). O `ClimateSeasonBuilder` monta as temporadas de 212 dias desde 1/jan,
  tira o ano com algum dia sem chuva, máxima ou mínima, e calcula a ETo FAO-56 Penman-Monteith.
  Faltou UR, vento, radiação ou altitude: Hargreaves-Samani na temporada inteira.
- **Testes com banco** (marker `db`, em `tests/integration/db/`): rodam só com `TEST_DATABASE_URL`
  apontando para um banco **só de teste** com PostGIS (as tabelas são esvaziadas a cada teste); sem
  ela, são pulados. A fixture aplica `alembic upgrade head` nesse banco. POWER e SoilGrids são sempre
  falsos (nada de rede). Os testes das rotas em `tests/integration/controllers/` desligam a busca sob
  demanda (`get_satellite_ingestion_service` → `None`).

  ```bash
  # uma vez, com o compose rodando (a migração cria a extensão PostGIS)
  docker compose exec db createdb -U raiz raiz_orbital_test
  # da pasta projeto/backend
  TEST_DATABASE_URL=postgresql://raiz:raiz_local@localhost:5433/raiz_orbital_test uv run pytest -m db
  uv run pytest -m "not db"     # só os testes sem banco
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
