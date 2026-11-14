# Diagramas de Sequência — Raiz Orbital (Backend, Protótipo v3 & Scripts `/data`)

Este documento apresenta os **Diagramas de Sequência (UML)** do **Raiz Orbital**, integrando os **scripts reais de extração em [`/workspace/data/`](file:///workspace/data)** com as camadas da API FastAPI e as 9 telas do protótipo v3.

---

## 1. Pipeline de Extração de Dados (`/data/extract_*.py` $\rightarrow$ `/data/output/` & PostGIS)

Mostra como cada script implementado em [`/workspace/data/`](file:///workspace/data) obtém, higieniza e armazena os dados da NASA, do SoilGrids e do Google Earth Engine em [`/workspace/data/output/`](file:///workspace/data/output) e no banco PostGIS:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Dev / Pipeline (/data)
    participant Power as extract_nasa_power.py & extract_historical_20y.py
    participant Smap as extract_smap.py
    participant Soil as extract_soilgrids.py
    participant GeeNdvi as extract_gee_ndvi.py
    participant GeeCmip as extract_gee_cmip6.py
    participant APIs as APIs Externas (NASA POWER / AppEEARS / SoilGrids / GEE)
    participant Out as /data/output/*.json & .csv (+ PostGIS)

    Note over Dev,Out: 1. Série Meteorológica Diária de 20 Anos (2005–2024) — Sem Cadastro
    Dev->>Power: Executa extração para Fazenda do Glória, UFU (-18.9543, -48.1993)
    Power->>APIs: GET power.larc.nasa.gov/api/temporal/daily/point (community=AG)
    APIs-->>Power: PRECTOTCORR, T2M_MAX, T2M_MIN, T2M, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT
    Power->>Power: Converte sentinela -999.0 para None e agrega resumo anual (chuva safrinha fev–mai, dias >=35°C)
    Power->>Out: Salva historico_uberlandia_20anos_diario.json/.csv e resumo_uberlandia_20anos_anual.json/.csv

    Note over Dev,Out: 2. Umidade do Solo na Zona Radicular (NASA SMAP L4 - SPL4SMGP)
    Dev->>Smap: Executa extract_smap.py (Token Hardcoded, Login Earthdata ou Fallback Calibrado)
    alt Token ou Credenciais Earthdata configuradas
        Smap->>APIs: POST appeears.earthdatacloud.nasa.gov/api/task (SPL4SMGP.007: sm_rootzone, sm_surface)
        APIs-->>Smap: task_id
        loop Polling a cada 15s (wait_and_download_task)
            Smap->>APIs: GET /api/task/{task_id}
            APIs-->>Smap: status = 'processing' -> 'done'
        end
        Smap->>APIs: GET /api/bundle/{task_id} & download dos arquivos
    else Modo Desenvolvimento / Hackathon
        Smap->>Smap: generate_smap_sample_dataset (sm_surface_m3_m3, sm_rootzone_m3_m3, sm_rootzone_wetness)
    end
    Smap->>Out: Salva smap_uberlandia_2024_safra.json/.csv

    Note over Dev,Out: 3. Textura do Solo e CAD (SoilGrids ISRIC 250m) — Sem Cadastro
    Dev->>Soil: Executa extract_soilgrids.py
    Soil->>APIs: GET rest.isric.org/soilgrids/v2.0/properties/query (clay, sand 0-30cm)
    APIs-->>Soil: Valores em g/kg -> converte para % (/ 10.0)
    Soil->>Soil: Classifica: argila>35% -> argiloso(60mm); areia>70% -> arenoso(40mm); senão medio(50mm)
    Soil->>Out: Salva soilgrids_talhao.json

    Note over Dev,Out: 4. Histórico de 10 Anos do Talhão (MODIS NDVI via Google Earth Engine)
    Dev->>GeeNdvi: Executa extract_gee_ndvi.py (GEE_PROJECT_ID)
    GeeNdvi->>APIs: ee.ImageCollection("MODIS/061/MOD13Q1").select("NDVI").getRegion(ponto, 250)
    APIs-->>GeeNdvi: Série 16 dias (2015–2025) -> aplica fator * 0.0001
    GeeNdvi->>GeeNdvi: Avalia mar–mai: NDVI < 0.38 -> 'Pousio' | NDVI >= 0.38 -> 'Segunda Safra'
    GeeNdvi->>Out: Salva modis_ndvi_historico_10anos.json/.csv

    Note over Dev,Out: 5. Projeções Climáticas 2041–2060 (NEX-GDDP-CMIP6 via Google Earth Engine)
    Dev->>GeeCmip: Executa extract_gee_cmip6.py (SSP2-4.5)
    GeeCmip->>APIs: ee.ImageCollection("NASA/GDDP-CMIP6").select(["pr", "tasmax"]).getRegion(ponto, 27830)
    APIs-->>GeeCmip: pr (kg/m²/s * 86400 -> mm/dia) e tasmax (K - 273.15 -> °C)
    GeeCmip->>GeeCmip: Calcula delta_climatico_safrinha (-12.5% chuva, +1.8°C, +6.4 dias >=35°C)
    GeeCmip->>Out: Salva cmip6_projecao_2050.json
```

---

## 2. Fazenda de Exemplo Instantânea — Tela 1 para Tela 5 (`GET /api/exemplo`)

Atende à história **US-11 (Jurado)** e ao requisito **RF-11**: serve imediatamente a resposta consolidada a partir dos arquivos reais já extraídos para Uberlândia em [`/workspace/data/output/`](file:///workspace/data/output).

```mermaid
sequenceDiagram
    autonumber
    actor User as Jurado / Produtor
    participant UI as Frontend (Tela 1 -> Tela 5)
    participant Ctrl as RecomendacaoController
    participant Repo as DataOutputClimateRepository
    participant Files as /data/output/* (Uberlândia -18.9543, -48.1993)

    User->>UI: Toca em "Ver um exemplo pronto" (Tela 1)
    UI->>Ctrl: GET /api/exemplo (Header Accept-Language: pt-BR | en)
    Ctrl->>Repo: load_uberlandia_example(lang)
    Repo->>Files: Lê dados pré-extraídos de Uberlândia em /data/output/
    Files-->>Repo: Histórico 20 anos + Solo + NDVI 10 anos + CMIP6 + Recomendação
    Repo-->>Ctrl: ExemploResponse
    Ctrl-->>UI: HTTP 200 OK (~15 KB, gzip, < 50 ms)
    UI-->>User: Renderiza direto a Tela 5 (A Resposta) sem esperar rede externa
```

---

## 3. Marcação do Talhão e Descoberta por Satélite — Tela 2 para Telas 3 e 4 (`GET /api/talhao`)

Atende às histórias **US-01**, **US-02** e **US-07** (RF-01, RF-02, RF-08, RF-16), combinando o cache no PostGIS com a lógica implementada em [`extract_soilgrids.py`](file:///workspace/data/extract_soilgrids.py) e [`extract_gee_ndvi.py`](file:///workspace/data/extract_gee_ndvi.py):

```mermaid
sequenceDiagram
    autonumber
    actor Produtor as Produtor (Marcelo)
    participant UI as Frontend (Telas 2, 3 e 4)
    participant Ctrl as TalhaoController
    participant Svc as TalhaoService
    participant SoilRepo as CachedSoilGridsRepository
    participant NdviRepo as CachedEarthEngineNdviRepository
    participant HistSvc as FieldHistoryService
    participant DB as PostGIS / /data/output/
    participant Ext as SoilGrids API & Google Earth Engine

    Produtor->>UI: Marca ponto no mapa ou GPS e toca em "É aqui" (Tela 2)
    UI->>Ctrl: GET /api/talhao?lat=-18.9543&lon=-48.1993
    UI-->>Produtor: Avança imediatamente para a Tela 3 (Pergunta 2/2)

    Ctrl->>Svc: inspect_talhao(lat, lon)

    par Obtém Textura do Solo e CAD (extract_soilgrids.py)
        Svc->>SoilRepo: get_soil(lat, lon)
        SoilRepo->>DB: Verifica cache em soil_point / soilgrids_talhao.json
        alt Não está em cache
            SoilRepo->>Ext: GET SoilGrids v2.0 (clay, sand 0-30cm)
            alt Sucesso na resposta
                Ext-->>SoilRepo: argila_percentual, areia_percentual
                SoilRepo->>SoilRepo: Define textura_solo ('arenoso'|'medio'|'argiloso') e cad_mm (40|50|60)
                SoilRepo->>DB: Salva no cache
            else Falha ou Timeout
                SoilRepo->>SoilRepo: Fallback: textura_solo='medio', cad_mm=50.0, fonte='padrao'
            end
        end
        SoilRepo-->>Svc: SoloInfo(textura_solo, cad_capacidade_agua_mm, fonte)
    and Obtém Histórico de 10 Anos de NDVI (extract_gee_ndvi.py)
        Svc->>NdviRepo: get_ndvi_history(lat, lon)
        NdviRepo->>DB: Verifica cache em ndvi_point / modis_ndvi_historico_10anos.json
        alt Não está em cache
            NdviRepo->>Ext: ee.ImageCollection("MODIS/061/MOD13Q1").select("NDVI").getRegion(ponto, 250)
            Ext-->>NdviRepo: Série 2015–2025 -> multiplica por 0.0001
            NdviRepo->>DB: Salva no cache
        end
        NdviRepo-->>Svc: serie_ndvi
    end

    Svc->>HistSvc: classify_entressafra(serie_ndvi)
    HistSvc->>HistSvc: Calcula NDVI na entressafra -> classifica cada ano em Pousio ('parado') ou Segunda Safra ('plantou')
    HistSvc-->>Svc: HistoricoTalhao (anos, parado, total)

    Svc->>HistSvc: suggest_harvest_band(serie_ndvi)
    HistSvc->>HistSvc: Detecta queda de NDVI <50% do pico de verão (jan–mar) -> mediana ('cedo'|'meio'|'tarde')
    HistSvc-->>Svc: ColheitaSugerida(faixa, fonte)

    Svc-->>Ctrl: Talhao completo
    Ctrl-->>UI: HTTP 200 OK (TalhaoResponse)
    UI-->>Produtor: Pré-seleciona faixa sugerida na Tela 3 e popula cartões da Tela 4 ("O satélite já viu o resto")
```

---

## 4. Cálculo da Recomendação, Alternativas e Plano de 3 Anos — Tela 3/4 para Telas 5, 6 e 7 (`GET /api/recomendacao`)

Atende às histórias **US-03 a US-06, US-08 e US-09**, operando sobre os parâmetros de [`/workspace/data/culturas.yaml`](file:///workspace/data/culturas.yaml) e as variáveis extraídas em [`/workspace/data/output/`](file:///workspace/data/output):

```mermaid
sequenceDiagram
    autonumber
    actor Produtor as Produtor / Agrônoma
    participant UI as Frontend (Telas 4, 5, 6 e 7)
    participant Ctrl as RecomendacaoController
    participant RecSvc as RecommendationService
    participant CropRepo as YamlCropParamsRepository (/data/culturas.yaml)
    participant ClimRepo as ClimateRepository (PostGIS / /data/output/)
    participant RiskSvc as ClimateRiskService
    participant WB as WaterBalanceCalculator
    participant PlanSvc as RotationPlanService

    Produtor->>UI: Confirma faixa de colheita (cedo | meio | tarde) e toca em ver recomendação
    UI->>Ctrl: GET /api/recomendacao?lat=-18.9543&lon=-48.1993&colheita=meio[&solo=argiloso][&nematoide=sim]

    Ctrl->>RecSvc: recommend(lat, lon, colheita, solo_override, nematoide, lang)
    RecSvc->>CropRepo: list_all() (lê /data/culturas.yaml)
    CropRepo-->>RecSvc: 6 culturas (pousio, milho_safrinha, sorgo_granifero, milho_braquiaria, milheto, crotalaria_spectabilis)

    RecSvc->>ClimRepo: get_seasons(), get_latest_smap() & get_cmip6_delta()
    ClimRepo-->>RecSvc: 20 anos NASA POWER (PRECTOTCORR, T2M_MAX, T2M_MIN, T2M, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT) + SMAP (sm_rootzone_wetness) + CMIP6 (delta_climatico_safrinha)

    Note over RecSvc,WB: Semeadura = colheita + 3 dias (cedo=08/fev, meio=18/fev, tarde=03/mar)

    loop Para cada uma das 5 opções plantáveis (Pousio é separado como linha de base)
        RecSvc->>RiskSvc: is_within_window(crop.semeadura_limite_mes_dia, semeadura)
        alt Dentro da janela (ex.: 18/fev <= 02-28 para milho_safrinha)
            RecSvc->>RiskSvc: simulate_historical(crop, seasons, semeadura, cad_mm, sm_rootzone_wetness)
            loop Para cada um dos 20 anos (2005–2024)
                RiskSvc->>WB: calculate_eto_fao(T2M_MAX, T2M_MIN, T2M, ALLSKY_SFC_SW_DWN, WS2M, RH2M)
                WB-->>RiskSvc: eto_diaria (mm/dia)
                RiskSvc->>WB: simular(PRECTOTCORR, eto_diaria, kc_curva, cad_mm, arm0)
                WB-->>RiskSvc: etr_l, etc_l
                RiskSvc->>WB: isna(etr_l, etc_l, ini_crit, fim_crit)
                WB-->>RiskSvc: isna_janela_critica
                RiskSvc->>RiskSvc: Aperto se ISNA < 0.55 (grão/consórcio) ou < 0.50 (cobertura 30d) OU >=3 dias T2M_MAX >= 35°C
            end
            RiskSvc-->>RecSvc: Resultado dos 20 anos (anos_bons, faixa booleana, fator_perda)

            RecSvc->>RiskSvc: simulate_future_cmip6(crop, seasons, cmip6_delta, semeadura, cad_mm)
            RiskSvc->>RiskSvc: Aplica delta CMIP6 SSP2-4.5 (chuva -12.5%, Tmax +1.8°C) e recalcula anos bons em 2041–2060
            RiskSvc-->>RecSvc: futuro (anos_bons_media, min, max)

            RecSvc->>RecSvc: Calcula Notas (Segurança, Futuro, Solo [palhada_score + n_deixado_kg + nematoide_efeito], Renda)
            RecSvc->>RecSvc: Define rótulos (bom | medio | fraco) e monta frases "porque" citando NASA POWER, SMAP e CMIP6
        else Fora da janela (ex.: semeadura 03/mar > limite 02-28)
            RecSvc->>RecSvc: Move opção para fora_da_janela
        end
    end

    RecSvc->>RecSvc: Define 'melhor' (maior nota final ponderada: 30% seg, 25% solo, 30% renda, 15% futuro)
    RecSvc->>RecSvc: Define 'alternativas' (menos_risco, mais_dinheiro, cuidar_da_terra sem repetir a 'melhor')

    RecSvc->>PlanSvc: build_3_year_plans(opcoes, seasons, nematoide)
    PlanSvc->>PlanSvc: Avalia 216 sequências trienais + bônus de diversidade (+5/+10) e filtro de nematoide
    PlanSvc->>PlanSvc: Cenário 'normal' (20 anos) vs Cenário 'seco' (4 anos de menor chuva_safrinha_fev_mai_mm: 2007, 2010, 2012, 2014)
    PlanSvc-->>RecSvc: plano_normal, plano_seco, plano_hoje

    RecSvc-->>Ctrl: Recomendacao completa
    Ctrl-->>UI: HTTP 200 OK (RecomendacaoResponse + Cache-Control + GZip)
    UI-->>Produtor: Renderiza Tela 5 (A Resposta), Tela 6 (Todas as opções) e Tela 7 (Plano de 3 anos)
```

---

## 5. Interações Locais no Navegador — Telas 5, 6 e 7 (Zero Latência de Rede)

Atende aos requisitos **RNF-02** (reordenação instantânea no navegador) e **RF-17 / US-12** (botão *"Ouvir"*):

```mermaid
sequenceDiagram
    autonumber
    actor Produtor as Produtor (Marcelo)
    participant UI as Frontend React (Estado em Memória)
    participant Speech as Web Speech API (Navegador pt-BR / en-US)

    Note over Produtor,UI: O payload de GET /api/recomendacao já está em memória no cliente

    Produtor->>UI: Toca no botão "Ouvir" (US-12)
    UI->>Speech: window.speechSynthesis.speak(Utterance(texto_da_tela))
    Speech-->>Produtor: Lê em voz alta a recomendação, rótulos e explicação

    Produtor->>UI: Na Tela 6 ("Todas as opções"), seleciona ordenar por "Chuva" | "Dinheiro" | "Terra"
    UI->>UI: Ordena array `opcoes` localmente (< 10 ms, sem requisição HTTP)
    UI-->>Produtor: Atualiza cartões comparativos na hora

    Produtor->>UI: Na Tela 7 ("Plano de 3 anos"), alterna entre "Ano normal" e "Ano seco"
    UI->>UI: Alterna exibição entre `plano_3_anos.normal` e `plano_3_anos.seco`
    UI-->>Produtor: Exibe a rotação de 3 anos correspondente instantaneamente
```

---

## 6. Listagem de Opções de Cultura e Tradução de Erros (`GET /api/crop-options`)

Mostra o fluxo já implementado em [`app/controllers/crop_option_controller.py`](file:///workspace/projeto/backend/app/controllers/crop_option_controller.py) e a captura de [`NotFoundError`](file:///workspace/projeto/backend/app/services/errors.py#L5-L6) em [`app/main.py`](file:///workspace/projeto/backend/app/main.py#L23-L25):

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Frontend / Consumidor API
    participant Main as app/main.py (Exception Handler)
    participant Ctrl as CropOptionController
    participant Svc as CropOptionService
    participant Repo as CropOptionRepository (InMemory / culturas.yaml)

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
    else Opção não encontrada
        Repo-->>Svc: None
        Svc-->>Main: raise NotFoundError("Opção de entressafra '...' não encontrada")
        Main->>Main: handle_not_found() -> status_code=404
        Main-->>Cliente: HTTP 404 Not Found {"detail": "Opção de entressafra '...' não encontrada"}
    end
```
