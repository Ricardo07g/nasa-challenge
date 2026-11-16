# PRD: Raiz Orbital, what to plant after soybeans?

> **Eyes on the sky, roots in the ground.** ("Raiz Orbital" is Portuguese for "Orbital Root".)

**Version:** 4.1 · November 15, 2026 · Product owner: Rayanne
**Status:** describes the product as built for NASA Space Apps Challenge 2026 (Field Shift), Uberlândia local event. Future work lives in the [product roadmap](04-product-roadmap.md).

## 1. Summary

**The challenge.** Field Shift asks for a decision-support tool that uses NASA Earth observations, local soil information, crop characteristics and farmer priorities to **explore rotation strategies** that strengthen soil health and adapt farms to changing conditions.

**The problem.** In the Triângulo Mineiro and the wider Cerrado, the dominant system is soybeans in summer followed by second-crop corn, or soybeans followed by fallow. Embrapa links this succession to soil degradation and long-term yield loss. Every year, between January and March, the farmer decides what to plant after the soybeans, with little field-level information about drought risk, the effect on the soil or the climate ahead.

**The solution.** For one field, Raiz Orbital simulates six off-season options over 20 seasons of NASA data and under 2041–2060 climate projections, recommends one, lets the farmer compare up to three, and builds a 3-year rotation plan with a Plan B for a dry autumn. Every number shows its source.

**Scope.**

| Built for the hackathon | Later (see roadmap) |
| --- | --- |
| Pilot area: 226 grid cells around Uberlândia and Uberaba | The whole Triângulo, the Cerrado, Brazil |
| Six options: second-crop corn, sorghum, corn with brachiaria, pearl millet, crotalaria, fallow | More crops and more starting crops |
| 20 years of NASA observations and 2041–2060 projections | Daily season monitoring |
| 3-year plan with Plan A / Plan B | Satellite check of adoption |
| Alerts page and printable planning report | Alerts on WhatsApp |
| Bilingual web app (Portuguese and English) | Regional community (shown as "coming soon") |

### Glossary

- **Off-season / second crop (safrinha):** what is planted after the soybean harvest, from January to March.
- **Season naming:** a season is named by its two years. The 2025/26 soybeans were planted in late 2025 and harvested in early 2026; "after the soybeans" of 2025/26 means March to July 2026. The current season is 2026/27.
- **Fallow:** leaving the field without a crop until the next soybeans.
- **Cover crop:** a crop grown to protect and improve the soil, not for grain (pearl millet, crotalaria, brachiaria).
- **Straw (palhada):** plant residue on the soil that protects it from erosion and heat and keeps moisture.
- **ISNA (Water Satisfaction Index):** actual divided by potential crop evapotranspiration, from 0 to 1.
- **ZARC:** Brazil's Agricultural Climate Risk Zoning; it sets the sowing deadline that crop insurance and credit require.
- **NDVI:** satellite greenness index; it shows whether a crop was growing in the field.

## 2. Judging criteria and how we score

| Criterion | What judges ask | How Raiz Orbital scores |
| --- | --- | --- |
| **Influence** | How much good, for how many people? | Almost 49 million hectares of soybeans in Brazil face the off-season decision every year; soil, water and income at stake |
| **Creativity** | New, or incremental? | Reads the field's real history by NDVI, replays every option over 20 seasons of NASA data and in the 2050s climate, and answers in one sentence a farmer uses: "worked in 11 of 20 years" |
| **Validity** | Scientifically sound, works in the real world? | FAO-56 water balance, ZARC and Embrapa thresholds, every threshold stored with its source; limits written on screen |
| **Relevance** | Responds to the challenge, complete, usable? | Covers all four inputs (NASA data, local soil, crops, priorities) and the requested output (rotation strategies for soil and climate) |
| **Presentation** | Clear story of challenge, solution and why it matters? | A 29-second demo video in English, a Project Details page with real screenshots, and a live demo field that opens with one tap |

### Challenge coverage

| The challenge asks for | Where it is in the product |
| --- | --- |
| NASA Earth observations | GPM IMERG, NASA POWER, SMAP L4, MODIS (NDVI, land cover, burned area), NEX-GDDP-CMIP6 (section 6) |
| Local soil information | SoilGrids texture and water-holding capacity, adjustable by the farmer |
| Crop characteristics | Cycle, flowering, crop coefficients and sowing deadlines from ZARC and Embrapa (section 5) |
| Farmer priorities | "More safety", "Income" or "Care for the soil" reorders the ranking |
| Rotation strategies | A 3-year plan compared with the field's current management |
| Soil health | Score for straw, nitrogen and nematode suppression, plus the field's fallow history |
| Adaptation | 20-year risk, a dry-autumn Plan B and a 2041–2060 re-simulation |

## 3. Users and user stories

**The decision:** "After these soybeans, what do I plant on this field, and what sequence do I follow for the next 3 years to keep income, protect the soil and not lose money to drought?"

| Persona | Who | What they need |
| --- | --- | --- |
| Marcelo, rainfed grain farmer (primary) | 200 to 1,500 ha of soybeans in the Triângulo; phone all day | See in minutes which option and sequence give the most safety and income on his field |
| Ana, reseller or cooperative agronomist | Serves dozens of farmers | Compare options with data to justify a recommendation |
| Space Apps judge | Evaluates in minutes | Understand the value fast and see the NASA data behind every number |

| ID | As a... | I want to... | So that... | Status |
| --- | --- | --- | --- | --- |
| US-01 | farmer | mark my field on a map, by GPS or with coordinates | the app uses the data of that place | Done |
| US-02 | farmer | tell the expected soybean harvest date, or roughly when | the app knows when the off-season starts | Done |
| US-03 | farmer | see my field as the satellites saw it, including my last seasons | I understand where I am starting from | Done |
| US-04 | farmer | get one recommendation for my priority and compare up to 3 crops | I choose with information, not habit | Done |
| US-05 | farmer | read why a crop was recommended, with the NASA data cited | I trust the recommendation | Done |
| US-06 | farmer | see a 3-year plan, change any year and still see your suggestion | I can leave the soybean–corn or soybean–fallow routine | Done |
| US-07 | farmer | know what to do if the autumn is dry | I have a Plan B before I plant | Done |
| US-08 | farmer | see what to do and when, and print a planning report | I can take it to my agronomist | Done |
| US-09 | farmer | see alerts for my area and how the climate is changing here | I am ready for what comes | Done |
| US-10 | judge | open a demo field with one tap | I see the product working without sign-up | Done |
| US-11 | farmer | get the plan and alerts on WhatsApp | I do not need to open a website | Roadmap |
| US-12 | farmer | share and see what neighbors planted and how it went | I learn from people I trust | Roadmap |

## 4. Product flow and functional requirements

### Screens

1. **Home (`/`).** The question, one main button, "1 minute, free, no sign-up". In English, a discreet line under the name: "Portuguese for “Orbital Root”".
2. **Where is the field (`/onde`).** Map (Leaflet + OpenStreetMap) opening with the demo field marked; "Use where I am now"; "Other ways to mark" (coordinates or a Google Maps link). Points outside the pilot area are refused with a clear message.
3. **When do you harvest the soybeans (`/quando`).** A date field; "Not sure of the exact day" opens early, mid or late February; a large "Still deciding? See our suggestions" box opens a near-full-screen panel comparing harvest periods, rain left after harvest, rain month by month and when the rain usually ends.
4. **Calculating.** A short mission-style animation while the engine runs.
5. **Field X-Ray.** Eight blocks, each opening a modal: soil texture, water-holding capacity, root-zone moisture now (percentile), vegetation greenness, seasonal rain, longest autumn dry spell, extreme-heat years and rain compared with the region. **Your last seasons:** an NDVI chart of every season, labeled by season (2016/17 to 2025/26), with the farmer confirming the last three off-seasons and the plan for the current season (soybeans assumed planted, expected harvest date shown).
6. **Choose (`/resposta`, tab 1).** Priority in three equal buttons (More safety, Income, Care for the soil). A suggestion card with a photo, "worked in X of 20 years" and "Why this suggestion?" (large modal). Up to three crops compared side by side on desktop, swipe cards on mobile; every cell opens a modal. "Use in my plan" keeps the button in place and only changes its label.
7. **3-year plan (`/resposta`, tab 2).** One card per season, each with a select. Changing a year recalculates the following years and shows why. **Our suggestion is always visible:** marked in the select and shown under it with "Use the suggestion" when the farmer picked something else; the card tag returns to "Our suggestion" when the farmer picks it again. Rain used by the plan; "What if the year is dry?" with Plan A and Plan B; "Missing seasons" never blocks, it opens a modal to fill them.
8. **Your plan (`/planejamento`).** Plan summary; "What to do now" timeline built from the harvest date (now, check the autumn signal in February, harvest, plant by the ZARC deadline, flowering, harvest and straw, next soybeans); area alerts (El Niño outlook, heavy rain, fire); past and future performance of each crop in the plan; a community "coming soon" card with "Open the Guide"; **the only "Print report" in the product**: soil, last seasons, options compared, the 3-year plan with pros and cons, what to do and when, alerts and climate, sources.
9. **Alerts (`/avisos`).** A status summary; "Now" alerts as cards with "Details" modals; official Civil Defense alerts next to them (SMS 40199, WhatsApp, 193, 199); "How your area is changing" (2020–2024 vs 2005–2019); "It already happened here" (extremes since 2005); "2024 example" modal; community "coming soon".
10. **Guide (`/guia`, `/guia/{article}`).** Search, topic filters, "Start here", 27 short articles with a one-line summary, reading time and a discreet "under review" mark. Each article has "In one sentence", sections, "On your field" with a real number when one exists, "With your agronomist", collapsible sources and "See also".

Supporting pages: "How the math works" and "Credits and use of AI". The header shows the logo, **Guide**, the **Alerts** bell with a count, and PT/EN. The `/comunidade` route shows only the "coming soon" card.

### Functional requirements

| ID | Requirement | Detail |
| --- | --- | --- |
| FR-01 | Mark the field | Point inside the pilot area; map, GPS, coordinates or Google Maps link; demo field preselected |
| FR-02 | Harvest timing | Exact date or early/mid/late February; never pre-filled from the satellite |
| FR-03 | NASA data per cell | Climate, rain, soil moisture, NDVI and projections for the field's 0.1° cell, precomputed in PostGIS |
| FR-04 | Field X-Ray | Eight indicators; NDVI history classified per off-season; farmer confirmation of the last three seasons |
| FR-05 | Engine per option | Success in each of 20 seasons, future-climate result, soil score and income score for six options (section 7) |
| FR-06 | Priority | Safety, Income or Soil reorders the ranking |
| FR-07 | Explanation | Every result has a rule-based sentence that cites the data and the number; no generative AI |
| FR-08 | Compare | Up to three crops side by side; options past the ZARC deadline shown and marked, never recommended |
| FR-09 | 3-year plan | Suggestion per year with its reason; editing recalculates the following years; suggestion always visible |
| FR-10 | Autumn signal | NOAA ENSO outlook gives Plan A (normal autumn) and Plan B (dry autumn) |
| FR-11 | Your plan and report | Timeline from the harvest date; printable report with pros and cons per crop |
| FR-12 | Alerts | Current dry soil, dry days and heat; frost, heavy rain and nearby fire risk; area changes and extremes |
| FR-13 | Guide | 27 articles, search, filters, "Learn more" links from every screen open in a new tab |
| FR-14 | Language and audio | Full Portuguese and English; "Listen to summary" on every screen |
| FR-15 | Missing data | Never blocks; says what is missing and offers to fill it; a block without data is hidden, never estimated |

## 5. Off-season options and crop parameters

All numbers live in `culturas.yaml` with a source next to each value; values marked as hypotheses need agronomist review.

| Option | Role | Sowing deadline | Days to flowering / cycle | Peak Kc (FAO-56) | Straw | Nitrogen left | Nematodes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fallow | None | — | — | — | Very low | 0 | Does not break the cycle; soil exposed |
| Second-crop corn | Grain | ZARC (about Feb 28 in the pilot area) | ~60 / ~120 | 1.20 | Medium (about 2.7 t/ha in a Goiás study) | 0 | Host |
| Grain sorghum | Grain | Up to about 20 days after corn's deadline | ~65 / ~115 | 1.05 | Medium | 0 | Reduces reniform nematode |
| Corn with brachiaria | Grain + cover | Same as corn | Same as corn | 1.20 | High, covers the dry season | 0 | Reduces reniform; multiplies some others |
| Pearl millet | Cover | Into March (hypothesis) | ~50 / ~90 | 1.00 | High | 0 | Helps control Pratylenchus |
| Crotalaria spectabilis | Legume cover | February (hypothesis) | ~60 / ~100 | 1.00 | 3 to 6 t/ha of dry matter | 60 to 100 kg/ha | Highly resistant; breaks the cycle |

Sources: [Revista Cultivar / Embrapa on nematodes](https://revistacultivar.com.br/noticias/rotacao-de-culturas-e-uma-das-indicacoes-para-controle-de-nematoides-fitoparasitos), [Agrolink / Embrapa](https://www.agrolink.com.br/noticias/rotacao-de-culturas-controla-nematoides-fitoparasitos_453196.html), [sorghum sowing window](https://www.noticiasagricolas.com.br/noticia/292308), [crotalaria](https://aegro.com.br/tags/crotalaria-spectabilis/), [corn straw](https://revistas.ufg.br/pat/article/download/75032/39853/368616).

**Soil water.** SoilGrids texture sets the available water: 60 mm clayey (clay above 35%), 50 mm medium, 40 mm sandy (sand above 70%). The farmer can override it.

## 6. NASA and other data

| Source | Use in the product | Resolution and period |
| --- | --- | --- |
| **GPM IMERG Final**, daily (GPM_3IMERGDF v07) | Main rainfall: water balance, rain left after harvest, end of the rains (first 20-day window after March 1 with less than 10 mm), dry spells, heavy rain (50 mm/day or more in Feb–Mar), comparison with neighboring cells | 0.1°; 2005–2024 |
| **NASA POWER**, daily agroclimatology | FAO-56 Penman–Monteith ETo inputs, heat at flowering (35 °C or more), frost risk (3 °C or less in May–July), fallback rainfall, last-30-day alerts | ~0.5°; 2005–2024 and recent days |
| **SMAP L4** (SPL4SMGP v008, root-zone wetness) | Initial soil water on each simulated sowing day; current moisture percentile; dry-soil alert (20th percentile or lower) | 9 km; 2016–2025 |
| **MODIS NDVI** (MOD13Q1 and MYD13Q1 v061) | 10-season field history: soybean detection (peak of 0.70 or more), off-season planted (above 0.60), fallow (below 0.45) or uncertain | 250 m, 16-day; 2017–2026 |
| **MODIS Land Cover** (MCD12Q1) | Cropland mask (IGBP class 12) to see how nearby fields within 30 km were managed | 500 m |
| **MODIS Burned Area** (MCD64A1) | Fire history within 5 km of the field | 500 m; 2016–2025 |
| **NEX-GDDP-CMIP6** (pr, tasmax, tasmin; SSP2-4.5; ACCESS-CM2, MPI-ESM1-2-HR, MRI-ESM2-0) | Monthly deltas 2041–2060 vs 1995–2014 applied to the observed series; every option re-simulated | 0.25° |
| SoilGrids (ISRIC, CC BY 4.0) | Clay and sand, 0–30 cm | 250 m |
| NOAA CPC | Oceanic Niño Index per season and the ENSO probability outlook (issued November 12, 2026) | — |
| ZARC (MAPA) and Embrapa | Sowing deadlines, cycles, flowering, Kc, ISNA thresholds | — |
| OpenStreetMap, Photon (komoot) | Base map; nearest place name | — |

GEOS-S2S and IMERG Late Run were evaluated and left out because of format and coverage constraints; their scripts remain in the repository.

## 7. The engine

One deterministic backend engine computes every number, so the same result appears on every screen. Every threshold lives in `regras.yaml` with its reference; the API rejects values without one.

1. **Climate series.** Daily January–July data for the field's 0.1° cell, 2005–2024. Rain from IMERG Final (POWER as fallback). ETo by FAO-56 Penman–Monteith from POWER, or Hargreaves–Samani when inputs are missing.
2. **Sowing date.** Derived from the harvest date. An option past its ZARC deadline is shown as out of window and never recommended.
3. **Daily water balance (FAO-56 "bucket").** Starts from SMAP root-zone wetness on that year's sowing day (from 2016; 50% of capacity before that).
4. **Success.** A season succeeds when ISNA stays at or above **0.55** in the ±15 days around flowering (cover crops: **0.50** in the first 30 days) and there are **fewer than 3 days at or above 35 °C**. Result: "worked in X of 20 years".
5. **Future climate.** CMIP6 monthly deltas from three models applied to the observed series; every option simulated again; the range across models is shown.
6. **Scores (0–100).** Climate safety 30%, future climate 15%, soil health 25% (straw, nitrogen, nematode-cycle break), income 30% (grain production and climate reliability, with no price assumptions). The farmer's priority reorders the ranking.
7. **Rotation rules.** Functional-diversity bonus, at most two fallow years in a row, nematode-suppressing crops (crotalaria, pearl millet) where needed. The next year's suggestion depends on the two previous years.
8. **Autumn signal.** The NOAA ENSO outlook and how each crop did in past El Niño years set Plan A and Plan B.

## 8. Architecture and non-functional requirements

| Layer | Choice |
| --- | --- |
| Data pipeline | Python scripts that ingest NASA, ISRIC and NOAA data and precompute results per grid cell |
| Database | PostgreSQL 17 with PostGIS 3.5; SQLAlchemy and Alembic |
| API | Python 3.12, FastAPI |
| Front end | React 19, TypeScript, Vite, React Router, Leaflet |
| Quality | Test-driven development: more than 1,500 Pytest tests and more than 1,400 Vitest + Testing Library tests (components and full screens); every screen reviewed in headless Chrome in pt and en, at 360 px and on desktop; Ruff and Oxlint; gitleaks and pre-commit; shared rules for contributors and AI agents in `AGENTS.md` |
| Delivery | Docker; GitHub Actions on every pull request (lint, tests, build, Docker images); automatic deploy to Railway after each merge; smoke test that checks the version stamp of the live site and API |
| Hosting | Railway: PostGIS database, FastAPI backend, frontend behind Caddy; on 24/7 during judging |

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-01 | Response time | Demo field instant; a new field within seconds |
| NFR-02 | Mobile first | Works at 360 px wide with no horizontal scroll |
| NFR-03 | Language | Full Portuguese and English |
| NFR-04 | Accessibility | Plain language; "Listen to summary"; focus never jumps when choosing an option |
| NFR-05 | Traceability | Every number shows source and period; thresholds stored with references |
| NFR-06 | Honesty | No generative AI in decisions; missing data is hidden, never estimated; "Helps you decide. It does not replace your agronomist." |
| NFR-07 | Privacy | No accounts; future community data stored only at grid-cell level |
| NFR-08 | Attribution | Every source, code library and image credited; no NASA logos, flags or mission identifiers; AI-generated images watermarked |
| NFR-09 | Secrets | Earthdata and other credentials outside the repository |

## 9. Content and design rules

- **No step counters** ("Question 1 of 2"); a real "← Back" button on every step.
- **Seasons are named by their two years** (2025/26), never by one.
- **The satellite chart shows only satellite data**, with no labels or assumptions inside the bars.
- **Missing answers never block.** Say what was not filled in and offer "Fill in now".
- **"Learn more" always opens the Guide in a new tab**, with an icon and "(opens in a new tab)" for screen readers.
- **Details go in modals**, not on the screen: standard modals up to 560 px (bottom sheet on mobile); large modals nearly full screen.
- **Typography and color:** Space Grotesk headings, Inter text; green #1f6b47, blue #2c5a7d, orange #b6531a.
- **Slogan:** "Olhos no céu, raízes no chão." / "Eyes on the sky, roots in the ground."

## 10. Submission

- Everything in English.
- **Demo:** a 29-second video (the rule allows up to 30 s), public and unlisted on YouTube, with a synthetic English narration and a discreet "AI-generated video" label on screen.
- **Project:** the live app, public, no login.
- **Project Details:** challenge, problem, solution, product screenshots, how it works, NASA data table, Field Shift coverage table, design decisions, impact, validation, roadmap, technology and quality, use of AI, team. Illustrations made with AI carry an "AI-generated image" label.
- **Data:** every NASA dataset linked; every partner and other source listed (SoilGrids, NOAA, ZARC, Embrapa, FAO-56, USDA, Conab, OpenStreetMap, Leaflet, Photon, Wikimedia, Lucide, Piper).
- **Use of AI declared:** Claude, Gemini and Lovable in research, code and texts; the AI-generated video, its synthetic narration (Piper TTS) and its soundtrack composed with code; the AI-generated images. No AI in the product's decisions.
- **Repository:** README with the research journey, architecture, tests and use of AI; this PRD, the discovery, the business plan and the roadmap in `docs/product/`; the submission texts in `docs/submission/`; screenshots and illustrations in `docs/images/`.
- Deadline: November 15, 2026, 11:59 PM local time.

## 11. Tests, risks and limits

**Acceptance.** A judge opens the link, taps the demo field and reaches a recommendation in under a minute; every result shows its source; the plan appears next to the field's current management; at 360 px nothing scrolls sideways.

**Key unit tests.** Water balance (constant rain gives ISNA 1; no rain empties the bucket on schedule); success rule (ISNA 0.50 fails; ISNA 0.70 with 3 days at 36 °C fails); ZARC window (harvest on March 5 makes corn out of window); rotation rules (no more than two fallow years; nematode-suppressing crop present when needed); plan suggestion visible after a change and tag restored when the suggestion is picked again.

| Risk or limit | Mitigation |
| --- | --- |
| Satellites observe; they do not forecast | Say so on screen; the autumn signal is a probability with its source |
| SMAP (9 km) and IMERG (~10 km) describe the region, not the field | Stated in "How the math works"; NDVI (250 m) is the only field-level layer |
| Clouds affect optical NDVI | "Uncertain" class; the farmer confirms each season |
| Crop texts not yet reviewed | Marked "under review" until an agronomist signs off |
| Pilot area only | Expansion is configuration plus pipeline runs (roadmap, Bet 1) |

## Sources

- [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide), [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)
- [Embrapa: no-till and rotation in the Cerrado (2022)](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1149543/1/rsd-2022.pdf)
- [Embrapa: MODIS to separate cropping systems (2021)](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1135867/1/Big-Earth-Observation-Data-e-aprendizado-de-maquina-2021.pdf)
- [ZARC soybean, Minas Gerais 2026/27](https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/safra-vigente/minas-gerais/PORTN200SOJAMG.pdf)
- [NASA POWER](https://power.larc.nasa.gov/), [GPM IMERG](https://gpm.nasa.gov/data/imerg), [SMAP L4](https://nsidc.org/data/spl4smgp), [NEX-GDDP-CMIP6](https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6)
- Allen et al. (1998), FAO Irrigation and Drainage Paper 56; Hargreaves and Samani (1985)
