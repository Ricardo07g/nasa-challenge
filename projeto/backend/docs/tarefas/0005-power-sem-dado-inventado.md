# Tarefa 0005: NASA POWER sem dado inventado (R1.4)

- **Identificador:** `0005`
- **Título:** NASA POWER sem dado inventado: ano com dia faltando sai da série
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R1.4 (trilha "Qualidade do POWER"); depende da [tarefa 0004](0004-eto-penman-monteith.md)
- **Módulos Afetados:** `projeto/backend/app/repositories/external/nasa_power_client.py`, `projeto/backend/app/services/climate_season_builder.py`, `projeto/backend/app/constants.py`, `projeto/backend/AGENTS.md`
- **Referências:** PRD (6.1: "o valor `-999` é dado ausente"), [roteiro](../roteiro-de-implementacao.md) (R1.4 e seção 5, "Ano com dia faltando no POWER"), `pipeline/export_climate_fixture.py`, regra "nunca use dado sintético" do `AGENTS.md` do backend

---

## 1. Descrição e Motivação

O `NasaPowerClient` trocava todo dia sem dado (`null` ou a sentinela `-999`) por valores inventados: **0 mm** de chuva, **30 °C** de máxima, **18 °C** de mínima, **UR 65%**, **vento 2,0 m/s** e **radiação 18,5 MJ/m²**. Esses dias entravam no balanço hídrico e no ISNA como se fossem reais.

**Decisão do time:** descartar o ano que tiver qualquer dia faltando, como já faz o `pipeline/export_climate_fixture.py` (que gera a fixture da fazenda de exemplo).

---

## 2. Regra

| O que falta num dia da temporada (1/jan + 212 dias) | O que acontece |
| --- | --- |
| o dia inteiro, a chuva, a máxima ou a mínima | o **ano sai** da série (não é gravado em `climate_season`) |
| UR, vento ou radiação | o ano fica; a ETo da **temporada inteira** usa Hargreaves-Samani; a série com o buraco não é gravada (fica vazia) |
| a altitude da célula (resposta sem `geometry`) | todas as temporadas usam Hargreaves-Samani |

A contagem de anos que chega à resposta já sai do número de temporadas (`total_anos = len(anos)` no `RecommendationService`, publicado como `chuva.anos` e no texto "Deu certo em X de N anos"). Ano descartado não vira temporada, então a contagem cai junto. Não foi preciso campo novo.

---

## 3. Sub-tarefas de Implementação (Passo a Passo com TDD)

### Sub-tarefa 5.1: Cliente devolve "sem dado" (`nasa_power_client.py`)
- [x] `_clean_val(raw, fallback)` virou `_raw_value(raw) -> float | None`: valor nulo, ausente ou `<= -999` vira `None`.
- [x] A altitude usa a mesma regra.
- [x] **Teste TDD** em `tests/unit/repositories/external/test_nasa_power_client.py`: `-999` na chuva e na máxima, UR nula e radiação ausente chegam como `None`.

### Sub-tarefa 5.2: Service descarta o ano (`climate_season_builder.py`)
- [x] Ano com algum dia sem chuva, máxima ou mínima (ou sem o dia) fica de fora; registro em log (`info`).
- [x] Dia sem UR, vento ou radiação: Hargreaves-Samani na temporada inteira (regra da tarefa 0004) e a série incompleta não é gravada. Assim a coluna `REAL[]` não recebe `NULL`, que quebraria a leitura em `PostgisClimateRepository.get_seasons`.
- [x] **Testes TDD** em `tests/unit/services/test_climate_season_builder.py` (parametrizados por variável).

### Sub-tarefa 5.3: Contagem de anos
- [x] Teste em `tests/unit/services/test_satellite_ingestion_service.py`: com dias sem máxima em 2010 e 2017, a ingestão grava 18 temporadas.
- [x] Teste em `tests/unit/services/test_recommendation_service.py`: com 17 temporadas, `total_anos = 17` e o texto diz "de 17 anos".

### Sub-tarefa 5.4: Limpeza
- [x] Removidas `RH_DEFAULT_PCT`, `WIND_SPEED_DEFAULT_MS` e `SOLAR_RAD_DEFAULT_MJ` (`app/constants.py`), que ficaram sem uso.
- [x] Regra registrada em "Dados da API" no `AGENTS.md` do backend.

---

## 4. Decisões

- **UR, vento ou radiação faltando: Hargreaves na temporada, sem descartar o ano.** Hargreaves-Samani é o método do próprio FAO-56 (eq. 52) para quando faltam esses dados. Ele usa só a máxima e a mínima reais do dia e a latitude, então nada é inventado. A temporada inteira usa o mesmo método, sem misturar Penman-Monteith e Hargreaves dentro de uma safra. Descartar o ano tiraria da estatística de 20 anos um ano com chuva e temperatura reais, por causa de uma variável que só entra na ETo.
- **Por que não preencher nem guardar nulo:** preencher é inventar dado (proibido no `AGENTS.md`). Guardar nulo levaria o problema para o motor, que não sabe simular um dia sem chuva ou sem temperatura.

---

## 5. Riscos e o que ficou de fora

- Uma temporada com ETo de Hargreaves não leva marca de método. Hargreaves tende a superestimar a ETo em clima úmido, o que deixa o ISNA daquele ano um pouco mais pessimista. Conferido à mão em 2026-11-14 no ponto da fazenda de exemplo: a janela de 2005 a 2024 do POWER veio sem nenhum dia faltando, e as 20 temporadas saem com Penman-Monteith.
- Se todos os anos de uma célula forem descartados, a célula fica sem temporadas e a API responde que não tem dados do ponto. A ingestão não busca a célula vizinha nesse caso.
- `scripts/seed_db.py` ainda grava ETo fixa de 4,0 mm. O script será aposentado no R1.6 e não foi mexido aqui.

---

## 6. Critérios de Aceitação (Definition of Done)

1. **TDD Estrito:** teste visto falhando antes de cada mudança de comportamento (`pytest` verde no fim).
2. **Sem Chamadas de Rede em Testes:** HTTP falso no cliente.
3. **Nada inventado:** nenhum valor padrão no lugar de dado ausente do POWER.
4. **Contagem honesta:** o número de anos da resposta é o número de anos com dado.
5. **Aderência ao AGENTS.md:** `ruff check`, `ruff format --check` e `pre-commit` aprovados.
