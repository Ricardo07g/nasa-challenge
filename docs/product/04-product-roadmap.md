# Raiz Orbital: Product Roadmap

> **Eyes on the sky, roots in the ground.**
> We built this in 48 hours. Imagine one month.

**Updated:** November 15, 2026, at the end of NASA Space Apps Challenge Uberlândia · Product owner: Rayanne
**Aligned with:** the submission (demo video, Project Details), the [README](../../README.md), the [product discovery](01-product-discovery.md) and the [business plan](02-business-plan.md).
**How this document relates to the others:** the [PRD](03-prd.md) describes what exists today. This roadmap describes where we take it next. When an item starts, it moves into the PRD as a requirement (`FR-`) in the same pull request.

---

## 1. The idea in one paragraph

Every autumn, on almost 49 million hectares of soybeans in Brazil, a farmer asks the same question: **what do I plant now?** The answer decides whether the soil stays covered or erodes, whether the next soybean crop starts stronger or weaker, and whether the farm makes money or takes on more debt. NASA satellites have watched every one of those fields for 20 years. Raiz Orbital brings that knowledge down to **one field, one farmer, one decision**, in plain language and in one minute.

## 2. What we built in 48 hours

| Already working | What it means for the farmer |
| --- | --- |
| Mark the field on a map, with GPS or with the demo field | No sign-up, no form, no address needed |
| Harvest date with help to decide | Every day of delay is rain the next crop loses |
| Field X-Ray: soil, moisture now, rain, dry spells and the last seasons seen from space | "This is your field, as the satellites saw it" |
| Compare up to 3 crops: "worked in X of 20 years", ZARC deadline, El Niño years, 2041–2060 climate | A decision backed by 20 years of NASA data on that exact spot |
| 3-year rotation plan with Plan A and Plan B for a dry autumn | A plan, not just a guess for one season |
| "Your plan": timeline, area alerts and a printable planning report | Something to take to the agronomist |
| Alerts page, a 27-article Guide, "How the math works" | Every number explained, every source shown |
| Portuguese and English, "Listen to summary" on every screen | Built for the farmer who prefers to listen |
| Live 24/7 on Railway, deployed automatically after every merge | A judge, or a farmer, opens it any time with one tap |
| More than 2,900 automated tests, screen reviews in pt and en on phone and desktop, CI/CD with a live smoke test | The same answer on every screen, every time |

## 3. The impact we are chasing

| Where | Why it matters | What Raiz Orbital changes |
| --- | --- | --- |
| **Soil** | Fallow leaves the ground bare in the heavy February and March rains; the soybean–corn sequence feeds root nematodes | Favors options that keep the soil covered, add straw and nitrogen, and break pest cycles. In one Cerrado study, soybeans after grain intercropped with brachiaria yielded 3,196 kg/ha, 11% more than after fallow ([Revista Cultivar](https://revistacultivar.com.br/noticias/consorcio-de-graos-com-forrageiras-controla-plantas-daninhas-na-soja)) |
| **Water and climate** | The rains are ending earlier. On our demo field the longest autumn dry spell grew from 20.8 days (2005–2019) to 27.2 days (2020–2024) | Shows how each crop handles the climate of today and of 2041–2060, so adaptation starts with the next planting |
| **Income and risk** | Only 3.3% of Brazil's planted area was insured in 2025, and rural default reached 8.8% in early 2026 | Avoidable losses are avoided before they happen, not paid for after |
| **People** | 96% of farmers use WhatsApp for business decisions; 65% change practices because of a technical recommendation | Meets farmers where they are and works with the agronomist, never against them |

**The north star:** hectares that leave fallow or monoculture and stay covered, **checked from space** by NDVI in the following season.

---

## 4. Four big bets

### Bet 1. A bigger map: from one region to every farm on Earth 🌎

**Today:** a pilot area of 226 grid cells around Uberlândia and Uberaba.
**Tomorrow:** every soybean field in Brazil, and then any farm on Earth.

NASA data is global and free. What changes from region to region is the agronomy: sowing deadlines, crop cycles and soil. That is why expansion is mostly configuration, not new code.

| Step | Area | What it takes |
| --- | --- | --- |
| 1 | The whole Triângulo Mineiro and Alto Paranaíba | Run the data pipeline for every 0.1° cell in the region |
| 2 | The Cerrado: Minas Gerais, Goiás, Mato Grosso, Bahia, Tocantins | ZARC deadlines per state and municipality; crop parameters reviewed by regional agronomists |
| 3 | Every soybean region in Brazil, including the South | New off-season options (wheat, oats, cover mixes) and frost rules |
| 4 | Other countries | Replace ZARC with each country's planting calendar; same NASA engine |

Along the way, MODIS gives way to **HLS (30 m)** and **VIIRS**, which see individual fields better and keep running after MODIS retires in 2027.

### Bet 2. From harvest to harvest, nothing wasted: every crop, every season 🌱

**Today:** one question, "what do I plant after soybeans?".
**Tomorrow:** the whole farm year, whatever the farmer grows.

- **More starting crops.** After summer corn, after cotton, sugarcane renewal, beans.
- **More options to plant.** Beans, sunflower, forage radish and cover-crop mixes join the current six, each with parameters validated by an agronomist.
- **The full year in one calendar.**

| Months | What Raiz Orbital does |
| --- | --- |
| Sep–Nov | "Can I plant the soybeans yet?" signal from the start of the rainy season |
| Dec–Jan | Dry-spell and heat alerts at soybean flowering |
| Feb–Mar | The after-harvest decision (today's product) and "is the soil dry on sowing day?" |
| Apr–May | Dry-spell and heat alerts at corn and sorghum flowering |
| Jun–Sep | Frost and fire alerts near the field |
| Jul–Aug | "The satellite checked": NDVI shows whether the plan was planted |

A product used once a year becomes a companion for the whole crop cycle: more yield from the same land, less soil, water and money wasted between harvests.

### Bet 3. Community: farmers helping farmers 🤝

**Today:** a "coming soon" card.
**Tomorrow:** a regional network where **one farmer helps the next**.

Rain is local. On the same day, Uberlândia can get 20% more rain than average while Uberaba, less than 100 km away, gets 30% less. Satellites see the region; neighbors see the field. Together they see everything.

| Feature | What it does | Why it matters |
| --- | --- | --- |
| **It rained here** | A farmer with a rain gauge records today's rain in two taps | Corrects satellite rainfall with ground truth and improves everyone's results |
| **What I planted and how it went** | After the off-season, two taps: which crop, and was it worth it | "12 neighbors planted sorghum; 9 were happy". The trust no algorithm can buy |
| **It happened here** | Hail, fire, flash flood, corn leafhopper, a bad road | Fire and pests spread from farm to farm; an early warning from a neighbor is worth gold |
| **Lend a hand** | Ask for and offer help: a planter for a day, leftover cover-crop seed, a crew for a firebreak, a shared truck to the co-op | Small farms gain the strength of a large one, and nobody faces a bad year alone |
| **Plant together** | Neighbors who choose the same crop coordinate sowing dates, machines and logistics | Shared work and a synchronized sowing that helps break pest cycles |
| **Buy together** | Group purchases of seed, inputs and freight | Small farms get the price of a large one |
| **Ask the agronomist** | Local agronomists and cooperatives answer questions in the community | Reaches the 80% of farms that never get technical assistance |
| **The week in your region** | A short weekly digest: rain, what neighbors planted, alerts | A reason to come back every week, not once a year |

**Privacy by design.** Only the 10 km area is stored, never the exact spot. Names appear only with permission. Reports are cross-checked with satellite data, and the community is moderated.

### Bet 4. The satellite in every farmer's pocket: fully integrated with WhatsApp 💬

**Why.** 96% of Brazilian farmers use WhatsApp for business decisions, and 66.9% of soybean production sits outside 4G and 5G coverage. A website needs a signal and a habit; a WhatsApp message arrives anyway. The goal is not alerts on WhatsApp but the whole product inside it: answer, plan, alerts, community and questions by voice.

**What the farmer gets in WhatsApp**

1. **The whole answer in a chat.** Send the field location pin, tap the harvest period, and receive the recommendation as short text, as **audio**, and as a link to the full plan and the PDF report.
2. **Reminders on the plan's dates.** "Check the autumn signal this week." "The ZARC deadline for sorghum is March 20."
3. **Alerts that matter.** Dry soil, dry spells or heat at flowering, heavy rain, frost and fire nearby, at most two per week per field so they never become noise.
4. **The community in the chat.** Report "it rained here" or "it happened here" by replying to a message, and get the weekly regional digest.
5. **Questions by voice.** The farmer records an audio message ("can I still plant sorghum?") and gets an answer from the same engine.

**How we build it**

- **The official channel only:** the WhatsApp Business **Cloud API** from Meta, with a dedicated, verified number. Unofficial gateways break WhatsApp's terms and can lose the number in the middle of the season, exactly when alerts matter.
- **The same engine as the website.** Messages arrive by webhook at a thin FastAPI controller. A conversation service keeps the state (waiting for location, waiting for harvest date, answered), and the recommendation comes from the same engine as the website. No rule is duplicated.
- **One interface, many channels.** Sending goes through a `notifier` interface with one adapter per channel (WhatsApp now, Telegram or SMS later), tested with fake adapters.
- **Approved templates for proactive messages.** Alerts and reminders use pre-approved "utility" templates. Answers to the farmer's own messages use the 24-hour service window.
- **Consent and control.** The farmer opts in to alerts, can stop at any time with one word, and the saved field is linked only to the chat, with no password and no name (LGPD).
- **Cost.** Charged per message: about R$ 0.035 for utility and service messages, with the first 1,000 service conversations each month free (rates since October 1, 2026, to be confirmed on Meta's official pricing page).

**First step:** start Meta's business verification now, because it takes days, and launch with a beta group of 20 farmers.

**How we make it even better**

- **Voice in, voice out.** Speech-to-text for questions and text-to-speech replies, for farmers who prefer audio.
- **Co-signed by the agronomist.** The same alert reads "from Raiz Orbital, recommended by Ana, your agronomist". 65% of farmers change practices because of a technical recommendation.
- **Cooperative broadcast lists.** A cooperative sends the regional digest to all its members with its own brand.
- **Light by default.** Short messages, no heavy images, the plan cached for when the signal drops.
- **Buttons and lists.** Interactive replies so the farmer taps instead of typing.
- **More languages.** Portuguese, English and Spanish, for the Cerrado's neighbors.

---

## 5. Also on the list

| Item | What it is | Status |
| --- | --- | --- |
| Past-season replay | A timeline of the alerts a farmer would have received in a past season, such as 2024 | A first version is the "2024 example" on the Alerts page |
| Daily season monitoring | Save the field and plan; daily NASA data; alerts by WhatsApp | Depends on Bet 4 |
| Satellite check of adoption | July–August NDVI shows whether the plan was planted | Needs saved fields |
| Agronomist and reseller dashboard | Risk across a portfolio of clients and regions | Separate plan; this is who pays |
| Autumn-signal calibration | Test the dry-autumn signal against past forecasts (GEOS-S2S hindcasts) | Scripts already in the repository |
| Credit and insurance report | The planning report as evidence for banks and insurers | Needs legal review and a pilot with one bank |

## 6. From 48 hours to one year

| When | What ships |
| --- | --- |
| **The hackathon, 48 hours (done)** | The full web product for the Uberlândia–Uberaba pilot area, in Portuguese and English, live 24/7, with a 29-second demo video and public product documents |
| **Month 1** | WhatsApp beta with 20 farmers; the whole Triângulo Mineiro on the map; "It rained here"; crop texts reviewed by an agronomist |
| **Months 2–3 (Feb–Mar 2027)** | Off-season pilot with 15 to 20 farmers; plan reminders and alerts on WhatsApp; "What I planted and how it went" |
| **Months 4–12** | The Cerrado on the map; new crops and options; "Lend a hand"; the July–August satellite check of adoption; the first paying partner |
| **Years 2–3** | Every soybean region in Brazil; credit and insurance reports; first countries outside Brazil |

## 7. How we will know it worked

| Measure | First target (team hypothesis) |
| --- | --- |
| Farmers who test a soil-building option on part of their land | 1 in 3 |
| Fields that leave fallow in the next off-season, checked by NDVI | 20% more than the field's own 10-year history |
| WhatsApp conversations that reach an answer | 70% |
| Farmers who say they understand "why" the app recommended a crop | 7 in 10 |
| Weekly community reports in the pilot | At least one per farmer during the dry season |
| Paying partners | 1 reseller or cooperative by mid-2027 |

## 8. Who we need

| Who | For what |
| --- | --- |
| Agronomists and Embrapa researchers | Crop parameters for new regions and crops; reviewing every agronomic text |
| Cooperatives, rural unions and Emater | Pilot farmers, the agronomist channel and broadcast lists |
| Meta (WhatsApp Business) | Business verification and template approval |
| A lawyer and a rural credit manager | The credit and insurance report |

## 9. Thank you, NASA

None of this exists without NASA's open data and the Space Apps Challenge. They put twenty years of Earth observation in the hands of a small team in Uberlândia, and through us, in the hands of the farmers who feed the world.

## Sources

- Brazil's soybean area, 2025/26: [Conab via bpmoney](https://bpmoney.com.br/?p=378562)
- Soybean after grain with brachiaria: [Revista Cultivar](https://revistacultivar.com.br/noticias/consorcio-de-graos-com-forrageiras-controla-plantas-daninhas-na-soja)
- Crop insurance in 2025: [Brasil 61 / MAPA](https://brasil61.com/n/seguro-rural-parlamentares-de-mg-e-do-pr-cobram-fortalecimento-da-politica-para-dar-previsibilidade-ao-agro-cacb260201)
- Rural default: [Compre Rural / Serasa](https://comprerural.com/antes-de-vender-a-fazenda-para-pagar-dividas-produtor-precisa-conhecer-seus-direitos/)
- WhatsApp use and technical recommendation (9th ABMRA survey): [O Presente Rural](https://opresenterural.com.br/internet-chega-a-98-das-propriedades-rurais-no-brasil-revela-estudo-da-abmra/), [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/mudancas-climaticas-preocupam-86-produtores-rurais/)
- Mobile coverage in soybean areas: [Canal Rural](https://www.canalrural.com.br/agricultura/projeto-soja-brasil/conectividade-nao-acompanha-tecnologia-e-acesso-a-internet-nas-lavouras-de-soja-ainda-e-limitado/)
- Technical assistance reach: [Ipea](https://repositorio.ipea.gov.br/server/api/core/bitstreams/3122370b-8af7-4af7-867b-43ea9b422968/content)
- Uneven rain between Uberlândia and Uberaba: [Canal Rural](https://www.canalrural.com.br/agricultura/preco-baixo-desestimula-sojicultura-em-minas-gerais/)
- MODIS retirement: [LAADS DAAC](https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/)
- WhatsApp API pricing in Brazil: [ChatMaxima](https://chatmaxima.com/pt-br/whatsapp-api-pricing/brazil/), [AiSensy](https://m.aisensy.com/blog/pt/atualizacao-preco-whatsapp-api-outubro-2026/)
- Dry-spell numbers for the demo field: GPM IMERG (NASA), 2005–2024, computed by Raiz Orbital
