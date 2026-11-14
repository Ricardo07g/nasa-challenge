# Tarefa 0004: ETo FAO-56 Penman-Monteith no service (R1.3)

- **Identificador:** `0004`
- **Título:** ETo FAO-56 Penman-Monteith no service, com o cliente do NASA POWER só trazendo dados
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R1.3 (trilha "Qualidade do POWER"); PRD T-05
- **Módulos Afetados:** `projeto/backend/app/services/water_balance_calculator.py`, `projeto/backend/app/services/climate_season_builder.py` (novo), `projeto/backend/app/services/satellite_ingestion_service.py`, `projeto/backend/app/repositories/external/nasa_power_client.py`, `projeto/backend/app/models/climate.py`, `projeto/backend/app/constants.py`
- **Referências:** [PRD – Raiz Orbital](../../../../arquivos%20contexto/PRD%20%E2%80%93%20Raiz%20Orbital%20o%20que%20plantar%20depois%20da%20soja.md) (6.1 e 7.2), [plano técnico do backend](../../../../arquivos%20contexto/Raiz%20Orbital%20%E2%80%93%20plano%20t%C3%A9cnico%20do%20backend.md) (§5, `climate_season.eto_mm`), [roteiro](../roteiro-de-implementacao.md) (R1.3), FAO-56: Allen, R. G. et al. (1998), *Crop evapotranspiration*, FAO Irrigation and Drainage Paper 56

---

## 1. Descrição e Motivação

O PRD (6.1) pede a ETo diária pelo **FAO-56 Penman-Monteith** com os dados do NASA POWER. Antes desta tarefa:

1. O `NasaPowerClient` (repository) calculava uma ETo própria **dentro do cliente**: uma mistura de Hargreaves com a radiação de superfície, que não é nenhum método do FAO-56. Cálculo em repository fere a regra das camadas (`AGENTS.md`).
2. O `WaterBalanceCalculator` só tinha Hargreaves-Samani; não havia Penman-Monteith.
3. A ingestão buscava o ano inteiro (1/jan a 31/dez) e gravava temporadas de 365 dias, diferentes das da fixture e do motor (1/jan a 31/jul, 212 dias).

Agora o cliente só traz a série bruta e a altitude, e o **service** monta as temporadas e calcula a ETo.

---

## 2. Fluxo

```
SatelliteIngestionService.ingest_area(lat, lon)
   │  janela = ClimateSeasonBuilder.request_window()   (1/jan/2005 a 30/jul/2024)
   ▼
NasaPowerClient.fetch_daily(lat, lon, início, fim)     (repository: só HTTP + parse)
   │  PowerDailySeries(elevation_m, days[DailyWeatherRecord])
   ▼
ClimateSeasonBuilder.build(série, cell_id, lat)        (service)
   │  uma temporada de 212 dias por ano, a partir de 1/jan
   │  ETo: Penman-Monteith (WaterBalanceCalculator) ou, se faltar entrada, Hargreaves-Samani
   ▼
ClimateRepository.save_cell_seasons(...)               (grava eto_mm, UR, vento e radiação)
```

---

## 3. Sub-tarefas de Implementação (Passo a Passo com TDD)

### Sub-tarefa 4.1: Penman-Monteith como função pura (`water_balance_calculator.py`)
- [x] `penman_monteith_eto(t_max, t_min, actual_vapour_pressure_kpa, wind_2m_ms, solar_rad_mj, lat_deg, day_of_year, elevation_m)`: FAO-56 eq. 6, passo diário, G = 0, Rn pelas eq. 37 a 40, pressão pela altitude (eq. 7 e 8). Nunca devolve ETo negativa.
- [x] `actual_vapour_pressure_from_rh_mean(t_max, t_min, rh_mean_pct)`: FAO-56 eq. 19 (o POWER dá a UR média, `RH2M`). Com ponto de orvalho, use `saturation_vapour_pressure(t_dew)` (eq. 14).
- [x] Constantes do algoritmo no topo do módulo (`coding-guidelines.md`).
- [x] **Testes TDD** em `tests/unit/services/test_water_balance_calculator.py`:
  - exemplo 18 do boletim FAO-56 (Bruxelas, 6/jul, 50°48' N, 100 m): **3,9 mm/dia**;
  - exemplo 5 do boletim (UR média 68%, 25/18 °C): ea = **1,78 kPa**;
  - entradas incoerentes (ea acima da saturação) não dão ETo negativa.

### Sub-tarefa 4.2: Cliente do POWER só traz dados (`nasa_power_client.py`)
- [x] Novo contrato `fetch_daily(lat, lon, start, end) -> PowerDailySeries` (no lugar de `fetch_seasons`).
- [x] Pede só `PRECTOTCORR, T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN` (lista do PRD 6.1). Saíram `T2M` e `GWETROOT`, que o motor não usa.
- [x] Lê a altitude da célula do POWER em `geometry.coordinates[2]` (sem ela, `elevation_m = None`).
- [x] Model novo `PowerDailySeries` e `DailyWeatherRecord` ajustado aos seis parâmetros (`app/models/climate.py`).
- [x] **Testes TDD** em `tests/unit/repositories/external/test_nasa_power_client.py` (HTTP falso): parâmetros e período pedidos, série bruta com altitude e sem ETo, resposta sem `geometry`, retentativa e erro de domínio.

### Sub-tarefa 4.3: Temporadas e ETo no service (`climate_season_builder.py`)
- [x] `ClimateSeasonBuilder.request_window()`: de 1/jan do primeiro ano ao último dia da última temporada.
- [x] `ClimateSeasonBuilder.build(série, cell_id, lat)`: uma temporada de **212 dias a partir de 1/jan** por ano, igual ao `pipeline/export_climate_fixture.py` (em ano bissexto vai até 30/jul). Ano sem algum dia da janela fica de fora.
- [x] ETo Penman-Monteith quando a temporada tem UR, vento e radiação em todos os dias e o POWER deu a altitude; senão, Hargreaves-Samani na temporada inteira (não mistura métodos dentro de uma temporada).
- [x] `CLIMATE_SEASON_DAYS = 212` em `app/constants.py`.
- [x] **Testes TDD** em `tests/unit/services/test_climate_season_builder.py`.

### Sub-tarefa 4.4: Ingestão usa o builder (`satellite_ingestion_service.py`)
- [x] Pede ao POWER só a janela das temporadas e grava as temporadas montadas pelo builder (com `eto_mm`, `rh2m_pct`, `ws2m_ms`, `solar_rad_mj`).
- [x] O builder entra por injeção (padrão: `ClimateSeasonBuilder(WaterBalanceCalculator())`), sem mudar `dependencies.py`.
- [x] **Teste TDD** em `tests/unit/services/test_satellite_ingestion_service.py`: 20 temporadas jan–jul com a ETo Penman-Monteith.

---

## 4. Decisões

- **Altitude:** vem da resposta do POWER (`geometry.coordinates[2]`, a altitude da célula do MERRA-2). Se não vier, a temporada usa Hargreaves-Samani, que não precisa de altitude; não há altitude padrão inventada. Para referência, 0 m contra 850 m muda a ETo de um dia típico de Uberlândia em cerca de 2%.
- **Reserva:** Hargreaves-Samani (FAO-56 eq. 52, com a radiação extraterrestre) continua como reserva e continua sendo o método da fixture, que não traz `eto_mm` (`ClimateRiskService.reference_eto`).
- **Sem `pyet`:** o PRD cita a biblioteca `pyet`; as equações do FAO-56 foram escritas à mão e testadas com o exemplo do boletim, para não abrir dependência nova (`pyproject.toml` é arquivo de conflito do R0.3).
- **Dias faltando:** nesta tarefa o cliente ainda troca o `-999` por valores padrão; a regra de não inventar dado é a [tarefa 0005](0005-power-sem-dado-inventado.md).

---

## 5. Critérios de Aceitação (Definition of Done)

1. **TDD Estrito:** cada comportamento novo com teste escrito antes e visto falhando (`pytest` verde no fim).
2. **Sem Chamadas de Rede em Testes:** HTTP falso no cliente; nenhum teste chama o POWER.
3. **Camadas:** nenhum cálculo no `NasaPowerClient`; ETo e temporadas só em `services/`.
4. **Fiel ao FAO-56:** exemplo 18 do boletim reproduzido (3,9 mm/dia).
5. **Aderência ao AGENTS.md:** `ruff check`, `ruff format --check` e `pre-commit run --all-files` aprovados.
