# Tarefa 0012: Pré-carga da caixa piloto e da fazenda de exemplo

- **Identificador:** `0012`
- **Título:** Pré-carregar no PostGIS o clima (NASA POWER) e o solo (SoilGrids) da caixa piloto
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R1.5 (Fase 1, trilha "Base de clima e solo"); depende do R1.1 ([tarefa 0003](0003-ligar-busca-sob-demanda.md)) e usa o `data_run` do R1.6 ([tarefa 0013](0013-migracao-fontes-novas.md)); destrava R5.1 e R5.2
- **Módulos Afetados:** `projeto/backend/pipeline/preload_pilot_box.py`, `projeto/backend/app/repositories/soil_repository.py`, `projeto/backend/app/repositories/climate_repository.py` (`cell_bounds`), `projeto/backend/tests/unit/pipeline/`, `projeto/backend/tests/integration/db/`
- **Referências:** [roteiro de implementação](../roteiro-de-implementacao.md) (R1.5), PRD RNF-01, plano técnico §5, ADR-0003 (caixa piloto)

---

## 1. Descrição e Motivação

Com a busca sob demanda ligada (tarefa 0003), o primeiro clique num ponto novo espera o NASA POWER
(20 anos) e o SoilGrids, até 9 s. Para a caixa piloto (lat −19,9 a −18,4; lon −49,0 a −47,5) isso
não precisa acontecer: o script `pipeline/preload_pilot_box.py` grava antes, no PostGIS, o clima e o
solo das 225 células de 0,1° da caixa, com a da fazenda de exemplo (−18,9543 / −48,1993) primeiro.

Ao olhar o solo, apareceu um buraco: o `PostgisSoilRepository.get_soil` só achava o solo pela chave
exata do ponto (0,0025°, ~250 m). O solo pré-carregado no centro da célula não serviria para o talhão
clicado em outro lugar dela, que ficaria com o solo padrão.

---

## 2. Decisões

### 2.1 Um pedido ao POWER por região onde ele responde igual

O roteiro previa agrupar pela célula do POWER de 0,5° × 0,625° (9 a 12 pedidos). Antes de fechar,
pedidos de 2 dias ao POWER (14/11/2026) mostraram que:

- a meteorologia (chuva, temperaturas, UR, vento e a altitude) segue mesmo a grade do MERRA-2 de
  0,5° × 0,625°, com centros nos múltiplos do passo (a `cobertura` da fixture). Exemplo: −18,76 e
  −18,74 devolvem temperaturas e altitudes diferentes (849,71 m × 727,59 m);
- um ponto na borda fica na célula de cima (ou a leste): −18,75 devolve o mesmo que −18,74;
- a radiação (`ALLSKY_SFC_SW_DWN`) segue **outra grade, de 1° com bordas nos graus inteiros**: −19,1
  e −18,9 (mesma célula de meteorologia) devolvem radiações diferentes (16,12 × 9,79 MJ/m² no mesmo
  dia), e −18,76/−48,0 devolve a mesma radiação que −18,5/−47,2.

A ETo de Penman-Monteith (tarefa 0004) usa a radiação. Por isso a região do POWER é a célula de
meteorologia **cruzada** com a de radiação (`power_region_key`): 225 células caem em **20 regiões**,
um pedido por região, no centro dela. Assim o que a pré-carga grava para cada célula de 0,1° é o
que o POWER devolveria no centro dela. As temporadas de cada célula são montadas com a latitude do
centro (a mesma que o `PostgisClimateRepository.get_seasons` devolve).

### 2.2 Solo: o ponto mais próximo da mesma célula

Ordem do `PostgisSoilRepository.get_soil` (uma ida ao banco):

1. o ponto exato (chave de 0,0025°) no banco;
2. o ponto exato no cache de arquivo (`SOLO_CACHE_PATH`), como antes;
3. o ponto gravado **mais próximo dentro da mesma célula de 0,1°** (intervalo meio aberto, como o
   `floor` do id: ponto de célula vizinha nunca entra, mesmo mais perto);
4. o solo padrão (`fonte: padrao`).

O solo continua `fonte: soilgrids` no passo 3: é dado real do SoilGrids, de um ponto a no máximo
~15 km (a diagonal da célula). É melhor que o padrão para o balde (CAD) e coerente com o clima, que já
é por célula. A pré-carga grava o centro de cada célula e, na da fazenda de exemplo, também o ponto
exato dela.

### 2.3 Idempotência, pausa e `data_run`

- Pula a célula que já tem clima (`find_cell_id` no PostGIS **sem** a fixture como reserva) e o ponto
  que já tem solo (`has_point`, chave exata). `--forcar` busca tudo de novo.
- Pausa configurável entre os pedidos ao SoilGrids (`--pausa-solo`, padrão 12 s: o ISRIC pede cerca
  de 5 pedidos por minuto). O POWER não tem pausa (20 pedidos em sequência).
- Clima antes do solo: a caixa fica usável nos primeiros minutos.
- Uma linha em `data_run` por fonte chamada (`nasa_power`, `soilgrids`), gravada pelo
  `PostgisDataRunRepository.save_run` do R1.6 logo ao fim da fase de cada fonte (se o solo parar no
  meio, a carga do clima já ficou registrada). Versão: `<ano>.<mês>-preload-pilot-box`. Execução sem
  nada para buscar não grava linha.
- Timeouts mais longos que os da busca sob demanda (120 s no POWER, 30 s no SoilGrids): a pré-carga
  não tem a pressa do clique.

---

## 3. Sub-tarefas (TDD)

### Sub-tarefa 3.1: Solo da célula no PostGIS
- [x] `tests/integration/db/test_solo_da_celula.py` (marker `db`): solo gravado em outro lugar da
  célula; o mais próximo de dois; célula vizinha mais perto não entra; o ponto exato do cache de
  arquivo ganha do resto da célula; `has_point` olha só a chave exata.
- [x] `test_should_give_cell_bounds_on_the_tenths` (unitário).
- [x] Red: `AssertionError: assert SoloInfo(argi...onte='padrao') == SoloInfo(argi...e='soilgrids')`,
  `AttributeError: 'PostgisSoilRepository' object has no attribute 'has_point'` e
  `ImportError: cannot import name 'cell_bounds' from 'app.repositories.climate_repository'`.
- [x] Green: `get_soil` com uma consulta (ponto exato primeiro, senão o mais próximo da célula pelo
  `<->`), `has_point`, `cell_bounds` (reaproveitado pelo `cell_polygon_wkt`).

### Sub-tarefa 3.2: Script de pré-carga
- [x] `tests/unit/pipeline/test_preload_pilot_box.py`, com clientes e repositories falsos: 225
  células com a da fazenda primeiro e o solo do ponto dela; região do POWER (limites, borda, corte
  da radiação, 20 regiões); um pedido por região e cada célula com a sua latitude; POWER com falha
  não copia vizinha; pausa só entre os pedidos ao SoilGrids; solo padrão não gravado; pula o que já
  está no banco, `--forcar`, `--limite`; `data_run` por fonte (e nenhum sem chamada; o do POWER antes
  da fase do solo); `--dry-run` sem banco não chama nada; sem `DATABASE_URL` recusa a carga.
- [x] Red: `ImportError: cannot import name 'preload_pilot_box' from 'pipeline'`. Depois do rebase
  sobre o R1.6: `AttributeError: 'FakeDataRunRepository' object has no attribute 'save'` (troca para o
  `save_run`) e `AssertionError: assert [] == ['nasa_power']` (registro do POWER antes do solo).
- [x] Green: `pipeline/preload_pilot_box.py` (`pilot_box_cells`, `power_region_key`,
  `group_by_power_region`, `PilotBoxPreloader.plan/run`, CLI). Um repository próprio de `data_run`
  chegou a ser escrito e saiu no rebase: o R1.6 trouxe o `PostgisDataRunRepository`.

### Sub-tarefa 3.3: Integração com o banco (marker `db`)
- [x] `tests/integration/db/test_pre_carga.py`: depois da pré-carga da célula da fazenda, `/talhao`
  e `/recomendacao` num ponto qualquer da célula respondem 200 com solo `soilgrids` **sem chamar** o
  POWER nem o SoilGrids; segunda execução não busca nada; SoilGrids com falha não grava solo.

### Sub-tarefa 3.4: Documentação
- [x] "Dados da API" do `projeto/backend/AGENTS.md`: ordem do solo e como rodar a pré-carga (tempo,
  fontes abertas, idempotência, `data_run`).

---

## 4. Critérios de Aceitação (Definition of Done)

1. `--dry-run` mostra 225 células, 20 pedidos ao POWER e 226 ao SoilGrids, sem chamar nada.
2. Depois da pré-carga, um ponto qualquer de uma célula carregada responde sem busca sob demanda e
   com o solo da célula.
3. Rodar de novo não repete pedidos; o solo padrão nunca é gravado; cada fonte chamada fica em
   `data_run`.
4. Testes sem rede; testes `db` só com `TEST_DATABASE_URL`.
5. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.

---

## 5. Números

```text
$ uv run python -m pipeline.preload_pilot_box --dry-run
Caixa piloto: 225 células de 0,1° (com a da fazenda de exemplo); 0 já estão completas no banco.
Clima: 225 células em 20 pedidos ao NASA POWER (um por região do POWER).
Solo: 226 pedidos ao SoilGrids, com pausa de 12 s entre eles (cerca de 45 min só de pausa).
```

Conferência de ponta a ponta com `--limite 1` num banco de teste (14/11/2026): 1 pedido ao POWER
(20 temporadas de 212 dias, ETo Penman-Monteith), 2 ao SoilGrids (os dois argilosos), 2 linhas em
`data_run`, 38 s no total (o primeiro pedido ao SoilGrids levou ~20 s).

---

## 6. Fora do escopo / riscos

- **Fazenda de exemplo:** depois da pré-carga, a célula `-190_-482` sai do banco (POWER de agora, com
  Penman-Monteith), não mais da fixture. Os números do `/exemplo` podem mudar um pouco.
- **Solo da célula:** um ponto pode receber o solo de outro a até ~15 km dentro da célula. Célula
  em que o SoilGrids não tem dado no centro (cidade, água) fica com o padrão para todo talhão dela,
  porque a busca sob demanda não roda em célula que já tem clima (risco que já estava na tarefa 0003).
- **Entre as fases:** quem clicar depois do clima e antes do solo da sua célula recebe o solo padrão.
- **Grade do POWER:** as grades (meteorologia e radiação) foram conferidas por amostra. Se o POWER
  mudar a grade, o agrupamento fica mais grosso ou mais fino que o necessário; o dado gravado continua
  sendo o do pedido.
- **Plano:** o `plan` abre uma conexão por consulta (até ~450). Local, ~15 s; num banco remoto, pode
  levar alguns minutos. Uma consulta em lote resolveria, mas mexe em `climate_repository.py`.
- **ISRIC:** 429 ou lentidão do SoilGrids caem nas retentativas do `http_client` (2, com espera curta)
  e o ponto fica sem solo; rodar de novo completa.
