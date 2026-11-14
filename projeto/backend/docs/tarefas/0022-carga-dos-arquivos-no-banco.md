# Tarefa 0022: Carga dos arquivos do CMIP6 e do NDVI no banco

- **Identificador:** `0022`
- **Título:** `pipeline/load_files_to_db.py`: arquivo do CMIP6 → `cmip6_delta`, arquivo do NDVI → `ndvi_point`, com `data_run`
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** completa o R1.6 ([tarefa 0013](0013-migracao-fontes-novas.md)) com o que o R2.1 ([tarefa 0014](0014-deltas-cmip6.md)) e o R2.2 gravam em arquivo; a API já lê o `cmip6_delta` (R3.1, [tarefa 0021](0021-nota-de-futuro-cmip6.md)); ler o `ndvi_point` continua com o R3.2 ([tarefa 0018](0018-historico-ndvi-na-api.md))
- **Módulos Afetados:** `projeto/backend/pipeline/load_files_to_db.py` (novo), `projeto/backend/app/repositories/` (`climate_repository.py`, `cmip6_repository.py`, `ndvi_repository.py`, `data_run_repository.py`), `projeto/backend/tests/unit/pipeline/`, `projeto/backend/tests/unit/repositories/`, `projeto/backend/tests/integration/db/`, `projeto/backend/AGENTS.md`, `projeto/backend/docs/como-preparar-os-dados-locais.md`
- **Referências:** "Banco", "Dados da API" ("Deltas do CMIP6 na API" e "NDVI do MODIS e histórico do talhão") e "Contrato dos dados das fontes" no `projeto/backend/AGENTS.md`; [como preparar os dados locais](../como-preparar-os-dados-locais.md)

---

## 1. Descrição e motivação

Os scripts de dados gravam o CMIP6 (R2.1) e o NDVI (R2.2) em arquivo, no "Contrato dos dados das
fontes", e a API lê esses arquivos (`CMIP6_PATH`, `NDVI_CACHE_PATH`). As tabelas `cmip6_delta` e
`ndvi_point` da migração R1.6 ficavam vazias, porque nada copiava o arquivo para o banco. Com as
tabelas cheias:

- o `cmip6_delta` é a primeira fonte que a API consulta (R3.1);
- o `ndvi_point` fica pronto para a leitura do banco;
- a cópia do banco do pacote do time leva os dois dados.

---

## 2. Como a carga funciona

```
--cmip6 <arquivo>                               --ndvi <arquivo>
   │ FileCmip6Repository                           │ CachedNdviRepository
   │  get_data_run (versao_dados)                  │  get_data_run (versao_dados)
   │  get_cmip6_deltas(célula) para cada           │  list_point_series (todos os pontos,
   │  célula de grid_cell (list_cell_ids)          │  sem neve, nuvem nem NDVI vazio)
   ▼                                               ▼
plano do CMIP6                                  plano do NDVI (só registro com produto,
(células com deltas / sem deltas)               qualidade e NDVI físico; o resto é pulado)
   │                                               │
   └──────── os dois planos prontos: nenhum erro ─┘
                         │  (--dry-run para aqui: só o resumo)
                         ▼
PostgisCmip6Repository.save_cmip6_deltas   PostgisNdviRepository.save_ndvi_history   (upsert)
                         ▼
PostgisDataRunRepository.save_run: uma linha por fonte com linhas gravadas
                         ▼
resumo: células com e sem deltas, pontos, linhas gravadas, registros pulados
```

- **CMIP6:** a célula de 0,1° recebe os deltas do ponto cuja `cobertura` contém o centro dela. A
  carga chama o próprio `FileCmip6Repository.get_cmip6_deltas`, então a regra de borda é a mesma da
  API (de baixo dentro, de cima fora). Uma linha por célula × modelo × cenário × mês. Célula sem
  cobertura no arquivo: nada é gravado para ela. Só células que já estão em `grid_cell` (chave
  estrangeira do `cmip6_delta`): rode depois da pré-carga.
- **NDVI:** a série de cada ponto vai pelo `save_ndvi_history`, com a chave `point_key` do ponto.
  A tabela exige `produto` e `qualidade` e guarda o NDVI físico. Ficam de fora e contam como pulados:
  - o que a leitura da API já descarta: sem NDVI, neve, nuvem;
  - registro sem `produto` ou `qualidade` (cache antigo);
  - NDVI acima de 1 em módulo (o bruto, sem o fator 0,0001; mesma regra do `scaled_ndvi`).
- **Conferência antes de gravar:** os dois arquivos são lidos e conferidos antes da primeira
  gravação. Se algum tiver problema, nada é gravado (`LoadError`, saída 1):
  - arquivo ausente;
  - sem `versao_dados`;
  - `versao_dados.fonte` diferente de `nex_gddp_cmip6` (`--cmip6`) ou `modis_mod13q1` (`--ndvi`);
  - fora do contrato (o model recusa).
- **Idempotente:** os repositories fazem upsert pela chave da tabela. Rodar duas vezes não duplica
  nem muda a contagem das tabelas.
- **`data_run`:** uma linha por fonte **com alguma linha gravada**, para não registrar versão de
  dado que não entrou:
  - `source`: `nex_gddp_cmip6` / `modis_mod13q1`;
  - `version`: o `versao_dados.versao` do arquivo;
  - `finished_at`: a hora da carga;
  - `params`: `script`, `arquivo` (só o nome), `arquivo_fim` (o `versao_dados.fim`), as contagens
    (`celulas_com_deltas`, `celulas_sem_deltas`, `linhas`; ou `pontos`, `pontos_gravados`, `linhas`,
    `registros_pulados`) e `parametros_do_arquivo` (o `versao_dados.parametros`).
- **Células novas depois da carga:** a busca sob demanda cria células em `grid_cell` a qualquer
  clique fora das já gravadas. Elas ficam sem linha no `cmip6_delta`, mas a API acha os deltas no
  arquivo (ordem tabela → arquivo do R3.1). Rodar a carga de novo copia essas células. A ingestão
  não foi mudada.
- **Pacote do time:** a cópia do banco leva o `cmip6_delta` e o `ndvi_point`. Quem recebe o pacote
  não roda a carga; quem gera roda antes do `pg_dump`.

```bash
# da pasta projeto/backend
DATABASE_URL=postgresql://raiz:raiz_local@localhost:5433/raiz_orbital uv run python -m pipeline.load_files_to_db \
  --cmip6 ../../data/baixados/nasa_nex_gddp_cmip6/cmip6_deltas_nex_gddp.json \
  --ndvi ../../data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json --dry-run
```

---

## 3. Sub-tarefas (TDD)

### Sub-tarefa 3.1: Células do banco
- [x] `tests/integration/db/test_postgis_repositories.py` (marker `db`): `list_cell_ids` devolve
  vazio sem células e os ids em ordem depois de gravar duas.
- [x] Red: `AttributeError: 'PostgisClimateRepository' object has no attribute 'list_cell_ids'`.
- [x] Green: `PostgisClimateRepository.list_cell_ids` (só o banco, nunca a reserva).

### Sub-tarefa 3.2: Leitura do arquivo inteiro
- [x] `tests/unit/repositories/test_cmip6_repository.py`: `get_data_run` lê o `versao_dados` (com
  fuso) e devolve `None` sem caminho, sem arquivo ou sem a chave.
- [x] `tests/unit/repositories/test_ndvi_repository.py`, casos cobertos:
  - `list_point_series` devolve todos os pontos, na ordem, com a mesma leitura do
    `get_ndvi_history` e a contagem do que ela descartou;
  - o cache antigo vem sem produto nem qualidade;
  - sem arquivo, lista vazia;
  - `get_data_run`, e `None` no cache antigo.
- [x] Red:
  - `AttributeError: 'FileCmip6Repository' object has no attribute 'get_data_run'`;
  - `ImportError: cannot import name 'NdviPointSeries' from 'app.repositories.ndvi_repository'`.
- [x] Green:
  - `data_run_from_json` em `data_run_repository.py`;
  - `get_data_run` nos dois repositories de arquivo, que passam a guardar o arquivo inteiro e não
    só os `pontos`;
  - `NdviPointSeries` e `CachedNdviRepository.list_point_series`.

### Sub-tarefa 3.3: A carga
- [x] `tests/unit/pipeline/test_load_files_to_db.py` (21 testes, banco falso, arquivos em
  `tmp_path`). Casos cobertos:
  - deltas do ponto que cobre o centro de cada célula, com as duas bordas (`-193_-482`, centro
    −19,25, entra na célula do POWER da UFU; `-188_-482`, centro −18,75, fica com a de cima);
  - célula sem cobertura: nada; nenhuma célula coberta: nada, nem `data_run`;
  - NDVI de todos os pontos e os seis tipos de registro pulado (nuvem, sem NDVI, sem qualidade,
    sem produto, bruto, cache antigo inteiro);
  - `data_run` de cada fonte com versão, `params` e hora da carga; os dois arquivos juntos;
  - recusa (arquivo ausente, sem `versao_dados`, de outra fonte, fora do contrato) sem gravar nada,
    mesmo com o outro arquivo certo;
  - o plano só lê;
  - o resumo;
  - a linha de comando: nenhum arquivo, sem `DATABASE_URL`, `--dry-run` sem banco, carga e arquivo
    recusado.
- [x] Red: `ImportError: cannot import name 'load_files_to_db' from 'pipeline'`.
- [x] Green: `pipeline/load_files_to_db.py`, no molde da pré-carga: `FilesToDbLoader` com `plan`
  (só lê) e `run` (grava), repositories por `Protocol`, `_EmptyDatabase` no `--dry-run` sem banco.
  Nenhum SQL no script.
- [x] `tests/integration/db/test_carga_arquivos_no_banco.py` (marker `db`, 3 testes), com os
  repositories e o banco de verdade:
  - os dois arquivos nas tabelas e as duas linhas de `data_run`;
  - rodar duas vezes não muda a contagem (`cmip6_delta` 6, `ndvi_point` 2; `data_run` ganha uma
    linha por fonte em cada execução);
  - nenhuma célula coberta, nada gravado.

  Escritos depois do green da 3.3: passaram de primeira e confirmam o upsert e a chave estrangeira
  no banco real.

### Sub-tarefa 3.4: Documentação
- [x] `docs/como-preparar-os-dados-locais.md`:
  - a linha "Carregar os arquivos no banco" no caminho do zero, com o comando;
  - as células novas da busca sob demanda;
  - o pacote já leva as tabelas, e quem gera o pacote roda a carga antes do dump;
  - a conferência conta `cmip6_delta` e `ndvi_point`.
- [x] `AGENTS.md` do backend:
  - "Carga dos arquivos no banco" em "Dados da API";
  - "Banco" diz quem preenche as duas tabelas;
  - sai o "ainda não há script que carregue".

---

## 4. Critérios de Aceitação (Definition of Done)

1. Com células em `grid_cell`, a carga grava no `cmip6_delta` os deltas do ponto que cobre o centro
   de cada uma (mesma regra de borda da API) e nada para célula sem cobertura.
2. O `ndvi_point` recebe a série de cada ponto, só com registros que têm `produto`, `qualidade` e
   NDVI físico; o resto aparece como pulado no resumo.
3. Rodar duas vezes não duplica nem muda a contagem das tabelas.
4. Uma linha de `data_run` por fonte gravada, com a versão e os parâmetros do arquivo.
5. Arquivo com problema: nada é gravado.
6. Testes sem rede; testes `db` só com `TEST_DATABASE_URL`.
7. `uv run pytest` (com e sem `TEST_DATABASE_URL`), `uv run ruff check .`, `uv run ruff format --check .`
   e `pre-commit run --all-files` passando.

## 5. Decisões

- **A fonte do arquivo tem de bater.** Um arquivo de teste (`fonte: "teste"`) ou o arquivo trocado
  (`--cmip6` com o NDVI) não entra: as tabelas não têm coluna de fonte, e tudo nelas vale como NEX-GDDP
  ou MODIS. Por isso os arquivos dos testes da carga usam a chave real, com valores de teste e só em
  `tmp_path` (o mesmo que já faziam os testes do `FileCmip6Repository`).
- **`data_run` só com linha gravada.** O R3.5 vai montar o `versao_dados` da resposta a partir do
  `data_run`; registrar uma versão que não entrou no banco mostraria um dado que não está lá.
- **`finished_at` é a hora da carga**, não a do arquivo: a linha registra esta execução. O `fim` do
  arquivo fica em `params.arquivo_fim`.
- **Só o nome do arquivo em `params`:** o caminho local tem a pasta do usuário e a cópia do banco
  circula no pacote do time.
- **Arquivo ausente é erro, não aviso.** Quem passou `--ndvi` quer o NDVI; para carregar só um, passe
  só ele.
- **NDVI bruto fica de fora** (mesmo com produto e qualidade): o contrato da tabela é o físico
  (risco apontado na tarefa 0013).

## 6. Fora do escopo / riscos

- **A API ainda não lê o `ndvi_point`** (continua no arquivo do `NDVI_CACHE_PATH`).
- **Célula nova depois da carga** só tem os deltas pelo arquivo; sem o arquivo montado (por exemplo,
  só a cópia do banco), ela fica com `futuro: null` até alguém rodar a carga de novo.
- **Dois pontos do NDVI na mesma chave de 0,0025°** se juntam numa só série no `ndvi_point` (o
  upsert regrava data e produto iguais). O `CachedNdviRepository` escolhe o ponto mais perto e não
  tem esse problema. Com os pontos do R2.2 (talhões distantes) não deve acontecer.
- **Cada célula abre uma conexão** (`save_cmip6_deltas`). Para a caixa piloto (225 células) leva
  segundos; uma área muito maior pediria gravar em lote.
- **Ainda não há o arquivo do NDVI** em `data/baixados/` (o script do R2.2 não está no `main`).
  Até lá, rode a carga só com `--cmip6`.
