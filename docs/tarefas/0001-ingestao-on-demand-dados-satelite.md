# Tarefa 0001: Pipeline de Ingestão On-Demand de Dados de Satélite e Solo (Cache-Aside Espacial)

- **Identificador:** `0001`
- **Título:** Pipeline de Ingestão On-Demand de Dados de Satélite e Solo (Cache-Aside Espacial)
- **Status:** Pendente
- **Prioridade:** Alta
- **Módulos Afetados:** `projeto/backend/app/repositories/external/`, `projeto/backend/app/jobs/`, `projeto/backend/app/services/`, `projeto/backend/app/controllers/`
- **Referências:** [PRD – Raiz Orbital](../../arquivos%20contexto/PRD%20%E2%80%93%20Raiz%20Orbital%20o%20que%20plantar%20depois%20da%20soja.md) (RNF-01), [ADR-0003](../adr/0003-series-temporais-nasa-e-janela-de-20-anos.md), [diagrama-de-sequencias.md](../../projeto/backend/docs/diagrama-de-sequencias.md)

---

## 1. Descrição e Motivação

Atualmente, o banco de dados PostGIS possui dados climáticos e edáficos pré-carregados apenas para a microrregião piloto de **Uberlândia/MG** (`-18.9, -48.3`). Se um produtor rural selecionar um ponto fora dessa área piloto no mapa (ex.: em Rio Verde/GO, Sorriso/MT ou outra área do Cerrado), o sistema atualmente não encontra o registro espacial e falha por falta de dados.

Esta tarefa tem como objetivo implementar um mecanismo de **Cache-Aside Espacial com Ingestão On-Demand**, onde:
1. Ao consultar um talhão via coordenadas (`lat`, `lon`), o backend verifica no PostGIS se a célula da grade (`grid_cell`) já possui dados consolidados.
2. **Caso Exista (Cache Hit):** Devolve instantaneamente a resposta em menos de 100ms.
3. **Caso Não Exista (Cache Miss):** O backend aciona um **Job de Ingestão** que consulta as APIs da NASA (NASA POWER) e do SoilGrids, calcula as métricas necessárias (balanço hídrico, CAD, texturas) e persiste no banco para essa nova célula espacial. As próximas consultas para aquela área serão imediatas.

---

## 2. Diagrama da Arquitetura do Fluxo

```
                        [ Usuário seleciona Talhão no Mapa ]
                                         │
                                         ▼
                     GET /api/talhao?lat=-17.78&lon=-50.92
                                         │
                                         ▼
                                 [ TalhaoService ]
                                         │
                                         ▼
                            [ PostgisClimateRepository ]
                                         │
                     ┌───────────────────┴───────────────────┐
                     ▼                                       ▼
             [ Célula Encontrada ]                   [ Célula Ausente ]
             (Hit no Banco PostGIS)                  (Miss - Nova Região)
                     │                                       │
                     │                                       ▼
                     │                        [ SatelliteIngestionJob / Service ]
                     │                                       │
                     │                    ┌──────────────────┴──────────────────┐
                     │                    ▼                                     ▼
                     │            [ NasaPowerClient ]                   [ SoilGridsClient ]
                     │            - PRECTOTCORR (20 anos)               - Argila/Areia (0-30cm)
                     │            - TMAX, TMIN, ETo                     - Cálculo da CAD (mm)
                     │                    └──────────────────┬──────────────────┘
                     │                                       ▼
                     │                         [ Persiste no Banco PostGIS ]
                     │                         - INSERT grid_cell
                     │                         - INSERT climate_season (20 anos)
                     │                         - INSERT soil_point
                     │                                       │
                     ▼                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Devolve Talhão Completo + Recomendações (< 10s no RNF-01)  │
        └─────────────────────────────────────────────────────────────┘
```

---

## 3. Sub-tarefas de Implementação (Passo a Passo com TDD)

### Sub-tarefa 1.1: Clientes HTTP Externos (`app/repositories/external/`)
- [ ] Adaptar a lógica de [`data/extract_nasa_power.py`](file:///workspace/data/extract_nasa_power.py) para uma classe limpa `NasaPowerClient`:
  - Requisição HTTP via `httpx` para `https://power.larc.nasa.gov/api/temporal/daily/point`.
  - Tratamento de timeout (máx 8s), retentativa exponencial e fallback em caso de falha.
- [ ] Adaptar a lógica de [`data/extract_soilgrids.py`](file:///workspace/data/extract_soilgrids.py) para uma classe limpa `SoilGridsClient`:
  - Requisição HTTP para ISRIC SoilGrids REST API.
  - Extração de profundidades 0-5cm, 5-15cm, 15-30cm e cálculo da textura e CAD.
- [ ] **Testes TDD:**
  - `tests/unit/repositories/external/test_nasa_power_client.py` com mock do `httpx`.
  - `tests/unit/repositories/external/test_soilgrids_client.py` com mock de respostas JSON da ISRIC.

### Sub-tarefa 1.2: Job de Ingestão e Persistência (`app/jobs/` ou `app/services/ingestion/`)
- [ ] Criar classe `SatelliteIngestionService`:
  - Método `ingest_area(lat: float, lon: float) -> str` (retorna o `cell_id` criado/populado).
  - Executa as chamadas externas de clima e solo (em paralelo usando `asyncio.gather` ou `ThreadPoolExecutor`).
  - Mapeia o quadrante de 0.1° e gera a geometria do polígono `grid_cell`.
  - Insere em lote no banco PostGIS (`grid_cell`, `climate_season`, `soil_point`).
- [ ] **Testes TDD:**
  - `tests/unit/services/test_satellite_ingestion_service.py` testando orquestração com clientes falsos e repositório falso.

### Sub-tarefa 1.3: Integração no `TalhaoService` e `ClimateRepository` (Cache-Aside)
- [ ] Atualizar o método `obter_talhao(lat, lon)` no `TalhaoService`:
  - Tenta localizar no `ClimateRepository`.
  - Se retornar nulo / célula ausente, invoca `SatelliteIngestionService.ingest_area(lat, lon)`.
  - Recarrega os dados recém-persistidos e prossegue normalmente.
- [ ] **Testes TDD:**
  - `tests/unit/services/test_talhao_service.py` cobrindo o cenário de fallback/ingestão on-demand.

### Sub-tarefa 1.4: Resiliência e Polling / Background Execution
- [ ] Garantir que o endpoint `GET /api/talhao` responda dentro da janela aceitável:
  - Se síncrono: timeout estrito de 9 segundos.
  - Em caso de indisponibilidade da API da NASA, utilizar a célula de solo/clima mais próxima já existente no banco (interpolação por vizinho mais próximo `ST_ClosestPoint`).
- [ ] **Testes TDD:**
  - `tests/integration/controllers/test_talhao_controller.py` com cenário de nova coordenada.

---

## 4. Critérios de Aceitação (Definition of Done)

1. **TDD Estrito:** Todos os testes unitários e de integração escritos e passando antes e depois da implementação (`pytest` verde).
2. **Sem Chamadas de Rede em Testes:** A suíte de testes nunca deve fazer chamadas reais às APIs externas da NASA ou SoilGrids (uso de mocks/fakes obrigatório).
3. **Persistência Correta:** Uma nova coordenada consultada gera com sucesso as linhas nas tabelas `grid_cell`, `soil_point` e `climate_season` com SRID 4326.
4. **Idempotência e Concorrência:** Se duas requisições simultâneas consultarem a mesma área nova, o sistema deve tratar com `ON CONFLICT DO NOTHING / UPDATE` sem lançar erro de chave duplicada.
5. **Aderência ao AGENTS.md:** Código na camada correta (MVC + Service/Repository), `ruff check` e `ruff format` aprovados.
