# Tarefa 0015: service `sinal_outono` e o campo `sinal` em `/recomendacao` (A2.4)

- **Identificador:** `0015`
- **Título:** Sinal para o outono (seco, normal ou incerto) com o motivo, as fontes e a regra do dia de plantar
- **Status:** Concluída (sem dado ainda: o campo sai `null` até as tarefas A2.1 a A2.3; regra **a calibrar** na A2.5)
- **Prioridade:** Alta (tela 7: Plano A / Plano B)
- **Roteiro:** A2.4 (Fase 6, ajuste A2; testes sem dependência, dados de A2.1 a A2.3). Empilhada sobre o R4.3 (tarefa 0016), porque o Plano B é o plano do ano seco
- **Módulos Afetados:** `app/models/sinal_outono.py`, `app/repositories/sinal_outono_repository.py`, `app/services/sinal_outono_service.py`, `app/services/recommendation_service.py`, `app/models/recomendacao.py`, `app/schemas/recomendacao.py`, `app/dependencies.py`, `app/config_data/regras.yaml`, `app/models/regras.py`, `app/repositories/rules_repository.py`
- **Referências:** PRD (7.7, 7.10, RF-20, T-18), plano de evolução (ajuste A2), contrato do front `SinalOutono` em `projeto/frontend/src/models/recomendacao.ts`

---

## 1. Descrição e Motivação

A tela 7 pedia ao produtor que escolhesse "ano normal" ou "ano seco" sem pista nenhuma. O RF-20 troca isso
por um **sinal para o outono** com o motivo em uma frase, os botões "Plano A" e "Plano B, se secar" já
marcados pelo sinal e a **regra do dia de plantar**. O front já tem a tela e o contrato (`sinal?:
SinalOutono`); faltava o backend.

Esta tarefa faz a regra com TDD e repositories falsos, **antes** dos dados (A2.1 a A2.3). Na API, os três
repositories ainda não têm dado e o `sinal` sai `null`: nada de previsão inventada.

---

## 2. Regra (PRD 7.10; limiares no `regras.yaml`, grupo `sinal_outono`, com fonte)

| Nível | Quando |
| --- | --- |
| `seco` | chance de chuva abaixo do normal em mar–mai **≥ 0,50** (GEOS-S2S) **ou** terra seca agora: SMAP `sm_rootzone_pctl` **< 20** **e** chuva dos últimos 30 dias **< 60%** da média |
| `normal` | chance **< 0,33** **e** terra sem falta de água (SMAP ≥ 20 **e** chuva ≥ 60% da média) |
| `incerto` | qualquer outro caso |

- **Sem dado:** sem previsão e sem dado da terra, o service devolve `None` e o campo sai `null`. A terra
  só conta com o SMAP **e** a chuva recente juntos (um sem o outro não diz se está seca).
- **`motivo`** (pt/en, uma frase): a chance da previsão (ou "ainda sem a previsão") e o dado da terra
  (percentil do SMAP e % da chuva média; "a terra está seca agora" quando está; ou "ainda sem o dado da
  terra"). Percentuais arredondados para baixo, para 49,9% não aparecer como 50%.
- **`fonte`**: só as fontes usadas, nos nomes que o front mostra: `GEOS-S2S`, `SMAP`, `GPM IMERG`.
- **`data`**: data da previsão; sem ela, o dia mais recente do dado da terra.
- **`regra_dia_plantar`**: Plano A = melhor plano do ano normal; Plano B = melhor plano do ano seco (PRD
  7.7 e 7.10). `data_limite` = data limite da cultura do 1º ano do Plano A (se ela não tiver, a do Plano
  B; se nenhuma tiver, a semeadura). Texto:
  - 1º ano diferente: "No dia de plantar (até 28/fev), se a terra estiver seca, use o plano B: sorgo no
    lugar de milho sozinho.";
  - mesmo 1º ano: "... siga o plano B; o 1º ano continua com {cultura}.";
  - planos iguais: "Os planos A e B são iguais: plante {cultura} até {data}, com a terra seca ou não."

Exemplo com dados **falsos** na fazenda de exemplo (colheita `meio`; Plano A milho, crotalária, milheto;
Plano B crotalária, crotalária, milheto), chance 25%, SMAP no percentil 15 e 45% da chuva média:

```json
{"nivel": "seco",
 "motivo": "A previsão da NASA (GEOS-S2S) dá 25% de chance de chuva abaixo do normal de março a maio; a terra está seca agora: umidade na raiz no percentil 15 (SMAP) e 45% da chuva média dos últimos 30 dias (GPM IMERG).",
 "fonte": ["GEOS-S2S", "SMAP", "GPM IMERG"], "data": "2027-02-01",
 "regra_dia_plantar": {"data_limite": "2027-02-28", "texto": "No dia de plantar (até 28/fev), se a terra estiver seca, use o plano B: crotalária no lugar de milho sozinho."}}
```

---

## 3. Camadas

```
SeasonalForecastRepository ─┐   (A2.1: GEOS-S2S)
RecentSoilMoistureRepository ┼─> SinalOutonoService.evaluate(lat, lon, plano_a, plano_b, opcoes, semeadura, lang)
RecentRainRepository ────────┘   (A2.2: SMAP + percentil; A2.3: IMERG Late)        │
                                                                                   ▼
                       RecommendationService.recommend ──> Recomendacao.sinal ──> SinalSchema | null
```

- **Models** (`app/models/sinal_outono.py`): `SeasonalForecast` (chance 0 a 1), `RecentSoilMoisture`
  (percentil 0 a 100), `RecentRain` (chuva, média > 0, dias), `SinalOutono` e `RegraDiaPlantar`. Recusam
  dado fora do contrato com `ValueError` (ex.: chance 60 em vez de 0,6).
- **Repositories** (`app/repositories/sinal_outono_repository.py`): um `Protocol` por fonte, para cada
  tarefa A2.1 a A2.3 ligar a sua sem mexer nas outras, e o `NoAutumnSignalDataRepository` (sempre `None`).
- **Service:** `SinalOutonoService`; o `RecommendationService` recebe o service opcional
  (`sinal_service`) e chama depois de montar os planos.
- **Ligação** (`dependencies.py`): `get_seasonal_forecast_repository`,
  `get_recent_soil_moisture_repository`, `get_recent_rain_repository` (hoje os três dão o
  `NoAutumnSignalDataRepository`) e `get_sinal_outono_service`. Para ligar uma fonte, troque só a função
  dela.
- **Schema:** `sinal: SinalSchema | None` em `RecomendacaoResponse` (vale também para `/exemplo`).

---

## 4. Sub-tarefas (TDD)

- [x] Models (`tests/unit/models/test_sinal_outono.py`): falharam com
  `ModuleNotFoundError: No module named 'app.models.sinal_outono'`.
- [x] Limiares (`test_rules_repository.py`): falhou com
  `AttributeError: 'Regras' object has no attribute 'sinal_outono'`.
- [x] Repository sem dado (`tests/unit/repositories/test_sinal_outono_repository.py`): falhou com
  `ModuleNotFoundError: No module named 'app.repositories.sinal_outono_repository'`.
- [x] Service (`tests/unit/services/test_sinal_outono_service.py`, 22 testes): seco pela previsão, seco
  pela terra, normal, incerto, limites do PRD (0,50 / 0,4999 / 0,33 / 0,3299; percentil 20 e 60% no limite
  × logo abaixo), um só indicador seco, sem dado, SMAP sem chuva, só a terra, só a previsão, regra do dia
  de plantar (3 textos e a data do Plano B quando o A começa com pousio), inglês e limiares injetados.
  Falharam com `ModuleNotFoundError`; com um esboço que devolvia sempre `None`, 20 falharam com
  `assert None is not None` (só os dois casos "sem dado" passavam).
- [x] `RecommendationService` (`test_recommendation_service.py`): sem o service, `sinal` é `None`; com o
  service e só a previsão de 60%, `seco` com a data limite da cultura do 1º ano do Plano A. Falhou primeiro
  com `TypeError: ... unexpected keyword argument 'sinal_service'` e, com o parâmetro aceito, com
  `assert None is not None`.
- [x] Controller (`test_recomendacao_controller.py`): `sinal` presente e `null` por padrão; com um
  `SeasonalForecastRepository` falso (60%) pelo `dependency_overrides`, o JSON tem exatamente
  `{nivel, motivo, fonte, data, regra_dia_plantar{data_limite, texto}}`. Falhou com `ImportError: cannot
  import name 'get_seasonal_forecast_repository'` e, com a ligação feita, com `KeyError: 'sinal'`.
- [x] `projeto/backend/AGENTS.md` ("Dados da API") com a origem do `sinal`.

---

## 5. A revisar

- **"Terra sem falta de água"** (PRD 7.10 não define): adotado SMAP ≥ percentil 20 **e** chuva ≥ 60% da
  média, ou seja, nenhum dos dois indicadores de seca. Com só um deles seco (ex.: SMAP no percentil 10 e
  chuva normal), não é "terra seca" (pede os dois) nem "sem falta de água": fica `incerto` mesmo com a
  previsão baixa. Teste: `test_should_be_uncertain_when_only_one_soil_indicator_is_dry`.
- **Calibração** (A2.5): os limiares são hipótese do PRD. Validar com as previsões retrospectivas do GMAO;
  com acerto baixo, a tela mostra só a regra do dia de plantar.
- **Formato dos dados de A2.1 a A2.3:** os models esperam a chance como fração (0 a 1), o percentil de 0 a
  100 e a chuva com a média dos mesmos dias. Se o GEOS-S2S trouxer tercis ou anomalia em vez da
  probabilidade, a conversão fica no script de dados (A2.1), não no service.
- **Front:** o tipo é `sinal?: SinalOutono` e o backend manda `"sinal": null`. Todos os usos no front
  (`usePlanController`, `recomendacaoRules`, `missionService`, `reportService`, `ReportView`) já tratam
  `null` (`?.`, `??` e `if`). Sugestão para o front: tipar como `sinal?: SinalOutono | null`.
- **Textos** do motivo e da regra ficam no service (como as descrições dos planos), não no `regras.yaml`.

---

## 6. Critérios de Aceitação

1. **TDD:** testes escritos antes e vistos falhando (erros acima); repositories falsos, sem rede.
2. Sem dado, `sinal: null`; com dado, o formato do `SinalOutono` do front.
3. Limiares no `regras.yaml`, com fonte.
4. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.
