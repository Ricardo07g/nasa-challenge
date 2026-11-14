# Tarefa 0023: CMIP6 por área (um pedido por arquivo para a caixa inteira)

- **Identificador:** `0023`
- **Título:** Modo por área no script dos deltas do NEX-GDDP-CMIP6 (OPeNDAP em ASCII) e saída na pasta do time
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R2.1 (continuação da [tarefa 0014](0014-deltas-cmip6.md)); alimenta o R3.1 ([tarefa 0021](0021-nota-de-futuro-cmip6.md)) com a caixa piloto inteira
- **Módulos Afetados:** `projeto/backend/pipeline/fetch_cmip6_deltas.py`, `projeto/backend/tests/unit/pipeline/test_fetch_cmip6_deltas.py`, `projeto/backend/tests/unit/pipeline/test_fetch_cmip6_deltas_area.py` (novo), `projeto/backend/AGENTS.md`, `projeto/backend/docs/como-preparar-os-dados-locais.md`
- **Referências:** PRD §7.3, contrato "CMIP6" do `AGENTS.md` do backend, seção 6 da tarefa 0014

---

## 1. Descrição e motivação

O `pipeline/fetch_cmip6_deltas.py` (tarefa 0014) pede ao NCSS da NCCS **um ponto por vez**. Cada
arquivo do THREDDS guarda cada dia como um bloco do globo inteiro (`_ChunkSizes` 1 × 600 × 1440), então
o custo de um pedido cresce com o número de dias, não com a área. A caixa piloto (12 células do POWER)
dava 4.320 pedidos de ~6 s, **cerca de 8 h**. O time quer o clima futuro da caixa toda.

Esta tarefa acrescenta o modo **por área**: um pedido por arquivo anual (modelo × variável × ano) com o
retângulo de pixels que cobre todos os pontos, sem biblioteca nova. A caixa cai para **378 pedidos,
cerca de 45 min** (12 vezes menos pedidos).

## 2. Método escolhido e medidas (chamadas reais em 14/11/2026)

| Pedido (jan–jul de 1 ano, 1 variável) | Tempo | Tamanho |
| --- | --- | --- |
| NCSS, 1 ponto, CSV (modo da 0014) | 5,9 s | 18 kB |
| OPeNDAP ASCII, caixa piloto com margem (8 × 8 pixels) | 5,6 s; 6,9 s; 8,5 s; 14,6 s (o primeiro do dia) | ~160 kB |
| OPeNDAP ASCII, 1 pixel | 4,9 s | 6 kB |
| OPeNDAP ASCII, caixa 4 vezes maior (16 × 16) | 12,6 s | 600 kB |
| OPeNDAP ASCII pelo script (7 × 6 pixels, `CachedOpendapFetcher`) | 6,5 s | 113 kB |
| DAS (só atributos) | 0,9 s | 4 kB |

- **OPeNDAP em ASCII** (`/thredds/dodsC/...nc.ascii?pr[0:1:211][160:1:166][1245:1:1250]`): legível
  com a biblioteca padrão e o cliente `urllib` que já existe. A resposta traz o recorte e os eixos
  `time`, `lat` e `lon` do recorte, que o script confere.
- **NCSS por área** não serve: com caixa (`north/south/east/west`) o NCSS de grade só devolve NetCDF,
  que pediria biblioteca (ou um leitor binário próprio).
- O servidor recusa `[` e `]` crus na URL (HTTP 400 do Tomcat): o script codifica (`%5B`, `%5D`).
- Recorte errado volta como `Error { code = 3; message = "..." };` (HTTP 400). Nada disso entra no cache.
- **Conferência real:** o pixel da fazenda de exemplo no recorte por área (ACCESS-CM2, `pr`, 1995, 212
  dias) é **idêntico** ao CSV do modo por ponto que já estava no cache do time.

## 3. Como o modo por área funciona

```
--area (caixa piloto) ou --area="lat_min,lat_max,lon_min,lon_max"
   │  pontos = células do POWER que cobrem a caixa (box_points, igual ao pilot_box_points)
   │  pixel de cada ponto = o que o NCSS devolveria (ncss_pixel)
   │  retângulo = menor janela com todos esses pixels (caixa piloto: lat 160–166, lon 1245–1250)
   ▼
para cada modelo → variável → período:
   DAS do 1º ano ── confere unidade (kg m-2 s-1, K), calendário gregoriano e "days since AAAA-MM-DD"
   para cada ano: recorte ASCII (jan–jul) ── confere variável, tamanho, eixos lat/lon e nº de dias
   ▼
dias = origem + tempo; recusa se não forem exatamente 1/jan a 31/jul do ano
série de cada pixel usado (sem o preenchimento 1,0E20) → mm/dia e °C → média por mês
   ▼
delta por ponto e modelo: a mesma conta do modo por ponto (monthly_means + monthly_deltas)
   ▼
mesmo arquivo do contrato CMIP6 (versao_dados.parametros.servico diz "OPeNDAP (recorte por área, ASCII)")
```

- **Mesmo pixel do modo por ponto:** o NCSS fica com o centro de 0,25° mais perto e, no empate (os
  pontos da caixa piloto caem na borda entre dois pixels), com o de **coordenada maior**. Conferido em
  12 pedidos reais de 1 dia (um por ponto da caixa): −20,0 → −19,875; −19,5 → −19,375; 311,25 (−48,75)
  → 311,375 (−48,625); 312,5 (−47,5) → 312,625 (−47,375). `ncss_pixel` usa `floor(x + 0,5)`; o
  arredondamento do Python (`round`, para o par) erraria a longitude −48,75.
- **Pixel sem dado** (preenchimento) que nenhum ponto usa não atrapalha; pixel usado sem dado em
  algum mês para com erro, como no modo por ponto.
- **Cache e retomada:** na mesma pasta do modo por ponto (`<cache>/<modelo>/<exp>/<var>/`), com nomes
  próprios: `<ano>_area_lat160-166_lon1245-1250.ascii` e `<ano>_atributos.das`. Resposta conferida antes
  de entrar no cache, gravada com nome provisório (`.part`) e renomeada no fim. Parou: rode de novo.
- **Saída e cache padrão:** `data/baixados/nasa_nex_gddp_cmip6/cmip6_deltas_nex_gddp.json` e
  `data/baixados/nasa_nex_gddp_cmip6/cache_ncss/`, a partir da raiz do repositório calculada pelo
  caminho do script (`repo_root`), não pela pasta atual. No container (`/app/pipeline/`) a raiz fica
  `/app`. Antes eram `data/output/...` e `data/cache/...` relativos a `projeto/backend`.
- **`--dry-run`** mostra pedidos, quantos já estão no cache e o tempo estimado **nos dois modos**, e
  qual deles a execução usaria. `--area` e `--pontos` não andam juntos.

```text
$ uv run python -m pipeline.fetch_cmip6_deltas --dry-run --area
Pontos: 12 | modelos: 3 (ACCESS-CM2, MPI-ESM1-2-HR, MRI-ESM2-0) | variáveis: pr, tasmax, tasmin | anos: 20 base + 20 futuro
Por ponto (NCSS, CSV): 4320 pedidos (já no cache: 0; faltam: 4320), ~7,8 h (~6 s por pedido + 0,5 s de pausa)
Por área (OPeNDAP, ASCII, 7 × 6 pixels de 0,25°): 378 pedidos, 360 de dados e 18 de atributos (já no cache: 0; faltam: 378), ~45 min (~7 s por recorte e ~1 s por DAS, + 0,5 s de pausa)
Modo desta execução: por área (--area)
```

## 4. Sub-tarefas (TDD)

### Sub-tarefa 4.1: Saída e cache na pasta do time
- [x] Testes em `test_fetch_cmip6_deltas.py`: raiz pelo caminho do script, raiz no container (`/app`),
  padrões em `data/baixados/nasa_nex_gddp_cmip6/` sem depender da pasta atual.
- [x] Red: `ImportError: cannot import name 'repo_root'`.
- [x] Green: `repo_root`, `DOWNLOADS_DIR`, `DEFAULT_OUTPUT` e `DEFAULT_CACHE_DIR`.

### Sub-tarefa 4.2: Modo por área
- [x] `tests/unit/pipeline/test_fetch_cmip6_deltas_area.py` (56 testes, HTTP falso): pixel igual ao que
  o NCSS devolveu (tabela **real** dos 12 pontos da caixa e da fazenda); ponto fora da grade; menor
  retângulo; caixa padrão, caixa da linha de comando e caixa inválida; URLs do ASCII (213 e 212 dias) e
  do DAS; trechos **reais** do ASCII, do erro do OPeNDAP e do DAS (ACCESS-CM2 e MPI-ESM1-2-HR); recusa
  de erro, HTML, outra variável, outros pixels e resposta pela metade; dias fora de 1/jan–31/jul;
  descarte do preenchimento; unidade e calendário do DAS; cache, pausa, resposta inválida fora do cache
  e retomada; um pedido por arquivo para a caixa toda; **cada ponto igual ao modo por ponto** com a
  mesma grade de teste (o `FakeGridThredds` serve a grade pelo NCSS e pelo OPeNDAP, com valor diferente
  em cada pixel); pixel sem dado que ninguém usa; JSON validado por `Cmip6Delta` e `DataRun`; `fim`
  depois do último pedido; CLI com `--area`, `--area=...`, `--area` + `--pontos` recusado e `--dry-run`
  nos dois modos (com e sem cache).
- [x] Dado de teste só com `MODELO-TESTE` e valores redondos; os trechos reais estão marcados.
- [x] Red: com um esqueleto de nomes, 55 falhas (52 `NotImplementedError` e 3 `SystemExit: 2` do
  `--area` desconhecido).
- [x] Green: `ncss_pixel`, `pixel_window`, `box_points`, `parse_box`, `opendap_ascii_url`,
  `opendap_das_url`, `parse_das`, `parse_opendap_ascii`, `grid_dates`, `daily_values`,
  `CachedOpendapFetcher` e `build_cmip6_deltas_by_area`. O cache do modo por ponto passou a dividir o
  código com o do modo por área (`_CachedTextFetcher`), sem mudar o comportamento.
- [x] Mutação conferida: trocar a regra do empate por `round` derruba 8 testes (tabela real, retângulo,
  igualdade com o modo por ponto e `--dry-run`).
- [x] Refactor: o recorte é lido coluna a coluna (os testes da área caíram de ~3 s para ~0,6 s cada).

### Sub-tarefa 4.3: Documentação
- [x] `projeto/backend/AGENTS.md` ("Deltas do CMIP6" e `CMIP6_PATH` com uv) e
  `docs/como-preparar-os-dados-locais.md` (comando da caixa inteira e tempos novos).

## 5. Critérios de aceitação (Definition of Done)

1. `--area` baixa cada arquivo uma vez e grava as 12 células da caixa piloto no contrato CMIP6.
2. Cada ponto sai igual ao modo por ponto (teste com a mesma grade nos dois modos).
3. Cache e retomada iguais aos do modo por ponto; resposta inválida não entra no cache.
4. Saída e cache padrão em `data/baixados/nasa_nex_gddp_cmip6/`, pela raiz do repositório.
5. `--dry-run` mostra pedidos e tempo nos dois modos, sem rede.
6. Sem dependência nova; testes sem rede real.
7. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.

## 6. Fora do escopo / riscos

- **A extração completa não foi rodada** (só 1 DAS e 1 recorte pelo script, além das sondas). O tempo
  de ~45 min é estimativa com ~7 s por recorte; o servidor variou de 5,6 s a 14,6 s.
- **Rodar de um worktree** grava no `data/baixados` daquele worktree (a raiz é a do script). Para usar
  a pasta do time, rode do checkout principal ou passe `--saida` e `--cache`.
- **Calendário:** os três modelos padrão usam `proleptic_gregorian`. Modelo com 365 ou 360 dias é
  recusado pelo DAS (e, se escapasse, pela conferência dos dias), nunca lido com as datas erradas.
- **Um DAS por variável e período** (o do primeiro ano): os outros anos do mesmo modelo, experimento
  e variável são da mesma versão (`_v2.0`) e não têm o DAS conferido um a um.
- **Pedidos em sequência** (pausa de 0,5 s), como no modo por ponto. Pedidos em paralelo cortariam mais
  o tempo, mas pesam no servidor público da NCCS.
- **Caixa que cruza o meridiano 0°** daria um retângulo com quase todas as longitudes (correto, mas
  grande). Não acontece no Brasil.
- **Pixel do ponto:** continua sendo um pixel de 0,25° por célula do POWER (o mesmo do modo por ponto),
  não a média dos pixels da célula. Mudar isso mudaria o resultado dos dois modos.
