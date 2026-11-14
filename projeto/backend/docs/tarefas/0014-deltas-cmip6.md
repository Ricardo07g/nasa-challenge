# Tarefa 0014: Deltas mensais do NEX-GDDP-CMIP6 pelo THREDDS da NCCS

- **Identificador:** `0014`
- **Título:** Deltas mensais do NEX-GDDP-CMIP6 por ponto (script offline, recorte por ponto no THREDDS)
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R2.1 (Fase 2, trilha "futuro"); depende do R0.2 ([tarefa 0009](0009-token-earthdata-e-contrato-dados-fontes.md)); destrava R3.1 (leitura na API) e alimenta a tabela do R1.6
- **Módulos Afetados:** `projeto/backend/pipeline/fetch_cmip6_deltas.py` (novo), `projeto/backend/app/repositories/external/http_client.py`, `projeto/backend/tests/unit/pipeline/`, `projeto/backend/tests/unit/repositories/external/`, `projeto/backend/AGENTS.md`
- **Referências:** PRD §6.3 e §7.3, [ADR-0005](../adr/0005-fontes-diretas-da-nasa-sem-earth-engine.md), [roteiro](../roteiro-de-implementacao.md) (seções 3, 5 e R2.1), contrato "CMIP6" do `AGENTS.md` do backend

---

## 1. Descrição e motivação

O motor já sabe simular o clima de 2041–2060 (`ClimateRiskService.simulate_future_cmip6`, método do
delta do PRD 7.3), mas nenhum dado do CMIP6 chegava a ele: a fixture não tem `cmip6[]` e a resposta
sai com `futuro: null`. Esta tarefa cria o script que gera os deltas mensais por ponto, direto do
THREDDS da NCCS e sem Earth Engine (ADR-0005), no formato do contrato `Cmip6Delta`.

O R0.3 (grupo `pipeline` com `xarray`) está adiado. Por isso o script usa o recorte por ponto do
NetcdfSubset (NCSS) em **CSV**, que se lê com a biblioteca padrão, e o cliente `urllib` que já existe.
Nenhuma dependência nova.

## 2. Padrões adotados (decisão pendente do time: **a revisar**)

A seção 5 do roteiro deixa duas decisões para o time ("Delta de Tmin" e "Modelos do CMIP6"). Até lá,
o script usa:

| Item | Padrão adotado | Por quê |
| --- | --- | --- |
| Cenário | SSP2-4.5 (`ssp245`) | PRD 7.3 |
| Variáveis | `pr`, `tasmax` **e** `tasmin` | O Hargreaves-Samani (reserva da ETo) usa máxima e mínima. Sem `tasmin`, o `tmin_c` ficaria nulo e o motor projetaria só a máxima |
| Modelos | ACCESS-CM2, MPI-ESM1-2-HR e MRI-ESM2-0 | O PRD cita o ACCESS-CM2. Os três têm as três variáveis nos dois experimentos (tabela abaixo) |
| Períodos | base 1995–2014 (`historical`), futuro 2041–2060 (`ssp245`), meses de jan a jul | PRD 7.3 e janela do MVP |

Trocar um modelo é somar a entrada em `DEFAULT_MODELS` (variante, grade e versão conferidas no
catálogo). O `--modelos` recusa nome que não esteja lá, para não pedir arquivo que não existe.

### Conferência no catálogo do THREDDS (14/11/2026)

`https://ds.nccs.nasa.gov/thredds/catalog/AMES/NEX/GDDP-CMIP6/<modelo>/<experimento>/<variante>/<variável>/catalog.xml`

| Modelo | Variante | `historical` | `ssp245` | Variáveis | Grade e versão do arquivo |
| --- | --- | --- | --- | --- | --- |
| ACCESS-CM2 | `r1i1p1f1` | 1950–2014 | 2015–2100 | `pr`, `tasmax`, `tasmin` | `gn`, `_v2.0` em todos os anos |
| MPI-ESM1-2-HR | `r1i1p1f1` | 1950–2014 | 2015–2100 | `pr`, `tasmax`, `tasmin` | `gn`, `_v2.0` em todos os anos |
| MRI-ESM2-0 | `r1i1p1f1` | 1950–2014 | 2015–2100 | `pr`, `tasmax`, `tasmin` | `gn`, `_v2.0` em todos os anos |

Nenhum ano de 1995–2014 ou 2041–2060 falta, e nenhum tem duas versões. Não foi preciso trocar modelo.

## 3. Como o script funciona

```
pontos (12 células do POWER da caixa piloto, ou --pontos)
   │  para cada ponto → modelo → variável → período → ano
   ▼
CachedNcssFetcher ── já no cache? ── sim ──► lê o CSV do disco
   │ não
   ▼
NCSS: .../<modelo>/<exp>/r1i1p1f1/<var>/<var>_day_<modelo>_<exp>_r1i1p1f1_gn_<ano>_v2.0.nc
      ?var&latitude&longitude(0–360)&time_start=<ano>-01-01T12Z&time_end=<ano>-07-31T12Z&accept=csv
   │  confere coluna e unidade (página de erro nunca vai para o cache), grava, pausa 0,5 s
   ▼
média diária de cada mês (todos os anos do período juntos), em mm/dia e °C
   ▼
delta por modelo e mês: chuva_pct = (futuro ÷ base − 1) × 100; tmax_c e tmin_c = futuro − base
   ▼
Cmip6Delta + DataRun (validam) → data/output/cmip6_deltas_nex_gddp.json
```

- **Pontos:** os centros das células do NASA POWER (0,5° × 0,625°) que cobrem a caixa piloto
  (`PILOT_*`): latitudes −20, −19,5, −19 e −18,5; longitudes −48,75, −48,125 e −47,5. A `cobertura` de
  cada ponto vem de `power_cell_bounds` (`pipeline/export_climate_fixture.py`), como na fixture do clima.
  O NCSS devolve o pixel de 0,25° do NEX-GDDP mais próximo do ponto pedido.
- **Conversões:** `pr` × 86.400 → mm/dia; `tasmax` e `tasmin` − 273,15 → °C. Valor de preenchimento
  (`1,0E20`) ou `NaN` é descartado, nunca trocado por número.
- **Chuva base zero** num mês: o delta em % não existe, e o script para com erro em vez de inventar.
- **Retomada:** cada CSV fica em `data/cache/nex_gddp_cmip6_ncss/<modelo>/<exp>/<var>/` (fora do git),
  gravado com nome provisório e renomeado no fim. Se o script parar, rodar de novo só pede o que falta.
- **Período maior ou agregação:** o catálogo só tem os arquivos anuais (`DatasetScan`, sem NcML nem
  agregação), e o NCSS recorta um arquivo por vez. Por isso os pedidos são sequenciais, um por arquivo.
- **Saída:** `versao_dados` (`fonte: nex_gddp_cmip6`, `versao: AAAA.MM-nex-gddp-cmip6`, `fim` lido depois
  do último pedido, `parametros` com modelos, variantes, grade, versão dos arquivos, variáveis, períodos,
  meses e número de pontos) e `pontos[]` com `lat`, `lon`, `cobertura` e `cmip6[]`.

### Pedidos e tempo

- **Chamada real** (1 ponto, ACCESS-CM2, `pr`, 2000, jan–jul): HTTP 200 em 5,9 s, 213 linhas (ano
  bissexto). O CSV traz `time`, `station`, `latitude`, `longitude` e `pr[unit="kg m-2 s-1"]`, com a
  longitude do pixel em −180..180.
- O arquivo guarda cada dia como um bloco global (`_ChunkSizes` 1 × 600 × 1440). O custo do pedido
  cresce com o número de dias, não com o tamanho da área.
- `--dry-run` da caixa: **4.320 pedidos** (12 pontos × 3 modelos × 3 variáveis × 40 anos), **~7,8 h**
  com ~6 s por pedido e 0,5 s de pausa. Um ponto só: 360 pedidos, ~39 min.

## 4. Sub-tarefas (TDD)

### Sub-tarefa 4.1: Cliente HTTP que traz texto
- [x] `tests/unit/repositories/external/test_http_client.py`: corpo em texto com query string e timeout
  (`urlopen` falso); repetição de qualquer getter; último erro depois das tentativas.
- [x] Red: `ImportError: cannot import name 'default_http_get_text'`.
- [x] Green: `default_http_get_text` e `get_with_retries` (genérico); `get_json_with_retries` passa a
  delegar, sem mudar quem já usa.

### Sub-tarefa 4.2: Script dos deltas
- [x] `tests/unit/pipeline/test_fetch_cmip6_deltas.py` (37 testes, HTTP falso): longitude 0–360; URL e
  parâmetros do NCSS; trecho **real** do CSV; recusa de coluna, unidade, página de erro e CSV vazio;
  descarte do valor de preenchimento; conversões; médias por mês; delta (chuva em %, temperaturas em
  diferença); chuva base zero; pontos da caixa e da linha de comando; plano de pedidos; modelos padrão;
  cache, pausa, resposta inválida fora do cache e retomada depois de interromper; JSON final validado
  por `Cmip6Delta` e `DataRun`; CLI com `--saida`, `--pontos`, `--modelos`, `--cache`, `--pausa` e
  `--dry-run`.
- [x] Os CSVs falsos usam o modelo `MODELO-TESTE` e valores redondos de teste. O único dado real é o
  trecho do CSV do ACCESS-CM2 (3 linhas), marcado como tal.
- [x] Red: com um esqueleto de assinaturas, 35 falhas (34 `NotImplementedError` e
  `assert {} == {'ACCESS-CM2': ...}` nos modelos padrão).
- [x] Green: `pipeline/fetch_cmip6_deltas.py`.
- [x] Refactor com teste novo para dois defeitos achados na revisão:
  - delta zero saía como `-0.0`. Red: `assert '[0.0, -0.0, 0.0]' == '[0.0, 0.0, 0.0]'`;
  - o `fim` era lido antes dos pedidos (hora de início). Red: `TypeError` ao passar um relógio
    (`clock`) no lugar do `datetime`. Agora o relógio é lido depois do último pedido.

### Sub-tarefa 4.3: Documentação
- [x] Seção "Dados da API" do `projeto/backend/AGENTS.md`: como rodar, onde fica a saída e o cache e
  quanto tempo leva.

## 5. Critérios de aceitação (Definition of Done)

1. `--dry-run` mostra quantos pedidos faria, quantos já estão no cache e o tempo estimado, sem rede.
2. A saída segue o contrato CMIP6 do `AGENTS.md` e cada registro passa pelo `Cmip6Delta`.
3. Interromper e rodar de novo pede só o que falta. Resposta inválida não entra no cache.
4. Testes sem rede real. Nenhum dado sintético com nome de modelo ou fonte real.
5. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.

## 6. Fora do escopo / riscos

- **A extração completa não foi rodada** nesta tarefa (só uma chamada real). Ela fica para depois do
  merge, com o `--dry-run` antes.
- **Tempo:** ~8 h para a caixa, por causa do custo por dia de cada pedido. Para cortar ~12 vezes, dá para
  pedir a caixa inteira de uma vez por arquivo (360 pedidos) pelo OPeNDAP em ASCII
  (`/thredds/dodsC/...nc.ascii?pr[t0:t1][lat0:lat1][lon0:lon1]`), também legível sem biblioteca. Isso
  ainda não foi testado.
- **Pixel do ponto:** o delta da célula do POWER vem de um pixel de 0,25° (o mais próximo do centro), não
  da média dos ~5 pixels da célula. As latitudes −19,5, −19 etc. caem na borda entre dois pixels, e o
  NCSS escolhe um deles (na chamada real, −19,0 virou −18,875).
- **Meses secos:** em julho a chuva média é baixa (~0,7 mm/dia no ano 2000 do ACCESS-CM2), então o
  `chuva_pct` pode sair grande em valor relativo. O motor multiplica uma chuva observada também pequena.
- **Sem banco:** o arquivo não é gravado no PostGIS. A tabela `cmip6_delta` mensal vem no R1.6 e a leitura
  (incluindo `tmin_c`, que o `FixtureClimateRepository` ainda ignora) no R3.1.
- **Versão dos arquivos:** conferida para os três modelos padrão (`_v2.0`). A NCCS já trocou versões
  antes (`_v1.1` → `_v2.0`). Se trocar de novo, o pedido dá 404 e é preciso atualizar `DEFAULT_MODELS`.
- A chamada real foi feita com `curl` e com o `:` das datas sem codificar. O script manda `%3A`, que o
  servidor decodifica (padrão de query string).
