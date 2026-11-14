FROM python:3.12-slim

# uv com versão fixa (mesma usada localmente)
COPY --from=ghcr.io/astral-sh/uv:0.13.4 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# true = instala também pytest/ruff (usado pelo docker-compose de desenvolvimento)
ARG INSTALL_DEV=false

# Instala só as dependências primeiro, para aproveitar o cache do Docker
COPY pyproject.toml uv.lock .python-version ./
RUN if [ "$INSTALL_DEV" = "true" ]; then \
      uv sync --frozen --no-install-project; \
    else \
      uv sync --frozen --no-install-project --no-dev; \
    fi

COPY app ./app
COPY tests ./tests

RUN useradd --create-home --uid 1000 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
