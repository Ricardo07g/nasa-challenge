# Tarefa 0033: chuva dos últimos 30 dias pelo IMERG Late, contra a média (A2.3)

- **Identificador:** `0033`
- **Título:** Script da chuva recente por célula (IMERG Late + média do POWER guardado), contrato,
  repository de arquivo e ligação no sinal para o outono
- **Status:** Concluída no código (testes com HTTP falso). A execução real espera o
  `EARTHDATA_TOKEN` e a época certa (fev/mar): o formato da resposta do Cloud OPeNDAP foi tirado do
  Hyrax e ainda não foi visto com token (seção 5)
- **Prioridade:** Alta (metade do "terra seca agora" do sinal, RF-20)
- **Roteiro:** A2.3 (Fase 6, ajuste A2). Depende de R0.1 (token no `Settings`)
- **Módulos Afetados:** `pipeline/fetch_imerg_late.py`, `app/models/recent_rain.py`,
  `app/repositories/recent_rain_repository.py`, `app/config.py`, `app/dependencies.py`,
  `.env.example`, `projeto/docker-compose.yml`, `tests/integration/controllers/conftest.py`
- **Referências:** PRD 7.10 e RF-20, [tarefa 0015](0015-servico-sinal-outono.md) (`RecentRain` e a
  regra), [tarefa 0032](0032-geos-s2s-investigacao.md) (GEOS-S2S), roteiro seção 3

---

## 1. Descrição

A regra do PRD 7.10 chama a terra de seca quando o SMAP está abaixo do percentil 20 **e** a chuva dos
últimos 30 dias pelo IMERG está abaixo de 60% da média. Esta tarefa traz a chuva: soma de 30 dias do
**IMERG Late diário** (`GPM_3IMERGDL` v07, o produto de quase tempo real) por célula de 0,1° da caixa,
e a média dos mesmos dias, gravadas num arquivo de contrato que a API lê.

## 2. Decisões

- **Média = NASA POWER `PRECTOTCORR` já guardado** (`climate_season` do banco, com a fixture de
  reserva; sem banco, só a fixture), nos mesmos dias do calendário dos anos anteriores ao da janela.
  Não há IMERG Final guardado ainda (R2.4, outra trilha) e pedir 20 anos de IMERG Late seriam 600
  pedidos. Consequência: o POWER guardado vai de 1/jan a 31/jul, então a janela precisa caber aí
  (o sinal é de fev/mar). Fora disso o script sai com erro e não mexe no arquivo.
- **Granulos pelo CMR** (público): o nome muda com o reprocessamento (`V07B`, `V07C`; em 14/11/2026
  os 30 últimos dias eram todos `V07C`), então o script não monta o nome; usa o link do Cloud
  OPeNDAP que o CMR dá para cada dia. O CMR de 30 dias levou 0,8 s.
- **Cloud OPeNDAP** (`opendap.earthdata.nasa.gov`, Hyrax) em ASCII, um pedido por dia com o
  retângulo da caixa (`precipitation[time][lon][lat]`), token como `Bearer`. Sem token, o servidor
  responde 302 para o login (testado). Não duplica o cliente do IMERG Final (R2.4): este script só
  faz a parte do Late; quando o do R2.4 entrar, dá para juntar a leitura do ASCII.
- **Célula = pixel:** o pixel de 0,1° do IMERG (centros em x,x5) é a célula do `cell_id_for`.
- **Sem dado não entra:** dia com -9999,9 tira a célula; dia faltando na janela para o script.
- **Chave de fonte `imerg_late`**: segue a do IMERG Final quando a decisão da seção 5 do roteiro
  sair (`gpm_imerg` ou `imerg_final`).
- **Módulos próprios** (`recent_rain.py`, `recent_rain_repository.py`) em vez de crescer
  `sinal_outono*.py`, para não conflitar com a trilha do SMAP recente (A2.2).
- Só a chuva **não** acende o sinal: o service pede SMAP e chuva juntos. Até o A2.2, `sinal: null`.

## 3. Contrato

Seção "Chuva recente" do `AGENTS.md` do backend: `versao_dados` (fonte `imerg_late`) + `celulas[]`
com `cell_id`, `lat`, `lon`, `data`, `dias`, `chuva_30d_mm`, `media_30d_mm`, `fracao_da_media` e
`anos_media`. Saída padrão `data/baixados/nasa_gpm_imerg_late/chuva_30d_imerg_late.json`, lida pelo
`IMERG_LATE_PATH` (já ligado no compose).

## 4. Sub-tarefas (TDD)

- [x] Model `RecentRainRecord` (`tests/unit/models/test_recent_rain.py`, 12 testes): falhou com
  `ModuleNotFoundError: No module named 'app.models.recent_rain'`.
- [x] `FileRecentRainRepository` (`tests/unit/repositories/test_recent_rain_repository.py`, 6
  testes): falhou com `ModuleNotFoundError: No module named 'app.repositories.recent_rain_repository'`.
- [x] `IMERG_LATE_PATH` no `Settings` (`test_config.py`, 2 testes): falhou com `AttributeError`
  (`imerg_late_path`). Ligação (`test_dependencies.py`, 3 testes): falhou porque o
  `get_recent_rain_repository` ainda devolvia o `NoAutumnSignalDataRepository`.
- [x] Script (`tests/unit/pipeline/test_fetch_imerg_late.py`, 28 testes, HTTP e clima falsos): grade
  e caixa, URL, CMR, ASCII do Hyrax (Grid e Array, erro, página de login, outro retângulo), soma,
  média do POWER (fora de jan–jul, virada do ano, 29/fev, ano da janela fora), registros, execução
  (arquivo lido pelo repository, token só no OPeNDAP, `--fim`, cache, nova tentativa em 5xx, 401
  com a dica e sem vazar o token, sem token, sem média não sobrescreve, `--dry-run`). Falhou com
  `ModuleNotFoundError: No module named 'pipeline.fetch_imerg_late'`.
- [x] Docs: `AGENTS.md` ("Dados da API" e contrato), `docs/como-preparar-os-dados-locais.md`, roteiro.

## 5. A revisar

- **Formato da resposta com token:** o parser segue o ASCII do Hyrax (conferido num Hyrax público,
  `test.opendap.org`): linha `precipitation.lat, ...` e linhas
  `precipitation.precipitation[precipitation.time=...][precipitation.lon=...], ...`; aceita também
  `precipitation[0][k], ...`. Na primeira execução com token, conferir um dia (o cache guarda o
  texto). Se o Cloud OPeNDAP não aceitar `.ascii` (DAP2), trocar pelo endereço do OPeNDAP do GES DISC.
- **Bearer com redirecionamento:** se o Cloud OPeNDAP redirecionar mesmo com o token, o cabeçalho não
  segue (é `unredirected`) e a página de login vira erro com a dica do token.
- **Viés entre produtos:** IMERG Late (0,1°) contra POWER (MERRA-2 corrigido, 0,5° × 0,625°). Para a
  fração do PRD serve como hipótese; calibrar no A2.5 ou trocar a média pelo IMERG Final quando o
  R2.4 guardar a série.
- **Dado velho:** o repository não olha a idade do arquivo; o `data` vai na resposta do sinal.
  Regravar perto do plantio (cron ou à mão, como diz o roteiro para o A2).
- **Tempo:** ~2 min estimados (30 pedidos de ~3 s); medir na primeira execução com token.

## 6. Critérios de Aceitação

1. TDD com os erros acima; nenhum teste usa rede, banco ou token.
2. Sem arquivo: `get_recent_rain` dá `None` e o `sinal` continua `null`.
3. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e
   `pre-commit run --all-files` passando.
