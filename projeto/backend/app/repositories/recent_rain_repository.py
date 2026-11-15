"""Chuva recente (A2.3) do arquivo do contrato que o `pipeline/fetch_imerg_late.py` grava.

Implementa o `RecentRainRepository` do sinal para o outono (`sinal_outono_repository.py`). O ponto
recebe a célula de 0,1° do `cell_id_for`, que é o próprio pixel do IMERG (bordas nos décimos).
"""

import json
from datetime import date
from pathlib import Path
from typing import Any, Final

from app.models.recent_rain import RecentRainRecord
from app.models.sinal_outono import RecentRain
from app.repositories.climate_repository import cell_id_for

SOURCE_KEY: Final[str] = "imerg_late"


def recent_rain_record_from_json(item: dict[str, Any]) -> RecentRainRecord:
    """Uma célula da lista `celulas[]` do arquivo (o model recusa o que sai do contrato)."""
    return RecentRainRecord(
        cell_id=str(item["cell_id"]),
        lat=float(item["lat"]),
        lon=float(item["lon"]),
        data=date.fromisoformat(str(item["data"])),
        dias=int(item["dias"]),
        chuva_30d_mm=float(item["chuva_30d_mm"]),
        media_30d_mm=float(item["media_30d_mm"]),
        fracao_da_media=float(item["fracao_da_media"]),
        anos_media=int(item["anos_media"]),
    )


class FileRecentRainRepository:
    """Lê o arquivo da chuva recente (`versao_dados` + `celulas[]`) do `IMERG_LATE_PATH`.

    Sem arquivo, ou sem a célula do ponto nele: None (nunca a chuva da célula vizinha). Arquivo de
    outra fonte ou célula fora do contrato: ValueError, para o erro aparecer em vez de virar sinal.
    """

    def __init__(self, path: Path | None) -> None:
        self._path = path
        self._cells: dict[str, RecentRainRecord] | None = None

    def _load(self) -> dict[str, RecentRainRecord]:
        if self._cells is None:
            if self._path is None or not self._path.is_file():
                self._cells = {}
            else:
                payload = json.loads(self._path.read_text(encoding="utf-8"))
                fonte = (payload.get("versao_dados") or {}).get("fonte")
                if fonte != SOURCE_KEY:
                    raise ValueError(
                        f"arquivo da chuva recente com fonte {fonte!r} (esperado {SOURCE_KEY!r})"
                    )
                records = (recent_rain_record_from_json(i) for i in payload.get("celulas", []))
                self._cells = {record.cell_id: record for record in records}
        return self._cells

    def get_recent_rain(self, lat: float, lon: float) -> RecentRain | None:
        record = self._load().get(cell_id_for(lat, lon))
        return None if record is None else record.to_recent_rain()
