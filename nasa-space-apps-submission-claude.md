# NASA Space Apps 2026 — Project Submission (Raiz Orbital)

Textos dos campos 2, 5, 6, 7 e 8 do formulário de submissão, em inglês, prontos para colar.
Base: PDF "Fontes de dados por tela" (15/11/2026), PRD, discovery (personas, dores e hipóteses) e o código do repositório.
O guia oficial não informa limite de caracteres; se algum campo cortar o texto, encurte primeiro o campo 5 (seções "Limits" e "Tools") e depois o 7.

---

## 2. High-Level Project Summary

Every year between January and March, soybean farmers in Brazil's Cerrado must decide what to plant after the harvest, just as the autumn rains are about to end. Most repeat second-crop corn or leave the field bare. Both choices wear down the soil, feed root nematodes and leave the farmer exposed to drought and heat losses, with almost no crop insurance to absorb them.

Raiz Orbital is a responsive website that answers one question for one specific field: "What should I plant after soybeans?" The farmer answers only two things: where the field is and when the soybeans will be harvested. Raiz Orbital then replays 20 seasons (2005–2024) of NASA rainfall, weather, soil moisture and vegetation data, plus NASA climate projections for 2041–2060, against the local soil and the needs of six off-season options. It recommends a crop and a 3-year rotation, ranked by the farmer's own priority (more safety, more income or caring for the soil), with a Plan B for a dry autumn. Every number shows its source.

This is exactly what Field Shift asks for: NASA Earth observations, local soil information, crop characteristics and farmer priorities, combined into rotation strategies that strengthen soil health and adapt farms to a changing climate. Our first version covers the Uberlândia and Uberaba region (Triângulo Mineiro, Minas Gerais), where our team is based, just as the 2026/27 El Niño puts the next off-season at risk.

Tagline: "Eyes on the sky, roots in the ground."

---

## 5. Detailed Project Description

THE PROBLEM

In the Brazilian Cerrado, the dominant system is soybeans in summer followed by second-crop corn ("safrinha"), or soybeans followed by fallow. Embrapa points out that this succession harms soil and long-term productivity. The off-season decision is made every year with little field-level information, and the risk is real and growing:

- The end of the rains drives the risk. In the Triângulo region, the dry season starts in April in most years, and corn sown late reaches flowering without water.
- In 2025/26, rainfed crops in the Triângulo were severely hit by drought, and many farmers missed the ideal corn sowing window.
- The 2026/27 season is starting under a strong El Niño, which raises uncertainty precisely over the next off-season.
- In 2025, only 3.3% of Brazil's planted area had crop insurance, so climate losses go straight to the farmer's cash and debt.

WHO WE BUILT IT FOR

Before writing code, we studied the region's farmers using public data (IBGE Agricultural Census, the ABMRA farmer survey, McKinsey, Conab, Embrapa and regional university research) and built three proto-personas, which we still need to validate in interviews:

- Marcelo, a rainfed grain farmer near Uberlândia (main user). Most farmers in Minas Gerais are over 45 and only finished primary school. He lives on WhatsApp and asks: "I have the forecast. What I don't know is whether the corn will make it."
- Ana, an agronomist at a cooperative or input dealer (channel and source of trust). 65% of farmers change practices because of a technical recommendation, but only 6% trust AI to make decisions.
- Family farmers such as Seu José and Dona Cida (community layer). They worry about early drought and fire coming from the neighbor's land.

These findings shaped our design: only two questions, plain language, a "Listen to summary" button on every screen, the source visible on every number, and a clear message that the tool "helps you decide, it does not replace your agronomist."

WHAT IT DOES

1. Where is your field: the farmer taps the map, uses GPS or pastes coordinates or a Google Maps link. A demo field near Uberlândia is preloaded.
2. When do you harvest: early, mid or late February to March. A detail view shows how much rain is usually left after each date, monthly rain against crop water demand, and when the rains usually end. If the satellite did not see a soybean crop at that point, the app says so.
3. Mission: an animated screen lists only the data that actually exists for that point.
4. Field X-Ray: 8 indicators for the point (soil texture, water the soil can hold, current root-zone moisture, greenness, typical rain, longest dry spell, heat years, and rain compared with the region), plus a 10-season MODIS NDVI history showing whether the field was planted or left fallow after soybeans. The farmer confirms each season.
5. Choose: the farmer picks a priority (more safety, income or soil care) and gets one recommendation, for example "worked in X of 20 years". Up to 3 crops can be compared side by side, and a year-by-year chart of water satisfaction carries El Niño and La Niña marks.
6. 3-year plan: a rotation suggested link by link, with the reason for each year ("the soil was left bare; cover it fast with a crop that handles drought"), compared with how the field is managed today. It includes an autumn signal (NOAA outlook) with Plan A and Plan B.
7. Your plan and alerts: frost, heavy rain and fire alerts, 2041–2060 climate cards, current warnings (dry soil, dry days, heat), and how the area changed in 2020–2024 compared with 2005–2019.
8. Guide and "How the math works": 27 short articles in Portuguese and English, and a transparency page that lists every rule, threshold and data source.

HOW IT WORKS

A single rule engine in the backend feeds every screen, so a "worked in X of 20 years" on one screen is the same number on every other.

- Daily series for the 0.1° cell, January to July of 2005–2024. Rain comes from GPM IMERG (NASA POWER as a fallback). Reference evapotranspiration is computed with FAO-56 Penman–Monteith from NASA POWER, or Hargreaves–Samani when data is missing.
- The soil comes from SoilGrids: clayey soils hold 60 mm of water, medium soils 50 mm and sandy soils 40 mm. The farmer can change it.
- A FAO-56 daily soil-water balance starts each year from the NASA SMAP root-zone moisture on the sowing day (from 2016 onward).
- The sowing date follows the harvest. Crops past their official ZARC sowing deadline are shown as "out of window" and not suggested.
- A year "worked" if water satisfaction (ISNA) stayed at or above 55% around flowering (50% in the first 30 days for cover crops) with fewer than 3 days at or above 35 °C.
- The future: monthly deltas from 3 NEX-GDDP-CMIP6 models (SSP2-4.5, 2041–2060 vs 1995–2014) are applied and the whole simulation runs again.
- Scores from 0 to 100: climate safety 30%, future climate 15%, soil health 25% (straw, nitrogen, breaking the nematode cycle) and income 30%. The farmer's priority reorders the ranking.
- The six options are second-crop corn, sorghum, corn with brachiaria, pearl millet, crotalaria (sunn hemp) and fallow.

DECISIONS WE TOOK ON PURPOSE

- No invented numbers. Every threshold lives in versioned rule files with its source (ZARC, Embrapa, FAO-56), and the API rejects any number without one. If there is no data for a point, that block simply does not appear.
- No generative AI in the calculation. It is deterministic, auditable rules on real data, because farmers trust agronomists, not AI.
- No money values. Income is based on facts (whether the crop yields grain, and in how many years it lacked water or suffered heat) because we did not want to guess prices.
- A website, not an app. It works on a phone in the field and on the computer at the cooperative, with no sign-up.
- Privacy. Neighbor reports are stored only at the 0.1° grid-cell level, never at the exact farm location.
- A focused pilot area (Uberlândia and Uberaba, 226 grid cells with preloaded data). It is honest about where the tool works, with a clear path to scale.

BENEFITS AND GOALS

Our main hypothesis: if farmers see, for their own field, how each off-season option performed over 20 years of NASA data and in the 2050s climate, at least 1 in 3 will try a soil-building option (sorghum, corn with brachiaria or a cover crop) on part of their land. Next steps: 10 interviews with farmers and agronomists, a pilot with 15 to 20 farmers in the 2027 off-season, checking our "tight years" against IBGE second-crop corn losses, then expanding to the whole Triângulo Mineiro and the Cerrado and delivering alerts through WhatsApp and agronomists.

LIMITS WE SHOW TO THE USER

Satellites observe; they do not forecast the weather. SMAP and IMERG see kilometers, not a single field. Optical NDVI is blind on cloudy weeks. Crop and management texts are drafts pending review by an agronomist.

TOOLS

Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL 17 + PostGIS 3.5, Pytest; React 19, TypeScript, Vite, Leaflet, Vitest; Docker. Data pipeline scripts in Python. Built with test-driven development. No special hardware.

---

## 6. NASA Data

NASA data is the core of Raiz Orbital: every score is computed from it. We download it directly from NASA services (POWER API, GES DISC, ORNL DAAC, NCCS THREDDS, Earthdata) into our own PostGIS database. "NASA" appears in the app only as the name of each source, never as a logo.

- GPM IMERG Final Run v07 (daily, 0.1°, 2005–2024): the rainfall in every calculation. It drives the daily soil-water balance for all six crops, the "rain left after harvest" curve, the end-of-rains date, the longest autumn dry spell, heavy-rain alerts (50 mm or more) and the comparison with neighboring cells.
- NASA POWER (daily agroclimatology): maximum and minimum temperature, humidity, wind and solar radiation for 2005–2024, used to compute reference evapotranspiration (FAO-56 Penman–Monteith), heat stress at flowering (35 °C or more) and frost risk (3 °C or less). It is also the rain fallback, and its last 30 days power the current dry-day and heat warnings.
- SMAP L4 SPL4SMGP v008 (root-zone soil moisture, 9 km): the starting water in the soil on each sowing day (2016–2025), the current soil-moisture percentile in the Field X-Ray, and dry-soil warnings (20th percentile or lower).
- MODIS MOD13Q1 + MYD13Q1 (NDVI, 250 m, 16 days, 2017–2026): the history of each field. It detects the soybean crop (peak NDVI of 0.70 or more, then harvest) and classifies each off-season as planted (above 0.60), fallow (below 0.45) or uncertain. The farmer confirms each season, and the answers feed the plan.
- MODIS MCD12Q1 (land cover, 500 m): a cropland mask to show what neighboring fields within 30 km did after soybeans.
- MODIS MCD64A1 (burned area, 500 m, 2016–2025): fire alerts when burning occurred within 5 km of the field.
- NEX-GDDP-CMIP6 (0.25°, SSP2-4.5, 3 models: ACCESS-CM2, MPI-ESM1-2-HR, MRI-ESM2-0): monthly changes in rain and temperature for 2041–2060 compared with 1995–2014. They are applied to our 20-year series to rerun every crop, showing "would work in X of 20 years" in the future climate and how many models agree.

Together they answer the questions Field Shift poses: how each rotation option would have performed in this field, how it performs under a changing climate, and what the field's own history says about its soil cover. We evaluated GEOS-S2S and IMERG Late but left them out of the product (format and coverage limits); their scripts remain in the repository. Because MODIS is being retired, our roadmap moves recent greenness to HLS and VIIRS.

---

## 7. Space Agency Partner & Other Data

DATA

- ISRIC SoilGrids (250 m, CC BY 4.0): clay and sand from 0 to 30 cm, used for soil texture and water-holding capacity.
- NOAA Climate Prediction Center: the Oceanic Niño Index (El Niño / La Niña phase of each year, 2005–2024) and the official ENSO outlook (issued 12 Nov 2026), used for the autumn signal and Plan A / Plan B.
- ZARC (Brazilian Ministry of Agriculture, MAPA) and Embrapa: sowing deadlines, crop cycles, flowering dates, crop coefficients and water-satisfaction thresholds. Every value is stored with its source in our rule files.
- OpenStreetMap (© OpenStreetMap contributors, ODbL), shown with Leaflet: base map.
- Photon by komoot (OpenStreetMap data): name of the nearest place.
- Community reports: our own anonymous API. Data is stored only at the 0.1° grid-cell level, and devices are identified by a salted HMAC.

SCIENTIFIC METHODS

- Allen et al. (1998), FAO Irrigation and Drainage Paper 56: Penman–Monteith reference evapotranspiration and daily soil-water balance.
- Hargreaves & Samani (1985): evapotranspiration fallback.
- The delta method for applying CMIP6 projections to an observed series.
- Regional research on dry spells and the end of the rainy season in the Triângulo Mineiro (Federal University of Uberlândia).

RESEARCH BEHIND THE PERSONAS AND THE PROBLEM

IBGE Agricultural Census 2017, the 9th ABMRA farmer survey, McKinsey's farmer survey, Conab crop reports, MAPA crop-insurance data, Ipea (technical assistance) and regional news coverage of the 2025/26 drought and the 2026/27 El Niño. The full list with links is in our discovery document in the repository ("arquivos contexto/").

SOFTWARE (open source)

Python, FastAPI, Uvicorn, SQLAlchemy, Alembic, Pydantic, PyYAML, HTTPX, Pytest, Ruff, PostgreSQL + PostGIS, React, React Router, Vite, TypeScript, Leaflet / React-Leaflet, Vitest, Testing Library, Oxlint, Docker. Fonts: Inter and Space Grotesk (SIL OFL). Icons: Lucide (ISC). The full dependency list is in the repository.

IMAGES

- Crop photos from Wikimedia Commons, only resized, credited in the app: pearl millet by Shikoha Tautiko (CC BY-SA 4.0); brachiaria by Ethan Bass (CC BY-SA 4.0); fallow field by Andy Beecroft (CC BY-SA 2.0); sorghum in Cristalina, Brazil, by Josue Marinho (CC BY 3.0); corn by Christian Fischer (CC BY-SA 3.0); sunn hemp by USDA NRCS Pacific Islands Area (public domain).
- Home-screen field image: AI-generated with Lovable and watermarked on screen (see Use of AI).

---

## 8. Use of Artificial Intelligence

Yes, we used AI tools as assistants. No AI produces any number, score or recommendation shown to the farmer.

- Claude (Anthropic): research support for product discovery (farmer profiles, pains, data-source review), drafting the PRD and documentation, pair programming (FastAPI services, React screens, NASA data-ingestion scripts and tests), and drafting interface and Guide texts in Portuguese and English.
- Gemini (Google): pair programming, code review and documentation drafts.
- Lovable: early UI prototyping, and the decorative field image on the home screen. That image carries a visible "AI-generated image" watermark on screen and contains no NASA logos, flags or mission identifiers.

How we kept control: the repository has shared rules for people and AI agents (AGENTS.md), test-driven development is mandatory, and every change was reviewed by the team. All scores come from a fixed, deterministic rule engine running on real NASA and partner data. Every threshold has a cited source (ZARC, Embrapa, FAO-56), and the API rejects any number without one. Crop and management texts are marked as drafts until reviewed by an agronomist. The "Credits and use of AI" window in the app lists all of this to the user.

---

## Antes de colar, confira

- Pacote 3 (branch feat/remodelagem): se entrar no main, dá para citar a linha do tempo e o relatório impresso de "Seu planejamento"; se a comunidade virar "Em breve", troque a menção dela no campo 5 por "coming soon".
- Personas: o texto diz que vieram de dados secundários e ainda serão validadas; se houve conversa com produtor ou agrônomo, inclua.
- Código feito com IA: a regra pede reconhecimento também no texto e nos metadados; vale uma frase explícita no README.
- Licenças das fotos de sorgo, milho e crotalária: confirmar (pendência do PDF).
- Imagem gerada por IA no vídeo do demo também precisa de marca d'água.
