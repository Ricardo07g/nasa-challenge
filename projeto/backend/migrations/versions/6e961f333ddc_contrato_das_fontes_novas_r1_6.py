"""contrato das fontes novas (R1.6)

Leva o banco ao "Contrato dos dados das fontes" do `projeto/backend/AGENTS.md` (tarefa 0013):

- `cmip6_delta`: um delta por célula, modelo, cenário e mês (no lugar da tabela agregada);
- `ndvi_point`: com produto (MOD13Q1/MYD13Q1), qualidade e o ponto (`geom`);
- `smap_point`: SMAP L4 por ponto e dia (no lugar da `smap_moisture`, que era por célula);
- `data_run.version`: a versão que vai para o `versao_dados` (R3.5).

As tabelas trocadas estavam vazias (nenhum código da API gravava nelas). O downgrade volta ao
esquema da migração inicial e apaga o que estiver nas tabelas novas.

Revision ID: 6e961f333ddc
Revises: cb6b775d83e3
Create Date: 2026-11-14 17:06:41.096523

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6e961f333ddc"
down_revision: str | Sequence[str] | None = "cb6b775d83e3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Versão das cargas gravadas antes desta migração, que não tinham versão.
UNVERSIONED_RUN = "sem-versao"


def upgrade() -> None:
    """Tabelas no formato do contrato das fontes."""
    op.execute(
        """
        DROP TABLE IF EXISTS cmip6_delta;
        CREATE TABLE cmip6_delta (
            cell_id TEXT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
            model TEXT NOT NULL,
            scenario TEXT NOT NULL,
            month SMALLINT NOT NULL,
            rain_pct REAL NOT NULL,
            tmax_c REAL NOT NULL,
            tmin_c REAL,
            PRIMARY KEY (cell_id, model, scenario, month)
        );
        """
    )

    op.execute(
        """
        DROP TABLE IF EXISTS ndvi_point;
        CREATE TABLE ndvi_point (
            key TEXT NOT NULL,
            geom geometry(Point, 4326) NOT NULL,
            date DATE NOT NULL,
            product TEXT NOT NULL,
            ndvi REAL NOT NULL,
            quality SMALLINT NOT NULL,
            PRIMARY KEY (key, date, product)
        );
        CREATE INDEX idx_ndvi_point_geom ON ndvi_point USING GIST (geom);
        """
    )

    op.execute(
        """
        DROP TABLE IF EXISTS smap_moisture;
        CREATE TABLE smap_point (
            key TEXT NOT NULL,
            geom geometry(Point, 4326) NOT NULL,
            date DATE NOT NULL,
            sm_rootzone_wetness REAL NOT NULL,
            sm_rootzone_m3_m3 REAL NOT NULL,
            sm_surface_m3_m3 REAL,
            PRIMARY KEY (key, date)
        );
        CREATE INDEX idx_smap_point_geom ON smap_point USING GIST (geom);
        """
    )

    op.execute("ALTER TABLE data_run ADD COLUMN version TEXT;")
    op.execute(f"UPDATE data_run SET version = '{UNVERSIONED_RUN}';")
    op.execute("ALTER TABLE data_run ALTER COLUMN version SET NOT NULL;")


def downgrade() -> None:
    """Volta ao esquema da migração inicial (apaga os dados das tabelas novas)."""
    op.execute("ALTER TABLE data_run DROP COLUMN IF EXISTS version;")

    op.execute(
        """
        DROP TABLE IF EXISTS smap_point;
        CREATE TABLE smap_moisture (
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
        DROP TABLE IF EXISTS ndvi_point;
        CREATE TABLE ndvi_point (
            key TEXT NOT NULL,
            date DATE NOT NULL,
            ndvi REAL NOT NULL,
            PRIMARY KEY (key, date)
        );
        """
    )

    op.execute(
        """
        DROP TABLE IF EXISTS cmip6_delta;
        CREATE TABLE cmip6_delta (
            cell_id TEXT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
            scenario TEXT NOT NULL DEFAULT 'SSP2-4.5',
            aumento_temperatura_media_c REAL NOT NULL,
            variacao_chuva_safrinha_pct REAL NOT NULL,
            aumento_dias_calor_extremo REAL NOT NULL,
            PRIMARY KEY (cell_id, scenario)
        );
        """
    )
