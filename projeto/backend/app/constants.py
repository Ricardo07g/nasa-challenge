"""Domain, agronomic, and spatial constants for the Raiz Orbital backend.

Os limiares, pesos e frases do motor de pontuação (PRD 7) ficam em `app/config_data/regras.yaml`,
lidos pelo `YamlRulesRepository`. Não volte a colocá-los aqui.
"""

from typing import Final

# Spatial & Bounding Box Constants (ADR-0003: Triangulo Mineiro Pilot Area)
DEFAULT_SRID: Final[int] = 4326
PILOT_MIN_LAT: Final[float] = -19.9
PILOT_MAX_LAT: Final[float] = -18.4
PILOT_MIN_LON: Final[float] = -49.0
PILOT_MAX_LON: Final[float] = -47.5
GRID_CELL_RESOLUTION_DEG: Final[float] = 0.1
GRID_CELL_SCALE_FACTOR: Final[int] = 10
POINT_CACHE_STEP_DEG: Final[float] = 0.0025  # chave dos caches por ponto (~250 m)
# Série de NDVI: usa o ponto do arquivo mais perto do talhão, se estiver a no máximo um pixel do
# MOD13Q1 (250 m). Mais longe que isso já é outro pixel, e o /talhao responde `historico: null`.
NDVI_POINT_MAX_DISTANCE_M: Final[float] = 250.0
EARTH_RADIUS_M: Final[float] = 6_371_000.0

# Fazenda de exemplo (plano técnico §3.3): campo de soja de 48 ha da Fazenda Experimental do
# Glória (UFU), Uberlândia. O ponto antigo (-18,92 / -48,28) caía perto do centro urbano.
EXAMPLE_FARM_LAT: Final[float] = -18.9543
EXAMPLE_FARM_LON: Final[float] = -48.1993
EXAMPLE_FARM_HARVEST: Final[str] = "meio"

# Canonical Crop Identifiers & Alias Normalization (ADR-0001)
CROP_ID_ALIASES: Final[dict[str, str]] = {
    "pousio": "pousio",
    "milho_safrinha": "milho_safrinha",
    "milho-safrinha": "milho_safrinha",
    "sorgo": "sorgo",
    "sorgo_granifero": "sorgo",
    "sorgo-granifero": "sorgo",
    "milho_braquiaria": "milho_braquiaria",
    "milho-braquiaria": "milho_braquiaria",
    "milheto": "milheto",
    "crotalaria": "crotalaria",
    "crotalaria_spectabilis": "crotalaria",
    "crotalaria-spectabilis": "crotalaria",
}

# Soil Texture & Available Water Capacity (CAD) Thresholds (US-01)
CLAY_THRESHOLD_PCT: Final[float] = 35.0
SAND_THRESHOLD_PCT: Final[float] = 70.0
CAD_CLAYEY_MM: Final[float] = 60.0
CAD_MEDIUM_MM: Final[float] = 50.0
CAD_SANDY_MM: Final[float] = 40.0
DEFAULT_CLAY_PCT: Final[float] = 28.0
DEFAULT_SAND_PCT: Final[float] = 45.0

SOIL_CAD_BY_TEXTURE: Final[dict[str, float]] = {
    "argiloso": CAD_CLAYEY_MM,
    "medio": CAD_MEDIUM_MM,
    "arenoso": CAD_SANDY_MM,
}

# MODIS NDVI Scale & Harvest Band Constants (US-02, US-07, ADR-0002)
# Limiares do NDVI (plantou/parado, queda da soja, meses da entressafra): regras.yaml, grupo ndvi
NDVI_SCALE_FACTOR: Final[float] = 0.0001
MIN_NDVI_YEARS_FOR_SUGGESTION: Final[int] = 5
EARLY_HARVEST_DOY_LIMIT: Final[int] = 41  # Feb 10
MID_HARVEST_DOY_LIMIT: Final[int] = 53  # Feb 22

# Reference Year & Sowing Dates by Harvest Band (US-02: harvest + 3 days)
REFERENCE_SOWING_YEAR: Final[int] = 2027
SOWING_MONTH_DAY_BY_HARVEST: Final[dict[str, tuple[int, int]]] = {
    "cedo": (2, 8),  # Harvest Feb 05 -> Sowing Feb 08
    "meio": (2, 18),  # Harvest Feb 15 -> Sowing Feb 18
    "tarde": (3, 3),  # Harvest Feb 28 -> Sowing Mar 03
}

# Water Balance & FAO-56 Constants (US-03)
DEFAULT_INITIAL_ARM_FRACTION: Final[float] = 0.50
KC_INITIAL_DEFAULT: Final[float] = 0.35
KC_END_DEFAULT: Final[float] = 0.50
KC_INITIAL_STAGE_FRACTION: Final[float] = 0.20
KC_DEV_STAGE_FRACTION: Final[float] = 0.45
KC_MID_STAGE_FRACTION: Final[float] = 0.75
SOLAR_CONSTANT_MJ_M2_MIN: Final[float] = 0.0820  # FAO-56, Gsc
MJ_TO_MM_EVAPORATION: Final[float] = 0.408  # FAO-56: 1 MJ/m² evapora 0,408 mm
MAX_DAILY_ETO_MM: Final[float] = 10.0
EXAMPLE_CELL_ID: Final[str] = "-189_-483"

# Balde inicial: piso de 20% da CAD quando o SMAP vier muito seco (US-03)
# ISNA, janelas críticas, calor e perda pelo ISNA: regras.yaml, grupo clima
MIN_INITIAL_ARM_FRACTION: Final[float] = 0.20

PERCENT_DIVISOR: Final[float] = 100.0

# Escala das notas. Pesos, rótulos, nota de solo e bônus: regras.yaml (nota_final, rotulos, solo)
SCORE_MIN: Final[float] = 0.0
SCORE_MAX: Final[float] = 100.0

# 3-Year Rotation Plan (US-06, US-09). Anos secos, pousio, bônus e supressoras: regras.yaml, rotacao
ROTATION_HORIZON_YEARS: Final[int] = 3

# Data Versioning & Problem Details (RFC 7807)
DATA_VERSION: Final[str] = "2026.11-nasa-power-20y"
PROBLEM_JSON_MEDIA_TYPE: Final[str] = "application/problem+json"
PROBLEM_BASE_URI: Final[str] = "https://api.raizorbital.com/errors"

# External Satellite APIs & On-Demand Ingestion Constants (Task 0001)
NASA_POWER_DAILY_POINT_URL: Final[str] = "https://power.larc.nasa.gov/api/temporal/daily/point"
NASA_POWER_COMMUNITY: Final[str] = "AG"
NASA_POWER_PARAMETERS: Final[str] = "PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M,WS2M,ALLSKY_SFC_SW_DWN"
NASA_POWER_MISSING_SENTINEL: Final[float] = -999.0
HISTORICAL_START_YEAR: Final[int] = 2005
HISTORICAL_END_YEAR: Final[int] = 2024
# Temporada de clima: 212 dias a partir de 1/jan (1/jan a 31/jul; em ano bissexto, a 30/jul),
# igual à fixture (pipeline/export_climate_fixture.py) e à tabela climate_season (plano técnico §5)
CLIMATE_SEASON_DAYS: Final[int] = 212

SOILGRIDS_QUERY_URL: Final[str] = "https://rest.isric.org/soilgrids/v2.0/properties/query"
SOILGRIDS_DEPTHS: Final[tuple[str, ...]] = ("0-5cm", "5-15cm", "15-30cm")
SOILGRIDS_PROPERTIES: Final[tuple[str, ...]] = ("clay", "sand")
SOILGRIDS_G_KG_TO_PCT_DIVISOR: Final[float] = 10.0

EXTERNAL_API_TIMEOUT_SECONDS: Final[float] = 8.0
INGESTION_TOTAL_TIMEOUT_SECONDS: Final[float] = 9.0
EXTERNAL_API_MAX_RETRIES: Final[int] = 2
EXTERNAL_API_BACKOFF_BASE_SECONDS: Final[float] = 0.05
GRID_CELL_HALF_SIZE_DEG: Final[float] = 0.05
SOIL_POINT_ROUND_DECIMALS: Final[int] = 3
INGESTION_WORKERS_COUNT: Final[int] = 2
