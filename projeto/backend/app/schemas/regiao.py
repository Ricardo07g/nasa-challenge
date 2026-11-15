"""JSON de GET /api/regiao (P3; contrato do front em `src/models/region.ts`).

O front lê `raio_km`, `anos[{ano, pct_parado, pct_plantou, pct_incerto}]` e `fonte`; `mascara`,
`n_pixels` e `pct_sem_dado` vão junto (guia NDVI, "Contrato da API") e o front pode ignorar.
"""

from pydantic import BaseModel, ConfigDict

from app.models.regiao import RegiaoAno, RegiaoSatelite


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class RegiaoAnoSchema(_Frozen):
    ano: int
    pct_parado: float
    pct_plantou: float
    pct_incerto: float
    n_pixels: int
    pct_sem_dado: float

    @classmethod
    def from_model(cls, ano: RegiaoAno) -> "RegiaoAnoSchema":
        # O RegionService só devolve anos com pixel classificado: os percentuais existem
        # (se faltar um, o Pydantic recusa em vez de mandar `null` para o front).
        return cls(
            ano=ano.ano,
            pct_parado=ano.pct_parado,
            pct_plantou=ano.pct_plantou,
            pct_incerto=ano.pct_incerto,
            n_pixels=ano.n_pixels,
            pct_sem_dado=ano.pct_sem_dado,
        )


class RegiaoResponse(_Frozen):
    raio_km: float
    fonte: str
    mascara: str
    anos: list[RegiaoAnoSchema]

    @classmethod
    def from_model(cls, regiao: RegiaoSatelite) -> "RegiaoResponse":
        return cls(
            raio_km=regiao.raio_km,
            fonte=regiao.fonte,
            mascara=regiao.mascara,
            anos=[RegiaoAnoSchema.from_model(ano) for ano in regiao.anos],
        )
