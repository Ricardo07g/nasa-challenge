# Deploy na Railway

Como o Raiz Orbital roda na Railway: um projeto com 3 serviços (banco, backend e frontend). **O repositório é público:
nenhuma credencial entra no git.** Senhas e segredos ficam só nas variáveis da Railway. Aqui só aparecem os **nomes**.

## Serviços

| Serviço | Origem | Rede | O que faz |
| --- | --- | --- | --- |
| `db` | imagem `postgis/postgis:17-3.5` + volume em `/var/lib/postgresql/data` | só privada (nenhuma porta pública) | PostgreSQL 17 + PostGIS 3.5, a mesma imagem do compose |
| `backend` | pasta `projeto/backend`, `Dockerfile` e `railway.json` | privada (domínio público opcional) | FastAPI. Antes de cada deploy roda `alembic upgrade head`. Volume em `/dados` com os arquivos de `data/baixados` |
| `frontend` | pasta `projeto/frontend`, `Dockerfile.prod` e `railway.json` | domínio público `*.up.railway.app` | build do Vite + Caddy (`Caddyfile`), que serve o site e repassa `/api/*` ao backend pela rede privada |

**Agora (desde 16/11/2026, semana da avaliação): os três serviços ficam ligados 24/7** (`sleepApplication: false`).
Custo medido: ~US$ 3 a 4 por mês de uso, dentro dos US$ 5 incluídos no plano Hobby. Motivo: no teste com a API e o
banco dormindo, o site abriu na hora e o Caddy segurou a API (sem 502), mas 2 de 7 chamadas que usam o banco deram 500:
a API conectou enquanto o banco ainda subia (`server closed the connection unexpectedly`).

**Para voltar a economizar depois da avaliação:** ligar o `sleepApplication` do `backend` e do `db` pela API
(`serviceInstanceUpdate`), pôr `true` no `projeto/backend/railway.json` e fazer um deploy novo de cada um (abaixo).
Antes, resolver o 500 do banco acordando: deixar o `db` ligado (~US$ 0,90 por mês) ou fazer a API tentar a conexão de
novo por alguns segundos. O `frontend` fica sempre ligado de qualquer jeito (~US$ 0,45 por mês).
- **Acordar a cadeia (quando o modo dormindo estiver ligado):** o Caddy repassa o `/api/*` e, se o backend ainda está acordando, tenta de novo a cada 500 ms
  por até 20 s (`lb_try_duration` no `Caddyfile`), em vez de responder 502. O banco pode dormir porque a API abre uma
  conexão nova a cada pedido (sem pool): a conexão do backend acorda o `db` pela rede privada. O primeiro clique depois
  de um tempo parado leva ~4 a 5 s (medido em 15/11/2026).
- **Mudou a configuração de um serviço?** Ela só vale num deploy novo. O `railway redeploy` reaproveita a configuração do
  deploy anterior: use `railway up` ou a mutação `serviceInstanceDeployV2` e confira o `meta.serviceManifest` do deploy
  (foi assim que o `db` ficou sem dormir até 15/11/2026).

**O backend escuta em `0.0.0.0`, não em `::`.** O asyncio abre o socket IPv6 só para IPv6 (`IPV6_V6ONLY`), e o health
check da Railway chega por IPv4: com `--host ::` o deploy falha com "replicas never became healthy". A rede privada
deste projeto aceita IPv4, e o Caddy do front alcança o backend assim.

## Variáveis (só nomes; os valores ficam no painel da Railway)

- **`db`:** `POSTGRES_USER`, `POSTGRES_PASSWORD` (gerada aleatória), `POSTGRES_DB`, `PGDATA`
  (`/var/lib/postgresql/data/pgdata`, porque o volume tem `lost+found` na raiz).
- **`backend`:**
  - `DATABASE_URL`, montada com as referências do `db` (`${{db.POSTGRES_USER}}`, `${{db.POSTGRES_PASSWORD}}`,
    `${{db.RAILWAY_PRIVATE_DOMAIN}}`, `${{db.POSTGRES_DB}}`);
  - `COMMUNITY_DEVICE_SALT`, gerado aleatório;
  - `PORT`;
  - `CORS_ORIGINS`;
  - os caminhos dos arquivos: `CMIP6_PATH`, `NDVI_CACHE_PATH`, `NDVI_AREA_PATH`, `REGIAO_PATH`, `ONI_PATH`,
    `ENSO_PREVISAO_PATH`, `SMAP_PATH`, `SMAP_RECENTE_PATH`, `SOJA_RECENTE_PATH`, `AREA_QUEIMADA_PATH`, todos dentro de
    `/dados/...`.
- **`frontend`:** `BACKEND_URL` (`http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}`).
- **Não vão para a Railway:** `EARTHDATA_TOKEN`, `APPEEARS_TOKEN`, `EARTHDATA_USERNAME` e `EARTHDATA_PASSWORD`. Só os
  scripts do `pipeline/` usam essas credenciais; a API não precisa de nenhuma.

## Primeiro deploy (CLI da Railway, `railway login` feito pela pessoa dona da conta)

1. **Projeto e banco:**
   - `railway init`;
   - `railway add --service db --image postgis/postgis:17-3.5` com as variáveis do `db`;
   - `railway volume add --service db --mount-path /var/lib/postgresql/data`.
2. **Backend e frontend:**
   - `railway add --service backend` e `railway add --service frontend`, com as variáveis acima;
   - `railway volume add --mount-path /dados` com o backend ligado (`railway service link backend`; o `--service`
     não funciona nesse comando);
   - **o `railway up` não aplica o `railway.json`**: as configurações de cada serviço (Dockerfile, start, pre-deploy,
     health check e `sleepApplication`) vão pela API (`railway api` com a mutação `serviceInstanceUpdate`), com os
     mesmos valores do `railway.json`. Sem isso, o front sobe com o `Dockerfile` de desenvolvimento;
   - o deploy sai de uma **cópia limpa do `main`** (um worktree), nunca da pasta de trabalho com o `.env`, a partir da
     raiz do repositório: `railway up projeto/backend --path-as-root --service backend` e
     `railway up projeto/frontend --path-as-root --service frontend`.
3. **Dados:**
   - **Banco, sem abrir porta pública:**
     1. dump só de dados das tabelas do app (`grid_cell`, `climate_season`, `soil_point`, `cmip6_delta`,
        `ndvi_point`, `smap_point`, `data_run`), com `pg_dump --data-only --no-owner --no-privileges -t ...`
        no banco local; as tabelas já foram criadas pela migração do backend;
     2. `railway volume files --volume db-volume upload dados.sql /carga_dados.sql`;
     3. `railway ssh --service db` e `psql -v ON_ERROR_STOP=1 -1 -f /var/lib/postgresql/data/carga_dados.sql`;
     4. conferir as contagens com as do banco local e apagar o arquivo do volume
        (`railway volume files --volume db-volume delete /carga_dados.sql --yes`, num terminal fora do Claude Code: o CLI
        recusa apagar arquivo quando roda dentro de um agente).
   - **Arquivos:** só os 9 arquivos que os `*_PATH` apontam (~4 MB), cada um na sua pasta:
     `railway volume files --volume backend-volume upload <pasta> /<pasta>`. Os caches brutos (`cache_*`) e o NDVI
     por área completo não vão. Depois, reiniciar o backend.
4. **Domínio do front:** `railway domain --service frontend`. O `CORS_ORIGINS` não é preciso: o navegador só fala
   com o domínio do front, que repassa o `/api/*` ao backend.

## Deploy automático (GitHub Actions)

Cada merge no `main` publica sozinho pelo workflow `.github/workflows/ci-cd.yml` (detalhes no `AGENTS.md` da raiz,
seção "CI/CD"): com o CI verde, o `.github/scripts/railway-deploy.sh` roda `railway up` só no serviço que mudou desde
o último deploy dele, com a mensagem `commit <sha>`, e espera o SUCCESS. *Run workflow* no `main` publica à mão.

- **Token:** um token do projeto na Railway (ambiente `production`, nome `github-actions`), guardado só no secret
  `RAILWAY_TOKEN` do ambiente `production` do GitHub, que libera só para o `main`. Para trocar: crie outro token
  (Railway → projeto → *Settings* → *Tokens*) e rode `gh secret set RAILWAY_TOKEN --env production` colando o valor;
  depois apague o antigo no painel.
  O script confere o token antes de tudo (consulta `projectToken` da API) e diz no log de que projeto e ambiente
  ele é, ou se é um token de conta ou inválido. As consultas (serviços, deploys, status, `COMMIT_SHA`) vão direto
  à API GraphQL com o cabeçalho `Project-Access-Token`; só o upload usa o CLI (`railway up`).
- **Carimbo da versão:** antes de cada `railway up`, o script grava a variável `COMMIT_SHA` no serviço
  (`--skip-deploys`). O backend devolve no `/api/health` (`commit`) e o build do front grava `/versao.json`; o job
  `Site no ar` confere que os dois estão no commit do merge.
- **Não conecte o GitHub nos serviços da Railway** (*Source* → GitHub): o deploy sairia duas vezes, e sem esperar o
  CI.
- O deploy feito à mão da máquina (`railway up` sem `--message "commit <sha>"`) faz o próximo deploy do CI publicar de
  novo, porque o CI não sabe qual commit está no ar.

**Atenção:** a Railway avisa que o `railway.json` (config-as-code) deixa de valer depois de 01/12/2026. Antes disso,
migrar para o formato novo de infraestrutura como código da Railway, ou manter as configurações pela API.
