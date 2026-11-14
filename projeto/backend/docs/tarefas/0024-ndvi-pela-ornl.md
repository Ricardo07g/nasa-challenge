# Tarefa 0024: NDVI do MODIS pela ORNL DAAC (`--fonte ornl`)

- **Identificador:** `0024`
- **Título:** Reserva do AppEEARS no script do NDVI: a mesma série (MOD13Q1 + MYD13Q1) pelo serviço de recortes da ORNL, sem credencial e sem fila
- **Status:** Concluída
- **Prioridade:** Alta (a tarefa do AppEEARS ficou mais de 3 h em `pending` e o histórico do talhão depende do arquivo)
- **Roteiro:** R2.2 (reserva prevista na [ADR-0005](../adr/0005-fontes-diretas-da-nasa-sem-earth-engine.md)); continua a [tarefa 0017](0017-ndvi-appeears.md)
- **Módulos Afetados:** `projeto/backend/pipeline/fetch_ndvi.py`, `projeto/backend/tests/unit/pipeline/test_fetch_ndvi_ornl.py` (novo), `projeto/backend/AGENTS.md`, `projeto/backend/docs/como-preparar-os-dados-locais.md`
- **Referências:** `AGENTS.md` do backend ("Dados da API" → NDVI e "Contrato dos dados das fontes" → NDVI), [roteiro](../roteiro-de-implementacao.md) (seção das fontes e R2.2), API da ORNL `https://modis.ornl.gov/rst/api/v1/`

---

## 1. Descrição e Motivação

O `pipeline/fetch_ndvi.py` pede o NDVI ao AppEEARS, que coloca a tarefa numa fila. A do time ficou
mais de 3 h em `pending`, sem erro, e sem o arquivo o `/talhao` responde `historico: null`. A ORNL
DAAC serve os mesmos produtos (MOD13Q1 e MYD13Q1, coleção 061) por um serviço de recortes sem login e
sem fila, só que lento e instável. Esta tarefa liga essa reserva no mesmo script, gravando o mesmo
arquivo do contrato.

Também muda a saída padrão das duas fontes para a pasta do time, a partir da raiz do repositório (como
o CMIP6): `data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json`, que é o que o compose liga no
`NDVI_CACHE_PATH`. O nome do arquivo continua; o `versao_dados.parametros.servico` diz a fonte real.

## 2. O que a ORNL devolve (conferido em 14/11/2026, fazenda de exemplo)

- `GET /{produto}/bands`: metadados das bandas. `250m_16_days_NDVI` com `scale_factor` `0.0001`,
  `fill_value` `-3000`, `valid_range` `-2000 to 10000`, `add_offset` `0`; `250m_16_days_pixel_reliability`
  com `fill_value` `-1` e `valid_range` `0 to 3`, sem escala. ~17 s.
- `GET /{produto}/dates?latitude=..&longitude=..`: `{"dates": [{"modis_date": "A2016001",
  "calendar_date": "2016-01-01"}, ...]}`, de 2000 até hoje. ~28 s. As 140 datas do MOD13Q1 em jan–jul
  de 2016 a 2025 são exatamente o calendário de 16 dias (Terra no dia juliano 1, Aqua no 9).
- `GET /{produto}/subset?latitude=..&longitude=..&startDate=A..&endDate=A..&kmAboveBelow=0&kmLeftRight=0`:
  um pixel (`nrows` = `ncols` = 1); `subset[]` com um item por data e banda, `data: [<inteiro>]`.
  O **NDVI vem bruto** (ex.: `3253`); com `band=` o cabeçalho traz `"scale": "0.0001"`, sem `band` vêm as
  12 bandas e não há escala no cabeçalho (por isso a escala vem do `/bands`).
- **Tempo por pedido** (um pixel): 4 e 5 datas com todas as bandas em 19 a 29 s; 7 e 10 datas de uma
  banda em 35 a 57 s; 6, 7 e 10 datas com todas as bandas entre 55 s e **502 Proxy Error aos ~60 s**,
  e até um pedido de 1 data deu 502. O tempo depende mais da carga do serviço do que do tamanho.
- O host do cabeçalho (`modisrest.ornl.gov`) não responde de fora.

## 3. Fluxo

```
python -m pipeline.fetch_ndvi --fonte ornl [--pontos ...] [--saida ...] [--cache ...]
        │                       [--datas-por-pedido 5] [--pausa 5]
        ▼
GET /MOD13Q1/bands e /MYD13Q1/bands (uma vez por produto) → escala e preenchimento do NDVI
        ▼  para cada ponto e produto
GET /{produto}/dates → só jan–jul de 2016 a 2025 → blocos de até 5 datas, sem cruzar o ano
        │  (Terra 14 por ano: 5+5+4; Aqua 13: 5+5+3 → 60 recortes por ponto)
        ▼
GET /{produto}/subset (todas as bandas, um pixel) por bloco
        │  retentativa: rede, 5xx, 429, corpo fora do formato → espera 20, 40, 80 s (4 tentativas);
        │  4xx → erro na hora (código 1)
        │  resposta conferida (NDVI e qualidade em todas as datas do bloco, um valor numérico)
        │  → cache_ornl/lat<lat>_lon<lon>/<produto>/<início>_<fim>.json (arquivo provisório
        │  renomeado no fim); já no cache → nem pede; pausa de --pausa s depois de cada pedido
        ▼
recorte sem resposta → fica de fora e a execução segue; 3 seguidos → desiste (a ORNL caiu)
        ▼
algum recorte faltou → código 2, nada gravado na saída (rode de novo: continua do cache)
tudo veio → NDVI × escala, −3000 vira sem dado → mesmo filtro do AppEEARS (qualidade 0/1,
        jan–jul, 2016–2025, faixa −0,2 a 1, sem duplicata) → JSON do contrato, gravado por
        arquivo provisório renomeado
```

`versao_dados`: `fonte` `modis_mod13q1` (o dado é o mesmo), `parametros` com `servico: "ornl"`,
`url`, `produtos`, `colecao` `061`, `camadas` (nomes da ORNL), `anos`, `meses`, `qualidade_aceita`,
`pontos` e `fator_escala` (o que a ORNL declarou).

---

## 4. Sub-tarefas (TDD)

### Sub-tarefa 4.1: Calendário, blocos, respostas, cliente, cache e linha de comando
- [x] Testes em `tests/unit/pipeline/test_fetch_ndvi_ornl.py` (HTTP falso, relógio falso, valores de
  teste; um trecho de resposta real marcado como amostra): calendário de 16 dias (140 do Terra, 130 do
  Aqua); blocos sem cruzar o ano e recusa de mais de 10 datas; escala e preenchimento do `/bands` e
  recusa sem escala, sem qualidade ou fora do formato; datas da janela; recorte real com a escala
  aplicada; −3000 vira sem dado; recusa de recorte sem data, sem banda, sem valor, com mais de um pixel
  ou sem `subset`; retentativa (502, rede, corpo que não é JSON) com espera 20, 40, 80 s; desiste
  depois de 4 tentativas com erro "retomável"; 4xx sem retentativa; parâmetros do recorte (um pixel);
  cache só com resposta conferida e reaproveitado; arquivo do contrato validado pelo `DataRun` e pelo
  `NdviRecord`, sem credencial; cache ao lado da saída; retomada sem pedido nenhum; código 2 com um
  recorte falhando (nada gravado, o resto no cache); para depois de 3 recortes seguidos sem resposta;
  `--dry-run` com pedidos e tempo; `--dry-run` contando só o que falta no cache; vários pontos com
  uma pasta por ponto e as bandas pedidas uma vez por produto; `repo_root` e saída padrão na pasta do
  time.
- [x] Red: `ImportError: cannot import name 'DEFAULT_OUTPUT' from 'pipeline.fetch_ndvi'` (nada da
  ORNL existia).
- [x] Green: `modis_calendar`, `plan_blocks`, `parse_ornl_bands`, `parse_ornl_dates`,
  `check_ornl_subset`, `parse_ornl_subset`, `OrnlClient`, `CachedOrnlFetcher`,
  `fetch_ornl_observations`, `ornl_plan_text`, `repo_root`, `DEFAULT_OUTPUT`, `--fonte`, `--cache`,
  `--datas-por-pedido`, `--pausa`; `build_ndvi_payload` ganhou `service` e `extra_params`; a saída é
  gravada por arquivo provisório renomeado (as duas fontes).

### Sub-tarefa 4.2: Documentação
- [x] "Dados da API" do `AGENTS.md` do backend: as duas fontes, saída padrão e comandos.
- [x] `docs/como-preparar-os-dados-locais.md`: NDVI pela ORNL, sem credencial, quando usar cada
  fonte e o que fazer com o código 2.

---

## 5. Critérios de Aceitação (Definition of Done)

1. `uv run python -m pipeline.fetch_ndvi --fonte ornl` grava, sem credencial, o arquivo do contrato do
   NDVI em `data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json` (a partir da raiz do repositório).
2. Só entram observações de jan–jul de 2016 a 2025, com qualidade 0 ou 1 e NDVI físico entre −0,2 e 1
   (escala da ORNL aplicada, −3000 recusado).
3. Interrompido ou com recorte sem resposta: código 2 e nada gravado na saída; rodar de novo só pede o
   que falta.
4. `--dry-run` mostra os pedidos, o que já está no cache e o tempo estimado, sem rede.
5. `--fonte appeears` continua o padrão e sem mudança de comportamento (só a pasta de saída padrão).
6. Testes sem rede real; `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e
   `pre-commit run --all-files` passando.

## 6. Decisões

- **Todas as bandas num pedido** (sem o parâmetro `band`): NDVI e qualidade vêm juntos, e o tempo
  medido não cresceu com o número de bandas. Metade dos pedidos de um por banda (60 recortes por ponto
  em vez de 120 com blocos de 5). A escala vem do `/bands`, porque sem `band` o recorte não a traz.
- **5 datas por pedido** (máximo 10 do serviço): com 6 ou mais, os pedidos passaram perto dos 60 s
  e vários voltaram 502. Jan–jul cabe em 3 recortes por ano e produto.
- **Lista de datas da própria ORNL** na extração (2 pedidos por ponto); o calendário de 16 dias só
  serve para o plano do `--dry-run` quando a lista ainda não está no cache.
- **Nada gravado na saída se faltar recorte:** um ano sem recorte viraria `sem_dado` no histórico por
  falha de rede, não por falta de imagem boa.
- **Mesmo nome de arquivo** para as duas fontes (o compose procura esse nome).
- O cache usa nome provisório com o PID (`<arquivo>.<pid>.part`): dá para rodar um processo por ponto
  com o mesmo `--cache` sem que um sobrescreva o arquivo provisório do outro.

## 7. Fora do escopo / riscos

- **Instabilidade da ORNL:** em horário de carga, até pedidos pequenos dão 502. A retentativa e a
  retomada pelo cache cobrem isso, mas a extração pode levar mais que a estimativa.
- **Recorte que nunca responde:** se um bloco falhar sempre, a saída não é gravada. Dá para tentar
  com `--datas-por-pedido` menor (os blocos mudam e entram no cache com outro nome).
- **Coleção:** a ORNL não diz a versão na API; o `proc_date` de 2021 indica a coleção 6.1 (061).
- **Pixel:** `kmAboveBelow=0` e `kmLeftRight=0` devolvem o pixel de 250 m que contém o ponto, como o
  AppEEARS; a API aceita o ponto do arquivo a até 250 m do talhão.
