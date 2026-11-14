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

# Example Farm Coordinates (ADR-0003 & ADR-0004: Uberlandia / Fazenda Santa Luzia)
EXAMPLE_FARM_LAT: Final[float] = -18.9186
EXAMPLE_FARM_LON: Final[float] = -48.2772
EXAMPLE_FARM_HARVEST: Final[str] = "meio"
EXAMPLE_CELL_ID: Final[str] = "-189_-483"

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
SOLAR_RAD_DEFAULT_MJ: Final[float] = 18.5
WIND_SPEED_DEFAULT_MS: Final[float] = 2.0
RH_DEFAULT_PCT: Final[float] = 65.0
ALBEDO_CANOPY: Final[float] = 0.23
PSYCHROMETRIC_CONSTANT_KPA_C: Final[float] = 0.063
MIN_DAILY_ETO_MM: Final[float] = 0.5
MAX_DAILY_ETO_MM: Final[float] = 10.0

# Climate Stress & ISNA Thresholds (US-03)
ISNA_GRAIN_THRESHOLD: Final[float] = 0.55
ISNA_COVER_THRESHOLD: Final[float] = 0.50
GRAIN_CRITICAL_HALF_WINDOW_DAYS: Final[int] = 15
COVER_CRITICAL_WINDOW_DAYS: Final[int] = 30
HEAT_STRESS_TEMP_C: Final[float] = 35.0
HEAT_STRESS_MIN_DAYS: Final[int] = 3
MAX_YIELD_LOSS_FACTOR: Final[float] = 0.65
BASE_STRESS_LOSS_FACTOR: Final[float] = 0.25

# CMIP6 Future Simulation Spread (US-09)
CMIP6_MODEL_SPREAD_YEARS: Final[int] = 2
PERCENT_DIVISOR: Final[float] = 100.0

# Scoring Engine Weights & Thresholds (US-04, US-08, ADR-0004)
WEIGHT_SAFETY: Final[float] = 0.30
WEIGHT_SOIL: Final[float] = 0.25
WEIGHT_INCOME: Final[float] = 0.30
WEIGHT_FUTURE: Final[float] = 0.15

SCORE_MIN: Final[float] = 0.0
SCORE_MAX: Final[float] = 100.0
LABEL_GOOD_THRESHOLD: Final[float] = 70.0
LABEL_MEDIUM_THRESHOLD: Final[float] = 45.0

NITROGEN_CREDIT_BRL_PER_KG: Final[float] = 6.50
SOIL_ORGANIC_MATTER_CREDIT_PER_SCORE: Final[float] = 4.00
INCOME_SCORE_MIN_BRL: Final[float] = -600.0
INCOME_SCORE_MAX_BRL: Final[float] = 2200.0
MAX_NITROGEN_KG_REF: Final[float] = 80.0
NEMATODE_BASE_OFFSET: Final[float] = 15.0
NEMATODE_RANGE_SPAN: Final[float] = 45.0
LIVESTOCK_INTERCROP_BONUS: Final[float] = 15.0
FALLOW_LIVESTOCK_PENALTY: Final[float] = 10.0

# 3-Year Rotation Plan Constants (US-06, US-09)
ROTATION_HORIZON_YEARS: Final[int] = 3
DRIEST_YEARS_COUNT: Final[int] = 4
MAX_CONSECUTIVE_FALLOW: Final[int] = 2
DIVERSITY_BONUS_TWO_ROLES: Final[float] = 5.0
DIVERSITY_BONUS_THREE_ROLES: Final[float] = 10.0
MONOCULTURE_CORN_PENALTY: Final[float] = 12.0
NEMATODE_SUPPRESSOR_CROPS: Final[frozenset[str]] = frozenset({"crotalaria", "milheto"})

# Data Versioning & Problem Details (RFC 7807)
DATA_VERSION: Final[str] = "2026.11-nasa-power-20y"
PROBLEM_JSON_MEDIA_TYPE: Final[str] = "application/problem+json"
PROBLEM_BASE_URI: Final[str] = "https://api.raizorbital.com/errors"
