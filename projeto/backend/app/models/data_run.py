"""Execução de um script de dados: de onde veio cada carga (tabela `data_run`, plano técnico §5)."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime

from app.models.validation import require_non_blank


@dataclass(frozen=True)
class DataRun:
    """Uma carga feita por um script de dados.

    É a base do `versao_dados` da resposta (R3.5) e da tela "Como a conta é feita".
    `source` usa as chaves estáveis de fonte (`nasa_power`, `soilgrids`, `nex_gddp_cmip6`,
    `modis_mod13q1`, `smap`, `gpm_imerg`). `params` guarda o que foi pedido (produto e versão,
    modelos, cenário, anos, pontos). `finished_at` sempre com fuso, como o `TIMESTAMPTZ` do banco.
    """

    source: str
    params: Mapping[str, object]
    finished_at: datetime
    version: str

    def __post_init__(self) -> None:
        require_non_blank("source", self.source)
        require_non_blank("version", self.version)
        if self.finished_at.utcoffset() is None:
            raise ValueError("finished_at precisa ter fuso horário (ex.: UTC)")
