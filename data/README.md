# Raiz Orbital — Módulo de Extração de Dados Agroclimáticos (NASA POWER e SMAP)

Este diretório contém os scripts de extração e preparação de dados de satélite da NASA para o projeto **Raiz Orbital: o que plantar depois da soja?**, desenvolvido para o desafio *Adapting Farms with NASA Data* do **NASA Space Apps Challenge**.

---

## 1. Conteúdo do Diretório `data/`

Estrutura com scripts de extração e salvamento centralizado no subdiretório `output/`:

```text
data/
├── README.md                  # Contexto do desafio e documentação dos dados da NASA
├── requirements.txt           # Dependências leves (requests, pandas, pyyaml, earthengine-api)
├── extract_nasa_power.py      # Script e função reutilizável para extração da NASA POWER
├── extract_historical_20y.py  # Extração da série de 20 anos (2005-2024) com resumo anual
├── extract_smap.py            # Extração de umidade do solo do satélite NASA SMAP (AppEEARS API)
├── extract_soilgrids.py       # Extração de textura do solo e CAD via SoilGrids REST API
├── extract_gee_ndvi.py        # Extração de histórico de NDVI (MODIS) via Google Earth Engine
├── extract_gee_cmip6.py       # Projeções climáticas 2041-2060 (NEX-GDDP-CMIP6) via Earth Engine
├── culturas.yaml              # Parâmetros das 6 opções de entressafra (Embrapa/ZARC)
└── output/                    # Diretório onde todos os arquivos JSON e CSV são gerados
```

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
- **Produto Utilizado:** **SMAP L4 Geophysical (SPL4SMGP v8)**, que integra observações orbitais com o modelo de superfície *Catchment Land Surface Model* do NASA GSFC.
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
- **Acesso:** Google Earth Engine (`ee.ImageCollection("MODIS/061/MOD13Q1")`).
- **Período Coletado:** Série histórica de **2015 a 2025 (10 anos)**.

| Variável / Dado | Nome no Satélite | Unidade / Escala | Significado no Raiz Orbital |
| :--- | :--- | :--- | :--- |
| **Índice de Vegetação (NDVI)** | `NDVI` | Adimensional (-1.0 a +1.0) | **Vigor da cobertura vegetal**. Valores $< 0.20$ representam solo exposto/palhada morta; valores $> 0.60$ representam lavoura em pleno desenvolvimento fotossintético. |
| **NDVI Médio da Safrinha** | `ndvi_medio_safrinha` | 0.0 a 1.0 | Média dos índices registrados nos meses de **março, abril e maio** (logo após a colheita da soja). |
| **Status do Talhão por Ano** | `status_talhao` | Categórico (`Pousio` ou `Segunda Safra`) | **Detecção do histórico real de uso da terra**: se o NDVI médio pós-soja for $< 0.38$, o talhão ficou em **Pousio**; se for $\ge 0.38$, houve **Segunda Safra**. Alimenta o diagnóstico: *"Você deixou seu talhão em pousio em X dos últimos 10 anos"*. |

---

### E. NEX-GDDP-CMIP6 (Projeções de Clima Futuro 2050)

O **NEX-GDDP-CMIP6** (*NASA Earth Exchange Global Daily Downscaled Projections*) entrega projeções climáticas diárias globais corrigidas para escala local (~27.8 km) baseadas nos modelos do IPCC AR6.
- **Acesso:** Google Earth Engine (`ee.ImageCollection("NASA/GDDP-CMIP6")`).
- **Cenário Avaliado:** **SSP2-4.5** (*Middle of the Road* — cenário intermediário realista de emissões).
- **Janela Temporal:** Projeções futuras de **2041 a 2060 (centro em 2050)** comparadas ao histórico (1995–2014).

| Variável | Nome no Dataset | Unidade Original | Unidade Convertida | Significado e Papel no Raiz Orbital |
| :--- | :--- | :--- | :--- | :--- |
| **Precipitação Projetada** | `pr` | kg/m²/s | mm/dia | **Volume diário de chuva previsto em 2050**. Permite calcular a redução percentual da chuva esperada na entressafra (fev a mai). |
| **Temperatura Máxima Diária** | `tasmax` | Kelvin (K) | Graus Celsius (°C) | **Aumento da temperatura de pico diurna em 2050**. Mede a intensidade das ondas de calor futuras durante o período de floração. |
| **Dias de Calor Extremo** | `dias_ano_calor_extremo_ge_35c` | Dias / ano | Dias / ano | **Frequência de dias com $T_{max} \ge 35^\circ C$**. No Cerrado, o aumento de veranicos quentes compromete a viabilidade do milho safrinha tardio. |
| **Delta Climático na Safrinha** | `delta_climatico_safrinha` | % e °C | Variação relativa | **Método do Delta (PRD Seção 7.3)**: Aplica o sinal de mudança climática (+1.8°C e -12.5% de chuva) sobre a série observada para testar a resiliência das culturas recomendadas. |

---

## 4. Como Usar os Scripts de Extração

Todos os scripts salvam automaticamente os arquivos `.json` e `.csv` no diretório [`output/`](file:///workspace/data/output).

### 1. Extração NASA POWER Diária
Script: [`extract_nasa_power.py`](file:///workspace/data/extract_nasa_power.py)
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
Script: [`extract_historical_20y.py`](file:///workspace/data/extract_historical_20y.py)
- Baixa os últimos 20 anos da série histórica para o ponto do talhão.
- Salva os dados diários e um resumo anual (`output/resumo_uberlandia_20anos_anual.csv`) com chuva na safrinha (fev-mai) e dias de calor extremo ($\ge 35^\circ C$).

### 3. Extração NASA SMAP (Umidade do Solo)
Script: [`extract_smap.py`](file:///workspace/data/extract_smap.py)

O script oferece 3 formas flexíveis de uso:
1. **Token Hardcoded (Teste Rápido):** Cole seu token diretamente na variável `EARTHDATA_BEARER_TOKEN` no topo do arquivo.
2. **Login Automático:** Configure as variáveis de ambiente `EARTHDATA_USERNAME` e `EARTHDATA_PASSWORD` para login automático na API AppEEARS.
3. **Modo Desenvolvimento/Hackathon:** Se executado sem credenciais, gera e salva uma série representativa do SMAP L4 para Uberlândia em `output/smap_uberlandia_2024_safra.json` e `.csv`.

```python
from extract_smap import generate_smap_sample_dataset, save_smap_data

# Gera série representativa da umidade do solo para o talhão
dados_smap = generate_smap_sample_dataset(
    latitude=-18.9543,
    longitude=-48.1993,
    start_date="2024-01-01",
    dias=90
)

# Salva automaticamente dentro de data/output/
save_smap_data(dados_smap, prefix="smap_uberlandia_2024")
```

### 4. Extração SoilGrids (Textura e CAD do Solo)
Script: [`extract_soilgrids.py`](file:///workspace/data/extract_soilgrids.py)
- Consulta a API REST aberta do SoilGrids (ISRIC) para obter as frações de argila e areia (0-30 cm).
- Classifica o solo em **Arenoso** (CAD 40 mm), **Médio** (CAD 50 mm) ou **Argiloso** (CAD 60 mm).
- Atende ao requisito do produtor que marca "não sei" no cadastro do talhão.

### 5. Histórico do Talhão - MODIS NDVI (Google Earth Engine)
Script: [`extract_gee_ndvi.py`](file:///workspace/data/extract_gee_ndvi.py)
- Extrai a série de 10 anos (2015-2025) da coleção `MODIS/061/MOD13Q1` (NDVI 250m a cada 16 dias).
- Classifica cada ano pós-soja (março a maio) em **Pousio** (NDVI < 0.38) ou **Segunda Safra** (NDVI >= 0.38).
- Salva o histórico em `output/modis_ndvi_historico_10anos.json` e `.csv`.

### 6. Projeções Climáticas 2050 - NEX-GDDP-CMIP6 (Google Earth Engine)
Script: [`extract_gee_cmip6.py`](file:///workspace/data/extract_gee_cmip6.py)
- Consulta a coleção `NASA/GDDP-CMIP6` para o cenário **SSP2-4.5** (período 2041–2060).
- Converte precipitação (`pr` em kg/m²/s) para mm/dia e temperatura máxima (`tasmax` em Kelvin) para °C.
- Salva os deltas de calor e chuva em `output/cmip6_projecao_2050.json`.

---

## 5. Panorama Completo das Fontes de Dados (PRD do Raiz Orbital)

Abaixo está o mapeamento de **todas as fontes de dados** previstas na Seção 6 do PRD e no Discovery de produto:

| Fonte | O que mede | Para que serve no Raiz Orbital | Status no Projeto | Como Acessar |
| :--- | :--- | :--- | :--- | :--- |
| **NASA POWER** | Chuva, Tmax, Tmin, umidade, vento, radiação solar (~0.5°) | **Cálculo da ETo (Penman-Monteith) e simulação de risco dos últimos 20 anos**. | ✅ **Implementado** (`extract_nasa_power.py`) | API REST aberta (sem chave) |
| **NASA SMAP** | Umidade do solo na superfície (0-5 cm) e raiz (0-100 cm) a 9 km | **Calibração da água no solo na data da semeadura** e validação do estresse hídrico real. | ✅ **Implementado** (`extract_smap.py`) | API REST AppEEARS ou Earth Engine |
| **SoilGrids (ISRIC)** | Teores de argila e areia no solo a 250 m | **Determina a CAD (40, 50 ou 60 mm)** quando o produtor marca "não sei". | ✅ **Implementado** (`extract_soilgrids.py`) | API REST aberta (sem chave) |
| **MODIS MOD13Q1 / HLS** | NDVI (Índice de Vegetação) a 250 m (16 dias) ou HLS a 30 m | **Histórico do Talhão (10 anos)**: Classifica cada safra (2015-2025) como "Pousio" ou "Segunda Safra". | ✅ **Implementado** (`extract_gee_ndvi.py`) | Google Earth Engine `MODIS/061/MOD13Q1` |
| **NEX-GDDP-CMIP6** | Projeções de chuva e temperatura 2041–2060 (~27 km) | **Eixo Clima Futuro**: Avalia se o risco de perda aumenta nas próximas décadas (cenário SSP2-4.5). | ✅ **Implementado** (`extract_gee_cmip6.py`) | Google Earth Engine `NASA/GDDP-CMIP6` |
| **GPM IMERG Final** | Chuva diária de satélite a 0.1° (~10 km) de 2005 a 2025 | Alternativa de maior resolução espacial para a série de 20 anos de chuva. | 💡 *Fallback*: Usando a chuva do NASA POWER (`PRECTOTCORR`) | `earthaccess` / GES DISC |
| **NASA FIRMS** | Focos ativos de queimadas (375 m / 15 min) | Monitoramento de risco de fogo na palhada durante a seca (módulo pós-MVP). | 💡 *Módulo Futuro*: Alertas em tempo real | API REST FIRMS (`MAP_KEY` gratuita) |

## Fazenda de exemplo

O ponto usado pelos scripts é o campo de soja de 48 ha da **Fazenda Experimental do Glória (UFU)**, em Uberlândia: `lat -18.9543`, `lon -48.1993` (18°57'15.6"S 48°11'57.4"O, segundo TCC do ICIAG-UFU de 2026). Até 14/11/2026 o ponto era `-18.9186, -48.2772`, que fica no centro urbano de Uberlândia: o NDVI ali mostra a cidade, não uma lavoura.

> **Pendente:** os arquivos em `output/` ainda são do ponto antigo. Rode de novo `extract_historical_20y.py`, `extract_nasa_power.py` e `extract_smap.py` para gerar os dados do ponto novo.
