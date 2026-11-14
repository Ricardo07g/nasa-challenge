# Como preparar os dados locais

Roteiro para quem vai rodar e testar o Raiz Orbital na própria máquina (pessoas e agentes de código).
Sem estes dados, a aplicação funciona, mas só com o NASA POWER buscado na hora do clique e sem
alguns cartões (clima futuro, histórico do talhão).

> **Repositório público:** nada desta página vai para o git. A pasta `data/` está no `.gitignore`.
> O pacote de dados circula só por canal interno do time (Drive, por exemplo), nunca pelo GitHub.

## O que a aplicação usa e onde fica

| Dado | Fonte | Onde fica | O que aparece na tela | Como conseguir |
| --- | --- | --- | --- | --- |
| Clima diário de 20 anos (chuva, temperatura, ETo) | NASA POWER | banco (`grid_cell`, `climate_season`) | chance de dar certo, chuva dos 20 anos | pré-carga, ou na hora do 1º clique (busca sob demanda) |
| Solo (argila e areia → CAD) | SoilGrids (ISRIC) | banco (`soil_point`) | "Terra argilosa / média / arenosa · Do mapa de solos" | pré-carga, ou no 1º clique |
| Clima futuro (2041–2060 × 1995–2014) | NEX-GDDP-CMIP6 | arquivo `data/baixados/nasa_nex_gddp_cmip6/cmip6_deltas_nex_gddp.json` e, depois da carga, banco (`cmip6_delta`) | "Clima dos próximos anos" e a nota de futuro | script `fetch_cmip6_deltas` + carga no banco |
| Histórico do talhão (NDVI) | MODIS pelo AppEEARS | arquivo `data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json` e, depois da carga, banco (`ndvi_point`) | "Sua área ficou parada em X de Y anos" e a colheita sugerida | script `fetch_ndvi` (chega com o PR do R2.2) + carga no banco |

O `docker compose` monta `data/baixados/` dentro do backend (só leitura, em `/dados_baixados`) e
aponta `CMIP6_PATH` e `NDVI_CACHE_PATH` para os arquivos acima. Arquivo ausente = a API segue sem
aquele dado, sem erro.

## Caminho rápido: receber o pacote de alguém do time (~5 min)

1. Peça o `dados_baixados.zip` para quem já baixou e descompacte **na raiz do repositório**. Tem
   de ficar `data/baixados/LEIA-ME.md`, `data/baixados/nasa_nex_gddp_cmip6/...` etc.
2. Suba o ambiente (o serviço `migration` cria as tabelas):

   ```bash
   cd projeto
   docker compose up -d --build
   ```

3. Carregue a cópia do banco (clima e solo da caixa piloto, e os deltas do CMIP6 e o NDVI que
   quem gerou o pacote carregou; você não precisa rodar a carga dos arquivos). Ela entra em
   tabelas **vazias**: se o seu banco já tem dados de outros testes, esvazie as tabelas de dados
   antes.

   ```bash
   docker compose exec -T db psql -U raiz -d raiz_orbital -c \
     "truncate climate_season, soil_point, cmip6_delta, ndvi_point, smap_point, data_run, grid_cell cascade"
   docker compose exec -T db psql -U raiz -d raiz_orbital < ../data/baixados/banco_local/dados_<data>.sql
   ```

4. Reinicie o backend (o arquivo do CMIP6 é lido uma vez por processo):

   ```bash
   docker compose restart backend
   ```

5. Confira (seção "Como conferir").

## Caminho do zero: baixar tudo

Pré-requisitos: Docker (OrbStack no Mac), [uv](https://docs.astral.sh/uv/) e o compose de pé
(`cd projeto && docker compose up -d`). Os comandos abaixo rodam de `projeto/backend`.

| Etapa | Comando | Tempo | Credencial |
| --- | --- | --- | --- |
| Clima e solo da caixa piloto (banco) | `DATABASE_URL=postgresql://raiz:raiz_local@localhost:5433/raiz_orbital uv run python -m pipeline.preload_pilot_box` | ~1 h (pausa de 12 s entre pedidos ao SoilGrids); o clima fica pronto nos primeiros minutos | nenhuma |
| Clima futuro da fazenda de exemplo | `uv run python -m pipeline.fetch_cmip6_deltas --pontos="-18.9543,-48.1993" --saida ../../data/baixados/nasa_nex_gddp_cmip6/cmip6_deltas_nex_gddp.json --cache ../../data/baixados/nasa_nex_gddp_cmip6/cache_ncss` | ~40 min (360 pedidos) | nenhuma |
| Clima futuro da caixa piloto inteira | o mesmo, sem `--pontos` | ~8 h (4.320 pedidos); se parar, rode de novo que continua do cache | nenhuma |
| Histórico do talhão (NDVI) | chega com o PR do R2.2 (`pipeline/fetch_ndvi.py`) | depende da fila do AppEEARS (minutos a horas) | `APPEEARS_TOKEN` ou `EARTHDATA_USERNAME` + `EARTHDATA_PASSWORD` no `projeto/backend/.env` |
| Carregar os arquivos no banco (`cmip6_delta` e `ndvi_point`) | `DATABASE_URL=postgresql://raiz:raiz_local@localhost:5433/raiz_orbital uv run python -m pipeline.load_files_to_db --cmip6 ../../data/baixados/nasa_nex_gddp_cmip6/cmip6_deltas_nex_gddp.json --ndvi ../../data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json` | segundos | nenhuma |

- A pré-carga é idempotente: rodar de novo só completa o que faltou (por exemplo, solos em que o
  SoilGrids não respondeu). Solo sem dado no mapa (área urbana) nunca é gravado.
- **Carga dos arquivos no banco** (tarefa 0022): rode **depois** da pré-carga, porque o
  `cmip6_delta` só aceita célula que já está em `grid_cell`. Cada célula do banco recebe os deltas
  do ponto do arquivo que cobre o centro dela; célula sem cobertura fica sem deltas. Do NDVI entra
  só o que cabe na tabela (registro sem `produto` ou `qualidade`, de cache antigo, conta como
  pulado no resumo).
  - Comece com `--dry-run` (só lê os arquivos e mostra o resumo). Dá para passar só um dos
    arquivos (`--cmip6` ou `--ndvi`). Arquivo ausente, de outra fonte ou fora do contrato: nada é
    gravado.
  - Idempotente: rodar de novo regrava as mesmas linhas, sem duplicar. Cada execução põe uma linha
    por fonte em `data_run`, com a versão do arquivo.
  - Célula criada **depois** da carga (busca sob demanda, num clique fora das células já
    gravadas) não tem linha no `cmip6_delta`, mas a API continua achando os deltas no arquivo
    (ordem tabela → arquivo). Para copiar essas células para a tabela, rode a carga de novo.
  - Quem recebe o pacote do time **não precisa** rodar a carga: a cópia do banco já leva as
    duas tabelas.
- Cada script grava o log da execução se você redirecionar a saída, por exemplo
  `... > ../../data/baixados/logs/<script>_$(date +%Y%m%d_%H%M).log 2>&1`.
- Depois de baixar, reinicie o backend (`docker compose restart backend`).

## Gerar o pacote para passar ao time

Antes, rode a carga dos arquivos no banco (última linha do caminho do zero), para a cópia do banco
levar o `cmip6_delta` e o `ndvi_point`. Da pasta `projeto`:

```bash
docker compose exec -T db pg_dump -U raiz -d raiz_orbital --data-only \
  -t grid_cell -t climate_season -t soil_point -t cmip6_delta -t ndvi_point -t smap_point -t data_run \
  > ../data/baixados/banco_local/dados_$(date +%Y%m%d).sql
cd .. && zip -r dados_baixados.zip data/baixados -x "*.DS_Store"
```

O zip fica na raiz do repositório (também fora do git). Ele não leva `.env` nem token.

## Como conferir

```bash
# fazenda de exemplo: dados[] deve listar nasa_power e, com o arquivo do CMIP6, nex_gddp_cmip6
curl -s "localhost:8000/api/talhao?lat=-18.9543&lon=-48.1993" | python3 -m json.tool

# o que está no banco
cd projeto && docker compose exec -T db psql -U raiz -d raiz_orbital -c \
  "select 'células', count(*) from grid_cell union all select 'temporadas', count(*) from climate_season union all select 'solos', count(*) from soil_point union all select 'deltas cmip6', count(*) from cmip6_delta union all select 'ndvi', count(*) from ndvi_point"
```

Na interface (http://localhost:5173/satelite?lat=-18.9543&lon=-48.1993&colheita=meio):

| Cartão | Com os dados | Sem os dados |
| --- | --- | --- |
| Chuva | "20 anos de chuva daqui" (ou menos, se algum ano não tinha dado completo) | igual: vem do NASA POWER na hora |
| Solo | "Terra … · Do mapa de solos" | "Não achamos no mapa de solos; usamos terra média" |
| Clima dos próximos anos | ✓ pronto (só onde há deltas: hoje, a região da fazenda de exemplo) | "Ainda não disponível para esta área" |
| Histórico do talhão | faixa de 2016 a 2025 | não aparece (ou "Ainda não conectado") |

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Mudou o código ou baixou dado e a tela não mudou | o backend não recarregou | `docker compose restart backend` |
| Erro na API sobre tabela ou coluna | banco sem a migração mais nova | `docker compose up -d` (o serviço `migration` aplica) |
| NDVI: 401/403 no AppEEARS | o `APPEEARS_TOKEN` venceu (dura ~48 h) | ponha `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD` no `.env` ou gere outro token |
| IMERG: 403 "EULA Acceptance Failure" | falta aceitar a EULA do GES DISC | perfil da Earthdata → *Applications → Authorized Apps* → *NASA GESDISC DATA ARCHIVE* |
| Restaurar a cópia do banco dá "duplicate key" | o banco já tinha dados | esvazie as tabelas (passo 3 do caminho rápido) |

## Regras para agentes de código (Claude, Gemini)

- Nunca leia, copie ou imprima o `projeto/backend/.env`. Para testar um token, use só o código HTTP.
- Nunca commite nada de `data/` (dado bruto, cache, dump, zip).
- Testes automáticos usam um banco **só de teste** (`TEST_DATABASE_URL`), nunca o `raiz_orbital`.
- Rodar a pré-carga ou os scripts de download grava no banco e na pasta do usuário: combine antes
  com a pessoa dona da máquina.
