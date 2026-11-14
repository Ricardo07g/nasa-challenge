"""create_initial_postgis_tables

Revision ID: cb6b775d83e3
Revises:
Create Date: 2026-11-14 17:04:37.497082

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cb6b775d83e3"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema with PostGIS extension and core tables."""
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS grid_cell (
            id TEXT PRIMARY KEY,
            geom geometry(Polygon, 4326) NOT NULL,
            center geometry(Point, 4326) NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_grid_cell_geom ON grid_cell USING GIST (geom);
        CREATE INDEX IF NOT EXISTS idx_grid_cell_center ON grid_cell USING GIST (center);
        """
    )

    op.execute(
        """
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
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS smap_moisture (
            cell_id TEXT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            sm_surface_m3_m3 REAL NOT NULL,
            sm_rootzone_m3_m3 REAL NOT NULL,
            sm_rootzone_wetness REAL NOT NULL,
            PRIMARY KEY (cell_id, date)
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS cmip6_delta (
            cell_id TEXT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
            scenario TEXT NOT NULL DEFAULT 'SSP2-4.5',
            aumento_temperatura_media_c REAL NOT NULL,
            variacao_chuva_safrinha_pct REAL NOT NULL,
            aumento_dias_calor_extremo REAL NOT NULL,
            PRIMARY KEY (cell_id, scenario)
        );
        """
    )

    op.execute(
        """
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
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ndvi_point (
            key TEXT NOT NULL,
            date DATE NOT NULL,
            ndvi REAL NOT NULL,
            PRIMARY KEY (key, date)
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS data_run (
            id SERIAL PRIMARY KEY,
            source TEXT NOT NULL,
            params JSONB NOT NULL,
            finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )


def downgrade() -> None:
    """Downgrade schema dropping all tables."""
    op.execute("DROP TABLE IF EXISTS data_run CASCADE;")
    op.execute("DROP TABLE IF EXISTS ndvi_point CASCADE;")
    op.execute("DROP TABLE IF EXISTS soil_point CASCADE;")
    op.execute("DROP TABLE IF EXISTS cmip6_delta CASCADE;")
    op.execute("DROP TABLE IF EXISTS smap_moisture CASCADE;")
    op.execute("DROP TABLE IF EXISTS climate_season CASCADE;")
    op.execute("DROP TABLE IF EXISTS grid_cell CASCADE;")
