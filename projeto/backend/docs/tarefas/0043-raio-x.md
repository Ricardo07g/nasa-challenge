# Tarefa 0043: O que o satélite viu vira o raio-X da sua terra (`/satelite`)

- **Identificador:** `0043`
- **Título:** Painel "Raio-X da sua terra" com 8 blocos, histórico em faixa de calor do NDVI, alertas da área (geada, chuva forte e fogo pelo MODIS MCD64A1) e cartões menores (20 anos de chuva, clima 2041–2060)
- **Status:** Concluída na branch `feat/remodelagem-s4-raio-x` (falta o merge em `feat/remodelagem`, a extração completa do MCD64A1 e a revisão)
- **Prioridade:** Alta (seção 4 da remodelagem, S4)
- **PRD:** RF-29 (novo)
- **Módulos Afetados:**
  - backend: `app/config_data/regras.yaml` (grupos `raio_x` e `alertas_area`), `app/models/regras.py`, `app/repositories/rules_repository.py`, `app/models/raio_x.py`, `app/models/area_queimada.py`, `app/models/climate.py` (`CellRainTotal`), `app/repositories/climate_repository.py` (`rain_totals_in_window`), `app/repositories/soil_repository.py` (`get_nearest_soil`), `app/repositories/area_queimada_repository.py`, `app/services/raio_x_service.py`, `raio_x_climate_service.py`, `region_rank_service.py`, `future_climate_service.py`, `ndvi_strip_service.py`, `burned_area_service.py`, `app/schemas/raio_x.py`, `app/controllers/raio_x_controller.py`, `app/dependencies.py`, `app/main.py`, `app/config.py` (`AREA_QUEIMADA_PATH`), `pipeline/fetch_area_queimada.py`, `pipeline/fetch_soja_recente.py` (a grade aceita o tamanho do pixel), `docker-compose.yml`, `.env.example`;
  - front: `models/raioX.ts`, `repositories/raioXRepository.ts`, `repositories/mocks/raioXFixture.ts`, `repositories/mocks/mockRepositories.ts`, `repositories/index.ts`, `services/raioXService.ts`, `controllers/useSatelliteController.ts`, `views/SatelliteView.tsx`, `design-system/components/Instrument.tsx` (painel, bloco, selo, barra do solo, medidor, número que conta, faixa de calor), `design-system/components/MiniMap.tsx`, `design-system/tokens.css`, `design-system/icons` (geada, chuva forte, fogo), `pages.tsx`, `i18n/messages.{pt,en}.ts` (bloco novo `xray`), dois artigos do Guia.
- **Referências:** pedido de remodelagem de 15/11/2026 (seção 4), `projeto/backend/docs/remodelagem.md` (D55 a D66), tarefas 0037 (soja recente), 0039 (safras confirmadas), 0042 (fim das chuvas) e 0048 (Guia)

---

## 1. O que foi feito

- **Endpoint novo `GET /api/raio-x?lat&lon[&colheita][&solo][&confirmadas]`** (e não campos do `/talhao`, decisão D55): o raio-X pede a melhor opção do motor (bloco da água e cartão dos 20 anos), ~0,5 s na lavoura de demonstração; o `/talhao` continua leve para a tela 2.
- **Painel "Raio-X da sua terra"**, o único elemento escuro da tela, com tokens novos em `tokens.css` (contraste conferido: texto 11,3:1, apagado 7,3:1, número 8,0:1, selo 7,9:1). Cabeçalho com o lugar (cidade de referência mais perto, sem rede), as coordenadas, a miniatura do mapa com o pin e a data da leitura mais recente (SMAP ou NDVI). **Altitude: não aparece** (o `grid_cell` não tem altitude, e o pedido manda não buscar fora). Blocos entram em sequência (CSS) e os números contam até o valor; com "reduzir movimento", nada se mexe. O texto no DOM é sempre o valor final ("Ouvir" e leitor de tela).
- **Os 8 blocos**, cada um com número, unidade, frase e selo (fonte e resolução):
  1. Solo (SoilGrids · ISRIC · 250 m): % de argila, barra dividida argila / silte / areia com a % escrita, textura, "Não é? Trocar" e, em célula sem solo, o ponto gravado mais perto (até 15 km) com a distância.
  2. Água que a terra guarda (SoilGrids + NASA POWER): CAD em mm e "Aguenta cerca de N dias sem chuva na floração de [cultura]" = CAD ÷ (ETo média do motor na floração ± 15 dias × Kc), arredondado para baixo.
  3. Umidade da terra agora (SMAP · NASA · 9 km): o percentil do `smap_recente.json` num medidor.
  4. Verde da lavoura (MODIS · NASA · 250 m): a última leitura do NDVI e o pico da soja na safra mais recente; sem série no ponto, o pico do mapa da soja recente (tarefa 0037).
  5. Chuva de um ano típico (GPM IMERG · NASA · 10 km): total médio de janeiro a julho e o fim das chuvas pelo `RainEndService` da tela 3.
  6. Maior veranico (GPM IMERG): a maior sequência de dias abaixo de 1 mm (o dia seco dos avisos) de março a maio, com o ano e o dia em que começou.
  7. Calor (NASA POWER · ~50 km): em quantos anos houve dia de 35 °C ou mais (o calor do motor) de março a maio, e quais.
  8. Sua área e a região (GPM IMERG): a chuva média de março a maio da célula contra as outras células da caixa (mesma fonte de chuva); "mais seca que X%" ou, se a maioria chove menos, "mais chuvosa que Y%".
  Rodapé: "Cada dado vale para a área em volta do ponto, no tamanho indicado em cada selo, e não para o talhão exato." Bloco sem dado não aparece.
- **Histórico do talhão em faixa de calor do NDVI:** um ano por linha (2017–2026, D5), uma coluna por leitura de 16 dias de janeiro a julho (14 colunas; Terra e Aqua juntos, fica o maior NDVI bom), 5 cores que sempre escurecem (cortes 0,30 / 0,45 / 0,60 / 0,75; os do meio são os do histórico do talhão) com legenda numérica, quadrinho listrado para "sem leitura" e o que aconteceu no ano escrito no fim da linha ("parada", "plantou", "sem soja", "sem certeza", com "(você)" na safra confirmada). No topo, "soja", "colheita" (a coluna do dia em que a soja costuma secar, RF-16) e "entressafra". Título "Na entressafra, sua área ficou parada em X de N anos." com a regra que já existia (`sem_soja` e safras confirmadas). O bloco "Confirme as últimas safras" ficou igual, no fim do cartão.
- **Correção do ✓:** o aviso "Não parece uma lavoura de soja" virou um aviso laranja com o triângulo, sem selo de "pronto" (antes era um `DataSourceCard` com o ✓).
- **Alertas da sua área** (cada um só vem com risco; limites no `regras.yaml`): geada (anos com mínima de 3 °C ou menos de maio a julho, NASA POWER), chuva forte (média de dias por ano com 50 mm ou mais em fevereiro e março, GPM IMERG, mínimo 0,1 dia por ano, com "Terra descoberta perde solo nesses dias") e fogo (anos com área queimada do MCD64A1 a até 5 km, 2016–2025). **Sem granizo.**
- **Cartões menores:** "20 anos de chuva" (anos em que a melhor opção do motor deu certo) e "Clima 2041–2060" (chuva de março a maio em %, pesada pela chuva de cada mês; máxima em °C; média dos 3 modelos do `cmip6_delta`; "2 de 3 modelos indicam mais chuva; 3 de 3, mais calor."), com "ver na sugestão". O botão "Ver o que plantar" ficou.
- **Guia:** "Como ler o raio-X da sua terra" e "Fogo na palha" (pt e en). Os "Saiba mais" da tela ligam raio-X, veranico, calor, geada e fogo; erosão fica sem link (o artigo "Como evitar erosão" ainda não existe).
- **Sem o raio-X** (API antiga ou falha), a tela volta aos cartões de antes (chuva, terra e clima) e à faixa de quadrinhos.

## 2. Checagem do MCD64A1 na ORNL DAAC (15/11/2026)

- `GET https://modis.ornl.gov/rst/api/v1/products` (41 s): lista o **MCD64A1** ("MODIS/Terra+Aqua Burned Area Monthly L3 Global 500 m SIN Grid", mensal, 500 m).
- `GET /MCD64A1/bands` (59 s, um 502 antes): `Burn_Date` (dia do ano da queimada, 0 a 366, preenchimento −1), `Burn_Date_Uncertainty`, `First_Day`, `Last_Day`, `QA`. Datas: dia 1 de cada mês, desde 2000-11.
- A ORNL conta o km como pixels de 500 m: ±10 km = 41 × 41 pixels (34 s, 2 datas). ±30 km com 6 e 10 datas e ±60 km com 10 datas voltaram **502** do proxy (~60 s) na mesma hora (a ORNL estava lenta: 503 e 502 também em pedidos pequenos).
- **Script:** `pipeline/fetch_area_queimada.py` (cliente, cache e grade sinusoidal dos scripts da região e da soja recente). Padrão: caixa piloto, 2016–2025, ladrilhos de ±30 km (121 × 121 pixels), 6 meses por pedido: **12 ladrilhos × 20 = 240 pedidos, ~2,3 h** a ~35 s por pedido (`--dry-run`). Se o 502 continuar, diminua `--km` ou `--datas-por-pedido`.
- **Conferência feita (2 pedidos):** `--area="-18.96,-18.95,-48.20,-48.19" --anos 2016 --km 5 --datas-por-pedido 6`: 89 s (com um 503 e 30 s de espera) + 42 s = **131 s**; recortes de 21 × 21 pixels de 463,3 m, nenhum pixel queimado em 2016 perto da fazenda; o arquivo do contrato foi gravado e lido pela API (fora do repositório). **A extração completa não foi rodada** (fica com o orquestrador). Sem o arquivo, o alerta de fogo não aparece.

```bash
uv run python -m pipeline.fetch_area_queimada --dry-run   # 240 pedidos, ~2,3 h, sem rede
uv run python -m pipeline.fetch_area_queimada             # caixa piloto, 2016 a 2025 (grava data_run com DATABASE_URL)
```

## 3. Números na lavoura de demonstração (−18,9543 / −48,1993; banco local de 15/11/2026, colheita tarde, a do satélite)

| Bloco / alerta | Número |
| --- | --- |
| Solo | argiloso, 41,9% de argila, 40,2% de areia (silte 18%), CAD 60 mm, ponto da própria célula |
| Água que a terra guarda | 60 mm; milheto (melhor opção da colheita tarde), floração ~22/abr, ETo 3,6 mm × Kc 1,0 = 3,6 mm/dia → **16 dias** (cedo e meio: milho com braquiária, 4,4 e 4,3 mm/dia → 13 dias) |
| Umidade agora | percentil **59** (SMAP de 10/11/2026) |
| Verde da lavoura | última leitura **0,42** em 28/07/2026; pico da soja 2025/26 **0,90** em 17/01/2026 |
| Chuva de um ano típico | **862 mm** de janeiro a julho (20 anos, GPM IMERG); fim das chuvas: mediana 21/abr, mais cedo 16/mar/2021, mais tarde 22/jun/2012 |
| Maior veranico | **43 dias**, a partir de 19/abr/2024 |
| Calor | **1 de 20 anos** (2024: máxima de 36,2 °C entre março e maio) |
| Sua área e a região | 330,7 mm de março a maio (mediana da caixa 325,6 mm): **mais chuvosa que 62%** das 225 células (mais seca que 38%) |
| Histórico | parada em **0 de 10 anos** (plantou nos 10) |
| Geada | **não aparece** (a menor mínima de maio a julho foi 4,1 °C, em 2022) |
| Chuva forte | **0,25 dia por ano** (5 dias em 20 anos com 50 mm ou mais em fevereiro e março) |
| Fogo | **não aparece** (o arquivo do MCD64A1 ainda não foi baixado) |
| 20 anos de chuva | milheto, **20 de 20** (meio: milho com braquiária, 16 de 20) |
| Clima 2041–2060 | chuva de março a maio **+2,2%**, máxima **+1,3 °C**; 2 de 3 modelos indicam mais chuva, 3 de 3 mais calor |

Resposta do `/api/raio-x` em ~0,5 s (o motor roda uma vez).

## 4. Testes (TDD; os "red" anotados)

- **Backend** (1.503 com banco): regras (`raio_x` e `alertas_area` carregam e recusam número sem fonte: red = `AttributeError`/`KeyError raio_x`); `test_raio_x_climate_service.py` (19), `test_region_rank_service.py` (7), `test_future_climate_service.py` (3), `test_ndvi_strip_service.py` (9), `test_burned_area_service.py` (5), `test_area_queimada_repository.py` (7), `test_raio_x_service.py` (12) — red = `ModuleNotFoundError` de cada service; `tests/integration/db/test_raio_x_repositories.py` (5, red = `AttributeError` de `rain_totals_in_window` e `get_nearest_soil`); `test_raio_x_controller.py` (7, red = 404 da rota que não existia); `test_fetch_area_queimada.py` (5, red = módulo ausente).
- **Front** (887): `raioXRepository.test.ts`, `raioXService.test.ts` (12), `Instrument.test.tsx` (7), `MiniMap.test.tsx`, controller (5 novos, red = `xray`/`heatmap` indefinidos), `SatelliteView.test.tsx` (13 novos; red conferido rodando os testes contra a view antiga: 19 falhas). O teste do conteúdo do Guia confere os dois artigos novos.

## 5. O que não foi feito e por quê

- **Altitude:** o `grid_cell` não tem a coluna (o POWER devolve a altitude na busca, mas ela não é gravada). Pelo pedido, não foi buscada fora.
- **Extração completa do MCD64A1:** só os 2 pedidos de conferência; o orquestrador roda o script.
- **Link "Saiba mais" do alerta de chuva forte:** o artigo "Como evitar erosão" não existe (D9).
- **Telas em 390 px:** o Chrome sem interface desta máquina não abre janela mais estreita que ~500 px (a tela do Guia, que já estava pronta, sai cortada do mesmo jeito); o layout foi conferido em 1280 px e ~500 px, e as grades usam `auto-fit` com `min(100%, …)`.
