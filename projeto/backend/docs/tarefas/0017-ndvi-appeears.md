# Tarefa 0017: NDVI do MODIS pelo AppEEARS (script de dados)

- **Identificador:** `0017`
- **Título:** Baixar a série NDVI (MOD13Q1 + MYD13Q1) por ponto pelo AppEEARS e gravar o arquivo do contrato
- **Status:** Concluída
- **Prioridade:** Alta (o token do AppEEARS vale cerca de 48 h)
- **Roteiro:** R2.2 (Fase 2, trilha "Satélite"); depende de R0.1, R0.2 ([tarefa 0009](0009-token-earthdata-e-contrato-dados-fontes.md)) e da decisão dos anos; destrava o R3.2 (histórico do talhão)
- **Módulos Afetados:** `projeto/backend/pipeline/fetch_ndvi.py` (novo), `projeto/backend/app/repositories/external/http_client.py`, `projeto/backend/tests/unit/pipeline/test_fetch_ndvi.py`, `projeto/backend/tests/unit/repositories/external/test_http_client.py`, `projeto/backend/AGENTS.md`
- **Referências:** [roteiro de implementação](../roteiro-de-implementacao.md) (R2.2), [ADR-0005](../adr/0005-fontes-diretas-da-nasa-sem-earth-engine.md), guia do histórico NDVI (`arquivos contexto/`), PRD 7.8, `AGENTS.md` do backend ("Contrato dos dados das fontes" → NDVI)

---

## 1. Descrição e Motivação

O `FieldHistoryService` está pronto, mas o `CachedNdviRepository` não tem arquivo para ler, então o
`/talhao` devolve `historico: null`. Esta tarefa traz o dado real: um script offline que pede ao
AppEEARS a série NDVI de 16 dias do MODIS para um ou vários pontos e grava o JSON no formato do contrato
(`versao_dados` + `pontos[].serie[{data, ndvi, qualidade, produto}]`), que a API lê pelo
`NDVI_CACHE_PATH`.

Decisões do time aplicadas:

- anos **2016 a 2025**; meses de **janeiro a julho** (abril–julho é o histórico do talhão; janeiro–março
  serve para a colheita sugerida da soja);
- produtos **MOD13Q1 e MYD13Q1, coleção 061** (Terra e Aqua, defasados em 8 dias);
- só qualidade **0 ou 1** (`pixel_reliability`; `SummaryQA` se for a coluna entregue);
- `ndvi` gravado já no valor físico (fator 0,0001 aplicado), sem o valor de preenchimento (−3000).

Nomes confirmados em `GET /api/product/MOD13Q1.061` e `GET /api/product/MYD13Q1.061` (públicos):
`_250m_16_days_NDVI` (float32, `ScaleFactor` 0,0001, `FillValue` −3000, válido de −0,2 a 1) e
`_250m_16_days_pixel_reliability` (int32, `FillValue` −1, de 0 a 3).

---

## 2. Fluxo

```
python -m pipeline.fetch_ndvi [--pontos "lat,lon;..."] [--saida ...]
        │
        ▼
Credenciais (Settings): APPEEARS_TOKEN ──► GET /api/task?limit=1
        │                                    ├─ 200 → usa o token
        │                                    └─ 401/403 → POST /api/login (Basic, EARTHDATA_USERNAME/PASSWORD)
        │  sem token e sem usuário → para com mensagem clara (sem mostrar segredo)
        ▼
POST /api/task (point; datas recorrentes 01-01 a 07-31, yearRange [2016, 2025]; 4 camadas)
        │   (ou --tarefa-existente <id>, sem pedir de novo)
        ▼
GET /api/task/{id} a cada --intervalo s até "done" (limite --limite-minutos; 5xx/rede = tenta de novo;
        token vencido no meio = login de novo; estourou → código 2 e a dica do --tarefa-existente)
        ▼
GET /api/bundle/{id} → só os *-results.csv → GET /api/bundle/{id}/{file} (302 para o S3; o token não
        segue o redirecionamento) → CSVs guardados em appeears_<id>/ ao lado da saída
        ▼
CSV → filtro (qualidade 0/1, jan–jul, 2016–2025, sem preenchimento, sem duplicata) → NdviRecord
        → JSON do contrato (versao_dados validado pelo DataRun) em data/output/ndvi_modis_appeears.json
```

---

## 3. Sub-tarefas (TDD)

### Sub-tarefa 3.1: Pedido HTTP genérico
- [x] Testes em `tests/unit/repositories/external/test_http_client.py` (urlopen falso): POST com JSON e
  `Authorization` fora do redirecionamento; erro HTTP devolve o status em vez de levantar; GET com query.
- [x] Red: `ImportError: cannot import name 'HttpRequest' from 'app.repositories.external.http_client'`.
- [x] Green: `HttpRequest`, `HttpResponse`, `HttpTransport` e `default_http_request` (urllib, sem
  dependência nova; `add_unredirected_header` para o token).

### Sub-tarefa 3.2: Cliente do AppEEARS, CSV e arquivo do contrato
- [x] Testes em `tests/unit/pipeline/test_fetch_ndvi.py` (transporte HTTP falso, relógio falso, valores de
  teste): token aceito; token recusado → login; sem token → login direto; sem credencial → mensagem;
  token recusado sem login → mensagem; erro sem token nem senha; pedido da tarefa (datas, camadas, ids);
  envio e recusa da tarefa; espera até `done`, `error`, limite de tempo; download só dos `-results.csv`;
  login de novo no meio; CSV pelo nome das colunas; CSV sem NDVI; filtro de qualidade; janela de meses
  e anos; fator de escala; recusa do −3000 (bruto e escalado) e do vazio; JSON validado pelo
  `NdviRecord` e pelo `DataRun`; duplicata; `--pontos`; `--dry-run` sem rede nem credencial;
  `--tarefa-existente`; código 2 com a dica no limite; `--csv` sem rede.
- [x] Red: `ModuleNotFoundError: No module named 'pipeline.fetch_ndvi'`.
- [x] Green: `pipeline/fetch_ndvi.py` (`AppeearsClient`, `build_task_request`, `parse_appeears_csv`,
  `build_ndvi_payload`, `parse_points`, `run`).

### Sub-tarefa 3.3: Coordenada negativa na linha de comando
- [x] Teste: `--pontos -18.9543,-48.1993;-17.5,-47.25` funciona (no Brasil as duas são negativas).
- [x] Red: `error: argument --pontos: expected one argument` (o argparse lia o valor como opção).
- [x] Green: `--pontos <valor>` vira `--pontos=<valor>` antes do argparse.

### Sub-tarefa 3.4: Status passageiro
- [x] Teste: 503 na consulta do status não derruba a espera (passou de primeira: o comportamento já
  estava no green da 3.2; o teste fica para travar a regra).

### Sub-tarefa 3.5: Documentação
- [x] Parágrafo em "Dados da API" do `projeto/backend/AGENTS.md`: como rodar e que credencial usa.

---

## 4. Critérios de Aceitação (Definition of Done)

1. `uv run python -m pipeline.fetch_ndvi` com `APPEEARS_TOKEN` (ou usuário e senha da Earthdata) no
   `.env` grava `data/output/ndvi_modis_appeears.json` no formato do contrato do NDVI.
2. Só entram observações de jan–jul de 2016 a 2025, com qualidade 0 ou 1, NDVI físico entre −0,2 e 1.
3. Sem credencial, o script para com mensagem clara; nenhuma mensagem, log ou arquivo mostra token ou senha.
4. Testes sem rede real; `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e
   `pre-commit run --all-files` passando.

## 5. Fora do escopo / riscos

- **Formato exato do CSV do AppEEARS:** o parser acha as colunas pelo nome (`ID`, `Latitude`,
  `Longitude`, `Date`, `<PRODUTO>_061__250m_16_days_NDVI`, `..._pixel_reliability`) e aceita colunas a
  mais (`Category`, `MODIS_Tile`, decodificação do `VI_Quality`). Não foi possível baixar um CSV real
  sem token. Se a primeira extração falhar no parse, os CSVs ficam em `appeears_<tarefa>/` e podem ser
  convertidos de novo com `--csv`, sem pedir outra tarefa.
- **Escala:** os metadados dizem que o AppEEARS entrega o NDVI já escalado (float32). O script decide
  por produto: se algum valor tiver |NDVI| > 1, aplica o fator 0,0001 no arquivo todo.
- **Janela recorrente:** a tarefa usa `recurring: true` com `01-01` a `07-31` (formato `MM-DD` da
  documentação). Uma composição que começa em 27/jul cobre até meados de agosto; ela entra, porque a
  data da composição está dentro da janela.
- **Ligação na API (R3.2):** o `CachedNdviRepository` ainda lê só `data` e `ndvi`; ler `qualidade` e
  `produto` e apontar o `NDVI_CACHE_PATH` para o arquivo é do R3.2.
- **Reserva ORNL** (`--fonte ornl`): não feita nesta tarefa.
- **Caixa inteira a 250 m** (P3): fora do escopo.
