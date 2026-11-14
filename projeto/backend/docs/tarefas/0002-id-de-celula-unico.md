# Tarefa 0002: Um id de célula só (floor)

- **Identificador:** `0002`
- **Título:** Um id de célula só (floor) para ingestão, repositories e polígono
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R1.2 (Fase 1, trilha "Base de clima e solo"); destrava o R1.1 (tarefa 0003)
- **Módulos Afetados:** `projeto/backend/app/repositories/climate_repository.py`, `projeto/backend/app/services/satellite_ingestion_service.py`, `projeto/backend/scripts/seed_db.py`
- **Referências:** plano técnico do backend §5 (`id = "<floor(lat*10)>_<floor(lon*10)>"`, grade de 0,1° do IMERG), [roteiro de implementação](../roteiro-de-implementacao.md) (seção 5, decisão "Id da célula"), [tarefa 0001](0001-ingestao-on-demand-dados-satelite.md)

---

## 1. Descrição e Motivação

Conviviam duas regras de id de célula de 0,1°:

- `compute_grid_cell_id` (tarefa 0001), com `round`, usada só pela ingestão sob demanda;
- `cell_id_for` (plano técnico §5), com `floor`, usada pela fixture e pelos testes das rotas.

Para lat −18,92 uma dava −189 e a outra −190. Com o PostGIS ligado (R1.1), a ingestão gravaria a
célula com um id e os repositories procurariam por outro. O polígono gravado no `grid_cell` também
seguia o `round` (quadrado de ±0,05° em volta do décimo mais próximo), enquanto a fixture considera
a célula com bordas nos décimos (centro em `(idx + 0,5) / 10`).

**Decisão do time:** `floor`, por seguir o plano técnico §5 e a grade de 0,1° do IMERG.

---

## 2. O que mudou

```
ponto (lat, lon) ──► cell_id_for (floor) ──► "-190_-483"
                                            │
                     ┌──────────────────────┼───────────────────────┐
                     ▼                      ▼                       ▼
         SatelliteIngestionService   PostgisClimateRepository   FixtureClimateRepository
         (id da célula nova)         find_cell_id (busca pelo   (_covers_cell pelo centro)
                                     id) e save_cell_seasons
                                     (polígono e centro do id)
```

- `compute_grid_cell_id` saiu; `cell_id_for` é a única regra.
- Funções puras novas em `climate_repository.py`: `cell_center`, `cell_polygon_wkt` e
  `cell_center_wkt`. O polígono vai de `idx/10` a `(idx + 1)/10` e o centro fica em `(idx + 0,5)/10`.
- `PostgisClimateRepository.save_cell_seasons` monta a geometria a partir do id (não do ponto clicado),
  então o polígono sempre contém o ponto que gerou o id.
- `PostgisClimateRepository.find_cell_id` procura pelo id (`WHERE id = cell_id_for(lat, lon)`) em vez de
  `ST_Intersects`: um ponto exatamente na borda entre duas células não fica ambíguo.
- `scripts/seed_db.py` deriva o id (`SEED_CELL_ID`) e a geometria pelas mesmas funções
  (`"-189_-483"` passou a `"-190_-483"`).
- `docs/como-funcionam-os-dados-de-satelite-e-postgis.md` §3 descreve o `floor`.

---

## 3. Sub-tarefas (TDD)

### Sub-tarefa 2.1: Ingestão com o id floor
- [x] `tests/unit/services/test_satellite_ingestion_service.py`: Rio Verde (−17,78; −50,92) passa a
  `"-178_-510"`; teste novo para (−18,92; −48,27) → `"-190_-483"`, igual a `cell_id_for`.
- [x] Red: `AssertionError: assert '-178_-509' == '-178_-510'` e `assert '-189_-483' == '-190_-483'`.
- [x] Green: a ingestão usa `cell_id_for`.

### Sub-tarefa 2.2: Geometria e PostGIS pela mesma regra
- [x] `tests/unit/repositories/test_climate_repository.py`: centro, polígono com bordas nos décimos, ponto
  dentro do próprio polígono (inclusive nas bordas), busca do PostGIS pelo id floor e polígono/centro
  gravados (driver `psycopg` falso, sem banco).
- [x] Red: `ImportError: cannot import name 'cell_center'`.
- [x] Green: `cell_center`, `cell_polygon_wkt`, `cell_center_wkt`; `find_cell_id` e `save_cell_seasons`
  usam essas funções; `_covers_cell` da fixture reaproveita `cell_center`.

### Sub-tarefa 2.3: Script de carga inicial
- [x] `tests/unit/scripts/test_seed_db.py`: `SEED_CELL_ID == "-190_-483" == cell_id_for(SEED_LAT, SEED_LON)`.
- [x] Red: `ImportError: cannot import name 'SEED_CELL_ID'`.
- [x] Green: o script deriva id e geometria pelas funções do repository.

---

## 4. Critérios de Aceitação (Definition of Done)

1. **Uma regra só:** nenhum `round` de id de célula no backend; ingestão, repositories, polígono e seed
   usam `cell_id_for`.
2. **TDD:** cada comportamento com teste que falhou antes do código.
3. **Sem banco e sem rede nos testes unitários:** o driver do PostGIS é falso nos testes do repository.
4. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.

## 5. Fora do escopo / riscos

- `GRID_CELL_HALF_SIZE_DEG` e `EXAMPLE_CELL_ID` (`"-189_-483"`, com `round`) em `app/constants.py`
  ficaram sem uso. Não foram removidos aqui para não conflitar com as tarefas que mexem em
  `constants.py` (R4.1, R1.3/R1.4); podem sair quando aquele arquivo estiver livre.
- Banco local já populado com ids `round` (ex.: `"-189_-483"` do seed antigo) fica com células
  órfãs: a busca pelo id não as encontra mais. Basta recriar o banco local (`docker compose down -v`)
  ou apagar essas linhas.
