# Tarefa 0026: chuva diária do GPM IMERG Final por recorte (OPeNDAP)

- **Identificador:** `0026`
- **Título:** Script da chuva diária do IMERG Final na caixa piloto (um recorte ASCII por dia, em paralelo, com cache) e contrato "IMERG"
- **Status:** Concluída (script e testes; a extração real fica com quem tem o token)
- **Prioridade:** Média (refinamento, fora do caminho crítico, ADR-0003)
- **Roteiro:** R2.4; alimenta o R3.4 (tarefa 0027)
- **Módulos Afetados:** `projeto/backend/pipeline/fetch_imerg.py` (novo), `projeto/backend/app/models/climate.py` (`ImergSeason`, `ImergCellSeries`), `projeto/backend/app/models/data_run.py` (docstring), `tests/unit/pipeline/test_fetch_imerg.py` (novo), `tests/unit/models/test_imerg_series.py` (novo), `projeto/backend/AGENTS.md`, `docs/como-preparar-os-dados-locais.md`
- **Referências:** ADR-0003 (POWER é a chuva oficial do MVP; IMERG como refinamento), roteiro §3 (acesso) e §5 (chave da fonte de chuva), contrato "IMERG" do `AGENTS.md` do backend

---

## 1. Descrição e motivação

A chuva da conta é o `PRECTOTCORR` do NASA POWER (~50 km). O time quer o **GPM IMERG Final diário**
(`GPM_3IMERGDF` v07, 0,1°, ~10 km) na caixa piloto, de 1/jan em diante (212 dias, as temporadas do
POWER) de 2005 a 2024. O acesso pelo OPeNDAP do GES DISC com o token da Earthdata (Bearer) foi
testado pelo orquestrador: HTTP 200, ~11 s no primeiro pedido.

## 2. O que foi conferido nos servidores de verdade (14/11/2026, sem token)

| O quê | Resultado |
| --- | --- |
| Busca pública do CMR (`granules.json?short_name=GPM_3IMERGDF&version=07`) | 2005: 212 arquivos; 2012, 2016, 2020 e 2024: 213 (jan–jul). Todos `V07B` nos anos olhados. Pelo próprio script (`list_granules`, sem token): 424 dias para 2005 e 2024, de 2005-01-01 a 2024-07-30 |
| Link de OPeNDAP que o CMR traz | é o **da nuvem** (`opendap.earthdata.nasa.gov/collections/C2723754864-GES_DISC/granules/...`), não o `gpm1` testado. O script usa do CMR só o nome do arquivo e monta a URL do `gpm1` (`/opendap/GPM_L3/GPM_3IMERGDF.07/<ano>/<mês>/<arquivo>`) |
| DAS (público) | `precipitation`: `units "mm/day"`, `_FillValue -9999.90039`; `time`: `"days since 1980-01-06 00:00:00Z"` (a amostra tem `time=16080` = 15/01/2024) |
| DDS (público) | `precipitation[time = 1][lon = 3600][lat = 1800]`: ordem `[tempo][lon][lat]`, centros de −179,95 e −89,95 a cada 0,1° |
| Recorte ASCII sem token | 302 para `urs.earthdata.nasa.gov/oauth/authorize` (com `redirect_uri` no `/data-redirect` do `gpm1`): o dado exige login |
| DAS com `Accept: application/json` (o padrão do cliente HTTP do projeto) | **406** "Hyrax - Not Applicable"; com `text/plain, */*`, 200. O script pede `text/plain` |

Amostra real usada nos testes (do orquestrador, com o token): o pedido
`precipitation[0:0][1300:1301][1150:1151]` de 15/01/2024 e a resposta inteira (`Dataset: ...`,
`precipitation.lat, 25.05, 25.15` e uma linha por longitude). Ela confirma o mapeamento célula →
pixel: índice de lat = `floor(lat × 10) + 900`, de lon = `floor(lon × 10) + 1800`.

## 3. Como o script funciona

```
células da caixa piloto (as 225 da pré-carga, pilot_box_cells) → pixel de cada uma
   retângulo: lat 701–715 × lon 1310–1324 (15 × 15 pixels)
   ▼
CMR (público, sem token): um pedido por ano (1/jan até o 212º dia), paginado (page_size 2000)
   fica só o que cai na temporada; dia repetido fica com a versão mais nova (V07B > V07A)
   ▼
DAS de um arquivo por versão: unidade mm/day, preenchimento ≤ −9999, origem do tempo
   ▼
1º dia sozinho (confere o acesso, abre a sessão) → os outros em paralelo (--paralelo, padrão 6)
   cada dia: .ascii?precipitation[0:0][1310:1324][701:715]
   conferido (arquivo e dia, tempo, lat e lon de cada pixel, nº de valores, chuva ≥ 0) → cache
   ▼
algum dia falhou? nada é gravado, código 1, "rode de novo" (continua do cache)
   ▼
série de cada célula: 212 dias por ano, 2 casas; sem arquivo ou preenchimento = null
validada por ImergCellSeries/ImergSeason → data/baixados/nasa_gpm_imerg/imerg_diario_caixa.json
```

- **Token:** do `Settings` (`EARTHDATA_TOKEN`). Vai como cabeçalho comum `Authorization: Bearer`
  (o urllib repete no redirecionamento, como o `curl -L --location-trusted`); o `authorization` do
  `HttpRequest` vira cabeçalho "unredirected" e se perderia no login. O `EarthdataRedirectHandler`
  tira o cabeçalho se o redirecionamento sair de `*.earthdata.nasa.gov` ou `*.eosdis.nasa.gov`
  (ou de HTTPS). O opener guarda o cookie da sessão (o `gpm1` abre a sessão no `/data-redirect`),
  então os pedidos seguintes não refazem o login. Tudo pela biblioteca padrão, pelo
  `default_http_request` do `http_client.py` (sem dependência nova). O token não entra em mensagem
  nem log (teste).
- **Erros:** 401, 403, redirecionamento sem fim (3xx) ou página HTML de login → `ImergAuthError`:
  para na hora e cancela o que ainda não saiu. 400, 404 e 406 não são repetidos. Erro de rede, 429,
  5xx e resposta fora do formato: 3 retentativas, espera de 5, 10 e 20 s.
- **Cache e retomada:** `cache_opendap/<ano>/<AAAAMMDD>_lon1310-1324_lat701-715.ascii` e
  `cache_opendap/atributos_<versão>.das`. Resposta conferida antes de gravar, `.part` renomeado no
  fim. A saída também é gravada como `.part` e renomeada.
- **`--dry-run`:** sem rede (nem o CMR): células, pixels, dias, o que já está no cache e o tempo.

```text
$ uv run python -m pipeline.fetch_imerg --dry-run
IMERG Final diário (GPM_3IMERGDF v07), caixa piloto: 225 células de 0,1° (pixels de lat 701–715 × lon 1310–1324)
Anos: 2005–2024 (20), 212 dias por ano desde 1/jan: 4240 recortes ao OPeNDAP, um por dia (já no cache: 0; faltam: 4240), + 20 pedidos ao CMR (sem token) e 1 DAS por versão do arquivo
Tempo estimado: até ~2,2 h com 6 em paralelo (~11 s por pedido, medido no primeiro, que inclui o login; com a sessão aberta os seguintes devem ser mais rápidos)
```

## 4. Decisões

1. **Chave da fonte de chuva: `gpm_imerg`** (adotada, **a revisar**). É a que o front já procura
   (`projeto/frontend/src/services/satelliteService.ts`, `sourceService.ts`, `reportService.ts` e
   as mensagens). O backend usava `imerg_final` só no `RAIN_SOURCE_NAMES`; a tarefa 0027 alinha.
   **Para o roteiro §5** (não editado nesta tarefa): marcar "Chave da fonte de chuva" como decidida
   (`gpm_imerg`, padrão adotado a revisar) e corrigir o texto do R3.4 (`rain_source = gpm_imerg`).
2. **212 dias desde 1/jan** em todo ano (a regra do `ClimateSeasonBuilder`), não 1/jan–31/jul: no
   bissexto a temporada vai até 30/jul, igual ao POWER no `climate_season`.
3. **OPeNDAP do `gpm1`** (o testado com o token), não o da nuvem que o CMR aponta.
4. **Primeiro pedido sozinho** antes dos paralelos: um token ruim custa um pedido, não seis, e a
   sessão (cookie) já está aberta quando os paralelos começam.
5. **Dia que falhou não vira `null`:** `null` é só para o que o GES DISC não tem (sem arquivo ou
   preenchimento). Falha de rede deixa o arquivo sem gravar, para não parecer falta de dado.
6. **Paralelo de 1 a 10** (padrão 6): o GES DISC é público.

## 5. Sub-tarefas (TDD)

### 5.1: Contrato tipado
- [x] `tests/unit/models/test_imerg_series.py` (24 testes): 212 dias, 1/jan, `None` preservado,
  chuva negativa ou não finita recusada, `complete`/`missing_days`, id `floor`, centro da célula,
  coordenadas fora do globo, ano repetido.
- [x] Red: `ImportError: cannot import name 'ImergCellSeries' from 'app.models.climate'`.
- [x] Green: `ImergSeason` e `ImergCellSeries` em `app/models/climate.py`.

### 5.2: Script
- [x] `tests/unit/pipeline/test_fetch_imerg.py` (71 testes, HTTP falso `FakeGesDisc` que responde
  como o CMR e o Hyrax, com valores de teste estruturados): pixel de cada célula; retângulo da
  caixa; URL igual à da **amostra real**; leitura do **item real do CMR**, do **DAS real** e do
  **recorte real**; paginação; versão mais nova; dias fora da temporada; recusa de página de login,
  erro do Hyrax, outro dia, outro tempo, outros pixels, resposta pela metade, linha estranha e
  chuva negativa; preenchimento → `null`; token em cabeçalho comum e fora do CMR; redirecionamento
  seguro; cookie; `Accept: text/plain`; retentativa com espera 5 e 10 s; erro de rede; 404 e 406
  sem retentativa; 401/403/302/HTML param na hora; um pedido por dia; dia sem arquivo; pedidos em
  paralelo (barreira de 3); acesso recusado no meio cancela a fila; dia que falhou não grava e a
  segunda execução pede só ele; sem token = código 2; `--dry-run` sem rede, com e sem cache;
  `--paralelo` e `--anos` inválidos; token fora das mensagens e do log; JSON validado pelos models
  e pelo `DataRun`.
- [x] Red: `ModuleNotFoundError: No module named 'pipeline.fetch_imerg'`; depois, o teste do 406
  (`DID NOT RAISE`, o 406 era repetido).
- [x] Green: `pipeline/fetch_imerg.py`.
- [x] Mutações conferidas (cada uma derruba ao menos um teste): token no `authorization`
  (unredirected), pool com 1 trabalhador, preenchimento virando 0, token seguindo para fora da
  NASA, versão pela ordem do CMR, sem paginação, sem o primeiro pedido sozinho, acesso recusado
  sem cancelar a fila.

### 5.3: Documentação
- [x] `AGENTS.md` do backend: "Dados da API" (IMERG) e seção "IMERG" no "Contrato dos dados das
  fontes", com a chave `gpm_imerg`.
- [x] `docs/como-preparar-os-dados-locais.md`: o dado, o comando, o tempo, a credencial e os
  problemas comuns.

## 6. Critérios de aceitação (Definition of Done)

1. Um pedido OPeNDAP ASCII por dia com o retângulo da caixa; lista dos dias pelo CMR, paginada.
2. Pedidos em paralelo configuráveis, com retentativa e espera exponencial; acesso recusado para.
3. Cache e retomada; resposta inválida não entra no cache; `--dry-run` com pedidos e tempo.
4. Saída no contrato "IMERG" (`gpm_imerg`), validada pelos models; dia sem dado = `null`.
5. Sem dependência nova; testes sem rede real; token nunca em mensagem, log ou commit.
6. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.

## 7. Fora do escopo / riscos

- **A extração real não foi rodada** (o worktree não tem o token). O formato do recorte veio da
  amostra real de 2 × 2 pixels; um recorte de 15 × 15 deve seguir o mesmo formato (uma linha por
  longitude, 15 valores), mas só a primeira execução confirma. Se o formato diferir, o primeiro
  pedido falha sozinho e nada mais é pedido.
- **Sessão do login:** o fluxo com cookie (redirecionamento para o URS e volta pelo
  `/data-redirect`) não foi exercitado de verdade pelo urllib. O `curl -L --location-trusted` do
  orquestrador funcionou; o script faz o mesmo e ainda guarda o cookie.
- **Tempo:** a estimativa (~2,2 h) usa os ~11 s do primeiro pedido, que inclui o login. Sem medir o
  segundo pedido em diante, é um teto.
- **`gpm1` pode ser aposentado** em favor do OPeNDAP da nuvem (o link que o CMR já traz). Aí é
  trocar `OPENDAP_BASE_URL` e conferir o formato do Hyrax da nuvem.
- **Reprocessamento (V07C):** o cache é por dia, não por versão. Para baixar a versão nova, apague
  o cache.
- **Rodar de um worktree** grava no `data/baixados` daquele worktree (a raiz é a do script). Para usar
  a pasta do time, rode do checkout principal ou passe `--saida` e `--cache`.
