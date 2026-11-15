# Tarefa 0037: soja na safra mais recente (checagem do começo do fluxo)

- **Identificador:** `0037`
- **Título:** `soja_recente` no `/talhao`: o satélite viu soja no ponto na safra 2025/26? Pico do NDVI do MODIS por pixel na caixa piloto, pela ORNL DAAC em ladrilhos, e o aviso na tela 3
- **Status:** Concluída
- **Prioridade:** Média (decisão do usuário de 15/11/2026)
- **PRD:** RF-24
- **Módulos Afetados:** `app/models/soja_recente.py`, `app/models/regras.py`, `app/models/talhao.py`, `app/repositories/soja_recente_repository.py`, `app/repositories/rules_repository.py`, `app/services/soja_recente_service.py`, `app/services/talhao_service.py`, `app/schemas/talhao.py`, `app/dependencies.py`, `app/config.py`, `app/config_data/regras.yaml`, `pipeline/fetch_soja_recente.py`, `.env.example`, `projeto/docker-compose.yml`, `AGENTS.md`, `docs/como-preparar-os-dados-locais.md`; no front, `models/talhao.ts`, `services/recentSoyService.ts`, `controllers/useWhenController.ts`, `views/WhenView.tsx`, `i18n/messages.*.ts`, `repositories/mocks/fixtures.ts`
- **Referências:** [tarefa 0034](0034-regiao-pelo-satelite.md) (cliente e cache da ORNL por área), `AGENTS.md` do backend ("Dados da API" → "Soja na safra mais recente" e "Contrato dos dados das fontes" → "Soja recente")

---

## 1. Descrição e Motivação

No começo do fluxo, o app confere se o satélite viu **soja** no ponto marcado na safra mais recente
(2025/26, colhida em fev/2026), para saber que o ponto é lavoura e não cidade, cana ou pasto. Se não
viu, a tela **avisa e deixa seguir**: "Não vimos soja neste ponto na última safra (2025/26). Confira
se marcou a lavoura certa.", com "Ajustar no mapa" e "Seguir mesmo assim". Ponto sem o dado (fora
da área medida, ou nuvem): nenhum aviso.

### Regra (grupo `soja_recente` do `regras.yaml`)

Hipótese do time, a revisar pela agrônoma (decisão do usuário de 15/11/2026): no pixel de 250 m,
o maior NDVI das observações boas (qualidade 0 ou 1, MOD13Q1 e MYD13Q1) de 1/jan a 15/mar de 2026
é **0,70 ou mais**. Pixel com menos de **2** observações boas na janela: sem dado (`null`).

> **Integração com a tarefa 0036** (região calibrada, que entrou no `main` durante esta tarefa): o
> limite (0,70) e a janela (1/jan a 15/mar) são **os mesmos números** do pico da soja da região
> (`regiao_ndvi.pico_min_ndvi`, `pico_inicio` e `pico_fim`). Esta tarefa criou o seu próprio grupo
> (`soja_recente`), como combinado; os dois grupos devem virar **um só**, usado pelas duas regras.
> Até lá, `test_should_keep_the_recent_soybean_rule_equal_to_the_region_soybean_peak` falha se
> alguém mudar um sem o outro.

### Caminho dos dados: ORNL DAAC por área, em ladrilhos

O `pipeline/fetch_regiao_ndvi.py` (tarefa 0034) já pede NDVI por área à ORNL. Este script importa o
`OrnlClient` (retentativa), o `SubsetCache` (gzip, gravação atômica), o `parse_subset`, o
`composite_dates` e o `SubsetRequest` dele, **sem mudar o arquivo**.

- O tempo de um pedido quase não depende da área, mas pedido maior que ~±30 km passa do corte de
  ~60 s do proxy (502). Cada ladrilho é o da região: ±30 km pedidos = 120 pixels de cada lado do
  centro = 241 × 241 pixels de 231,66 m (±27,9 km reais).
- Os ladrilhos seguem a **grade global do MODIS** (projeção sinusoidal, origem em (−πR, πR/2)),
  lado a lado a partir do canto de cima à esquerda da janela de pixels que cobre a caixa. O centro
  pedido é o centro do pixel planejado (5 casas decimais), e cada recorte entra na grade de saída
  pelo **próprio cabeçalho** (deslocamento inteiro, conferido com folga de 0,01 pixel).
- Caixa piloto: janela de **721 × 880 pixels** (a caixa vira um trapézio na projeção), **12
  ladrilhos**, **48 pedidos** (2 produtos × 2 bandas, 5 datas cada: Terra em 1/jan, 17/jan, 2/fev,
  18/fev e 6/mar; Aqua em 9/jan, 25/jan, 10/fev, 26/fev e 14/mar).

Pedidos reais (pequenos) feitos nesta tarefa, 15/11/2026, sem a extração completa:

| Pedido | Tempo | O que conferiu |
| --- | --- | --- |
| `GET /MYD13Q1/dates` na fazenda de exemplo | 45 s | as 5 datas de 2026 do Aqua na janela (`calendar_date` `AAAA-MM-DD`, `modis_date` `A2026009`) |
| `GET /MOD13Q1/subset`, NDVI, 1 pixel, 1/jan a 6/mar de 2026 | 52 s | 5 datas, o mesmo formato de 2016; cabeçalho na grade global (coluna 64518, linha 52298); na fazenda de exemplo, 0,84 e 0,90 em janeiro e 0,57, 0,30 e 0,26 depois (a soja secando), sem conferir a qualidade |

As datas do Terra em 2026 já estavam no cache de medidas da tarefa 0034 (`/MOD13Q1/dates`).

### Formato do arquivo

Grade da projeção sinusoidal do MODIS (origem, pixel, linhas e colunas) com o pico de cada pixel em
**centésimos truncados** (0 a 100, de −20 para NDVI negativo, `null` sem dado), uma linha de pixels
por linha do arquivo: ~2 MB para a caixa piloto (benchmark com ORNL falsa: 634.480 pixels, 1,9 MB,
~1 s para refazer do cache, 0,04 s para a API carregar). Detalhes, a conta do pixel e o porquê:
`AGENTS.md` do backend, contrato "Soja recente".

- Truncado, não arredondado: com o limite de 2 casas, "pico ≥ 0,70" no arquivo é exatamente o
  mesmo que no NDVI original (o bruto vem em 0,0001, então `6999 // 100 = 69`).
- O limite **não** vai no arquivo: a API aplica o do `regras.yaml` na hora. O mínimo de
  observações e a janela, sim (o script grava com eles); mudou um deles, rode o script de novo (o
  mínimo sai do cache, sem rede).

---

## 2. Fluxo

```
pipeline/fetch_soja_recente.py (offline, ORNL, sem credencial)
  pixel_window(caixa) ─► plan_tiles (241 × 241, grade global) ─► build_plan (4 pedidos por ladrilho)
        ▼
  OrnlClient.fetch_subset (5 tentativas) ─► SubsetCache (cache_ornl/*.json.gz)
        ▼
  peaks_grid: cada recorte no seu lugar pelo cabeçalho; por pixel, observações boas de Terra + Aqua
        └─► SojaRecenteRule.pixel_peak (mínimo de observações) ─► pico // 100
        ▼
  build_payload (DataRun + MapaSojaRecente) ─► soja_recente_2026.json (SOJA_RECENTE_PATH)

GET /api/talhao (e /api/exemplo) ─► TalhaoService ─► SojaRecenteService.check(lat, lon)
        └─► FileSojaRecenteRepository.get_pico ─► MapaSojaRecente.pico_em (pixel do ponto)
        └─► SojaRecenteRule.seen (pico ≥ ndvi_minimo) ─► soja_recente {safra, vista, ndvi_pico, fonte}
        sem arquivo ou fora da grade ─► soja_recente: null

Front: useWhenController ─► recentSoyWarning(talhao) ─► WhenView (aviso no topo da tela 3)
```

---

## 3. Sub-tarefas (TDD)

### 3.1 Regras
- [x] Testes em `tests/unit/repositories/test_rules_repository.py` (números do grupo e recusa sem
  fonte).
- [x] Red: `AttributeError: 'Regras' object has no attribute 'soja_recente'` e
  `KeyError: 'soja_recente'`.
- [x] Green: `RegrasSojaRecente` (janela, `ndvi_minimo`, `min_observacoes`) e o grupo no YAML.

### 3.2 Model do contrato
- [x] Testes em `tests/unit/models/test_soja_recente.py` (safra, `vista` e `ndvi_pico` juntos, faixa
  do NDVI, pixel de um ponto com o cabeçalho real da ORNL, fora da grade, linhas e colunas, valores
  que não são centésimos).
- [x] Red: `ModuleNotFoundError: No module named 'app.models.soja_recente'`.
- [x] Green: `SojaRecente`, `PicoSojaRecente`, `GradeSinusoidal` e `MapaSojaRecente`.

### 3.3 Repository de arquivo
- [x] Testes em `tests/unit/repositories/test_soja_recente_repository.py` (arquivos com
  `fonte: "teste"`).
- [x] Red: `ModuleNotFoundError: No module named 'app.repositories.soja_recente_repository'`.
- [x] Green: `FileSojaRecenteRepository` (sem caminho ou sem arquivo: nada; lido uma vez; fora do
  contrato: `ValueError`) e `get_data_run`.

### 3.4 Service com a regra
- [x] Testes em `tests/unit/services/test_soja_recente_service.py` (pico do pixel, mínimo de
  observações, limite de 0,70 inclusive, sem dado, fora da grade, limite vindo das regras).
- [x] Red: `ModuleNotFoundError: No module named 'app.services.soja_recente_service'`.
- [x] Green: `SojaRecenteRule` (pipeline e API) e `SojaRecenteService`.

### 3.5 Talhão, schema, controller e ligação
- [x] Testes em `tests/unit/services/test_talhao_service.py`,
  `tests/integration/controllers/test_talhao_controller.py` (com arquivo de teste numa grade de 9 ×
  9 pixels em volta da fazenda de exemplo; `/exemplo` também), `tests/unit/test_config.py` e
  `tests/unit/test_dependencies.py`. Os `conftest` das rotas desligam o `SOJA_RECENTE_PATH` da
  máquina.
- [x] Red: `TypeError: TalhaoService.__init__() got an unexpected keyword argument
  'soja_recente_service'`, `AttributeError: 'Settings' object has no attribute
  'soja_recente_path'`, `module 'app.dependencies' has no attribute 'get_soja_recente_repository'`
  e `KeyError: 'soja_recente'`.
- [x] Green: `Talhao.soja_recente`, `SojaRecenteSchema`, `soja_recente_path` no `Settings`
  (`SOJA_RECENTE_PATH` no `.env.example` e no compose), `get_soja_recente_repository` /
  `get_soja_recente_service`.

### 3.6 Script de dados
- [x] Testes em `tests/unit/pipeline/test_fetch_soja_recente.py` (HTTP falso; os únicos números
  reais são a posição de recortes da ORNL e as datas de 2026): pixel global da fazenda, janela da
  caixa piloto (721 × 880), 12 ladrilhos e ida e volta do centro, plano de 4 pedidos com as datas,
  pico por pixel (nuvem, preenchimento, uma observação só, truncado), recorte posto pelo cabeçalho,
  parte fora da janela, recorte fora da grade, arquivo lido pelo repository, `--dry-run` sem rede,
  execução com 2 ladrilhos e retomada só do cache, erro com a dica de rodar de novo, área inválida.
- [x] Red: `ModuleNotFoundError: No module named 'pipeline.fetch_soja_recente'`; depois, ao contar
  os pixels cobertos pelo cabeçalho (e não pelo plano), `ValueError: not enough values to unpack`.
- [x] Green: `pipeline/fetch_soja_recente.py`.

### 3.7 Front
- [x] Testes: `services/recentSoyService.test.ts`, `controllers/useWhenController.test.ts`,
  `views/WhenView.test.tsx` (pt e en) e `repositories/farmRepositories.test.ts` (mock).
- [x] Red: `Failed to resolve import "./recentSoyService"`, `expected undefined to deeply equal {
  safra: '2025/26' }`, `Unable to find an accessible element with the role "alert"` e, no mock,
  `expected undefined to deeply equal { safra: '2025/26', vista: true, … }`.
- [x] Green: `soja_recente?` no `Talhao`, `recentSoyWarning`, `soyWarning` e `dismissSoyWarning`
  no controller, o cartão laranja no topo da tela 3 e o mock com a soja vista (sem aviso).

### 3.8 Documentação
- [x] `AGENTS.md` do backend ("Dados da API" e o contrato "Soja recente"),
  `docs/como-preparar-os-dados-locais.md` e o RF-24 no PRD.

---

## 4. Critérios de Aceitação

1. `/api/talhao` e o talhão do `/api/exemplo` com `soja_recente: {safra, vista, ndvi_pico, fonte}`;
   `null` sem arquivo ou com o ponto fora da grade; `vista` e `ndvi_pico` nulos no pixel sem dado.
2. O limite e o mínimo de observações vêm do `regras.yaml`, com fonte; a regra fica no service.
3. A tela 3 avisa só com `vista: false`, com "Ajustar no mapa" (volta ao mapa com o ponto) e
   "Seguir mesmo assim" (fecha o aviso); com `true`, `null` ou no modo mock, nada muda.
4. Nada de rede real nem rótulo de fonte real nos testes.
5. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .`, `npx vitest run`,
   `npm run lint`, `npm run build` e `pre-commit run --all-files` passando.

---

## 5. Fora do escopo e riscos

- **Extração real**: não foi rodada aqui (só 2 pedidos pequenos). Comando, de `projeto/backend`:
  `uv run python -m pipeline.fetch_soja_recente` (antes, `--dry-run`): 48 pedidos, ~30 min.
- **Onde fica o aviso**: na tela 3, logo depois de escolher o ponto, e não no mapa: o "É aqui" da
  tela 2 dispara o talhão e segue sem esperar (plano técnico §2); esperar a resposta no mapa
  atrasaria todo mundo (a busca sob demanda leva até 9 s). Se o talhão chegar depois de a pessoa
  sair da tela 3, ela não vê o aviso. "Seguir mesmo assim" vale só enquanto a tela está aberta.
- **Nuvem**: jan a mar é a época das chuvas; pixel com menos de 2 imagens boas fica sem dado e não
  avisa. A contagem sai no `versao_dados.parametros.pixels` e no log do script.
- **Limite**: cana, café e mata também passam de 0,70 em janeiro (o aviso pega cidade, pasto seco e
  solo exposto, não todo "não é soja"). Calibrar junto com a região (tarefa 0036).
- **Terra (MOD13Q1)**: o satélite Terra está no fim da vida útil; se faltar o MOD13Q1 numa safra
  futura, o Aqua sozinho ainda dá até 5 imagens na janela.
- **Próximas safras**: `--ano 2027` grava `soja_recente_2027.json`; o `SOJA_RECENTE_PATH` (e o
  padrão do compose) precisa apontar para o arquivo novo.
- **Tabela**: não há tabela no PostGIS; a API lê o arquivo.
