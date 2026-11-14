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
    crop_option_controller,
    health_controller,
    recomendacao_controller,
    talhao_controller,
)
from app.services.errors import NotFoundError, ValidationDomainError

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
