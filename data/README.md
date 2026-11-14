# Raiz Orbital — Módulo de Extração de Dados Agroclimáticos (NASA POWER e SMAP)

Este diretório contém os scripts de extração e preparação de dados de satélite da NASA para o projeto **Raiz Orbital: o que plantar depois da soja?**, desenvolvido para o desafio *Adapting Farms with NASA Data* do **NASA Space Apps Challenge**.

---

## 1. Conteúdo do Diretório `data/`

Estrutura com scripts de extração e salvamento centralizado no subdiretório `output/`:

```text
data/
├── README.md                  # Contexto do desafio e documentação dos dados da NASA
├── requirements.txt           # Dependências dos scripts (o earthengine-api ficou sem uso no MVP: ADR-0005)
├── extract_nasa_power.py      # Script e função reutilizável para extração da NASA POWER
├── extract_historical_20y.py  # Extração da série de 20 anos (2005-2024) com resumo anual
├── extract_smap.py            # Extração de umidade do solo do satélite NASA SMAP (AppEEARS API)
└── output/                    # Saída dos scripts (fora do git)

# culturas.yaml mudou para projeto/backend/app/config_data/culturas.yaml (é lido pela API)
```

Só esses três scripts existem. SoilGrids, NDVI do MODIS e CMIP6 **não** têm script nesta pasta:

- **SoilGrids:** a própria API consulta, pelo `SoilGridsClient`
  (`projeto/backend/app/repositories/external/soilgrids_client.py`). Com `DATABASE_URL`, ele roda na busca
  sob demanda e o solo vai para o PostGIS (tarefa R1.1 do roteiro).
- **NDVI do MODIS e CMIP6:** vão virar scripts em `projeto/backend/pipeline/` (R2.2 e R2.1 do
  [roteiro do backend](../projeto/backend/docs/roteiro-de-implementacao.md)), direto dos serviços da
  NASA, sem Google Earth Engine ([ADR-0005](../projeto/backend/docs/adr/0005-fontes-diretas-da-nasa-sem-earth-engine.md)).

---

## 2. O Desafio do Projeto: Raiz Orbital

No **Triângulo Mineiro e no Cerrado**, o sistema predominante é a sucessão contínua de **soja no verão seguida por milho safrinha ou pousio**. Todo ano, entre janeiro e março, ao colher a soja, o produtor precisa decidir o que plantar na entressafra.

Decisões tomadas apenas por hábito provocam:
- Degradação física e biológica do solo;
- Proliferação de nematóides (*Pratylenchus brachyurus* e *Rotylenchulus reniformis*);
- Alto risco de perda financeira por estiagens (veranicos) no final da safra de milho.

O **Raiz Orbital** avalia **6 opções de entressafra**:
1. `Pousio`
2. `Milho Safrinha`
3. `Sorgo Granífero`
4. `Milho + Braquiária ruziziensis` (Consórcio)
5. `Milheto`
6. `Crotalária spectabilis` (Cobertura leguminosa)

E recomenda planos de rotação baseados em:
- **Segurança Climática:** Risco de seca ou calor extremo nos últimos 20 anos.
- **Saúde do Solo:** Biomassa de palhada, fixação biológica de Nitrogênio e quebra de nematóides.
- **Renda:** Margem líquida ajustada pelo risco climático.
- **Clima Futuro:** Resiliência frente às projeções climáticas até 2050 (CMIP6).

---

## 3. Fontes de Dados da NASA Utilizadas

### A. NASA POWER (Meteorologia e Agroclimatologia Diária)

O **NASA POWER** (*Prediction Of Worldwide Energy Resources*) provê séries temporais diárias e globais de superfície a partir de modelos assimilados (MERRA-2) e observações de satélite.
- **Acesso:** API REST direta, aberta e sem necessidade de chave (`https://power.larc.nasa.gov/api/temporal/daily/point`).
- **Resolução:** 0.5° x 0.625° (~50 km), cobertura global desde 1981.
- **Comunidade:** `AG` (*Agroclimatology*), com métricas orientadas ao manejo agrícola.

| Variável | Nome na API | Unidade | Papel no Raiz Orbital |
| :--- | :--- | :--- | :--- |
| **Chuva Diária** | `PRECTOTCORR` | mm/dia | **Abastece o balanço hídrico diário do solo**. Mede a água que entrou no solo para calcular o ISNA ($\frac{ETr}{ETc}$) e detectar secas no florescimento. |
| **Temperatura Máxima** | `T2M_MAX` | °C | **Alerta de choque térmico**. Quando $T_{max} \ge 35^\circ C$ por 3 ou mais dias no florescimento, ocorre abortamento floral severo no milho e sorgo. |
| **Temperatura Mínima e Média** | `T2M_MIN`, `T2M` | °C | Calculam a amplitude térmica e o acúmulo de graus-dia (GDD) para o desenvolvimento fenológico. |
| **Radiação Solar Global** | `ALLSKY_SFC_SW_DWN` | MJ/m²/dia | **Calcula a Evapotranspiração de Referência ($ET_0$)** pelo método FAO-56 Penman-Monteith (demanda de água exigida pela atmosfera). |
| **Umidade Relativa** | `RH2M` | % | Mede o déficit de pressão de vapor (VPD), identificando dias de ar seco que aceleram a dessecação da lavoura. |
| **Vento a 2 metros** | `WS2M` | m/s | Parâmetro para a taxa de evapotranspiração e janela segura de aplicação de defensivos. |
| **Umidade na Raiz (POWER)** | `GWETROOT` | Fração (0 a 1) | Umidade estimada na camada de enraizamento (0 a 100 cm). |

> **Tratamento de Dados Ausentes:** O NASA POWER retorna `-999.0` para dias sem medição. Os scripts tratam e convertem automaticamente esses valores para `None`.

---

### B. NASA SMAP (Soil Moisture Active Passive — Umidade do Solo)

O satélite **SMAP** é a missão dedicada da NASA para medição de alta precisão da água presente no solo através de radiometria de micro-ondas em Banda L (1.4 GHz).
- **Acesso:** API REST assíncrona **NASA AppEEARS** (`https://appeears.earthdatacloud.nasa.gov/api`).
- **Produto Utilizado:** **SMAP L4 Geophysical (`SPL4SMGP`)**, que integra observações orbitais com o modelo de superfície *Catchment Land Surface Model* do NASA GSFC. O `extract_smap.py` pede a **versão 007** (`SPL4SMGP.007`); conferir se o AppEEARS já tem a 008 faz parte da tarefa R2.3 do roteiro.
- **Resolução:** Grade global de **9 km EASE-Grid**, resolução temporal a cada 3 horas (agregada diariamente) desde 2015.

| Variável | Nome na API | Unidade | Papel no Raiz Orbital |
| :--- | :--- | :--- | :--- |
| **Umidade na Zona Radicular** | `sm_rootzone` | m³/m³ | **O coração da avaliação hídrica da safrinha**. Mede o volume real de água disponível no perfil de 0 a 100 cm do solo, validando se a cultura enfrentou escassez hídrica na fase reprodutiva crítica. |
| **Umidade Superficial** | `sm_surface` | m³/m³ | **Monitoramento do plantio (0 a 5 cm)**. Avalia se a camada superficial retém umidade suficiente para germinação e emergência rápida das sementes da cultura de cobertura ou milho pós-soja. |
| **Saturação Relativa da Raiz** | `sm_rootzone_wetness` | Fração (0 a 1) | **Índice de estresse hídrico direto**. Mede quão próximo o solo está do Ponto de Murcha Permanente ($0.0$) ou da Capacidade de Campo ($1.0$). Valores $< 0.30$ indicam estresse severo. |
| **Saturação Relativa da Superfície** | `sm_surface_wetness` | Fração (0 a 1) | Condição superficial do solo para dessecação, dessecação de plantas daninhas e trafegabilidade de maquinário pesado. |

#### Como o SMAP Complementa o NASA POWER no Projeto:
1. **Calibração do Balanço Hídrico Inicial:** Em vez de assumir uma estimativa arbitrária de água no solo na semeadura (ex: 50% da CAD), o SMAP fornece a medição observada exata de satélite no dia da colheita da soja.
2. **Validação Cruzada de Risco:** Confirma se os anos históricos classificados como "com aperto" pelo balanço meteorológico do POWER realmente provocaram esgotamento real da água na raiz pelo sensor orbital do SMAP.

---

### C. SoilGrids (ISRIC — Propriedades e Textura do Solo)

O **SoilGrids** provê mapas globais de propriedades do solo a 250 metros de resolução, gerados por modelos de aprendizado de máquina treinados com mais de 240.000 perfis de solo mundiais.
- **Acesso:** API REST pública e anônima (`https://rest.isric.org/soilgrids/v2.0/properties/query`).
- **Profundidade Analisada:** Camada arável de **0 a 30 cm** (onde se concentram as raízes iniciais da safrinha).

| Variável | Nome na API | Unidade Original | Unidade Convertida | Significado e Papel no Raiz Orbital |
| :--- | :--- | :--- | :--- | :--- |
| **Teor de Argila** | `clay` | g/kg | % (peso) | **Capacidade de retenção de água e nutrientes**. Solos com argila $> 35\%$ retêm mais umidade e sofrem menos com veranicos curtos. |
| **Teor de Areia** | `sand` | g/kg | % (peso) | **Drenagem e porosidade**. Solos com areia $> 70\%$ drenam rapidamente, esgotando a reserva hídrica em poucos dias sem chuva. |
| **Textura do Solo** | `textura_solo` | Categórico | `arenoso` / `medio` / `argiloso` | **Classificação textural agronômica** conforme a Seção 6.4 do PRD. |
| **Água Disponível (CAD)** | `cad_mm` | mm | mm de lâmina d'água | **Tamanho do "balde" de água no perfil radicular**: define quantos milímetros de água o solo consegue armazenar para as plantas (`40 mm` arenoso, `50 mm` médio, `60 mm` argiloso). |

---

### D. MODIS MOD13Q1 (NDVI — Histórico de 10 Anos do Talhão)

O sensor **MODIS** a bordo dos satélites Terra e Aqua da NASA monitora o vigor da biomassa vegetal global a cada 16 dias com resolução de 250 metros.
- **Acesso no MVP:** AppEEARS (token do AppEEARS), com a API da ORNL DAAC (aberta, mas lenta) de reserva. O Google Earth Engine saiu do MVP ([ADR-0005](../projeto/backend/docs/adr/0005-fontes-diretas-da-nasa-sem-earth-engine.md)).
- **Período:** 10 anos de entressafra (2015–2025 no PRD ou 2016–2025 no plano técnico: decisão pendente no roteiro).
- **Status:** ainda **sem script**. Vai ser o `projeto/backend/pipeline/fetch_ndvi.py` (R2.2).

| Variável / Dado | Nome no Satélite | Unidade / Escala | Significado no Raiz Orbital |
| :--- | :--- | :--- | :--- |
| **Índice de Vegetação (NDVI)** | `NDVI` | Adimensional (-1.0 a +1.0) | **Vigor da cobertura vegetal**. Valores $< 0.20$ representam solo exposto/palhada morta; valores $> 0.60$ representam lavoura em pleno desenvolvimento fotossintético. |
| **Qualidade do Pixel** | `pixel_reliability` (`SummaryQA`) | 0 a 3 | Só entram as observações 0 (bom) e 1 (aceitável); neve (2) e nuvem (3) ficam de fora. |
| **NDVI Máximo da Entressafra** | `ndvi_max` | 0.0 a 1.0 | Maior NDVI de **1º de abril a 31 de julho** (depois da colheita da soja), já com o fator 0,0001. |
| **Situação do Talhão por Ano** | `situacao` | Categórico (`parado`, `plantou` ou `incerto`) | **Histórico real de uso da terra (PRD 7.8)**: maior NDVI de 1º de abril a 31 de julho; acima de $0.60$ **plantou**, abaixo de $0.45$ **parado**, entre os dois **incerto**. A regra está no `FieldHistoryService` da API. Alimenta a frase *"Sua área ficou parada em X dos últimos 10 anos"*. |

---

### E. NEX-GDDP-CMIP6 (Projeções de Clima Futuro 2050)

O **NEX-GDDP-CMIP6** (*NASA Earth Exchange Global Daily Downscaled Projections*) entrega projeções climáticas diárias globais corrigidas para escala local (~27.8 km) baseadas nos modelos do IPCC AR6.
- **Acesso no MVP:** NCCS THREDDS, com recorte por ponto em CSV (aberto, sem login). O Google Earth Engine saiu do MVP ([ADR-0005](../projeto/backend/docs/adr/0005-fontes-diretas-da-nasa-sem-earth-engine.md)).
- **Status:** ainda **sem script**. Vai ser o `projeto/backend/pipeline/fetch_cmip6_deltas.py` (R2.1), com deltas **mensais por modelo** (formato em "Contrato dos dados das fontes", no `projeto/backend/AGENTS.md`).
- **Cenário Avaliado:** **SSP2-4.5** (*Middle of the Road* — cenário intermediário realista de emissões).
- **Janela Temporal:** Projeções futuras de **2041 a 2060 (centro em 2050)** comparadas ao histórico (1995–2014).

| Variável | Nome no Dataset | Unidade Original | Unidade Convertida | Significado e Papel no Raiz Orbital |
| :--- | :--- | :--- | :--- | :--- |
| **Precipitação Projetada** | `pr` | kg/m²/s | mm/dia | **Volume diário de chuva previsto em 2050**. Permite calcular a redução percentual da chuva esperada na entressafra (fev a mai). |
| **Temperatura Máxima Diária** | `tasmax` | Kelvin (K) | Graus Celsius (°C) | **Aumento da temperatura de pico diurna em 2050**. Mede a intensidade das ondas de calor futuras durante o período de floração. |
| **Delta Mensal por Modelo** | `chuva_pct`, `tmax_c` (e `tmin_c`, opcional) | % e °C | Variação de 2041–2060 contra 1995–2014, mês a mês | **Método do Delta (PRD Seção 7.3)**: a API aplica o delta de cada mês sobre a série observada e conta os anos bons no clima futuro, modelo a modelo. Os dias com $T_{max} \ge 35^\circ C$ saem dessa série projetada, não de um número pronto. |

---

## 4. Como Usar os Scripts de Extração

Todos os scripts salvam os arquivos `.json` e `.csv` em `data/output/`. Essa pasta **não vai para o git** (dados brutos; regra do `AGENTS.md`). A API não lê daqui: ela usa a fixture derivada `projeto/backend/app/fixtures/clima_fazenda_exemplo.json`, gerada pelo `projeto/backend/pipeline/export_climate_fixture.py` (ver `projeto/backend/AGENTS.md`).

### 1. Extração NASA POWER Diária
Script: [`extract_nasa_power.py`](extract_nasa_power.py)
```python
from extract_nasa_power import fetch_nasa_power_data, save_to_json, save_to_csv

# Busca dados da fazenda de exemplo: campo de soja da Fazenda Experimental do Glória (UFU), Uberlândia - MG
dados = fetch_nasa_power_data(
    latitude=-18.9543,
    longitude=-48.1993,
    start_date="20240101",
    end_date="20240331"
)

# Salva na pasta data/output/
save_to_json(dados, "meu_talhao_weather.json")
save_to_csv(dados, "meu_talhao_weather.csv")
```

### 2. Extração Histórica de 20 Anos da NASA POWER (2005 - 2024)
Script: [`extract_historical_20y.py`](extract_historical_20y.py)
- Baixa os últimos 20 anos da série histórica para o ponto do talhão.
- Salva os dados diários e um resumo anual (`output/resumo_uberlandia_20anos_anual.csv`) com chuva na safrinha (fev-mai) e dias de calor extremo ($\ge 35^\circ C$).

### 3. Extração NASA SMAP (Umidade do Solo)
Script: [`extract_smap.py`](extract_smap.py)

Credenciais **só por variável de ambiente** (o repositório é público; nunca escreva token no código):
1. **Login (use este):** `export EARTHDATA_USERNAME=...` e `export EARTHDATA_PASSWORD=...`. O script
   faz `POST /api/login` no AppEEARS e recebe o token do AppEEARS (vale cerca de 48 h).
2. **Não use o `EARTHDATA_TOKEN` aqui.** O script ainda tenta esse token primeiro, como Bearer, mas o
   AppEEARS recusa o token da Earthdata Login (403). Deixe a variável vazia ao rodar este script. A
   correção (ler o `APPEEARS_TOKEN`) fica para as tarefas R2.2/R2.3 do roteiro. O `EARTHDATA_TOKEN`
   serve para a NSIDC e o GES DISC.

Sem credencial, o script para com erro. Ele **não** gera mais uma série sintética sozinho: a
versão anterior gravava números aleatórios com o rótulo "NASA SMAP L4" e esse arquivo chegou a
ser commitado e lido pela API. A função `generate_smap_sample_dataset` continua existindo só para
testar código, e marca os registros como `SINTETICO - nao e dado da NASA`.

### 4. SoilGrids, NDVI do MODIS e CMIP6 (sem script nesta pasta)
- **SoilGrids:** sem script. A API consulta direto pelo `SoilGridsClient`
  (`projeto/backend/app/repositories/external/soilgrids_client.py`), que classifica o solo em
  **arenoso** (CAD 40 mm), **médio** (CAD 50 mm) ou **argiloso** (CAD 60 mm). Ligado na busca sob demanda desde o R1.1.
- **NDVI do MODIS:** a fazer em `projeto/backend/pipeline/fetch_ndvi.py` (R2.2), pelo AppEEARS.
- **CMIP6:** a fazer em `projeto/backend/pipeline/fetch_cmip6_deltas.py` (R2.1), pelo THREDDS da NCCS.
- O formato de saída dos scripts novos está em "Contrato dos dados das fontes", no `projeto/backend/AGENTS.md`.

---

## 5. Panorama Completo das Fontes de Dados (PRD do Raiz Orbital)

Abaixo está o mapeamento de **todas as fontes de dados** previstas na Seção 6 do PRD e no Discovery de produto:

| Fonte | O que mede | Para que serve no Raiz Orbital | Status no Projeto | Como Acessar |
| :--- | :--- | :--- | :--- | :--- |
| **NASA POWER** | Chuva, Tmax, Tmin, umidade, vento, radiação solar (~0.5°) | **Cálculo da ETo (Penman-Monteith) e simulação de risco dos últimos 20 anos**. | ✅ **Implementado** (`extract_nasa_power.py`) | API REST aberta (sem chave) |
| **NASA SMAP** | Umidade do solo na superfície (0-5 cm) e raiz (0-100 cm) a 9 km | **Calibração da água no solo na data da semeadura** e validação do estresse hídrico real. | ✅ **Script pronto** (`extract_smap.py`); a API ainda não usa (R2.3, R3.3) | API REST AppEEARS (token do AppEEARS) |
| **SoilGrids (ISRIC)** | Teores de argila e areia no solo a 250 m | **Determina a CAD (40, 50 ou 60 mm)** quando o produtor marca "não sei". | 🟡 **Sem script em `data/`**: cliente na API (`SoilGridsClient`), ligado na busca sob demanda (R1.1) | API REST aberta (sem chave) |
| **MODIS MOD13Q1 / HLS** | NDVI (Índice de Vegetação) a 250 m (16 dias) ou HLS a 30 m | **Histórico do Talhão (10 anos)**: classifica cada entressafra como `parado`, `plantou` ou `incerto` (PRD 7.8). | ⏳ **A fazer** (`pipeline/fetch_ndvi.py`, R2.2) | AppEEARS (token do AppEEARS); ORNL DAAC de reserva |
| **NEX-GDDP-CMIP6** | Projeções de chuva e temperatura 2041–2060 (~27 km) | **Eixo Clima Futuro**: Avalia se o risco de perda aumenta nas próximas décadas (cenário SSP2-4.5). | ⏳ **A fazer** (`pipeline/fetch_cmip6_deltas.py`, R2.1) | NCCS THREDDS, recorte por ponto (sem login) |
| **GPM IMERG Final** | Chuva diária de satélite a 0.1° (~10 km) de 2005 a 2025 | Alternativa de maior resolução espacial para a série de 20 anos de chuva. | 💡 *Fallback*: Usando a chuva do NASA POWER (`PRECTOTCORR`); IMERG é a R2.4 | GES DISC (`EARTHDATA_TOKEN`) |
| **NASA FIRMS** | Focos ativos de queimadas (375 m / 15 min) | Monitoramento de risco de fogo na palhada durante a seca (módulo pós-MVP). | 💡 *Módulo Futuro*: Alertas em tempo real | API REST FIRMS (`MAP_KEY` gratuita) |

## Fazenda de exemplo

O ponto usado pelos scripts é o campo de soja de 48 ha da **Fazenda Experimental do Glória (UFU)**, em Uberlândia: `lat -18.9543`, `lon -48.1993` (18°57'15.6"S 48°11'57.4"O, segundo TCC do ICIAG-UFU de 2026). Até 14/11/2026 o ponto era `-18.9186, -48.2772`, que fica no centro urbano de Uberlândia: o NDVI ali mostra a cidade, não uma lavoura.

A pasta `output/` fica fora do repositório: cada pessoa gera a sua. Se a sua cópia é de antes de 14/11/2026, ela é do ponto antigo: rode de novo `extract_historical_20y.py`, `extract_nasa_power.py` e `extract_smap.py`. A fixture que a API usa (`projeto/backend/app/fixtures/clima_fazenda_exemplo.json`) já é do ponto novo.
