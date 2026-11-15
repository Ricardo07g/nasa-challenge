"""FastAPI application bootstrap, CORS, GZip, domain error handlers, and router registration."""

from typing import Final

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.constants import PROBLEM_BASE_URI, PROBLEM_JSON_MEDIA_TYPE
from app.controllers import (
    avisos_controller,
    community_report_controller,
    crop_option_controller,
    custo_atraso_controller,
    health_controller,
    pilot_area_controller,
    plano_controller,
    raio_x_controller,
    recomendacao_controller,
    regiao_controller,
    safra_passada_controller,
    talhao_controller,
)
from app.services.errors import (
    CommunityUnavailableError,
    DomainError,
    NotFoundError,
    TooManyReportsError,
    ValidationDomainError,
)

# Pedido com parâmetro inválido (ex.: colheita fora de cedo/meio/tarde, lat fora de -90 a 90).
INVALID_REQUEST_CODE: Final[str] = "INVALID_REQUEST"

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)


@app.exception_handler(NotFoundError)
def handle_not_found(_: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={
            "type": f"{PROBLEM_BASE_URI}/{exc.code}",
            "title": "Not Found",
            "status": 404,
            "detail": str(exc),
            "code": exc.code,
        },
        media_type=PROBLEM_JSON_MEDIA_TYPE,
    )


@app.exception_handler(ValidationDomainError)
def handle_validation_error(_: Request, exc: ValidationDomainError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "type": f"{PROBLEM_BASE_URI}/{exc.code}",
            "title": "Unprocessable Entity",
            "status": 422,
            "detail": str(exc),
            "code": exc.code,
        },
        media_type=PROBLEM_JSON_MEDIA_TYPE,
    )


@app.exception_handler(RequestValidationError)
def handle_request_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    """422 de parâmetro inválido no mesmo problem+json dos erros de domínio, com cada campo."""
    invalid_params = [
        {
            "name": ".".join(str(part) for part in error["loc"][1:]) or str(error["loc"][0]),
            "in": str(error["loc"][0]),
            "reason": str(error["msg"]),
        }
        for error in exc.errors()
    ]
    names = list(dict.fromkeys(param["name"] for param in invalid_params))
    label = "Parâmetro inválido" if len(names) == 1 else "Parâmetros inválidos"
    return JSONResponse(
        status_code=422,
        content={
            "type": f"{PROBLEM_BASE_URI}/{INVALID_REQUEST_CODE}",
            "title": "Unprocessable Entity",
            "status": 422,
            "detail": f"{label}: {', '.join(names)}",
            "code": INVALID_REQUEST_CODE,
            "invalid_params": invalid_params,
        },
        media_type=PROBLEM_JSON_MEDIA_TYPE,
    )


app.include_router(health_controller.router, prefix="/api")
app.include_router(crop_option_controller.router, prefix="/api")
app.include_router(talhao_controller.router, prefix="/api")
app.include_router(recomendacao_controller.router, prefix="/api")
app.include_router(safra_passada_controller.router, prefix="/api")
app.include_router(regiao_controller.router, prefix="/api")
app.include_router(pilot_area_controller.router, prefix="/api")
app.include_router(custo_atraso_controller.router, prefix="/api")


def _problem(status: int, title: str, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "type": f"{PROBLEM_BASE_URI}/{exc.code}",
            "title": title,
            "status": status,
            "detail": str(exc),
            "code": exc.code,
        },
        media_type=PROBLEM_JSON_MEDIA_TYPE,
    )


# Relatos da comunidade (tarefa 0047): limite por aparelho (429) e comunidade sem banco (503).
@app.exception_handler(TooManyReportsError)
def handle_too_many_reports(_: Request, exc: TooManyReportsError) -> JSONResponse:
    return _problem(429, "Too Many Requests", exc)


@app.exception_handler(CommunityUnavailableError)
def handle_community_unavailable(_: Request, exc: CommunityUnavailableError) -> JSONResponse:
    return _problem(503, "Service Unavailable", exc)


app.include_router(community_report_controller.router, prefix="/api")
app.include_router(raio_x_controller.router, prefix="/api")

# Tela "Avisos" (remodelagem S6, tarefa 0046)
app.include_router(avisos_controller.router, prefix="/api")

# Aba Plano de 3 anos (remodelagem S5b, tarefa 0045)
app.include_router(plano_controller.router, prefix="/api")
