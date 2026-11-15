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
| Histórico do talhão (NDVI) | MODIS (MOD13Q1 + MYD13Q1) pelo AppEEARS ou pela ORNL DAAC | arquivo `data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json` (o mesmo nome para as duas fontes) e, depois da carga, banco (`ndvi_point`) | "Sua área ficou parada em X de Y anos" e a colheita sugerida | script `fetch_ndvi` + carga no banco |
| Chuva diária em 0,1° (refinamento da chuva do POWER) | GPM IMERG Final (`GPM_3IMERGDF` v07) pelo OPeNDAP do GES DISC | arquivo `data/baixados/nasa_gpm_imerg/imerg_diario_caixa.json` e, depois da carga, a chuva dos anos completos no banco (`climate_season`, `rain_source = gpm_imerg`) | "Chuva mais detalhada" conectada (10 km) e "(GPM IMERG + NASA POWER)" no "Por quê?" | script `fetch_imerg` + carga no banco (`--imerg`) |
| El Niño / La Niña de cada safrinha | ONI da NOAA (não é da NASA) | arquivo `data/baixados/noaa_oni/oni.json` (só arquivo, sem tabela) | a marca de El Niño / La Niña nos quadrinhos de chuva e na frase de cada ano | script `fetch_oni` |
| Região pelo satélite (lavoura parada na entressafra, num raio de 30 km) | MODIS (MOD13Q1, MYD13Q1 e o uso do solo MCD12Q1) pela ORNL DAAC | arquivo `data/baixados/nasa_modis_ndvi_regiao/regiao_ndvi_modis.json` (sem tabela ainda) | "Na sua região": a área de lavoura parada, ano a ano | script `fetch_regiao_ndvi` |
| Chuva dos últimos 30 dias × média | GPM IMERG Late (`GPM_3IMERGDL`) + NASA POWER já no banco | arquivo `data/baixados/nasa_gpm_imerg_late/chuva_30d_imerg_late.json` | "Sinal para o outono" (junto com o SMAP recente; só a chuva não acende o sinal) | script `fetch_imerg_late`, perto do plantio (fev/mar) |
| Umidade da terra no dia de plantar (2016–2025) | SMAP L4 (`SPL4SMGP` 008) pelo OPeNDAP da Earthdata | arquivo `data/baixados/nasa_smap/smap_semeadura.json` e, depois da carga, banco (`smap_point`) | ainda nada: o balde inicial pelo SMAP é o R3.3 (até lá, 50% da CAD) | script `fetch_smap` + carga no banco |

O `docker compose` monta `data/baixados/` dentro do backend (só leitura, em `/dados_baixados`) e
aponta `CMIP6_PATH`, `NDVI_CACHE_PATH`, `ONI_PATH`, `REGIAO_PATH`, `IMERG_LATE_PATH` e `SMAP_PATH`
para os arquivos acima. Arquivo ausente = a API segue sem aquele dado, sem erro (o `/api/regiao` responde 404 `OUTSIDE_AREA`).

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
| Clima futuro da caixa piloto inteira | `uv run python -m pipeline.fetch_cmip6_deltas --area` | ~45 min (378 pedidos ao OPeNDAP, um por arquivo para a caixa toda); se parar, rode de novo que continua do cache | nenhuma |
| Clima futuro só da fazenda de exemplo | `uv run python -m pipeline.fetch_cmip6_deltas --pontos="-18.9543,-48.1993"` | ~40 min (360 pedidos ao NCSS, um ponto por pedido) | nenhuma |
| Histórico do talhão (NDVI) pelo AppEEARS | `uv run python -m pipeline.fetch_ndvi --pontos="-18.9543,-48.1993"` | depende da fila do AppEEARS (minutos a horas) | `APPEEARS_TOKEN` ou `EARTHDATA_USERNAME` + `EARTHDATA_PASSWORD` no `projeto/backend/.env` |
| Histórico do talhão (NDVI) pela ORNL | `uv run python -m pipeline.fetch_ndvi --fonte ornl --pontos="-18.9543,-48.1993"` | ~1,6 h por ponto (64 pedidos, sem fila; vários dão 502 e são repetidos); se parar, rode de novo que continua do cache | nenhuma |
| Chuva do IMERG da caixa piloto (2005–2024) | `uv run python -m pipeline.fetch_imerg` (antes: `--dry-run`; para conferir: `--anos 2024`) | até ~2,2 h (4.240 recortes, um por dia, 6 em paralelo); se parar, rode de novo que continua do cache | `EARTHDATA_TOKEN` no `projeto/backend/.env`, com o aplicativo *NASA GESDISC DATA ARCHIVE* autorizado e a EULA do GES DISC aceita |
| Umidade da terra nos dias de semeadura (SMAP) | `uv run python -m pipeline.fetch_smap --dry-run` e depois `uv run python -m pipeline.fetch_smap` | ~6 min (720 recortes de ~2 s, 4 em paralelo, mais 30 buscas no CMR); se parar, rode de novo que continua do cache | `EARTHDATA_TOKEN` no `projeto/backend/.env` |
| Carregar os arquivos no banco (`cmip6_delta`, `ndvi_point`, `smap_point` e a chuva do IMERG no `climate_season`) | `DATABASE_URL=postgresql://raiz:raiz_local@localhost:5433/raiz_orbital uv run python -m pipeline.load_files_to_db --cmip6 ../../data/baixados/nasa_nex_gddp_cmip6/cmip6_deltas_nex_gddp.json --ndvi ../../data/baixados/nasa_modis_ndvi/ndvi_modis_appeears.json --imerg ../../data/baixados/nasa_gpm_imerg/imerg_diario_caixa.json --smap ../../data/baixados/nasa_smap/smap_semeadura.json` | segundos | nenhuma |
| El Niño / La Niña de cada safrinha (ONI) | `uv run python -m pipeline.fetch_oni` | segundos (1 pedido de ~23 KB à NOAA) | nenhuma |
| Região pelo satélite (fazenda de exemplo, raio de 30 km) | `uv run python -m pipeline.fetch_regiao_ndvi` | ~20 min (41 pedidos à ORNL de ~25 a 40 s; num 502 ele espera e tenta de novo); se parar, rode de novo que continua do cache | nenhuma |
| Chuva dos últimos 30 dias (sinal para o outono) | `uv run python -m pipeline.fetch_imerg_late` | ~2 min (1 a 2 pedidos ao CMR + 30 ao OPeNDAP, um por dia; estimativa, ainda não medido com token); se parar, rode de novo que continua do cache | `EARTHDATA_TOKEN` no `projeto/backend/.env` (com o *NASA GESDISC DATA ARCHIVE* autorizado) |

- A pré-carga é idempotente: rodar de novo só completa o que faltou (por exemplo, solos em que o
  SoilGrids não respondeu). Solo sem dado no mapa (área urbana) nunca é gravado.
- **Carga dos arquivos no banco** (tarefa 0022): rode **depois** da pré-carga, porque o
  `cmip6_delta` só aceita célula que já está em `grid_cell`. Cada célula do banco recebe os deltas
  do ponto do arquivo que cobre o centro dela; célula sem cobertura fica sem deltas. Do NDVI entra
  só o que cabe na tabela (registro sem `produto` ou `qualidade`, de cache antigo, conta como
  pulado no resumo).
  - Comece com `--dry-run` (só lê os arquivos e mostra o resumo). Dá para passar só um ou dois
    dos arquivos (`--cmip6`, `--ndvi`, `--smap`). Arquivo ausente, de outra fonte ou fora do
    contrato: nada é gravado.
  - Idempotente: rodar de novo regrava as mesmas linhas, sem duplicar. Cada execução põe uma linha
    por fonte em `data_run`, com a versão do arquivo.
  - Célula criada **depois** da carga (busca sob demanda, num clique fora das células já
    gravadas) não tem linha no `cmip6_delta`, mas a API continua achando os deltas no arquivo
    (ordem tabela → arquivo). Para copiar essas células para a tabela, rode a carga de novo.
  - **IMERG** (`--imerg`, tarefa 0027): troca a chuva do POWER pela do IMERG só nas temporadas
    que já estão no `climate_season` (rode depois da pré-carga) e só nos anos completos do IMERG
    (ano com dia sem dado fica com o POWER). O resumo conta as temporadas trocadas, as
    incompletas e as que não estão no banco. A chuva do POWER das temporadas trocadas não fica
    guardada: para voltar a ela, rode a pré-carga com `--forcar`.
  - Quem recebe o pacote do time **não precisa** rodar a carga: a cópia do banco já leva as
    tabelas (a chuva do IMERG vai junto no `climate_season`).
- O CMIP6 grava em `data/baixados/nasa_nex_gddp_cmip6/` (o JSON e o cache `cache_ncss/`) a partir
  da raiz do repositório, de qualquer pasta que você rode. Antes, veja o plano sem baixar nada:
  `uv run python -m pipeline.fetch_cmip6_deltas --dry-run --area` (pedidos e tempo nos dois modos).
  O `--area` cobre as 12 células do POWER da caixa, e cada uma sai igual ao que o modo por ponto
  daria. O arquivo da caixa substitui o da fazenda de exemplo (a célula da fazenda está nele).
- **NDVI: qual fonte usar.** As duas gravam o mesmo arquivo, no mesmo formato, em
  `data/baixados/nasa_modis_ndvi/` a partir da raiz do repositório (o
  `versao_dados.parametros.servico` diz de qual veio). Rodar uma depois da outra substitui o
  arquivo.
  - **AppEEARS** (padrão): um pedido só para todos os pontos, mas entra numa fila que pode levar
    horas (já ficou mais de 3 h em `pending`). Use quando tiver a credencial e tempo para esperar;
    se o limite de espera estourar, retome com `--tarefa-existente <id>` (o script mostra o id).
  - **ORNL** (`--fonte ornl`): sem credencial e sem fila, mas cada pedido leva de 19 a 60 s e o
    serviço às vezes corta em ~60 s (502). Use quando a fila do AppEEARS travar ou faltar
    credencial. Veja antes o plano: `uv run python -m pipeline.fetch_ndvi --fonte ornl --dry-run
    --pontos="..."` (pedidos, o que já está no cache e o tempo estimado; 3 pontos ~4,7 h). As
    respostas ficam em `cache_ornl/`; se terminar com código 2 (algum recorte sem resposta),
    rode o mesmo comando de novo, que só pede as datas que faltam. Recorte que dá 502 duas vezes é
    dividido sozinho em pedaços menores. `--datas-por-pedido` (padrão 5, máximo 10) e `--pausa`
    (padrão 5 s) ajustam o ritmo; dá para mudar de uma execução para outra sem perder o cache.
- O IMERG grava em `data/baixados/nasa_gpm_imerg/` (o JSON e o cache `cache_opendap/`) a partir
  da raiz do repositório. O `--dry-run` mostra pedidos, o que já está no cache e o tempo, sem rede.
  O primeiro recorte vai sozinho: se o GES DISC recusar (token vencido, aplicativo não autorizado
  ou EULA), o script para ali, sem insistir. Dia que falhou depois das retentativas: nada é
  gravado e o script pede para rodar de novo. Dia sem arquivo no GES DISC ou pixel vazio vira
  `null` no arquivo (nunca 0).
- O ONI grava em `data/baixados/noaa_oni/oni.json` a partir da raiz do repositório. Antes, veja o
  pedido sem baixar nada: `uv run python -m pipeline.fetch_oni --dry-run`. Ele cobre as safrinhas
  de 2005 a 2024 (as da série do motor; `--ano-inicio` e `--ano-fim` mudam isso) e imprime quais
  anos ficaram de El Niño, de La Niña e neutros. A regra do ano está no `regras.yaml` (grupo `enso`).
  Não precisa carregar no banco: a API lê o arquivo.
- **Região pelo satélite** (tarefa 0034): grava em `data/baixados/nasa_modis_ndvi_regiao/` o JSON
  e o cache `cache_ornl/` (uma resposta por pedido, em gzip; ~30 MB), a partir da raiz do
  repositório. Antes, veja os 41 pedidos sem baixar nada: `uv run python -m pipeline.fetch_regiao_ndvi
  --dry-run`. Outras regiões: `--centros "lat,lon;lat,lon"` (41 pedidos por centro) e `--raio-km`.
  A ORNL é pública, mas lenta e às vezes devolve 502: o script tenta de novo até 5 vezes por
  pedido (`--tentativas`) e, se desistir, o que já baixou fica no cache.
- A **chuva dos últimos 30 dias** compara o IMERG Late com a média do NASA POWER **guardado** nos
  mesmos dias (do banco, depois da pré-carga; sem `DATABASE_URL`, só a célula da fazenda de
  exemplo, pela fixture). O POWER guardado vai de 1/jan a 31/jul: rode de fevereiro a julho. Fora
  disso, o script avisa que não há média e não mexe no arquivo que já existe. Veja o plano antes
  com `uv run python -m pipeline.fetch_imerg_late --dry-run` (sem rede e sem token); `--fim
  AAAA-MM-DD` fixa o último dia somado e `--area="lat_min,lat_max,lon_min,lon_max"` troca a caixa.
- O SMAP (tarefa 0029) grava em `data/baixados/nasa_smap/` (o JSON `smap_semeadura.json` e o cache
  `cache_opendap/`). Ele pede à busca pública do CMR os 8 granulos de 3 h de cada dia de semeadura
  (08/02, 18/02 e 03/03, de 2016 a 2025) e recorta no OPeNDAP só o retângulo de pixels de 9 km da
  caixa piloto (~22 × 18 pixels), sem baixar os arquivos globais (~140 MB cada). Cada célula de 0,1°
  da caixa recebe a média do dia do pixel mais perto. O `--dry-run` não usa a rede nem o token.
  Token vencido (ele vale 60 dias): o script para na primeira resposta 401/403 e não grava nada no
  cache. Um ano ou uma caixa só: `--anos=2024`, `--area="lat_min,lat_max,lon_min,lon_max"`.
- Cada script grava o log da execução se você redirecionar a saída, por exemplo
  `... > ../../data/baixados/logs/<script>_$(date +%Y%m%d_%H%M).log 2>&1`.
- Depois de baixar, reinicie o backend (`docker compose restart backend`).

## Gerar o pacote para passar ao time

Antes, rode a carga dos arquivos no banco (última linha do caminho do zero), para a cópia do banco
levar o `cmip6_delta`, o `ndvi_point` e o `smap_point`. Da pasta `projeto`:

```bash
docker compose exec -T db pg_dump -U raiz -d raiz_orbital --data-only \
  -t grid_cell -t climate_season -t soil_point -t cmip6_delta -t ndvi_point -t smap_point -t data_run \
  > ../data/baixados/banco_local/dados_$(date +%Y%m%d).sql
cd .. && zip -r dados_baixados.zip data/baixados -x "*.DS_Store"
```

O zip fica na raiz do repositório (também fora do git). Ele não leva `.env` nem token.

## Como conferir

```bash
# fazenda de exemplo: dados[] deve listar nasa_power, com a carga do IMERG gpm_imerg e, com o
# arquivo do CMIP6, nex_gddp_cmip6
curl -s "localhost:8000/api/talhao?lat=-18.9543&lon=-48.1993" | python3 -m json.tool

# região pelo satélite (com o arquivo do fetch_regiao_ndvi): raio_km, fonte e os anos
curl -s "localhost:8000/api/regiao?lat=-18.9543&lon=-48.1993" | python3 -m json.tool

# o que está no banco
cd projeto && docker compose exec -T db psql -U raiz -d raiz_orbital -c \
  "select 'células', count(*) from grid_cell union all select 'temporadas', count(*) from climate_season union all select 'solos', count(*) from soil_point union all select 'deltas cmip6', count(*) from cmip6_delta union all select 'ndvi', count(*) from ndvi_point union all select 'smap', count(*) from smap_point"
```

Na interface (http://localhost:5173/satelite?lat=-18.9543&lon=-48.1993&colheita=meio):

| Cartão | Com os dados | Sem os dados |
| --- | --- | --- |
| Chuva | "20 anos de chuva daqui" (ou menos, se algum ano não tinha dado completo) | igual: vem do NASA POWER na hora |
| Solo | "Terra … · Do mapa de solos" | "Não achamos no mapa de solos; usamos terra média" |
| Clima dos próximos anos | ✓ pronto (só onde há deltas: a caixa piloto inteira com `--area`; só a região da fazenda de exemplo com `--pontos`) | "Ainda não disponível para esta área" |
| Histórico do talhão | faixa de 2016 a 2025 | não aparece (ou "Ainda não conectado") |
| Anos de chuva (tocar num ano) | ponto de El Niño / La Niña em cima dos anos e "Ano de El Niño." na frase | a frase de cada ano aparece igual, sem a marca |
| Na sua região (http://localhost:5173/comunidade) | "Em 2025, X% da área de lavoura ficou parada" e as barras de 2016 a 2025 | o bloco da região fica com erro (a API responde 404 `OUTSIDE_AREA`) |
| "Por quê?" de cada opção | frase do balde pelo SMAP (anos de 2016 em diante) | sem a frase; o balde começa em 50% da CAD |

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Mudou o código ou baixou dado e a tela não mudou | o backend não recarregou | `docker compose restart backend` |
| Erro na API sobre tabela ou coluna | banco sem a migração mais nova | `docker compose up -d` (o serviço `migration` aplica) |
| NDVI: 401/403 no AppEEARS | o `APPEEARS_TOKEN` venceu (dura ~48 h) | ponha `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD` no `.env` ou gere outro token |
| NDVI: tarefa do AppEEARS parada em `pending` por horas | fila do AppEEARS | use `--fonte ornl` (sem fila) |
| NDVI pela ORNL termina com código 2 | o serviço deu 502 ou ficou sem responder em algum recorte | rode o mesmo comando de novo (continua do cache); se a ORNL estiver fora do ar, tente mais tarde |
| SMAP: "a Earthdata recusou o token" (401/403) ou "página de login" | o `EARTHDATA_TOKEN` venceu (dura 60 dias) | gere outro em urs.earthdata.nasa.gov → *Generate Token* e troque no `.env` |
| IMERG: 403 "EULA Acceptance Failure" | falta aceitar a EULA do GES DISC | perfil da Earthdata → *Applications → Authorized Apps* → *NASA GESDISC DATA ARCHIVE* |
| IMERG: "O GES DISC recusou o acesso (HTTP 401 / página HTML)" | o `EARTHDATA_TOKEN` venceu (dura 60 dias) ou falta autorizar o aplicativo | gere outro token em urs.earthdata.nasa.gov e confira *Authorized Apps* |
| Região: "A ORNL não respondeu ... depois de 5 tentativas" | a ORNL está lenta ou fora (502) | rode o mesmo comando de novo mais tarde: continua do cache |
| Restaurar a cópia do banco dá "duplicate key" | o banco já tinha dados | esvazie as tabelas (passo 3 do caminho rápido) |

## Regras para agentes de código (Claude, Gemini)

- Nunca leia, copie ou imprima o `projeto/backend/.env`. Para testar um token, use só o código HTTP.
- Nunca commite nada de `data/` (dado bruto, cache, dump, zip).
- Testes automáticos usam um banco **só de teste** (`TEST_DATABASE_URL`), nunca o `raiz_orbital`.
- Rodar a pré-carga ou os scripts de download grava no banco e na pasta do usuário: combine antes
  com a pessoa dona da máquina.
