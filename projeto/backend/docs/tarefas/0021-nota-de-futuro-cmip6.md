# Tarefa 0021: Nota de futuro lendo os deltas do NEX-GDDP-CMIP6

- **Identificador:** `0021`
- **Título:** Nota de futuro na API: deltas do CMIP6 da tabela `cmip6_delta`, do arquivo do `CMIP6_PATH` e da fixture
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R3.1 (Fase 3, trilha "futuro"); depende do R2.1 ([tarefa 0014](0014-deltas-cmip6.md)) e, para ler do banco, do R1.6 ([tarefa 0013](0013-migracao-fontes-novas.md))
- **Módulos Afetados:** `projeto/backend/app/config.py`, `projeto/backend/.env.example`, `projeto/backend/app/repositories/cmip6_repository.py`, `projeto/backend/app/repositories/climate_repository.py`, `projeto/backend/app/services/climate_risk_service.py`, `projeto/backend/app/models/climate.py` (docstring), `projeto/backend/app/dependencies.py`, `projeto/backend/tests/`, `projeto/backend/AGENTS.md`
- **Referências:** PRD §7.3 e §7.6, plano técnico §3.1, §3.2 e §4.3, [roteiro](../roteiro-de-implementacao.md) (R3.1), "Dados da API" e contrato "CMIP6" do `AGENTS.md` do backend, front `src/models/talhao.ts` e `src/models/recomendacao.ts`

---

## 1. Descrição e motivação

O motor já simulava o clima de 2041–2060 (`ClimateRiskService.simulate_future_cmip6`, método do delta
do PRD 7.3) e o `TalhaoService` já punha `nex_gddp_cmip6` em `dados[]` quando havia deltas. Mas nada
chegava a eles:

- `PostgisClimateRepository.get_cmip6_deltas` só repassava à fixture do clima;
- a fixture não tem `cmip6[]`.

Por isso a resposta saía com `futuro: null` e a nota final usava 3 eixos. Esta tarefa liga as duas
fontes que já existem:

- a tabela `cmip6_delta` da migração R1.6;
- o arquivo do contrato CMIP6 que o `pipeline/fetch_cmip6_deltas.py` (R2.1) grava.

O motor também passa a usar o `tmin_c`.

## 2. Como os deltas chegam na resposta

```
get_cmip6_deltas(cell_id)        a primeira fonte com deltas vale; as outras não são consultadas
  1. tabela cmip6_delta          só com banco (PostgisCmip6Repository)
  2. arquivo do CMIP6_PATH       FileCmip6Repository: ponto cuja cobertura contém o centro da célula
  3. cmip6[] da fixture do clima CLIMA_PATH (hoje vazia)
        │
        ▼
TalhaoService       → dados[]: {fonte: nex_gddp_cmip6, periodo: 2041-2060, cenario, modelos: <n>}
RecommendationService → futuro {anos_bons_media, min, max, modelos, cenario} e notas.futuro
```

- **Com banco**, o `dependencies.py` monta o `PostgisClimateRepository` com as três fontes, nessa ordem.
- **Sem banco**, monta o `FixtureClimateRepository`, que consulta o arquivo antes da própria `cmip6[]`.
- **Cobertura:** a célula de 0,1° recebe os deltas do ponto cuja `cobertura` (célula do NASA POWER,
  0,5° × 0,625°) contém o centro dela. A regra é a da fixture do clima: borda de baixo dentro, borda
  de cima fora.
- **Sem dado:** sem `CMIP6_PATH`, sem arquivo, sem ponto que cubra a célula ou com id de célula mal
  formado, nenhum delta. A resposta fica como antes (`futuro: null`), sem nada inventado.
- **Motor** (`project_season`): soma o `tmin_c` do mês à mínima observada e usa a máxima e a mínima
  novas no Hargreaves-Samani da razão da ETo. Sem `tmin_c`, a mínima observada fica.

## 3. Sub-tarefas (TDD)

### Sub-tarefa 3.1: `CMIP6_PATH` no `Settings`
- [x] `tests/unit/test_config.py`: padrão `None` e leitura da variável. `CMIP6_PATH` entra na lista de
  variáveis isoladas dos testes (também no `tests/integration/db/conftest.py`).
- [x] Red: `AttributeError: 'Settings' object has no attribute 'cmip6_path'`.
- [x] Green: `cmip6_path: Path | None = None` e o nome comentado no `.env.example`.

### Sub-tarefa 3.2: Repository do arquivo
- [x] `tests/unit/repositories/test_cmip6_repository.py` (9 testes, arquivo de teste com `MODELO-TESTE`
  e valores redondos). Casos cobertos:
  - deltas do ponto que cobre a célula, e não os do vizinho;
  - todos os meses e modelos do ponto;
  - célula fora de toda cobertura;
  - bordas da cobertura;
  - `tmin_c` ausente ou `null`;
  - sem caminho ou arquivo inexistente;
  - id mal formado;
  - delta fora do contrato recusado pelo model.
- [x] Red: `ImportError: cannot import name 'FileCmip6Repository'`.
- [x] Green: `FileCmip6Repository` em `cmip6_repository.py`. Outras mudanças:
  - o `Protocol` de leitura (`Cmip6Repository`) fica separado do de gravação
    (`WritableCmip6Repository`), como no NDVI;
  - a leitura de um item `cmip6[]` vira `cmip6_delta_from_json` (`climate_repository.py`), usada pelo
    arquivo e pela fixture.

### Sub-tarefa 3.3: Ordem de leitura
- [x] `tests/unit/repositories/test_climate_repository.py`. Casos cobertos:
  - a fixture lê o `tmin_c`;
  - sem banco, o arquivo vem antes da `cmip6[]` da fixture, e a fixture entra quando o arquivo não
    tem a célula;
  - com banco, a tabela vem antes do arquivo, o arquivo antes da reserva, e sem nenhum o resultado
    é vazio (fontes falsas que contam as consultas).
- [x] Red:
  - `TypeError: FixtureClimateRepository.__init__() got an unexpected keyword argument 'cmip6_file_repo'`;
  - o mesmo para o `cmip6_repo` do `PostgisClimateRepository`;
  - `assert [None, None] == [1.0, None]` (fixture sem `tmin_c`).
- [x] Green: `cmip6_file_repo` na fixture; `cmip6_repo` e `cmip6_file_repo` no PostGIS. O
  `climate_repository.py` importa o tipo `Cmip6Repository` só em `TYPE_CHECKING`, porque o
  `cmip6_repository.py` importa dele as funções da célula e o import seria circular.

### Sub-tarefa 3.4: `tmin_c` no motor
- [x] `tests/unit/services/test_climate_risk_service.py`, dois casos:
  - mínima + `tmin_c` e ETo igual ao Hargreaves com máxima e mínima novas;
  - sem `tmin_c`, a mínima observada fica.
- [x] Red: `assert 18.0 == 21.0 ± 2.1e-05`.
- [x] Green: `project_season` aplica o delta da mínima.

### Sub-tarefa 3.5: Ligação e rotas
- [x] `tests/unit/test_dependencies.py`, dois casos:
  - com banco: tabela (`PostgisCmip6Repository`) e arquivo do `CMIP6_PATH`;
  - sem banco: os deltas do arquivo chegam pelo `get_climate_repository`.
- [x] `tests/integration/controllers/test_futuro_cmip6.py` (API montada pelo `dependencies.py`, sem
  banco, com a fixture de clima real e o arquivo de teste). Casos cobertos:
  - com deltas: `/talhao` lista `nex_gddp_cmip6` com `modelos: 2`;
  - com deltas zero: em `/recomendacao`, o `futuro` de cada opção é igual ao passado, a
    `notas.futuro` é igual à `notas.seguranca` e a frase do NEX-GDDP-CMIP6 aparece no `porque`;
  - com arquivo que só cobre outra célula do POWER, ou sem arquivo: `futuro` e `notas.futuro`
    `null` e só `nasa_power` em `dados`.
- [x] Red:
  - `isinstance(None, PostgisCmip6Repository)`;
  - `assert [] == [('MODELO-TESTE', 2, 1.0)]`;
  - `dados` sem `nex_gddp_cmip6`;
  - `assert None == {'anos_bons_media': 13, ...}`.

  Os casos sem deltas já passavam: eles fixam o comportamento de antes.
- [x] Green: `get_climate_repository` monta as fontes.

### Sub-tarefa 3.6: Banco de teste (marker `db`)
- [x] `tests/integration/db/test_futuro_cmip6_db.py`. Casos cobertos:
  - com a célula em `grid_cell` e deltas em `cmip6_delta`, `/talhao` e `/recomendacao` mostram o
    futuro, sem chamar o POWER;
  - com a tabela sem deltas da célula, `futuro: null`;
  - a tabela vem antes do arquivo, e o arquivo entra quando a tabela fica vazia.
- [x] Red, com o `dependencies.py` da sub-tarefa anterior revertido:
  `assert {'fonte': 'nex_gddp_cmip6', ..., 'modelos': 1} in [{'fonte': 'nasa_power', ...}]`.

### Sub-tarefa 3.7: Documentação
- [x] `AGENTS.md` do backend:
  - nova seção "Deltas do CMIP6 na API" em "Dados da API": a ordem de leitura e como ligar o arquivo
    com uv e no compose (`CMIP6_PATH`);
  - "Banco": a API já lê o `cmip6_delta`;
  - contrato CMIP6: o `tmin_c` passa a ser lido.

## 4. Decisões

- **`modelos` em `dados[]` é a quantidade de modelos**, não a lista de nomes. É o que o plano técnico
  §3.1 mostra (`"modelos": 3`) e o tipo do front (`talhao.ts`: `modelos?: number`). Os nomes ficam no
  `versao_dados.parametros` do arquivo.
- **A primeira fonte com deltas vale, sem misturar.** Se a tabela tem a célula, o arquivo não é lido,
  mesmo que tenha outros modelos. Assim a faixa entre modelos sai de uma carga só.
- **`CMIP6_PATH` sem padrão**, como os caches de solo e NDVI. O arquivo real ainda não existe no repo
  (a extração completa leva ~8 h) e a API não aponta para um arquivo que não está lá.
- **O arquivo não é limitado à cobertura da fixture do clima.** Quem diz que células ele cobre é a
  `cobertura` de cada ponto. Sem banco, só a célula da fixture tem temporadas, então na prática nada muda.
- **Com banco, a fixture de reserva não recebe o arquivo**: o `PostgisClimateRepository` já o consulta
  antes, e o arquivo não é lido duas vezes.

## 5. Critérios de aceitação (Definition of Done)

1. Com deltas para a célula (tabela ou arquivo), `/talhao` lista `nex_gddp_cmip6` e `/recomendacao`
   preenche `futuro` e `notas.futuro`.
2. Sem deltas, a resposta é a de antes (`futuro: null`, nota final com 3 eixos).
3. Ordem tabela → arquivo → fixture testada sem banco (fontes falsas) e com banco.
4. Testes sem rede; os deltas de teste usam `MODELO-TESTE` e valores redondos.
5. `uv run pytest` (com e sem `TEST_DATABASE_URL`), `uv run ruff check .`, `uv run ruff format --check .`
   e `pre-commit run --all-files` passando.

## 6. Fora do escopo / riscos

- **O arquivo real não foi gerado nem commitado.** Até alguém rodar o `pipeline/fetch_cmip6_deltas.py`
  e apontar o `CMIP6_PATH`, a API responde como antes. Onde o arquivo fica (por exemplo
  `app/fixtures/`, para o compose enxergar) é decisão do time ("Dados da API" no `AGENTS.md`).
- **Não há carga do arquivo na tabela `cmip6_delta`.** A tabela exige a célula em `grid_cell`, e repetir
  os deltas da célula do POWER em cada célula de 0,1° (incluindo as novas da busca sob demanda) fica
  para quem escrever essa carga. Hoje a tabela só tem o que for gravado pelo
  `PostgisCmip6Repository.save_cmip6_deltas`.
- **Com banco, cada `/talhao` e `/recomendacao` faz uma consulta a mais** (`cmip6_delta`). Um banco
  sem a migração R1.6 (tabela agregada antiga) dá erro nessa consulta. O serviço `migration` do
  compose aplica a migração sozinho.
- **Arquivo fora do contrato** (por exemplo `chuva_pct < -100`) faz o model recusar o registro
  (`ValueError`), e as rotas da célula coberta respondem 500. A escolha é falhar alto em vez de
  esconder dado ruim.
- **O arquivo é lido uma vez por processo** (repository em `lru_cache`). Trocar o arquivo pede reiniciar
  a API.
- **Pixel do delta:** cada célula do POWER usa o pixel de 0,25° do NEX-GDDP mais próximo do centro
  (tarefa 0014), não a média dos pixels da célula.
- O `cenario` mostrado vem do primeiro delta (o arquivo do R2.1 só tem `ssp245`).
