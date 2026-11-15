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
  `VALIDATION_ERROR`) e o parâmetro inválido da requisição (422 `INVALID_REQUEST`, com a lista
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
- Tabelas (migração inicial `cb6b775d83e3` + R1.6 `6e961f333ddc`):
  - `grid_cell`, `climate_season` e `soil_point`: gravadas pela busca sob demanda (ver "Dados da API");
    o `climate_season.rain_source` é `nasa_power` ou, nos anos trocados pela carga do IMERG,
    `gpm_imerg`;
  - `cmip6_delta`, `ndvi_point`, `smap_point` e `data_run` (com `version`): no formato do "Contrato
    dos dados das fontes", abaixo. `PostgisCmip6Repository`, `PostgisNdviRepository`,
    `PostgisSmapRepository` e `PostgisDataRunRepository` gravam e leem. A API já lê o `cmip6_delta`
    (R3.1, ver "Deltas do CMIP6 na API"), mas ainda não lê as outras (R3.2, R3.3 e R3.5 do
    roteiro). O `cmip6_delta` exige a célula em `grid_cell`. O `cmip6_delta` e o `ndvi_point`
    são preenchidos pela carga dos arquivos (`pipeline/load_files_to_db.py`, ver "Dados da API").
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
  `CLIMA_PATH`, `SOLO_CACHE_PATH`, `NDVI_CACHE_PATH`, `CMIP6_PATH`, `ONI_PATH`, `REGIAO_PATH`). Nunca
  coloque caminho fixo (como `/workspace/...`) num repository.
- `app/config_data/culturas.yaml`: parâmetros do PRD (seção 5 e nota de solo da 7.4).
- `app/config_data/regras.yaml`: limiares, pesos, rótulos e modelos de frase pt/en do motor (PRD 7),
  cada número com `valor` e `fonte` (o `YamlRulesRepository` recusa número sem fonte). Regra de
  negócio nova com número vai para lá, não para `app/constants.py`. Os services recebem as regras
  por parâmetro (padrão: este arquivo) e `dependencies.py` injeta as do `REGRAS_PATH`.
- **Avisos da safra** (tarefa 0019): as regras de veranico e calor (grupos `avisos` e
  `frases_safra` do `regras.yaml`) ficam só no `CropAlertService`, que recebe a série diária, a
  cultura e a semeadura e devolve a linha do tempo. O replay `GET /api/safra-passada` (P4) usa esse
  service e o acompanhamento diário (P6) vai usar o mesmo: não repita a regra em outro lugar. A
  opção do replay é a `melhor` do `RecommendationService`. Ano sem dado num ponto que tem dados =
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

- **Carga dos arquivos no banco** (tarefas 0022 e 0027): `pipeline/load_files_to_db.py` copia o
  arquivo do CMIP6 para o `cmip6_delta`, o do NDVI para o `ndvi_point` e a chuva do IMERG para o
  `climate_season`. Não busca nada na rede. Rode depois da pré-carga (o `cmip6_delta` só aceita
  célula que já está em `grid_cell`, e o IMERG só troca temporada que já está no `climate_season`).
  Dá para passar um, dois ou os três arquivos.

  ```bash
  # da pasta projeto/backend, com DATABASE_URL apontando para o banco que recebe a carga
  uv run python -m pipeline.load_files_to_db --cmip6 <arq> --ndvi <arq> --imerg <arq> --dry-run
  uv run python -m pipeline.load_files_to_db --cmip6 <arq> --ndvi <arq> --imerg <arq>
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
  - **Conferência antes de gravar:** os arquivos são lidos primeiro. Arquivo ausente, sem
    `versao_dados`, de outra fonte (o `versao_dados.fonte` tem de ser `nex_gddp_cmip6` /
    `modis_mod13q1` / `gpm_imerg`) ou fora do contrato: nada é gravado (saída 1).
  - **Idempotente** (upsert; a chuva, update). **`data_run`:** uma linha por fonte com linhas
    gravadas, com a `version` do `versao_dados` do arquivo e, em `params`, o nome do arquivo (sem a
    pasta), as contagens e o `versao_dados.parametros` do arquivo (`parametros_do_arquivo`). No
    IMERG, as contagens são `celulas_no_arquivo`, `temporadas_no_arquivo`, `temporadas_trocadas`,
    `temporadas_incompletas` e `temporadas_sem_clima`.
  - **Células novas:** a busca sob demanda cria células depois da carga. Elas ficam sem linha no
    `cmip6_delta`, mas a API acha os deltas no arquivo (ordem tabela → arquivo, abaixo). Rodar a
    carga de novo copia essas células. A ingestão não muda.
  - O pacote do time leva a cópia do banco com as duas tabelas: quem recebe não roda a carga.
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

- **Sinal para o outono** (`sinal` de `/recomendacao`, RF-20, tarefa 0015): o `SinalOutonoService` aplica a
  regra do PRD 7.10 (limiares em `regras.yaml`, grupo `sinal_outono`) a três fontes, uma por repository
  (`app/repositories/sinal_outono_repository.py`): GEOS-S2S (A2.1), SMAP recente com percentil (A2.2) e
  chuva dos últimos 30 dias (A2.3). Até essas tarefas chegarem, o `dependencies.py` injeta o
  `NoAutumnSignalDataRepository` nas três e o campo sai `null`. Nunca preencha com previsão inventada.
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
    `/dados_baixados/nasa_modis_ndvi/ndvi_modis_appeears.json` e `REGIAO_PATH` para
    `/dados_baixados/nasa_modis_ndvi_regiao/regiao_ndvi_modis.json`. Sem o arquivo, segue sem o dado.
    Como baixar ou receber esses arquivos: `docs/como-preparar-os-dados-locais.md`.

- **NDVI do MODIS e histórico do talhão** (R3.2, tarefa 0018). Com ou sem banco, a série vem do arquivo
  do `NDVI_CACHE_PATH` (a tabela `ndvi_point` existe desde o R1.6 e a carga da tarefa 0022 a preenche,
  mas a API ainda não lê dela). O arquivo vem do
  script do R2.2 (`pipeline/fetch_ndvi.py`); sem ele, a API responde `historico: null` e colheita `meio` / `padrao`.
  - `CachedNdviRepository`: lê o formato do contrato (seção NDVI abaixo) e ainda aceita o cache antigo
    (`data`, `ndvi` bruto). Usa o ponto do arquivo **mais perto** do talhão, a até 250 m
    (`NDVI_POINT_MAX_DISTANCE_M`, um pixel do MOD13Q1); mais longe, série vazia. Descarta observação com
    qualidade 2 ou 3 ou sem `ndvi`.
  - `FieldHistoryService`: regra do talhão do guia NDVI, com os números do grupo `historico_ndvi` do
    `regras.yaml` (anos 2016 a 2025, janela `04-01` a `07-31`, mínimo de 3 observações, 0,60 e 0,45).
    Série vazia: `historico: null` (nada inventado). Com série, sempre os 10 anos:

    ```json
    "historico": {
      "anos": [{"ano": 2016, "situacao": "parado", "ndvi_max": 0.31, "n_obs": 3},
               {"ano": 2018, "situacao": "sem_dado", "ndvi_max": null, "n_obs": 1}],
      "parado": 5, "plantou": 4, "sem_certeza": 1, "total": 10,
      "fonte": "MODIS MOD13Q1 + MYD13Q1", "janela": "04-01 a 07-31"
    }
    ```

    `situacao`: `plantou`, `parado`, `incerto` ou `sem_dado`; `ndvi_max` (físico, com até 4 casas, a
    precisão do MOD13Q1) é `null` no `sem_dado`;
    `sem_certeza` = incerto + sem_dado; `total` = anos da janela; `fonte` lista os produtos que vieram
    na série (cache antigo, sem produto: só `MODIS`).
  - `porque` da recomendação: frase do histórico (modelo `frases.<língua>.historico` do `regras.yaml`,
    PRD 7.6), contando só os anos certos (parado + plantou). Sem série ou sem ano certo, não há frase.
  - `/exemplo` recomenda com a `colheita_sugerida` do talhão (PRD 7.9), não mais com `meio` fixo.
- **NDVI do MODIS** (tarefas 0017 e 0024): `pipeline/fetch_ndvi.py` traz a série de MOD13Q1 e
  MYD13Q1 (coleção 061, jan–jul de 2016 a 2025) de cada ponto e grava o arquivo do contrato do NDVI
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

  ```bash
  uv run python -m pipeline.fetch_ndvi --dry-run                 # AppEEARS: mostra o pedido, sem rede
  uv run python -m pipeline.fetch_ndvi                           # AppEEARS, fazenda de exemplo
  uv run python -m pipeline.fetch_ndvi --pontos "-18.9543,-48.1993;-17.5,-47.25"
  uv run python -m pipeline.fetch_ndvi --fonte ornl --dry-run    # ORNL: pedidos, cache e tempo
  uv run python -m pipeline.fetch_ndvi --fonte ornl              # ORNL, fazenda de exemplo
  ```
- **Chuva de cada mês** (`chuva_mensal` de `/talhao` e do talhão do `/exemplo`, gráfico da tela 3,
  tarefa 0028): o `MonthlyRainService` soma a chuva de cada mês, de janeiro a junho, em cada
  temporada da célula (as que o `get_seasons` já devolve) e tira a média entre os anos, com uma
  casa decimal. Só entra o ano cuja série cobre de 1/jan a 30/jun. `fonte` = a `rain_source` das
  temporadas (`nasa_power` hoje; com mais de uma, as chaves em ordem separadas por `+`, ex.:
  `gpm_imerg+nasa_power`). Fora da área ou sem nenhum ano completo: `null` (o front mostra "Ainda
  não conectado"). Na fazenda de exemplo (NASA POWER):

  ```json
  "chuva_mensal": {
    "meses": [{"mes": 1, "media_mm": 212.7}, {"mes": 2, "media_mm": 161.0}, {"mes": 3, "media_mm": 156.8},
              {"mes": 4, "media_mm": 74.7}, {"mes": 5, "media_mm": 31.3}, {"mes": 6, "media_mm": 12.6}],
    "anos": [2005, 2006, "...", 2024],
    "fonte": "nasa_power"
  }
  ```
- **Região pelo satélite** (P3, tarefa 0034): `GET /api/regiao?lat&lon`, no contrato do front
  (`projeto/frontend/src/models/region.ts`), lido do arquivo do `REGIAO_PATH` (com ou sem banco).
  - `pipeline/fetch_regiao_ndvi.py` pede à **ORNL DAAC** (`modis.ornl.gov/rst/api/v1`, pública,
    sem credencial) o recorte **por área** do NDVI e da `pixel_reliability` de MOD13Q1 e MYD13Q1
    (janela do `historico_ndvi`, abril a julho de 2016 a 2025) e o uso do solo **MCD12Q1**
    (`LC_Type1`). Por área porque o tempo do pedido quase não depende da área (medido em 14/11:
    ~25 s tanto para 9 × 9 quanto para 241 × 241 pixels); a ORNL aceita até 10 datas e ±100 km
    por pedido. Uma região = **41 pedidos** (10 anos × 2 produtos × 2 bandas + 1 do uso do solo),
    **~20 min** e ~30 MB de cache. O AppEEARS não foi usado: a fila estava parada.
  - Caixa pedida: a ORNL conta o km como pixels de 250 m, mas o pixel tem 231,66 m
    (`kmAboveBelow=30` devolve ±27,9 km). 30 km pedem ±33 km, e o círculo é recortado no script.
  - **Máscara de lavoura**: classe **12** do IGBP (lavouras, pelo menos 60% cultivado), do
    MCD12Q1 do mesmo ano (sem o ano, o último antes). A 14 (mosaico com vegetação natural) fica de
    fora: o cerrado e o pasto do mosaico confundiriam parado com plantou. A classe 12 também tem
    cana e café (verdes o ano todo): o "plantou" da região tende a sair alto (calibrar).
  - **Regra**: cada pixel de 250 m com o centro dentro do raio e na lavoura é classificado pelo
    `RegionClassifier`, que usa o `classify_year` e o `in_entressafra` do `FieldHistoryService`
    (a mesma regra do talhão: qualidade 0 ou 1, janela, mínimo de 3 observações, 0,60 e 0,45).
    Os pixels viram percentuais (`RegionClassifier.summarize`, 1 casa): parado, plantou e
    incerto sobre os classificados (somam 100); `pct_sem_dado` sobre todos os pixels de lavoura.
    Nenhum pixel sai do script (RNF-10).
  - **Cache e retomada**: uma resposta por arquivo (gzip) em `cache_ornl/`; parou (502, rede),
    rode de novo. Saída padrão `data/baixados/nasa_modis_ndvi_regiao/regiao_ndvi_modis.json`, a
    partir da raiz do repositório (fora do git).

    ```bash
    uv run python -m pipeline.fetch_regiao_ndvi --dry-run   # os 41 pedidos e o tempo, sem rede
    uv run python -m pipeline.fetch_regiao_ndvi             # fazenda de exemplo, raio de 30 km
    uv run python -m pipeline.fetch_regiao_ndvi --centros "-18.9543,-48.1993;-17.5,-47.25" --raio-km 30
    ```

  - **API** (`RegionService`): a região mais perto cujo círculo (`raio_km` em volta do centro)
    contém o ponto; só os anos com algum pixel classificado, em ordem. Fora de todos os círculos,
    ou sem arquivo: 404 `OUTSIDE_AREA`. Região sem lavoura: `anos: []`. Exemplo (números
    ilustrativos):

    ```json
    {"raio_km": 30.0, "fonte": "MODIS MOD13Q1 + MYD13Q1",
     "mascara": "MCD12Q1 LC_Type1 classe 12 (lavouras)",
     "anos": [{"ano": 2016, "pct_parado": 62.0, "pct_plantou": 29.0, "pct_incerto": 9.0,
               "n_pixels": 13412, "pct_sem_dado": 1.5}]}
    ```

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
  `gpm_imerg` (a que o front já procura; decidida em 14/11, tarefa 0027). Fora da NASA:
  `noaa_oni` (ONI da NOAA, só em arquivo).
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

### SMAP: `SmapSoilMoisture` (`app/models/climate.py`)

Uma linha por ponto e data, com a média do dia do SMAP L4 (`SPL4SMGP`, de 3 em 3 horas). A versão do
produto (007 ou 008) vai em `versao_dados.parametros`, não em cada linha.

```json
{
  "versao_dados": {"fonte": "smap", "parametros": {"produto": "SPL4SMGP.007"}, "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-smap-l4"},
  "pontos": [
    {
      "lat": -18.9543, "lon": -48.1993,
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
- Antes de 2015 não há SMAP. O percentil (`sm_rootzone_pctl`, A2.2) é calculado depois e não faz
  parte deste registro.

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

### Região pelo satélite: `RegiaoSatelite` (`app/models/regiao.py`)

Uma região por centro e raio, com os percentuais da lavoura na entressafra de cada ano. O
`pipeline/fetch_regiao_ndvi.py` grava e o `FileRegionRepository` lê (`REGIAO_PATH`). Só totais e
percentuais: nenhum pixel nem ponto individual (RNF-10). Números ilustrativos:

```json
{
  "versao_dados": {"fonte": "modis_mod13q1", "parametros": {"servico": "ornl_daac", "tipo": "regiao", "mascara": {"produto": "MCD12Q1.061", "camada": "LC_Type1", "classes": [12]}}, "fim": "2026-11-14T13:00:00Z", "versao": "2026.11-modis-ndvi-regiao"},
  "regioes": [
    {
      "lat": -18.9543, "lon": -48.1993, "raio_km": 30.0,
      "fonte": "MODIS MOD13Q1 + MYD13Q1", "mascara": "MCD12Q1 LC_Type1 classe 12 (lavouras)",
      "anos": [
        {"ano": 2016, "n_pixels": 13412, "pct_parado": 62.0, "pct_plantou": 29.0, "pct_incerto": 9.0, "pct_sem_dado": 1.5},
        {"ano": 2017, "n_pixels": 0, "pct_parado": null, "pct_plantou": null, "pct_incerto": null, "pct_sem_dado": null}
      ]
    }
  ]
}
```

| JSON | Model | Regra |
| --- | --- | --- |
| `lat`, `lon` | `lat`, `lon` | centro da região, WGS 84 |
| `raio_km` | `raio_km` | maior que zero |
| `fonte`, `mascara` | `fonte`, `mascara` | textos não vazios (produtos do NDVI e de onde vem a lavoura) |
| `anos[].ano` | `RegiaoAno.ano` | sem ano repetido na região |
| `anos[].n_pixels` | `n_pixels` | pixels de 250 m de lavoura dentro do raio (0 ou mais) |
| `anos[].pct_parado`, `pct_plantou`, `pct_incerto` | idem | 0 a 100, sobre os pixels classificados, somam 100 (±0,2 do arredondamento); os três `null` sem pixel classificado |
| `anos[].pct_sem_dado` | `pct_sem_dado` | 0 a 100, sobre `n_pixels`; `null` só com `n_pixels` 0; 100 quando nenhum foi classificado |

- `versao_dados.fonte` = `modis_mod13q1` (a mesma chave do NDVI do talhão); os `parametros` dizem o
  serviço (`ornl_daac`), a máscara (produto, camada, classes e o ano usado em cada ano), a janela,
  os anos, os limites, o raio, a caixa pedida (`km_pedido`) e o número de pedidos.
- Ainda não há tabela: a API lê o arquivo. O guia NDVI propõe a `regiao_entressafra` no PostGIS.

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
