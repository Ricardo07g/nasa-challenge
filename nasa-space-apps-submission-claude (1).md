# NASA Space Apps 2026 — Project Submission (Raiz Orbital)

Textos dos campos 2, 5, 6, 7 e 8 do formulário, em inglês. Versão 2: une a precisão técnica do rascunho do Gemini (nomes de produtos e variáveis) aos dados conferidos no PDF "Fontes de dados por tela" (15/11) e no código já com o pacote 3 (PR #88). Sem personas, em tom profissional.
O guia oficial não informa limite de caracteres. Se algum campo cortar o texto, encurte primeiro o campo 5 ("Limitations" e "Technology") e depois o 7.

---

## 2. High-Level Project Summary

Each year, between January and March, soybean farmers in Brazil's Cerrado decide what to plant after the harvest, just as the autumn rains begin to end. Most repeat second-crop corn or leave the field fallow. Both practices degrade soil health and expose farms to drought and heat losses, while less than 4% of Brazil's planted area is insured.

We built Raiz Orbital, a decision-support web tool that answers one question for a specific field: what to plant after soybeans, and which 3-year rotation to follow. The farmer marks the field and states the harvest date. Raiz Orbital simulates six off-season options over 20 seasons of NASA observations (GPM IMERG, NASA POWER, SMAP, MODIS) and under 2041–2060 NASA climate projections (NEX-GDDP-CMIP6), combined with local soil data. It ranks them by the farmer's priority: safety, income or soil care.

This responds directly to Field Shift: NASA Earth observations, local soil information, crop characteristics and farmer priorities, turned into rotation strategies that strengthen soil health and adapt farms to a changing climate. The prototype runs in the Uberlândia–Uberaba region of Minas Gerais, ahead of an off-season threatened by the 2026/27 El Niño.

---

## 5. Detailed Project Description

THE PROBLEM

The Brazilian Cerrado is one of the world's largest grain-producing regions. Its dominant system is soybeans in summer, followed by second-crop corn or by fallow. Embrapa identifies this succession as a cause of soil degradation and long-term yield loss: fallow leaves the soil bare, and the soybean–corn sequence sustains root nematodes.

The off-season decision is made every year with little field-level information, and the risk keeps growing:
- The end of the rainy season sets the risk. In the Triângulo Mineiro, the dry season usually starts in April, so corn sown late reaches flowering without water.
- In 2025/26, drought severely affected rainfed crops in the region, and many fields missed the ideal sowing window.
- The 2026/27 season is starting under a strong El Niño, which raises uncertainty over the next off-season.
- Only 3.3% of Brazil's planted area was insured in 2025, so climate losses fall directly on farm income and debt.

OUR SOLUTION

Raiz Orbital turns NASA Earth observation data into one clear answer per field, explains it and shows its source. It is a responsive website: it works on a phone in the field or a computer at a cooperative, with no sign-up.

1. Locate the field: tap the map, use GPS, or paste coordinates or a Google Maps link. A demo field near Uberlândia is preloaded.
2. Harvest timing: choose the expected soybean harvest date. The app shows how much rain usually remains after that date, monthly rain against crop water demand, and the typical end of the rains. It also warns when the satellite did not detect a soybean crop at that location.
3. Field X-Ray: eight indicators for the location (soil texture, water-holding capacity, current root-zone moisture percentile, vegetation greenness, seasonal rainfall, longest autumn dry spell, extreme-heat years, and rainfall compared with the region). It also shows a 10-season MODIS NDVI history of whether the field was planted or left fallow after soybeans, which the farmer confirms.
4. Choose: the farmer selects a priority (More safety, Income or Care for the soil). The app returns one recommendation, for example "worked in 16 of 20 years". Up to three crops can be compared side by side, with a year-by-year water-satisfaction chart marked with El Niño and La Niña years.
5. 3-year plan: a rotation proposed year by year, with the reason for each step, compared with the field's current management. An autumn signal based on the NOAA ENSO outlook gives a Plan A for a normal autumn and a Plan B for a dry one.
6. Your plan: a timeline from harvest to the official sowing deadline, up to three risk alerts (frost, heavy rain, nearby fire), past and projected performance of each crop in the plan, and a printable report for the farmer's agronomist.
7. Alerts and Guide: current conditions (dry soil, dry days, heat), how the area changed between 2005–2019 and 2020–2024, and historical extremes. A bilingual guide of 27 short articles and a "How the math works" page list every rule, threshold and data source.

THE AGRO-CLIMATIC ENGINE

A single deterministic engine in the backend computes every number, so the same result appears on every screen.
- Climate series: daily January–July data for the field's 0.1° cell, 2005–2024. Rainfall comes from GPM IMERG Final, with NASA POWER as a fallback. Reference evapotranspiration uses FAO-56 Penman–Monteith with NASA POWER inputs, or Hargreaves–Samani when inputs are missing.
- Soil: ISRIC SoilGrids texture sets the available water (60 mm clayey, 50 mm medium, 40 mm sandy), and the farmer can override it.
- Daily water balance (FAO-56): each simulated season starts from the NASA SMAP root-zone wetness on that year's sowing day (from 2016; 50% before that).
- Sowing date: derived from the harvest date. Options past the official ZARC sowing deadline are shown as out of window and never recommended.
- Success criterion: a season succeeds when the Water Satisfaction Index (ISNA, actual/potential evapotranspiration) stays at or above 0.55 in the ±15 days around flowering (0.50 in the first 30 days for cover crops), with fewer than 3 days at or above 35 °C.
- Future climate: monthly precipitation and temperature deltas from three NEX-GDDP-CMIP6 models (SSP2-4.5, 2041–2060 vs 1995–2014) are applied to the observed series, and every option is simulated again. The app reports the range across models.
- Scoring (0–100): climate safety 30%, future climate 15%, soil health 25% (straw, nitrogen fixation, nematode-cycle break) and income 30% (grain production and climate reliability, with no price assumptions). The farmer's priority reorders the ranking.
- Rotation rules: functional-diversity bonuses, at most two fallow years, and nematode-suppressing crops (crotalaria, pearl millet) where needed.

The six options evaluated are second-crop corn, sorghum, corn intercropped with brachiaria, pearl millet, crotalaria (sunn hemp) and fallow.

DESIGN PRINCIPLES

Our research on regional farmers, based on IBGE, ABMRA and McKinsey data, shaped five principles:
- Traceability: every number shows its source and period. Every threshold is stored with its reference (ZARC, Embrapa, FAO-56), and the API rejects values without one. When data is missing, the block is hidden; nothing is estimated.
- No generative AI in decisions: surveys show farmers rely on technical recommendations far more than on AI. The engine is rule-based and fully auditable.
- Accessibility: two questions to reach an answer, plain language, a "Listen to summary" audio option on every screen, and full Portuguese and English versions.
- Complements the agronomist: the tool supports the decision and does not replace professional advice. The report is designed to be taken to the agronomist.
- Privacy: no accounts. Future community reports are stored only at the 0.1° grid-cell level, never at the exact farm location.

HOW IT ADDRESSES FIELD SHIFT

- NASA Earth observations: GPM IMERG, NASA POWER, SMAP L4, MODIS (MOD13Q1, MYD13Q1, MCD12Q1, MCD64A1) and NEX-GDDP-CMIP6.
- Local soil information: SoilGrids texture and water-holding capacity, adjustable by the farmer.
- Crop characteristics: cycle, flowering, crop coefficients and sowing deadlines from ZARC and Embrapa.
- Farmer priorities: a ranking by safety, income or soil care.
- Rotation strategies: 3-year plans compared with current management.
- Soil health: a score for straw, nitrogen and nematode suppression, plus the field's fallow history from NDVI.
- Adaptation to changing conditions: 20-year risk, a dry-autumn Plan B and a 2041–2060 re-simulation.

IMPACT AND VALIDATION PLAN

The soybean–corn and soybean–fallow sequences cover millions of hectares in the Cerrado. Our hypothesis is that field-specific evidence of how each option performed over 20 years, and how it would perform in the 2050s, will lead at least one in three farmers to test a soil-building option (sorghum, corn with brachiaria or a cover crop) on part of their land.

Next steps:
- Interviews with farmers and agronomists.
- A pilot with 15 to 20 farmers in the 2027 off-season, with adoption measured through NDVI in the following season.
- Back-testing of the engine's high-risk years against IBGE municipal second-crop corn losses.

LIMITATIONS

Satellites observe; they do not forecast weather. SMAP (9 km) and IMERG (about 10 km) describe the region, not an individual field. Optical NDVI is affected by cloud cover. Crop-management texts are drafts awaiting agronomist review. The prototype covers a pilot area of 226 grid cells around Uberlândia and Uberaba.

ROADMAP

Expand to the entire Triângulo Mineiro and then the Cerrado. Replace MODIS with HLS and VIIRS as MODIS is retired. Deliver alerts through WhatsApp and through agronomists and cooperatives, and launch the regional community layer.

TECHNOLOGY

Backend: Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL 17 with PostGIS 3.5. Frontend: React 19, TypeScript, Vite, Leaflet. Data pipeline: Python scripts that ingest NASA, ISRIC and NOAA data. Docker; test-driven development with Pytest and Vitest. No special hardware.

---

## 6. NASA Data

NASA data drives every result in Raiz Orbital. We access it directly from NASA services (POWER API, GES DISC, ORNL DAAC, NCCS THREDDS and Earthdata) and store it in our own PostGIS database. NASA is cited by name as the source of each number and no NASA logo is used.

GPM IMERG Final Run, daily (GPM_3IMERGDF v07, 0.1°, 2005–2024)
Primary rainfall input. It drives the daily soil-water balance of all six options and the rain remaining after harvest. It also defines the end of the rainy season (the first 20-day window after 1 March with less than 10 mm), the longest autumn dry spell, heavy-rain risk (50 mm/day or more in February–March) and the comparison with neighboring cells.

NASA POWER, Daily Agroclimatology (T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN, PRECTOTCORR; 2005–2024)
Inputs for FAO-56 Penman–Monteith reference evapotranspiration, heat stress at flowering (35 °C or more), frost risk (3 °C or less in May–July) and fallback rainfall. The most recent 30 days feed the current dry-day and heat alerts.

SMAP L4 Surface and Root Zone Soil Moisture (SPL4SMGP v008, sm_rootzone_wetness, 9 km)
The initial soil-water storage on each simulated sowing day (2016–2025). It also provides the current root-zone moisture percentile in the Field X-Ray and dry-soil alerts (20th percentile or lower).

MODIS Vegetation Indices (MOD13Q1 and MYD13Q1 v061, NDVI, 250 m, 16-day, 2017–2026)
A 10-season history for each field. The app detects the soybean crop (NDVI peak of 0.70 or more, then harvest) and classifies each off-season as planted (above 0.60), fallow (below 0.45) or uncertain. The farmer confirms each season, and the confirmed history becomes the baseline for the 3-year plan.

MODIS Land Cover (MCD12Q1, 500 m)
A cropland mask (IGBP class 12) used to measure how nearby fields within 30 km were managed after soybeans.

MODIS Burned Area (MCD64A1, 500 m, 2016–2025)
Fire history within 5 km of the field, used for the fire-risk alert.

NEX-GDDP-CMIP6 (pr, tasmax, tasmin; 0.25°; SSP2-4.5; ACCESS-CM2, MPI-ESM1-2-HR, MRI-ESM2-0)
Monthly changes for 2041–2060 relative to 1995–2014, applied to the observed series to re-simulate every option. The result is shown as "would succeed in X of 20 years" in the future climate, with the agreement among models.

Together, these datasets answer the core questions of Field Shift for a single field: how each rotation option would have performed, how it performs as the climate changes, and how the soil has been managed. We also evaluated GEOS-S2S and IMERG Late Run. They were left out of the product because of format and coverage constraints, and their scripts remain in the repository.

---

## 7. Space Agency Partner & Other Data

DATA AND SERVICES
- ISRIC SoilGrids (250 m, CC BY 4.0): clay and sand content, 0–30 cm, used for soil texture and water-holding capacity.
- NOAA Climate Prediction Center: the Oceanic Niño Index (ENSO phase of each season, 2005–2024) and the official ENSO probability outlook (issued 12 November 2026), used for the autumn signal and Plan A / Plan B.
- ZARC, Agricultural Climate Risk Zoning (Brazilian Ministry of Agriculture, MAPA), and Embrapa: sowing deadlines, crop cycles, flowering dates, crop coefficients and water-satisfaction thresholds.
- OpenStreetMap (© OpenStreetMap contributors, ODbL), displayed with Leaflet: base map.
- Photon by komoot (OpenStreetMap data): reverse geocoding for the nearest place name.

SCIENTIFIC REFERENCES
- Allen, R. G., Pereira, L. S., Raes, D. and Smith, M. (1998). Crop Evapotranspiration: Guidelines for Computing Crop Water Requirements. FAO Irrigation and Drainage Paper 56.
- Hargreaves, G. H. and Samani, Z. A. (1985). Reference crop evapotranspiration from temperature. Applied Engineering in Agriculture, 1(2).
- Delta method for applying climate-model projections to observed series.
- Regional studies on dry spells and the end of the rainy season in the Triângulo Mineiro (Federal University of Uberlândia).

CONTEXT AND MARKET RESEARCH
IBGE Agricultural Census 2017; 9th ABMRA Brazilian farmer survey; McKinsey farmer survey; Conab crop reports; MAPA crop-insurance data; Ipea (technical assistance); regional coverage of the 2025/26 drought and the 2026/27 El Niño. The complete list with links is in the repository folder "arquivos contexto/".

OPEN-SOURCE SOFTWARE
Python, FastAPI, Uvicorn, SQLAlchemy, Alembic, Pydantic, PyYAML, HTTPX, Pytest, Ruff, PostgreSQL, PostGIS, React, React Router, Vite, TypeScript, Leaflet, React-Leaflet, Vitest, Testing Library, Oxlint and Docker. Inter and Space Grotesk fonts (SIL Open Font License); Lucide icons (ISC). The full dependency list is in the repository.

IMAGES
- Crop photographs from Wikimedia Commons, resized only and credited in the app: pearl millet, Shikoha Tautiko (CC BY-SA 4.0); brachiaria, Ethan Bass (CC BY-SA 4.0); fallow field, Andy Beecroft (CC BY-SA 2.0); sorghum in Cristalina, Brazil, Josue Marinho (CC BY 3.0); corn, Christian Fischer (CC BY-SA 3.0); sunn hemp, USDA NRCS Pacific Islands Area (public domain).
- Home-screen illustration: AI-generated with Lovable and visibly watermarked (see Use of Artificial Intelligence).

---

## 8. Use of Artificial Intelligence

Yes. AI tools assisted development, but no AI produces any number, score or recommendation shown to users.

- Claude (Anthropic): research support for the product discovery and data-source review; drafting the product requirements and technical documentation; pair programming on FastAPI services, React interfaces, NASA data-ingestion scripts and tests; and drafting interface and guide texts in Portuguese and English.
- Gemini (Google): pair programming, code review and documentation drafts.
- Lovable: early interface prototyping and the decorative illustration on the home screen. The illustration carries a permanent, visible "AI-generated image" watermark and contains no NASA logos, flags or mission identifiers.

Human oversight: the repository defines shared rules for contributors and AI agents (AGENTS.md). Test-driven development is mandatory, and the team reviewed every change. All results come from a deterministic rule engine running on NASA and partner data, and every threshold has a cited source. Agronomic texts remain marked as drafts until reviewed by an agronomist. The in-app "Credits and use of AI" window shows this information to users.

---

## Antes de colar, confira

- Licenças das fotos de sorgo, milho e crotalária: o PDF pede confirmação.
- Código feito com IA: a regra pede reconhecimento também no texto e nos metadados; vale uma frase explícita no README.
- Imagem gerada por IA no vídeo do demo também precisa de marca d'água.
- O exemplo "worked in 16 of 20 years" do campo 5 é ilustrativo; troque pelo número real da lavoura de demonstração, se quiser.
