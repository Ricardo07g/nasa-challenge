# Diretrizes e Boas Práticas de Codificação (Coding Guidelines — Python + FastAPI + PostgreSQL / PostGIS)

**Versão:** 1.0
**Data:** Novembro de 2026
**Escopo:** Python 3.12, FastAPI, Pydantic v2, pytest, ruff, PostgreSQL 17 + PostGIS 3.5
**Documentos Relacionados:** [AGENTS.md](file:///workspace/AGENTS.md), documentações em [docs/](file:///workspace/docs/)

---

## 1. Visão Geral

Este documento estabelece os padrões de qualidade de código, convenções idiomáticas em **Python 3.12 moderno**, arquitetura em camadas (MVC + Service/Repository), validação de contratos com Pydantic v2, testes com pytest seguindo TDD e boas práticas de integração com PostgreSQL e PostGIS.

---

## 2. Idioma e Convenções de Nomenclatura (English Only)

* **Idioma Estrito no Código:**
  * Todos os identificadores (**módulos, pacotes, variáveis, funções, métodos, classes, protocols, dataclasses, schemas Pydantic, colunas do banco de dados e mensagens de commit**) **devem ser estritamente em inglês**.
  * É expressamente proibido o uso de termos em português ou "Portunglês" no código-fonte, nos testes ou nas mensagens de log.
  * *Observação:* Termos agronômicos específicos previstos em requisitos de negócio/PRD (como nomes de culturas em dados de semente/tabelas públicas) são permitidos como valores de dados, mas identificadores de código e atributos da entidade devem permanecer em inglês.

* **Convenções de Caixa (PEP 8 Adaptado):**
  * **Módulos, Pacotes e Arquivos:** `snake_case` (ex: `crop_option_controller.py`, `crop_option_service.py`, `crop_option_repository.py`, `crop_option.py`).
  * **Classes, Protocols, Dataclasses, Schemas Pydantic e Exceções:** `PascalCase` (ex: `CropOption`, `CropOptionService`, `CropOptionRepositoryProtocol`, `CropOptionResponse`, `NotFoundError`).
  * **Funções, Métodos, Argumentos e Variáveis:** `snake_case` (ex: `calculate_score`, `get_by_id`, `farm_id`, `is_active`).
  * **Constantes Globais e Membros de Enum:** `UPPER_SNAKE_CASE` (ex: `DEFAULT_SRID`, `MAX_PAGE_LIMIT`, `CropType.COVER_CROP`).
  * **Tabelas e Colunas no PostgreSQL / PostGIS:** `snake_case` (ex: `crop_option_id`, `created_at`, `geom`, `soil_type`).

---

## 3. Tipagem Estrita, Python Moderno e Validação de Dados

* **Tipagem Estática Obrigatória (`typing` / Python 3.12+):**
  * Todas as assinaturas de funções e métodos devem possuir type annotations explícitas para todos os parâmetros e tipo de retorno.
  * Utilize a sintaxe moderna de union types do Python 3.10+ (`T | None`, `int | float`) em vez de `Optional[T]` ou `Union[T, U]`.
  * É expressamente proibido o uso indiscriminado de `Any`. Para dados genéricos ou incertos, utilize Generics (`TypeVar`), `object` associado a Type Guards, ou modelos estruturados Pydantic.

* **Separação Clara entre Model de Domínio e Schema de API:**
  * **Entidades de Domínio (`app/models/`):** Devem ser implementadas como dataclasses puras (`@dataclass(frozen=True)` ou `@dataclass`), sem acoplamento com bibliotecas HTTP ou Pydantic.
    ```python
    from dataclasses import dataclass


    @dataclass(frozen=True)
    class CropOption:
        id: str
        name: str
        category: str
    ```
  * **Schemas de API (`app/schemas/`):** Devem ser definidos utilizando `pydantic.BaseModel` (Pydantic v2), servindo exclusivamente como contrato HTTP de entrada/saída:
    ```python
    from pydantic import BaseModel, ConfigDict, Field


    class CreateCropOptionRequest(BaseModel):
        model_config = ConfigDict(frozen=True, extra="forbid")

        name: str = Field(..., min_length=2, max_length=100)
        category: str = Field(..., min_length=2, max_length=50)
    ```

* **Contratos Desacoplados via `typing.Protocol`:**
  * Repositórios e serviços devem definir seus contratos através de `Protocol` em `repositories/` e `services/`, permitindo substituição imediata por fakes em testes unitários sem dependência de classes abstratas pesadas:
    ```python
    from typing import Protocol
    from app.models.crop_option import CropOption


    class CropOptionRepository(Protocol):
        def list_all(self) -> list[CropOption]: ...

        def get_by_id(self, option_id: str) -> CropOption | None: ...
    ```

* **Proibição Estrita de Magic Numbers e Magic Literals:**
  * É expressamente proibido o uso de números mágicos literais (ex: `4326`, `255`, `100`, `365`) ou strings soltas espalhadas pelo código sem uma constante nomeada que explique semanticamente o seu propósito.
  * Todas as constantes devem ser declaradas em `UPPER_SNAKE_CASE` acompanhadas de `typing.Final`:
    - **Constantes de Domínio da Feature:** Declaradas em arquivo próprio ou módulo de constantes da feature (ex: `DEFAULT_COORDINATE_SRID: Final[int] = 4326`).
    - **Constantes de Algoritmo:** Declaradas no topo do respectivo módulo de serviço ou motor de cálculo.
    - **Constantes Transversais:** Centralizadas em módulo compartilhado de constantes ou no `Settings` da aplicação.
  * **Exceção:** Os números `0` e `1` são aceitos sem constante apenas quando usados como índices ou contadores triviais em iterações.

* **Princípio Fail-Fast e Proibição de Fallbacks Silenciosos em Configurações Críticas:**
  * É expressamente proibido o uso de fallbacks silenciosos ou valores padrão para configurações obrigatórias, credenciais, segredos e conexões essenciais de infraestrutura (ex: `DATABASE_URL` em ambiente de produção).
  * Toda configuração deve ser gerenciada centralizadamente pela classe `Settings` em `app/config.py` utilizando `pydantic-settings`. É proibido ler `os.environ` ou `os.getenv` de forma dispersa no código.
  * Se um parâmetro essencial não for fornecido, a aplicação **deve falhar imediatamente (fail-fast)** no bootstrap com mensagem descritiva.

---

## 4. Política de Comentários e Documentação no Código

* **Ausência de Comentários Óbvios:**
  * Não inclua comentários procedurais ou explicativos em blocos `if`, instanciações de classes ou retornos triviais. O código deve ser autoexplicativo por meio de nomes limpos e funções coesas.
* **Docstrings Profissionais em Funções de Domínio e Motores de Cálculo:**
  * Algoritmos matemáticos, motores de pontuação (ex: ISNA, aptidão climática, cálculos espaciais PostGIS) e métodos de domínio não triviais devem conter docstrings em inglês (padrão Google ou Sphinx) explicando o racional, parâmetros, tipos de retorno e exceções levantadas:
    ```python
    def calculate_climate_suitability(
        soil_water_index: float,
        precipitation_mm: float,
        temperature_celsius: float,
    ) -> float:
        """Calculates the agricultural suitability index based on climate and soil data.

        Args:
            soil_water_index: Soil water availability index ranging from 0.0 to 1.0.
            precipitation_mm: Accumulated precipitation during the cycle in millimeters.
            temperature_celsius: Mean ambient temperature in degrees Celsius.

        Returns:
            A normalized suitability score between 0.0 and 1.0.

        Raises:
            ValueError: If soil_water_index is outside the [0.0, 1.0] range.
        """
    ```

---

## 5. Tratamento de Erros e Respostas HTTP (RFC 7807)

* **Erros de Domínio Estruturados:**
  * A camada de negócio (`services/`) não deve importar FastAPI, status HTTP ou construir responses HTTP. Ela deve lançar exceções de domínio estruturadas definidas em `app/services/errors.py`:
    ```python
    class DomainError(Exception):
        """Base class for all domain errors."""

        pass


    class NotFoundError(DomainError):
        """Raised when a requested resource is not found."""

        def __init__(self, resource_name: str, identifier: str) -> None:
            super().__init__(f"{resource_name} '{identifier}' was not found.")
            self.resource_name = resource_name
            self.identifier = identifier
    ```

* **Tradução Centralizada de Erros de Domínio no `main.py`:**
  * O arquivo `app/main.py` é responsável por registrar handlers de exceção no FastAPI para traduzir exceções de domínio em respostas HTTP uniformes seguindo o formato **RFC 7807 (`application/problem+json`)**:
    ```python
    from fastapi import Request
    from fastapi.responses import JSONResponse
    from app.services.errors import NotFoundError


    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={
                "type": "https://api.raizorbital.com/errors/not-found",
                "title": "Resource Not Found",
                "status": 404,
                "detail": str(exc),
                "resource": exc.resource_name,
                "id": exc.identifier,
            },
            headers={"Content-Type": "application/problem+json"},
        )
    ```

---

## 6. Diretrizes de Testes Automatizados (pytest + TDD Obrigatório)

* **TDD Obrigatório (Red-Green-Refactor):**
  * Nenhuma regra de negócio, repository ou controller deve ser implementado sem que o teste automatizado correspondente seja escrito previamente e verificado falhando.
* **Padrão Obrigatório de Nomenclatura de Testes:**
  * Todas as funções de teste devem seguir a convenção semântica em inglês:
    $$\text{test\_should\_}\langle\text{expected\_result}\rangle\text{\_when\_}\langle\text{scenario}\rangle$$
  * Exemplos válidos:
    - `test_should_return_all_crop_options_when_requested`
    - `test_should_raise_not_found_when_crop_option_id_does_not_exist`
    - `test_should_calculate_score_when_climate_data_is_favorable`
    - `test_should_return_404_status_when_resource_is_missing`
* **Isolamento das Camadas nos Testes:**
  * **Testes de Serviço (`tests/unit/services/`):** Devem utilizar **Fake Repositories** em memória (implementados diretamente no arquivo de teste como classes simples que respeitam o `Protocol`). É proibido usar banco de dados real ou mock de conexões HTTP nos testes de serviço.
  * **Testes de Repositório (`tests/unit/repositories/`):** Testam o comportamento do repositório isoladamente.
  * **Testes de Controller (`tests/integration/controllers/`):** Testam rotas via `fastapi.testclient.TestClient` utilizando `app.dependency_overrides` para injetar serviços ou repositórios simulados.

---

## 7. Banco de Dados e Consultas Espaciais (PostgreSQL + PostGIS)

* **Acesso a Dados Centralizado nos Repositories:**
  * Apenas classes de repositório (`app/repositories/`) possuem permissão para interagir com o banco de dados e executar queries SQL ou comandos PostGIS. É expressamente proibido executar queries ou importar adaptadores de banco em controllers ou services.
* **Geometrias e Coordenadas:**
  * Todas as coordenadas espaciais devem operar no SRID canônico **4326** (`WGS 84`), empregando `ST_MakePoint(lon, lat)` (sempre longitude primeiro, latitude depois).
* **Migrações e Evolução de Esquema:**
  * O esquema de banco é gerenciado de forma controlada e rastreável. É proibido executar scripts SQL manuais não versionados em ambientes compartilhados ou produtivos. Quando migrações automatizadas (ex: Alembic) forem adotadas, as revisões devem ser geradas através das ferramentas oficiais e comitadas junto com o código.

---

## 8. Design de Endpoints REST e Coesão de Rotas

* **Prefixo Canônico Global `/api`:**
  * Todos os endpoints da API devem ser montados sob o prefixo `/api` via `app.include_router(..., prefix="/api")` em `app/main.py`.
* **Literais Diretos de Rota nos Controllers:**
  * Nos controllers, as rotas devem ser declaradas utilizando **literais diretos de rota** (ex: `@router.get("")`, `@router.get("/{id}")`).
  * É **expressamente proibido** criar dicionários, enums ou variáveis de constantes para nomes de rota (ex: `CROP_OPTION_ROUTES`), pois rotas não se repetem e variáveis criam indireção desnecessária.
* **Coesão de Domínio e Sub-recursos:**
  * É proibido misturar rotas pertencentes a outros domínios dentro do controller de uma feature.
  * A criação de recursos deve ser feita no endpoint raiz do próprio recurso (`POST /api/<resource>`), informando referências a entidades associadas (`farm_id`, `field_id`, etc.) no corpo da requisição (`request body`) validado pelo schema Pydantic.

---

## 9. Simplicidade de Design e Proibição de Overengineering (KISS / YAGNI)

* **Injeção de Dependências Idiomática com FastAPI:**
  * Utilize o mecanismo nativo `fastapi.Depends` configurado em `app/dependencies.py` para instanciar repositórios e serviços.
* **Proibição de Factories Prematuras:**
  * É proibido criar classes ou arquivos de *factory* (`*.factory.py`) quando a instanciação direta no módulo `dependencies.py` for suficiente. Factories só são aceitas quando houver necessidade comprovada de polimorfismo dinâmico em tempo de execução.
* **Proibição de Interfaces Fantasma ou Classes de Pass-Through:**
  * Não crie classes intermediárias vazias cujo único propósito seja repassar chamadas para outra camada sem adicionar regra de negócio ou transformação relevante.
* **Reutilização de Infraestrutura:**
  * Clientes de APIs externas (ex: NASA POWER, serviços de clima, clientes de mensageria) devem ser estruturados como clientes de infraestrutura reutilizáveis, injetados nos repositórios que necessitam consumir os respectivos dados externos.
