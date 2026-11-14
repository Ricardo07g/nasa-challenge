"""FastAPI application bootstrap, CORS, GZip, domain error handlers, and router registration."""

from fastapi import FastAPI, Request
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


app.include_router(health_controller.router, prefix="/api")
app.include_router(crop_option_controller.router, prefix="/api")
app.include_router(talhao_controller.router, prefix="/api")
app.include_router(recomendacao_controller.router, prefix="/api")
