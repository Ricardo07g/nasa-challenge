# Raiz Orbital: plano técnico do backend

Nov 14, 2026 · complementa o [PRD](PRD%20–%20Raiz%20Orbital%20o%20que%20plantar%20depois%20da%20soja.md) (seções 6 a 9)

## 1. Resumo

O protótipo v3 pede ao produtor só **duas coisas**: onde fica a lavoura (um ponto) e quando ele colhe a soja (três faixas). Todo o resto vem dos dados: chuva, clima, solo, histórico do talhão e até a sugestão da data de colheita. Isso define o backend:

1. **Dados pesados são preparados antes** (pipeline offline), por célula de 0,1°, e guardados no PostGIS. A API nunca baixa dado da NASA durante a demo, com uma exceção (NDVI do ponto, com cache e fallback).
2. **A conta é feita na hora**, no service, a partir das séries guardadas. Simular 5 opções × 20 anos × 3 cenários de clima é barato (milissegundos), então não vale pré-calcular todas as combinações de colheita, solo e nematoide.
3. **A API devolve frases prontas**, não só números: "Deu certo em 14 de 20 anos", "Sobra perto de R$ 700/ha", rótulos Bom/Médio/Fraco. O front só desenha. Isso mantém a regra de negócio no service (AGENTS.md) e garante que o "por quê" bate com a conta.

```
                 ┌──────────────── offline (antes da demo) ────────────────┐
 NASA POWER ─┐   │ pipeline/                                               │
 GPM IMERG ──┼──►│ fetch_* → séries diárias por célula 0,1° → load_postgis  │──► PostGIS
 CMIP6 (EE) ─┘   │ cmip6_deltas → deltas mensais por célula                │
                 └─────────────────────────────────────────────────────────┘
                 ┌──────────────── online (API FastAPI) ───────────────────┐
 React ─HTTP──►  │ controllers → services (motor) → repositories ──► PostGIS│
                 │                                   └─► Earth Engine (NDVI, com cache)
                 │                                   └─► SoilGrids (solo, com cache)
                 └─────────────────────────────────────────────────────────┘
```

## 2. Fluxo do protótipo v3 e chamadas à API

| Tela | O que o usuário faz | Chamada | Observação |
| --- | --- | --- | --- |
| 1. Início | Toca em "Começar" ou "Ver um exemplo" | `GET /api/exemplo` (no exemplo) | Exemplo vem de fixture: abre instantâneo (RF-11) |
| 2. Onde fica | Marca o ponto ou usa o GPS | `GET /api/talhao?lat&lon` **disparado ao tocar "É aqui"** | Roda enquanto ele responde a tela 3 (esconde a latência do NDVI) |
| 3. Quando colhe | Escolhe cedo, meio ou tarde | (usa `colheita_sugerida` da chamada anterior) | Pré-seleciona a faixa sugerida pelo satélite |
| 4. O satélite viu | Só lê | (mesma resposta de `/talhao`) | Solo, histórico, chuva, clima |
| 5. Resposta | Lê; abre "Por quê?" | `GET /api/recomendacao?lat&lon&colheita` | Uma resposta + 3 alternativas |
| 6. Todas as opções | Reordena por chuva, dinheiro ou terra | (mesma resposta) | Reordenar é no navegador |
| 7. Plano de 3 anos | Alterna ano normal / ano seco | (mesma resposta) | Os dois cenários vêm juntos |
| "Ouvir" | Toca no botão | nenhuma | Leitura em voz pelo navegador (Web Speech API, pt-BR) |

Ter tudo em **GET com parâmetros na URL** dá três coisas de graça: a resposta pode ser recarregada ou compartilhada pelo navegador, cache HTTP e nenhum dado pessoal guardado (RNF-06).

**Responsivo:** o mesmo front serve celular e computador. Para o backend isso não muda nada: as mesmas rotas e o mesmo JSON. Por isso a API devolve dados e textos, nunca layout (nada de "coluna da esquerda").

## 3. Contratos da API

Todas as rotas ficam sob `/api` (já é a convenção do repositório). Nomes de campos em português quando são termos do domínio (`talhao`, `colheita`), como permite o AGENTS.md.

### 3.1 `GET /api/talhao?lat=-18.92&lon=-48.28`

```json
{
  "ponto": {"lat": -18.92, "lon": -48.28},
  "celula_id": "-190_-483",
  "dentro_da_area": true,
  "solo": {"textura": "medio", "cad_mm": 50, "fonte": "soilgrids"},
  "colheita_sugerida": {"faixa": "meio", "fonte": "ndvi_modis", "anos_usados": 9},
  "historico": {
    "anos": [{"ano": 2016, "situacao": "parado", "ndvi_max": 0.42}, {"ano": 2017, "situacao": "plantou", "ndvi_max": 0.71}],
    "parado": 5,
    "total": 10,
    "fonte": "modis_mod13q1"
  },
  "dados": [
    {"fonte": "gpm_imerg", "periodo": "2006-2025"},
    {"fonte": "nasa_power", "periodo": "2006-2025"},
    {"fonte": "nex_gddp_cmip6", "periodo": "2041-2060", "cenario": "ssp245", "modelos": 3}
  ]
}
```

- Fora da área preparada: `dentro_da_area: false` e HTTP 200 (o front mostra "ainda não chegamos aí"). Não é erro.
- `solo.fonte` = `soilgrids`, `padrao` (SoilGrids falhou: assume médio) ou `usuario` (ele trocou na tela 4).
- `colheita_sugerida.fonte` = `ndvi_modis` ou `padrao` (sem NDVI: "meio").
- `historico` pode vir `null` se o Earth Engine falhar; a tela 4 esconde o cartão.

### 3.2 `GET /api/recomendacao?lat&lon&colheita=meio[&solo=argiloso][&nematoide=sim]`

`colheita` ∈ `cedo | meio | tarde`. `solo`, `nematoide` e `gado` são opcionais (só aparecem para quem toca em "Trocar", ou na tela "Como a conta é feita").

**`gado=sim` (pecuária, proposta para depois do MVP):** quem tem gado ganha valor no pasto da seca. Com `gado=sim`, as opções que viram pasto de maio a setembro (milho com braquiária e milheto) somam o valor do pastejo na margem e ganham a frase "Vira pasto para o gado na seca". O cálculo precisa de um parâmetro novo por cultura em `culturas.yaml` (dias de pastejo e lotação, a definir com a agrônoma) e de um aviso: tirar o gado a tempo de a palhada se refazer antes da soja.

```json
{
  "entrada": {"celula_id": "-190_-483", "colheita": "meio", "semeadura": "2027-02-18", "solo": "medio", "nematoide": null},
  "melhor": "milho_braquiaria",
  "alternativas": [
    {"motivo": "menos_risco", "opcao": "sorgo"},
    {"motivo": "mais_dinheiro", "opcao": "milho_safrinha"},
    {"motivo": "cuidar_da_terra", "opcao": "crotalaria"}
  ],
  "opcoes": [
    {
      "id": "milho_braquiaria",
      "nome": "Milho com braquiária",
      "na_janela": true,
      "chuva": {"anos_bons": 14, "anos": 20, "faixa": [true, true, false], "rotulo": "medio",
                "texto": "Deu certo em 14 de 20 anos"},
      "futuro": {"anos_bons_media": 12, "anos_bons_min": 10, "anos_bons_max": 13},
      "dinheiro": {"margem_ha": 700, "rotulo": "bom", "texto": "Sobra perto de R$ 700 por hectare"},
      "terra": {"nota": 50, "rotulo": "bom", "texto": "Fica coberta na seca"},
      "notas": {"seguranca": 70, "futuro": 60, "solo": 50, "renda": 74, "final": 66},
      "porque": [
        "Plantando no meio de fevereiro, o milho floresce em abril. Em 6 dos últimos 20 anos, faltou chuva bem nessa hora (GPM IMERG + NASA POWER).",
        "No clima de 2041–2060 (NEX-GDDP-CMIP6), isso subiria para 8 em 20 anos."
      ],
      "como_fazer": ["Semeie o capim junto com o milho.", "Colha o milho. O capim fica cobrindo a terra.", "Plante a próxima soja em cima da palhada."]
    }
  ],
  "fora_da_janela": [],
  "pousio": {"texto": "Deixar parado: não depende de chuva, mas a terra fica descoberta de maio a setembro."},
  "plano_3_anos": {
    "normal": {"anos": ["milho_braquiaria", "crotalaria", "sorgo"], "nota": 66},
    "seco":   {"anos": ["sorgo", "crotalaria", "sorgo"], "nota": 58},
    "hoje":   {"descricao": "soja e depois milho ou parado", "nota": 48}
  },
  "versao_dados": "2026-11-14T13:00Z",
  "aviso": "Ajuda a decidir. Não substitui o agrônomo."
}
```

- `faixa` tem um booleano por ano (2006 a 2025) para os quadrinhos das telas 5 e 6.
- `notas` (0 a 100) ficam no JSON para a agrônoma e para os jurados; o produtor não vê.
- Textos em pt-BR por padrão; `Accept-Language: en` devolve os textos em inglês (RNF-03). Os modelos de frase ficam em `regras.yaml`, nas duas línguas.

### 3.3 `GET /api/exemplo`

Mesma forma de `/talhao` + `/recomendacao` juntos, para a fazenda de exemplo (Uberlândia, -18,92 / -48,28, colheita "meio"). Vem de uma fixture JSON gerada pelo pipeline, então funciona mesmo com o banco vazio ou o Earth Engine fora do ar.

### 3.4 Já existentes

`GET /api/health` e `GET /api/crop-options` continuam. O `crop-options` passa a ler o `culturas.yaml` (o comentário do repository já prevê isso).

## 4. Motor de pontuação (services)

Tudo puro Python, sem FastAPI e sem banco, testável com dados de mentira. Regras e limiares do PRD (seção 7), com as mudanças abaixo.

### 4.1 Data de semeadura

| Faixa de colheita | Colheita usada | Semeadura (colheita + 3 dias) |
| --- | --- | --- |
| `cedo` (até dia 10/fev) | 5/fev | 8/fev |
| `meio` (11 a 20/fev) | 15/fev | 18/fev |
| `tarde` (depois de 20/fev) | 28/fev | 3/mar |

Os valores ficam em `regras.yaml`. A data limite de cada cultura também, **conferida na Portaria SPA/MAPA nº 388/2025 (ZARC milho 2ª safra MG)** antes da demo (ver PRD, seção 5).

### 4.2 Por opção e por ano (2006–2025, 20 anos)

1. Corta a série da célula a partir da semeadura até o fim do ciclo.
2. Balanço hídrico diário (função `simular` do PRD), com CAD do solo e Kc da cultura. Kc por fase (inicial, pico, final) em vez de um valor só, se der tempo; senão o pico.
3. Janela crítica: florescimento ± 15 dias. Coberturas: primeiros 30 dias.
4. **Aperto** se ISNA < 0,55 (grão) ou < 0,50 (cobertura, nos 30 dias) **ou** 3+ dias com máxima ≥ 35 °C na janela.
5. Fator de perda pelo ISNA (0%, 30%, 60%) para a margem.

Saída por ano: `aperto`, `isna`, `dias_calor`, `fator_perda`. Isso alimenta a `faixa` e o "por quê".

### 4.3 Clima futuro

Método do delta (PRD 7.3): para cada modelo, chuva × (1 + Δ%) e máxima + Δ °C mês a mês, ETo recalculada (Hargreaves-Samani com a razão entre a ETo nova e a antiga, para não depender do Penman completo) e o passo 4.2 de novo. `anos_bons` do futuro = média dos modelos, com mínimo e máximo.

### 4.4 Notas e rótulos

| Eixo | Nota (0–100) | Rótulo para o produtor |
| --- | --- | --- |
| Chuva (segurança) | 100 × anos sem aperto ÷ 20 | Bom ≥ 17 anos · Médio 12–16 · Fraco < 12 |
| Futuro | idem, no clima 2041–2060 | só no "por quê" |
| Terra (solo) | tabela 7.4 do PRD (×1,5 na quebra de pragas se nematoide = sim) | Bom ≥ 50 · Médio 20–49 · Fraco < 20 |
| Dinheiro (renda) | 100 × margem ÷ maior margem (negativa = 0) | Bom ≥ 70 · Médio 30–69 · Fraco < 30 |

Limiares dos rótulos em `regras.yaml` (hipótese do time; ajustar olhando os resultados reais).

### 4.5 Ranking e alternativas

- **Pousio sai do ranking.** Ele é a linha de base ("como é hoje"). Com segurança e futuro 100, ele subia para o meio da lista no perfil "menos risco", o que é uma recomendação ruim.
- `melhor` = maior nota final com os pesos padrão (30 segurança, 25 solo, 30 renda, 15 futuro), entre as opções na janela.
- `alternativas` = a melhor em cada eixo isolado (segurança, renda, solo), sem repetir a `melhor`. Isso substitui os controles de peso do produtor, que eram difíceis para o público.
- Opção fora da janela vai para `fora_da_janela`, com a frase pronta.

### 4.6 Plano de 3 anos

Regras do PRD 7.7 (216 combinações, filtros, bônus de diversidade), com duas mudanças:
- Devolve **um plano** por cenário (o melhor), não três: o protótipo mostra um só.
- Cenário `seco` = mesma conta usando só os **4 anos mais secos** da série (menor chuva de fevereiro a abril), em vez de um ano só, para não depender de um único ano atípico.

### 4.7 Histórico do talhão e sugestão de colheita (NDVI)

- MOD13Q1 vem com **fator de escala 0,0001** (o valor 7.100 é NDVI 0,71). Aplicar antes de comparar com 0,45 e 0,6.
- Entressafra: maior NDVI entre 1/abr e 31/jul → `plantou` (> 0,6), `parado` (< 0,45), `incerto`.
- **Colheita sugerida (novo):** em cada ano, a primeira imagem de janeiro a março em que o NDVI cai abaixo de 50% do pico do verão marca a soja secando. Mediana dos anos → faixa `cedo/meio/tarde`. Com menos de 5 anos válidos, usa `meio` e `fonte: padrao`. O MOD13Q1 é de 16 dias, então isso é estimativa de faixa, não de data: está bom para pré-marcar a tela 3.

### 4.8 Explicações

Frases geradas por modelo de texto (sem IA generativa), em `regras.yaml`, nas duas línguas. Cada frase cita o número e a fonte. Um teste por modelo de frase garante que o número da frase é o mesmo da conta.

## 5. Banco (PostgreSQL + PostGIS)

Sem ORM no hackathon: **psycopg 3 + SQL nos repositories**, e os scripts de criação em `projeto/backend/db/init/*.sql`, montados no `/docker-entrypoint-initdb.d` do serviço `db`. Rápido de fazer e fácil de ler. Se o projeto seguir, migrar para SQLAlchemy 2 + GeoAlchemy2 + Alembic (o `projeto/backend/AGENTS.md` já sugere).

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- Grade de 0,1° (célula do IMERG). id = "<floor(lat*10)>_<floor(lon*10)>"
CREATE TABLE grid_cell (
  id      text PRIMARY KEY,
  geom    geometry(Polygon, 4326) NOT NULL,
  center  geometry(Point, 4326)   NOT NULL
);
CREATE INDEX grid_cell_geom_idx ON grid_cell USING gist (geom);

-- Uma linha por célula e ano: a entressafra inteira em arrays (1/jan a 31/jul = 212 dias).
-- Muito menor que uma linha por dia (cabe no plano grátis) e lida numa consulta só.
CREATE TABLE climate_season (
  cell_id     text     NOT NULL REFERENCES grid_cell(id),
  year        smallint NOT NULL,
  start_date  date     NOT NULL,
  rain_mm     real[]   NOT NULL,
  rain_source text     NOT NULL,          -- 'imerg_final' ou 'power'
  tmax_c      real[]   NOT NULL,
  tmin_c      real[]   NOT NULL,
  eto_mm      real[]   NOT NULL,          -- FAO-56 Penman-Monteith (pyet), do POWER
  PRIMARY KEY (cell_id, year)
);

CREATE TABLE cmip6_delta (
  cell_id   text     NOT NULL REFERENCES grid_cell(id),
  model     text     NOT NULL,
  scenario  text     NOT NULL,            -- 'ssp245'
  month     smallint NOT NULL,            -- 1 a 12
  rain_pct  real     NOT NULL,
  tmax_c    real     NOT NULL,
  PRIMARY KEY (cell_id, model, scenario, month)
);

-- Caches por ponto (chave = lat/lon arredondados a 0,0025°, ~250 m)
CREATE TABLE soil_point (
  key        text PRIMARY KEY,
  geom       geometry(Point, 4326) NOT NULL,
  clay_pct   real,
  sand_pct   real,
  texture    text NOT NULL,               -- 'arenoso' | 'medio' | 'argiloso'
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ndvi_point (
  key   text NOT NULL,
  date  date NOT NULL,
  ndvi  real NOT NULL,                    -- já com o fator 0,0001 aplicado
  PRIMARY KEY (key, date)
);

-- De onde veio cada carga (aparece em "versao_dados" e na tela "Como a conta é feita")
CREATE TABLE data_run (
  id          serial PRIMARY KEY,
  source      text NOT NULL,
  params      jsonb NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now()
);
```

**Tamanho.** Caixa do hackathon (Uberlândia e Uberaba, lon -49,0 a -47,5 e lat -19,9 a -18,4): 225 células × 20 anos × 4 arrays × 212 dias × 4 bytes ≈ 15 MB. Triângulo inteiro (lon -51 a -46, lat -20,5 a -17,5): 1.500 células ≈ 100 MB. A primeira cabe em qualquer plano grátis.

**Nunca no git:** dumps do banco e arquivos do pipeline (`*.parquet`, `*.nc`, `data/`), como manda o AGENTS.md. A única exceção proposta é a fixture da fazenda de exemplo (seção 7), pequena e necessária para testes e demo: **decidir no PR**.

## 6. Pipeline offline (`projeto/backend/pipeline/`)

Scripts de linha de comando, fora do `app/`, com dependências num grupo separado do uv (`uv sync --group pipeline`) para não pesar a imagem da API.

| Script | Faz | Fonte | Tempo esperado |
| --- | --- | --- | --- |
| `build_grid.py` | Cria as células da caixa em `grid_cell` | — | segundos |
| `fetch_power.py` | 1 chamada por célula de 0,5° (POWER é ~0,5°), 2006–2025, comunidade AG; calcula ETo com `pyet`; distribui para as 25 células de 0,1° filhas | NASA POWER (sem chave) | caixa do hackathon: 9 chamadas |
| `fetch_imerg.py` | Chuva diária GPM_3IMERGDF v07 recortada na caixa; troca a chuva do POWER por esta | Earthdata (`earthaccess`) | longo: rodar em segundo plano no sábado |
| `fetch_cmip6_deltas.py` | Deltas mensais (2041–2060 vs 1995–2014), 3 modelos, SSP2-4.5 | Earth Engine `NASA/GDDP-CMIP6` | ~1 h |
| `load_postgis.py` | Grava `climate_season` e `cmip6_delta` | — | minutos |
| `export_fixture.py` | Gera a fixture da fazenda de exemplo (JSON) | banco | segundos |
| `validate_ibge.py` | T-12: anos de aperto do milho × produtividade do milho 2ª safra de Uberlândia na PAM/IBGE | SIDRA | ~1 h |

**Ordem de prioridade:** POWER primeiro (a demo já funciona só com ele, usando PRECTOTCORR como chuva), depois IMERG por cima, depois CMIP6. Cada script registra uma linha em `data_run`.

**Contas e segredos:** Earthdata e Earth Engine só por variável de ambiente (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`, `EE_PROJECT` já existem no `.env.example`). Para o Earth Engine rodar no servidor (NDVI sob demanda), é preciso uma conta de serviço: adicionar `EE_SERVICE_ACCOUNT_KEY` (JSON em base64) só no `.env` e no painel da hospedagem, **nunca no repositório**.

## 7. Camadas no código

Segue o padrão do repositório (MVC + service/repository, TDD). Arquivos novos em `projeto/backend/app/`:

| Camada | Arquivo | Conteúdo |
| --- | --- | --- |
| Model | `models/crop.py` | `CropParams` (ciclo, Kc, data limite, solo, custo, preço, produtividade) |
| Model | `models/climate.py` | `ClimateSeason` (arrays por ano), `Cmip6Delta` |
| Model | `models/talhao.py` | `Ponto`, `Solo`, `HistoricoAno`, `ColheitaSugerida` |
| Model | `models/recomendacao.py` | `ResultadoAno`, `ResultadoOpcao`, `Plano`, `Recomendacao` |
| Repository | `repositories/crop_params_repository.py` | `YamlCropParamsRepository` (`culturas.yaml`) |
| Repository | `repositories/rules_repository.py` | `YamlRulesRepository` (`regras.yaml`) |
| Repository | `repositories/climate_repository.py` | `PostgisClimateRepository`, `FixtureClimateRepository` |
| Repository | `repositories/soil_repository.py` | cache no PostGIS + cliente SoilGrids (timeout curto) |
| Repository | `repositories/ndvi_repository.py` | cache no PostGIS + Earth Engine `getRegion` (timeout 10 s) |
| Service | `services/water_balance.py` | `simular`, `isna`: funções puras (PRD 7.2) |
| Service | `services/climate_risk_service.py` | aperto por opção e ano, atual e futuro |
| Service | `services/field_history_service.py` | classificação do NDVI e colheita sugerida |
| Service | `services/recommendation_service.py` | notas, rótulos, ranking, alternativas, frases |
| Service | `services/rotation_plan_service.py` | plano de 3 anos, normal e seco |
| Service | `services/talhao_service.py` | junta solo, histórico e colheita sugerida para `/talhao` |
| Schema | `schemas/talhao.py`, `schemas/recomendacao.py` | JSON das seções 3.1 e 3.2 |
| Controller | `controllers/talhao_controller.py`, `controllers/recomendacao_controller.py` | rotas finas |
| Dados | `app/config_data/culturas.yaml`, `regras.yaml` | parâmetros do PRD com a fonte ao lado de cada número |
| Fixture | `app/fixtures/exemplo_uberlandia.json` | fazenda de exemplo (decidir no PR) |

**Dependências novas da API:** `psycopg[binary]`, `pyyaml` (declarar, hoje vem só via uvicorn) e `earthengine-api` (NDVI sob demanda). **Do pipeline:** `earthaccess`, `xarray`, `netCDF4`, `pandas`, `pyet`, `requests`. Justificar no PR, como pede o `projeto/backend/AGENTS.md`.

**Ordem TDD sugerida** (cada passo começa com o teste falhando):

1. `water_balance`: os dois casos da tabela de testes do PRD (ISNA = 1 e ISNA = 0,5).
2. `climate_risk_service`: aperto por ISNA, aperto por calor, cobertura em 30 dias, fora da janela.
3. `recommendation_service`: rótulos nos limites, pousio fora do ranking, alternativas sem repetir, frase com o mesmo número da conta.
4. `rotation_plan_service`: 216 combinações, filtro de nematoide, cenário seco com 4 anos.
5. `field_history_service`: fator 0,0001, plantou/parado/incerto, colheita sugerida e fallback.
6. Repositories YAML e fixture; depois PostGIS (teste de integração marcado, com o banco do compose).
7. Controllers com `TestClient` e `dependency_overrides`.

## 8. Desempenho, falhas e sinal fraco

| Situação | O que acontece |
| --- | --- |
| Talhão novo | `/talhao` lê o banco (< 100 ms) + SoilGrids e NDVI se não estiverem em cache (2 a 8 s). Disparado na tela 2, termina enquanto ele responde a tela 3 |
| `/recomendacao` | Só banco + conta: < 1 s (RNF-01 pedia 20 s) |
| Earth Engine fora | `historico: null`, `colheita_sugerida.fonte: padrao`. A recomendação não depende do NDVI |
| SoilGrids fora | Solo médio, `fonte: padrao`, e a tela 4 mostra "Não é? Trocar" |
| Ponto fora da caixa | `dentro_da_area: false`; o front oferece a fazenda de exemplo |
| Banco vazio na hora da demo | `/exemplo` sai da fixture |
| Sinal fraco | Resposta pequena (~15 KB), `GZipMiddleware`, `Cache-Control: public, max-age=86400` em `/recomendacao` (os dados só mudam quando o pipeline roda) |

## 9. Hospedagem (RNF-09: tudo grátis)

- **Front:** Vercel (já previsto).
- **API:** Render ou Railway, a partir do `Dockerfile` do backend.
- **Banco com PostGIS:** Neon ou Render Postgres (ambos aceitam `CREATE EXTENSION postgis`). Conferir os limites do plano grátis no dia; a caixa do hackathon tem ~15 MB.
- O pipeline roda numa máquina do time e grava direto no banco hospedado (`DATABASE_URL` só no `.env`).

## 10. Plano de horas do backend (a partir de sábado 12h)

| Bloco | Dev 1 (dados) | Dev 2 (API e front) |
| --- | --- | --- |
| sáb 12h–15h | `build_grid`, `fetch_power`, `load_postgis` para a caixa; disparar `fetch_imerg` em segundo plano | SQL de criação, `culturas.yaml` e `regras.yaml` com a Rayanne, `water_balance` (TDD) |
| sáb 15h–20h | `export_fixture`; `climate_risk_service` com dados reais | `recommendation_service`, schema e `/recomendacao` com fixture |
| sáb 20h–2h | `fetch_cmip6_deltas`; NDVI no `field_history_service` | `/talhao`, `/exemplo`, front ligado na API |
| dom 2h–8h | revezamento; IMERG por cima do POWER se terminou | `rotation_plan_service`, deploy de teste |
| dom 8h–12h | **T-12 validação IBGE** (gráfico do pitch) | deploy final, links em aba anônima |
| dom 12h–entrega | congelado | congelado; ajuda no vídeo |

**Ordem de corte:** CMIP6 com 1 modelo → NDVI só na fazenda de exemplo (fixture) → IMERG trocado pela chuva do POWER → plano de 3 anos com regra fixa. **Nunca cortar:** `/recomendacao` com dado real da NASA na fazenda de exemplo, e o deploy.

## 11. Decisões em aberto (levar para o PR)

1. Commitar a fixture da fazenda de exemplo (~100 KB de dado público derivado) ou gerar no build.
2. psycopg + SQL agora, ORM depois, ou ORM desde já.
3. Data limite de cada cultura: confirmar no ZARC 2025/26 (milho 2ª safra MG) e nas portarias de sorgo.
4. Chave da célula: `floor` de lat/lon × 10 (proposto) ou id numérico.
5. Pecuária (`gado=sim`): entra como pergunta opcional na tela 4 depois do MVP, ou já no hackathon só como frase na resposta.
