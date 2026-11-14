# ADR 0003: Alinhamento das Séries Temporais NASA e Janela Histórica de 20 Anos

- **Status:** Aceito
- **Data:** 2026-11-14
- **Decisores:** Time Raiz Orbital (Frontend, Backend, Engenharia de Dados)
- **Atualizado em:** 2026-11-14 (tarefa R0.4): ponto da fazenda de exemplo e caminhos dos arquivos. A decisão não mudou.
- **Contexto:** `data/`, `projeto/backend/docs/`, `arquivos contexto/Raiz Orbital – plano técnico do backend.md`

---

## 1. Contexto e Problema

O motor de recomendação agroclimática e o cálculo do Índice de Satisfação da Necessidade de Água (ISNA) dependem de uma climatologia histórica de 20 anos para simular balanço hídrico diário decendial (fevereiro a junho) e estimar probabilidades empíricas de quebra de safra.

Durante a verificação entre os dados reais obtidos na pasta `data/`, o plano técnico e os documentos de backend (`diagrama-de-classes.md` e `diagrama-de-sequencias.md`), foram identificadas três incompatibilidades:

1. **Janela de Anos Históricos:**
   - O plano técnico mencionava a janela `2006–2025`.
   - No entanto, nos dados reais consolidados de NASA POWER (`data/output/`, gerada localmente e fora do git) e nas APIs abertas, o ano de 2025/2026 ainda possui fechamentos parciais ou pendências de reanálise completa em algumas fontes. Os 20 anos civis completos consolidados disponíveis sem falhas são **2005 a 2024** (20 safras completas de entressafra).

2. **Fonte Oficial de Precipitação no MVP (NASA POWER vs GPM IMERG):**
   - O PRD e a arquitetura inicial previam o GPM IMERG (`precipitationCal` a cada 30 min / diário) combinado com NASA POWER.
   - Porém, para o MVP focado no Triângulo Mineiro, os scripts de extração demonstraram que o NASA POWER já fornece a variável `PRECTOTCORR` (Precipitation Corrected) com grade de 0.5° diária consistente, diretamente correlacionada às variáveis de evapotranspiração (`ETo`, `ALLSKY_SFC_SW_DWN`, `T2M`, `RH2M`, `WS2M`).
   - O GPM IMERG requer pipeline de download HDF5/GeoTIFF ou autenticação GES DISC via Earthdata com agregações espaciais mais pesadas.

3. **Área Piloto e Grade Espacial (`grid_cell`):**
   - O backend planejou uma resolução de células de `0.1°` (~11 km), mas o NASA POWER nativo opera em `0.5°` (~55 km). Se o talhão consultar apenas a coordenada exata, é preciso esclarecer se há interpolação bilinear ou se a célula de 0.1° herda o centróide da célula NASA POWER correspondente.
   - As coordenadas limite consolidadas da área preparada no Triângulo Mineiro (`PILOT_*` em `projeto/backend/app/constants.py`) são: Latitude `[-19.9, -18.4]` e Longitude `[-49.0, -47.5]`.

---

## 2. Decisão

1. **Janela Climatológica Padronizada para 2005–2024 (20 anos completos):**
   - Fica estabelecido que a janela histórica oficial de 20 anos utilizada pelo motor ISNA e pelas tabelas do banco de dados (`climate_season`) é **2005 a 2024** (ou os últimos 20 anos civis com dados meteorológicos fechados).
   - O backend e os mocks do frontend assumirão essa janela para geração de estatísticas, probabilidades de chuva e acumulados.

2. **Adoção do NASA POWER (`PRECTOTCORR`) como Fonte Principal de Precipitação no MVP:**
   - Para o MVP de 24-48h do Hackathon, a variável `PRECTOTCORR` do NASA POWER é a fonte oficial de precipitação para alimentação do balanço hídrico decendial.
   - O GPM IMERG e dados de radar ficam categorizados como **evolução pós-MVP / refinamento de alta resolução**, eliminando o risco de bloqueio da entrega por atraso no processamento de rasters pesados.

3. **Mapeamento de Células Espaciais (Resolução 0.1° para 0.5°):**
   - A tabela `grid_cell` no PostGIS manterá resolução de 0.1° x 0.1° (conforme planejado para compatibilidade com SoilGrids e MODIS NDVI).
   - As séries climáticas diárias do NASA POWER (0.5°) são distribuídas para as células de 0.1° contidas dentro do quadrante correspondente (Nearest Neighbor / Assign centroid). Dessa forma, a interface e o endpoint `/talhao` mantêm a granularidade de 0.1° sem perdas de performance.

4. **Coordenadas Oficiais da Área Demonstrativa:**
   - A área piloto do Triângulo Mineiro (Uberaba/Frutal/Uberlândia) delimitada em `PILOT_*` (`projeto/backend/app/constants.py`) é a referência oficial para testes de integração, fixtures do frontend e validação dos juízes:
     - Latitude: `-19.9` a `-18.4` (Sul)
     - Longitude: `-49.0` a `-47.5` (Oeste)
     - Talhão de exemplo: `-18.9543, -48.1993`, o campo de soja da Fazenda Experimental do Glória (UFU), em Uberlândia/MG (`EXAMPLE_FARM_*` em `projeto/backend/app/constants.py`). O ponto antigo caía perto do centro urbano, onde o NDVI mostra a cidade.

---

## 3. Consequências

### Positivas
- **Dados Imediatamente Prontos:** Os scripts de `data/` geram a série de 2005 a 2024 em `data/output/` (local, fora do git), e a fixture `projeto/backend/app/fixtures/clima_fazenda_exemplo.json` leva para a API os 20 anos da fazenda de exemplo.
- **Consistência Estatística:** 20 safras cheias garantem o cálculo robusto da probabilidade de estiagem e do ISNA decendial por cultura.
- **Simplicidade de Execução:** Elimina a dependência de pipelines complexos de transformação HDF5 do GES DISC no ambiente de demonstração.

### Negativas / Mitigações
- A resolução da chuva do NASA POWER (0.5°) é mais espaçada que a do GPM IMERG (0.1°).
  - *Mitigação:* Para a escala de entressafra e recomendação macrorregional de risco climático, a acurácia do balanço hídrico decendial com dados NASA POWER corrigidos (`PRECTOTCORR`) é validada pela literatura agronômica da Embrapa e perfeitamente aceita no Hackathon da NASA.
