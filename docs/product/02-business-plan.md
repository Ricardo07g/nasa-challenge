# Raiz Orbital: Product Planning, Business Case and Business Plan

**Updated:** November 15, 2026 · Product owner: Rayanne
**Related documents:** [product discovery](01-product-discovery.md), [PRD](03-prd.md), [product roadmap](04-product-roadmap.md)

## Summary

Raiz Orbital answers one question for one field: **what to plant after the soybeans, and which 3-year rotation to follow.** It compares six off-season options over 20 seasons of NASA data and the 2041–2060 climate, recommends one for the farmer's priority (safety, income or soil care) and turns it into a plan the farmer can take to the agronomist.

- **Why now:** the 2026/27 season starts under a strong El Niño, rains are ending earlier, and only 3.3% of Brazil's planted area was insured in 2025.
- **Who uses and who pays:** farmers use it for free; resellers, cooperatives and agronomists pay per hectare of the clients they serve; insurers and banks pay for field-level risk reports.
- **What the farmer gains:** covered soil instead of fallow, a stronger next soybean crop, fewer avoidable losses, and a Plan B for a dry autumn.
- **The business:** small if sold only per hectare in one region; it grows with expansion to the Cerrado and with risk reports for insurers and banks (roadmap, Bet 1).
- **Next step:** an off-season pilot with 15 to 20 farmers in Uberlândia and Uberaba in February–March 2027, with the plan and reminders on WhatsApp.

All projections are team hypotheses and must be revised after the pilot.

## Glossary

| Term | Meaning |
| --- | --- |
| Rainfed | A crop that depends only on rain, with no irrigation. Most soybeans and corn in the Triângulo. |
| Main season / second crop | Summer soybeans, then whatever is planted right after the harvest (second-crop corn, sorghum, cover crops). |
| Sowing window | The period in which planting gives the best chance of a good harvest. |
| Dry spell (veranico) | A run of days without rain in the middle of the rainy season, usually with heat. |
| Flowering and grain filling | The stages when the plant forms and fills grain, and needs the most water. |
| Fallow | Leaving the field without a crop until the next soybeans. |
| ZARC | Brazil's Agricultural Climate Risk Zoning: by municipality and soil, which sowing dates carry less risk. Required for crop insurance and rural credit. |
| ISNA | Water Satisfaction Index: water the crop used divided by what it needed (0 to 1). |
| NDVI | Satellite index of how green and alive the vegetation is. |
| B2B2C | Selling to businesses (resellers, cooperatives) that bring the product to the end user (the farmer). |
| TAM, SAM, SOM | Total market, the part this product and region can serve, and the part that can be won in a few years. |
| Break-even | When revenue covers costs. |
| Grant (subvenção) | Non-refundable public funding for innovation, such as Centelha and Compete Minas (Fapemig). |

## The problem in numbers

| Indicator | Value | Source |
| --- | --- | --- |
| Soybean area in Brazil, 2025/26 | About 49 million hectares | [Conab via bpmoney](https://bpmoney.com.br/?p=378562) |
| Soybean area in Minas Gerais, 2026/27 | 2.52 million hectares | [Safras & Mercado](https://safras.com.br/?p=88965) |
| Crop insurance, 2025 | 3.3% of Brazil's planted area | [Brasil 61 / MAPA](https://brasil61.com/n/seguro-rural-parlamentares-de-mg-e-do-pr-cobram-fortalecimento-da-politica-para-dar-previsibilidade-ao-agro-cacb260201) |
| Rural default, Q1 2026 | 8.8% | [Compre Rural / Serasa](https://comprerural.com/antes-de-vender-a-fazenda-para-pagar-dividas-produtor-precisa-conhecer-seus-direitos/) |
| Second-crop corn under drought at flowering | 2 days of water stress cut yield by more than 20%; 4 to 8 days, by more than 50% | [Embrapa Milho e Sorgo](https://www.alice.cnptia.embrapa.br/bitstream/doc/927283/1/Fisiologiaproducao1.pdf) |
| End of the rains | In Ituiutaba, the dry season began in April in 63.4% of years | [Revista Brasileira de Climatologia](https://ojs.ufgd.edu.br/rbclima/article/download/14572/7715/46644) |
| Soil benefit | Soybeans after grain intercropped with brachiaria yielded 11% more than after fallow in a Cerrado study | [Revista Cultivar](https://revistacultivar.com.br/noticias/consorcio-de-graos-com-forrageiras-controla-plantas-daninhas-na-soja) |
| Demo field near Uberlândia | Longest autumn dry spell: 20.8 days (2005–2019) → 27.2 days (2020–2024) | GPM IMERG (NASA), computed by Raiz Orbital |

## Product planning

**Vision:** no farmer in the Cerrado loses a season, or their soil, to a decision that could have been made with information.

**North Star:** hectares that leave fallow or monoculture and stay covered in the following off-season, checked by NDVI. It measures real change on the ground, not just use.

**Supporting metrics:** farmers who reach a recommendation; plans printed or shared with an agronomist; share who say they understand "why".

### Roadmap and gates

| Phase | What | Gate to move on |
| --- | --- | --- |
| 1. Prototype (Nov 2026, done) | Web product for the Uberlândia–Uberaba pilot area, built in 48 hours and live 24/7 | A judge reaches a recommendation in under a minute |
| 2. Back-test (Dec 2026) | Engine's high-risk years vs IBGE municipal corn losses | High-risk years match loss years |
| 3. Off-season pilot (Feb–Mar 2027) | 15 to 20 farmers; plan and reminders on WhatsApp | 1 in 3 tests a soil-building option on part of the land |
| 4. Adoption check (Jul–Aug 2027) | NDVI of participants' fields | Fallow area drops |
| 5. First paying partner (2027/28) | A reseller or cooperative offers it to its clients | Signed contract |

The full product roadmap, with the four big bets (from one region to every farm on Earth; from harvest to harvest, nothing wasted; farmers helping farmers; fully integrated with WhatsApp), is in [04-product-roadmap.md](04-product-roadmap.md).

### OKRs for the next 6 months (Nov 2026 to Apr 2027)

| Objective | Key results |
| --- | --- |
| **O1. Prove the recommendation changes real decisions** | 20 farmers in the pilot by Feb 1, 2027 · 1 in 3 tests a soil-building option · 7 in 10 say they understand "why" |
| **O2. Prove the engine is right** | Back-test against IBGE second-crop corn losses published · crop parameters reviewed by an agronomist |
| **O3. Validate who pays** | Conversations with 3 resellers or cooperatives · 1 paid or co-funded pilot by June 2027 · a proposal submitted to a Fapemig call |

### Opportunity tree

Desired outcome: **more covered soil and fewer climate losses after the soybean harvest.**

- **"I don't know what to plant after the soybeans"** → recommendation and comparison per field → test: off-season pilot.
- **"I don't know if there's still time for the second crop"** → harvest date drives everything; ZARC deadline; options out of window never recommended → test: pilot.
- **"What if the autumn is dry?"** → Plan A / Plan B from the autumn signal → test: back-test with past El Niño years.
- **"It rained at my neighbor's and not here"** → "It rained here" community rain gauges → test: weekly reports in the pilot.
- **"I won't open a website in the field"** → plan and reminders on WhatsApp → test: reach in the WhatsApp beta.

### RICE prioritization (next features)

Score = Reach × Impact × Confidence ÷ Effort. Reach in pilot farmers per quarter; Impact from 0.25 to 3; Effort in person-weeks. Team estimates.

| Feature | Reach | Impact | Confidence | Effort | Score | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Plan and reminders on WhatsApp | 20 | 3 | 70% | 2 | **21** | Month 1 |
| Whole Triângulo on the map | 20 | 2 | 80% | 1 | **32** | Month 1 |
| "It rained here" | 20 | 1 | 60% | 1 | **12** | Month 1 |
| "What I planted and how it went" | 20 | 2 | 60% | 1 | **24** | Months 2–3 |
| Daily alerts at flowering | 20 | 2 | 60% | 3 | **8** | Months 2–3 |
| New crops and options | 15 | 2 | 50% | 3 | **5** | Months 4–12 |
| Agronomist dashboard | 5 | 2 | 60% | 3 | **2** | Year 2 |

## Lean Canvas (hypotheses before the pilot)

| Block | Content |
| --- | --- |
| Problem | No field-level information to choose the off-season crop; rains ending earlier; soil degrading under soybean–corn and fallow; almost no insurance |
| Customer segments | Users: rainfed grain farmers. Payers: input resellers, cooperatives, agronomists; later insurers and banks |
| Unique value proposition | "What to plant after the soybeans, on your field, backed by 20 years of NASA data, in one minute" |
| Solution | Field X-Ray, recommendation and comparison, 3-year plan with Plan B, planning report, alerts |
| Channels | Rural unions, Emater, cooperatives and resellers; WhatsApp; the agronomist |
| Revenue streams | Per-hectare license for partners; risk reports for insurers and banks |
| Cost structure | Small team, cloud, field work; NASA data is free |
| Key metrics | Hectares leaving fallow (NDVI), recommendations reached, partners paying |
| Unfair advantage | Field-level history from NASA, a local community of rain gauges and reports, and agronomist trust |

## Business case

**The question:** is it worth investing in the pilot this off-season?
**The answer:** yes. The cost is low, the benefit for the farmer is many times the price, and the gates let us stop early if the hypothesis fails.

### Alternatives

| Option | Cost to the farmer | What it solves | What it does not |
| --- | --- | --- | --- |
| Do nothing (experience, neighbors, forecast apps) | Zero | Nothing new | Still decides without field history or 20-year risk per crop |
| Generic weather apps | Free or low | The next days' forecast | Does not say which crop fits the field or the sowing window |
| Paid satellite platforms (e.g., Agronow, from R$ 1/ha/year) | About R$ 1 to 2/ha/year | Crop health (NDVI) and yield estimates | Do not answer "what do I plant after the soybeans?" |
| AgroClimatic Monitor (Inpe, Cemaden, Leeds) | Free | Drought overview for managers | Not a field-level decision on the farmer's phone |
| **Raiz Orbital** | **Free (the partner pays)** | **The off-season choice and a 3-year plan per field, with NASA data and the soil effect** | Yield estimates and daily monitoring come later |

### Benefit for the farmer

At a hypothetical R$ 1.50 per hectare per year paid by the partner, the service pays for itself if it avoids losing **less than 1 kg of soybeans per hectare** (soybean price in Uberlândia, November 2026: R$ 144.17 per 60-kg bag, [Agrolink / Grainsights](https://www.agrolink.com.br/noticias/soja-chega-a-r--161-60-por-saca-no-porto-de-santos_519756.html)). One failed second crop avoided, or one season of covered soil that lifts the next soybean yield by a few percent, is worth far more.

### Pilot investment (12 months, estimate)

| Item | Estimate |
| --- | --- |
| Team of 3, part-time (grants or partial dedication) | R$ 90,000 |
| Cloud, domain, WhatsApp messages and services | R$ 8,000 |
| Field trips, meetings with unions and Emater | R$ 12,000 |
| Rain gauges for farmers without one, and reserve | R$ 10,000 |
| **Total** | **R$ 120,000** |

### Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| A wrong recommendation erodes trust | Medium | Back-test before the pilot; every source shown; agronomist review of all texts |
| The decision is already locked (seed bought) | Medium | Reach farmers in December and January, before buying seed |
| Nobody pays | Medium | Validate with resellers and cooperatives before scaling; grants and insurer reports as plan B |
| Liability for the farmer's decision | Low | "Helps you decide. It does not replace your agronomist." on every screen |
| Changes in NASA data (MODIS retirement) | Low | Move to HLS and VIIRS; history stays available |
| Copied by a larger company | High, long term | Local community, agronomist partnerships and field history are hard to copy |

**Recommendation:** run the pilot with up to R$ 120,000 over 12 months and decide at each gate. If in March 2027 fewer than 1 in 5 farmers test another option, or the back-test does not hold, stop or change direction.

## How the engine identifies what matters

The research (dissertations, theses, Embrapa and ZARC ordinances) points to a clear order of impact on rainfed soybeans and corn in the Cerrado.

| # | Event | Why it matters | Source |
| --- | --- | --- | --- |
| 1 | Water shortage at second-crop corn flowering | 2 days of stress cut yield by more than 20%; 4 to 8 days, by more than 50% | [Embrapa Milho e Sorgo](https://www.alice.cnptia.embrapa.br/bitstream/doc/927283/1/Fisiologiaproducao1.pdf) |
| 2 | Water shortage at soybean flowering and grain filling | Losses of 30% to 40% in an Embrapa Cerrados experiment | [Revista Cultivar / Embrapa Cerrados](https://revistacultivar.com.br/artigos/impacto-do-deficit-hidrico-em-diferentes-fases-do-desenvolvimento-da-soja) |
| 3 | Extreme heat at flowering | Above 35 °C, flowers and pods abort | [Revista Cultivar](https://revistacultivar.com.br/noticias/estresse-climatico-provoca-aborto-floral-em-lavouras) |
| 4 | Early end of the rains | Late-sown corn reaches flowering in the dry season | [Revista Brasileira de Climatologia](https://ojs.ufgd.edu.br/rbclima/article/download/14572/7715/46644) |
| 5 | Heavy rain on bare soil | Erosion and losses at harvest | [Canal Rural](https://www.canalrural.com.br/agricultura/excesso-chuva-provoca-perda-nas-lavouras-soja-triangulo-mineiro-16112/) |
| 6 | Fire in the dry season | 45,000 ha of sugarcane burned in the Triângulo in 2024 | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/prejuizos-incendios-cana-superam-180-milhoes-reais/) |

### Rules used today

| What | Rule | Data |
| --- | --- | --- |
| A season "worked" | ISNA at or above 0.55 in the ±15 days around flowering (cover crops: 0.50 in the first 30 days) and fewer than 3 days at or above 35 °C | IMERG, POWER, SMAP, SoilGrids |
| End of the rains | First 20-day window after March 1 with less than 10 mm | IMERG |
| Heavy rain risk | 50 mm/day or more in February–March | IMERG |
| Frost risk | 3 °C or less in May–July | POWER |
| Dry soil now | Root-zone moisture at or below the 20th percentile | SMAP L4 |
| Fire nearby | Burned area within 5 km since 2016 | MODIS MCD64A1 |

Definitions of a "dry day" vary from study to study (less than 1, 3 or 5 mm), which changes how many dry spells are counted ([Revista Ceres](https://ojs.ceres.ufv.br/ceres/article/download/3139/1034/4717)). That is why the engine judges water at flowering through ISNA, the ZARC criterion, rather than counting dry days alone. Every threshold is stored with its reference and no rule enters the product without a back-test.

## Business plan

### Market

| Level | Hectares | Note |
| --- | --- | --- |
| TAM: soybeans in Brazil | About 49 million (2025/26) | Every one faces the off-season decision |
| SAM: soybeans in Minas Gerais | 2.52 million (2026/27) | Where the product works first |
| SOM: Triângulo and Alto Paranaíba, year 3 target | 200,000 paid hectares | Team estimate, to be updated with IBGE data |

### Revenue model

| Source | Who pays | Price (hypothesis) | Why they would pay |
| --- | --- | --- | --- |
| Per-hectare license | Reseller, cooperative or trader offering it to clients | R$ 1.50 per hectare per year | Loyalty and a reason to talk to each client; the plan points to sorghum, brachiaria and cover-crop seed they sell |
| Field risk reports | Insurers and rural credit banks | Annual regional package (about R$ 60,000 in year 3) | 20-year risk and field history help price policies and handle claims |
| Farmer | Does not pay | R$ 0 | Adoption depends on no barrier |

**Price reference:** Agronow charges R$ 1 per hectare per year for satellite monitoring ([Revista Cultivar](https://revistacultivar.com.br/index.php/noticias/agronow-lanca-plano-anual-a-partir-de-r-1-por-hectare)).

### Go-to-market

1. **2027 off-season, pilot:** 15 to 20 farmers through the Uberlândia rural union, Emater and one reseller, with the plan on WhatsApp.
2. **2027/28, first paying partner:** a reseller or cooperative offers Raiz Orbital to its client base.
3. **2028/29, scale:** 3 to 5 partners, the whole Cerrado on the map and the first insurer contract.

### Competition and differentiation

| Alternative | What it does | Our difference |
| --- | --- | --- |
| Weather forecasts (apps, TV) | Says whether it will rain | Does not say which crop fits the field, the soil or the window |
| Satellite monitoring platforms | Show crop vigor after the fact | Raiz Orbital decides before planting, with 20 years of history and the future climate |
| The reseller's agronomist | Trusted advice | Raiz Orbital is the agronomist's tool, not a replacement |

### 3-year projection (hypothesis)

|  | Year 1 | Year 2 | Year 3 |
| --- | --- | --- | --- |
| Paid hectares | 0 (pilot) | 60,000 | 200,000 |
| Revenue | R$ 0 | R$ 120,000 | R$ 360,000 |
| Cost (team, cloud, field) | R$ 120,000 | R$ 300,000 | R$ 480,000 |
| Result | −R$ 120,000 | −R$ 180,000 | −R$ 120,000 |

**Break-even:** with year-3 costs and R$ 60,000 in reports, about 280,000 paid hectares, close to 20% of the region's estimated soybeans. Honest reading: priced only per hectare, the regional market is small; growth comes from expanding to the Cerrado and from risk reports for insurers and banks.

### Funding

| Source | What it is | Status |
| --- | --- | --- |
| Centelha 3 MG (Fapemig) | Support for innovative ventures at the idea stage | Call 010/2026 published ([Fapemig](https://api.site.fapemig.br/wp-content/uploads/Chamada-e-termo-de-outorga.pdf)) |
| Compete Minas (Fapemig, Sede-MG, Sebrae) | R$ 50 million in innovation grants for companies and startups in Minas Gerais | 2026 round closed July 30; watch the next one ([Agência Minas](https://www.agenciaminas.mg.gov.br/noticia/novo-edital-do-compete-minas-oferece-r-50-milhoes-para-impulsionar-a-inovacao-tecnologica-no-setor-produtivo-130257)) |
| Minas pelo Clima (Fapemig) | R$ 50 million for climate research and innovation | Call launched in March 2026 ([Agência Minas](https://agenciaminas.mg.gov.br/noticia/governo-de-minas-destina-r-50-milhoes-para-iniciativas-inovadoras-sobre-mudancas-climaticas-no-estado)) |

Confirm deadlines and amounts in each call before applying.

### Team

Team Raiz Orbital, Uberlândia: Adriano Araújo, Rayanne Lemos (product owner) and Ricardo Pereira. The roles the venture needs:

- **Product and business:** discovery, partners, pitch.
- **Data and climate:** NASA pipeline, engine rules and back-test.
- **Development:** web product, WhatsApp channel and partner dashboard.
- **Agronomy (partner or mentor):** validates thresholds and speaks the farmer's language.

### Milestones

| When | Milestone | Success criterion |
| --- | --- | --- |
| Nov 2026 (done) | Prototype at NASA Space Apps, built in 48 hours | Recommendation in under a minute for the pilot area, live and covered by automated tests |
| Dec 2026 | Back-test | High-risk years match IBGE loss years |
| Mar 2027 | Off-season pilot | 1 in 3 farmers test a soil-building option |
| Aug 2027 | Adoption check | Fallow area drops among participants (NDVI) |
| Jun 2028 | First paying partner | Contract signed with a reseller or cooperative |

## Sources

All links are in the tables above. The full list of audience, pain and press sources is in the [product discovery](01-product-discovery.md).
