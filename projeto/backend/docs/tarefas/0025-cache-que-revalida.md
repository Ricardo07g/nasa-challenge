# Tarefa 0025: Cache que revalida em `/recomendacao` (ETag e 304)

- **Identificador:** `0025`
- **Título:** Cache que revalida em `/recomendacao`: `public, no-cache` + `ETag` do corpo e 304
- **Status:** Concluída
- **Prioridade:** Alta (o navegador mostrava resposta velha depois da carga de dado novo)
- **Módulos afetados:** `projeto/backend/app/controllers/http_cache.py` (novo), `projeto/backend/app/controllers/recomendacao_controller.py`, `projeto/backend/tests/integration/controllers/test_recomendacao_controller.py`, `projeto/backend/AGENTS.md`, `projeto/backend/docs/diagrama-de-sequencias.md`, `projeto/backend/docs/roteiro-de-implementacao.md`
- **Roteiro:** ajusta o [R4.5](../roteiro-de-implementacao.md) ([tarefa 0011](0011-http-cache-e-422-problem-json.md))
- **Referências:** plano técnico do backend §8, RFC 9110 §8.8.3, §13.1.2 e §15.4.5, `projeto/frontend/src/repositories/httpClient.ts`

---

## 1. Descrição e motivação

A tarefa 0011 seguiu o plano técnico §8 e mandou `Cache-Control: public, max-age=86400` no
`/recomendacao`: o navegador usava a resposta guardada por até 24 h sem perguntar à API. A premissa
era "os dados só mudam quando o pipeline roda". Na prática, o time carrega dado novo no banco
(CMIP6, NDVI, solo) várias vezes durante o desenvolvimento e a demonstração, e o navegador continuava
com a resposta antiga.

**Caso real (validação interface × banco):** a fazenda de exemplo aparecia no navegador sem clima
futuro e com o solo padrão, enquanto a API já devolvia os dois.

**Decisão do dono do produto: revalidar sempre.** O navegador pode guardar a resposta, mas pergunta à
API toda vez se ela mudou (`ETag`). Se não mudou, a API responde **304** sem corpo. O dado novo aparece
no próximo pedido e, com sinal fraco no campo, o corpo (~6 kB, ~1,4 kB com gzip) só desce quando muda.

**Isto ajusta a regra do plano técnico §8** (`max-age=86400` vira `no-cache` + `ETag`). Motivo: com o
`max-age`, o dado carregado depois no banco ficava velho no navegador por até um dia.

---

## 2. Sub-tarefas (TDD)

### 2.1 Testes de controller (`tests/integration/controllers/test_recomendacao_controller.py`)
- [x] 200 com `Cache-Control: public, no-cache`, `ETag` forte igual ao SHA-256 do corpo (32 dígitos
  hexadecimais, entre aspas) e `Vary` com `Accept-Language` (substitui o teste do `max-age`).
- [x] `If-None-Match` igual ao ETag: **304**, corpo vazio, mesmo `ETag`, mesmo `Cache-Control` e o
  mesmo conjunto de valores no `Vary` que o 200.
- [x] `If-None-Match` como navegadores e proxies mandam: `W/"..."`, lista (`"outra-versao", "..."`) e
  `*` dão 304.
- [x] Dado mudou depois de o navegador guardar: o repository de solo falso devolve primeiro o solo
  padrão e depois o do SoilGrids. Com o ETag antigo, a API responde **200** com o corpo novo
  (`entrada.solo` de `medio` para `argiloso`) e outro ETag.
- [x] Idiomas diferentes: ETags diferentes, e o ETag do português num pedido em inglês dá 200.
- [x] Erros (404 `OUTSIDE_AREA` e 422) sem `Cache-Control` e sem `ETag`, mesmo com `If-None-Match: *`
  (guarda contra regressão: já passava antes).

**Red:** 7 testes falhando pelo motivo esperado:
- `AssertionError: assert 'public, max-age=86400' == 'public, no-cache'`;
- `KeyError: 'etag'` (304, as três formas do `If-None-Match`, dado que mudou e idiomas).

### 2.2 Código
- [x] `app/controllers/http_cache.py` (novo, infraestrutura HTTP, sem regra de negócio):
  `strong_etag`, `etag_matches` (comparação fraca da RFC 9110 §13.1.2) e
  `revalidated_json_response`, que devolve o 200 com o corpo ou o 304 sem corpo, com os mesmos
  cabeçalhos.
- [x] `recomendacao_controller.py`: serializa o `RecomendacaoResponse` (`model_dump_json(by_alias=True)`,
  o mesmo que o FastAPI faz com o `response_model`), lê o `If-None-Match` como `Header` e entrega ao
  helper. Continua só depois que o service devolve: erro de domínio ou de validação não leva cache
  nem ETag. O `response_model` fica, então o OpenAPI não muda (e passa a listar o `If-None-Match`).
- [x] `AGENTS.md` do backend: regra "Cache HTTP" reescrita.
- [x] `diagrama-de-sequencias.md` (304 × 200) e roteiro (linha do R4.5).

---

## 3. Cabeçalhos (repositories falsos dos testes, pedido com `Accept-Encoding: gzip`)

200:

```
cache-control: public, no-cache
etag: "19d308456ab75ca607298f6c1fef841b"
vary: Accept-Language, Origin, Accept-Encoding
content-type: application/json
content-encoding: gzip
content-length: 1370
```

304 (mesmo pedido com `If-None-Match: "19d308456ab75ca607298f6c1fef841b"`):

```
cache-control: public, no-cache
etag: "19d308456ab75ca607298f6c1fef841b"
vary: Accept-Language, Accept-Encoding, Origin
```

O `Origin` vem do `CORSMiddleware` e o `Accept-Encoding` do 200 vem do `GZipMiddleware`.

---

## 4. Decisões

1. **`public, no-cache`** (e não `no-store` nem `max-age` curto). `no-cache` deixa guardar, mas obriga a
   revalidar antes de usar. É o que o dono do produto pediu: dado sempre atual, corpo só quando muda.
2. **ETag do corpo serializado, não do `versao_dados`.** O `versao_dados` ainda é uma constante
   (`DATA_VERSION`) até o R3.5 e não muda quando entra solo, NDVI ou CMIP6 novo. O hash do corpo muda
   sempre que a resposta muda, inclusive com o idioma. Custo: a API ainda calcula a recomendação para
   responder 304 (< 1 s, plano técnico §8). O ganho é a banda, que é o que importa no sinal fraco.
3. **ETag forte, comparação fraca.** O ETag é forte (o corpo é o mesmo byte a byte), como pedido. O
   `If-None-Match` usa a comparação fraca, como manda a RFC 9110 §13.1.2: um proxy que comprime pode
   trocar o ETag por `W/"..."`, e ainda é a mesma versão. Lista de ETags e `*` também valem.
4. **32 dígitos hexadecimais** (128 bits) do SHA-256: sobra para distinguir as versões de uma URL e
   deixa o cabeçalho curto.
5. **O 304 leva o mesmo `Vary` do 200** (RFC 9110 §15.4.5). O `GZipMiddleware` só soma
   `Accept-Encoding` a respostas com corpo de 500 bytes ou mais, e o 304 não tem corpo. Por isso o
   helper põe `Accept-Encoding` no `Vary` do 304 (`COMPRESSION_VARY`). Se o GZip sair do `main.py`, o
   teste do 304 falha e avisa.
6. **Helper em `app/controllers/`.** Cálculo de ETag e 304 é HTTP, não regra de negócio: não vai para
   `services/`. O helper fica fora do controller para servir a outra rota no futuro.
7. **Só `/recomendacao`.** `/exemplo` e `/talhao` continuam sem cabeçalho de cache (decisão 1 da
   tarefa 0011). Sem `Cache-Control`, `Last-Modified` nem `ETag`, o navegador não reaproveita essas
   respostas sem pedir de novo.

---

## 5. Compatibilidade com o front (não alterado)

- O `httpClient.ts` chama `fetch(path)` (ou com `Accept-Language`) no modo de cache padrão. Com
  `no-cache` + `ETag`, o próprio navegador manda o `If-None-Match` e, no 304, entrega ao `fetch` a
  resposta guardada como **200** com o corpo. O `response.ok` e o `response.json()` funcionam como
  antes. O front não lê nem manda `ETag` / `If-None-Match` por conta própria, então nunca vê o 304.
- O proxy do Vite (`/api` → backend) repassa os dois cabeçalhos.
- O cache em memória do `farmService.ts` vale só enquanto a página está aberta: recarregar a página
  já pede de novo à API (e agora a API confere o ETag).

---

## 6. Fora do escopo

- ETag pelo `versao_dados` (para responder 304 sem calcular a recomendação): depende do R3.5.
- Cache em `/exemplo` e `/talhao`.

---

## 7. Critérios de aceitação

1. **TDD:** os testes novos foram vistos falhando antes do código (seção 2.1).
2. O corpo JSON do 200 ficou igual, byte a byte, ao de antes da mudança (pt e en, conferido com os
   repositories falsos dos testes).
3. `uv run pytest` (598 passando, 47 pulados sem banco de teste), `uv run ruff check .` e
   `uv run ruff format --check .` passando.
4. `pre-commit run --all-files` passando.
