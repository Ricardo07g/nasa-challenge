"""Seeds the PostgreSQL + PostGIS database from pre-extracted data/output/*.json datasets."""

import json
from datetime import date
from pathlib import Path

import psycopg

from app.config import get_settings


def seed_database() -> None:
    settings = get_settings()
    db_url = settings.database_url or "postgresql://raiz:raiz_local@localhost:5433/raiz_orbital"
    data_dir = Path("/workspace/data/output")

    print(f"Connecting to {db_url}...")
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            # 1. Seed grid_cell for Uberlandia (-18.9186, -48.2772 -> -189_-483)
            cell_id = "-189_-483"
            lat_c, lon_c = -18.9, -48.3
            half_res = 0.05
            poly_wkt = (
                f"POLYGON(({lon_c - half_res} {lat_c - half_res}, "
                f"{lon_c + half_res} {lat_c - half_res}, "
                f"{lon_c + half_res} {lat_c + half_res}, "
                f"{lon_c - half_res} {lat_c + half_res}, "
                f"{lon_c - half_res} {lat_c - half_res}))"
            )
            point_wkt = f"POINT({lon_c} {lat_c})"

            cur.execute(
                """
                INSERT INTO grid_cell (id, geom, center)
                VALUES (%s, ST_GeomFromText(%s, 4326), ST_GeomFromText(%s, 4326))
                ON CONFLICT (id) DO UPDATE SET geom = EXCLUDED.geom, center = EXCLUDED.center;
                """,
                (cell_id, poly_wkt, point_wkt),
            )
            print(f"Grid cell '{cell_id}' seeded.")

            # 2. Seed soil_point from soilgrids_talhao.json
            soil_path = data_dir / "soilgrids_talhao.json"
            if soil_path.exists():
                s_data = json.loads(soil_path.read_text(encoding="utf-8"))
                s_lat, s_lon = float(s_data["latitude"]), float(s_data["longitude"])
                s_key = f"{round(s_lat, 3)}_{round(s_lon, 3)}"
                cur.execute(
                    """
                    INSERT INTO soil_point (
                        key, geom, argila_percentual, areia_percentual,
                        textura_solo, cad_capacidade_agua_mm
                    )
                    VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s)
                    ON CONFLICT (key) DO NOTHING;
                    """,
                    (
                        s_key,
                        s_lon,
                        s_lat,
                        float(s_data["argila_percentual"]),
                        float(s_data["areia_percentual"]),
                        str(s_data["textura_solo"]),
                        float(s_data["cad_capacidade_agua_mm"]),
                    ),
                )
                print(f"Soil point '{s_key}' seeded.")

            # 3. Seed smap_moisture from smap_uberlandia_2024_safra.json
            smap_path = data_dir / "smap_uberlandia_2024_safra.json"
            if smap_path.exists():
                smap_data = json.loads(smap_path.read_text(encoding="utf-8"))
                for rec in smap_data.get("registros", []):
                    cur.execute(
                        """
                        INSERT INTO smap_moisture (
                            cell_id, date, sm_surface_m3_m3,
                            sm_rootzone_m3_m3, sm_rootzone_wetness
                        )
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (cell_id, date) DO NOTHING;
                        """,
                        (
                            cell_id,
                            date.fromisoformat(str(rec["date"])),
                            float(rec["sm_surface_m3_m3"]),
                            float(rec["sm_rootzone_m3_m3"]),
                            float(rec["sm_rootzone_wetness"]),
                        ),
                    )
                print("SMAP records seeded.")

            # 4. Seed cmip6_delta from cmip6_projecao_2050.json
            cmip_path = data_dir / "cmip6_projecao_2050.json"
            if cmip_path.exists():
                c_data = json.loads(cmip_path.read_text(encoding="utf-8"))
                d_raw = c_data["delta_climatico_safrinha"]
                cur.execute(
                    """
                    INSERT INTO cmip6_delta (
                        cell_id, scenario, aumento_temperatura_media_c,
                        variacao_chuva_safrinha_pct, aumento_dias_calor_extremo
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (cell_id, scenario) DO NOTHING;
                    """,
                    (
                        cell_id,
                        str(c_data.get("cenario", "SSP2-4.5")),
                        float(d_raw["aumento_temperatura_media_c"]),
                        float(d_raw["variacao_chuva_safrinha_pct"]),
                        float(d_raw["aumento_dias_calor_extremo_ge_35c"]),
                    ),
                )
                print("CMIP6 delta seeded.")

            # 5. Seed climate_season from historico_uberlandia_20anos_diario.json
            clim_path = data_dir / "historico_uberlandia_20anos_diario.json"
            if clim_path.exists():
                clim_data = json.loads(clim_path.read_text(encoding="utf-8"))
                years_map = clim_data.get("anos", {})
                for yr_str, records in years_map.items():
                    year_num = int(yr_str)
                    start_dt = (
                        date.fromisoformat(str(records[0]["date"]))
                        if records
                        else date(year_num, 1, 1)
                    )
                    rains = [float(r.get("PRECTOTCORR") or 0.0) for r in records]
                    tmaxs = [float(r.get("T2M_MAX") or 30.0) for r in records]
                    tmins = [float(r.get("T2M_MIN") or 18.0) for r in records]
                    etos = [4.0] * len(records)

                    cur.execute(
                        """
                        INSERT INTO climate_season (
                            cell_id, year, start_date, rain_mm, tmax_c, tmin_c, eto_mm
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (cell_id, year) DO NOTHING;
                        """,
                        (cell_id, year_num, start_dt, rains, tmaxs, tmins, etos),
                    )
                print(f"20 years of NASA POWER climate seasons seeded for {cell_id}.")

        conn.commit()
    print("Database seeding completed successfully.")


if __name__ == "__main__":
    seed_database()
