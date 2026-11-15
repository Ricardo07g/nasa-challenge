# Tarefa 0027: chuva do IMERG na conta (carga no `climate_season` e chave `gpm_imerg` na API)

- **Identificador:** `0027`
- **Título:** Carga da chuva do GPM IMERG no `climate_season` (anos completos), chave `gpm_imerg` no back e `dados[]` do `/talhao`
- **Status:** Concluída (código e testes; a carga real fica com quem tem o arquivo da tarefa 0026)
- **Prioridade:** Média (refinamento, fora do caminho crítico, ADR-0003)
- **Roteiro:** R3.4 (depende do R2.4, [tarefa 0026](0026-imerg-por-recorte.md))
- **Módulos Afetados:** `projeto/backend/pipeline/load_files_to_db.py`, `projeto/backend/app/repositories/imerg_repository.py` (novo), `projeto/backend/app/repositories/climate_repository.py`, `projeto/backend/app/services/recommendation_service.py`, `projeto/backend/app/services/talhao_service.py`, `projeto/backend/app/constants.py` (`IMERG_RAIN_SOURCE`), `pipeline/fetch_imerg.py` (usa a constante), testes em `tests/unit/` e `tests/integration/db/test_chuva_imerg_db.py` (novo), `projeto/backend/AGENTS.md`, `docs/como-preparar-os-dados-locais.md`
- **Referências:** ADR-0003, contrato "IMERG" do `AGENTS.md` do backend, roteiro §5 ("Chave da fonte de chuva")

---

## 1. Descrição e motivação

A tarefa 0026 grava a chuva diária do IMERG Final (0,1°) das 225 células da caixa piloto num
arquivo do contrato "IMERG". Esta tarefa leva essa chuva para a conta: o balde (ISNA) lê o `rain_mm`
do `climate_season`, então basta trocar a série nas temporadas certas. O `/talhao` e o "Por quê?"
passam a dizer que a chuva vem do IMERG, com a chave que o front já procura (`gpm_imerg`).

## 2. O que mudou

### Carga (`pipeline/load_files_to_db.py --imerg <arquivo>`)

- Lê o arquivo pelo `FileImergRepository` (models `ImergCellSeries`/`ImergSeason`) e confere o
  `versao_dados.fonte` (`gpm_imerg`). Arquivo ausente, de outra fonte ou fora do contrato: nada é
  gravado (saída 1), como no CMIP6 e no NDVI.
- Para cada célula e ano **que já estão no `climate_season`** com a mesma janela (início em 1/jan,
  212 dias): se o ano do IMERG está **completo** (nenhum `null`), `rain_mm` vira a série do IMERG e
  `rain_source` vira `gpm_imerg`. Ano incompleto continua com o POWER. Célula ou ano fora do banco,
  ou com outra janela, fica de fora (a chuva não casaria dia a dia com a temperatura e a ETo).
- Nenhuma temporada é criada; temperatura, ETo e as outras séries não mudam.
- Pelo repository: `PostgisClimateRepository.list_season_windows()` e
  `replace_seasons_rain(fonte, {(célula, ano): chuva})` (um `UPDATE` por temporada, numa transação).
  Nada de SQL no script.
- **Idempotente:** rodar de novo grava a mesma chuva. **`data_run`:** uma linha `gpm_imerg` com a
  versão do arquivo e as contagens (`celulas_no_arquivo`, `temporadas_no_arquivo`,
  `temporadas_trocadas`, `temporadas_incompletas`, `temporadas_sem_clima`) e o
  `parametros_do_arquivo`. Sem temporada trocada, sem linha.
- `--dry-run` lê o arquivo e o banco e mostra o resumo (sem `DATABASE_URL`, supõe o banco vazio).

### Correção encontrada no caminho

O upsert do `PostgisClimateRepository.save_cell_seasons` regravava a chuva mas **não** o
`rain_source`. Depois da carga do IMERG, a pré-carga com `--forcar` voltaria a chuva do POWER com o
rótulo `gpm_imerg`. Agora o upsert grava os dois (teste `db`).

### API

- `RAIN_SOURCE_NAMES` (`recommendation_service.py`): a chave `imerg_final` passou a `gpm_imerg`, com
  o nome "GPM IMERG + NASA POWER". Antes o nome vinha só do **primeiro** ano da série; agora basta um
  ano do IMERG para o "Por quê?" dizer "(GPM IMERG + NASA POWER)" (o nome já diz que a série mistura
  as duas fontes). Sem nenhum, "(NASA POWER)".
- `/talhao`: com algum ano da célula com `rain_source = gpm_imerg`, `dados[]` lista
  `{"fonte": "gpm_imerg", "periodo": "2005-2024"}` logo depois do `nasa_power` (o CMIP6 continua no
  fim). O `TalhaoService` olha as temporadas da célula (`get_seasons`).
- Chave única em `app/constants.py`: `IMERG_RAIN_SOURCE = "gpm_imerg"` (carga, services e o script
  da tarefa 0026).

### Front

Nada a mudar, conferido no código: `dados[].fonte` é `string` (`models/talhao.ts`);
`satelliteService.ts` (`rainPeriod`) já prefere o período do `gpm_imerg`; `sourceService.ts` marca a
fonte como conectada e põe a chuva em 10 km; `reportService.ts` e as mensagens já têm "GPM IMERG". Os
`cenario`/`modelos` nulos do item já chegam assim no `nasa_power`.

## 3. Decisões

1. **Chave `gpm_imerg`** (adotada na tarefa 0026, **a revisar**). **Para o roteiro §5 e o R3.4**
   (não editados aqui): marcar a decisão como adotada e trocar `rain_source = imerg_final` por
   `gpm_imerg` no texto do R3.4.
2. **Só ano completo troca:** um dia faltando deixaria o balde com um buraco; o ano fica com o POWER
   (a regra do POWER na tarefa 0005 é descartar o ano; aqui há uma série inteira de reserva).
3. **Sem criar temporada:** a temperatura e a ETo vêm do POWER; sem a temporada do POWER no banco
   não há com o que montar o ano.
4. **Mesma janela obrigatória:** temporada com outro início ou outro número de dias (ex.: um banco
   antigo) fica de fora, para a chuva nunca ficar defasada da temperatura.
5. **A chuva do POWER das temporadas trocadas não fica guardada** (não há coluna para ela e esta
   tarefa não pede migração). Para voltar: pré-carga com `--forcar`.

## 4. Sub-tarefas (TDD)

- [x] **Leitura do arquivo:** `tests/unit/repositories/test_imerg_repository.py` (8 testes). Red:
  `ModuleNotFoundError: No module named 'app.repositories.imerg_repository'`.
- [x] **Repository do banco:** `tests/integration/db/test_chuva_imerg_db.py` (janelas, troca só da
  chuva e da fonte, sem criar temporada). Red: `ImportError: cannot import name 'SeasonWindow'`; o
  teste do upsert falhou pelo motivo certo (`'gpm_imerg' != 'nasa_power'`) antes da correção.
- [x] **Carga:** 14 testes novos em `tests/unit/pipeline/test_load_files_to_db.py` (troca dos anos
  completos, ano incompleto fica com o POWER, nunca cria nem desalinha temporada, `data_run` com as
  contagens, fonte errada, fora do contrato, arquivo ausente, resumo, `main` só com `--imerg` e
  `--dry-run` sem banco) e 2 testes `db` (ponta a ponta e idempotência). Red: `TypeError:
  FilesToDbLoader.__init__() got an unexpected keyword argument 'season_repo'` (30) e `SystemExit: 2`
  do `--imerg` desconhecido (2).
- [x] **API:** 3 testes no `test_recommendation_service.py` (todos os anos do IMERG, só alguns, nenhum;
  pt e en) e 1 no `test_talhao_service.py`. Red: o "Por quê?" saía "(gpm_imerg)" (chave errada) ou
  "(NASA POWER)" (só o primeiro ano), e o `dados[]` não tinha o `gpm_imerg`. Mais 1 teste `db` pela
  API de verdade: depois da carga, `/talhao` lista `gpm_imerg` e o `/recomendacao` diz "(GPM IMERG
  + NASA POWER)".
- [x] Mutações conferidas na carga (cada uma derruba ao menos um teste): ano incompleto entrando,
  qualquer janela aceita, carga sem gravar.
- [x] **Docs:** `AGENTS.md` (Banco, "Carga dos arquivos no banco", "Chuva do IMERG na conta" e o
  contrato IMERG) e `docs/como-preparar-os-dados-locais.md`.

## 5. Critérios de aceitação (Definition of Done)

1. `--imerg` troca `rain_mm` e `rain_source` só nos anos completos que já estão no `climate_season`;
   ano incompleto fica com o POWER; registra em `data_run`; idempotente; sem SQL no script.
2. `RAIN_SOURCE_NAMES` com `gpm_imerg` e o nome "GPM IMERG + NASA POWER".
3. `/talhao` lista `{fonte: "gpm_imerg", periodo: "2005-2024"}` quando a célula tem chuva do IMERG.
4. Front conferido (sem mudança).
5. `uv run pytest` (com e sem `TEST_DATABASE_URL`), `uv run ruff check .`, `uv run ruff format --check .`
   e `pre-commit run --all-files` passando.

## 6. Fora do escopo / riscos

- **A carga real não foi rodada** (o arquivo da tarefa 0026 ainda não existe).
- **Chuva do POWER perdida nas temporadas trocadas:** para comparar POWER × IMERG depois, seria
  preciso uma coluna própria (migração) ou rodar a pré-carga com `--forcar` num banco à parte.
- **Células novas da busca sob demanda** (fora da caixa) ficam com o POWER: o arquivo do IMERG só
  tem a caixa piloto.
- **`/talhao` faz uma consulta a mais** (`get_seasons` da célula) para saber se há IMERG. É uma
  célula só; se pesar, dá para trocar por uma consulta que só olha o `rain_source`.
- **`periodo` fixo "2005-2024"** no `gpm_imerg`, como no `nasa_power`: é a janela da série de chuva
  (o IMERG nos anos completos, o POWER nos outros), não a lista dos anos do IMERG.
