"""JSON de GET /api/regiao (P3; contrato do front em `src/models/region.ts`).

O front lê `raio_km`, `centro`, `distancia_km`, `anos[{ano, pct_parado, pct_plantou,
pct_incerto}]` e `fonte`; `mascara`, `n_pixels`, `n_pixels_lavoura` e `pct_sem_dado` vão junto
(guia NDVI, "Contrato da API") e o front pode ignorar.
"""

from pydantic import BaseModel, ConfigDict

from app.models.regiao import RegiaoAno, RegiaoDoPonto


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True)


class RegiaoAnoSchema(_Frozen):
    ano: int
    pct_parado: float
    pct_plantou: float
    pct_incerto: float
    n_pixels: int
    # Pixels da máscara de lavoura no raio; `null` no arquivo de antes da tarefa 0036.
    n_pixels_lavoura: int | None
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
            n_pixels_lavoura=ano.n_pixels_lavoura,
            pct_sem_dado=ano.pct_sem_dado,
        )


class CentroSchema(_Frozen):
    lat: float
    lon: float


class RegiaoResponse(_Frozen):
    raio_km: float
    fonte: str
    mascara: str
    # Centro do círculo usado e a distância do ponto pedido até ele (km, 1 casa).
    centro: CentroSchema
    distancia_km: float
    anos: list[RegiaoAnoSchema]

    @classmethod
    def from_model(cls, consulta: RegiaoDoPonto) -> "RegiaoResponse":
        regiao = consulta.regiao
        return cls(
            raio_km=regiao.raio_km,
            fonte=regiao.fonte,
            mascara=regiao.mascara,
            centro=CentroSchema(lat=regiao.lat, lon=regiao.lon),
            distancia_km=consulta.distancia_km,
            anos=[RegiaoAnoSchema.from_model(ano) for ano in regiao.anos],
        )
