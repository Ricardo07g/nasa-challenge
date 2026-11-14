"""Domain, agronomic, and spatial constants for the Raiz Orbital backend."""

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

# MODIS NDVI Classification & Harvest Band Constants (US-02, US-07, ADR-0002)
NDVI_SCALE_FACTOR: Final[float] = 0.0001
NDVI_PLANTED_THRESHOLD: Final[float] = 0.60
NDVI_FALLOW_THRESHOLD: Final[float] = 0.45
NDVI_HARVEST_DROP_RATIO: Final[float] = 0.50
OFFSEASON_MONTHS: Final[frozenset[int]] = frozenset({4, 5, 6, 7})  # 1/abr a 31/jul (PRD 7.8)
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
RH_DEFAULT_PCT: Final[float] = 65.0
WIND_SPEED_DEFAULT_MS: Final[float] = 2.0
SOLAR_RAD_DEFAULT_MJ: Final[float] = 18.5
EXAMPLE_CELL_ID: Final[str] = "-189_-483"

# Climate Stress & ISNA Thresholds (US-03)
ISNA_GRAIN_THRESHOLD: Final[float] = 0.55
ISNA_COVER_THRESHOLD: Final[float] = 0.50
GRAIN_CRITICAL_HALF_WINDOW_DAYS: Final[int] = 15
COVER_CRITICAL_WINDOW_DAYS: Final[int] = 30
HEAT_STRESS_TEMP_C: Final[float] = 35.0
HEAT_STRESS_MIN_DAYS: Final[int] = 3
MIN_INITIAL_ARM_FRACTION: Final[float] = 0.20

# Fator de perda pelo ISNA (PRD 7.5): 0% com ISNA >= 0,65; 30% entre 0,55 e 0,65; 60% abaixo
LOSS_ISNA_NONE_FROM: Final[float] = 0.65
LOSS_ISNA_HIGH_BELOW: Final[float] = 0.55
LOSS_FACTOR_MEDIUM: Final[float] = 0.30
LOSS_FACTOR_HIGH: Final[float] = 0.60

PERCENT_DIVISOR: Final[float] = 100.0

# Scoring Engine Weights & Thresholds (US-04, US-08, ADR-0004)
WEIGHT_SAFETY: Final[float] = 0.30
WEIGHT_SOIL: Final[float] = 0.25
WEIGHT_INCOME: Final[float] = 0.30
WEIGHT_FUTURE: Final[float] = 0.15

SCORE_MIN: Final[float] = 0.0
SCORE_MAX: Final[float] = 100.0

# Rótulos para o produtor (plano técnico §4.4; hipótese do time)
RAIN_LABEL_GOOD_PCT: Final[float] = 85.0  # Bom >= 17 de 20 anos sem aperto
RAIN_LABEL_MEDIUM_PCT: Final[float] = 60.0  # Médio 12 a 16; Fraco < 12
SOIL_LABEL_GOOD: Final[float] = 50.0
SOIL_LABEL_MEDIUM: Final[float] = 20.0
INCOME_LABEL_GOOD: Final[float] = 70.0
INCOME_LABEL_MEDIUM: Final[float] = 30.0

# Nota de solo (PRD 7.4): palhada até 40 + nitrogênio até 30 + quebra de pragas até 30
SOIL_STRAW_MAX: Final[float] = 40.0
SOIL_NITROGEN_MAX: Final[float] = 30.0
SOIL_PESTS_MAX: Final[float] = 30.0
NEMATODE_PEST_WEIGHT: Final[float] = 1.5  # nematoide = sim: pragas valem 1,5 vez

LIVESTOCK_INTERCROP_BONUS: Final[float] = 15.0

# 3-Year Rotation Plan Constants (US-06, US-09)
ROTATION_HORIZON_YEARS: Final[int] = 3
DRIEST_YEARS_COUNT: Final[int] = 4
DRY_SCENARIO_MONTHS: Final[frozenset[int]] = frozenset({2, 3, 4})  # PRD 7.7: fevereiro a abril
MAX_CONSECUTIVE_FALLOW: Final[int] = 2
DIVERSITY_BONUS_TWO_ROLES: Final[float] = 5.0
DIVERSITY_BONUS_THREE_ROLES: Final[float] = 10.0
MONOCULTURE_CORN_PENALTY: Final[float] = 12.0
NEMATODE_SUPPRESSOR_CROPS: Final[frozenset[str]] = frozenset({"crotalaria", "milheto"})

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
