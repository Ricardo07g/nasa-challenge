# Tarefa 0011: Cache HTTP em `/recomendacao` e 422 em problem+json (R4.5)

- **Identificador:** `0011`
- **Título:** Cache HTTP em `/recomendacao` e 422 em problem+json
- **Status:** Concluída (o cache foi ajustado pela [tarefa 0025](0025-cache-que-revalida.md): `public, no-cache` + `ETag` e 304, no lugar do `max-age=86400`)
- **Prioridade:** Média (sinal fraco no campo; contrato de erro único para o front)
- **Módulos afetados:** `projeto/backend/app/main.py`, `projeto/backend/app/controllers/recomendacao_controller.py`, `projeto/backend/tests/integration/controllers/test_recomendacao_controller.py`, `projeto/backend/AGENTS.md`
- **Roteiro:** [R4.5](../roteiro-de-implementacao.md) (Fase 4)
- **Referências:** plano técnico do backend §8, [ADR-0002](../adr/0002-contratos-api-talhao-e-recomendacao.md), `projeto/frontend/src/repositories/httpClient.ts`

---

## 1. Descrição e motivação

- **Cache:** o plano técnico §8 pede `Cache-Control: public, max-age=86400` em `/recomendacao`, porque os
  dados só mudam quando o pipeline roda. Com sinal fraco no campo, o navegador (ou uma CDN) pode
  responder de novo sem ir à API. A API não mandava cabeçalho nenhum.
- **422:** os erros de domínio já saíam em problem+json (`type`, `title`, `status`, `detail`, `code`),
  mas o 422 de parâmetro inválido (ex.: `colheita=invalida`, `lat=-91`, `nematoide=talvez`) saía no
  formato padrão do FastAPI (`{"detail": [...]}`, `application/json`), sem `code`.

---

## 2. Sub-tarefas (TDD)

### 2.1 Testes de controller (`tests/integration/controllers/test_recomendacao_controller.py`)
- [x] 422 em problem+json para colheita inválida, `lat` fora do intervalo e `nematoide` inválido:
  `content-type: application/problem+json`, `type` `.../INVALID_REQUEST`, `title`, `status` 422,
  `code` `INVALID_REQUEST`, `detail` com o campo e `invalid_params` com `name`, `in` e `reason`.
- [x] Vários campos inválidos de uma vez: todos em `invalid_params` e `detail` no plural.
- [x] 200 com `Cache-Control: public, max-age=86400` e `Vary` com `Accept-Language`.
- [x] 404 (`OUTSIDE_AREA`) e 422 sem `Cache-Control` (guarda contra regressão: já passava antes).

**Red:** 5 testes falhando pelo motivo esperado:
- `AssertionError: assert 'application/json' == 'application/problem+json'` (os três casos de 422);
- `KeyError: 'invalid_params'`;
- `KeyError: 'cache-control'`.

Depois, um teste a mais para o plural do `detail`:
`AssertionError: ... 'Parâmetro inválido: lat, colheita'.startswith('Parâmetros inválidos: ')`.

### 2.2 Código
- [x] `main.py`: handler de `RequestValidationError` no mesmo formato dos erros de domínio, com
  `code` estável `INVALID_REQUEST` e a extensão `invalid_params` (`name` = campo, `in` = `query`,
  `header`, `path` ou `body`, `reason` = mensagem do Pydantic). Vale para todas as rotas.
- [x] `recomendacao_controller.py`: `Cache-Control` e `Vary: Accept-Language` na resposta, só depois que o
  service devolve. Erro de domínio sai pelo handler do `main.py` e erro de validação nem chega ao
  controller, então nenhum dos dois leva cache.
- [x] `AGENTS.md` do backend: regras de "Erros" e "Cache HTTP" em "Regras das camadas".

---

## 3. Decisões

1. **Cache só em `/recomendacao`.** O plano técnico §8 só pede para ela. `/exemplo` e `/talhao` ficam
   sem cabeçalho de cache. O `/talhao` pode disparar a busca sob demanda quando o R1.1 ligar, e a
   resposta muda de "fora da área" para "dentro" sem o pipeline rodar.
2. **`Vary: Accept-Language`.** A resposta muda com o idioma (pt/en, RNF-03). Sem o `Vary`, um cache
   público poderia servir o texto em português a quem pediu inglês. O `GZipMiddleware` e o CORS somam
   `Accept-Encoding` e `Origin` ao mesmo cabeçalho.
3. **`invalid_params`** segue o exemplo da RFC 7807/9457 (membro de extensão com `name` e `reason`),
   mais o `in` para dizer onde está o campo. O `detail` é curto e em português, como nos outros erros.
4. **O `code` fica no `main.py`** (`INVALID_REQUEST_CODE`), junto do handler. É um código de HTTP, não de
   regra de negócio, então não entra em `services/errors.py`.

---

## 4. Compatibilidade com o front (não alterado)

- O `httpClient.ts` lê só o `code` do corpo do erro (`readCode`), como string, e guarda no `ApiError`
  junto com o status. O `Response.json()` lê `application/problem+json` normalmente.
- Antes, um 422 de validação chegava ao front com `code: null` (o corpo padrão do FastAPI não tem `code`).
  Agora chega com `code: "INVALID_REQUEST"`. O único caso tratado à parte no front é o 404
  `OUTSIDE_AREA` (`isOutsideArea`), que não mudou. Nenhuma tela depende do formato antigo do 422.
- O cache não muda nada no front: as chamadas são `GET` com query params, e a URL (com `lat`, `lon`,
  `colheita` etc.) já é a chave do cache.

---

## 5. Fora do escopo

- O diagrama de sequência §6 ainda mostra o 404 como `{"detail": ...}`; os docs ficam com a tarefa 0010.
- Cabeçalhos de cache em `/exemplo` e `/talhao`: o plano não pede (decisão 1).
- `ETag` / `Last-Modified` pelo `versao_dados`: depende do R3.5.

---

## 6. Critérios de aceitação

1. **TDD:** os testes novos foram vistos falhando antes do código (seção 2.1).
2. `uv run pytest` (127 testes), `uv run ruff check .` e `uv run ruff format --check .` passando.
3. `pre-commit run --all-files`: todos os hooks passam, menos o `trailing-whitespace`, que já falhava no
   `main` por causa de `docs/como-funcionam-os-dados-de-satelite-e-postgis.md` (raiz e backend). A
   correção está na tarefa 0010 (branch `docs/backend-em-dia`), e esta branch não mexe nesses arquivos
   para não dar conflito.
