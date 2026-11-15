# Tarefa 0029: SMAP L4 nos dias de semeadura, por recorte no OPeNDAP da Earthdata

- **Identificador:** `0029`
- **Título:** Script do SMAP L4 (`SPL4SMGP` 008) por recorte no OPeNDAP na nuvem e carga no `smap_point`
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R2.3; alimenta o R3.3 (balde inicial pelo SMAP) e o A2.2 (SMAP recente e percentil)
- **Módulos Afetados:** `projeto/backend/pipeline/fetch_smap.py` (novo), `projeto/backend/pipeline/load_files_to_db.py`, `projeto/backend/app/repositories/smap_repository.py` (`FileSmapRepository`), testes em `tests/unit/pipeline/`, `tests/unit/repositories/` e `tests/integration/db/`, `projeto/backend/AGENTS.md`, `projeto/backend/docs/como-preparar-os-dados-locais.md`
- **Referências:** PRD §6 e §7.2, contrato "SMAP" do `AGENTS.md` do backend, script do CMIP6 por área (tarefa 0023)

---

## 1. Descrição e motivação

O PRD 7.2 diz que o balde da conta de água começa em 50% da CAD "ou no valor estimado pelo SMAP quando
houver". O roteiro previa o SMAP pelo AppEEARS; o orquestrador testou o **OPeNDAP na nuvem da NSIDC**
(Hyrax, DAP4), que recorta só a área pedida em ~2 s por pedido, sem baixar os arquivos globais (~140 MB
cada) nem esperar fila. Esta tarefa baixa a umidade da zona das raízes nos **dias de semeadura** de cada
faixa de colheita, de 2016 a 2025, para cada célula de 0,1° da caixa piloto, e copia o arquivo para a
tabela `smap_point`.

## 2. Fatos conferidos (14/11/2026)

| O quê | Como | Resultado |
| --- | --- | --- |
| Busca dos granulos | CMR público, `granules.json?short_name=SPL4SMGP&version=008&temporal=<dia>T00:00:00Z,<dia>T23:59:59Z` | 9 granulos: o das 22:30 da véspera (termina à 00:00) e os 8 do dia (01:30 a 22:30 UTC); 0,6 s |
| Link do OPeNDAP | link `.../service#` de cada granulo | igual ao título do granulo: de 2016 a 2023 sem sufixo, em 2024–2026 com `_u9loH5HD`. Montar pelo nome do arquivo daria 404 |
| Estrutura | `<granulo>.dmr` (com token, pelo orquestrador) | `y` = 1624, `x` = 3856 (EASE-Grid 2.0 de 9 km); `/cell_lat`, `/cell_lon` e `/Geophysical_Data/` |
| Recorte | `<granulo>.dap.csv?dap4.ce=/Geophysical_Data/sm_rootzone%5B1000:1:1001%5D%5B1300:1:1301%5D` | 200 em 1,7 s; `Dataset: ...` e uma linha por linha da grade (`var[i], v, v`) |
| Versões do granulo | nome do arquivo | `Vv8010` (2016–2023) e `Vv8012`/`Vv8013` (recentes), todas da coleção `C3480440870-NSIDC_CPRD` |

## 3. Como funciona

```
dias = SOWING_MONTH_DAY_BY_HARVEST (08/02, 18/02, 03/03) × 2016..2025   → 30 dias
células = centros das 225 células de 0,1° da caixa piloto (ou --area)
   ▼
para cada dia: CMR (público) → 8 granulos do dia em UTC, com o link do OPeNDAP de cada um
   ▼
1º granulo: DMR → confere 1624 × 3856, nomes, unidades e _FillValue
            cell_lat[0:1623][0] e cell_lon[0][0:3855] → linha e coluna mais perto de cada ponto
            retângulo (com 1 pixel de margem; caixa piloto ~22 × 18) → cell_lat/cell_lon do retângulo
            → pixel de 9 km mais perto do centro de cada célula
   ▼
recortes: 240 granulos × 3 variáveis (sm_rootzone_wetness, sm_rootzone, sm_surface) = 720, 4 em paralelo
   ▼
média do dia de cada variável no pixel (sem preenchimento, NaN ou valor fora de 0 a 1)
   ▼
arquivo do contrato SMAP: um ponto por célula, série com data, sm_rootzone_wetness, sm_rootzone_m3_m3,
sm_surface_m3_m3 (e o pixel_9km usado, para conferência)
```

- **Token:** `Authorization: Bearer <EARTHDATA_TOKEN>` como cabeçalho comum do `urllib` (segue os
  redirecionamentos, como o `curl -L --location-trusted` do teste). 401/403 ou a página de login da
  Earthdata param tudo na hora, sem retentar e sem gravar no cache. O token não aparece no `repr`, em
  mensagem de erro (o corpo da resposta é filtrado), log, cache nem arquivo. O CMR não recebe o token.
- **Cache e retomada:** `cmr/<dia>.json` (só dia com os 8 granulos), `estrutura.dmr`, `coordenadas/`
  e `recortes/<dia>/<granulo>/<var>_y.._x...csv`. Resposta conferida antes de entrar no cache, gravada
  com nome provisório (`.part`) e renomeada no fim. Falha depois das retentativas não para os outros
  recortes: o que deu certo fica no cache e o erro sobe no fim (rodar de novo continua).
- **Dia incompleto:** se o CMR listar menos de 8 granulos, a média usa os que houver e o dia vai para
  `versao_dados.parametros.dias_incompletos` (com a contagem). Dia sem nenhum granulo fica sem linha.
- **Carga no banco:** `load_files_to_db --smap <arquivo>` lê pelo `FileSmapRepository` (registro fora do
  contrato recusa o arquivo inteiro, antes de gravar), faz upsert no `smap_point` (chave `point_key` +
  dia) e registra uma linha em `data_run` com a versão do arquivo.

## 4. Custo (caixa piloto, 2016 a 2025)

| Pedidos | Quantos | Tempo |
| --- | --- | --- |
| Busca no CMR (pública) | 30 | ~20 s |
| DMR + coordenadas | 5 | ~10 s |
| Recortes no OPeNDAP | 720 (~4 kB cada) | ~6 min com 4 em paralelo |

Cache total de poucos MB; o arquivo final tem 225 pontos × 30 dias (~1 MB).

## 5. Decisões

- **OPeNDAP em vez do AppEEARS:** sem fila, sem biblioteca nova (CSV e XML da biblioteca padrão) e com o
  `EARTHDATA_TOKEN` que o time já tem (o AppEEARS recusa esse token).
- **Uma variável por pedido:** é o formato de CSV conferido no pedido real. Juntar as três num pedido
  (`;` no `dap4.ce`) cortaria os pedidos por 3, mas o formato da resposta com várias variáveis não foi
  conferido.
- **2016 a 2025:** os 3 dias de 2015 são anteriores a 31/03/2015 (início do SMAP).
- **Dia em UTC:** os 8 granulos de 00:00 a 24:00 UTC (21:00 da véspera às 21:00 em Brasília).
- **Unidades aceitas:** `m3 m-3` (e grafias equivalentes) para `sm_rootzone` e `sm_surface`,
  `dimensionless` (ou `1`, `-`, vazio) para a `sm_rootzone_wetness`. Outra unidade para o script com a
  unidade encontrada na mensagem: confira no DMR e ajuste `EXPECTED_UNITS` se for só grafia.

## 6. Critérios de aceite

- [x] Testes sem rede (CMR e OPeNDAP falsos), com os trechos reais do CMR e do recorte marcados.
- [x] `--dry-run` mostra dias, células, granulos, pedidos e tempo sem rede e sem token.
- [x] Saída no contrato SMAP, lida de volta pelo `FileSmapRepository`.
- [x] Carga `--smap` idempotente, com `data_run` (teste com banco).
- [ ] Execução real pelo orquestrador (com o token): `--dry-run`, download e carga.
