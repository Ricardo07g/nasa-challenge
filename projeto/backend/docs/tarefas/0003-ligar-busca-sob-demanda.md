# Tarefa 0003: Ligar a busca sob demanda (PostGIS com a fixture como reserva)

- **Identificador:** `0003`
- **Título:** Ligar a busca sob demanda: PostGIS com `DATABASE_URL`, fixture como reserva
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R1.1 (Fase 1, trilha "Base de clima e solo"); depende do R1.2 ([tarefa 0002](0002-id-de-celula-unico.md)); destrava R1.5 e R5.2
- **Módulos Afetados:** `projeto/backend/app/dependencies.py`, `projeto/backend/app/services/` (`cell_lookup.py`, `talhao_service.py`, `recommendation_service.py`, `satellite_ingestion_service.py`), `projeto/backend/app/repositories/` (`climate_repository.py`, `soil_repository.py`), `projeto/backend/tests/integration/db/`
- **Referências:** [tarefa 0001](0001-ingestao-on-demand-dados-satelite.md), [roteiro de implementação](../roteiro-de-implementacao.md) (R1.1), PRD RNF-01, plano técnico §5

---

## 1. Descrição e Motivação

A tarefa 0001 trouxe os clientes do NASA POWER e do SoilGrids, os repositories do PostGIS e o serviço
que busca e grava células novas, mas tudo ficou desligado:

- o `dependencies.py` injetava só os repositories de arquivo;
- o `TalhaoService` só buscava quando o repository de clima tinha `save_cell_seasons` (`hasattr`), o que
  nunca acontecia;
- o `/recomendacao` não buscava: com o PostGIS ligado, um ponto novo daria `OUTSIDE_AREA` se o
  `/talhao` não tivesse sido chamado antes.

Ao ligar, apareceram defeitos que esta tarefa corrige junto:

- `PostgisClimateRepository.get_seasons` devolvia temporadas com `lat = 0,0` (o Hargreaves usa a
  latitude → ETo errada);
- `PostgisSoilRepository(fallback=None)` quebrava com `TypeError`;
- o solo padrão (`fonte: padrao`, quando o SoilGrids falha) era gravado e lido de volta como
  `soilgrids` (o `soil_point` não tem coluna de fonte);
- o limite de 9 s da ingestão não valia: o `with ThreadPoolExecutor` espera todas as threads ao sair, e
  o `soil_future.result()` não tinha `try`;
- sem clima nenhum (POWER fora e sem célula vizinha), a célula era gravada vazia e travava as próximas
  buscas.

---

## 2. Fluxo depois da tarefa

```
                 GET /api/talhao  ou  GET /api/recomendacao  (ponto lat, lon)
                                         │
                                         ▼
                 find_or_ingest_cell (services/cell_lookup.py)
                                         │
                 PostgisClimateRepository.find_cell_id(cell_id_for(lat, lon))
                     │ achou no banco          │ não achou
                     │                         ▼
                     │          fixture (reserva) cobre o ponto? ── sim ──► usa a fixture
                     │                         │ não
                     │                         ▼
                     │          SatelliteIngestionService.ingest_area (só existe com banco)
                     │            POWER ∥ SoilGrids, no máximo 9 s juntos
                     │            ├─ POWER ok → grava grid_cell + climate_season
                     │            ├─ POWER falhou → célula vizinha; sem vizinha → None (nada gravado)
                     │            └─ SoilGrids ok → grava soil_point; falhou → solo padrão, não gravado
                     ▼                         ▼
                 temporadas do banco (lat = centro da célula) → resposta
```

Sem `DATABASE_URL` (ou com ela vazia), nada muda: só arquivos e nenhuma busca sob demanda.

---

## 3. Sub-tarefas (TDD)

### Sub-tarefa 3.1: Repositories do PostGIS
- [x] `test_should_read_postgis_seasons_with_the_cell_center_latitude` (driver falso). Red: `assert 0.0 == -17.75`.
- [x] `test_should_fall_back_to_default_soil_when_postgis_has_no_point_and_no_fallback_given`. Red:
  `TypeError: CachedSoilGridsRepository.__init__() missing 1 required positional argument: 'cache_path'`.
- [x] Green: `get_seasons` usa `cell_center(cell_id)`; fallback `CachedSoilGridsRepository(None)`.

### Sub-tarefa 3.2: Ingestão com limite real e solo honesto
- [x] Testes em `tests/unit/services/test_satellite_ingestion_service.py`: solo padrão não gravado; falha
  do SoilGrids não derruba a ingestão; APIs travadas → termina em menos de 1 s com limite de 0,2 s;
  sem clima → devolve `None` e não grava.
- [x] Red: solo `padrao` gravado; `RuntimeError: SoilGrids fora do ar`; `TimeoutError` (e 5 s presos no
  `with`); `assert '-178_-510' is None`.
- [x] Green: executor sem `with` (`wait` até o limite e `shutdown(wait=False, cancel_futures=True)`),
  `result(timeout=0)` com `try` para os dois clientes, só grava solo com `fonte == "soilgrids"`, não
  grava célula sem temporadas. Protocolos explícitos `WritableClimateRepository` e
  `WritableSoilRepository` no lugar dos `hasattr`.

### Sub-tarefa 3.3: `/talhao` e `/recomendacao` encontram ou buscam a célula
- [x] `services/cell_lookup.py`: `find_or_ingest_cell` e `IngestionServiceProtocol` (`ingest_area -> str | None`).
- [x] Testes: `/talhao` busca sem depender de `save_cell_seasons`; não busca quando já há dado; ingestão
  sem clima → fora da área. `/recomendacao` busca ponto novo; não busca quando já há dado; ingestão sem
  clima → `OutsideAreaError`.
- [x] Red: `assert 0 == 1` (o `hasattr` barrava a busca) e `TypeError: RecommendationService.__init__()
  got an unexpected keyword argument 'ingestion_service'`.
- [x] Green: os dois services recebem a ingestão opcional e usam `find_or_ingest_cell`.

### Sub-tarefa 3.4: Ligação em `dependencies.py`
- [x] `tests/unit/test_dependencies.py`: com `DATABASE_URL`, PostGIS com reservas de arquivo e ingestão
  ligada; com `None` ou `""`, arquivos e ingestão `None`; com banco mas repositories que não gravam
  (testes das rotas), ingestão `None`.
- [x] Red: `isinstance(FixtureClimateRepository, PostgisClimateRepository)` falso e ingestão montada sem
  banco; sem a trava de tipo, ingestão montada com repositories de arquivo.
- [x] Green: `get_climate_repository`/`get_soil_repository` testam a veracidade de `database_url`;
  `get_satellite_ingestion_service` devolve `None` sem banco ou sem os repositories do PostGIS; o
  `RecommendationService` recebe a ingestão. Os testes das rotas desligam a ingestão de forma explícita.

### Sub-tarefa 3.5: Integração com o banco (marker `db`)
- [x] Marker `db` no `pyproject.toml`; `tests/integration/db/` roda só com `TEST_DATABASE_URL` (senão pula).
- [x] Fixture aplica `alembic upgrade head` no banco de teste (subprocesso) e esvazia as tabelas antes e
  depois de cada teste. POWER e SoilGrids falsos.
- [x] Cenários: ponto novo → `/talhao` e `/recomendacao` 200, `grid_cell`/`climate_season`/`soil_point`
  gravados e o 2º pedido sem chamar os clientes; `/recomendacao` antes do `/talhao`; solo padrão não
  gravado; sem clima nada gravado e 404 `OUTSIDE_AREA`; `/exemplo` pela fixture com o banco vazio.
  Repositories: id floor e bordas, polígono nos décimos, latitude do centro, solo ida e volta.
- [x] Red de integração: com o `dependencies.py` anterior, `AttributeError: 'CachedSoilGridsRepository'
  object has no attribute 'save_soil'` e `assert 404 == 200`.

### Sub-tarefa 3.6: Documentação
- [x] Seção "Dados da API" do `projeto/backend/AGENTS.md`: busca sob demanda + PostGIS, fixture como
  reserva e como rodar os testes `db`.

---

## 4. Critérios de Aceitação (Definition of Done)

1. Com `DATABASE_URL` não vazia, a API usa PostGIS com a fixture como reserva; sem banco, tudo como antes.
2. `/talhao` e `/recomendacao` de um ponto novo respondem 200 e gravam a célula; o segundo pedido não
   chama os clientes externos.
3. A ingestão termina dentro do limite total; falha do SoilGrids cai no solo padrão, que não é gravado.
4. Testes unitários sem rede e sem banco; testes `db` só com `TEST_DATABASE_URL`, com clientes falsos.
5. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.

## 5. Fora do escopo / riscos

- **Solo por ponto x clima por célula:** o SoilGrids só é consultado quando a célula é nova. Um segundo
  talhão na mesma célula (a mais de ~250 m do primeiro) fica com o solo padrão. Resolver pede buscar o
  solo do ponto quando ele não está no cache (com cuidado com a latência quando o SoilGrids está fora).
- **Célula vizinha como reserva (tarefa 0001):** quando o POWER falha, o clima da célula mais próxima
  já gravada (sem limite de distância) é copiado e gravado como se fosse da célula nova, e ela não é
  buscada de novo quando o POWER volta. Vale rever (limite de distância e/ou não gravar a cópia).
- **Threads que passam do limite:** a resposta sai no limite, mas a thread que travou continua até o
  timeout do cliente HTTP (8 s por tentativa, com retentativas). Python não mata threads.
- **Concorrência:** dois pedidos simultâneos para a mesma célula nova buscam duas vezes; o
  `ON CONFLICT ... DO UPDATE` evita erro de chave duplicada.
- `GRID_CELL_HALF_SIZE_DEG` e `EXAMPLE_CELL_ID` em `app/constants.py` seguem sem uso (ver tarefa 0002).
