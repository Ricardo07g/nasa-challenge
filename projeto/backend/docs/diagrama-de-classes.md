# Diagrama de Classes e Modelo de Dados — Raiz Orbital (Backend)

Este documento apresenta os **Diagramas de Classes (UML)** e o **Diagrama Entidade-Relacionamento (PostGIS)** do backend do **Raiz Orbital**, seguindo rigorosamente a arquitetura **MVC + Service/Repository** definida em `AGENTS.md` e no `Raiz Orbital – plano técnico do backend.md`.

---

## 1. Direção das Dependências e Regras de Camada

A arquitetura garante que regras de negócio fiquem **100% isoladas nos Services** (puro Python, testáveis via TDD com *fakes* sem banco ou rede) e que todo acesso externo fique confinado nos **Repositories** através de contratos (`typing.Protocol`).

```mermaid
flowchart LR
    subgraph View ["View (app/schemas/)"]
        S["Schemas Pydantic<br/>(JSON HTTP)"]
    end
    subgraph Controller ["Controller (app/controllers/)"]
        C["Rotas FastAPI<br/>(Finas, sem regra)"]
    end
    subgraph Service ["Service (app/services/)"]
        SV["Regras de Negócio<br/>(Motor, ISNA, Ranking)"]
    end
    subgraph Repository ["Repository (app/repositories/)"]
        RP["Protocols & Implementações<br/>(Acesso a Dados)"]
    end
    subgraph Model ["Model (app/models/)"]
        M["Dataclasses Imutáveis<br/>(Domínio)"]
    end
    subgraph Data ["Fontes de Dados"]
        DB[("PostGIS 17<br/>(Séries, Deltas, Cache)")]
        YAML["culturas.yaml<br/>regras.yaml"]
        EXT["APIs Externas<br/>(Earth Engine / SoilGrids)"]
    end

    S <-- "converte" --- C
    C -- "Depends()" --> SV
    SV -- "depende do Protocol" --> RP
    SV -. "manipula" .-> M
    RP -. "instancia" .-> M
    RP --> DB
    RP --> YAML
    RP --> EXT
```

---

## 2. Diagrama de Classes — Camada de Domínio (`app/models/`)

Todas as entidades de domínio são `@dataclass(frozen=True)` puras, sem acoplamento com FastAPI, Pydantic ou drivers de banco de dados.

```mermaid
classDiagram
    direction TB

    class CropOption {
        <<dataclass>>
        +str id
        +str name
        +str role
    }

    class CropParams {
        <<dataclass>>
        +str id
        +str nome
        +str funcao
        +str limite_semeadura_mm_dd
        +int dias_florescimento
        +int ciclo_dias
        +float kc_inicial
        +float kc_pico
        +float kc_final
        +int nota_palhada
        +int nota_nitrogenio
        +int nota_pragas
        +float produtividade_sc_ha
        +float preco_saca_brl
        +float custo_ha_brl
        +tuple~str~ como_fazer
    }

    class ClimateSeason {
        <<dataclass>>
        +str cell_id
        +int year
        +date start_date
        +tuple~float~ rain_mm
        +str rain_source
        +tuple~float~ tmax_c
        +tuple~float~ tmin_c
        +tuple~float~ eto_mm
    }

    class Cmip6Delta {
        <<dataclass>>
        +str cell_id
        +str model
        +str scenario
        +int month
        +float rain_pct
        +float tmax_c
    }

    class Ponto {
        <<dataclass>>
        +float lat
        +float lon
    }

    class SoloInfo {
        <<dataclass>>
        +str textura
        +float cad_mm
        +str fonte
        +float clay_pct
        +float sand_pct
    }

    class HistoricoAno {
        <<dataclass>>
        +int ano
        +str situacao
        +float ndvi_max
    }

    class HistoricoTalhao {
        <<dataclass>>
        +tuple~HistoricoAno~ anos
        +int parado
        +int total
        +str fonte
    }

    class ColheitaSugerida {
        <<dataclass>>
        +str faixa
        +str fonte
        +int anos_usados
    }

    class Talhao {
        <<dataclass>>
        +Ponto ponto
        +str celula_id
        +bool dentro_da_area
        +SoloInfo solo
        +ColheitaSugerida colheita_sugerida
        +HistoricoTalhao historico
        +tuple~dict~ dados_fontes
    }

    class ResultadoAno {
        <<dataclass>>
        +int ano
        +bool aperto
        +float isna
        +int dias_calor
        +float fator_perda
    }

    class NotasOpcao {
        <<dataclass>>
        +float seguranca
        +float futuro
        +float solo
        +float renda
        +float final
    }

    class ResultadoOpcao {
        <<dataclass>>
        +str id
        +str nome
        +bool na_janela
        +int anos_bons_chuva
        +int total_anos
        +tuple~bool~ faixa_anos
        +str rotulo_chuva
        +str texto_chuva
        +int futuro_anos_bons_media
        +int futuro_anos_bons_min
        +int futuro_anos_bons_max
        +float margem_ha
        +str rotulo_dinheiro
        +str texto_dinheiro
        +str rotulo_terra
        +str texto_terra
        +NotasOpcao notas
        +tuple~str~ porque
        +tuple~str~ como_fazer
    }

    class Alternativa {
        <<dataclass>>
        +str motivo
        +str opcao_id
    }

    class PlanoRotacao {
        <<dataclass>>
        +tuple~str~ anos
        +float nota
        +str descricao
    }

    class Recomendacao {
        <<dataclass>>
        +str celula_id
        +str colheita
        +date semeadura
        +str solo
        +str nematoide
        +str melhor
        +tuple~Alternativa~ alternativas
        +tuple~ResultadoOpcao~ opcoes
        +tuple~ResultadoOpcao~ fora_da_janela
        +str texto_pousio
        +PlanoRotacao plano_normal
        +PlanoRotacao plano_seco
        +PlanoRotacao plano_hoje
        +str versao_dados
        +str aviso
    }

    Talhao *-- Ponto
    Talhao *-- SoloInfo
    Talhao *-- ColheitaSugerida
    Talhao *-- HistoricoTalhao
    HistoricoTalhao *-- HistoricoAno
    Recomendacao *-- ResultadoOpcao
    Recomendacao *-- Alternativa
    Recomendacao *-- PlanoRotacao
    ResultadoOpcao *-- NotasOpcao
```

---

## 3. Diagrama de Classes — Camada Repository (`app/repositories/`)

Cada fonte de dados possui um contrato em `Protocol` e uma ou mais implementações concretas (PostGIS, YAML, InMemory, Fixture ou cliente HTTP/Earth Engine com cache).

```mermaid
classDiagram
    direction TB

    class CropOptionRepository {
        <<Protocol>>
        +list_all() list~CropOption~
        +get_by_id(option_id: str) CropOption | None
    }

    class InMemoryCropOptionRepository {
        -list~CropOption~ _options
        +list_all() list~CropOption~
        +get_by_id(option_id: str) CropOption | None
    }

    class CropParamsRepository {
        <<Protocol>>
        +list_all() list~CropParams~
        +get_by_id(crop_id: str) CropParams | None
    }

    class YamlCropParamsRepository {
        -Path _yaml_path
        +list_all() list~CropParams~
        +get_by_id(crop_id: str) CropParams | None
    }

    class RulesRepository {
        <<Protocol>>
        +get_harvest_date(faixa: str, year: int) date
        +get_soil_cad(textura: str) float
        +get_weights() dict~str, float~
        +format_explanation(key: str, lang: str, **kwargs) str
    }

    class YamlRulesRepository {
        -Path _yaml_path
        +get_harvest_date(faixa: str, year: int) date
        +get_soil_cad(textura: str) float
        +get_weights() dict~str, float~
        +format_explanation(key: str, lang: str, **kwargs) str
    }

    class ClimateRepository {
        <<Protocol>>
        +find_cell_id(lat: float, lon: float) str | None
        +get_seasons(cell_id: str) list~ClimateSeason~
        +get_cmip6_deltas(cell_id: str, scenario: str) list~Cmip6Delta~
        +get_latest_data_version() str
    }

    class PostgisClimateRepository {
        -str _database_url
        +find_cell_id(lat: float, lon: float) str | None
        +get_seasons(cell_id: str) list~ClimateSeason~
        +get_cmip6_deltas(cell_id: str, scenario: str) list~Cmip6Delta~
        +get_latest_data_version() str
    }

    class FixtureClimateRepository {
        -Path _fixture_path
        +find_cell_id(lat: float, lon: float) str | None
        +get_seasons(cell_id: str) list~ClimateSeason~
        +get_cmip6_deltas(cell_id: str, scenario: str) list~Cmip6Delta~
        +get_latest_data_version() str
    }

    class SoilRepository {
        <<Protocol>>
        +get_soil(lat: float, lon: float) SoloInfo
    }

    class CachedSoilGridsRepository {
        -str _database_url
        -float _timeout_s
        +get_soil(lat: float, lon: float) SoloInfo
        -_fetch_from_soilgrids(lat: float, lon: float) SoloInfo | None
    }

    class NdviRepository {
        <<Protocol>>
        +get_ndvi_series(lat: float, lon: float) list~tuple~date, float~~
    }

    class CachedEarthEngineNdviRepository {
        -str _database_url
        -str _ee_project
        -float _timeout_s
        +get_ndvi_series(lat: float, lon: float) list~tuple~date, float~~
        -_fetch_from_gee(lat: float, lon: float) list~tuple~date, float~~
    }

    CropOptionRepository <|.. InMemoryCropOptionRepository
    CropParamsRepository <|.. YamlCropParamsRepository
    RulesRepository <|.. YamlRulesRepository
    ClimateRepository <|.. PostgisClimateRepository
    ClimateRepository <|.. FixtureClimateRepository
    SoilRepository <|.. CachedSoilGridsRepository
    NdviRepository <|.. CachedEarthEngineNdviRepository
```

---

## 4. Diagrama de Classes — Camada Service (`app/services/`)

Os Services encapsulam todo o motor biofísico e agronômico (FAO-56, ISNA, risco de calor, deltas do CMIP6, classificação de NDVI e planos de rotação trienal).

```mermaid
classDiagram
    direction TB

    class DomainError {
        <<Exception>>
    }

    class NotFoundError {
        <<Exception>>
    }

    class CropOptionService {
        -CropOptionRepository _repository
        +list_options() list~CropOption~
        +get_option(option_id: str) CropOption
    }

    class WaterBalanceCalculator {
        <<Pure Functions>>
        +simular(chuva: Sequence~float~, eto: Sequence~float~, kc: Sequence~float~, cad: float, arm0: float | None) tuple~list~float~, list~float~~
        +isna(etr_l: Sequence~float~, etc_l: Sequence~float~, ini: int, fim: int) float
    }

    class ClimateRiskService {
        -WaterBalanceCalculator _wb
        +simulate_historical(crop: CropParams, seasons: list~ClimateSeason~, semeadura: date, cad_mm: float) list~ResultadoAno~
        +simulate_future_cmip6(crop: CropParams, seasons: list~ClimateSeason~, deltas: list~Cmip6Delta~, semeadura: date, cad_mm: float) tuple~int, int, int~
        +is_within_window(crop: CropParams, semeadura: date) bool
    }

    class FieldHistoryService {
        +classify_entressafra(ndvi_series: list~tuple~date, float~~) HistoricoTalhao
        +suggest_harvest_band(ndvi_series: list~tuple~date, float~~) ColheitaSugerida
    }

    class RotationPlanService {
        +build_3_year_plans(opcoes: list~ResultadoOpcao~, seasons: list~ClimateSeason~, nematoide: str | None) tuple~PlanoRotacao, PlanoRotacao, PlanoRotacao~
        -_score_sequence(seq: tuple~CropParams, CropParams, CropParams~, notes_by_id: dict) float
        -_diversity_bonus(seq: tuple~CropParams, CropParams, CropParams~) float
    }

    class TalhaoService {
        -ClimateRepository _climate_repo
        -SoilRepository _soil_repo
        -NdviRepository _ndvi_repo
        -FieldHistoryService _history_service
        +inspect_talhao(lat: float, lon: float) Talhao
    }

    class RecommendationService {
        -CropParamsRepository _crop_repo
        -RulesRepository _rules_repo
        -ClimateRepository _climate_repo
        -SoilRepository _soil_repo
        -ClimateRiskService _risk_service
        -RotationPlanService _plan_service
        +recommend(lat: float, lon: float, colheita: str, solo_override: str | None, nematoide: str | None, lang: str) Recomendacao
    }

    DomainError <|-- NotFoundError
    CropOptionService ..> NotFoundError : lança
    ClimateRiskService --> WaterBalanceCalculator : usa
    TalhaoService --> FieldHistoryService : usa
    RecommendationService --> ClimateRiskService : usa
    RecommendationService --> RotationPlanService : usa
```

---

## 5. Diagrama de Classes — Controllers, Schemas e Configuração (`app/controllers/`, `app/schemas/`, `app/config.py`)

```mermaid
classDiagram
    direction TB

    class Settings {
        +str app_name
        +str environment
        +list~str~ cors_origins
        +str | None database_url
        +str | None earthdata_username
        +str | None earthdata_password
        +str | None ee_project
    }

    class HealthController {
        +get_health() dict
    }

    class CropOptionController {
        +list_crop_options(service: CropOptionService) list~CropOptionResponse~
        +get_crop_option(option_id: str, service: CropOptionService) CropOptionResponse
    }

    class TalhaoController {
        +get_talhao(lat: float, lon: float, service: TalhaoService) TalhaoResponse
    }

    class RecomendacaoController {
        +get_recomendacao(lat: float, lon: float, colheita: str, solo: str | None, nematoide: str | None, accept_language: str, service: RecommendationService) RecomendacaoResponse
        +get_exemplo(accept_language: str) ExemploResponse
    }

    class CropOptionResponse {
        <<Pydantic BaseModel>>
        +str id
        +str name
        +str role
        +from_model(option: CropOption)$ CropOptionResponse
    }

    class TalhaoResponse {
        <<Pydantic BaseModel>>
        +PontoSchema ponto
        +str | None celula_id
        +bool dentro_da_area
        +SoloSchema solo
        +ColheitaSugeridaSchema colheita_sugerida
        +HistoricoSchema | None historico
        +list~FonteDadoSchema~ dados
        +from_model(talhao: Talhao)$ TalhaoResponse
    }

    class RecomendacaoResponse {
        <<Pydantic BaseModel>>
        +EntradaSchema entrada
        +str melhor
        +list~AlternativaSchema~ alternativas
        +list~OpcaoSchema~ opcoes
        +list~OpcaoSchema~ fora_da_janela
        +PousioSchema pousio
        +Plano3AnosSchema plano_3_anos
        +str versao_dados
        +str aviso
        +from_model(rec: Recomendacao)$ RecomendacaoResponse
    }

    CropOptionController --> CropOptionService : Depends
    CropOptionController --> CropOptionResponse : retorna
    TalhaoController --> TalhaoService : Depends
    TalhaoController --> TalhaoResponse : retorna
    RecomendacaoController --> RecommendationService : Depends
    RecomendacaoController --> RecomendacaoResponse : retorna
```

---

## 6. Diagrama Entidade-Relacionamento — Banco de Dados (`PostGIS 17`)

O esquema relacional-espacial armazena a grade de 0,1° do Triângulo Mineiro, as séries diárias da entressafra (1/jan a 31/jul = 212 dias) compactadas em *arrays* nativos do PostgreSQL (`real[]`) para leitura em consulta única, os deltas mensais do CMIP6 e os caches por ponto (250 m) do SoilGrids e do MODIS NDVI.

```mermaid
erDiagram
    GRID_CELL ||--o{ CLIMATE_SEASON : "possui 20 safras (2006-2025)"
    GRID_CELL ||--o{ CMIP6_DELTA : "possui deltas mensais (2041-2060)"

    GRID_CELL {
        text id PK "Ex: -190_-483"
        geometry_Polygon_4326 geom "Poligono de 0.1 grau"
        geometry_Point_4326 center "Centroide da celula"
    }

    CLIMATE_SEASON {
        text cell_id PK, FK "Ref: grid_cell.id"
        smallint year PK "2006 a 2025"
        date start_date "YYYY-01-01"
        real_array rain_mm "212 dias (1/jan a 31/jul)"
        text rain_source "imerg_final ou power"
        real_array tmax_c "212 dias T2M_MAX"
        real_array tmin_c "212 dias T2M_MIN"
        real_array eto_mm "212 dias ETo FAO-56"
    }

    CMIP6_DELTA {
        text cell_id PK, FK "Ref: grid_cell.id"
        text model PK "Ex: ACCESS-CM2, MIROC6"
        text scenario PK "ssp245"
        smallint month PK "1 a 12"
        real rain_pct "Variacao percentual de chuva"
        real tmax_c "Acrescimo de temperatura (C)"
    }

    SOIL_POINT {
        text key PK "Lat/Lon arredondado a 0.0025 grau (~250m)"
        geometry_Point_4326 geom "Ponto WGS84"
        real clay_pct "Argila 0-30cm (%)"
        real sand_pct "Areia 0-30cm (%)"
        text texture "arenoso | medio | argiloso"
        timestamptz fetched_at "Data do cache"
    }

    NDVI_POINT {
        text key PK "Lat/Lon arredondado a 0.0025 grau (~250m)"
        date date PK "Data da imagem MODIS (16 dias)"
        real ndvi "NDVI reescalado (* 0.0001)"
    }

    DATA_RUN {
        serial id PK "Identificador da carga"
        text source "power | imerg | cmip6"
        jsonb params "Parametros e bbox da execucao"
        timestamptz finished_at "Timestamp para versao_dados"
    }
```
