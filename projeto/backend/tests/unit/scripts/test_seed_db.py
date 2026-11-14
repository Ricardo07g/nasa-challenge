"""O script de carga inicial usa o mesmo id de célula (floor) que a API e a ingestão."""

from app.repositories.climate_repository import cell_id_for
from scripts.seed_db import SEED_CELL_ID, SEED_LAT, SEED_LON


def test_should_seed_the_floor_cell_id_of_the_seed_point() -> None:
    # Uberlândia (-18,9186; -48,2772): o round dava "-189_-483"; o floor dá "-190_-483".
    assert SEED_CELL_ID == "-190_-483"
    assert cell_id_for(SEED_LAT, SEED_LON) == SEED_CELL_ID
