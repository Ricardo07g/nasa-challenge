# Tarefa 0035: detalhe de cada ano (`opcoes[].anos_detalhe[]`) e ONI da NOAA (P1)

- **Identificador:** `0035`
- **Título:** Tocar num ano e ver o que aconteceu: `anos_detalhe` em `/recomendacao` e a fase do ENSO pelo ONI
- **Status:** Concluída
- **Prioridade:** Alta (P1 do plano de evolução: entra no vídeo de 30 s)
- **Roteiro:** P1 (Fase 7) e a decisão "Nomes do detalhe por ano (P1)" da seção 5 (padrão adotado, **a revisar**)
- **Módulos Afetados:** `pipeline/fetch_oni.py`, `app/models/enso.py`, `app/repositories/enso_repository.py`,
  `app/services/year_detail_service.py`, `app/services/crop_alert_service.py`, `app/services/climate_risk_service.py`,
  `app/services/recommendation_service.py`, `app/schemas/recomendacao.py`, `app/config_data/regras.yaml`,
  `app/config.py`, `app/dependencies.py`, `projeto/docker-compose.yml`
- **Referências:** plano de evolução (P1, §4.1),
  PRD (7.2: janela crítica e aperto),
  contrato do front `AnoDetalhe` em `projeto/frontend/src/models/recomendacao.ts`, tarefa 0019 (dia seco do `CropAlertService`),
  [ONI da NOAA CPC](https://origin.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php)

---

## 1. Descrição e Motivação

Na tela da resposta, a faixa de anos da chuva já é tocável no front, mas o painel do ano aparecia como
"Ainda não conectado": a API não mandava `opcoes[].anos_detalhe`. O produtor lembra dos anos ruins
("2021 foi aquele ano"); quando a frase do ano bate com a lembrança dele, a confiança no resto sobe.

## 2. Decisão do contrato (a revisar)

Adotado o **contrato do front**, que a tela já usa: `{ano, bom, fase_critica, dias_sem_chuva, enso, texto}`.
O plano de evolução §4.1 propunha `floracao`, `dias_secos`, `isna` e `dias_calor`; ISNA e dias de calor
não vão como campos, mas a frase cita o calor quando ele causou o aperto. O dia seco é o de 1 mm dos
avisos (tarefa 0019), não os 5 mm do §4.1: a regra fica num lugar só (`avisos.dia_seco_abaixo_mm`).

## 3. Regra

Para cada opção e cada ano que o motor simulou (mesma ordem da faixa, `chuva.faixa` = `anos_detalhe[].bom`):

- `bom` = ano sem aperto (`ResultadoAno.aperto`, PRD 7.2), o mesmo de `chuva.anos_bons`.
- `fase_critica` = semeadura do ano + `dias_florescer` (floração estimada); na cobertura, a própria
  semeadura (começo dos 30 dias do pegamento). Vem do `critical_stage` do `CropAlertService`.
- `dias_sem_chuva` = maior sequência de dias com chuva abaixo de 1 mm **dentro** da fase crítica
  (`CropAlertService.longest_dry_spell`, que usa o mesmo `_is_dry` da linha do tempo). A seca que
  começou antes conta a partir do primeiro dia da fase; dia sem dado quebra a sequência.
- `enso` = fase do arquivo do ONI (`ONI_PATH`). Sem arquivo ou ano fora dele: `null`. Só informa.
- `texto` = modelos do grupo `frases_ano` do `regras.yaml` (pt/en): fase crítica com a seca
  (nenhum / 1 dia / N dias); `deu_certo`, ou `faltou_agua` (`ResultadoAno.falta_agua`, ISNA abaixo do
  limiar) e/ou `calor` (`ResultadoAno.calor`, 3 dias de 35 °C); a marca do ENSO.
- O `ClimateRiskService` passou a guardar os dois critérios do aperto (`falta_agua`, `calor`), para a
  frase explicar o ano sem repetir a regra.

### ONI (pipeline/fetch_oni.py)

- Fonte: `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` (um pedido de ~23 KB, sem credencial).
  Formato conferido numa chamada real em 14/11/2026: cabeçalho `SEAS  YR   TOTAL   ANOM` e uma linha
  por estação de 3 meses, ex. `  DJF 2016  29.05   2.50` (anomalia com 2 casas). A NOAA rotula cada
  estação pelo mês do meio: o DJF de 2016 é dez/2015 a fev/2016; o NDJ de 2015 é nov/2015 a jan/2016.
- Regra do ano da safrinha (grupo `enso` do `regras.yaml`, hipótese do time, **a revisar**): média das
  estações **DJF, JFM e FMA** do ano (dezembro do ano anterior a abril: o verão e o começo do outono, da
  colheita da soja até a fase crítica), arredondada em 2 casas; a fase sai da média arredondada (o
  arquivo nunca diz 0,50 e "neutro"). **+0,5 ou mais = `el_nino`; −0,5 ou menos = `la_nina`** (limiares
  da NOAA CPC, sem as 5 estações seguidas do "episódio"). Ano com estação faltando fica de fora.
- Resultado com a tabela real (2005–2024): El Niño em 2005, 2010, 2015, 2016, 2019, 2020 e 2024;
  La Niña em 2006, 2008, 2009, 2011, 2012, 2018, 2021 e 2022; neutros 2007, 2013, 2014, 2017 e 2023.
- Saída: `data/baixados/noaa_oni/oni.json` (fora do git), no contrato "ONI" do `AGENTS.md`.
  Comando: `uv run python -m pipeline.fetch_oni` (`--dry-run` mostra o pedido sem rede).

## 4. Valores na fazenda de exemplo

Fixture do NASA POWER, colheita `meio` (semeadura 18/fev), milho sozinho (a `melhor`), com o arquivo
do ONI gerado da tabela real:

| Ano | `bom` | `fase_critica` | `dias_sem_chuva` | `enso` |
| --- | --- | --- | ---: | --- |
| 2016 | não | 2016-04-18 | 29 | `el_nino` |
| 2019 | sim | 2019-04-19 | 5 | `el_nino` |
| 2021 | sim | 2021-04-19 | 6 | `la_nina` |
| 2022 | não | 2022-04-19 | 20 | `la_nina` |
| 2024 | não | 2024-04-18 | 14 | `el_nino` |

2024 bate com o replay da tarefa 0019 (parou de chover em 19/abr; a fase vai de 3/abr a 2/mai). Frase:
"Em 2024, plantando em 18 de fevereiro, a planta chegou na fase que mais precisa de água por volta de
18 de abril e ficou 14 dias sem chuva. Faltou água nessa fase. Ano de El Niño." Há anos com seca longa
que deram certo (2013: 19 dias) e anos com seca curta que apertaram (2007: 6 dias, com o ISNA da fase
abaixo do limiar): a frase diz o resultado do motor (balde e ISNA), não deduz pela seca.

## 5. Sub-tarefas (TDD)

- [x] Regras (`test_rules_repository.py`): grupos `enso` e `frases_ano`; número sem fonte é recusado.
  Falharam com `AttributeError: 'Regras' object has no attribute 'frases_ano'` e `KeyError: 'enso'`.
- [x] Model (`tests/unit/models/test_oni_year.py`): fase só `el_nino`, `la_nina` ou `null`; ONI finito
  entre −5 e +5; ano de 1950 em diante. Falhou com `ModuleNotFoundError: No module named 'app.models.enso'`.
- [x] Repository (`test_enso_repository.py`) e `Settings.oni_path` (`test_config.py`): lê o arquivo uma
  vez; sem caminho ou sem arquivo, lista vazia; fora do contrato, `ValueError`. Falharam com
  `ModuleNotFoundError` e `AttributeError: 'Settings' object has no attribute 'oni_path'`.
- [x] Pipeline (`tests/unit/pipeline/test_fetch_oni.py`, trecho real da tabela, HTTP falso): leitura,
  página de erro, linha fora do formato, El Niño / La Niña / neutro, limiar exato, média arredondada,
  estação faltando, estações do `regras.yaml`, arquivo do contrato lido pelo repository, linha de
  comando e `--dry-run` sem rede. Falhou com `ModuleNotFoundError: No module named 'pipeline.fetch_oni'`.
- [x] `CropAlertService.longest_dry_spell` (`test_crop_alert_service.py`): só dias da fase, várias
  secas, 1 mm quebra a seca, limiar das regras, janela da cobertura. Falhou com
  `AttributeError: 'CropAlertService' object has no attribute 'longest_dry_spell'`.
- [x] `ClimateRiskService` (`test_climate_risk_service.py`): `falta_agua` e `calor` por ano, com o
  limiar da cobertura. Falhou com `AttributeError: 'ResultadoAno' object has no attribute 'falta_agua'`.
- [x] `YearDetailService` (`test_year_detail_service.py`): ano com e sem seca na fase, com e sem ONI,
  singular, calor, os dois motivos, ordem do motor, cobertura, inglês, regras injetadas, "1º de abril".
  Falhou com `ImportError: cannot import name 'AnoDetalhe'`.
- [x] `RecommendationService` (`test_recommendation_service.py`): `anos_detalhe` alinhado à faixa (com
  ano descartado), ENSO com o service injetado, inglês. Falhou com
  `TypeError: ... unexpected keyword argument 'year_detail_service'`.
- [x] Schema (`test_recomendacao_schema.py`): JSON no formato do front e campo opcional no OpenAPI.
  Falhou com `ImportError: cannot import name 'AnoDetalheSchema'`.
- [x] Rotas (`test_recomendacao_controller.py`, pt, en e sem ONI) e ligação (`test_dependencies.py`):
  falharam com `ImportError: cannot import name 'get_enso_repository'`; o teste da ligação foi visto
  falhando com o caminho do ONI desligado (`assert [] == [(2016, 'el_nino')]`).
- [x] Fazenda de exemplo com a fixture (`test_exemplo_dados_reais.py`): 2024 igual ao replay.

## 6. Front

Nenhuma mudança: `RainYears` usa `anos_detalhe` quando vem (quadrinhos tocáveis, ponto de El Niño /
La Niña e a frase no painel) e o "Ainda não conectado" some. Os anos são os da série (2005–2024), não
os do mock do front (2006–2025).

## 7. Riscos e pendências

- A floração é estimada pelo ciclo médio da cultura (`culturas.yaml`): a frase diz "por volta de".
- Regra do ano do ENSO e nomes do contrato: padrão adotado, **a revisar** (roteiro §5).
- Arquivo do ONI fora do contrato derruba `/recomendacao` com erro 500 (o mesmo comportamento do
  arquivo do CMIP6); o script só grava arquivo validado pelo model.
- A resposta cresce ~27 KB sem compressão (5 opções × 20 anos).
- Plano de evolução: P1 ainda precisa virar requisito (RF/T) no PRD.

## 8. Critérios de Aceitação

1. **TDD:** testes escritos antes e vistos falhando (erros acima).
2. Campo opcional no formato do front; números novos no `regras.yaml` com `valor` e `fonte`; sem
   dependência nova; nenhuma chamada de rede nos testes.
3. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.
