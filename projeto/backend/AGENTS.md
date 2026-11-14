# AGENTS.md: backend (API)

Complementa o `AGENTS.md` da raiz (leia primeiro). Aqui ficam só as regras da API.

## Stack

- Python **3.12** (fixado em `.python-version`)
- **FastAPI** + **uvicorn**
- **pydantic-settings** para configuração
- **uv** para dependências e ambiente virtual
- **pytest** (testes) e **ruff** (lint + formatação)

## Estrutura

```
app/
  main.py              cria o FastAPI, CORS e registra os routers com prefixo /api
  config.py            Settings: toda configuração vem de variáveis de ambiente
  api/routes/          um arquivo por grupo de rotas (ex.: health.py)
tests/                 testes com pytest (um arquivo por módulo/rota)
pyproject.toml         dependências e configuração do ruff/pytest
uv.lock                versões exatas (sempre commitado)
requirements.txt       GERADO do uv.lock: não editar à mão
```

## Comandos

Com uv (fora do Docker):

```bash
cd projeto/backend
uv sync                                   # cria .venv com Python 3.12 e instala tudo
uv run uvicorn app.main:app --reload      # API em http://localhost:8000/docs
uv run pytest                             # testes
uv run ruff check . && uv run ruff format .   # lint e formatação
```

Com Docker (a partir de `projeto/`):

```bash
docker compose up --build backend
docker compose run --rm backend pytest
docker compose run --rm backend ruff check .
```

## Convenções

- **Rotas novas:** crie `app/api/routes/<nome>.py` com um `APIRouter`, registre em `app/main.py` com
  `app.include_router(<nome>.router, prefix="/api")`. Toda rota fica sob `/api`.
- **Testes primeiro:** escreva o teste em `tests/` antes da implementação e veja ele falhar.
- **Tipos:** use type hints em funções públicas; prefira modelos Pydantic para entrada e saída das rotas.
- **Configuração:** variável nova → campo em `Settings` (`app/config.py`) **e** o nome (sem valor) em
  `.env.example`. Nunca leia `os.environ` espalhado pelo código; use `get_settings()`.
- **Segredos:** nunca escreva credencial no código, nem em teste. Use variáveis de ambiente.

## Dependências

- Adicionar: `uv add <pacote>` (produção) ou `uv add --dev <pacote>` (só desenvolvimento).
- Remover: `uv remove <pacote>`.
- **Nunca edite `requirements.txt` à mão.** Ele é gerado do `uv.lock` e mostra, de forma legível, o que
  a API usa em produção (com `# via` dizendo quem puxou cada pacote). O hook `uv-export` do pre-commit
  regenera o arquivo quando o `uv.lock` muda. Para gerar manualmente:

  ```bash
  uv export --frozen --format requirements-txt --no-dev --no-hashes --no-emit-project --no-header -o requirements.txt
  ```

- Commite juntos: `pyproject.toml`, `uv.lock` e `requirements.txt`.
- Dependência nova pesada (ex.: xarray, earthengine-api) → justifique na descrição do PR.
