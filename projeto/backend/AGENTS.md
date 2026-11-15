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
pipeline/              scripts offline que preparam os dados. O Dockerfile copia a pasta (com tests/)
                       para o pytest rodar no container; a API não importa nada dela
tests/
  unit/models/         contrato e validação dos models (ver "Contrato dos dados das fontes")
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
- **Erros:** sempre `application/problem+json` com `type`, `title`, `status`, `detail` e `code` (o front
  lê o `code`). O `main.py` traduz os erros de domínio (404 `NOT_FOUND` / `OUTSIDE_AREA`, 422
  `VALIDATION_ERROR`, 429 `TOO_MANY_REPORTS` e 503 `COMMUNITY_UNAVAILABLE` dos relatos da comunidade)
  e o parâmetro inválido da requisição (422 `INVALID_REQUEST`, com a lista
  `invalid_params`: `name`, `in`, `reason`). Rota nova não precisa de nada para ganhar esse formato.
- **Cache HTTP (que revalida):** só `/recomendacao` usa cache, e só na resposta 200:
  `Cache-Control: public, no-cache` (pode guardar, mas pergunta à API toda vez), `ETag` forte (SHA-256
  do corpo JSON, 32 dígitos hexadecimais, entre aspas) e `Vary: Accept-Language`. Com `If-None-Match`
  igual ao ETag (comparação fraca: aceita `W/`, lista e `*`), a API responde **304** sem corpo, com os
  mesmos `ETag`, `Cache-Control` e `Vary`. Erro nunca vai com cache nem ETag. O helper fica em
  `app/controllers/http_cache.py` (`revalidated_json_response`). Isso ajusta o `max-age=86400` do
  plano técnico §8: com ele, o dado carregado depois no banco ficava velho no navegador por até 24 h
  (tarefa 0025).

## Banco (PostgreSQL + PostGIS)

- Conexão só por `DATABASE_URL` (em `Settings`). No compose ela já aponta para `db:5432`.
  Fora do Docker: `postgresql://raiz:raiz_local@localhost:5433/raiz_orbital`.
- Só repositories falam com o banco. Coordenadas em SRID 4326, `ST_MakePoint(lon, lat)`.
- Testes unitários não usam o banco real. Testes que precisam do banco ficam em
  `tests/integration/db/`, com o marker `db` (ver "Testes com banco" em "Dados da API").
- Migrações gerenciadas via **Alembic** (`migrations/`). O esquema só muda por migração (com
  `downgrade`): nada de DDL solto nem script de carga fora do `pipeline/`.
  No compose: o serviço `migration` executa automaticamente `alembic upgrade head` antes de iniciar a API.
  Para aplicar manualmente com Docker: `docker compose run --rm migration`
  Para aplicar com uv (fora do Docker): `uv run alembic upgrade head`
  Para ver SQL gerado sem rodar: `uv run alembic upgrade head --sql`
  Para criar nova migração: `uv run alembic revision -m "descricao"`
- Tabelas (migração inicial `cb6b775d83e3` + R1.6 `6e961f333ddc` + comunidade `3f7c2a9d4e81`):
  - `grid_cell`, `climate_season` e `soil_point`: gravadas pela busca sob demanda (ver "Dados da API");
    o `climate_season.rain_source` é `nasa_power` ou, nos anos trocados pela carga do IMERG,
    `gpm_imerg`;
  - `cmip6_delta`, `ndvi_point`, `smap_point` e `data_run` (com `version`): no formato do "Contrato
    dos dados das fontes", abaixo. `PostgisCmip6Repository`, `PostgisNdviRepository`,
    `PostgisSmapRepository` e `PostgisDataRunRepository` gravam e leem. A API já lê o `cmip6_delta`
    (R3.1, ver "Deltas do CMIP6 na API") e o `smap_point` (R3.3, ver "Balde inicial pelo SMAP"),
    mas ainda não lê as outras (R3.2 e R3.5 do roteiro). O `cmip6_delta` exige a célula em `grid_cell`. O `cmip6_delta`, o `ndvi_point` e o
    `smap_point` são preenchidos pela carga dos arquivos (`pipeline/load_files_to_db.py`, ver
    "Dados da API").
  - `community_report` (tarefa 0047): os relatos da comunidade sem cadastro, gravados pela API
    (`PostgisCommunityReportRepository`). Colunas `id` (uuid), `report_type`, `subtype`, `details`
    (jsonb), `cell_id`, `fact_date`, `sent_at` e `device_hash`; regras em "Relatos da comunidade"
    (abaixo).
- Banco criado antes do R1.6: rode `uv run alembic upgrade head` (ou
  `docker compose run --rm migration`). A migração recria `cmip6_delta` e `ndvi_point`, troca
  `smap_moisture` por `smap_point` (o que houver nelas é apagado) e marca as cargas antigas de
  `data_run` com `version = 'sem-versao'`.

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

- **Preparar os dados na sua máquina** (pré-carga, CMIP6, NDVI, pacote do time e cópia do banco):
  `docs/como-preparar-os-dados-locais.md`.
- A API lê **só** o que está em `Settings` (`DATABASE_URL`, `CULTURAS_PATH`, `REGRAS_PATH`,
  `CLIMA_PATH`, `SOLO_CACHE_PATH`, `NDVI_CACHE_PATH`, `NDVI_AREA_PATH`, `CMIP6_PATH`, `ONI_PATH`,
  `REGIAO_PATH`, `IMERG_LATE_PATH`, `SMAP_PATH`, `SMAP_RECENTE_PATH`, `SOJA_RECENTE_PATH`,
  `ENSO_PREVISAO_PATH`, `AREA_QUEIMADA_PATH`). Nunca
  coloque caminho fixo (como `/workspace/...`) num repository.
- `app/config_data/culturas.yaml`: parâmetros do PRD (seção 5 e nota de solo da 7.4). Sem preço, custo
  nem produtividade (tarefa 0040): o `tipo` diz se a cultura dá grão para vender.
- **Renda sem reais** (tarefa 0040, seção 1 da remodelagem): nenhum valor em reais na API. A nota de
  renda é a segurança climática da própria opção para quem dá grão (`tipo` em `renda.tipos_com_grao`
  do `regras.yaml`: `grao` e `consorcio`) e `renda.nota_sem_grao` (0) para cobertura e pousio; a nota
  final continua com os mesmos eixos e pesos. Cada opção de `/recomendacao` e `/exemplo` traz o bloco
  `renda` (no lugar do antigo `dinheiro`): `da_grao`, `anos_aperto` (anos com aperto do motor),
  `rotulo` (limiares `rotulos.renda_bom` / `renda_medio`), `texto` ("Dá grão para vender" ou "Não dá
  grão: é investimento na terra") e `risco` ("Risco de perder a lavoura: faltou água ou fez calor em N
  de 20 anos."), com as frases `frases.<língua>.renda_*`. O motivo da alternativa é `mais_renda`. Não
  há mais margem, custo, pior ano seco em reais nem perda de produtividade pelo ISNA: não traga de
  volta (um teste de rota recusa `R$` no JSON).
- `app/config_data/regras.yaml`: limiares, pesos, rótulos e modelos de frase pt/en do motor (PRD 7),
  cada número com `valor` e `fonte` (o `YamlRulesRepository` recusa número sem fonte). Regra de
  negócio nova com número vai para lá, não para `app/constants.py`. Os services recebem as regras
  por parâmetro (padrão: este arquivo) e `dependencies.py` injeta as do `REGRAS_PATH`.
- **Avisos da safra** (tarefa 0019): as regras de veranico e calor (grupos `avisos` e
  `frases_safra` do `regras.yaml`) ficam só no `CropAlertService`, que recebe a série diária, a
  cultura e a semeadura e devolve a linha do tempo. O replay `GET /api/safra-passada` (P4) usa esse
  service e o acompanhamento diário (P6) vai usar o mesmo: não repita a regra em outro lugar. A
  opção do replay é a `melhor` do `RecommendationService` ou a `opcao` pedida (tarefa 0044: o
  replay é o detalhe de cada ano do explorador da aba Sugestão). Ano sem dado num ponto que tem dados =
  404 `NOT_FOUND`; ponto sem dados continua 404 `OUTSIDE_AREA`. O detalhe de cada ano (P1, abaixo)
  conta os dias secos pelo `CropAlertService.longest_dry_spell`, com o mesmo dia seco.
- **Detalhe de cada ano** (`opcoes[].anos_detalhe[]` de `/recomendacao` e `/exemplo`, P1, tarefa
  0035): contrato do front (`AnoDetalhe` em `projeto/frontend/src/models/recomendacao.ts`; nomes
  adotados, **a revisar**, roteiro §5). Um item por ano que o motor simulou, na ordem da faixa de
  chuva (`chuva.faixa` = `anos_detalhe[].bom`), montado pelo `YearDetailService`:

  ```json
  {"ano": 2024, "bom": false, "fase_critica": "2024-04-18", "dias_sem_chuva": 14, "enso": "el_nino",
   "texto": "Em 2024, plantando em 18 de fevereiro, a planta chegou na fase que mais precisa de água por volta de 18 de abril e ficou 14 dias sem chuva. Faltou água nessa fase. Ano de El Niño."}
  ```

  - `bom`: o ano sem aperto, o mesmo resultado do motor (`ResultadoAno.aperto`, PRD 7.2).
  - `fase_critica`: semeadura do ano + floração estimada (`dias_florescer`); na cobertura, a própria
    semeadura (começo dos 30 dias do pegamento). É o `critical_stage` do `CropAlertService`.
  - `dias_sem_chuva`: a maior sequência de dias com chuva abaixo de `avisos.dia_seco_abaixo_mm` (1 mm)
    **dentro** da fase crítica (a seca que começou antes conta do primeiro dia da fase).
  - `enso`: `el_nino`, `la_nina` ou `null`, do arquivo do ONI (`ONI_PATH`, `FileEnsoRepository`). Sem
    arquivo, ou ano fora dele: `null`. Só informa: não entra na conta.
  - `texto`: modelos do grupo `frases_ano` do `regras.yaml` (pt/en), nesta ordem: fase crítica com a
    seca; o resultado (`deu_certo`, ou `faltou_agua` e/ou `calor`, pelos critérios
    `ResultadoAno.falta_agua` e `ResultadoAno.calor` do `ClimateRiskService`); a marca do ENSO.
  - O campo é opcional no schema (padrão `[]`); com o service ligado, sempre vem. São ~27 KB a mais
    sem compressão (5 opções × 20 anos).
- **Área piloto** (`GET /api/area-piloto`, tarefa 0041): devolve `min_lat`, `max_lat`, `min_lon` e
  `max_lon` dos `PILOT_*` do `app/constants.py` (`PilotAreaService`). É a **fonte única** dos limites:
  o front desenha a caixa e bloqueia o ponto fora dela lendo esta rota, sem repetir os números. Mudou a
  caixa? Mude só as constantes.
- **ONI da NOAA** (P1, tarefa 0035): `pipeline/fetch_oni.py` baixa a tabela pública do ONI
  (`https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt`, um pedido de ~23 KB, **sem
  credencial**) e grava o arquivo do contrato ONI (abaixo) em `data/baixados/noaa_oni/oni.json`, a
  partir da raiz do repositório (fora do git). Regra do ano da safrinha (grupo `enso` do
  `regras.yaml`, hipótese do time, **a revisar**): média do ONI das estações DJF, JFM e FMA do ano
  (dezembro do ano anterior a abril: o verão e o começo do outono, da colheita da soja até a fase
  crítica), arredondada em 2 casas; +0,5 ou mais = `el_nino`, −0,5 ou menos = `la_nina` (limiares da
  NOAA CPC, sem a exigência de 5 estações seguidas do "episódio"). Ano com estação faltando fica de
  fora. É dado da NOAA, não da NASA.

  ```bash
  uv run python -m pipeline.fetch_oni --dry-run   # mostra o pedido e os anos, sem rede
  uv run python -m pipeline.fetch_oni             # safrinhas de 2005 a 2024
  ```

  Para ligar o arquivo: **com uv**, `ONI_PATH=../../data/baixados/noaa_oni/oni.json` no `.env` desta
  pasta; **no compose**, já ligado (`ONI_PATH=/dados_baixados/noaa_oni/oni.json`). O arquivo é lido
  uma vez por processo: depois de baixar, reinicie o backend.
- **Previsão do ENSO da NOAA CPC** (sinal para o outono, tarefa 0038):
  `pipeline/fetch_enso_previsao.py` faz 2 pedidos públicos, **sem credencial**: a tabela "Official NOAA CPC ENSO Probabilities"
  (`https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/`, HTML com
  `<table id="probabilities-table">`, ~28 KB: chance em % de La Niña, neutro e El Niño em 9 estações
  de 3 meses, a partir da do meio no mês da emissão) e a ENSO Diagnostic Discussion
  (`.../enso_advisory/ensodisc.shtml`, ~13 KB: só o dia da emissão, que precisa ser do mesmo mês).
  A NOAA publica as duas na **2ª quinta-feira de cada mês** e verifica as chances pelo RONI (±0,5
  °C). O ano de cada estação é o do mês do meio (o DJF de 2027 é dez/2026 a fev/2027). Grava o
  contrato "Previsão do ENSO" (abaixo) em `data/baixados/noaa_enso_previsao/enso_previsao.json`, a
  partir da raiz do repositório. Página fora do formato (sem tabela, coluna trocada, estação fora de
  ordem, chances que não somam 100, discussão de outro mês): erro, e nada é gravado. É dado da NOAA,
  não da NASA.

  ```bash
  uv run python -m pipeline.fetch_enso_previsao --dry-run   # os 2 pedidos, sem rede
  uv run python -m pipeline.fetch_enso_previsao             # grava o arquivo (rode todo mês)
  ```

  Para ligar o arquivo: **com uv**,
  `ENSO_PREVISAO_PATH=../../data/baixados/noaa_enso_previsao/enso_previsao.json` no `.env` desta
  pasta; **no compose**, já ligado (`/dados_baixados/noaa_enso_previsao/enso_previsao.json`). Lido
  uma vez por processo: depois de baixar, reinicie o backend.
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
  - solo de um ponto (`PostgisSoilRepository.get_soil`, tarefa 0012): o ponto exato (chave de
    0,0025°) no banco; senão, no cache de arquivo; senão, o ponto gravado **mais próximo da mesma
    célula de 0,1°** (nunca de célula vizinha); senão, o padrão. É o que faz o solo pré-carregado
    no centro da célula servir para qualquer talhão dela;
  - id da célula: só `cell_id_for` (`floor` de lat/lon × 10, plano técnico §5). O polígono vai de
    `idx/10` a `(idx + 1)/10` e a latitude da série lida do banco é a do centro da célula.
- **Sem banco**, só arquivos, como antes: nada de busca sob demanda, solo padrão fora do cache e, fora da
  célula da fixture, a API responde que ainda não tem dados (`dentro_da_area: false` / 404 `OUTSIDE_AREA`).
- `app/fixtures/clima_fazenda_exemplo.json`: NASA POWER diário (chuva, máxima e mínima),
  1/jan a 31/jul de 2005 a 2024, da célula do POWER da lavoura de demonstração, perto de
  Uberlândia (MG); o ponto fica perto da Fazenda do Glória, mas não garantidamente dentro dela.
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
- **Deltas do CMIP6** (R2.1, tarefas 0014 e 0023): `pipeline/fetch_cmip6_deltas.py` pede ao THREDDS
  da NCCS (sem credencial) `pr`, `tasmax` e `tasmin` de jan a jul, 1995–2014 contra 2041–2060
  (SSP2-4.5), de ACCESS-CM2, MPI-ESM1-2-HR e MRI-ESM2-0 (padrão adotado, **a revisar**), e grava o
  arquivo do contrato CMIP6 (abaixo). Cada arquivo do THREDDS tem um ano de uma variável, e o custo
  de um pedido cresce com o número de dias, não com a área. Dois modos:
  - **por área** (`--area`, use este para a caixa): pelo OPeNDAP em ASCII, um pedido por arquivo com
    o retângulo de pixels de 0,25° que cobre todas as células do POWER da caixa (caixa piloto por
    padrão, ou `--area="lat_min,lat_max,lon_min,lon_max"`), mais um DAS por variável e período
    (confere a unidade e o calendário). Caixa piloto: 378 pedidos de ~7 s, **cerca de 45 min**;
  - **por ponto** (padrão): pelo NCSS em CSV, um ponto por pedido (as 12 células da caixa piloto ou
    `--pontos="lat,lon; lat,lon"`). Caixa inteira: 4.320 pedidos, ~8 h; um ponto só, ~40 min.

  Os dois modos dão o mesmo resultado para cada ponto: o modo por área usa o pixel que o NCSS
  devolveria para o ponto (`ncss_pixel`: centro mais perto, empate para a coordenada maior).
  Saída padrão `data/baixados/nasa_nex_gddp_cmip6/cmip6_deltas_nex_gddp.json` e cache
  `data/baixados/nasa_nex_gddp_cmip6/cache_ncss/`, a partir da **raiz do repositório** (calculada
  pelo caminho do script, não pela pasta atual; fora do git). Se parar, rode de novo que ele
  continua do cache. A API lê o arquivo pelo `CMIP6_PATH` (abaixo). Para copiar o arquivo para a
  tabela `cmip6_delta`: "Carga dos arquivos no banco", abaixo.

  ```bash
  uv run python -m pipeline.fetch_cmip6_deltas --dry-run --area  # pedidos e tempo nos dois modos
  uv run python -m pipeline.fetch_cmip6_deltas --area            # caixa piloto, 3 modelos
  ```

- **Chuva do GPM IMERG Final** (R2.4, tarefa 0026): `pipeline/fetch_imerg.py` grava a chuva diária
  do `GPM_3IMERGDF` v07 (0,1°) das 225 células da caixa piloto, de 1/jan em diante (212 dias) de
  2005 a 2024, no arquivo do contrato IMERG (abaixo). É refinamento da chuva do POWER (ADR-0003).
  - **Credencial:** `EARTHDATA_TOKEN` (pelo `Settings`), com o aplicativo **NASA GESDISC DATA
    ARCHIVE** autorizado e a EULA do GES DISC aceita no perfil da Earthdata. O token vai como
    `Authorization: Bearer` num cabeçalho comum, que o `urllib` repete no redirecionamento do login
    (o `authorization` do `HttpRequest` não serve: ele não segue o redirecionamento). Fora dos
    hosts `*.earthdata.nasa.gov` e `*.eosdis.nasa.gov` o cabeçalho é tirado; o cookie da sessão
    fica guardado. O token nunca aparece em mensagem ou log.
  - **Como pede:** a lista dos arquivos vem da busca pública do CMR (sem token, um pedido por ano,
    paginado), porque o nome muda com o processamento (`V07A`, `V07B`). Um DAS por versão confere
    a unidade (`mm/day`), o preenchimento e a origem do tempo. Depois, **um recorte ASCII por dia**
    no OPeNDAP do GES DISC (`gpm1`, Hyrax) com o retângulo de pixels que cobre a caixa
    (`precipitation[0:0][1310:1324][701:715]`, ordem `[tempo][lon][lat]`). O Hyrax recusa
    `Accept: application/json` (406): o script pede `text/plain`.
  - **Paralelo e retomada:** o primeiro pedido vai sozinho (confere o acesso e abre a sessão); os
    outros vão em paralelo (`--paralelo`, padrão 6, máximo 10), com 3 retentativas e espera
    exponencial (5, 10 e 20 s). 401, 403, redirecionamento sem fim ou página de login: para na
    hora. Cada recorte é conferido antes de entrar no cache (gravado como `.part` e renomeado).
    Algum dia falhou: nada é gravado e o script pede para rodar de novo (continua do cache).
  - **Tempo:** 4.240 recortes; até ~2,2 h com 6 em paralelo, contando ~11 s por pedido (o primeiro
    pedido real, que inclui o login); com a sessão aberta deve ser menos. `--anos 2024` baixa um
    ano só, para conferir antes.
  - Saída padrão `data/baixados/nasa_gpm_imerg/imerg_diario_caixa.json` e cache
    `data/baixados/nasa_gpm_imerg/cache_opendap/`, a partir da raiz do repositório (fora do git).

  ```bash
  uv run python -m pipeline.fetch_imerg --dry-run     # pedidos e tempo, sem rede
  uv run python -m pipeline.fetch_imerg --anos 2024   # um ano, para conferir
  uv run python -m pipeline.fetch_imerg               # 2005–2024
  ```

- **SMAP L4 nos dias de semeadura** (R2.3, tarefa 0029): `pipeline/fetch_smap.py` baixa o
  `SPL4SMGP` versão 008 (EASE-Grid 2.0 global de 9 km, de 3 em 3 horas) nos dias de semeadura das
  três faixas do motor (`SOWING_MONTH_DAY_BY_HARVEST`: 08/02, 18/02 e 03/03), de 2016 a 2025 (o
  SMAP começa em 31/03/2015), e grava o arquivo do contrato SMAP (abaixo). Precisa do
  `EARTHDATA_TOKEN` (só o script; a API não usa).
  - **Por recorte:** a busca **pública** do CMR lista os 8 granulos de 3 h do dia (UTC) e o link do
    OPeNDAP de cada um (sempre o do CMR: alguns têm sufixo, como `_u9loH5HD`, e sem ele dá 404). O
    OPeNDAP na nuvem da Earthdata (Hyrax, DAP4) devolve em CSV só o retângulo de pixels de 9 km que
    cobre a caixa (`<granulo>.dap.csv?dap4.ce=/Geophysical_Data/sm_rootzone%5B...%5D%5B...%5D`), uma
    variável por pedido, sem baixar o arquivo global (~140 MB);
  - **retângulo e pixel:** uma coluna do `cell_lat` e uma linha do `cell_lon` (baixadas uma vez)
    acham as linhas e colunas dos pontos; o `cell_lat`/`cell_lon` do retângulo escolhe o pixel mais
    perto do centro de cada célula de 0,1° da caixa. O DMR do primeiro granulo confere a grade
    (1624 × 3856), os nomes, as unidades e o `_FillValue`;
  - **valor do dia:** média dos granulos do dia em UTC, sem o preenchimento; dia com menos de 8
    granulos fica em `versao_dados.parametros.dias_incompletos`;
  - **token:** `Authorization: Bearer` como cabeçalho comum (segue os redirecionamentos). Recusado
    (401/403 ou página de login): para na hora, sem retentar e sem gravar no cache. O token nunca
    vai para mensagem, log, cache nem arquivo; o CMR não o recebe;
  - **custo:** caixa piloto = 30 buscas no CMR + 5 pedidos de estrutura e coordenadas + 720
    recortes (30 dias × 8 granulos × 3 variáveis) de ~2 s, 4 em paralelo (`--paralelo`): **cerca
    de 6 min** e poucos MB de cache;
  - saída `data/baixados/nasa_smap/smap_semeadura.json` e cache `data/baixados/nasa_smap/cache_opendap/`
    a partir da raiz do repositório (fora do git), com cache, retentativa e retomada como no CMIP6.
    Para levar ao banco: "Carga dos arquivos no banco", abaixo.

  ```bash
  uv run python -m pipeline.fetch_smap --dry-run     # dias, pedidos e tempo, sem rede
  uv run python -m pipeline.fetch_smap               # caixa piloto, 2016 a 2025
  uv run python -m pipeline.fetch_smap --area="-19.0,-18.9,-48.2,-48.1" --anos=2024
  ```

  - **Modo `--recente`** (A2.2, tarefa 0031, sinal para o outono): o dia **completo** (8 granulos)
    mais recente do CMR (o do granulo mais novo, ou até 3 dias antes se ele estiver pela metade) e
    o percentil da `sm_rootzone` desse dia na **climatologia da mesma janela do ano** (o dia ±
    `--janela-dias`, padrão 7) de 2016 até o ano anterior: % dos dias da climatologia com a média
    do dia abaixo da de agora, empate valendo meio. Ponto com menos de 5 anos na janela fica com
    `sm_rootzone_pctl: null`. Grava `data/baixados/nasa_smap/smap_recente.json` (contrato abaixo).
  - **Custo do `--recente`:** o dia recente são 24 recortes (8 × 3 variáveis); a climatologia,
    150 buscas públicas no CMR e **1.200 recortes** de uma variável (10 anos × 15 dias × 8
    granulos), **cerca de 12 min** na primeira vez. Nas seguintes, o cache só pede os dias novos da
    janela (~10 dias × 8 = 80 recortes por dia que passou). O `--dry-run` do `--recente` faz só a
    busca pública no CMR (acha o dia) e mostra o que falta. Rode perto da data de plantio (fev/mar),
    à mão ou por cron. Desde a tarefa 0038, o SMAP de agora só aparece como informação no sinal.

  ```bash
  uv run python -m pipeline.fetch_smap --recente --dry-run   # dia recente e custo
  uv run python -m pipeline.fetch_smap --recente             # grava smap_recente.json
  ```

- **Pré-carga da caixa piloto** (tarefa 0012, R1.5): `pipeline/preload_pilot_box.py` grava no banco
  o clima e o solo das 225 células de 0,1° da caixa (`PILOT_*` de `app/constants.py`), com a da
  fazenda de exemplo primeiro, para o primeiro clique na caixa sair do banco, sem busca sob demanda.
  Só usa **fontes abertas, sem credencial** (NASA POWER e ISRIC SoilGrids).

  ```bash
  # da pasta projeto/backend, com DATABASE_URL apontando para o banco que recebe a carga
  uv run python -m pipeline.preload_pilot_box --dry-run    # só o plano: nada é buscado nem gravado
  uv run python -m pipeline.preload_pilot_box --limite 1   # só a célula da fazenda de exemplo
  uv run python -m pipeline.preload_pilot_box              # a caixa inteira
  ```

  - **Tempo:** cerca de 1 hora, quase toda na pausa entre os pedidos ao SoilGrids (226 pedidos;
    `--pausa-solo 12` s por padrão, porque o ISRIC pede uso moderado, cerca de 5 por minuto). O
    clima são 20 pedidos ao POWER, de poucos segundos cada. O clima vem antes: a caixa já fica
    usável (com o solo padrão onde ainda não há solo) nos primeiros minutos.
  - **POWER:** um pedido por região onde ele responde igual a todos os parâmetros: a célula de
    meteorologia (0,5° × 0,625°, a `cobertura` da fixture) cruzada com a grade de 1° da radiação,
    que muda a ETo de Penman-Monteith. As temporadas de cada célula de 0,1° usam a latitude do
    centro dela. Falhou o pedido: as células dele ficam para a próxima execução (nada de copiar a
    célula vizinha).
  - **SoilGrids:** o centro de cada célula, mais o ponto exato da fazenda de exemplo. Solo padrão
    (falha ou sem dado) não é gravado.
  - **Idempotente:** pula célula com clima e ponto com solo já no banco; `--forcar` busca de novo.
    Parou no meio: rode de novo. `--limite N` para depois de N células que ainda precisam de dado.
  - **`data_run`:** uma linha por fonte chamada (`nasa_power`, `soilgrids`), com o que foi pedido e
    o resultado em `params` e a versão `<ano>.<mês>-preload-pilot-box`.
  - Depois da pré-carga, a célula da fazenda de exemplo (`-190_-482`) sai do banco (POWER de agora,
    com Penman-Monteith), não mais da fixture.

- **Carga dos arquivos no banco** (tarefas 0022, 0027 e 0029): `pipeline/load_files_to_db.py` copia
  o arquivo do CMIP6 para o `cmip6_delta`, o do NDVI para o `ndvi_point`, a chuva do IMERG para o
  `climate_season` e o do SMAP para o `smap_point`. Não busca nada na rede. Rode depois da
  pré-carga (o `cmip6_delta` só aceita célula que já está em `grid_cell`, e o IMERG só troca
  temporada que já está no `climate_season`). Dá para passar um ou mais arquivos.

  ```bash
  # da pasta projeto/backend, com DATABASE_URL apontando para o banco que recebe a carga
  uv run python -m pipeline.load_files_to_db --cmip6 <arq> --ndvi <arq> --imerg <arq> --smap <arq> --dry-run
  uv run python -m pipeline.load_files_to_db --cmip6 <arq> --ndvi <arq> --imerg <arq> --smap <arq>
  ```

  - **CMIP6:** cada célula de `grid_cell` recebe os deltas do ponto do arquivo cuja `cobertura`
    contém o centro dela, pela própria leitura do `FileCmip6Repository` (mesma regra de borda da
    API). Uma linha por célula × modelo × cenário × mês. Célula sem cobertura: nada.
  - **NDVI:** a série de cada ponto, lida pelo `CachedNdviRepository` (sem neve, nuvem nem NDVI
    vazio) e gravada pelo `PostgisNdviRepository.save_ndvi_history`. Registro sem `produto` ou
    `qualidade` (cache antigo) ou com o NDVI bruto não cabe na tabela e conta como pulado.
  - **IMERG** (`--imerg`, R3.4): para cada célula e ano que já estão no `climate_season` com a
    mesma janela (212 dias desde 1/jan), o `rain_mm` passa a ser a série do IMERG e o
    `rain_source` passa a `gpm_imerg`, **só quando o ano do IMERG está completo** (nenhum dia
    `null`). Ano incompleto continua com o NASA POWER; célula ou ano que não está no banco (ou com
    outra janela) fica de fora. Nenhuma temporada é criada e as outras séries (temperatura, ETo)
    não mudam. Pelo `PostgisClimateRepository` (`list_season_windows` e `replace_seasons_rain`).
  - **SMAP:** a série de cada ponto (centro de célula de 0,1°), lida pelo `FileSmapRepository` e
    gravada pelo `PostgisSmapRepository.save_smap_series` (chave `point_key` + dia).
  - **Conferência antes de gravar:** os arquivos são lidos primeiro. Arquivo ausente, sem
    `versao_dados`, de outra fonte (o `versao_dados.fonte` tem de ser `nex_gddp_cmip6` /
    `modis_mod13q1` / `gpm_imerg` / `smap`) ou fora do contrato: nada é gravado (saída 1).
  - **Idempotente** (upsert; a chuva, update). **`data_run`:** uma linha por fonte com linhas
    gravadas, com a `version` do `versao_dados` do arquivo e, em `params`, o nome do arquivo (sem a
    pasta), as contagens e o `versao_dados.parametros` do arquivo (`parametros_do_arquivo`). No
    IMERG, as contagens são `celulas_no_arquivo`, `temporadas_no_arquivo`, `temporadas_trocadas`,
    `temporadas_incompletas` e `temporadas_sem_clima`.
  - **Células novas:** a busca sob demanda cria células depois da carga. Elas ficam sem linha no
    `cmip6_delta`, mas a API acha os deltas no arquivo (ordem tabela → arquivo, abaixo). Rodar a
    carga de novo copia essas células. A ingestão não muda.
  - O pacote do time leva a cópia do banco com as tabelas: quem recebe não roda a carga.
    Caminho dos arquivos e comando completo: `docs/como-preparar-os-dados-locais.md`.

- **Chuva do IMERG na conta** (R3.4, tarefa 0027): depois da carga (`--imerg`, acima), as
  temporadas trocadas têm `rain_source = gpm_imerg` e o motor usa a chuva do IMERG nelas, sem
  mudança no código do balde (ele lê o `rain_mm`). Nos outros anos (e células) segue o POWER.
  - `/talhao` lista `{"fonte": "gpm_imerg", "periodo": "2005-2024"}` em `dados`, depois do
    `nasa_power`, quando algum ano da célula tem a chuva do IMERG. O front já lê essa chave
    (`satelliteService.ts`: período da chuva; `sourceService.ts`: fonte conectada e chuva em 10 km).
  - O "Por quê?" diz "(GPM IMERG + NASA POWER)" quando algum ano da série é do IMERG
    (`RAIN_SOURCE_NAMES`); sem nenhum, "(NASA POWER)".
  - **Voltar ao POWER:** a carga apaga a chuva do POWER das temporadas trocadas. Para voltar, rode a
    pré-carga com `--forcar`: o upsert do `save_cell_seasons` regrava a chuva **e** o `rain_source`.
  - Sem banco (só a fixture), não há IMERG.

- **Sinal para o outono** (`sinal` de `/recomendacao`, RF-20; regra da tarefa 0038, decisão de
  15/11/2026): o `SinalOutonoService` junta três fontes, cada uma ligada no `dependencies.py`:
  - **previsão do ENSO** (`FileEnsoForecastRepository`, `ENSO_PREVISAO_PATH`): a chance oficial de
    El Niño, neutro e La Niña da NOAA CPC na estação do outono da safrinha (`sinal_enso.estacao_previsao`
    do `regras.yaml`: FMA, fevereiro a abril). **Sem o arquivo, sem a estação nele ou com ela já
    passada, o `sinal` sai `null`** (o cartão do sinal não aparece no Plano);
  - **ONI de cada ano** (`FileEnsoRepository`, `ONI_PATH`, tarefa 0035) com o `bom` de cada ano do
    `anos_detalhe` da opção do 1º ano do Plano A: em quantos anos daquela fase ela deu certo;
  - **o Plano A e o Plano B são os da tela do Plano** (tarefa 0049, S9): o service recebe as culturas
    (`cultura_a`, `cultura_b`), não os planos. No `/recomendacao`, `cultura_a` = o 1º ano do Plano A
    sugerido (a melhor opção) e `cultura_b` = o Plano B do `PlanBService` para ela (a cultura que
    mais deu certo quando a do A falhou), o mesmo do cartão "Plano A e Plano B"; no `/api/plano`, o
    1º ano do plano que a tela mostra (o sugerido ou o editado) e o Plano B dele. O
    `plano_3_anos.seco` do motor não entra mais no sinal;
  - **SMAP recente** (`FileRecentSoilMoistureRepository`, `SMAP_RECENTE_PATH`, tarefa 0031): **só
    informa** (`smap_agora`). Sozinho não liga o sinal e nunca muda o nível.

  Regra (números no grupo `sinal_enso`, hipótese do time, **a revisar**):
  - `incerto`: nenhuma fase com 50% ou mais (`fase_chance_min_pct`), duas empatadas no topo, menos
    de 5 anos daquela fase na série (`anos_fase_min`; ano sem ONI não conta como neutro), ou o Plano B
    não se saiu melhor que o A nesses anos, ou não há Plano B ("Nenhuma outra cultura se saiu melhor
    nesses anos.");
  - `seco` (marca o Plano B): a opção do 1º ano do Plano A deu errado em metade ou mais dos anos da
    fase (`fracao_anos_ruins_seco`) e a do Plano B se saiu melhor nesses anos;
  - `normal` (marca o Plano A): no resto.
  - **Sem a regra da data** (tarefa 0049, S9 da remodelagem): o `regra_dia_plantar` e o `regra_data`
    (chuva dos 30 dias antes da data limite) saíram da API, porque nenhuma tela usava mais (a tela do
    Plano trocou a regra pelo Plano A / Plano B com o número derivado da série, tarefa 0045). O
    `sinal_outono.chuva_fracao_seco` ficou sem uso no `regras.yaml`, como o `chance_seco_min`.
  - `motivo`: "Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA). Nos 7 anos de El Niño
    desde 2005, milho sozinho deu certo em 5." O nome da fonte vem do arquivo (`fonte`). Nunca chama
    El Niño de "ano seco" (PRD 7.10).
  - Contrato do front (`SinalOutono` em `src/models/recomendacao.ts`): `nivel`, `motivo`, `fonte` (a
    previsão primeiro, depois a fonte da chuva da série e o `SMAP`), `data` (dia da emissão da
    previsão) e o opcional `smap_agora` (`percentil`, `data`, `texto`).
  - **Fora do sinal** (continuam no repositório, sem uso): o GEOS-S2S (`SeasonalForecastRepository`,
    `NoAutumnSignalDataRepository`; só NetCDF-4/HDF5, tarefa 0032) e a chuva recente do IMERG Late
    (`FileRecentRainRepository`, `IMERG_LATE_PATH`; só de fev a jul, tarefa 0033).
- **Chuva dos últimos 30 dias pelo IMERG Late** (A2.3, tarefa 0033; fora do sinal desde a tarefa
  0038): `pipeline/fetch_imerg_late.py`
  grava, por célula de 0,1° da caixa (piloto por padrão, ou `--area="lat_min,lat_max,lon_min,lon_max"`),
  a soma dos últimos 30 dias do `GPM_3IMERGDL` v07 (Late, diário) e a média dos mesmos dias.
  - **Granulos:** pelo CMR (público, sem token), que dá o nome de cada dia (o sufixo muda: `V07B`,
    `V07C`) e o link do Cloud OPeNDAP. Sem `--fim`, a janela termina no dia mais recente do CMR (o
    Late sai com ~1 dia). Dia faltando na janela: erro, nada é gravado.
  - **Chuva:** um pedido por dia ao Cloud OPeNDAP (`opendap.earthdata.nasa.gov`, Hyrax) em ASCII,
    `precipitation[time][lon][lat]` no retângulo de pixels da caixa, com `EARTHDATA_TOKEN` (Bearer).
    O pixel do IMERG (0,1°, centros em x,x5) é a própria célula do `cell_id_for`. Célula com algum
    dia sem dado (-9999,9) fica de fora. Cache por dia e retângulo em
    `data/baixados/nasa_gpm_imerg_late/cache_opendap/`.
  - **Média:** do NASA POWER `PRECTOTCORR` **já guardado** (`climate_season` do banco, com a fixture
    de reserva; sem `DATABASE_URL`, só a fixture da fazenda de exemplo), somado nos mesmos dias do
    calendário em cada ano anterior ao da janela (29/fev vira 28/fev). O POWER guardado vai de 1/jan
    a 31/jul: janela fora disso (ou que cruza o ano) não tem média, e o script sai com erro sem
    sobrescrever o arquivo. O sinal é para fev/mar, perto do plantio.
  - Saída padrão `data/baixados/nasa_gpm_imerg_late/chuva_30d_imerg_late.json` (fora do git). A API
    lê pelo `IMERG_LATE_PATH`; no compose, já aponta para
    `/dados_baixados/nasa_gpm_imerg_late/chuva_30d_imerg_late.json`.

  ```bash
  uv run python -m pipeline.fetch_imerg_late --dry-run                  # plano, sem rede nem token
  uv run python -m pipeline.fetch_imerg_late                            # caixa piloto, 30 dias
  uv run python -m pipeline.fetch_imerg_late --fim 2027-02-28           # janela que termina num dia
  ```
- **Deltas do CMIP6 na API** (R3.1, tarefa 0021): o `get_cmip6_deltas` da célula lê, nesta ordem, e
  fica com a primeira fonte que tiver deltas:
  1. a tabela `cmip6_delta` da célula (só com banco; `PostgisCmip6Repository`);
  2. o arquivo do `CMIP6_PATH` (`FileCmip6Repository`): a célula de 0,1° recebe os deltas do ponto
     cuja `cobertura` (célula do POWER, 0,5° × 0,625°) contém o centro dela, com a borda de baixo
     dentro e a de cima fora, como na fixture do clima;
  3. a lista `cmip6[]` da fixture do clima (`CLIMA_PATH`), que hoje não tem nenhuma.

  Com deltas, o `/talhao` lista `{"fonte": "nex_gddp_cmip6", "periodo": "2041-2060", "cenario":
  "ssp245", "modelos": <quantos modelos>}` em `dados` e o `/recomendacao` preenche `futuro` e
  `notas.futuro` (nota final com os 4 eixos). Sem deltas (sem `CMIP6_PATH`, sem arquivo ou sem ponto
  que cubra a célula): `futuro: null` e a nota final com 3 eixos. O motor soma o `tmin_c` à mínima
  quando o arquivo traz (o Hargreaves usa máxima e mínima); sem ele, a mínima observada fica.

  Para ligar o arquivo gerado pelo `pipeline/fetch_cmip6_deltas.py` (ele não vai para o git sozinho):
  - **com uv**: `CMIP6_PATH=../../data/baixados/nasa_nex_gddp_cmip6/cmip6_deltas_nex_gddp.json` no
    `.env` desta pasta (caminho relativo à pasta de onde a API roda, `projeto/backend`);
  - **no compose**: já ligado. O serviço `backend` monta a pasta local `data/baixados` (fora do git)
    em `/dados_baixados`, só leitura, e aponta `CMIP6_PATH` para
    `/dados_baixados/nasa_nex_gddp_cmip6/cmip6_deltas_nex_gddp.json`, `NDVI_CACHE_PATH` para
    `/dados_baixados/nasa_modis_ndvi/ndvi_modis_appeears.json`, `NDVI_AREA_PATH` para
    `/dados_baixados/nasa_modis_ndvi_area/ndvi_modis_area.json`, `REGIAO_PATH` para
    `/dados_baixados/nasa_modis_ndvi_regiao/regiao_ndvi_modis.json`, `SMAP_PATH` para
    `/dados_baixados/nasa_smap/smap_semeadura.json`, `SMAP_RECENTE_PATH` para
    `/dados_baixados/nasa_smap/smap_recente.json` e `SOJA_RECENTE_PATH` para
    `/dados_baixados/nasa_modis_soja_recente/soja_recente_2026.json` e `AREA_QUEIMADA_PATH` para
    `/dados_baixados/nasa_modis_mcd64a1/area_queimada_mcd64a1.json`. Sem o arquivo, segue sem o
    dado.
    Como baixar ou receber esses arquivos: `docs/como-preparar-os-dados-locais.md`.

- **Balde inicial pelo SMAP** (R3.3, tarefa 0030, PRD 7.2): o balde de cada ano da série começa
  com a umidade do SMAP do **dia de plantar daquele ano** (o dia e o mês da faixa de colheita):
  `arm0 = CAD × sm_rootzone_wetness`, com piso de 20% da CAD (`MIN_INITIAL_ARM_FRACTION`, US-03).
  Ano sem SMAP nesse dia (antes de 2016, ou dia que o arquivo não tem): 50% da CAD, como antes.
  - **Regra no service:** `ClimateRiskService.sowing_day_wetness` (o dia de cada ano) e
    `initial_bucket_fraction` (fração da CAD); `simulate_historical` e `simulate_future_cmip6`
    recebem `smap_wetness_by_year`. O futuro do CMIP6 usa o mesmo balde de cada ano (o método do
    delta muda só o clima).
  - **Leitura no repository** (`get_smap_repository` em `dependencies.py`): a série da célula de
    0,1° (o ponto do centro dela), nesta ordem: tabela `smap_point` (só com banco;
    `PostgisSmapRepository.get_cell_smap_series`) e o arquivo do `SMAP_PATH`
    (`FileSmapRepository`, o ponto do arquivo dentro da célula). Nunca a série de célula vizinha.
  - **Na resposta:** o `/talhao` lista `{"fonte": "smap", "periodo": "<primeiro ano>-<último ano>"}`
    em `dados` quando a célula tem SMAP (o front marca o SMAP como conectado). O `porque` de cada
    opção do `/recomendacao` ganha, logo depois da frase da chuva, a frase `frases.<língua>.balde_smap`
    do `regras.yaml` com quantos anos da série usaram o SMAP. Sem nenhum ano, não há frase.
  - Para ligar o arquivo: **com uv**, `SMAP_PATH=../../data/baixados/nasa_smap/smap_semeadura.json`
    no `.env` desta pasta; **no compose**, já ligado em `/dados_baixados/nasa_smap/smap_semeadura.json`.
    Reinicie o backend depois de trocar o arquivo (ele é lido uma vez por processo).
- **NDVI do MODIS e histórico do talhão** (R3.2, tarefa 0018). Com ou sem banco, a série vem do arquivo
  do `NDVI_CACHE_PATH` e, sem ponto perto do talhão, da grade do `NDVI_AREA_PATH` ("NDVI por área",
  abaixo, tarefa 0050). A tabela `ndvi_point` existe desde o R1.6 e a carga da tarefa 0022 a
  preenche, mas a API ainda não lê dela. O arquivo vem do
  script do R2.2 (`pipeline/fetch_ndvi.py`); sem ele, a API responde `historico: null` e colheita `meio` / `padrao`.
  - `CachedNdviRepository`: lê o formato do contrato (seção NDVI abaixo) e ainda aceita o cache antigo
    (`data`, `ndvi` bruto). Usa o ponto do arquivo **mais perto** do talhão, a até 250 m
    (`NDVI_POINT_MAX_DISTANCE_M`, um pixel do MOD13Q1); mais longe, série vazia. Descarta observação com
    qualidade 2 ou 3 ou sem `ndvi`.
  - `FieldHistoryService`: regra do talhão do guia NDVI, com os números do grupo `historico_ndvi` do
    `regras.yaml` (anos **2017 a 2026**, decisão de 15/11/2026; mínimo de 3 observações, 0,60 e 0,45).
    **Soja de cada ano** (tarefa 0039, a mesma regra da região, grupo `regiao_ndvi`): o ano só conta
    como entressafra depois da soja se o pixel mostrou o pico (maior NDVI de 1/jan a 15/mar ≥ 0,70) e
    a colheita (depois do pico, até 15/mai, alguma observação ≤ 0,40). A entressafra é classificada
    pelo `classify_year` só com as observações **depois da colheita até 31/jul**. Sem pico ou sem
    colheita: `sem_soja` (cidade, cana, pasto). Sem nenhuma observação boa de 1/jan a 15/mar:
    `sem_dado` (o satélite não viu o verão). A regra do pico e da colheita (`soy_harvest_date`,
    `post_harvest_values`) fica **só** no `FieldHistoryService`; o `RegionClassifier` chama ela.
    Série vazia e nenhuma safra confirmada: `historico: null` (nada inventado). Com série, sempre os
    10 anos:

    ```json
    "historico": {
      "anos": [{"ano": 2017, "situacao": "parado", "ndvi_max": 0.31, "n_obs": 3, "fonte_ano": "satelite"},
               {"ano": 2018, "situacao": "sem_soja", "ndvi_max": null, "n_obs": 0, "fonte_ano": "satelite"},
               {"ano": 2025, "situacao": "plantou", "ndvi_max": 0.31, "n_obs": 3, "fonte_ano": "produtor"}],
      "parado": 4, "plantou": 4, "sem_certeza": 1, "sem_soja": 1, "total": 10,
      "fonte": "MODIS MOD13Q1 + MYD13Q1", "janela": "04-01 a 07-31"
    },
    "anos_confirmaveis": [2024, 2025, 2026]
    ```

    `situacao`: `plantou`, `parado`, `incerto`, `sem_dado` ou `sem_soja`; `ndvi_max` (físico, com até 4
    casas, a precisão do MOD13Q1) é `null` no `sem_dado` e no `sem_soja` (aí `n_obs` é 0);
    `sem_certeza` = incerto + sem_dado; `sem_soja` à parte; `total` = anos da janela; `fonte` lista os
    produtos que vieram na série (cache antigo, sem produto: só `MODIS`; sem série, só com safras
    confirmadas: `produtor`). A `janela` continua a do `historico_ndvi` (o texto "de abril a julho"
    da tela), embora a entressafra comece na colheita de cada ano.
  - **Safras confirmadas pelo produtor** (tarefa 0039, RF-25): `/api/talhao` e `/api/recomendacao`
    aceitam `confirmadas=2024:plantou,2025:parado`. O controller (`confirmadas_param.py`) só confere o
    formato (`AAAA:valor` separados por vírgula; fora dele, 422 `INVALID_REQUEST` com o campo) e
    converte em pares; o `FieldHistoryService.check_confirmations` aceita só os anos de
    `confirmable_years()` (as `historico_ndvi.anos_confirmaveis` = 3 últimas: 2024, 2025 e 2026), os
    valores `plantou` e `parado` e nenhum ano repetido (senão 422 `VALIDATION_ERROR`). O ano
    confirmado sai com a situação do produtor e `fonte_ano: "produtor"` (`ndvi_max` e `n_obs`
    continuam os do satélite); os outros, `"satelite"`. Sem série de NDVI, o histórico sai só com as
    safras confirmadas (os outros anos `sem_dado`). O `/talhao` sempre lista `anos_confirmaveis`.
  - `porque` da recomendação: frase do histórico (modelo `frases.<língua>.historico` do `regras.yaml`,
    PRD 7.6), contando só os anos certos (parado + plantou; sem soja, incerto e sem dado ficam de fora),
    com as safras confirmadas no lugar do satélite. Com alguma confirmada, o modelo é
    `historico_confirmado` (diz quantas o produtor confirmou e quantas o satélite viu). Sem série e
    sem confirmação, ou sem ano certo, não há frase. Hoje só a frase lê o histórico: o pousio e o
    plano "hoje" ainda não usam o histórico do talhão.
  - `/exemplo` recomenda com a `colheita_sugerida` do talhão (PRD 7.9), não mais com `meio` fixo.
- **NDVI do MODIS** (tarefas 0017 e 0024): `pipeline/fetch_ndvi.py` traz a série de MOD13Q1 e
  MYD13Q1 (coleção 061, jan–jul dos anos do `historico_ndvi` do `regras.yaml`, hoje 2017 a 2026: o
  script lê os anos de lá) de cada ponto e grava o arquivo do contrato do NDVI
  (qualidade 0 ou 1, fator 0,0001 aplicado, sem o −3000). Duas fontes, **mesmo arquivo**: saída
  padrão `data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json` a partir da **raiz do
  repositório** (pelo caminho do script, como o CMIP6; fora do git), que o compose liga no
  `NDVI_CACHE_PATH`. O nome do arquivo fica o mesmo para as duas; `versao_dados.parametros.servico`
  diz de onde veio (`appeears` ou `ornl`). Os brutos ficam ao lado da saída.
  - **`--fonte appeears`** (padrão): uma tarefa por execução (todos os pontos), espera terminar e
    baixa os CSVs (guardados em `appeears_<id>/`, reconvertíveis com `--csv`). Credencial pelo
    `Settings`: `APPEEARS_TOKEN` e, se faltar ou vencer, `EARTHDATA_USERNAME` +
    `EARTHDATA_PASSWORD` (o `EARTHDATA_TOKEN` não serve). Estourou o limite de espera: código 2 e a
    dica para retomar com `--tarefa-existente <id>`. A fila pode levar horas.
  - **`--fonte ornl`**: o serviço de recortes do MODIS da ORNL DAAC
    (`https://modis.ornl.gov/rst/api/v1`), **sem credencial e sem fila**, mas lento: cada pedido
    que dá certo leva de 19 a 60 s e o proxy corta em ~60 s com 502 (14/11/2026). Pede a escala e o
    preenchimento do NDVI (`/bands`, a ORNL entrega o inteiro bruto), a lista de datas de cada ponto
    e recortes de um pixel com todas as bandas e até `--datas-por-pedido` datas (padrão 5, máximo 10
    do serviço), sem cruzar o ano: 64 pedidos para um ponto (~1,6 h na rodada real), 188 para três
    (~4,7 h).
    Retentativa com espera crescente (rede, 5xx, corpo fora do formato) e `--pausa` entre pedidos;
    bloco de várias datas que falha 2 vezes é dividido em duas metades, até 1 data. Cache em
    `cache_ornl/` (só resposta conferida, arquivo provisório renomeado), lido **por data**: só pede
    o que falta, e mudar o `--datas-por-pedido` entre execuções não perde nada. Data que ficou sem
    resposta ou 3 falhas seguidas: código 2, nada gravado na saída; rode de novo que continua do
    cache.
  - **A saída tem só os pontos pedidos**: para acrescentar um ano (ex.: 2026, tarefa 0039), rode
    com todos os pontos do arquivo. Com o cache de 2016 a 2025 dos 4 pontos de teste, faltam só os
    recortes de 2026: **24 pedidos, ~36 min** pelo `--dry-run` (15/11/2026).

  ```bash
  uv run python -m pipeline.fetch_ndvi --dry-run                 # AppEEARS: mostra o pedido, sem rede
  uv run python -m pipeline.fetch_ndvi                           # AppEEARS, fazenda de exemplo
  uv run python -m pipeline.fetch_ndvi --pontos "-18.9543,-48.1993;-17.5,-47.25"
  uv run python -m pipeline.fetch_ndvi --fonte ornl --dry-run    # ORNL: pedidos, cache e tempo
  uv run python -m pipeline.fetch_ndvi --fonte ornl              # ORNL, fazenda de exemplo
  # os 4 pontos de teste (fazenda, Uberlândia urbana, cana/pasto e norte), 2017 a 2026
  uv run python -m pipeline.fetch_ndvi --fonte ornl "--pontos=-18.9543,-48.1993;-18.9149,-48.2568;-19.55,-48.75;-18.6,-48.9"
  ```
- **NDVI por área** (RF-34, tarefa 0050): `pipeline/fetch_ndvi_area.py` baixa da ORNL (sem
  credencial) a série de **cada pixel de 250 m** da área (padrão: os `PILOT_*`; `--area="..."`), com
  a mesma janela, os mesmos produtos, bandas, escala e filtro do `fetch_ndvi --fonte ornl` (um teste
  de paridade confere os mesmos `NdviRecord` pelos dois caminhos). Grava o contrato "NDVI por área"
  (abaixo) em `data/baixados/nasa_modis_ndvi_area/` a partir da raiz do repositório (fora do git).
  - **Ladrilhos:** os da soja recente (`plan_tiles`: ±30 km = 241 × 241 pixels, lado a lado a partir
    do canto noroeste da área), do centro da área para fora. Cada ladrilho = 80 pedidos (10 anos × 2
    produtos × 2 bandas × 2 pedidos equilibrados: 7 + 7 datas do Terra e 7 + 6 do Aqua por ano, com
    `--datas-por-pedido` 10, o limite da ORNL). Caixa piloto: **12 ladrilhos, 960 pedidos, ~5,3 h**
    com `--paralelo 2` pelo `--dry-run` (~40 s por pedido, sem os 502).
  - **Retomada:** resposta conferida (banda, grade global, centro do ladrilho, datas) antes do cache
    (`cache_ornl/<ladrilho>/`, gzip), lido por data. O ladrilho é compactado e o índice regravado
    assim que os pedidos dele terminam (cada ladrilho pronto já vale na API). Falha: o ladrilho fica
    para a próxima execução; 3 seguidos sem resposta param tudo; saída 2 = rode de novo.
    `--apagar-cache` apaga o cache bruto de cada ladrilho compactado.
  - **Na API:** `get_ndvi_repository` monta, com `NDVI_AREA_PATH`, um `LayeredNdviRepository`: o
    arquivo por ponto (`CachedNdviRepository`, pontos a até 250 m) e depois o `GridNdviRepository`
    (o ladrilho de centro mais perto que contém o pixel; fora de todos, série vazia). Sem a variável
    ou sem o índice, tudo como antes. Os services continuam chamando só `get_ndvi_history`. O
    `get_data_run` vem do `versao_dados` do índice. Lido uma vez por processo: reinicie o backend
    depois de baixar mais ladrilhos.

  ```bash
  uv run python -m pipeline.fetch_ndvi_area --dry-run            # ladrilhos, pedidos, tempo e espaço
  uv run python -m pipeline.fetch_ndvi_area --paralelo 2         # caixa piloto, 2017 a 2026
  uv run python -m pipeline.fetch_ndvi_area --area="-19.0,-18.9,-48.25,-48.15" --anos 2026
  ```

  Para ligar: **com uv**, `NDVI_AREA_PATH=../../data/baixados/nasa_modis_ndvi_area/ndvi_modis_area.json`
  no `.env` desta pasta; **no compose**, já ligado.
- **Chuva de cada mês** (`chuva_mensal` de `/talhao` e do talhão do `/exemplo`, gráfico da tela 3,
  tarefa 0028): o `MonthlyRainService` soma a chuva de cada mês, de janeiro a junho, em cada
  temporada da célula (as que o `get_seasons` já devolve) e tira a média entre os anos, com uma
  casa decimal. Só entra o ano cuja série cobre de 1/jan a 30/jun. `fonte` = a `rain_source` das
  temporadas (`gpm_imerg` na caixa piloto depois da carga; com mais de uma, as chaves em ordem
  separadas por `+`, ex.: `gpm_imerg+nasa_power`). Fora da área ou sem nenhum ano completo: `null`
  (o bloco não aparece). Desde a tarefa 0042, cada mês traz também `eto_media_mm` (a média da ETo
  do motor, `ClimateRiskService.reference_eto`, injetada no `dependencies.py`: a gravada ou
  Hargreaves-Samani), e o bloco traz `fonte_eto` (`nasa_power`) e `mes_chuva_abaixo_eto` (o
  primeiro mês em que a chuva média fica menor que a ETo média; `null` se nunca fica). Sem ETo
  para algum ano, os três ficam `null`. Na fazenda de exemplo (banco local, IMERG):

  ```json
  "chuva_mensal": {
    "meses": [{"mes": 1, "media_mm": 289.1, "eto_media_mm": 134.0}, "...",
              {"mes": 4, "media_mm": 89.5, "eto_media_mm": 108.8}, "...",
              {"mes": 6, "media_mm": 14.4, "eto_media_mm": 91.9}],
    "anos": [2005, 2006, "...", 2024],
    "fonte": "gpm_imerg", "fonte_eto": "nasa_power", "mes_chuva_abaixo_eto": 4
  }
  ```
- **Tela 3 "Quando você colhe a soja?"** (remodelagem S3, tarefa 0042, RF-02, RF-16 e RF-27). As
  regras ficam nos services, com os números no `regras.yaml`; o front só procura o dia na tabela.
  - **Dia sugerido e faixa** (`colheita_sugerida.dia`, "MM-DD"): em cada ano, a primeira imagem de
    fevereiro ou março abaixo de `ndvi.queda_colheita` (50%) do pico de janeiro a março; o dia é a
    mediana dos anos, contada num ano comum (`app/services/calendar_days.py`: 29/fev = 28/fev) e
    arredondada para baixo. A `faixa` sai do dia pela regra da data exata da tela 3
    (`FieldHistoryService.harvest_band`, grupo `colheita`: até `cedo_ate` 02-10, e janeiro, cedo;
    até `meio_ate` 02-20, meio; depois, tarde). O limite antigo de 22/fev
    (`MID_HARVEST_DOY_LIMIT`) saiu: com ele, o satélite dizia "meio" para um dia que a tela chamava
    de "tarde". Sem NDVI suficiente: `dia: null`, `faixa: meio`, `fonte: padrao`.
  - **Chuva que sobra** (`chuva_que_sobra` do `/talhao`, `RemainingRainService`): para cada dia de
    `colheita.janela_inicio` a `janela_fim` (15/jan a 31/mar, 76 dias de um ano comum), a chuva
    somada do dia até `chuva_que_sobra.fim` (30/jun, inclusive) em cada ano que cobre a época
    inteira; `mediana_mm` (mediana dos anos) e `seco_mm` (percentil `percentil_seco`, 20, com
    interpolação linear entre os anos ordenados), 1 casa. `fonte` e `anos` como no `chuva_mensal`.
    Sem ano completo: `null`.
  - **Fim das chuvas** (`fim_das_chuvas` do `/talhao`, `RainEndService`): em cada ano, o primeiro
    dia, a partir de `fim_das_chuvas.inicio` (1º/mar), que começa `dias` (20) dias seguidos com
    menos de `chuva_max_mm` (10) mm **somados** (não por dia: decisão D35). `mediana` (arredondada
    para baixo, num ano comum: em metade dos anos a chuva acabou até esse dia), `mais_cedo` e
    `mais_tarde` (`{dia, ano}`), `anos`, `fonte` e a própria regra (`inicio`, `dias`,
    `chuva_max_mm`). Se algum ano não tem esse dia dentro da série (até 31/jul), `null`: sem ele, a
    mediana e o mais tarde sairiam errados. O raio-X da seção 4 (tarefa 0043) usa este mesmo service.
  - **Custo do atraso** (`GET /api/custo-atraso?lat&lon[&solo][&confirmadas]`,
    `HarvestDelayService`): uma recomendação do motor (`RecommendationService.recommend`) por faixa,
    com o mesmo solo e as mesmas safras confirmadas; devolve `faixas[]` (`colheita`, `semeadura`,
    `melhor`, `nome`, `anos_bons`, `total_anos`; os da opção `null` quando nenhuma cabe na janela)
    e `mesma_cultura`. Nada é recalculado fora do motor (um teste de rota confere que os números
    são os do `/recomendacao` de cada faixa). Erros como no `/recomendacao` (404 `OUTSIDE_AREA`,
    422). Sem cache HTTP: são 3 recomendações (~1 s na lavoura de demonstração). Endpoint à parte, e não
    campo do `/talhao`, para o `/talhao` (pedido já na tela 2) continuar rápido.
- **Raio-X da sua terra** (`GET /api/raio-x?lat&lon[&colheita][&solo][&confirmadas]`, tela 4,
  remodelagem S4, tarefa 0043, RF-29). Endpoint à parte (decisão D55 da remodelagem): ele roda o motor
  uma vez (`RecommendationService.recommend`, com a mesma colheita, solo e safras confirmadas) para
  a melhor opção, ~0,5 s na lavoura de demonstração; o `/talhao` continua leve. O `RaioXService` só busca e
  monta; cada conta mora num service com teste próprio e os números ficam no `regras.yaml` (grupos
  `raio_x` e `alertas_area`, hipótese do time a revisar). Reaproveita sem repetir: o fim das chuvas
  (`RainEndService`), o dia seco dos avisos (`avisos.dia_seco_abaixo_mm`), o calor do motor
  (`clima.calor_temp_c`), a janela da floração (`clima.janela_grao_meia_dias`), a ETo do motor
  (`ClimateRiskService.reference_eto`), a soja do ano e a colheita sugerida (`FieldHistoryService`).
  Cada bloco é `null` sem dado (o front não desenha). Só números: as frases são do front.
  - `solo` (SoilGrids): `textura`, `argila_pct`, `areia_pct`, `cad_mm`, `vizinho_km`. Sem solo na
    célula, o ponto gravado mais perto de qualquer célula (`PostgisSoilRepository.get_nearest_soil`,
    só com banco), até `raio_x.solo_vizinho_max_km` (15 km). O motor **não** usa esse solo (o
    `get_soil` continua só na célula). Sem nenhum: `null`.
  - `agua`: `cad_mm` (a da terra escolhida pelo produtor, se houver, como no motor; senão a do bloco
    1), `dias` = ⌊CAD ÷ (ETo média na floração ± 15 dias em todos os anos × `kc_pico`)⌋ da melhor
    opção (`RaioXClimateService.flowering_water`), `cultura`, `nome`, `floracao` ("MM-DD"),
    `eto_mm_dia`, `kc`, `consumo_mm_dia`, `fonte_eto`. Pousio: `dias` e a cultura `null`.
  - `umidade`: `percentil` e `data` do SMAP recente (`SMAP_RECENTE_PATH`).
  - `verde` (`NdviStripService.green`): `ultimo_ndvi`/`ultimo_data` (a última leitura da série do
    ponto) e `pico_ndvi`/`pico_data`/`safra` (o maior NDVI da janela do pico da soja,
    `regiao_ndvi.pico_inicio` a `pico_fim`, no último ano da série); sem série, o pico do mapa da soja
    recente (RF-24). `soja_vista` (tarefa 0049): o satélite viu a soja naquele verão, pela regra da
    faixa do histórico (`FieldHistoryService.soy_harvest_date`: pico e colheita; sem série, o `vista`
    do mapa da soja recente); `false` = o pico é só o maior verde de jan–mar e a tela não diz "pico da
    soja"; `null` sem leitura do verão.
  - `chuva`: `media_mm` de `raio_x.chuva_inicio` a `chuva_fim` (a temporada guardada), `anos`,
    `fonte` e `fim_das_chuvas` (o mesmo objeto do `/talhao`).
  - `veranico`: `dias`, `ano` (empate: o mais recente), `inicio` ("MM-DD"), `total_anos`, `fonte`.
  - `calor`: `anos_com_calor`, `total_anos`, `temp_c`, `anos`, `fonte` (`nasa_power`).
  - `regiao` (`RegionRankService`): a chuva média de `raio_x.regiao_inicio` a `regiao_fim` da
    célula contra as células da caixa piloto, só da mesma fonte de chuva e com a janela inteira
    (`PostgisClimateRepository.rain_totals_in_window`, recorte do vetor no SQL, só com banco):
    `chuva_mm`, `mediana_regiao_mm`, `celulas`, `pct_mais_seca` (% das outras com mais chuva),
    `pct_mais_chuvosa`, `fonte`. Menos de `regiao_min_celulas` (10): `null`.
  - `historico_ndvi` (`NdviStripService.strip`): `colunas` ("MM-DD" de cada leitura de 16 dias, a
    partir do dia 1, até `raio_x.ndvi_fim`: 14), `anos` (os do `historico_ndvi`, 2017–2026, com os
    `valores` de cada coluna: o maior NDVI bom de Terra e Aqua no intervalo, `null` sem leitura),
    `fonte`, `colheita_dia` (a da RF-16). O que aconteceu em cada ano continua no `historico` do
    `/talhao`; o front junta os dois.
  - `alertas` (cada um só vem com risco): `geada` (`RaioXClimateService.frost`: anos com mínima de
    `alertas_area.geada_temp_c` ou menos de `geada_inicio` a `geada_fim`), `chuva_forte` (`heavy_rain`:
    `media_dias_ano` com `chuva_forte_mm` ou mais na janela, a partir de `chuva_forte_media_min_dias`)
    e `fogo` (`BurnedAreaService`: anos com pixel queimado do MCD64A1 a até `fogo_raio_km`, nos anos
    da regra que o arquivo cobre; sem o arquivo do `AREA_QUEIMADA_PATH`, `null`). **Sem granizo**:
    nenhuma fonte mede.
  - `cartoes`: `chuva_20_anos` (a melhor opção do motor: `cultura`, `nome`, `anos_bons`,
    `total_anos`) e `clima_futuro` (`FutureClimateService`: os deltas de `futuro_mes_inicio` a
    `futuro_mes_fim`; a chuva de cada modelo pesada pela chuva média de cada mês na célula, a máxima
    pela média simples; `chuva_pct` e `tmax_c` = média dos modelos; `modelos`,
    `modelos_menos_chuva`, `modelos_mais_chuva`, `modelos_mais_quente`, `cenario`, `periodo`).
  - `leitura_recente`: o dia mais recente entre o SMAP de agora e a última leitura do NDVI;
    `altitude_m`: sempre `null` (o `grid_cell` não tem a coluna e o pedido manda não buscar fora).
  - Erros como no `/recomendacao` (404 `OUTSIDE_AREA`, 422). Sem cache HTTP.
- **Área queimada do MODIS** (alerta de fogo do raio-X, tarefa 0043): `pipeline/fetch_area_queimada.py`
  pede à **ORNL DAAC** (pública, sem credencial; reaproveita o `OrnlClient`, o `SubsetCache` e o
  `parse_subset` da região e a grade sinusoidal da soja recente, que aceitam o pixel de 500 m) a
  banda `Burn_Date` do **MCD64A1** (coleção 061, mensal, 500 m) de todos os meses dos anos do
  `alertas_area` (2016 a 2025), por área, em ladrilhos. A ORNL conta 0,5 km por pixel nos produtos de
  500 m: ±30 km = 121 × 121 pixels. Padrão: **12 ladrilhos × 20 pedidos = 240, ~2,3 h** (~35 s por
  pedido, medido em 15/11/2026 com a ORNL lenta; ±30 km com 6 e 10 datas voltou 502 naquela hora:
  diminua `--km` ou `--datas-por-pedido`). Pixel com `Burn_Date` > 0 num mês queimou naquele ano (0 =
  não queimou, −1 = sem dado, −2 = água). Grava o contrato "Área queimada" (abaixo) em
  `data/baixados/nasa_modis_mcd64a1/area_queimada_mcd64a1.json` e, com `DATABASE_URL`, uma linha em
  `data_run` (`modis_mcd64a1`). Cache em gzip em `cache_ornl/`, retomada como na região.

  ```bash
  uv run python -m pipeline.fetch_area_queimada --dry-run   # ladrilhos, pedidos e tempo, sem rede
  uv run python -m pipeline.fetch_area_queimada             # caixa piloto, 2016 a 2025
  uv run python -m pipeline.fetch_area_queimada --area="-19.0,-18.9,-48.25,-48.15" --anos 2016
  ```

  Para ligar o arquivo: **com uv**,
  `AREA_QUEIMADA_PATH=../../data/baixados/nasa_modis_mcd64a1/area_queimada_mcd64a1.json` no `.env`
  desta pasta; **no compose**, já ligado. Lido uma vez por processo: reinicie o backend.
  Com o arquivo cobrindo o ponto, o `/talhao` lista `{"fonte": "modis_mcd64a1", "periodo":
  "2016-2025"}` em `dados` (tarefa 0049): a missão e "De onde vem cada dado" citam o MCD64A1 só aí.
- **Aba Sugestão** (remodelagem S5a, tarefa 0044, RF-30): campos novos do `/recomendacao` e do
  `/exemplo`, todos opcionais no front (contrato em `docs/tarefas/0044-sugestao.md`). Regras nos
  services, números no `regras.yaml`:
  - **Linha "Água" e sede** (`opcoes[].agua`, `WaterNeedService`, grupo `agua`): o
    `simulate_historical` guarda em cada `ResultadoAno` as somas do ciclo (`etc_mm`, `etr_mm`,
    `chuva_mm`); `precisa_mm` = mediana do ETc (ETo × Kc), `chove_mm` = mediana da chuva,
    `falta_normal_mm` = mediana de ETc − ETr, `falta_seco_mm` = percentil 100 − `percentil_seco`
    (80) da falta, `sede` pelos cortes `sede_pouca_ate_mm` / `sede_muita_desde_mm` (hipótese do
    time). O `futuro` usa os anos de cada modelo do CMIP6 (`simulate_future_by_model`; a nota de
    futuro sai do mesmo conjunto, `summarize_future`). Não há número para palhada, enxurrada nem a
    água da próxima safra: não temos dado;
  - **critério e ciclo** (`criterio`, `ciclo`): os números de "deu certo" do grupo `clima` (ISNA,
    35 °C, `calor_min_dias` = 3, janela) e o ciclo e a floração do `culturas.yaml`, para a tela não
    repetir número;
  - **explorador ano a ano** (`anos_detalhe[]`): mais `isna`, `dias_calor`, `falta_agua`, `calor`,
    `semeadura` e `umidade_inicial` (o SMAP do balde daquele ano; `null` antes de 2016);
  - **o que observar e El Niño / La Niña** (`observar`, `enso_acerto`; `SuggestionFactsService`,
    grupo `enso_acerto`): veranico típico (mediana, para baixo) e anos de calor da fase crítica; a
    taxa de acerto nos anos de cada fase contra os outros, com `clara` (5 anos ou mais da fase e
    25 pontos de diferença). Só informa;
  - **objetivos do produtor** (`objetivos`: `equilibrio`, `seguranca`, `renda`, `terra`; cada um
    com `ordem`, `plano` e `nota_plano`): a ordem é a nota do eixo com desempate pela final; o plano
    é o melhor do PRD 7.7 que começa pela 1ª da ordem (`RotationPlanService.best_plan_starting_with`;
    nos objetivos, sem o pousio). **O Plano A (`plano_3_anos.normal`) é o plano do equilíbrio: começa
    pela melhor opção**; o Plano B continua livre. A reordenação é no motor; o navegador só escolhe.
    Desde a tarefa 0056, a `ordem` traz depois das no prazo as culturas fora do prazo do ZARC (mesma
    regra do eixo); o `plano` continua só com as no prazo;
  - **na célula** (`clima_futuro`, `geada`): **os mesmos objetos do raio-X** (tarefa 0049, S9), para
    a Sugestão e a tela 4 dizerem o mesmo número: `clima_futuro` = o cartão "Clima 2041–2060"
    (`FutureClimateService`: cada mês pesado pela chuva média do mês na célula, com
    `modelos_menos_chuva`, `modelos_mais_chuva`, `modelos_mais_quente`, `cenario` e `periodo`) e
    `geada` = o alerta de geada (`RaioXClimateService.frost`, grupo `alertas_area`: `anos`,
    `total_anos`, `temp_c`, `menor_temp_c`, `fonte`; `null` sem nenhum ano com geada). Saíram o
    `CellClimateFactsService` e os grupos `clima_futuro_sugestao` e `geada_sugestao` (a média
    simples dos meses dava −0,7% na Sugestão contra +2,2% no raio-X na lavoura de demonstração);
  - `fora_da_janela[].data_limite` (o aviso único da colheita tarde junta as culturas por data) e
    `GET /api/safra-passada?…&opcao=<id>` (o detalhe de qualquer ano do explorador, para a opção
    que a aba mostra; fora da janela, 404 `NOT_FOUND`).
- **Culturas fora do prazo do ZARC na conta** (tela 5 do pacote 2, tarefa 0056, RF-39; contrato
  em `docs/tarefas/0056-motor-pacote2.md`): o `RecommendationService` calcula todas as culturas
  (menos o pousio) com a mesma semeadura da faixa de colheita. As que passaram do prazo continuam
  em `fora_da_janela[]` e vão para o campo `Recomendacao.opcoes_fora_do_prazo` (`na_janela =
  False`), fora da `melhor`, das alternativas e dos planos sugeridos (decisão padrão, a revisar: o
  seguro não cobre); o `Recomendacao.opcoes` continua só com as no prazo, então o custo do atraso,
  o raio-X, o replay, os avisos e o sinal não mudam. No JSON do `/recomendacao` e do `/exemplo`,
  `opcoes[]` traz as no prazo e depois as fora do prazo, cada uma com `fora_do_prazo` (= `!na_janela`).
  O `data_limite` continua `AAAA-MM-DD` (o front tira o MM-DD). O model também leva
  `notas_pousio` (as notas do pousio do PRD 7.7, para o plano em cadeia).
- **Abas Comparar e Plano de 3 anos** (remodelagem S5b, tarefa 0045, RF-32; contrato completo em
  `docs/tarefas/0045-comparar-e-plano.md`). O Comparar só usa o `/recomendacao`; o Plano usa o
  endpoint novo **`GET /api/plano?lat&lon&anos=a,b,c[&colheita][&solo]`** (`PlanEvaluationService`,
  decisão D110 da remodelagem): avalia qualquer sequência de 3 culturas do `culturas.yaml` (o pousio
  vale) com a conta do motor (`RecommendationService.recommend`, a mesma faixa e o mesmo solo; nada é
  recalculado fora dele), ~0,3 s na lavoura de demonstração, sem cache HTTP. Sem 3 culturas ou com cultura
  desconhecida: 422 `VALIDATION_ERROR`; ponto sem dados: 404 `OUTSIDE_AREA`. Devolve:
  - `anos[]`: `cultura`, `nome`, `na_janela`, `anos_bons`, `total_anos`, `futuro_anos_bons`, `sede`,
    `cobre_terra` (palhada > 0), `deixa_nitrogenio` (`n_deixado_kg` > 0), `quebra_nematoide`
    (`rotacao.culturas_supressoras_nematoide`, PRD 7.7) e `usa_mm` (mediana da ETr do ciclo, o novo
    `AguaOpcao.usa_mm` do `WaterNeedService`). Desde a tarefa 0056: `fora_do_prazo` (a cultura
    passou do prazo do ZARC: vem com os números do motor, `na_janela: false`, e entra nas médias;
    antes os números saíam `null`), `fixo` (sempre `true` aqui) e `motivo` (sempre `null` aqui);
  - `notas`: `seguranca` e `futuro` = média das notas do motor nos anos com lavoura na janela (o pousio
    fica de fora); `solo` (saúde da terra) = média da nota de solo dos 3 anos (pousio 0) + o bônus de
    diversidade do PRD 7.7 (`RotationPlanService.diversity_bonus`), até 100;
  - `terra`: `anos_cobertos`, `anos_nitrogenio`, `anos_nematoide`, `repetidas` (sem o pousio),
    `total`, `bonus_diversidade`;
  - `chuva` (chuva aproveitada): `inicio` (a semeadura), `fim` (`chuva_aproveitada.fim`, 07-31),
    `chuva_mm` (mediana da chuva da semeadura ao fim da série), `usa_media_mm` (média do `usa_mm` dos 3
    anos, pousio 0; `null` com ano fora da janela), `anos`, `fonte` (`rain_source`, juntas por `+`);
  - `plano_ab` (`PlanBService`): o Plano A é a cultura do 1º ano (desde a tarefa 0056, também fora
    do prazo); o Plano B, a cultura na janela (sem o
    pousio) que mais deu certo nos anos em que a do A falhou (desempate pela nota final). `limite`: a
    chuva dos `plano_b.dias_antes_semeadura` (15) dias antes da semeadura que mais acerta as falhas do
    A; `separa` só com as 4 condições do grupo `plano_b` (3 falhas ou mais, 50% das falhas, 60% dos
    marcados e chance ao acaso de até 10%, hipótese do time). Sem B, `motivo`: `pousio`,
    `nunca_falhou` ou `nenhuma_melhor`. O `plano_3_anos.seco` do motor não muda;
  - `sinal` (tarefa 0049): o sinal do outono no formato do `/recomendacao`, com o Plano A e o Plano B
    desta tela (`SinalOutonoService`, injetado no `PlanEvaluationService`). Com o plano sugerido, é o
    mesmo `sinal` do `/recomendacao`; com o plano editado, fala do Plano A editado. `null` sem a
    previsão do ENSO ou com o 1º ano no pousio (fora do prazo, fala dele desde a tarefa 0056).
  - **Sugestão em cadeia** (tela 5 do pacote 2, tarefa 0056, RF-39): **`GET
    /api/plano/sugestao?lat&lon&fixos=a[,b][&colheita][&solo]`**. O produtor fixa o 1º ano, ou o 1º
    e o 2º (qualquer cultura, até fora do prazo, ou o pousio); o `PlanSuggestionService` completa o
    plano e o `PlanEvaluationService.suggest` devolve **o mesmo JSON do `/api/plano`** do plano
    completado, com `anos[].fixo` (`false` nos sugeridos) e `anos[].motivo` (a frase pronta no
    idioma do `Accept-Language`, só nos sugeridos, sem o nome da cultura). Os anos sugeridos saem do
    `RotationPlanService.best_plan_with_prefix` (o `best_plan_starting_with` generalizado para um
    prefixo fixo; com 1 ano e sem a cadeia, o plano de antes) com `chain=True`: em cada ano sugerido
    somam os pontos do grupo `plano_cadeia` (`transition_rules` / `transition_bonus`: milheto depois
    de um pousio **fixo**, supressora do nematoide depois do milho, nenhuma função repetida do ano
    anterior; hipótese do time, a revisar). Só culturas no prazo e o pousio são sugeridas. O
    `motivo` é a frase do grupo `frases_plano` da 1ª regra que pesou: cobrir depois do parado,
    quebrar o nematoide depois do milho, prazo (sem o prazo do ZARC, uma cultura fora dele ganharia
    o ano), variar a função, melhor nota; com a sede `pouca`, "e aguenta a seca". O Plano A do
    `/recomendacao` e os planos de `objetivos` **não** usam a cadeia. Sem 1 ou 2 anos fixos ou com
    cultura desconhecida: 422 `VALIDATION_ERROR`; sem `fixos`: 422 `INVALID_REQUEST`; ponto sem
    dados: 404 `OUTSIDE_AREA`. Sem cache HTTP, ~0,4 s.
- **Região pelo satélite** (P3, tarefas 0034 e 0036): `GET /api/regiao?lat&lon`, no contrato do
  front (`projeto/frontend/src/models/region.ts`), lido do arquivo do `REGIAO_PATH` (com ou sem
  banco).
  - `pipeline/fetch_regiao_ndvi.py` pede à **ORNL DAAC** (`modis.ornl.gov/rst/api/v1`, pública,
    sem credencial) o recorte **por área** do NDVI e da `pixel_reliability` de MOD13Q1 e MYD13Q1
    e o uso do solo **MCD12Q1** (`LC_Type1`). Duas janelas por ano (os anos do `historico_ndvi`:
    2016 a 2025 no arquivo de 15/11; 2017 a 2026 desde a tarefa 0039, e com o cache atual faltam
    **9 pedidos, ~4 min**, os de 2026 e o uso do solo com os anos novos): **1/jan a
    31/mar** (pico e colheita da soja; Terra e Aqua com 6 datas cada) e a do `historico_ndvi`,
    **abril a julho** (os mesmos pedidos e nomes de cache da primeira versão). Por área porque o
    tempo do pedido quase não depende da área (medido em 14/11: ~25 s tanto para 9 × 9 quanto para
    241 × 241 pixels); a ORNL aceita até 10 datas e ±100 km por pedido. Uma região = **81
    pedidos** (10 anos × 2 produtos × 2 bandas × 2 janelas + 1 do uso do solo), **~40 min** do
    zero e ~60 MB de cache. Com o cache da primeira versão (abril a julho), faltam **40 pedidos,
    ~20 min**. O AppEEARS não foi usado: a fila estava parada.
  - Caixa pedida: a ORNL conta o km como pixels de 250 m, mas o pixel tem 231,66 m
    (`kmAboveBelow=30` devolve ±27,9 km). 30 km pedem ±33 km, e o círculo é recortado no script.
  - **Máscara de lavoura**: classe **12** do IGBP (lavouras, pelo menos 60% cultivado), do
    MCD12Q1 do mesmo ano (sem o ano, o último antes). A 14 (mosaico com vegetação natural) fica de
    fora: o cerrado e o pasto do mosaico confundiriam parado com plantou.
  - **Soja do ano** (tarefa 0036, grupo `regiao_ndvi` do `regras.yaml`; hipótese do time, a
    revisar pela agrônoma; substitui a máscara de soja do MapBiomas do guia NDVI, que só existe
    no Earth Engine): a classe 12 também tem cana e café (verdes o ano todo), e a janela fixa de
    abril pegava a soja tardia ainda verde. Por isso, dentro da máscara, um pixel só conta se
    mostrar a soja **e** a colheita: o maior NDVI de 1/jan a 15/mar chega a **0,70** (com o mesmo
    valor em duas datas, vale a última) e, depois do pico e até 15/mai, alguma observação fica em
    **0,40** ou menos (a primeira é a data da colheita). Sem pico ou sem colheita (perene, pasto,
    solo exposto), o pixel fica fora dos percentuais. Desde a tarefa 0039 a regra mora no
    `FieldHistoryService` (`soy_harvest_date` e `post_harvest_values`), que também confere a soja
    de cada ano do talhão: um lugar só para as duas telas.
  - **Regra da entressafra**: cada pixel de soja do ano (250 m, centro dentro do raio) é
    classificado pelo `RegionClassifier` com o `classify_year` do `FieldHistoryService` (a mesma
    regra do talhão: qualidade 0 ou 1, mínimo de 3 observações, 0,60 e 0,45), mas só com as
    observações **depois da data da colheita até 31/jul** (a própria observação da colheita fica
    de fora). Os pixels viram percentuais (`RegionClassifier.summarize`, 1 casa): parado,
    plantou e incerto sobre os classificados (somam 100); `pct_sem_dado` sobre os pixels de soja
    (`n_pixels`); `n_pixels_lavoura` = a máscara inteira no raio. Nenhum pixel sai do script
    (RNF-10).
  - **Cache e retomada**: uma resposta por arquivo (gzip) em `cache_ornl/`; parou (502, rede),
    rode de novo. O `--dry-run` conta o que já está no cache e estima o tempo só do que falta.
    Saída padrão `data/baixados/nasa_modis_ndvi_regiao/regiao_ndvi_modis.json`, a partir da raiz
    do repositório (fora do git).

    ```bash
    uv run python -m pipeline.fetch_regiao_ndvi --dry-run   # os 81 pedidos, o que falta e o tempo, sem rede
    uv run python -m pipeline.fetch_regiao_ndvi             # fazenda de exemplo, raio de 30 km
    uv run python -m pipeline.fetch_regiao_ndvi --centros "-18.9543,-48.1993;-17.5,-47.25" --raio-km 30
    ```

  - **API** (`RegionService`): a região mais perto cujo círculo (`raio_km` em volta do centro)
    contém o ponto; só os anos com algum pixel classificado, em ordem; `centro` (o centro do
    círculo usado) e `distancia_km` (do ponto pedido até o centro, haversine, 1 casa, calculada
    no service). Fora de todos os círculos, ou sem arquivo: 404 `OUTSIDE_AREA`. Região sem soja:
    `anos: []`. Arquivo antigo (sem `n_pixels_lavoura`): `n_pixels_lavoura: null`. Exemplo
    (números ilustrativos):

    ```json
    {"raio_km": 30.0, "fonte": "MODIS MOD13Q1 + MYD13Q1",
     "mascara": "soja do ano (pico e colheita) em MCD12Q1 LC_Type1 classe 12",
     "centro": {"lat": -18.9543, "lon": -48.1993}, "distancia_km": 12.3,
     "anos": [{"ano": 2016, "pct_parado": 62.0, "pct_plantou": 29.0, "pct_incerto": 9.0,
               "n_pixels": 6120, "n_pixels_lavoura": 13412, "pct_sem_dado": 1.5}]}
    ```

- **Soja na safra mais recente** (RF-24, tarefa 0037): no começo do fluxo, o app confere se o
  satélite viu soja no ponto na safra mais recente (2025/26, colhida em fev/2026), para saber que o
  ponto é lavoura (e não cidade, cana ou pasto). O `/talhao` e o talhão do `/exemplo` ganham
  `soja_recente`, no contrato do front (`SojaRecente` em `projeto/frontend/src/models/talhao.ts`):

  ```json
  "soja_recente": {"safra": "2025/26", "vista": true, "ndvi_pico": 0.86, "fonte": "MODIS MOD13Q1 + MYD13Q1"}
  ```

  - **Regra** (grupo `soja_recente` do `regras.yaml`, hipótese do time, **a revisar** pela
    agrônoma): no pixel de 250 m, o maior NDVI das observações boas (qualidade 0 ou 1, MOD13Q1 e
    MYD13Q1) de 1/jan a 15/mar; `vista` = pico de **0,70 ou mais**. Pixel com menos de **2**
    observações boas: `vista` e `ndvi_pico` nulos (o front não avisa). O pico de cada pixel e o
    mínimo de observações saem da `SojaRecenteRule`, que o script usa ao gravar; o limite, o
    `SojaRecenteService` aplica na hora. **Integração:** o limite e a janela são os do pico da soja
    da região calibrada (tarefa 0036, `regiao_ndvi.pico_min_ndvi`, `pico_inicio` e `pico_fim`): os
    dois grupos do `regras.yaml` devem virar um só (até lá, um teste confere que são iguais).
  - **Leitura:** `FileSojaRecenteRepository` (`SOJA_RECENTE_PATH`, com ou sem banco), o pixel do
    ponto na grade do arquivo (contrato "Soja recente", abaixo). Sem arquivo ou com o ponto fora
    da grade: `soja_recente: null`.
  - **Front:** com `vista: false`, a tela "Quando você colhe a soja?" mostra o aviso laranja "Não parece uma
    lavoura de soja", com "Conferir no mapa" (pacote 2, tarefa 0057), e o raio-X diz "maior verde" no lugar de
    "pico da soja". `true` ou `null`: nada muda.
  - `pipeline/fetch_soja_recente.py` pede à **ORNL DAAC** (pública, sem credencial; reaproveita o
    `OrnlClient`, o `SubsetCache` e o `parse_subset` do script da região) o recorte **por área**
    do NDVI e da `pixel_reliability` de MOD13Q1 e MYD13Q1 nas 5 + 5 datas da janela, para a caixa
    piloto inteira (ou `--area`), em **ladrilhos** do tamanho da região: ±30 km pedidos = 241 ×
    241 pixels (±27,9 km reais), lado a lado na grade global do MODIS (projeção sinusoidal). Pedido
    maior passa do corte de ~60 s do proxy (502). Caixa piloto: **12 ladrilhos, 48 pedidos, ~30
    min** (de ~25 a 50 s por pedido, medidos em 14 e 15/11/2026). Cache em gzip em `cache_ornl/`,
    retentativa e retomada como na região. Saída
    `data/baixados/nasa_modis_soja_recente/soja_recente_2026.json` (~2 MB), a partir da raiz do
    repositório (fora do git).

    ```bash
    uv run python -m pipeline.fetch_soja_recente --dry-run   # ladrilhos, pedidos e tempo, sem rede
    uv run python -m pipeline.fetch_soja_recente             # caixa piloto, safra 2025/26
    uv run python -m pipeline.fetch_soja_recente --area="-19.0,-18.9,-48.25,-48.15" --ano 2026
    ```

  - Para ligar o arquivo: **com uv**,
    `SOJA_RECENTE_PATH=../../data/baixados/nasa_modis_soja_recente/soja_recente_2026.json` no
    `.env` desta pasta; **no compose**, já ligado. Lido uma vez por processo: reinicie o backend.

- **Relatos da comunidade** (tarefa 0047, seção 7 da remodelagem; tela "Na sua região"): sem
  cadastro, sem texto livre e sem dado pessoal. Rotas (o aparelho vai no cabeçalho `X-Aparelho`,
  identificador aleatório de 8 a 64 letras, números e hífen):
  - `POST /api/comunidade/relatos` (201): `{"tipo", "subtipo", "valores", "lat", "lon", "data_fato"}`;
    campo a mais é recusado (422 `INVALID_REQUEST`). Devolve o relato como os vizinhos veem
    (`id`, `tipo`, `subtipo`, `valores`, `celula`, `lat`/`lon` do **centro da célula**, `data_fato`,
    `meu: true`);
  - `GET /api/comunidade/relatos?lat&lon[&raio_km]` (200): `{"raio_km", "anos_safra", "relatos"}`;
    com `X-Aparelho`, os relatos dele vêm com `meu: true`;
  - `DELETE /api/comunidade/relatos/{id}` (204): só o aparelho que enviou; senão, 404 `NOT_FOUND`.

  Tipos de agora (`app/models/community_report.py`): `plantio` (`subtipo` = id do `culturas.yaml`,
  com `pousio` como "deixei parado", ou `outra`; `valores` = `ano`, `resultado` em `bem`,
  `mais_ou_menos`, `perdi`, e `motivo` em `seca`, `calor`, `geada`, `granizo`, `praga`, `outro` só
  com `perdi`; o `pousio` não tem resultado; sem `data_fato`), `chuva` (`valores.mm` de 0 a
  `chuva_max_mm`, sem subtipo) e `evento` (`subtipo` em `fogo`, `granizo`, `geada`, `vendaval`,
  `enxurrada_erosao`, `praga_doenca`; `valores` vazio). A coluna `report_type` é texto aberto para
  os tipos futuros (oferta, troca, empréstimo), que o service ainda recusa. Regras no
  `CommunityReportService`, números no grupo `comunidade` do `regras.yaml`:
  - chuva e evento: data não futura e de no máximo `dias_atras_max` (30) dias, no dia de Uberlândia
    (`PILOT_UTC_OFFSET_HOURS`, UTC-3); plantio: o ano em `FieldHistoryService.confirmable_years()`
    (as últimas safras da tela 4); ponto dentro da área piloto;
  - no máximo `max_relatos_por_dia` (10, hipótese do time) relatos por aparelho nas últimas 24 horas
    (429 `TOO_MANY_REPORTS`); um novo plantio do mesmo aparelho e ano substitui o anterior;
  - redondeza: as células cujo centro fica a até `raio_km` (30; no máximo `raio_max_km`, 50) do
    ponto, pela haversine (`cells_within_radius`), com a chuva e os eventos dos últimos 30 dias e o
    plantio das últimas safras, do mais novo ao mais velho;
  - sem banco (`DATABASE_URL` vazia), as três rotas respondem 503 `COMMUNITY_UNAVAILABLE` (o front
    não mostra a comunidade).

  **Privacidade (RNF-10):** o service troca o ponto pela célula de 0,1° (`cell_id_for`) e só ela é
  gravada (o `CHECK` da tabela recusa coordenada); o identificador do aparelho vira HMAC-SHA-256
  com o `COMMUNITY_DEVICE_SALT` (o `CHECK` exige 64 dígitos hexadecimais) e nunca volta na
  resposta; a listagem não traz o hash, a hora do envio nem o ponto exato. Não grave nem registre
  em log o ponto ou o identificador do aparelho. Detalhes: `docs/tarefas/0047-comunidade.md`.
- **Regras da tela "Como a conta é feita"** (`GET /api/metodo`, tarefa 0049): `MethodService` escolhe no
  `regras.yaml` os números que a tela explica (`deu_certo` com o ISNA em %, `pesos` em %, `renda`, `agua` com a
  sede, `rotacao` com o bônus e as supressoras do nematoide, `plano_b`, `alertas` de geada, chuva forte e fogo,
  `avisos` e `sinal`). Só números (as frases são do front), sem banco e sem cache HTTP. Os schemas têm o prefixo
  `Metodo` para não colidir no OpenAPI com os do `/recomendacao`.
- **Avisos do ponto marcado** (`GET /api/avisos?lat&lon[&colheita][&solo][&confirmadas]`, tela "Avisos",
  remodelagem S6, tarefa 0046, RF-31). Roda o motor uma vez (`RecommendationService.recommend`, com a mesma
  colheita, solo e safras confirmadas do `/recomendacao`) e junta quatro grupos. O `AvisosService` só busca e
  monta; as regras ficam em `AvisosAgoraService`, `AvisosMudancaService` e `AvisosVizinhosService`, com os números
  no grupo `avisos_tela` do `regras.yaml` (à parte do `avisos` do replay P4/P6, que não muda). Reaproveita sem
  repetir: o dia seco (`avisos.dia_seco_abaixo_mm`), o calor (`clima.calor_temp_c`), as janelas de março a maio do
  raio-X (`raio_x.veranico_*`, `calor_*`), o fim das chuvas (`RainEndService`), a estação e a chance mínima da
  previsão do ENSO (`sinal_enso`), o raio da comunidade (`comunidade.raio_km`) e a regra de avisos do replay
  (`CropAlertService`). Só números: as frases são do front.
  - **Resposta:** `ponto`, `celula_id`, `hoje` (dia de Uberlândia, UTC−3), `contador` (avisos de `agora` e de
    `perto`; desde a tarefa 0062 o front não usa mais esse número: o sino e o resumo da tela contam só os cartões
    de `agora`, porque o "Perto de você" saiu da tela), `agora`, `mudou`, `periodo` (`recente_inicio`, `recente_fim`,
    `antes_inicio`, `antes_fim`), `recordes`, `perto`, `raio_km`, `vizinhos_dias` e `safrinha` (`em_andamento`,
    `cultura`, `nome`, `semeadura`, `colheita`, `explorar_ano`). Cada grupo é `{avisos, ultima_leitura}`: `null` =
    sem dado (o front não desenha); `avisos: []` = "Nada fora do normal" com a `ultima_leitura`.
  - **Cada aviso:** `tipo`, `nivel` (`atencao` ou `fique_de_olho`), `fontes` (`smap`, `nasa_power`, `gpm_imerg`,
    `noaa`, `comunidade`), `data` (da leitura), `antiga` (SMAP com mais de `smap_antiga_dias`) e `valores`:
    `terra_seca` (`percentil`, `mais_seca_que_pct` = 100 − percentil), `dias_sem_chuva` (`dias`, `desde`,
    `no_minimo`), `calor` (`dias`, `janela_dias`, `temp_c`), `enso` (`fase`, `chance_pct`, `estacao`, `ano`,
    `cultura`, `nome`, `anos_fase`, `bons_fase`, `anos_outros`, `bons_outros`, `ano_inicio`, `ano_fim`; o histórico
    é `null` sem o ONI), `safrinha_veranico` e `safrinha_calor` (`dias`, `cultura`, `nome`; o calor com `temp_c`),
    `mudou_veranico`, `mudou_calor` (com `temp_c`) e `mudou_falta_agua` (com `cultura` e `nome`) (`antes`,
    `recente`), `mudou_fim_chuvas` (`antes`, `recente` em "MM-DD", `diferenca_dias`), `mudou_deu_certo`
    (`antes_bons`, `antes_total`, `recente_bons`, `recente_total`, `cultura`, `nome`), `recorde_veranico` (`dias`,
    `ano`, `inicio`), `recorde_outono_seco` (`chuva_mm`, `ano`, `media_mm`), `recorde_fim_chuvas` (`dia`, `ano`),
    `recorde_calor` (`dias`, `ano`, `temp_c`) e `vizinho_evento` (`evento`, `relatos`).
  - **NASA POWER recente** (`PowerRecentWeatherRepository`, `get_recent_weather_repository`): os
    `avisos_tela.power_dias` (30) dias até ontem no centro da célula de 0,1°, pela mesma API diária da pré-carga
    (sem chave). Cache na memória do processo por 24 h, por célula e janela; falha ou mais de 8 s = `None` (os
    avisos dele não aparecem) e 15 min de espera antes de tentar de novo. A última leitura é o último dia com
    chuva e máxima (o POWER sai com ~2 a 3 dias de atraso). A chuva recente nunca é comparada com "o normal": a
    série guardada só tem janeiro a julho.
  - **El Niño / La Niña** (`enso`): os `valores` levam também o `sinal` (`normal`, `seco`, `incerto` ou `null`), o
    veredito do sinal do outono do `/recomendacao` (o mesmo do Plano de 3 anos com o plano sugerido), para o "o
    que fazer" do front dar o mesmo conselho que a tela do Plano (tarefa 0049).
  - **Safrinha:** semeadura = o dia do motor para a faixa no ano de hoje; colheita = semeadura + ciclo da melhor
    opção; `em_andamento` com hoje entre as duas (o "hoje" é injetado no service). Fora dela, `explorar_ano` é o
    último ano da série (desde a tarefa 0062, o front abre o modal "Ver exemplo: avisos de <ano>" com o replay
    `/api/safra-passada` daquele ano e os recordes do mesmo ano).
  - **Falta de água** do grupo `mudou`: ETc − ETr no ciclo da melhor opção, com o balde do motor (SMAP do dia de
    plantar ou 50% da CAD; `cycle_deficits` em `avisos_mudanca_service.py`).
  - Sem banco, `perto` é `null` (a comunidade responde 503 por dentro). Erros como no `/recomendacao` (404
    `OUTSIDE_AREA`, 422). Sem cache HTTP.
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

## Contrato dos dados das fontes

Formato que os scripts de dados gravam e a API lê: em arquivo JSON agora, em tabela depois da
migração R1.6 (`docs/roteiro-de-implementacao.md`). Os models de `app/models/` validam cada registro
e recusam o que sai do contrato com `ValueError` (testes em `tests/unit/models/`).

Regras gerais:

- JSON em UTF-8 com chaves em português, como a fixture do clima. Colunas do banco em inglês.
- Datas `AAAA-MM-DD`. Horas em ISO 8601 com fuso (`2026-11-14T13:00:00Z`).
- Coordenadas WGS 84 em graus decimais. O ponto vira chave de cache com `point_key` (0,0025°,
  `app/repositories/point_cache.py`); na tabela, `key` + `geom`.
- Chaves de fonte estáveis: `nasa_power`, `soilgrids`, `nex_gddp_cmip6`, `modis_mod13q1`, `smap` e
  `gpm_imerg` (a que o front já procura; decidida em 14/11, tarefa 0027), mais `imerg_late`
  (chuva recente, A2.3) e `modis_mcd64a1` (área queimada, tarefa 0043). Fora da NASA: `noaa_oni` (ONI da NOAA) e `noaa_cpc_enso` (previsão do
  ENSO da NOAA CPC, tarefa 0038), só em arquivo.
- Todo arquivo traz `versao_dados`, a execução que o gerou.
- Sem valor: campo ausente ou `null`. Nunca `-999`, zero ou número inventado, e nunca dado
  sintético com uma dessas chaves de fonte.

### Versão dos dados: `DataRun` (`app/models/data_run.py`)

| JSON (`versao_dados`) | Model | Tabela `data_run` | Exemplo |
| --- | --- | --- | --- |
| `fonte` | `source` | `source text` | `nex_gddp_cmip6` |
| `parametros` | `params` | `params jsonb` | produto e versão, modelos, cenário, anos, pontos |
| `fim` | `finished_at` (com fuso) | `finished_at timestamptz` | `2026-11-14T13:00:00Z` |
| `versao` | `version` | `version text` (criada no R1.6) | `2026.11-nex-gddp-cmip6` |

Hoje o `versao_dados` da resposta é a constante `DATA_VERSION` (`app/constants.py`). O R3.5 passa a
montá-lo a partir das linhas de `data_run`.

### CMIP6: `Cmip6Delta` (`app/models/climate.py`)

Um registro por modelo e mês: média de 2041–2060 contra 1995–2014, SSP2-4.5. `cobertura` é a área
a que os deltas valem (a célula do POWER, como na fixture do clima). A lista `cmip6` tem o mesmo
formato da `cmip6[]` da fixture. O `FileCmip6Repository` lê este arquivo (`CMIP6_PATH`).

```json
{
  "versao_dados": {"fonte": "nex_gddp_cmip6", "parametros": {"cenario": "ssp245"}, "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-nex-gddp-cmip6"},
  "pontos": [
    {
      "lat": -18.9543, "lon": -48.1993,
      "cobertura": {"lat_min": -19.25, "lat_max": -18.75, "lon_min": -48.4375, "lon_max": -47.8125},
      "cmip6": [
        {"modelo": "ACCESS-CM2", "cenario": "ssp245", "mes": 3, "chuva_pct": -8.5, "tmax_c": 1.6, "tmin_c": 1.2}
      ]
    }
  ]
}
```

| JSON | Model | Coluna | Regra |
| --- | --- | --- | --- |
| `modelo` | `model` | `model text` | nome do NEX-GDDP (ex.: `ACCESS-CM2`) |
| `cenario` | `scenario` | `scenario text` | `ssp245` |
| `mes` | `month` | `month smallint` | 1 a 12 (o MVP usa jan–jul) |
| `chuva_pct` | `rain_pct` | `rain_pct real` | (futuro ÷ base − 1) × 100; nunca menor que −100 |
| `tmax_c` | `tmax_c` | `tmax_c real` | futuro − base, em °C |
| `tmin_c` | `tmin_c` | `tmin_c real` (pode ser nulo) | opcional: só com o `tasmin` (decisão pendente) |

- Conversões no script: `pr` × 86.400 → mm/dia; `tasmax` e `tasmin` − 273,15 → °C.
- Tabela criada no R1.6: `cmip6_delta (cell_id, model, scenario, month, rain_pct, tmax_c,
  tmin_c)`, chave `(cell_id, model, scenario, month)`. Substitui a tabela agregada da migração inicial.
- O `FileCmip6Repository` e o `FixtureClimateRepository` leem o `tmin_c` (R3.1); ausente ou `null`
  fica `None`.

### NDVI: `NdviRecord` (`app/models/talhao.py`)

Uma observação de 16 dias por ponto, já sem neve e sem nuvem. O arquivo é o que o
`CachedNdviRepository` lê (`NDVI_CACHE_PATH`).

```json
{
  "versao_dados": {"fonte": "modis_mod13q1", "parametros": {"produtos": ["MOD13Q1", "MYD13Q1"]}, "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-modis-ndvi"},
  "pontos": [
    {
      "lat": -18.9543, "lon": -48.1993,
      "serie": [
        {"data": "2016-04-06", "ndvi": 0.71, "qualidade": 0, "produto": "MOD13Q1"},
        {"data": "2016-04-14", "ndvi": 0.69, "qualidade": 1, "produto": "MYD13Q1"}
      ]
    }
  ]
}
```

| JSON | Model | Coluna | Regra |
| --- | --- | --- | --- |
| `data` | `data` | `date date` | data da composição de 16 dias |
| `ndvi` | `ndvi` | `ndvi real` | físico, com o fator 0,0001 já aplicado (−0,2 a 1). O model ainda aceita o bruto do cache antigo; −3000 (sem dado) é recusado |
| `qualidade` | `qualidade` | `quality smallint` | `pixel_reliability` (ORNL e AppEEARS) ou `SummaryQA`: só 0 (bom) e 1 (aceitável) |
| `produto` | `produto` | `product text` | `MOD13Q1` (Terra) ou `MYD13Q1` (Aqua), coleção 061 |

- Tabela criada no R1.6: `ndvi_point (key, date, product, ndvi, quality)`, chave
  `(key, date, product)`.
- `qualidade` e `produto` são opcionais no model só por causa do cache antigo (`data` e `ndvi`).
  Arquivo novo traz os quatro campos, e o `CachedNdviRepository` lê os quatro desde o R3.2.
- A série vai de **janeiro a julho** de cada ano: abril a julho para o histórico (PRD 7.8) e janeiro a
  março para a colheita sugerida (PRD 7.9).

### NDVI por área (tarefa 0050): índice + ladrilhos (`app/repositories/ndvi_grid_repository.py`)

O que o `pipeline/fetch_ndvi_area.py` grava e o `GridNdviRepository` lê (`NDVI_AREA_PATH`). Só
biblioteca padrão (`array`, `struct`, `zlib`), sem numpy. O resultado de um ponto é o mesmo
`NdviRecord` do contrato do NDVI (acima): só observação boa, NDVI físico com 4 casas.

```json
{
  "versao_dados": {"fonte": "modis_mod13q1", "parametros": {"tipo": "ndvi_area", "anos": [2017, 2026], "ladrilhos_prontos": 12, "completo": true}, "fim": "2026-11-16T03:00:00Z", "versao": "2026.11-modis-ndvi-area"},
  "formato": {"nome": "raiz-orbital-ndvi-area", "versao": 1, "linhas_por_bloco": 8, "sem_observacao": -32768},
  "fonte": "MODIS MOD13Q1 + MYD13Q1",
  "fator_escala": 0.0001,
  "grade": {"projecao": "sinusoidal_modis", "raio_m": 6371007.181, "pixel_m": 231.656358264, "x_oeste_m": -20015109.355797417, "y_norte_m": 10007554.677898709},
  "datas": [["2017-01-01", "MOD13Q1"], ["2017-01-09", "MYD13Q1"]],
  "area": {"lat_min": -19.9, "lat_max": -18.4, "lon_min": -49.0, "lon_max": -47.5},
  "ladrilhos": [{"arquivo": "ladrilhos/r52392_c64443.bin", "linha": 52272, "coluna": 64323, "linhas": 241, "colunas": 241, "centro": {"lat": -19.15104, "lon": -48.42256}, "bytes": 23300000}]
}
```

- `grade`: a grade **global** do MODIS (origem em (−πR, πR/2)); `linha`/`coluna` de cada ladrilho
  são o pixel global do canto noroeste, tirados do cabeçalho do recorte da ORNL.
- `datas`: a ordem das datas dentro de cada ladrilho (Terra e Aqua nunca no mesmo dia).
- **Ladrilho** (binário, little endian): cabeçalho `<8sHHIIIIIII` (`RZNDVIGR`, versão 1, linhas por
  bloco, linha e coluna globais, linhas, colunas, número de datas, CRC32 de `data:produto;...` e
  número de blocos), a tabela de onde começa cada bloco (`uint64`, um a mais no fim) e os blocos. Um
  bloco = até 8 linhas de pixels, zlib; descomprimido, data a data na ordem de `datas`, os pixels das
  linhas do bloco: primeiro todos os bytes altos do NDVI bruto (int16), depois os baixos, depois a
  qualidade (uint8). Sem observação boa: NDVI −32768 e qualidade 255.
- Ladrilho com outras datas (CRC diferente) ou noutra posição que a do índice: `ValueError`.
- Tamanho medido (NDVI real da região): ~1,48 byte por pixel e data = ~23 MB por ladrilho de 241 ×
  241 × 270; ler um ponto descomprime um bloco (~1,5 MB), 1 a 2 ms. Detalhes: tarefa 0050.

### SMAP: `SmapSoilMoisture` (`app/models/climate.py`)

Uma linha por ponto e data, com a média do dia do SMAP L4 (`SPL4SMGP`, de 3 em 3 horas). A versão do
produto vai em `versao_dados.parametros`, não em cada linha. O `pipeline/fetch_smap.py` grava a 008,
com um ponto por centro de célula de 0,1° e, opcionalmente, o pixel de 9 km usado (`pixel_9km`, só
para conferência: quem lê pode ignorar). O `FileSmapRepository` lê este arquivo.

```json
{
  "versao_dados": {"fonte": "smap", "parametros": {"produto": "SPL4SMGP.008"}, "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-smap-l4"},
  "pontos": [
    {
      "lat": -18.95, "lon": -48.15,
      "pixel_9km": {"linha": 1075, "coluna": 1412, "lat": -18.9403, "lon": -48.1276},
      "serie": [
        {"data": "2024-02-18", "sm_rootzone_wetness": 0.62, "sm_rootzone_m3_m3": 0.31, "sm_surface_m3_m3": 0.27}
      ]
    }
  ]
}
```

| JSON | Model | Coluna | Regra |
| --- | --- | --- | --- |
| `data` | `data` | `date date` | dia |
| `lat`, `lon` (do ponto) | `latitude`, `longitude` | `key` + `geom` | WGS 84 |
| `sm_rootzone_wetness` | `sm_rootzone_wetness` | `sm_rootzone_wetness real` | 0 a 1; o motor usa para o balde inicial (PRD 7.2) |
| `sm_rootzone_m3_m3` | `sm_rootzone_m3_m3` | `sm_rootzone_m3_m3 real` | m³/m³, 0 a 1 |
| `sm_surface_m3_m3` | `sm_surface_m3_m3` | `sm_surface_m3_m3 real` (pode ser nulo) | m³/m³, 0 a 1; opcional |
| `versao_dados.fonte` | `fonte` | — | `smap` |

- Tabela criada no R1.6: `smap_point (key, geom, date, sm_rootzone_wetness, sm_rootzone_m3_m3,
  sm_surface_m3_m3)`, chave `(key, date)`. Substitui a `smap_moisture` por célula da migração inicial.
- Antes de 2015 não há SMAP. O percentil (`sm_rootzone_pctl`, A2.2) não faz parte deste registro:
  ele vai no ponto do arquivo do SMAP recente (abaixo).

#### SMAP recente (A2.2): o mesmo contrato, com o percentil no ponto

O `pipeline/fetch_smap.py --recente` grava o contrato SMAP com um dia só na `serie` (o dia completo
mais recente) e, em cada ponto, `sm_rootzone_pctl` (0 a 100, uma casa; `null` sem climatologia
suficiente). O `versao_dados.parametros` traz `modo: "recente"`, a `data` e a `climatologia`
(`variavel`, `anos`, `janela_dias`, `dias`, `dias_incompletos`, `minimo_de_anos`). O
`FileRecentSoilMoistureRepository` lê o arquivo (`SMAP_RECENTE_PATH`) como `RecentSoilMoisture`.

```json
{
  "versao_dados": {"fonte": "smap", "parametros": {"produto": "SPL4SMGP.008", "modo": "recente", "data": "2026-11-10", "climatologia": {"anos": [2016, 2025], "janela_dias": 7, "dias": 150}}, "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-smap-l4-recente"},
  "pontos": [
    {
      "lat": -18.95, "lon": -48.15, "sm_rootzone_pctl": 34.5,
      "serie": [{"data": "2026-11-10", "sm_rootzone_wetness": 0.41, "sm_rootzone_m3_m3": 0.2, "sm_surface_m3_m3": 0.18}]
    }
  ]
}
```

### IMERG: `ImergCellSeries` e `ImergSeason` (`app/models/climate.py`)

Chuva diária do GPM IMERG Final (`GPM_3IMERGDF` versão 07, 0,1°) por **célula de 0,1° do projeto**:
a grade do IMERG tem centros em x,x5, então cada célula (`cell_id_for`, `floor`) é exatamente um
pixel. O arquivo é a saída do `pipeline/fetch_imerg.py` (R2.4).

```json
{
  "versao_dados": {"fonte": "gpm_imerg", "parametros": {"produto": "GPM_3IMERGDF", "versao_produto": "07", "versoes_arquivo": ["V07B"], "anos": [2005, 2024], "temporada": {"inicio": "01-01", "dias": 212}}, "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-gpm-imerg"},
  "celulas": [
    {
      "celula": "-190_-482", "lat": -18.95, "lon": -48.15,
      "temporadas": [
        {"ano": 2005, "inicio": "2005-01-01", "chuva_mm": [0.0, 12.41, null, 3.07]}
      ]
    }
  ]
}
```

| JSON | Model | Regra |
| --- | --- | --- |
| `celula` | `ImergCellSeries.cell_id` | id `floor` do projeto (`<floor(lat×10)>_<floor(lon×10)>`) |
| `lat`, `lon` | `latitude`, `longitude` | o **centro** da célula ((idx + 0,5) / 10), que é o centro do pixel do IMERG |
| `ano` | `ImergSeason.year` | sem ano repetido na célula |
| `inicio` | `start_date` | sempre 1/jan do `ano` |
| `chuva_mm` | `rain_mm` | **212 dias** desde 1/jan (a janela do `ClimateSeasonBuilder`: no bissexto, até 30/jul), em mm (o `precipitation` do IMERG é mm/dia), 2 casas; `null` = sem dado |

- **Dia sem dado → `null`, nunca 0 inventado:** dia sem arquivo no GES DISC (o
  `versao_dados.parametros.dias_sem_arquivo` conta) ou pixel com o valor de preenchimento (−9999,9).
  Chuva negativa é recusada.
- **Ano com dia faltando continua no arquivo** (`ImergSeason.complete` é falso): a regra de descarte
  fica para quem usa.
- `versao_dados.parametros` traz também a variável e a unidade, o serviço, a caixa, o retângulo de
  pixels e o número de células.
- Não há tabela própria: a carga (`load_files_to_db.py --imerg`, tarefa 0027) leva os anos completos
  para o `rain_mm` do `climate_season`, com `rain_source = gpm_imerg`. O `FileImergRepository`
  (`app/repositories/imerg_repository.py`) lê o arquivo nos models.

### ONI: `OniYear` (`app/models/enso.py`)

Um registro por ano de safrinha: a média do ONI nas estações do `regras.yaml` (grupo `enso`) e a fase
do ENSO. O `FileEnsoRepository` lê este arquivo (`ONI_PATH`). Os limiares e as estações usados vão
em `versao_dados.parametros`. Não tem tabela no banco.

```json
{
  "versao_dados": {"fonte": "noaa_oni", "parametros": {"url": "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt", "estacoes": ["DJF", "JFM", "FMA"], "el_nino_oni_min": 0.5, "la_nina_oni_max": -0.5, "anos": [2005, 2024]}, "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-noaa-oni"},
  "anos": [
    {"ano": 2016, "oni": 2.13, "fase": "el_nino"},
    {"ano": 2023, "oni": -0.33, "fase": null}
  ]
}
```

| JSON | Model | Regra |
| --- | --- | --- |
| `ano` | `ano` | ano da safrinha (o DJF de 2016 é dez/2015 a fev/2016); 1950 ou depois |
| `oni` | `oni` | média das estações, em °C, com 2 casas; finito e entre −5 e +5 (recusa marcas como −99,9) |
| `fase` | `fase` | `el_nino`, `la_nina` ou `null` (neutro); ausente vale `null` |

### Previsão do ENSO: `EnsoForecast` (`app/models/enso_forecast.py`)

A chance oficial (em %) de La Niña, neutro e El Niño de uma emissão da NOAA CPC, por estação de 3
meses (tarefa 0038). O `FileEnsoForecastRepository` lê este arquivo (`ENSO_PREVISAO_PATH`); vem do
`pipeline/fetch_enso_previsao.py`. Não tem tabela no banco.

```json
{
  "versao_dados": {"fonte": "noaa_cpc_enso", "parametros": {"produto": "Official NOAA CPC ENSO Probabilities", "url": "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/", "url_discussao": "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml", "indice": "RONI (...)", "emitida": "2026-11", "estacoes": ["OND", "JJA"]}, "fim": "2026-11-15T03:21:00Z", "versao": "2026.11-noaa-cpc-enso"},
  "fonte": "NOAA",
  "emitida_em": "2026-11-12",
  "estacoes": [
    {"estacao": "FMA", "ano": 2027, "la_nina": 0, "neutro": 2, "el_nino": 98},
    {"estacao": "MAM", "ano": 2027, "la_nina": 0, "neutro": 20, "el_nino": 80}
  ]
}
```

| JSON | Model | Regra |
| --- | --- | --- |
| `fonte` | `EnsoForecast.fonte` | nome curto que vai na frase do sinal ("NOAA"); não vazio |
| `emitida_em` | `EnsoForecast.emitida_em` | dia da emissão (da discussão); vira o `data` do sinal |
| `estacoes[].estacao` | `estacao` | código da NOAA (DJF ... NDJ); na ordem, de mês em mês |
| `estacoes[].ano` | `ano` | ano do mês do meio (o DJF de 2027 é dez/2026 a fev/2027) |
| `estacoes[].la_nina`, `neutro`, `el_nino` | idem | inteiros de 0 a 100; somam 100 ± 2 (arredondamento da NOAA) |

### Região pelo satélite: `RegiaoSatelite` (`app/models/regiao.py`)

Uma região por centro e raio, com os percentuais da soja do ano na entressafra de cada ano (tarefa
0036). O `pipeline/fetch_regiao_ndvi.py` grava e o `FileRegionRepository` lê (`REGIAO_PATH`). Só
totais e percentuais: nenhum pixel nem ponto individual (RNF-10). Números ilustrativos:

```json
{
  "versao_dados": {"fonte": "modis_mod13q1", "parametros": {"servico": "ornl_daac", "tipo": "regiao", "mascara": {"produto": "MCD12Q1.061", "camada": "LC_Type1", "classes": [12]}, "soja_do_ano": {"pico_inicio": "01-01", "pico_fim": "03-15", "pico_min_ndvi": 0.7, "colheita_fim": "05-15", "colheita_max_ndvi": 0.4, "entressafra_fim": "07-31"}, "janelas_pedidas": ["01-01 a 03-31", "04-01 a 07-31"]}, "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-modis-ndvi-regiao"},
  "regioes": [
    {
      "lat": -18.9543, "lon": -48.1993, "raio_km": 30.0,
      "fonte": "MODIS MOD13Q1 + MYD13Q1", "mascara": "soja do ano (pico e colheita) em MCD12Q1 LC_Type1 classe 12",
      "anos": [
        {"ano": 2016, "n_pixels_lavoura": 13412, "n_pixels": 6120, "pct_parado": 62.0, "pct_plantou": 29.0, "pct_incerto": 9.0, "pct_sem_dado": 1.5},
        {"ano": 2017, "n_pixels_lavoura": 12980, "n_pixels": 0, "pct_parado": null, "pct_plantou": null, "pct_incerto": null, "pct_sem_dado": null}
      ]
    }
  ]
}
```

| JSON | Model | Regra |
| --- | --- | --- |
| `lat`, `lon` | `lat`, `lon` | centro da região, WGS 84 |
| `raio_km` | `raio_km` | maior que zero |
| `fonte`, `mascara` | `fonte`, `mascara` | textos não vazios (produtos do NDVI e de onde vem a soja) |
| `anos[].ano` | `RegiaoAno.ano` | sem ano repetido na região |
| `anos[].n_pixels_lavoura` | `n_pixels_lavoura` | pixels de 250 m da máscara de lavoura (MCD12Q1 classe 12) dentro do raio; nunca menor que `n_pixels`; ausente (arquivo de antes da tarefa 0036) vira `None` |
| `anos[].n_pixels` | `n_pixels` | pixels da máscara com pico e colheita da soja no ano (grupo `regiao_ndvi`), 0 ou mais. No arquivo antigo, os pixels da máscara |
| `anos[].pct_parado`, `pct_plantou`, `pct_incerto` | idem | 0 a 100, sobre os pixels de soja classificados, somam 100 (±0,2 do arredondamento); os três `null` sem pixel classificado |
| `anos[].pct_sem_dado` | `pct_sem_dado` | 0 a 100, sobre `n_pixels` (menos de 3 observações boas depois da colheita); `null` só com `n_pixels` 0; 100 quando nenhum foi classificado |

- `versao_dados.fonte` = `modis_mod13q1` (a mesma chave do NDVI do talhão); os `parametros` dizem o
  serviço (`ornl_daac`), a máscara (produto, camada, classes e o ano usado em cada ano), a regra da
  soja do ano (`soja_do_ano`), as janelas pedidas, a janela do talhão, os anos, os limites, o raio,
  a caixa pedida (`km_pedido`) e o número de pedidos.
- A resposta da API (`RegiaoResponse`) junta `centro: {lat, lon}` e `distancia_km`, que não estão no
  arquivo: o `RegionService` calcula para cada ponto pedido (ver "Dados da API").
- Ainda não há tabela: a API lê o arquivo. O guia NDVI propõe a `regiao_entressafra` no PostGIS.

### Área queimada: `MapaAreaQueimada` (`app/models/area_queimada.py`)

Os pixels de 500 m do MODIS MCD64A1 que queimaram em algum ano (tarefa 0043), numa grade da
projeção sinusoidal do MODIS (a mesma `GradeSinusoidal` da soja recente, com o pixel de 463,31 m =
2πR ÷ 86.400). O `pipeline/fetch_area_queimada.py` grava e o `FileAreaQueimadaRepository` lê
(`AREA_QUEIMADA_PATH`); recusa arquivo com `versao_dados.fonte` diferente de `modis_mcd64a1`.
Números ilustrativos:

```json
{
  "versao_dados": {"fonte": "modis_mcd64a1", "parametros": {"servico": "ornl_daac", "produto": "MCD64A1", "colecao": "061", "banda": "Burn_Date", "anos": [2016, 2025], "ladrilhos": 12, "pedidos": 240}, "fim": "2026-11-15T13:00:00Z", "versao": "2026.11-modis-mcd64a1"},
  "fonte": "MODIS MCD64A1",
  "anos": [2016, 2025],
  "grade": {"projecao": "sinusoidal_modis", "raio_m": 6371007.181, "x_oeste_m": -5085053.4, "y_norte_m": -2022839.2, "pixel_m": 463.3127165693847, "linhas": 361, "colunas": 440},
  "queimadas": [[12, 40, [2017, 2021]], [13, 40, [2021]]]
}
```

| JSON | Model | Regra |
| --- | --- | --- |
| `fonte` | `fonte` | texto não vazio (vai no alerta) |
| `anos` | `ano_inicio`, `ano_fim` | o período baixado, em ordem |
| `grade` | `GradeSinusoidal` | como na soja recente (linha 0 no norte, coluna 0 a oeste) |
| `queimadas[]` | `(linha, coluna, anos)` | só os pixels que queimaram; dentro da grade; anos não vazios e dentro de `anos` |

- O repository devolve os pixels queimados no quadrado de ±`km` em volta do ponto, com o centro de
  cada um (`QueimadasPerto`); o raio exato e a contagem dos anos ficam no `BurnedAreaService`.
- Não há tabela: a API lê o arquivo. A comunidade (seção 7) pode mostrar os mesmos pixels no mapa.

### Chuva recente: `RecentRainRecord` (`app/models/recent_rain.py`)

Uma linha por célula de 0,1°: a chuva dos últimos `dias` dias pelo IMERG Late (`GPM_3IMERGDL` v07) e
a média dos mesmos dias. O `FileRecentRainRepository` lê este arquivo (`IMERG_LATE_PATH`) e o
recusa se o `versao_dados.fonte` não for `imerg_late`. Vem do `pipeline/fetch_imerg_late.py`.

```json
{
  "versao_dados": {"fonte": "imerg_late", "parametros": {"produto": "GPM_3IMERGDL.07", "inicio": "2027-01-30", "fim": "2027-02-28", "dias": 30, "media": {"fonte": "nasa_power", "variavel": "PRECTOTCORR"}}, "fim": "2027-03-01T12:00:00Z", "versao": "2027.03-imerg-late"},
  "celulas": [
    {"cell_id": "-190_-482", "lat": -18.95, "lon": -48.15, "data": "2027-02-28", "dias": 30, "chuva_30d_mm": 85.3, "media_30d_mm": 190.2, "fracao_da_media": 0.4485, "anos_media": 20}
  ]
}
```

| JSON | Model | Regra |
| --- | --- | --- |
| `cell_id` | `cell_id` | id do `cell_id_for` (o pixel do IMERG é a célula) |
| `lat`, `lon` | `lat`, `lon` | centro da célula (x,x5), WGS 84 |
| `data` | `data` | último dia somado |
| `dias` | `dias` | dias somados (padrão 30), maior que zero |
| `chuva_30d_mm` | `chuva_30d_mm` | soma do IMERG Late, mm, uma casa; nunca negativa (célula com dia sem dado não entra) |
| `media_30d_mm` | `media_30d_mm` | média do NASA POWER guardado nos mesmos dias dos anos anteriores, mm; maior que zero |
| `fracao_da_media` | `fracao_da_media` | `chuva_30d_mm ÷ media_30d_mm`, 4 casas; o model recusa fração que não bate com a conta |
| `anos_media` | `anos_media` | anos do POWER que entraram na média, pelo menos 1 |

- O `RecentRain` (`to_recent_rain()`: `chuva_mm`, `media_mm`, `dias`, `data`) era a chuva do sinal
  pela regra do PRD 7.10; desde a tarefa 0038 o sinal não usa mais esta chuva (fica no repositório).
- Ainda não há tabela: é dado de agora, regravado perto do plantio (fev/mar).

### Soja recente: `MapaSojaRecente` (`app/models/soja_recente.py`)

O maior NDVI de cada pixel de 250 m do MODIS na janela da safra mais recente (RF-24), numa grade
da **projeção sinusoidal do MODIS** (a do cabeçalho dos recortes da ORNL), com o pico em
**centésimos** (0,86 → 86). O `pipeline/fetch_soja_recente.py` grava e o
`FileSojaRecenteRepository` lê (`SOJA_RECENTE_PATH`). A grade é a da caixa piloto; os picos são
ilustrativos (e só 2 × 4 dos 721 × 880):

```json
{
  "versao_dados": {"fonte": "modis_mod13q1", "parametros": {"servico": "ornl_daac", "tipo": "soja_recente", "ano": 2026, "safra": "2025/26", "janela": "01-01 a 03-15", "min_observacoes": 2, "ladrilhos": 12, "pedidos": 48}, "fim": "2026-11-15T13:00:00Z", "versao": "2026.11-modis-soja-recente"},
  "safra": "2025/26",
  "fonte": "MODIS MOD13Q1 + MYD13Q1",
  "grade": {"projecao": "sinusoidal_modis", "raio_m": 6371007.181, "x_oeste_m": -5170106.6, "y_norte_m": -2045757.3, "pixel_m": 231.65635828469235, "linhas": 721, "colunas": 880},
  "pico_centesimos": [
    [86, 84, null, 41],
    [79, 12, 70, 69]
  ]
}
```

| JSON | Model | Regra |
| --- | --- | --- |
| `safra` | `safra` | `AAAA/AA` da soja colhida no ano (`2025/26` = colhida em 2026) |
| `fonte` | `fonte` | produtos do NDVI (texto não vazio) |
| `grade.x_oeste_m`, `grade.y_norte_m` | `GradeSinusoidal` | canto de cima à esquerda da grade, em metros na projeção sinusoidal (esfera de `raio_m` = 6.371.007,181 m) |
| `grade.pixel_m` | `pixel_m` | lado do pixel (231,66 m = 2πR ÷ 172.800), maior que zero |
| `grade.linhas`, `grade.colunas` | `linhas`, `colunas` | 1 ou mais; `pico_centesimos` tem exatamente essas linhas e colunas |
| `pico_centesimos[linha][coluna]` | idem | inteiro de −20 a 100 (NDVI × 100, **truncado**: 0,6999 → 69) ou `null` (menos observações boas que o mínimo); linha 0 no norte, coluna 0 a oeste |

- **Como achar o pixel de um ponto** (`GradeSinusoidal.pixel_at`): com φ e λ em radianos,
  `x = raio_m · λ · cos φ` e `y = raio_m · φ`; `coluna = ⌊(x − x_oeste_m) / pixel_m⌋` e
  `linha = ⌊(y_norte_m − y) / pixel_m⌋`. Fora de `0..linhas−1` ou `0..colunas−1`: fora da grade.
- **Por que essa forma:** a grade é a do próprio MODIS (cada célula é um pixel, sem reamostrar), os
  ladrilhos da ORNL entram nela pelo cabeçalho com deslocamento inteiro, e achar o pixel é a conta
  acima (sem ler pixel a pixel). Uma linha de pixels por linha do arquivo: ~2 MB para a caixa
  piloto (721 × 880). A caixa vira um trapézio na projeção: os pixels da grade fora dela também
  têm dado (os ladrilhos cobrem o retângulo todo).
- **Truncado, não arredondado:** com o limite de 2 casas do `regras.yaml`, "pico ≥ 0,70" no
  arquivo é o mesmo que no NDVI original (arredondando, 0,6951 viraria 70).
- `versao_dados.fonte` = `modis_mod13q1`; os `parametros` dizem o serviço, os produtos, as camadas,
  a qualidade aceita, o ano e a safra, a janela, as datas de cada produto, o mínimo de observações,
  a caixa (`area`), o `km_pedido`, os ladrilhos, os pedidos e a contagem dos `pixels` (`total`,
  `com_dado`, `sem_dado`, `sem_ladrilho`). O limite da soja **não** vai no arquivo: a API aplica o
  do `regras.yaml`.
- Não há tabela: a API lê o arquivo.

## Configuração e segredos

- Variável nova → campo em `Settings` (`app/config.py`) **e** o nome (sem valor real) em `.env.example`.
  Nunca leia `os.environ` espalhado pelo código; use `get_settings()`.
- Nunca escreva credencial no código, nem em teste.
- Credenciais da NASA: só os scripts de dados usam. A API não precisa de nenhuma (ADR-0005).
  - `EARTHDATA_TOKEN`: token da Earthdata Login (urs.earthdata.nasa.gov, vale 60 dias). Serve para a
    NSIDC (SMAP) e o GES DISC (IMERG). O AppEEARS recusa esse token (403).
  - `APPEEARS_TOKEN`: token próprio do AppEEARS, de `POST /api/login` (vale cerca de 48 h). Sem ele, o
    script faz o login com `EARTHDATA_USERNAME` e `EARTHDATA_PASSWORD`.
  - `EE_PROJECT` é legado (Earth Engine fora do MVP) e sai quando a ADR-0005 for aceita.
- `COMMUNITY_DEVICE_SALT` (a API usa, tarefa 0047): sal do hash do identificador do aparelho nos
  relatos da comunidade. Segredo, só no ambiente (gere um valor longo e aleatório). Vazio: um sal
  aleatório por processo (os relatos continuam anônimos, mas o limite por dia e o "apagar o meu"
  recomeçam quando a API reinicia). Trocar o sal tem o mesmo efeito.

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
