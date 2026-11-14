-- ==============================================================================
-- Raiz Orbital — DDL Inicial do Banco de Dados (PostgreSQL 17 + PostGIS 3.5)
-- Pode ser executado via psql ou montado em /docker-entrypoint-initdb.d/01_init.sql
-- ==============================================================================

-- 1. Habilitar extensão espacial PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Grade espacial de células (0.1 grau ~ 11 km)
CREATE TABLE IF NOT EXISTS grid_cell (
    id TEXT PRIMARY KEY,
    geom geometry(Polygon, 4326) NOT NULL,
    center geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_grid_cell_geom ON grid_cell USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_grid_cell_center ON grid_cell USING GIST (center);

-- 3. Séries históricas de 20 anos da NASA POWER (2005-2024)
CREATE TABLE IF NOT EXISTS climate_season (
    cell_id TEXT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
    year SMALLINT NOT NULL,
    start_date DATE NOT NULL,
    rain_mm REAL[] NOT NULL,
    rain_source TEXT NOT NULL DEFAULT 'nasa_power',
    tmax_c REAL[] NOT NULL,
    tmin_c REAL[] NOT NULL,
    tmean_c REAL[],
    rh2m_pct REAL[],
    ws2m_ms REAL[],
    solar_rad_mj REAL[],
    gwetroot REAL[],
    eto_mm REAL[] NOT NULL,
    PRIMARY KEY (cell_id, year)
);

-- 4. Umidade do solo NASA SMAP L4 (SPL4SMGP)
CREATE TABLE IF NOT EXISTS smap_moisture (
    cell_id TEXT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sm_surface_m3_m3 REAL NOT NULL,
    sm_rootzone_m3_m3 REAL NOT NULL,
    sm_rootzone_wetness REAL NOT NULL,
    PRIMARY KEY (cell_id, date)
);

-- 5. Projeções climáticas NEX-GDDP-CMIP6 2050 (SSP2-4.5)
CREATE TABLE IF NOT EXISTS cmip6_delta (
    cell_id TEXT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
    scenario TEXT NOT NULL DEFAULT 'SSP2-4.5',
    aumento_temperatura_media_c REAL NOT NULL,
    variacao_chuva_safrinha_pct REAL NOT NULL,
    aumento_dias_calor_extremo REAL NOT NULL,
    PRIMARY KEY (cell_id, scenario)
);

-- 6. Cache de Textura do Solo (SoilGrids ISRIC 250m)
CREATE TABLE IF NOT EXISTS soil_point (
    key TEXT PRIMARY KEY,
    geom geometry(Point, 4326) NOT NULL,
    argila_percentual REAL NOT NULL,
    areia_percentual REAL NOT NULL,
    textura_solo TEXT NOT NULL,
    cad_capacidade_agua_mm REAL NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_soil_point_geom ON soil_point USING GIST (geom);

-- 7. Cache de NDVI do Talhão (MODIS MOD13Q1 250m)
CREATE TABLE IF NOT EXISTS ndvi_point (
    key TEXT NOT NULL,
    date DATE NOT NULL,
    ndvi REAL NOT NULL,
    PRIMARY KEY (key, date)
);

-- 8. Log e auditoria de ingestão de dados
CREATE TABLE IF NOT EXISTS data_run (
    id SERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    params JSONB NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
