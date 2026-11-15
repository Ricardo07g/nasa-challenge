# Tarefa 0034: região pelo satélite (P3)

- **Identificador:** `0034`
- **Título:** `GET /api/regiao` com a lavoura parada na entressafra num raio de 30 km, pelo NDVI do MODIS recortado por área na ORNL DAAC e a máscara de lavoura do MCD12Q1
- **Status:** Concluída
- **Prioridade:** Média (P3 do plano de evolução, Should)
- **Roteiro:** P3 (Fase 7); usa a regra do R3.2 ([tarefa 0018](0018-historico-ndvi-na-api.md))
- **Módulos Afetados:** `app/models/regiao.py`, `app/repositories/regiao_repository.py`, `app/services/region_service.py`, `app/services/field_history_service.py`, `app/schemas/regiao.py`, `app/controllers/regiao_controller.py`, `app/dependencies.py`, `app/main.py`, `app/config.py`, `pipeline/fetch_regiao_ndvi.py`, `.env.example`, `projeto/docker-compose.yml`, `AGENTS.md`, `docs/como-preparar-os-dados-locais.md`
- **Referências:** guia do histórico NDVI (seção "Região pelo satélite (P3)"), plano de evolução (P3), contrato do front (`projeto/frontend/src/models/region.ts`, `repositories/regionRepository.ts`), `AGENTS.md` do backend ("Contrato dos dados das fontes" → "Região pelo satélite")

---

## 1. Descrição e Motivação

A tela "Na sua região" (tela 8) já chamava `GET /api/regiao?lat&lon` e recebia 404 ("Ainda não
conectado"). O guia NDVI pede, para a lavoura num raio de 30 km, em cada entressafra de 2016 a 2025,
a fração dos pixels que ficou **parada**, **plantou** ou ficou **sem certeza**, com os mesmos limites
do histórico do talhão (`regras.yaml`, grupo `historico_ndvi`), para as duas telas nunca discordarem.

### Caminho dos dados escolhido: ORNL DAAC por área

| Caminho | Situação em 14/11/2026 | Decisão |
| --- | --- | --- |
| AppEEARS (por área) | fila parada (uma tarefa pequena esperando há horas) e depende de token | não usado |
| ORNL por ponto (grade de 1 ponto a cada 2–3 km) | ~700 pontos × 41 pedidos | não usado |
| **ORNL por área** (`/subset` com `kmAboveBelow` e `kmLeftRight`) | pública, sem login; o tempo do pedido quase não depende da área | **usado** |

Medidas reais (pedidos pequenos, 14/11/2026, sem a extração completa):

| Pedido | Pixels | Tempo | Tamanho |
| --- | --- | --- | --- |
| MOD13Q1 NDVI, 1 data, ±1 km | 9 × 9 | 9,6 s | 1,7 KB |
| MYD13Q1 `pixel_reliability`, 7 datas, ±1 km | 9 × 9 | 27,3 s | 0,5 KB |
| MOD13Q1 NDVI, 8 datas (abr–jul de 2016), ±30 km | 241 × 241 | 24,3 s | 1,0 MB com gzip (2,8 MB de JSON) |
| MCD12Q1 `LC_Type1`, 10 anos (2016–2025), ±33 km | 133 × 133 (500 m) | 16,4 s | 52 KB com gzip (0,7 MB) |

- Uma região = **41 pedidos**: 10 anos × 2 produtos (Terra 8 datas, Aqua 7) × 2 bandas (NDVI e
  `pixel_reliability`), cada um com até 10 datas, mais 1 do MCD12Q1 com os 10 anos. Estimativa:
  **~20 min** (~30 s por pedido; mais se vier 502) e ~30 MB de cache em gzip.
- A ORNL conta o km como pixels de 250 m, mas o pixel do MODIS tem 231,66 m: `kmAboveBelow=30`
  devolveu 241 linhas (±27,9 km). Para o raio de 30 km o script pede ±33 km e recorta o círculo.
- Os valores vêm linha a linha do canto de cima à esquerda: conferido comparando o recorte de 9 × 9
  com o mesmo trecho do de 241 × 241.
- O MCD12Q1 da ORNL vai de 2001 a **2025** (o ano da entressafra mais recente tem máscara própria).

### Máscara de lavoura

Classe **12** do IGBP (`LC_Type1`, "Croplands": pelo menos 60% da área cultivada), do MCD12Q1 do
mesmo ano da entressafra (sem aquele ano, o último antes; sem nenhum antes, o primeiro). É a classe
que o guia NDVI indica quando não há o MapBiomas. A classe 14 (mosaico de lavoura com vegetação
natural, 40% a 60%) ficou de fora: o cerrado e o pasto dentro do pixel secam ou ficam verdes por
conta própria na entressafra e confundiriam "parado" com "plantou". Na caixa de ±33 km da fazenda
de exemplo, a 14 tem 0 ou 1 pixel de 500 m por ano, contra 3.800 a 5.400 da 12.

---

## 2. Fluxo

```
pipeline/fetch_regiao_ndvi.py (offline, ORNL, sem credencial)
  build_plan(historico_ndvi) ─► 41 SubsetRequest ─► OrnlClient.fetch_subset (gzip, 5 tentativas)
        │                                               └─► SubsetCache (cache_ornl/*.json.gz)
        ▼
  parse_subset ─► Grid (sinusoidal) ─► circle_indices (raio) ∩ cropland_indices_by_year (classe 12)
        ▼
  count_region_year: por pixel, observações boas (qualidade 0/1, sem −3000) de Terra + Aqua
        └─► RegionClassifier.classify_pixel (FieldHistoryService.in_entressafra + classify_year)
        ▼
  RegionClassifier.summarize ─► RegiaoAno ─► RegiaoSatelite ─► arquivo do contrato (REGIAO_PATH)

GET /api/regiao?lat&lon ─► RegionService.get_region ─► FileRegionRepository.list_regions
        região mais perto cujo círculo contém o ponto; só anos com pixel classificado, em ordem
        fora de todos os círculos ou sem arquivo ─► 404 OUTSIDE_AREA (problem+json)
```

---

## 3. Sub-tarefas (TDD)

### 3.1 Model do contrato
- [x] Testes em `tests/unit/models/test_regiao.py`.
- [x] Red: `ModuleNotFoundError: No module named 'app.models.regiao'`.
- [x] Green: `RegiaoAno` (percentuais de 0 a 100 que somam 100 ± 0,2; os três `None` juntos; sem
  percentual sem pixel de lavoura) e `RegiaoSatelite` (centro, raio > 0, fonte e máscara não vazias,
  ano sem repetição).

### 3.2 Service com a regra do talhão
- [x] Testes em `tests/unit/services/test_region_service.py` (classificação de cada pixel com os
  limites 0,60 e 0,45, fora da janela, menos de 3 observações, limites vindos das regras; percentuais
  do guia: `{0: 30, 1: 812, 2: 120, 3: 410}` → 60,5 / 30,6 / 8,9; sem lavoura sem divisão por zero;
  tudo sem dado; região que contém o ponto, anos em ordem, ano sem pixel classificado fora, região
  sem lavoura com `anos: []`, fora do raio e sem região → `OutsideAreaError`, a região mais perto) e
  em `tests/unit/services/test_field_history_service.py` (`classify_year` e `in_entressafra`).
- [x] Red: `ModuleNotFoundError: No module named 'app.services.region_service'` e
  `AttributeError: 'FieldHistoryService' object has no attribute 'classify_year'` /
  `'in_entressafra'`.
- [x] Green: `FieldHistoryService.classify_year` e `in_entressafra` públicos (o
  `classify_entressafra` passa a usá-los); `RegionClassifier` e `RegionService`.

### 3.3 Repository de arquivo
- [x] Testes em `tests/unit/repositories/test_regiao_repository.py`.
- [x] Red: `ImportError: cannot import name 'FileRegionRepository'`.
- [x] Green: `FileRegionRepository` (sem caminho ou sem arquivo: nenhuma região; o model recusa o
  arquivo fora do contrato) e `get_data_run`.

### 3.4 Controller, schema e ligação
- [x] Testes em `tests/integration/controllers/test_regiao_controller.py` (arquivo de teste com
  `fonte: "teste"`), `tests/unit/test_config.py` e `tests/unit/test_dependencies.py`.
- [x] Red: `ImportError: cannot import name 'get_region_repository' from 'app.dependencies'` e
  `AttributeError: 'Settings' object has no attribute 'regiao_path'`.
- [x] Green: `regiao_path` no `Settings` (`REGIAO_PATH` no `.env.example` e no compose),
  `get_region_repository` / `get_region_service`, `RegiaoResponse` e `GET /api/regiao`.

### 3.5 Script de dados
- [x] Testes em `tests/unit/pipeline/test_fetch_regiao_ndvi.py` (HTTP falso; o único número real é o
  cabeçalho de um recorte da ORNL, para conferir a projeção): datas de Terra e Aqua, grupos de 10,
  data `AAAAddd`, caixa que cobre o raio, plano de 41 pedidos e janela maior partida em pedidos de 10
  datas; cliente (parâmetros, gzip, 502 e falha de rede com nova tentativa, desistência, 400 sem nova
  tentativa); cache em gzip; grade e projeção sinusoidal; círculo; máscara por ano e ano da máscara;
  contagem por situação (−3000 descartado, Terra + Aqua juntos, 0,6 sem ruído de float); arquivo lido
  pelo `FileRegionRepository`; `--dry-run` sem rede; execução completa e retomada só do cache; erro
  com a dica de rodar de novo.
- [x] Red: `ModuleNotFoundError: No module named 'pipeline.fetch_regiao_ndvi'`.
- [x] Green: `pipeline/fetch_regiao_ndvi.py`.

### 3.6 Documentação
- [x] "Dados da API" e "Contrato dos dados das fontes" → "Região pelo satélite" no `AGENTS.md` do
  backend; `docs/como-preparar-os-dados-locais.md`; roteiro (P3).

---

## 4. Critérios de Aceitação

1. `GET /api/regiao?lat&lon` no contrato do front (`raio_km`, `anos[{ano, pct_parado, pct_plantou,
   pct_incerto}]`, `fonte`), mais `mascara`, `n_pixels` e `pct_sem_dado`.
2. Ponto fora da região ou sem arquivo: 404 `OUTSIDE_AREA` em problem+json.
3. A regra de cada pixel é a do talhão (mesmo código, números do `regras.yaml`).
4. Nenhum pixel sai do script; nada de dado sintético com nome de fonte real (os testes usam
   `fonte: "teste"` ou valores de teste).
5. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e
   `pre-commit run --all-files` passando.

---

## 5. Fora do escopo e riscos

- **Extração real**: não foi rodada aqui (só pedidos pequenos de medida). Comando:
  `uv run python -m pipeline.fetch_regiao_ndvi` (de `projeto/backend`).
- **Máscara ampla**: a classe 12 do MCD12Q1 também tem cana e café (verdes o ano todo) e a soja que
  ainda está verde no começo de abril. O "plantou" da região tende a sair alto. Um teste com o NDVI
  de 2016 só do Terra (sem a qualidade) deu muito mais "plantou" do que "parado". O MapBiomas (soja
  do ano) seria a máscara certa, mas só pelo Earth Engine. Calibrar junto com o talhão (guia NDVI).
- **Front**: o controller da tela 8 trata o 404 `OUTSIDE_AREA` como erro ("tentar de novo"), não
  como "fora da área". É uma mudança pequena no front, fora desta tarefa.
- **Ponto dentro do círculo**: a região vale para qualquer ponto a até `raio_km` do centro. Um ponto
  a 25 km da fazenda vê a região centrada na fazenda, não um círculo em volta dele.
- **Tabela**: ainda não há `regiao_entressafra` no PostGIS (o guia propõe uma); a API lê o arquivo.
- **ORNL instável**: 502 de vez em quando e ~40 s por pedido nos dias ruins. O script tenta de novo
  (30, 60, 90 e 120 s) e guarda cada resposta; parou, rode de novo.
