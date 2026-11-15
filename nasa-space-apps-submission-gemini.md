# NASA Space Apps Challenge — Project Submission

## Project Name

Raiz Orbital

---

## High-Level Project Summary

Raiz Orbital is a web-based decision-support tool that helps soybean farmers in the Brazilian Cerrado decide what to plant after the summer soybean harvest—and how to build a resilient 3-year crop rotation plan—using 20 years of NASA Earth observation data, local soil properties, crop characteristics, and farmer priorities.

Addressing the "Field Shift" challenge, Raiz Orbital tackles a critical agricultural bottleneck in Brazil’s Triângulo Mineiro region: after harvesting soybeans between January and March, millions of hectares are either planted with high-risk second-crop corn in a continuous monoculture succession or left completely fallow with bare soil. Both practices degrade soil health, multiply root nematodes, and expose farmers to severe financial losses when autumn rains end early or extreme heat strikes during flowering.

With Raiz Orbital, a farmer answers just two questions—where the field is on the map and when soybeans are harvested. In under a second, the platform combines NASA satellites (GPM IMERG, NASA POWER, SMAP, MODIS, and NEX-GDDP-CMIP6) with soil data (SoilGrids) and FAO-56 daily water balance modeling to evaluate six off-season options (second-crop corn, sorghum, corn intercropped with brachiaria, pearl millet, crotalaria/sunn hemp, and fallow) across 20 historical seasons and 2041–2060 climate projections. Delivered in plain language with audio summaries and zero sign-up barriers, Raiz Orbital empowers growers and agronomists to protect soil health, reduce drought risk, and adapt to a changing climate.

---

## Detailed Project Description

### The Problem

In the Brazilian Cerrado—one of the world's largest grain-producing regions—farmers harvest summer soybeans between January and March and face an urgent annual decision: what to plant in the off-season as rainfall rapidly diminishes toward the dry winter? Due to a lack of accessible, field-specific agro-climatic analysis, most growers either repeat second-crop corn year after year or leave the land fallow. Continuous soybean-corn succession depletes organic matter and multiplies root nematodes, while fallow land leaves soil bare and vulnerable to heavy late-summer erosion. Meanwhile, delayed soybean harvests push second-crop flowering into April and May, when dry spells and ≥35 °C heat waves frequently cause crop failure.

### What Raiz Orbital Does

Raiz Orbital transforms complex satellite datasets into a 1-minute, mobile-first workflow for farmers and agronomists:

1. **Mark the Field:** The user taps their field on an interactive map, uses device GPS, pastes coordinates or Google Maps links, or selects a pre-loaded Demo Field near Uberlândia, Minas Gerais.
2. **Select Soybean Harvest Timing:** The user selects their expected harvest date or period (early, mid, or late February). An interactive view shows remaining seasonal rainfall, monthly rainfall versus crop water demand, historical end-of-rains dates, and the exact impact of harvest delay on crop success rates.
3. **Orbital Mission & Field X-Ray:** While computing, an accessible mission screen shows real-time data retrieval. The "Field X-Ray" screen then presents 8 satellite indicators for that location: soil texture, soil water-holding capacity, current root-zone moisture percentile, current vegetation greenness, typical seasonal rainfall, longest historical dry spell, extreme heat years, and regional rainfall comparison, plus a 10-year MODIS NDVI timeline detecting whether the field was planted or left fallow in past off-seasons.
4. **Choose & Compare:** Farmers filter by their top priority ("Less drought risk", "More income", or "Take care of the soil") to see the top recommendation, explore a 20-year bar chart of water satisfaction during the critical flowering window with El Niño/La Niña markers and daily season replay, inspect the crop water budget ("Needs X mm · Usually rains Y mm · Short Z mm"), and compare up to 3 crops side by side.
5. **3-Year Rotation Plan:** Farmers build and customize a 3-year off-season rotation sequence, comparing their plan's Climate Safety, Soil Health, and 2041–2060 Climate scores against their current last-3-seasons baseline. It also provides an Autumn Signal based on the NOAA ENSO outlook and historical performance, with an automatic Plan A for normal rain and Plan B if autumn turns dry, plus a print-ready report.
6. **Local Alerts, Community & Guide:** Includes active satellite alerts for the marked point (dry soil, recent dry spells and heat, decadal climate shifts, and historical extremes), a privacy-first 30 km neighbor reporting map with zero sign-up and coordinates aggregated to 0.1° grid cells, a built-in agronomic Guide, and a full transparency page ("How the math works") exposing every rule and threshold.

### How the Agro-Climatic Engine Works

Every number on screen is computed by deterministic rules—no generative AI is used for calculations:

- **Daily Water Balance (FAO-56):** For each of the 20 historical seasons (2005–2024), the engine calculates daily reference evapotranspiration ($ET_o$) via FAO-56 Penman-Monteith (or Hargreaves-Samani fallback) using NASA POWER, scales it by the crop's daily coefficient curve ($ET_c = ET_o \times K_c$), and simulates a daily soil-water bucket using SoilGrids available water capacity (40–60 mm) initialized with NASA SMAP root-zone wetness.
- **Climate Safety Score (30% weight):** Evaluates the Water Satisfaction Index ($ISNA = ET_r / ET_c$) and extreme heat days ($\ge 35^\circ\text{C}$) during each crop's critical window ($\pm 15$ days around flowering for grains; first 30 days for cover crops). A season succeeds if $ISNA \ge 0.55$ ($0.50$ for cover crops) and heat days $< 3$.
- **Future Climate Score 2041–2060 (15% weight):** Applies monthly precipitation ($\Delta\%$) and temperature ($\Delta^\circ\text{C}$) deltas from three NEX-GDDP-CMIP6 models (ACCESS-CM2, MPI-ESM1-2-HR, MRI-ESM2-0 under SSP2-4.5) to the 20-year baseline, recalculates $ET_o$, and re-simulates all crop cycles.
- **Soil Health Score (25% weight):** Scores straw production (up to 40 pts), biological nitrogen fixation (up to 30 pts), and pest/nematode cycle breaking (up to 30 pts, weighted $1.5\times$ when nematodes are present).
- **Income Score (30% weight):** Fact-based assessment combining grain-producing capability with historical climate reliability.
- **3-Year Rotation Optimizer:** Evaluates 216 3-year combinations ($6^3$), enforcing agronomic rules (no repeating grass crops, mandatory nematode suppressor when needed, official planting deadlines) and rewarding functional diversity.

### Key Benefits & Goals

- **Radical Simplicity & Inclusion:** Designed for 360 px mobile screens in the field, featuring bilingual support (English and Portuguese) and Web Speech API audio summaries ("Listen to summary") on every screen for low-literacy accessibility.
- **Scientific Rigor & Transparency:** Grounded in Embrapa, ZARC (Brazilian Agricultural Climate Risk Zoning), and FAO-56 methodologies, with every rule and source auditable in the user interface.
- **Scalable Roadmap:** Currently operating with pre-loaded high-resolution data for the Uberlândia and Uberaba pilot area in Minas Gerais, with an automated pipeline ready to expand across the entire Triângulo Mineiro and Brazilian Cerrado.

### Technologies Used

- **Backend:** Python 3.12, FastAPI, Uvicorn, SQLAlchemy, Alembic, Pydantic, PyYAML, PostgreSQL 17 + PostGIS 3.5, uv, Pytest, Ruff.
- **Frontend:** React 19, TypeScript, Vite, React Router, Leaflet, React-Leaflet, CSS Modules, custom Design System tokens, Web Speech API, Vitest, Testing Library, Oxlint.
- **Data Pipeline:** Automated Python ingestion scripts for NASA POWER REST API, NASA GES DISC / Earthdata (GPM IMERG), NASA NCCS THREDDS OPeNDAP/NCSS (NEX-GDDP-CMIP6), AppEEARS & ORNL DAAC (MODIS), NSIDC (SMAP), ISRIC SoilGrids, and NOAA CPC.

---

## NASA Data

Raiz Orbital integrates five NASA Earth observation datasets and climate projection products across its agro-climatic simulation engine, field diagnostics, and alert system:

1. **GPM IMERG Final Run Daily (GPM_3IMERGDF v07, 0.1° / ~10 km resolution):**
   - **How it is used:** Provides the 20-year daily precipitation series (January–July) for each 0.1° grid cell. Used to drive the daily soil-water balance simulation for all 6 off-season crops, compute remaining rainfall after soybean harvest, identify historical end-of-rains dates (20 consecutive days with <10 mm after March 1), measure maximum autumn dry spells, detect heavy erosion-risk rainfall events ($\ge 50\text{ mm/day}$ in Feb–Mar), and compare local March–May rainfall against neighboring cells in the region.

2. **NASA POWER (Prediction Of Worldwide Energy Resources, Daily Agroclimatology API, ~0.5° resolution):**
   - **How it is used:** Supplies 20-year daily maximum and minimum air temperatures (`T2M_MAX`, `T2M_MIN`), relative humidity (`RH2M`), wind speed (`WS2M`), solar radiation (`ALLSKY_SFC_SW_DWN`), and fallback/recent precipitation (`PRECTOTCORR`). Used to calculate daily reference evapotranspiration ($ET_o$) via FAO-56 Penman-Monteith and Hargreaves-Samani, count extreme heat stress days ($\ge 35^\circ\text{C}$) during crop flowering, detect frost risk ($\le 3^\circ\text{C}$ in May–July), and power 30-day recent weather alerts.

3. **NASA NEX-GDDP-CMIP6 (NASA Earth Exchange Global Daily Downscaled Projections, 0.25° / ~27.8 km resolution, via NCCS THREDDS):**
   - **How it is used:** Retrieves daily precipitation (`pr`) and maximum/minimum temperatures (`tasmax`, `tasmin`) comparing the 1995–2014 baseline against 2041–2060 projections under scenario SSP2-4.5 across three global climate models (`ACCESS-CM2`, `MPI-ESM1-2-HR`, `MRI-ESM2-0`). Monthly deltas are applied to the historical series to re-simulate $ET_o$, water deficits, and crop success rates in 2041–2060, showing farmers both the multi-model mean and model agreement.

4. **NASA SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture (SPL4SMGP v007/v008):**
   - **How it is used:** Provides root-zone soil moisture (`sm_rootzone_wetness` and `sm_rootzone_m3_m3`). Used to initialize the real soil-water bucket storage on the exact sowing date of each simulated year (from 2015 onward), display the current soil moisture percentile on the Field X-Ray gauge, and trigger dry-soil warnings when root-zone moisture falls to or below the 20th percentile for the time of year.

5. **NASA MODIS Terra & Aqua Products (250 m and 500 m resolution, Collection 061, via AppEEARS and ORNL DAAC):**
   - **MOD13Q1 & MYD13Q1 (16-Day Vegetation Indices at 250 m):** Reconstructs a 10-year field history (2017–2026) for any 250 m pixel in the pilot area. Detects summer soybean presence ($\text{NDVI} \ge 0.70$ in Jan–Mar), estimates soybean senescence and harvest timing, and classifies post-soybean off-seasons (Apr–Jul) as planted second crop ($\text{NDVI}_{\max} \ge 0.60$) or fallow ($\text{NDVI}_{\max} < 0.45$).
   - **MCD12Q1 (Land Cover Type at 500 m):** Filters cropland pixels (IGBP Class 12) within a 30 km radius to compute regional off-season fallow versus planted statistics.
   - **MCD64A1 (Burned Area Monthly L3 Global at 500 m):** Identifies historical burned area occurrences within 5 km of the marked field (2016–2025) for fire risk alerts.

---

## Space Agency Partner & Other Data

### External Datasets & Geolocation Services

- **ISRIC SoilGrids (250 m, CC BY 4.0):** Clay, silt, and sand fractions across 0–30 cm depths used to classify local soil texture (Sandy, Medium, Clayey) and determine Available Water Capacity.
- **NOAA Climate Prediction Center (CPC):** Historical Oceanic Niño Index (ONI) series and official probabilistic ENSO outlook used to tag historical years (El Niño / La Niña) and generate the Autumn Signal (Plan A vs. Plan B).
- **ZARC (Brazilian Ministry of Agriculture — MAPA) & Embrapa:** Agronomic parameters, crop coefficients ($K_c$), cycle lengths, sowing deadlines, nematode suppression ratings, nitrogen fixation rates, and water satisfaction thresholds.
- **OpenStreetMap (© OpenStreetMap contributors, ODbL):** Map tiles and geographic data.
- **Photon by komoot (OpenStreetMap data):** Reverse geocoding to display approximate location names near the marked pin.

### Open-Source Software, Fonts & Icons

- **Frontend:** React 19 & React DOM (MIT), React Router (MIT), Vite (MIT), TypeScript (Apache-2.0), Leaflet & React-Leaflet (BSD-2-Clause), Vitest & Testing Library (MIT), Oxlint (MIT).
- **Backend & Database:** Python 3.12 (PSF), FastAPI (MIT), Uvicorn (BSD-3-Clause), SQLAlchemy (MIT), Alembic (MIT), Pydantic & Pydantic-Settings (MIT), Psycopg 3 (LGPL-3.0), PyYAML (MIT), HTTPX (BSD-3-Clause), Pytest (MIT), Ruff (MIT), PostgreSQL 17 (PostgreSQL License) + PostGIS 3.5 (GPL-2.0).
- **Typography & Icons:** Inter and Space Grotesk fonts via `@fontsource` (SIL Open Font License 1.1); Lucide Icons via `lucide-react` (ISC License).

### Images & Photographs

- **Home Screen Hero Illustration:** AI-generated field illustration created with **Lovable**; visibly watermarked on screen as *"AI-generated image"*.
- **Crop Photographs (Wikimedia Commons, resized to max 800 px width with full attribution and license links in the app):**
  - **Pearl millet:** *"Mahangu (pearl millet) field flourishing in the perfect climate in the rural north of Namibia.jpg"* by Shikoha Tautiko (CC BY-SA 4.0).
  - **Corn with brachiaria:** *"Strip of Brachiaria brizantha (signal grass).jpg"* by Ethan Bass (CC BY-SA 4.0).
  - **Leave it fallow:** *"Fallow Field - geograph.org.uk - 484462.jpg"* by Andy Beecroft (CC BY-SA 2.0).
  - **Sorghum:** *"Cristalina GO Brasil - Plantação de sorgo, BR 040 - panoramio.jpg"* by Josue Marinho (CC BY 3.0).
  - **Corn alone:** *"ZeaMays.jpg"* by Christian Fischer (CC BY-SA 3.0).
  - **Crotalaria:** *"Sunn Hemp Cover Crop.jpg"* by USDA NRCS Pacific Islands Area (Public Domain).

---

## Use of AI

We used **Claude** (Anthropic), **Gemini** (Google), and **Lovable** as development assistants during the hackathon:

- **Code & Architecture:** Claude and Gemini assisted with pair programming, writing unit and integration tests following strict Test-Driven Development, structuring FastAPI services and repositories, building React components, and writing data ingestion scripts for NASA APIs.
- **UI Prototyping & Visuals:** Lovable was used to prototype UI layouts and to generate the decorative sunrise crop field illustration on the Home screen. In full compliance with NASA Space Apps Challenge rules, this image displays a permanent, visible watermark badge directly on the image ("AI-generated image") and contains no NASA logos or insignia.
- **Text & Documentation:** Claude and Gemini helped draft and translate user interface copy, agronomic guide drafts, and technical documentation.

**Human Review & Scientific Integrity:** All code, texts, and agronomic parameters were reviewed and validated by the team. **No number, score, climate indicator, or recommendation shown in the application is generated by AI:** all calculations are performed deterministically by our fixed-rule agro-climatic engine operating directly on real NASA and partner datasets.
