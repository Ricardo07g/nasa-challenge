# Tarefa 0050: NDVI por área (a série de qualquer ponto da caixa, não só de 4 pontos)

- **Identificador:** `0050`
- **Título:** NDVI do MODIS por área, em ladrilhos compactados: script `fetch_ndvi_area` pela ORNL DAAC, `GridNdviRepository` e o NDVI do talhão em camadas (arquivo por ponto, depois a grade)
- **Status:** Concluída (o download real fica para o usuário rodar)
- **Prioridade:** Alta (decisão do usuário de 15/11/2026)
- **PRD:** RF-34
- **Módulos Afetados:** `pipeline/fetch_ndvi_area.py`, `app/repositories/ndvi_grid_repository.py`, `app/repositories/ndvi_repository.py`, `app/config.py`, `app/dependencies.py`, `.env.example`, `projeto/docker-compose.yml`, `AGENTS.md`, `docs/como-preparar-os-dados-locais.md`
- **Referências:** [tarefa 0024](0024-ndvi-pela-ornl.md) (modo por ponto pela ORNL), [tarefa 0037](0037-soja-recente.md) (ladrilhos na grade global do MODIS), `AGENTS.md` do backend ("Dados da API" → "NDVI por área" e "Contrato dos dados das fontes" → "NDVI por área")

---

## 1. Descrição e motivação

O histórico do satélite (faixa de cores de 10 anos, "Verde da lavoura" do raio-X, colheita sugerida,
"Como é hoje" do plano) só existia para os **4 pontos** do arquivo do NDVI por ponto
(`NDVI_CACHE_PATH`). Em qualquer outro talhão, a API respondia `historico: null`. O usuário decidiu
(15/11) baixar o NDVI de uma **área inteira**. Decisão final do mesmo dia: a área do produto não vai
crescer; o NDVI por área cobre a caixa atual (`PILOT_*`, Uberlândia e Uberaba). O plano de crescer
por etapas até o Triângulo inteiro (grade fixa, índice que acumula) foi abandonado antes de ser
feito.

### O que é o mesmo do modo por ponto

Mesma janela (1/jan a 31/jul dos anos do `historico_ndvi`, 2017 a 2026), mesmos produtos (MOD13Q1 e
MYD13Q1, coleção 061), mesmas bandas (`250m_16_days_NDVI` e `250m_16_days_pixel_reliability`),
mesma escala (0,0001, 4 casas) e mesmo filtro (qualidade 0 ou 1, NDVI bruto de −2000 a 10000, sem o
−3000). Um teste de paridade roda os dois scripts contra a mesma ORNL falsa e confere que os dois
pixels dão os **mesmos `NdviRecord`** pelo `CachedNdviRepository` e pelo `GridNdviRepository`.

### Plano dos pedidos

- **Ladrilhos:** os da soja recente (`plan_tiles`): ±30 km pedidos = 241 × 241 pixels de 231,66 m,
  lado a lado a partir do canto noroeste da área, na grade global do MODIS. Caixa atual: janela de
  721 × 880 pixels, **12 ladrilhos**.
- **Ordem:** do centro da área para fora (distância em pixels até o pixel do centro). Se o download
  parar, o miolo fica pronto primeiro.
- **Pedidos por ladrilho:** 10 anos × 2 produtos × 2 pedidos × 2 bandas = **80**. As 14 datas do
  Terra e as 13 do Aqua de cada ano vão em **pedidos equilibrados** (7 + 7 e 7 + 6), não 10 + 4: o
  mesmo número de pedidos, mas o maior tem 7 datas (o proxy da ORNL corta em ~60 s).
- **Caixa atual:** 12 × 80 = **960 pedidos**, ~5,3 h com 2 em paralelo pelo `--dry-run` (~40 s por
  pedido, a medida da soja recente com 241 × 241 pixels, sem contar 502 e novas tentativas).
- **Triângulo (o pedido original, conferido e arquivado):** lat −20,5 a −17,9 e lon −51,1 a −47,0 dá
  1249 × 2210 pixels, 6 × 10 = **60 ladrilhos × 80 = 4.800 pedidos** (~27 h com 2 em paralelo). Só
  54 deles tocam a área de verdade (o retângulo de lat/lon vira um trapézio na projeção sinusoidal e
  6 cantos da janela ficam fora); como a área não cresce, o corte não foi feito.

### Retomada

- Cada resposta é **conferida antes de entrar no cache** (`cache_ornl/<ladrilho>/<produto>_<banda>_<início>_<fim>.json.gz`):
  a banda pedida, a grade global (pixel de 231,66 m, alinhado, conferido pelo `_tile_origin`), o
  centro do ladrilho dentro do recorte e só datas do pedido. Data que não veio: aviso no log, e ela
  fica sem observação.
- O cache é lido **por data** (as composições entre o início e o fim do nome do arquivo): mudar o
  `--datas-por-pedido` entre execuções não perde nada.
- O ladrilho fica **pronto** quando é compactado (`ladrilhos/<ladrilho>.bin`, gravado de uma vez) e
  o índice é **regravado a cada ladrilho pronto**: os pontos dos ladrilhos prontos já funcionam na
  API (depois de reiniciar o backend). Ladrilho com o cabeçalho de outras datas (outro `--anos`) é
  refeito.
- Falha num pedido (depois das `--tentativas`): o ladrilho para ali e fica para a próxima execução;
  3 ladrilhos seguidos sem resposta param a execução (a ORNL caiu). Saída 2 = rode de novo.
- `--apagar-cache` apaga o cache bruto de cada ladrilho depois de compactá-lo.

---

## 2. Decisões de formato (com os tamanhos medidos)

Só biblioteca padrão (`array`, `struct`, `zlib`): o backend não tem numpy e não ganhou dependência.

- **Índice JSON** (`ndvi_modis_area.json`, o `NDVI_AREA_PATH`): `versao_dados` (fonte
  `modis_mod13q1`, versão `AAAA.MM-modis-ndvi-area`, como os outros arquivos), `formato`, `fonte`,
  `fator_escala`, `grade` (grade global do MODIS), `datas` (`[data, produto]`, a ordem dos
  ladrilhos), `area` e `ladrilhos` (arquivo, pixel global do canto noroeste, linhas, colunas,
  centro, bytes).
- **Um arquivo binário por ladrilho**, e não o ladrilho em base64 dentro do JSON: base64 é 33%
  maior e o JSON teria de ser lido inteiro.
- **Cabeçalho** com a posição na grade, o tamanho, o número de datas e o **CRC32 da lista de datas e
  produtos** (o ladrilho só vale com as datas do índice), e a tabela de onde começa cada bloco.
- **Blocos de 8 linhas** comprimidos com zlib (nível 6). Dentro do bloco, data a data: o byte alto do
  NDVI bruto (int16), o byte baixo e a qualidade (uint8). Sem observação boa: NDVI −32768 e
  qualidade 255 (o filtro é aplicado na compactação). Ler um ponto descomprime só o bloco do pixel.

Medição com o **NDVI real da região** (o cache da tarefa 0036: 265 × 265 pixels, 243 datas de
2017 a 2025, só leitura), em bytes por pixel e data, levada a um ladrilho de 241 × 241 × 270:

| Arranjo | Byte por valor | Ladrilho | 12 ladrilhos | 60 ladrilhos |
| --- | --- | --- | --- | --- |
| int16 cru, 1 linha por bloco | 1,71 | 26,8 MB | 322 MB | 1,61 GB |
| bytes separados (alto, baixo), 1 linha | 1,54 | 24,2 MB | 290 MB | 1,45 GB |
| **bytes separados + qualidade à parte, 8 linhas (o adotado)** | **1,48** | **23,3 MB** | **280 MB** | **1,40 GB** |
| o mesmo com 16 linhas | 1,48 | 23,1 MB | 277 MB | 1,39 GB |
| delta com o pixel ao lado + bytes separados | 1,45 | 22,8 MB | 274 MB | 1,37 GB |

O delta (no tempo ou no espaço) ganhou só ~5% e complicaria a leitura: ficou de fora. O NDVI de
16 dias é ruidoso (~11 bits por valor); 94% das leituras da região eram boas.

**Ladrilho sintético de tamanho real** (scratch, nunca em `data/`): 241 × 241 pixels × 270 datas com
curva da soja, ruído e nuvem deu **24,7 MB** (1,57 byte por valor; o ruído inventado comprime pior
que o real); com NDVI aleatório (o pior caso), 28,2 MB. Caixa atual: **~280 a 340 MB** de
ladrilhos, mais até ~380 MB de cache bruto (~2,0 bytes por valor no gzip da ORNL) se não usar
`--apagar-cache`.

- **Ler um ponto:** 1 a 2 ms a frio (índice + um bloco de ~1,5 MB), 0,2 ms no mesmo bloco; o limite
  pedido era 200 ms. O `GridNdviRepository` guarda os últimos 8 blocos (~12 MB) num LRU.
- **Compactar um ladrilho** a partir das 80 respostas: ~5 s e ~200 MB de memória a mais no pico.

### Busca de um ponto

`GradeSinusoidal.pixel_at` em cada ladrilho do índice; entre os que contêm o pixel, o de **centro
mais perto** (a maior distância entre linhas e colunas, depois a reta; empate, o primeiro do
índice). Os ladrilhos do script não se sobrepõem, mas o leitor aceita sobreposição. Fora de todos,
sem índice ou com o ladrilho faltando no disco: série vazia (com aviso no log no último caso).
Índice ou ladrilho fora do contrato: `ValueError`.

### Na API

`get_ndvi_repository` (`dependencies.py`): com `NDVI_AREA_PATH`, um `LayeredNdviRepository` com o
arquivo por ponto primeiro (pontos exatos, a até 250 m) e a grade depois; sem a variável, só o
arquivo por ponto, como antes. Sem o índice no disco, o app se comporta como hoje. Os services
(`talhao_service`, `raio_x_service`, `recommendation_service`, `field_history_service`) não mudaram:
continuam chamando `get_ndvi_history(lat, lon)`. O `get_data_run` do `GridNdviRepository` vem do
`versao_dados` do índice.

---

## 3. Fluxo

```
pipeline/fetch_ndvi_area.py (offline, ORNL, sem credencial)
  plan_area_tiles(área, km): plan_tiles (241 × 241) ─► ordem do centro para fora
  por ladrilho, até --paralelo ao mesmo tempo:
     pronto (ladrilhos/<r>_<c>.bin com as mesmas datas)? pula
     tile_requests (só as datas fora do cache, 7 + 7 / 7 + 6) ─► OrnlClient ─► check_subset ─► TileCache
     compact_tile (filtro do modo por ponto) ─► encode_tile ─► .bin ─► índice regravado

GET /api/talhao, /api/raio-x, /api/recomendacao ─► services ─► get_ndvi_history(lat, lon)
  LayeredNdviRepository
     ├─ CachedNdviRepository (NDVI_CACHE_PATH, ponto a até 250 m)
     └─ GridNdviRepository (NDVI_AREA_PATH): ladrilho de centro mais perto ─► bloco do pixel (LRU)
```

---

## 4. Sub-tarefas (TDD)

### 4.1 Formato e `GridNdviRepository`
- [x] Testes em `tests/unit/repositories/test_ndvi_grid_repository.py` (ladrilhos sintéticos
  pequenos de `tests/ndvi_grid_fakes.py`): cabeçalho, CRC das datas, camadas do tamanho errado,
  arquivo que não é ladrilho, série do pixel do ponto, data sem observação, os 4 cantos, logo fora
  dos 4 lados, fora da área, pixel em cada bloco (último bloco menor), ladrilho de centro mais perto
  na sobreposição, só o ladrilho do ponto é aberto, LRU limitado, ladrilho de outras datas, sem
  índice, `get_data_run`, contrato do índice.
- [x] Red: `ModuleNotFoundError: No module named 'app.repositories.ndvi_grid_repository'`.
- [x] Green: `encode_tile`, `read_tile_header`, `dates_checksum`, `index_from_json` e
  `GridNdviRepository`.

### 4.2 Camadas e ligação
- [x] Testes em `tests/unit/repositories/test_ndvi_repository.py` (ponto exato do arquivo antes da
  grade, a grade onde o arquivo não tem ponto, nenhuma camada), `tests/unit/test_config.py`,
  `tests/unit/test_dependencies.py` (com e sem banco; sem a variável, só o arquivo por ponto) e
  `tests/integration/controllers/test_talhao_controller.py` (`/api/talhao` de um ponto coberto só
  pela grade traz o `historico` e a colheita sugerida, pela ligação real do `dependencies.py`; fora
  da grade, `historico: null`).
- [x] Red: `ImportError: cannot import name 'LayeredNdviRepository'`, `AttributeError: 'Settings'
  object has no attribute 'ndvi_area_path'` e a ligação devolvendo só o `CachedNdviRepository`. O
  teste de rota foi escrito depois da ligação; conferido que ele falha sem ela.
- [x] Green: `LayeredNdviRepository`, `ndvi_area_path` (`NDVI_AREA_PATH`) e `get_ndvi_repository`.

### 4.3 Script
- [x] Testes em `tests/unit/pipeline/test_fetch_ndvi_area.py` (HTTP falso): calendário igual ao do
  modo por ponto, pedidos equilibrados, limite de 10 datas, 12 ladrilhos do centro para fora, 80
  pedidos por ladrilho, só as datas fora do cache, cache lido pelo nome, `--dry-run` (960 pedidos,
  5,3 h, nada pedido nem gravado; ladrilhos prontos e pedidos no cache), área padrão, download +
  compactação + índice + retomada sem pedido, primeiro pedido no ladrilho do centro, retomada no
  meio do ladrilho, índice regravado a cada ladrilho, outro `--datas-por-pedido`, `--apagar-cache`,
  resposta fora do formato (banda trocada, fora da grade) não entra no cache, para depois de 3
  ladrilhos sem resposta, e a **paridade com o modo por ponto**.
- [x] Red: `ModuleNotFoundError: No module named 'pipeline.fetch_ndvi_area'`. Depois do verde,
  conferido que os testes pegam o filtro trocado (qualidade 2 aceita), o cache ignorado e a ordem
  sem o centro.
- [x] Green: `pipeline/fetch_ndvi_area.py`.

### 4.4 Documentação
- [x] Esta tarefa, o RF-34 no PRD, `docs/como-preparar-os-dados-locais.md` (tabela de dados e de
  comandos) e o `AGENTS.md` do backend.

---

## 5. Critérios de aceitação

1. Um ponto qualquer dos ladrilhos prontos tem `historico` no `/api/talhao` (e a faixa, o verde e a
   colheita sugerida), com os mesmos registros que o modo por ponto daria para o pixel.
2. Sem `NDVI_AREA_PATH` ou sem o índice, a API se comporta como antes.
3. O script retoma de onde parou e o `--dry-run` não pede nada à ORNL.
4. Nada de rede real nem dado inventado em `data/`.
5. `uv run pytest` (com e sem `TEST_DATABASE_URL`), `uv run ruff check .`, `uv run ruff format
   --check .` e `pre-commit run --all-files` passando.

---

## 6. Fora do escopo e riscos

- **Download real:** não foi rodado aqui. Comando, de `projeto/backend`:
  `uv run python -m pipeline.fetch_ndvi_area --paralelo 2` (antes, `--dry-run`).
- **Tempo:** a estimativa usa 40 s por pedido sem 502. Na rodada do NDVI por ponto (14/11) a média
  real foi ~85 s por pedido com os 502 e as novas tentativas; se for assim, ~11 h com 2 em
  paralelo. Pedidos de área de 7 datas não foram medidos (a soja recente mediu 241 × 241 × 8 datas
  em 24 s; a área queimada deu 502 com 6 a 10 datas de ±30 km num dia ruim). Se der muito 502,
  baixe `--datas-por-pedido` (5 = 120 pedidos por ladrilho) ou `--km` (ladrilhos menores, mais
  ladrilhos); o cache por data não perde nada.
- **2 em paralelo:** a ORNL é pública; mais paralelo pode trazer mais 502 (máximo 4).
- **Memória:** ~200 MB por ladrilho na compactação; com 2 em paralelo, até ~500 MB no processo.
- **Datas faltando na ORNL:** o recorte é aceito e a data fica sem observação (com aviso no log).
- **Sem tabela:** a grade fica só em arquivo (a carga no banco, `load_files_to_db --ndvi`, continua
  sendo do arquivo por ponto).
- **Modo por ponto:** a heurística `_raw_products` do `fetch_ndvi` (feita para o CSV do AppEEARS)
  leria um produto inteiro como bruto se a ORNL mandasse um NDVI acima de 10000. O MOD13Q1 não tem
  esse valor; não foi mexido aqui.
