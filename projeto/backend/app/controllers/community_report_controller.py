"""Rotas dos relatos da comunidade sem cadastro (seção 7 da remodelagem, tarefa 0047).

O aparelho se identifica pelo cabeçalho `X-Aparelho` (identificador aleatório salvo no aparelho),
que só serve para o limite por dia e para apagar os próprios relatos; o banco guarda o hash.
"""

import uuid
from typing import Annotated, Final

from fastapi import APIRouter, Depends, Header, Query, Response

from app.dependencies import get_community_report_service
from app.models.community_report import ReportSubmission
from app.schemas.community_report import RelatoEntrada, RelatoSchema, RelatosResponse
from app.services.community_report_service import CommunityReportService

router = APIRouter(tags=["comunidade"])

Service = Annotated[CommunityReportService, Depends(get_community_report_service)]

DEVICE_HEADER: Final[str] = "X-Aparelho"
# Identificador aleatório do aparelho (o front usa um UUID): letras, números e hífen.
DEVICE_PATTERN: Final[str] = r"^[A-Za-z0-9-]{8,64}$"
Device = Annotated[str, Header(alias=DEVICE_HEADER, pattern=DEVICE_PATTERN)]
OptionalDevice = Annotated[str | None, Header(alias=DEVICE_HEADER, pattern=DEVICE_PATTERN)]


@router.post("/comunidade/relatos", status_code=201, response_model=RelatoSchema)
def post_relato(body: RelatoEntrada, service: Service, aparelho: Device) -> RelatoSchema:
    report = service.submit(
        ReportSubmission(
            tipo=body.tipo,
            subtipo=body.subtipo,
            valores=body.valores,
            lat=body.lat,
            lon=body.lon,
            data_fato=body.data_fato,
            device_id=aparelho,
        )
    )
    return RelatoSchema.from_model(report)


@router.get("/comunidade/relatos", response_model=RelatosResponse)
def list_relatos(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lon: Annotated[float, Query(ge=-180.0, le=180.0)],
    service: Service,
    raio_km: Annotated[float | None, Query()] = None,
    aparelho: OptionalDevice = None,
) -> RelatosResponse:
    return RelatosResponse.from_model(
        service.nearby(lat=lat, lon=lon, raio_km=raio_km, device_id=aparelho)
    )


@router.delete("/comunidade/relatos/{relato_id}", status_code=204)
def delete_relato(relato_id: uuid.UUID, service: Service, aparelho: Device) -> Response:
    service.delete(str(relato_id), aparelho)
    return Response(status_code=204)
