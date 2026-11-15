# Tarefa 0036: região pelo satélite calibrada (P3, RF-23)

- **Identificador:** `0036`
- **Título:** Região pelo satélite só com a soja do ano (pico e colheita), entressafra contada depois da colheita, `centro` e `distancia_km` em `GET /api/regiao` e textos da tela "Na sua região"
- **Status:** Concluída
- **Prioridade:** Média (P3 do plano de evolução, Should)
- **Roteiro:** P3 (Fase 7); calibra a [tarefa 0034](0034-regiao-pelo-satelite.md)
- **Módulos Afetados:** `app/config_data/regras.yaml`, `app/models/regras.py`, `app/repositories/rules_repository.py`, `app/models/regiao.py`, `app/repositories/regiao_repository.py`, `app/services/region_service.py`, `app/services/field_history_service.py`, `app/schemas/regiao.py`, `pipeline/fetch_regiao_ndvi.py`; no front, `src/models/region.ts`, `src/services/communityService.ts`, `src/controllers/useCommunityController.ts`, `src/views/CommunityView.tsx`, `src/pages.tsx`, `src/i18n/messages.{pt,en}.ts`, `src/repositories/mocks/mockRepositories.ts`
- **Referências:** guia do histórico NDVI (`arquivos contexto/`, seção "Região pelo satélite (P3)"), PRD RF-23, `AGENTS.md` do backend ("Dados da API" e "Contrato dos dados das fontes" → "Região pelo satélite"), `AGENTS.md` do front

---

## 1. Descrição e Motivação

O `pipeline/fetch_regiao_ndvi.py` da tarefa 0034 rodou em 14/11/2026 para 30 km em volta da fazenda
da UFU (−18,9543 / −48,1993) e deu "plantou" de 83% a 98% e "parado" abaixo de 2% em todos os anos
de 2016 a 2025. Não é crível. Duas causas:

1. A máscara (MCD12Q1 classe 12) inclui cana e café, verdes o ano todo. O entorno de Uberlândia e
   Uberaba tem muita cana.
2. A janela fixa de 1/abr a 31/jul pega a soja plantada tarde, ainda verde no começo de abril.

O guia NDVI previa usar como máscara os pixels de **soja** do MapBiomas, que só existem pelo Earth
Engine (fora do MVP). A regra abaixo é a substituta, decidida com o usuário. Os números são hipótese
do time, a revisar pela agrônoma.

### Regra nova (grupo `regiao_ndvi` do `regras.yaml`)

Dentro da máscara MCD12Q1 classe 12 de cada ano, um pixel só conta como "soja daquele ano" se
mostrar a soja **e** a colheita:

| Chave | Valor | O que é |
| --- | --- | --- |
| `pico_inicio`, `pico_fim` | `01-01`, `03-15` | janela do pico da soja |
| `pico_min_ndvi` | 0,70 | maior NDVI (qualidade 0 ou 1) da janela do pico, no mínimo |
| `colheita_fim` | `05-15` | até quando se procura a colheita depois do pico |
| `colheita_max_ndvi` | 0,40 | observação depois do pico com NDVI até este valor = colheita (vale a primeira) |
| `entressafra_fim` | `07-31` | fim da entressafra (o mesmo do `historico_ndvi.janela_fim`) |

- Com o mesmo pico em duas datas, vale a **última** (a colheita vem depois dela).
- Os pixels que passam são classificados pela regra do talhão (`classify_year` do
  `FieldHistoryService`: qualidade 0/1, mínimo de 3 observações, > 0,60 plantou, < 0,45 parado,
  senão incerto), usando **só as observações depois da data da colheita e até 31/jul**. A própria
  observação da colheita fica de fora.
- Pixel sem pico ou sem colheita fica fora dos percentuais: é perene (cana, café), pasto ou solo
  exposto.

### Dados pedidos à ORNL

| Janela por ano | Terra (MOD13Q1) | Aqua (MYD13Q1) | Pedidos (10 anos × 2 produtos × 2 bandas) |
| --- | --- | --- | --- |
| 1/jan a 31/mar (nova) | 6 datas (dias 1 a 81) | 6 datas (dias 9 a 89; conferido em `GET /MYD13Q1/dates`, 14/11/2026) | 40 |
| 1/abr a 31/jul (a da 0034, mesmo nome de cache) | 8 datas | 7 datas | 40 |
| MCD12Q1, os 10 anos num pedido | | | 1 |

- Uma região = **81 pedidos**, ~40 min do zero (~30 s por pedido) e ~60 MB de cache. Com o cache da
  0034 (abril a julho), faltam **40 pedidos, ~20 min**. O `--dry-run` conta o que já está no cache.
- A janela nova vai de `pico_inicio` até a véspera de `historico_ndvi.janela_inicio`. Uma regra da
  soja que passe de `historico_ndvi.janela_fim` é recusada (`ValueError`): não haveria dado.

---

## 2. Fluxo

```
pipeline/fetch_regiao_ndvi.py (offline, ORNL, sem credencial)
  build_plan(historico_ndvi, regiao_ndvi) ─► 81 SubsetRequest (jan–mar + abr–jul + MCD12Q1)
        │                                       └─► SubsetCache (cache_ornl/*.json.gz; abr–jul reaproveitado)
        ▼
  circle_indices (raio) ∩ cropland_indices_by_year (classe 12) ─► n_pixels_lavoura
        ▼
  count_region_year: por pixel, observações boas do ano (Terra + Aqua, jan a jul)
        └─► RegionClassifier.classify_pixel
              harvest_date (pico ≥ 0,70 de 1/jan a 15/mar; 1ª obs ≤ 0,40 depois, até 15/mai)
              sem soja ─► None (fica só em n_pixels_lavoura)
              com soja ─► classify_year(obs depois da colheita até 31/jul)
        ▼
  RegionClassifier.summarize(ano, situações, n_pixels_lavoura) ─► RegiaoAno ─► arquivo (REGIAO_PATH)

GET /api/regiao?lat&lon ─► RegionService.get_region ─► RegiaoDoPonto(regiao, distancia_km)
        ─► RegiaoResponse: raio_km, fonte, mascara, centro {lat, lon}, distancia_km, anos[...]
        fora de todos os círculos ou sem arquivo ─► 404 OUTSIDE_AREA (igual)

Front (tela 8) ─► regionPlace: distancia_km ≤ 1 → "Até 30 km da sua lavoura"
                               senão → "Raio de 30 km em volta de um ponto a X km da sua lavoura"
               404 OUTSIDE_AREA ─► estado "outside" (card próprio); 404 sem código ─► "Ainda não conectado"
```

---

## 3. Sub-tarefas (TDD)

### 3.1 Regras
- [x] Testes em `tests/unit/repositories/test_rules_repository.py` (valores do grupo e número sem
  fonte recusado).
- [x] Red: `AttributeError: 'Regras' object has no attribute 'regiao_ndvi'` e `KeyError: 'regiao_ndvi'`.
- [x] Green: `RegrasRegiaoNdvi`, `Regras.regiao_ndvi` e o grupo no `regras.yaml` (cada número com
  `valor` e `fonte`).

### 3.2 Model e repository
- [x] Testes em `tests/unit/models/test_regiao.py` (`n_pixels_lavoura` opcional, nunca menor que
  `n_pixels`; máscara sem soja; `RegiaoDoPonto` com distância finita e não negativa) e em
  `tests/unit/repositories/test_regiao_repository.py` (campo lido; arquivo antigo sem ele).
- [x] Red: `ImportError: cannot import name 'RegiaoDoPonto'` e o repository devolvendo
  `n_pixels_lavoura=None` em vez de 5000.
- [x] Green: `RegiaoAno.n_pixels_lavoura` (padrão `None`), `RegiaoDoPonto` e a leitura no
  `regiao_ano_from_json`.

### 3.3 Service
- [x] Testes em `tests/unit/services/test_region_service.py`: data da colheita; pico 0,70 e
  colheita 0,40 nos limites; sem pico; pico fora da janela; perene sem colheita; colheita depois de
  15/mai; valor baixo antes do pico; pico repetido; regras injetadas; limites do talhão depois da
  colheita; pico da soja não conta como "plantou"; soja tardia verde em abril fica parada; segunda
  safra logo depois de uma colheita cedo; observações depois de julho ou de outro ano; a observação
  da colheita fora do mínimo; ordem qualquer; `summarize` com `n_pixels_lavoura`; distância do
  ponto ao centro com 1 casa.
- [x] Red: `AttributeError: 'RegionClassifier' object has no attribute 'harvest_date'`,
  `TypeError: summarize() got an unexpected keyword argument 'n_pixels_lavoura'` e
  `AttributeError: 'RegiaoSatelite' object has no attribute 'regiao'`.
- [x] Green: `RegionClassifier.harvest_date`, `classify_pixel` (devolve `None` sem soja),
  `summarize(..., n_pixels_lavoura)` e `RegionService.get_region` → `RegiaoDoPonto`.
  `month_day` do `FieldHistoryService` ficou público para as duas regras usarem.

### 3.4 Schema e rota
- [x] Testes em `tests/integration/controllers/test_regiao_controller.py` (`centro`,
  `distancia_km` 0,0 na fazenda e 11,1 a 0,1° ao norte; `n_pixels_lavoura` `null` no arquivo antigo).
- [x] Red: `AttributeError: 'RegiaoDoPonto' object has no attribute 'raio_km'`.
- [x] Green: `CentroSchema`, `RegiaoResponse.centro` / `distancia_km` e
  `RegiaoAnoSchema.n_pixels_lavoura`. O controller não mudou.

### 3.5 Script
- [x] Testes em `tests/unit/pipeline/test_fetch_regiao_ndvi.py` (HTTP falso, valores de teste):
  datas de jan–mar de Terra e Aqua; plano de 81 pedidos; os 41 da 0034 com o mesmo nome de cache;
  regra que passa da janela recusada; contagem com `PixelCount` (lavoura e soja por situação);
  perene e solo exposto fora da soja; Terra + Aqua; `n_pixels_lavoura` no arquivo; `--dry-run`
  com o que já está no cache e o tempo; execução completa (81 pedidos) e retomada; com o cache de
  abril a julho, só os 40 de jan–mar são pedidos.
- [x] Red: `ImportError: cannot import name 'PixelCount' from 'pipeline.fetch_regiao_ndvi'`.
- [x] Green: `request_windows`, `build_plan(historico_ndvi, regiao_ndvi)`, `PixelCount`,
  `n_pixels_lavoura` no arquivo, `soja_do_ano` e `janelas_pedidas` nos `parametros`, `--dry-run`
  com o cache.

### 3.6 Front
- [x] Testes em `communityService.test.ts` (`regionPlace`), `regionRepository.test.ts` (mock com
  `centro` e `distancia_km`), `useCommunityController.test.ts` (`regionDistance` e o estado
  `outside`) e `CommunityView.test.tsx` (subtítulos pt/en, card de fora das regiões, área de soja).
- [x] Red: `TypeError: regionPlace is not a function`, `expected 'not-connected' to be 'outside'`,
  `expected undefined to be 12.3` e os textos novos não encontrados.
- [x] Green: contrato com `centro`, `distancia_km` e `n_pixels_lavoura` opcionais; `regionPlace`
  (até 1 km = em volta da lavoura); `RegionStatus` com `outside`; textos em pt e en.

### 3.7 Documentação
- [x] `AGENTS.md` do backend (as duas seções da região), `docs/como-preparar-os-dados-locais.md`,
  `AGENTS.md` do front (exceção do `OUTSIDE_AREA` na tela 8), PRD RF-23 e esta tarefa.

---

## 4. Critérios de Aceitação

1. Só os pixels da máscara com pico e colheita da soja entram nos percentuais; a entressafra conta
   só as observações depois da colheita até 31/jul, com a regra do talhão.
2. Todos os números e datas da regra no `regras.yaml` (`regiao_ndvi`), com `valor` e `fonte`.
3. O arquivo grava `n_pixels_lavoura`, `n_pixels` (soja do ano), os percentuais e `pct_sem_dado`;
   o arquivo antigo continua sendo lido.
4. Os 41 pedidos de abril a julho e do uso do solo mantêm o nome no cache.
5. `GET /api/regiao` traz `centro` e `distancia_km` (no service); 404 `OUTSIDE_AREA` igual.
6. A tela diz "Até 30 km da sua lavoura" (até 1 km do centro) ou o raio em volta de um ponto a X km;
   o ponto fora mostra o card próprio; a frase grande e a do gráfico falam em área de soja.
7. Backend: `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .`. Front:
   `npx vitest run`, `npm run lint`, `npm run build`. Raiz: `pre-commit run --all-files`.

---

## 5. Fora do escopo e riscos

- **Extração real**: não foi rodada aqui (só 1 pedido pequeno a `GET /MYD13Q1/dates` para conferir as
  datas de jan–mar). Comando (de `projeto/backend`, com o cache da 0034 em
  `data/baixados/nasa_modis_ndvi_regiao/cache_ornl/`): `uv run python -m pipeline.fetch_regiao_ndvi`
  (40 pedidos novos, ~20 min). Antes, `--dry-run` mostra "41 já no cache, 40 a baixar".
- **Números a calibrar**: 0,70, 0,40, 15/mar e 15/mai são hipótese do time. Se a região sair com
  poucos pixels de soja (`n_pixels` muito menor que `n_pixels_lavoura`), o pico pode estar alto ou a
  colheita baixa demais; conferir com a agrônoma e com o talhão.
- **Nuvem no verão**: jan–mar é a época das chuvas. Pixel sem observação boa na janela do pico fica
  fora da soja (não vira "sem dado"). Isso pode tirar soja de verdade dos anos mais nublados.
- **Pico ruidoso**: uma queda falsa (nuvem com qualidade 1) depois do pico pode virar "colheita"
  cedo; aí a soja que voltou a ficar verde conta como "plantou". Com o mesmo pico em duas datas vale
  a última, o que resolve só o caso do empate.
- **Fim da entressafra**: `entressafra_fim` repete o `historico_ndvi.janela_fim`; se um mudar e o
  outro não, o script recusa a regra que passa da janela pedida.
- **Limites do talhão**: o `classify_year` usa > 0,60 (plantou) e < 0,45 (parado), como o talhão;
  0,60 e 0,45 exatos são incerto.
- **Tabela**: ainda não há `regiao_entressafra` no PostGIS; a API lê o arquivo.
