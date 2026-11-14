# Diagramas de Sequência — Raiz Orbital (Backend & Integrações)

Este documento detalha os **Diagramas de Sequência (UML)** de todos os fluxos arquiteturais do **Raiz Orbital**, cobrindo o pipeline offline de ingestão orbital, as rotas online da API FastAPI acionadas pelas telas do protótipo v3, os mecanismos de cache/fallback e as interações sem latência no navegador.

---

## 1. Pipeline Offline de Preparação de Dados (`projeto/backend/pipeline/`)

Para garantir que a demonstração e o uso em campo respondam em **menos de 1 segundo (RNF-01)** e nunca dependam da instabilidade de download de milhares de arquivos da NASA em tempo de execução, os dados climáticos pesados são preparados previamente por célula de 0,1° e gravados no **PostGIS**:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Dev 1 (CLI Pipeline)
    participant Grid as build_grid.py
    participant Power as fetch_power.py
    participant Imerg as fetch_imerg.py
    participant Cmip as fetch_cmip6_deltas.py
    participant NASA as APIs NASA (POWER / Earthdata / GEE)
    participant DB as PostgreSQL 17 + PostGIS
    participant Fix as export_fixture.py

    Dev->>Grid: Executa recorte do Triângulo Mineiro (0,1°)
    Grid->>DB: INSERT INTO grid_cell (id, geom, center)

    Dev->>Power: Busca clima diário 2006–2025 (comunidade AG)
    Power->>NASA: GET /api/temporal/daily/point (células 0,5°)
    NASA-->>Power: PRECTOTCORR, T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN
    Power->>Power: Trata -999, calcula ETo FAO-56 Penman-Monteith (pyet)
    Power->>DB: INSERT INTO climate_season (arrays de 212 dias: 1/jan a 31/jul)
    Power->>DB: INSERT INTO data_run (source='nasa_power')

    opt Chuva de alta resolução (0,1° ~10 km) em segundo plano
        Dev->>Imerg: Busca GPM_3IMERGDF v07 (2006–2025)
        Imerg->>NASA: earthaccess.search_data & open (GES DISC)
        NASA-->>Imerg: Precipitação diária 0,1°
        Imerg->>DB: UPDATE climate_season SET rain_mm = ..., rain_source = 'imerg_final'
        Imerg->>DB: INSERT INTO data_run (source='gpm_imerg')
    end

    Dev->>Cmip: Calcula anomalias 2041–2060 vs 1995–2014 (SSP2-4.5)
    Cmip->>NASA: ee.ImageCollection("NASA/GDDP-CMIP6").getRegion()
    NASA-->>Cmip: Séries pr (kg/m²/s) e tasmax (K) para 3 modelos
    Cmip->>Cmip: Converte unidades e calcula Δ% chuva e +Δ°C por mês
    Cmip->>DB: INSERT INTO cmip6_delta (cell_id, model, scenario, month, rain_pct, tmax_c)
    Cmip->>DB: INSERT INTO data_run (source='nex_gddp_cmip6')

    Dev->>Fix: Gera fixture da Fazenda de Exemplo (Uberlândia -18.92, -48.28)
    Fix->>DB: Lê célula -190_-483 e executa RecommendationService
    Fix-->>Dev: Grava app/fixtures/exemplo_uberlandia.json
```

---

## 2. Fluxo da Fazenda de Exemplo — Tela 1 para Tela 5 (`GET /api/exemplo`)

Atende à história **US-11 (Jurado)** e ao requisito **RF-11**: abre instantaneamente a recomendação completa para Uberlândia sem depender do banco ou de chamadas externas.

```mermaid
sequenceDiagram
    autonumber
    actor User as Jurado / Produtor
    participant UI as Frontend (Tela 1 -> Tela 5)
    participant Ctrl as RecomendacaoController
    participant Repo as FixtureClimateRepository
    participant File as exemplo_uberlandia.json

    User->>UI: Toca em "Ver um exemplo pronto" (Tela 1)
    UI->>Ctrl: GET /api/exemplo (Header Accept-Language: pt-BR | en)
    Ctrl->>Repo: load_example(lang)
    Repo->>File: Lê JSON pré-calculado em disco/memória
    File-->>Repo: Dados completos (/talhao + /recomendacao)
    Repo-->>Ctrl: ExemploResponse
    Ctrl-->>UI: HTTP 200 OK (~15 KB, gzip, < 50 ms)
    UI-->>User: Renderiza direto a Tela 5 (A Resposta) com dados reais da NASA
```

---

## 3. Marcação do Talhão e Leitura por Satélite — Tela 2 para Telas 3 e 4 (`GET /api/talhao`)

Atende às histórias **US-01**, **US-02** e **US-07** (RF-01, RF-02, RF-08, RF-16).
> [!TIP]
> **Otimização de UX/Latência:** O frontend dispara `GET /api/talhao?lat&lon` assim que o produtor toca em **"É aqui"** na Tela 2. Enquanto o usuário lê e responde a Tela 3 (*"Quando você colhe a soja?"*), o backend busca o solo e o NDVI em paralelo.

```mermaid
sequenceDiagram
    autonumber
    actor Produtor as Produtor (Marcelo)
    participant UI as Frontend (Telas 2, 3 e 4)
    participant Ctrl as TalhaoController
    participant Svc as TalhaoService
    participant ClimRepo as PostgisClimateRepository
    participant SoilRepo as CachedSoilGridsRepository
    participant NdviRepo as CachedEarthEngineNdviRepository
    participant HistSvc as FieldHistoryService
    participant DB as PostGIS
    participant Ext as SoilGrids API & Google Earth Engine

    Produtor->>UI: Marca ponto no mapa ou GPS e toca em "É aqui" (Tela 2)
    UI->>Ctrl: GET /api/talhao?lat=-18.92&lon=-48.28
    UI-->>Produtor: Avança imediatamente para a Tela 3 (Pergunta 2/2)

    Ctrl->>Svc: inspect_talhao(lat=-18.92, lon=-48.28)
    Svc->>ClimRepo: find_cell_id(lat, lon)
    ClimRepo->>DB: SELECT id FROM grid_cell WHERE ST_Contains(geom, ST_MakePoint(lon, lat))

    alt Ponto fora da caixa preparada do Triângulo Mineiro
        DB-->>ClimRepo: None
        ClimRepo-->>Svc: None
        Svc-->>Ctrl: Talhao(dentro_da_area=False)
        Ctrl-->>UI: HTTP 200 OK {"dentro_da_area": false}
        UI-->>Produtor: Exibe aviso amigável e botão "Usar fazenda de exemplo"
    else Ponto dentro da caixa preparada
        DB-->>ClimRepo: celula_id = "-190_-483"
        ClimRepo-->>Svc: "-190_-483"

        par Busca Textura do Solo (Cache PostGIS -> SoilGrids)
            Svc->>SoilRepo: get_soil(lat, lon)
            SoilRepo->>DB: SELECT * FROM soil_point WHERE key = '-18.9200_-48.2800'
            alt Cache Miss no PostGIS
                SoilRepo->>Ext: GET SoilGrids v2.0 (clay, sand 0-30cm, timeout Curto)
                alt SoilGrids respondeu com sucesso
                    Ext-->>SoilRepo: clay_pct, sand_pct
                    SoilRepo->>SoilRepo: Regra: argila>35% -> argiloso(60mm); areia>70% -> arenoso(40mm); senão medio(50mm)
                    SoilRepo->>DB: INSERT INTO soil_point (...)
                else Timeout ou erro no SoilGrids
                    SoilRepo->>SoilRepo: Fallback seguro: textura='medio', cad_mm=50, fonte='padrao'
                end
            end
            SoilRepo-->>Svc: SoloInfo(textura, cad_mm, fonte)
        and Busca Série NDVI 10 Anos (Cache PostGIS -> Earth Engine)
            Svc->>NdviRepo: get_ndvi_series(lat, lon)
            NdviRepo->>DB: SELECT date, ndvi FROM ndvi_point WHERE key = '-18.9200_-48.2800'
            alt Cache Miss no PostGIS
                NdviRepo->>Ext: ee.ImageCollection("MODIS/061/MOD13Q1").getRegion(ponto, 250) (timeout 10s)
                alt Earth Engine respondeu a tempo
                    Ext-->>NdviRepo: Série bruta MODIS (2015–2025)
                    NdviRepo->>NdviRepo: Aplica fator de escala (* 0.0001)
                    NdviRepo->>DB: INSERT INTO ndvi_point (key, date, ndvi)
                else Timeout ou falha no Earth Engine
                    NdviRepo-->>Svc: Lista vazia (degradação graciosa)
                end
            end
            NdviRepo-->>Svc: ndvi_series
        end

        Svc->>HistSvc: classify_entressafra(ndvi_series)
        HistSvc->>HistSvc: Avalia máx NDVI (1/abr a 31/jul): >0.60 'plantou', <0.45 'parado'
        HistSvc-->>Svc: HistoricoTalhao (ou None se sem NDVI)

        Svc->>HistSvc: suggest_harvest_band(ndvi_series)
        HistSvc->>HistSvc: Identifica queda <50% do pico de verão (jan–mar) -> mediana ('cedo'|'meio'|'tarde')
        HistSvc-->>Svc: ColheitaSugerida(faixa, fonte)

        Svc-->>Ctrl: Talhao completo
        Ctrl-->>UI: HTTP 200 OK (TalhaoResponse)
        UI-->>Produtor: Pré-seleciona faixa sugerida na Tela 3 e preenche cartões da Tela 4
    end
```

---

## 4. Cálculo da Recomendação, Alternativas e Plano de 3 Anos — Tela 3/4 para Telas 5, 6 e 7 (`GET /api/recomendacao`)

Atende às histórias **US-03, US-04, US-05, US-06, US-08 e US-09** (RF-03 a RF-10). Toda a matemática roda em memória em **milissegundos** sobre as séries carregadas do PostGIS:

```mermaid
sequenceDiagram
    autonumber
    actor Produtor as Produtor / Agrônoma
    participant UI as Frontend (Telas 4, 5, 6 e 7)
    participant Ctrl as RecomendacaoController
    participant RecSvc as RecommendationService
    participant CropRepo as YamlCropParamsRepository
    participant RulesRepo as YamlRulesRepository
    participant ClimRepo as PostgisClimateRepository
    participant RiskSvc as ClimateRiskService
    participant WB as WaterBalanceCalculator
    participant PlanSvc as RotationPlanService
    participant DB as PostGIS

    Produtor->>UI: Escolhe faixa de colheita (cedo | meio | tarde) e toca em continuar
    UI->>Ctrl: GET /api/recomendacao?lat=-18.92&lon=-48.28&colheita=meio[&solo=argiloso][&nematoide=sim]

    Ctrl->>RecSvc: recommend(lat, lon, colheita, solo_override, nematoide, lang)
    RecSvc->>CropRepo: list_all() (lê culturas.yaml)
    CropRepo-->>RecSvc: 6 opções (pousio, milho_safrinha, sorgo, milho_braquiaria, milheto, crotalaria)
    RecSvc->>RulesRepo: get_harvest_date('meio') & get_soil_cad(solo) (lê regras.yaml)
    RulesRepo-->>RecSvc: semeadura = 18/fev, cad_mm = 50 mm

    RecSvc->>ClimRepo: get_seasons(cell_id) & get_cmip6_deltas(cell_id, 'ssp245')
    ClimRepo->>DB: SELECT * FROM climate_season WHERE cell_id = '-190_-483' (20 linhas)
    ClimRepo->>DB: SELECT * FROM cmip6_delta WHERE cell_id = '-190_-483'
    DB-->>ClimRepo: Séries 2006–2025 + Deltas mensais CMIP6
    ClimRepo-->>RecSvc: seasons, cmip6_deltas

    loop Para cada uma das 5 culturas plantáveis (Pousio fica fora do ranking)
        RecSvc->>RiskSvc: is_within_window(crop, semeadura)
        alt Cultura dentro da janela ZARC
            RecSvc->>RiskSvc: simulate_historical(crop, seasons, semeadura, cad_mm)
            loop Para cada ano de 2006 a 2025 (20 anos)
                RiskSvc->>WB: simular(chuva, eto, kc, cad_mm)
                WB-->>RiskSvc: etr_l, etc_l
                RiskSvc->>WB: isna(etr_l, etc_l, ini_crit, fim_crit)
                WB-->>RiskSvc: valor_isna
                RiskSvc->>RiskSvc: Verifica aperto: ISNA < 0.55 (ou <0.50 cobertura 30d) OU >=3 dias Tmax >= 35°C
            end
            RiskSvc-->>RecSvc: 20 ResultadoAno (anos_bons, faixa booleana, fator_perda)

            RecSvc->>RiskSvc: simulate_future_cmip6(crop, seasons, deltas, semeadura, cad_mm)
            RiskSvc->>RiskSvc: Aplica método do delta (chuva*(1+Δ%), Tmax+Δ°C, recalcula ETo) por modelo
            RiskSvc-->>RecSvc: futuro (anos_bons_media, min, max)

            RecSvc->>RecSvc: Calcula notas 0–100 (Segurança, Futuro, Solo c/ ajuste nematoide, Renda)
            RecSvc->>RecSvc: Aplica rótulos (bom | medio | fraco) e interpola frases "porque" em regras.yaml
        else Cultura fora da janela limite
            RecSvc->>RecSvc: Adiciona em fora_da_janela com frase explicativa da data limite
        end
    end

    RecSvc->>RecSvc: Define 'melhor' (maior nota final ponderada: 30% seg, 25% solo, 30% renda, 15% futuro)
    RecSvc->>RecSvc: Seleciona 3 'alternativas' (campeãs em menos_risco, mais_dinheiro, cuidar_da_terra sem repetir)

    RecSvc->>PlanSvc: build_3_year_plans(opcoes, seasons, nematoide)
    PlanSvc->>PlanSvc: Gera 216 sequências (6x6x6), filtra restrições e aplica bônus de diversidade (+5/+10)
    PlanSvc->>PlanSvc: Calcula melhor plano 'normal' (20 anos) e 'seco' (4 anos mais secos de fev–abr)
    PlanSvc-->>RecSvc: plano_normal, plano_seco, plano_hoje

    RecSvc-->>Ctrl: Recomendacao completa
    Ctrl-->>UI: HTTP 200 OK (RecomendacaoResponse + Cache-Control: max-age=86400 + GZip)
    UI-->>Produtor: Exibe Tela 5 (A Resposta) e habilita Telas 6 e 7 instantaneamente
```

---

## 5. Interações Locais no Navegador — Telas 5, 6 e 7 (Zero Latência de Rede)

Atende aos requisitos **RNF-02** (recálculo/reordenação em menos de 1 s no navegador) e **RF-17 / US-12** (botão *"Ouvir"* via síntese de voz nativa):

```mermaid
sequenceDiagram
    autonumber
    actor Produtor as Produtor (Marcelo)
    participant UI as Frontend React (Estado em Memória)
    participant Speech as Web Speech API (Navegador pt-BR / en-US)

    Note over Produtor,UI: O JSON de GET /api/recomendacao já está carregado na memória do navegador

    Produtor->>UI: Toca em "Ouvir" em qualquer tela principal (US-12)
    UI->>Speech: window.speechSynthesis.speak(Utterance(texto_da_tela))
    Speech-->>Produtor: Lê em voz alta a recomendação e o "por quê"

    Produtor->>UI: Abre Tela 6 ("Todas as opções") e toca em ordenar por "Mais chuva" | "Mais dinheiro" | "Melhor para a terra"
    UI->>UI: Reordena array `opcoes` em memória pelo eixo selecionado (< 10 ms)
    UI-->>Produtor: Atualiza lista de cartões instantaneamente (sem requisição HTTP)

    Produtor->>UI: Abre Tela 7 ("Plano de 3 anos") e alterna entre "Ano normal" e "Se vier ano seco"
    UI->>UI: Alterna exibição entre `plano_3_anos.normal` e `plano_3_anos.seco`
    UI-->>Produtor: Mostra a sequência adaptada instantaneamente
```

---

## 6. Fluxo de Listagem/Consulta de Culturas e Tratamento de Erros (`GET /api/crop-options`)

Demonstra o fluxo de referência já implementado em `app/` e a tradução centralizada de exceções de domínio (`DomainError` / `NotFoundError`) no `app/main.py`:

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Frontend / Consumidor API
    participant Main as app/main.py (Exception Handlers)
    participant Ctrl as CropOptionController
    participant Svc as CropOptionService
    participant Repo as CropOptionRepository (InMemory / YAML)

    Cliente->>Main: GET /api/crop-options/{option_id}
    Main->>Ctrl: get_crop_option(option_id, service)
    Ctrl->>Svc: get_option(option_id)
    Svc->>Repo: get_by_id(option_id)

    alt Opção encontrada
        Repo-->>Svc: CropOption(id, name, role)
        Svc-->>Ctrl: CropOption
        Ctrl->>Ctrl: CropOptionResponse.from_model(option)
        Ctrl-->>Main: CropOptionResponse
        Main-->>Cliente: HTTP 200 OK (JSON)
    else Opção inexistente (option_id inválido)
        Repo-->>Svc: None
        Svc-->>Main: raise NotFoundError("Opção de entressafra '...' não encontrada")
        Main->>Main: @app.exception_handler(NotFoundError)
        Main-->>Cliente: HTTP 404 Not Found {"detail": "Opção de entressafra '...' não encontrada"}
    end
```
