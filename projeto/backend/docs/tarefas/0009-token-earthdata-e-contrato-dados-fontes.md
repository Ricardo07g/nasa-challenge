# Tarefa 0009: Tokens da Earthdata e do AppEEARS e contrato dos dados das fontes novas (R0.1 + R0.2)

- **Identificador:** `0009`
- **Título:** Tokens da Earthdata e do AppEEARS e contrato dos dados das fontes novas
- **Status:** Concluída
- **Prioridade:** Alta (destrava R1.6, R2.1, R2.2 e R2.3)
- **Módulos afetados:** `projeto/backend/app/config.py`, `projeto/backend/.env.example`, `projeto/backend/app/models/`, `projeto/backend/tests/unit/`, `projeto/backend/AGENTS.md`
- **Roteiro:** [R0.1 e R0.2](../roteiro-de-implementacao.md) (Fase 0)
- **Referências:** [ADR-0005](../adr/0005-fontes-diretas-da-nasa-sem-earth-engine.md), plano técnico do backend §5 (banco), guia do histórico NDVI, PRD 7.2, 7.3 e 7.8

---

## 1. Descrição e motivação

- **R0.1:** a ADR-0005 troca o Google Earth Engine pelos serviços da NASA. As credenciais do MVP são
  da conta Earthdata, e só os scripts de dados usam (a API não precisa de nenhuma). O `Settings` não
  tinha o token, e o `.env.example` ainda pedia o `EE_PROJECT`.
  - Teste do time em 2026-11-14: o `EARTHDATA_TOKEN` (token da Earthdata Login, um JWT que vale
    60 dias) funciona na NSIDC (SMAP) e no GES DISC (IMERG), mas o **AppEEARS recusa com 403**.
  - O AppEEARS exige o próprio token, opaco, gerado por `POST https://appeears.earthdatacloud.nasa.gov/api/login`
    com o usuário e a senha da Earthdata. Ele vale cerca de 48 h.
  - Por isso entram duas variáveis: `EARTHDATA_TOKEN` e `APPEEARS_TOKEN`.
- **R0.2:** as fontes novas (CMIP6, NDVI do MODIS, SMAP) não tinham um formato combinado entre os
  scripts de dados e a API. O `Cmip6Delta` misturava os campos mensais que o motor usa com agregados
  da safrinha que ninguém lia; o `NdviRecord` não guardava a qualidade nem o produto (Terra ou Aqua);
  e não havia model para a execução de dados (`data_run`), base do `versao_dados`.

---

## 2. Sub-tarefas (TDD)

### 2.1 R0.1: tokens da Earthdata e do AppEEARS
- [x] Teste em `tests/unit/test_config.py`: `earthdata_token` é `None` por padrão e vem de `EARTHDATA_TOKEN`.
- [x] Teste igual para `appeears_token` (`APPEEARS_TOKEN`).
- [x] O `clean_env` dos testes de config passa a limpar `EARTHDATA_TOKEN`, `APPEEARS_TOKEN`,
  `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD` e `EE_PROJECT`.
- [x] Campos `earthdata_token` e `appeears_token` (`str | None`) no `Settings`.
- [x] `EARTHDATA_TOKEN=` e `APPEEARS_TOKEN=` (vazios) no `.env.example`, com comentário curto:
  - `EARTHDATA_TOKEN` serve para a NSIDC e o GES DISC, não para o AppEEARS;
  - `APPEEARS_TOKEN` vem de `POST /api/login` e vale cerca de 48 h. Sem ele, o script faz o login com
    `EARTHDATA_USERNAME` e `EARTHDATA_PASSWORD`.
- [x] `EARTHDATA_USERNAME` e `EARTHDATA_PASSWORD` deixam de ser legado: geram o token do AppEEARS.
  Só o `EE_PROJECT` fica marcado como legado (a ADR-0005 ainda está "Proposto").
- [x] Nota no `AGENTS.md` do backend, seção "Configuração e segredos".

**Red:**
- `AttributeError: 'Settings' object has no attribute 'earthdata_token'` (2 testes);
- `AttributeError: 'Settings' object has no attribute 'appeears_token'` (2 testes).

**Problema conhecido:** o `data/extract_smap.py`, quando acha o `EARTHDATA_TOKEN` (prioridade 1, antes
do login), manda `Authorization: Bearer <EARTHDATA_TOKEN>` para o AppEEARS. Esse caminho **não funciona** (o AppEEARS responde 403 ao token da Earthdata Login). O
script não foi mexido aqui; a correção (usar `APPEEARS_TOKEN` ou fazer o login com usuário e senha)
fica para o R2.2/R2.3, que reaproveitam esse cliente.

### 2.2 R0.2: contrato tipado das fontes
- [x] `Cmip6Delta` só com o delta mensal por modelo: `model`, `scenario`, `month`, `rain_pct`,
  `tmax_c` e `tmin_c` opcional. Campos obrigatórios (sem padrão), mês de 1 a 12, chuva nunca abaixo
  de −100%, números finitos.
- [x] Agregados removidos do model (`cell_id`, `cenario`, `modelos_referencia`,
  `aumento_temperatura_media_c`, `variacao_chuva_safrinha_pct`, `aumento_dias_calor_extremo_ge_35c`).
  O `grep` em `app/` não achou uso.
- [x] `NdviRecord` com `qualidade` (`pixel_reliability` ou `SummaryQA`: só 0 e 1) e `produto`
  (`MOD13Q1` ou `MYD13Q1`). Os dois são opcionais para o cache antigo continuar valendo. NDVI fora da
  faixa válida do MODIS (inclusive o −3000 de "sem dado") é recusado.
- [x] `SmapSoilMoisture` revisado: `sm_surface_m3_m3` opcional (o balde usa só a zona das raízes),
  umidades entre 0 e 1, coordenadas WGS 84 e `fonte` não vazia.
- [x] Model novo `DataRun` (`app/models/data_run.py`): `source`, `params`, `finished_at` (com fuso) e
  `version`, espelho da tabela `data_run`.
- [x] Checagens comuns em `app/models/validation.py`.
- [x] Testes em `tests/unit/models/` para os quatro models.
- [x] Seção "Contrato dos dados das fontes" no `AGENTS.md` do backend: formato dos arquivos JSON de
  saída dos scripts e proposta das tabelas do R1.6.

**Red:** 37 testes falhando e 1 erro de coleta, pelos motivos esperados:
- `ModuleNotFoundError: No module named 'app.models.data_run'`;
- `TypeError: Cmip6Delta.__init__() got an unexpected keyword argument 'tmin_c'`;
- `TypeError: NdviRecord.__init__() got an unexpected keyword argument 'qualidade'`;
- `TypeError: SmapSoilMoisture.__init__() missing 1 required positional argument: 'sm_surface_m3_m3'`;
- `Failed: DID NOT RAISE ValueError` nas validações.

---

## 3. Decisões

1. **Chaves do JSON em português, colunas em inglês.** Segue a fixture do clima (`modelo`, `mes`,
   `chuva_pct`) e o plano técnico §5 (`model`, `month`, `rain_pct`). O repository faz a ponte.
2. **CMIP6 por área coberta, não por id de célula.** Enquanto o R1.2 não fecha o id da célula, o
   arquivo guarda o ponto e a `cobertura`, como a fixture do clima. A tabela usa `cell_id`.
3. **NDVI físico nos arquivos novos.** A tabela do plano técnico já pedia o fator 0,0001 aplicado. O
   model continua aceitando o bruto, porque o service ainda converte (`scaled_ndvi`).
4. **SMAP por ponto (`smap_point`).** O roteiro pede "por ponto e data", e o `get_latest_smap` já
   recebe lat/lon. A versão do produto (007 ou 008) vai no `DataRun`.
5. **Chave de fonte do SMAP = `smap`**, a mesma que o front já usa (`reportService.ts`).
6. **`versao` nova no `data_run`.** A tabela da migração inicial não tem a coluna; ela entra no R1.6.

---

## 4. Fora do escopo (fica para as próximas tarefas)

- **Repositories:** o `FixtureClimateRepository` ainda não lê `tmin_c` (R3.1). O `CachedNdviRepository`
  ainda não lê `qualidade` e `produto` (R3.2).
- **`scripts/seed_db.py`** continua gravando o CMIP6 agregado no formato antigo. Ele não usa o model,
  então nada quebra, e sai com a migração R1.6.
- **Migração:** as tabelas propostas no `AGENTS.md` (`cmip6_delta` mensal, `ndvi_point` com
  qualidade, `smap_point`, `data_run.version`) são o R1.6.
- **`ee_project`:** fica até a ADR-0005 ser aceita.
- **`data/extract_smap.py`:** o caminho "Bearer `EARTHDATA_TOKEN`" no AppEEARS fica como está até o
  R2.2/R2.3 (ver "Problema conhecido" na seção 2.1).

---

## 5. Critérios de aceitação

1. **TDD:** cada teste novo foi visto falhando antes do código (seção 2).
2. **Sem rede nem banco nos testes.**
3. `uv run pytest` (176 testes), `uv run ruff check .` e `uv run ruff format --check .` passando.
4. `pre-commit run --all-files`: todos os hooks passam, menos o `trailing-whitespace`, que já falhava
   no `main` por causa das quebras de linha com dois espaços em
   `docs/como-funcionam-os-dados-de-satelite-e-postgis.md` (raiz e backend). A correção está na
   [tarefa 0010](0010-docs-backend-em-dia.md).
5. Nenhum valor real de credencial no código, nos testes ou nos docs.
