"""Repository contract and implementations for climate series, SMAP, and CMIP6."""

import json
from datetime import date
from pathlib import Path
from typing import Any, Protocol

from app.constants import (
    GRID_CELL_SCALE_FACTOR,
    PILOT_MAX_LAT,
    PILOT_MAX_LON,
    PILOT_MIN_LAT,
    PILOT_MIN_LON,
    RH_DEFAULT_PCT,
    SOLAR_RAD_DEFAULT_MJ,
    WIND_SPEED_DEFAULT_MS,
)
from app.models.climate import ClimateSeason, Cmip6Delta, SmapSoilMoisture


class ClimateRepository(Protocol):
    """Data access contract for meteorological series, SMAP, and CMIP6 projections."""

    def find_cell_id(self, lat: float, lon: float) -> str | None: ...

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]: ...

    def get_cmip6_delta(self, cell_id: str) -> Cmip6Delta: ...

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None: ...


class DataOutputClimateRepository:
    """Reads pre-extracted NASA POWER, SMAP, and CMIP6 datasets from data/output/."""

    def __init__(self, data_output_dir: Path = Path("/workspace/data/output")) -> None:
        self._data_output_dir = data_output_dir
        self._seasons_cache: list[ClimateSeason] | None = None
        self._cmip6_cache: Cmip6Delta | None = None
        self._smap_cache: SmapSoilMoisture | None = None

    def find_cell_id(self, lat: float, lon: float) -> str | None:
        if not (PILOT_MIN_LAT <= lat <= PILOT_MAX_LAT and PILOT_MIN_LON <= lon <= PILOT_MAX_LON):
            return None
        lat_idx = round(lat * GRID_CELL_SCALE_FACTOR)
        lon_idx = round(lon * GRID_CELL_SCALE_FACTOR)
        return f"{lat_idx}_{lon_idx}"

    def get_seasons(self, cell_id: str) -> list[ClimateSeason]:
        if self._seasons_cache is not None:
            return [
                ClimateSeason(
                    cell_id=cell_id,
                    year=s.year,
                    start_date=s.start_date,
                    rain_mm=s.rain_mm,
                    rain_source=s.rain_source,
                    tmax_c=s.tmax_c,
                    tmin_c=s.tmin_c,
                    eto_mm=s.eto_mm,
                    gwetroot=s.gwetroot,
                    tmean_c=s.tmean_c,
                    rh2m_pct=s.rh2m_pct,
                    ws2m_ms=s.ws2m_ms,
                    solar_rad_mj=s.solar_rad_mj,
                )
                for s in self._seasons_cache
            ]

        daily_path = self._data_output_dir / "historico_uberlandia_20anos_diario.json"
        payload: dict[str, Any] = json.loads(daily_path.read_text(encoding="utf-8"))
        rain_source = str(payload.get("fonte", "nasa_power"))
        years_map: dict[str, list[dict[str, Any]]] = payload.get("anos", {})

        seasons: list[ClimateSeason] = []
        for year_str in sorted(years_map.keys(), key=int):
            year = int(year_str)
            records = years_map[year_str]
            start_dt = date.fromisoformat(str(records[0]["date"])) if records else date(year, 1, 1)

            rain_list: list[float] = []
            tmax_list: list[float] = []
            tmin_list: list[float] = []
            tmean_list: list[float] = []
            rh_list: list[float] = []
            ws_list: list[float] = []
            rad_list: list[float] = []
            gwet_list: list[float] = []
            eto_list: list[float] = []

            for rec in records:
                rain = float(rec.get("PRECTOTCORR") or 0.0)
                tmax = float(rec.get("T2M_MAX") or 30.0)
                tmin = float(rec.get("T2M_MIN") or 18.0)
                tmean = float(rec.get("T2M") or ((tmax + tmin) / 2.0))
                rh = float(rec.get("RH2M") or RH_DEFAULT_PCT)
                ws = float(rec.get("WS2M") or WIND_SPEED_DEFAULT_MS)
                rad = float(rec.get("ALLSKY_SFC_SW_DWN") or SOLAR_RAD_DEFAULT_MJ)
                gwet = float(rec.get("GWETROOT") or 0.5)
                eto = float(
                    rec.get("ETO_MM")
                    or (0.0023 * (tmean + 17.8) * ((tmax - tmin) ** 0.5) * (rad * 0.408))
                )

                rain_list.append(rain)
                tmax_list.append(tmax)
                tmin_list.append(tmin)
                tmean_list.append(tmean)
                rh_list.append(rh)
                ws_list.append(ws)
                rad_list.append(rad)
                gwet_list.append(gwet)
                eto_list.append(round(eto, 3))

            seasons.append(
                ClimateSeason(
                    cell_id=cell_id,
                    year=year,
                    start_date=start_dt,
                    rain_mm=tuple(rain_list),
                    rain_source=rain_source,
                    tmax_c=tuple(tmax_list),
                    tmin_c=tuple(tmin_list),
                    eto_mm=tuple(eto_list),
                    gwetroot=tuple(gwet_list),
                    tmean_c=tuple(tmean_list),
                    rh2m_pct=tuple(rh_list),
                    ws2m_ms=tuple(ws_list),
                    solar_rad_mj=tuple(rad_list),
                )
            )

        self._seasons_cache = seasons
        return list(seasons)

    def get_cmip6_delta(self, cell_id: str) -> Cmip6Delta:
        if self._cmip6_cache is not None:
            return Cmip6Delta(
                cell_id=cell_id,
                cenario=self._cmip6_cache.cenario,
                modelos_referencia=self._cmip6_cache.modelos_referencia,
                aumento_temperatura_media_c=self._cmip6_cache.aumento_temperatura_media_c,
                variacao_chuva_safrinha_pct=self._cmip6_cache.variacao_chuva_safrinha_pct,
                aumento_dias_calor_extremo_ge_35c=self._cmip6_cache.aumento_dias_calor_extremo_ge_35c,
            )

        cmip_path = self._data_output_dir / "cmip6_projecao_2050.json"
        payload: dict[str, Any] = json.loads(cmip_path.read_text(encoding="utf-8"))
        delta_raw: dict[str, Any] = payload["delta_climatico_safrinha"]

        delta = Cmip6Delta(
            cell_id=cell_id,
            cenario=str(payload.get("cenario", "SSP2-4.5")),
            modelos_referencia=tuple(str(m) for m in payload.get("modelos_referencia", [])),
            aumento_temperatura_media_c=float(delta_raw["aumento_temperatura_media_c"]),
            variacao_chuva_safrinha_pct=float(delta_raw["variacao_chuva_safrinha_pct"]),
            aumento_dias_calor_extremo_ge_35c=float(delta_raw["aumento_dias_calor_extremo_ge_35c"]),
        )
        self._cmip6_cache = delta
        return delta

    def get_latest_smap(self, lat: float, lon: float) -> SmapSoilMoisture | None:
        if self._smap_cache is not None:
            return SmapSoilMoisture(
                data=self._smap_cache.data,
                latitude=lat,
                longitude=lon,
                sm_surface_m3_m3=self._smap_cache.sm_surface_m3_m3,
                sm_rootzone_m3_m3=self._smap_cache.sm_rootzone_m3_m3,
                sm_rootzone_wetness=self._smap_cache.sm_rootzone_wetness,
                fonte=self._smap_cache.fonte,
            )

        smap_path = self._data_output_dir / "smap_uberlandia_2024_safra.json"
        if not smap_path.exists():
            return None

        payload: dict[str, Any] = json.loads(smap_path.read_text(encoding="utf-8"))
        registros: list[dict[str, Any]] = payload.get("registros", [])
        if not registros:
            return None

        latest = registros[-1]
        smap = SmapSoilMoisture(
            data=date.fromisoformat(str(latest["date"])),
            latitude=lat,
            longitude=lon,
            sm_surface_m3_m3=float(latest["sm_surface_m3_m3"]),
            sm_rootzone_m3_m3=float(latest["sm_rootzone_m3_m3"]),
            sm_rootzone_wetness=float(latest["sm_rootzone_wetness"]),
            fonte=str(payload.get("fonte", "nasa_smap_l4")),
        )
        self._smap_cache = smap
        return smap
