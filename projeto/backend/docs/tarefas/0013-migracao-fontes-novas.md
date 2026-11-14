# Tarefa 0013: Migração das fontes novas (CMIP6 mensal, NDVI com qualidade, SMAP por ponto, `data_run.version`)

- **Identificador:** `0013`
- **Título:** Migração R1.6: o banco no "Contrato dos dados das fontes" e o fim do `scripts/`
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R1.6 (Fase 1, trilha "Banco"); depende do R0.2 ([tarefa 0009](0009-token-earthdata-e-contrato-dados-fontes.md)); destrava R3.5 e a leitura do banco em R3.1, R3.2 e R3.3
- **Módulos Afetados:** `projeto/backend/migrations/versions/`, `projeto/backend/app/repositories/` (`cmip6_repository.py`, `ndvi_repository.py`, `smap_repository.py`, `data_run_repository.py`), `projeto/backend/tests/integration/db/`, `projeto/backend/scripts/` (removida), `projeto/docker-compose.yml`
- **Referências:** [roteiro de implementação](../roteiro-de-implementacao.md) (R1.6), "Banco" e "Contrato dos dados das fontes" no `projeto/backend/AGENTS.md`, plano técnico §5

---

## 1. Descrição e Motivação

A tarefa 0009 fixou o contrato dos dados das fontes novas (models e formato em arquivo) e propôs as
tabelas. O banco ainda estava no esquema da migração inicial (`cb6b775d83e3`), que não batia com ele:

- `cmip6_delta` era agregado (`aumento_temperatura_media_c`, `variacao_chuva_safrinha_pct`,
  `aumento_dias_calor_extremo`), sem modelo nem mês; o motor (`Cmip6Delta`) usa um delta por modelo e mês;
- `ndvi_point` não tinha produto (Terra/Aqua), qualidade nem o ponto (`geom`);
- o SMAP ficava em `smap_moisture`, por célula de 0,1°, mas o dado é por ponto;
- `data_run` não tinha a versão que o `versao_dados` vai mostrar (R3.5).

Além disso, `scripts/seed_db.py` usava caminho fixo (`/workspace/data/output`), gravava ETo fixa de
4,0 mm e o CMIP6 agregado antigo, e `scripts/init_db.sql` repetia o DDL das migrações.

---

## 2. Esquema depois da tarefa (revisão `6e961f333ddc`)

| Tabela | Colunas | Chave |
| --- | --- | --- |
| `cmip6_delta` | `cell_id text` (→ `grid_cell`, `ON DELETE CASCADE`), `model text`, `scenario text`, `month smallint`, `rain_pct real`, `tmax_c real`, `tmin_c real` (pode ser nulo) | `(cell_id, model, scenario, month)` |
| `ndvi_point` | `key text`, `geom geometry(Point, 4326)`, `date date`, `product text`, `ndvi real`, `quality smallint` (índice GIST em `geom`) | `(key, date, product)` |
| `smap_point` | `key text`, `geom geometry(Point, 4326)`, `date date`, `sm_rootzone_wetness real`, `sm_rootzone_m3_m3 real`, `sm_surface_m3_m3 real` (pode ser nulo) (índice GIST em `geom`) | `(key, date)` |
| `data_run` | `id serial`, `source text`, `params jsonb`, `finished_at timestamptz`, `version text` | `id` |

Só as colunas marcadas aceitam nulo. `grid_cell`, `climate_season` e `soil_point` não mudam. A
`smap_moisture` deixa de existir. As cargas gravadas em `data_run` antes da migração ficam com
`version = 'sem-versao'`. O `downgrade` volta ao esquema inicial e apaga o que houver nas tabelas novas.

---

## 3. Sub-tarefas (TDD)

### Sub-tarefa 3.1: Migração
- [x] `tests/integration/db/test_migracao_fontes_novas.py` (marker `db`): colunas, tipos e nulos de
  cada tabela; chaves primárias; `smap_moisture` trocada por `smap_point`; `geom` em `POINT`/4326 com
  índice GIST; chave estrangeira do `cmip6_delta` para `grid_cell`; `downgrade -1` volta ao esquema
  inicial e `upgrade head` sobe de novo; carga antiga de `data_run` ganha `version = 'sem-versao'`.
- [x] Red (12 de 13; a chave estrangeira já existia): `assert ['cell_id', 'scenario'] == ['cell_id',
  'model', 'scenario', 'month']`, `assert ['key', 'date'] == ['key', 'date', 'product']`, `assert {}
  == {...}` (sem `smap_point`), `psycopg.errors.UndefinedColumn: column "version" does not exist`.
- [x] Green: `migrations/versions/6e961f333ddc_contrato_das_fontes_novas_r1_6.py` (SQL puro, como a
  migração inicial), com `downgrade`. A lista de tabelas esvaziadas pelos testes `db` troca
  `smap_moisture` por `smap_point`, e o subprocesso do alembic vai para `support.run_alembic`.

### Sub-tarefa 3.2: Repositories das tabelas novas
- [x] `tests/integration/db/test_fontes_novas_repositories.py`: cada tabela aceita e devolve um registro
  do seu contrato (`Cmip6Delta` com e sem `tmin_c`, `NdviRecord` dos dois produtos na mesma data,
  `SmapSoilMoisture` com e sem a camada de superfície, `DataRun` com `params` e fuso), regrava a mesma
  chave, grava `key` = `point_key` e o ponto em 4326, e `get_latest_run` devolve a carga mais recente.
- [x] Red: `ModuleNotFoundError: No module named 'app.repositories.cmip6_repository'` (e o mesmo para
  `smap_repository` e `data_run_repository`); `ImportError: cannot import name 'PostgisNdviRepository'`.
- [x] Green: `PostgisCmip6Repository`, `PostgisNdviRepository` (com o protocolo
  `WritableNdviRepository`), `PostgisSmapRepository` e `PostgisDataRunRepository`, cada um com o seu
  `Protocol`. **Nenhum é ligado na API**: o `PostgisClimateRepository` continua repassando CMIP6 e SMAP
  à reserva, e o NDVI continua vindo do cache em arquivo.

### Sub-tarefa 3.3: Aposentar `scripts/`
- [x] Removidos `scripts/seed_db.py`, `scripts/init_db.sql` e `tests/unit/scripts/test_seed_db.py`.
- [x] A pasta ficou vazia: sai a linha `./backend/scripts:/app/scripts` do `projeto/docker-compose.yml`.

### Sub-tarefa 3.4: Documentação
- [x] Seção "Banco" do `projeto/backend/AGENTS.md`: tabelas e quem grava cada uma, esquema só por
  migração, sem `scripts/`, e como subir um banco criado antes do R1.6.
- [x] "Contrato dos dados das fontes": "coluna nova no R1.6" e "Tabela (R1.6)" viram "criada no R1.6";
  sai a menção ao `scripts/seed_db.py`.

---

## 4. Critérios de Aceitação (Definition of Done)

1. `alembic upgrade head` leva um banco da migração inicial ao esquema da seção 2; `downgrade -1`
   volta e `upgrade head` sobe de novo.
2. Cada tabela nova aceita e devolve um registro do contrato pelos repositories.
3. Nada muda na API: as rotas leem as mesmas fontes de antes.
4. Testes `db` só com `TEST_DATABASE_URL`; sem ela, são pulados.
5. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.

## 5. Fora do escopo / riscos

- **Bancos já criados precisam de `alembic upgrade head`.** No compose o serviço `migration` faz isso
  sozinho. As tabelas trocadas eram vazias (nenhum código da API gravava nelas); quem rodou o seed
  antigo perde o CMIP6 agregado e o SMAP por célula que ele gravou.
- **`data_run.version` é obrigatória.** Um script que grave em `data_run` sem a versão (por exemplo, a
  pré-carga do R1.5, se escrita contra o esquema antigo) passa a falhar: use o
  `PostgisDataRunRepository.save_run` com um `DataRun`.
- **`cmip6_delta` exige a célula em `grid_cell`.** A carga dos deltas (R2.1 + R3.1) só grava células
  que já existem (pré-carga do R1.5 ou busca sob demanda). Os deltas valem para a célula do POWER
  (0,5°); repetir os mesmos deltas em cada célula de 0,1° dela, e o que fazer com uma célula nova da
  busca sob demanda, é decisão do R3.1.
- **Sem `CHECK` no banco.** As faixas do contrato (mês 1 a 12, qualidade 0 ou 1, produto, umidade de
  0 a 1) são validadas pelos models, na gravação (o repository recebe o model) e na leitura. O
  `NdviRecord` ainda aceita o NDVI bruto (por causa do cache antigo), então nada impede gravar o bruto
  (×10.000) em `ndvi_point`: o script do R2.2 tem de gravar o físico, como manda o contrato.
- **`real` no banco:** os valores voltam com a precisão de `float4` (1,6 vira 1,6000000238).
- O diagrama ER de `docs/diagrama-de-classes.md` (seção 7) ainda mostra o esquema da migração inicial.
