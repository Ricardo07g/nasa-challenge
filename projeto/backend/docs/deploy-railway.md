# Deploy na Railway

Como o Raiz Orbital roda na Railway: um projeto com 3 serviços (banco, backend e frontend). **O repositório é público:
nenhuma credencial entra no git.** Senhas e segredos ficam só nas variáveis da Railway. Aqui só aparecem os **nomes**.

## Serviços

| Serviço | Origem | Rede | O que faz |
| --- | --- | --- | --- |
| `db` | imagem `postgis/postgis:17-3.5` + volume em `/var/lib/postgresql/data` | só privada (TCP proxy só para carregar os dados, depois apagado) | PostgreSQL 17 + PostGIS 3.5 |
| `backend` | pasta `projeto/backend`, `Dockerfile` e `railway.json` | privada (domínio público opcional) | FastAPI. Antes de cada deploy roda `alembic upgrade head`. Volume em `/dados` com os arquivos de `data/baixados` |
| `frontend` | pasta `projeto/frontend`, `Dockerfile.prod` e `railway.json` | domínio público `*.up.railway.app` | build do Vite + Caddy (`Caddyfile`), que serve o site e repassa `/api/*` ao backend pela rede privada |

O backend e o front dormem depois de ~10 min sem acesso (`sleepApplication` no `railway.json`) e acordam no primeiro
pedido. O primeiro clique depois de um tempo parado leva alguns segundos a mais.

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
   - `railway volume add --service backend --mount-path /dados`;
   - o deploy sai de uma **cópia limpa do `main`** (um worktree), nunca da pasta de trabalho com o `.env`:
     `railway up --service backend` dentro de `projeto/backend` e `railway up --service frontend` dentro de
     `projeto/frontend`.
3. **Dados:**
   - **Banco:** criar um TCP proxy no `db` (`railway tcp-proxy create`) e carregar o dump só de dados (as tabelas já foram
     criadas pela migração do backend). Apagar o TCP proxy no fim.
   - **Arquivos:** `railway volume files upload <pasta> /dados/<pasta>` com as pastas de `data/baixados`, sem os caches
     brutos (`cache_*`).
4. **Domínio do front:** `railway domain --service frontend`. Depois, o `CORS_ORIGINS` do backend com esse domínio.

## Deploy automático

Com o repositório conectado aos serviços (painel da Railway → serviço → *Source* → GitHub, pasta `projeto/backend` ou
`projeto/frontend`, branch `main`), cada merge no `main` publica sozinho. A conexão pede, uma vez, a autorização do app
da Railway no GitHub do dono do repositório.
