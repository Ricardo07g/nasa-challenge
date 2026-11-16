# Raiz Orbital: Product Discovery (pains, personas and hypotheses)

**Updated:** November 15, 2026 · Product owner: Rayanne
**Related documents:** [business plan](02-business-plan.md), [PRD](03-prd.md), [product roadmap](04-product-roadmap.md)

## Executive summary

**Main hypothesis.** Rainfed grain farmers in the Triângulo Mineiro repeat the soybean–corn succession, or leave the field fallow after soybeans, because they cannot see, for their own field, the climate risk and the soil benefit of the other options (sorghum, corn with brachiaria, cover crops). A comparison built on 20 years of NASA data, the projected climate and the effect on the soil, adjusted to their priorities and endorsed by their agronomist, will lead at least 1 in 3 to test another rotation on part of their land. This is exactly what the Field Shift challenge asks for: rotation strategies for soil health and climate adaptation.

**The moment is both favorable and urgent.** The 2025/26 season left rainfed crops in the Triângulo severely hit by drought, and 2026/27 starts under a strong El Niño, with a projected 1.5 million tonnes less soybean in Minas Gerais. Farmers are in debt, and in 2025 only 3.3% of Brazil's planted area was insured, so climate risk falls straight on their cash.

**The channel exists; trust is what is missing.** 98% of farms have internet at least on a phone, and 96% of farmers use WhatsApp for business decisions. But only 6% trust AI to decide, and a technical recommendation is the main reason to change practices. The product must arrive with the agronomist, not against them.

Three proto-personas guide the product: the mid-sized grain farmer (main user), the family farmer (community layer) and the reseller or cooperative agronomist (channel and source of trust). They are built from secondary data and must be validated in interviews.

## How we got to the problem

We started from a question, not from a technology. Before writing code, the team used the first hours of the hackathon for discovery, with one rule: **only public, citable sources, and every number with its link.**

1. **Read the challenge against our own region.** Field Shift asks for rotation strategies that protect the soil and adapt farms. We live in the Triângulo Mineiro, in the Cerrado, where the soybean harvest is followed every year by the same decision. We chose to answer that one decision well instead of covering many.
2. **Mapped who farms here.** IBGE Agricultural Census data organized by UFU, Minas Gerais state data and Conab: how many farms, how large, who runs them, what they grow and when.
3. **Mapped what goes wrong.** Regional climatology from public universities (UFU, IFTM, UFV), Embrapa research on water stress, soil and the soybean–corn succession, and regional press reports in the farmers' own words.
4. **Mapped how they decide.** Surveys with published methods (ABMRA, McKinsey, Serasa) and Ipea on technical assistance: who farmers trust, which channel they use, what stops them from adopting technology.
5. **Checked that NASA data can answer it, field by field.** IMERG, POWER, SMAP, MODIS and CMIP6 were tested for the pilot area before the engine was designed, downloaded directly from NASA services ([ADR 0005](../../projeto/backend/docs/adr/0005-fontes-diretas-da-nasa-sem-earth-engine.md)).
6. **Turned findings into decisions.** One question, two inputs, every number with its source, no generative AI in the engine, and a report for the agronomist.

| Type of source | Institutions used |
| --- | --- |
| Public universities and institutes, many in our region | UFU (Institute of Geography and Observatorium journal), IFTM, UFV (Revista Ceres), UFG, UFGD (Revista Brasileira de Climatologia) |
| Research and technology centers | Embrapa (Cerrados, Milho e Sorgo, Informática Agropecuária), Inpe, Cemaden, University of Leeds (AgroClimatic Monitor), ISRIC, NOAA CPC |
| Official statistics and policy | IBGE, Conab, MAPA (ZARC), Ipea, Minas Gerais government |
| Surveys with published methods | ABMRA with S&P Global, McKinsey, Serasa, Itaú BBA |
| Regional press | Canal Rural, Diário do Comércio, Notícias Agrícolas, Revista Cultivar |

Partners to validate next, all local: UFU's Institute of Geography, IFTM Uberaba, FAZU, Epamig and Emater Uberlândia.

## Who the audience is and what they do

The Triângulo and Alto Paranaíba have 55,428 farms: 64% are family farms, but they hold only 18% of the land. In practice there are two audiences: many small farms, mostly cattle and dairy, and a smaller group of mid-sized and large farms that grow most of the grain, sugarcane and coffee.

| Indicator | Value | Scope | Source |
| --- | --- | --- | --- |
| Farms | 55,428 in 66 municipalities | Triângulo and Alto Paranaíba, 2017 | [UFU / Agricultural Census](https://seer.ufu.br/index.php/Observatorium/article/download/70868/37022/322940) |
| Family farming | 64% of farms, 18% of the area | Same | Same |
| Average size (team calculation) | About 34 ha (family) and 284 ha (non-family) | Same | Same |
| Age | 76% of farmers are over 45 | Minas Gerais, 2017 | [Diário do Comércio](https://diariodocomercio.com.br/economia/especial-numero-de-estabelecimentos-rurais-avanca-no-estado/) |
| Women | 14.4% of farms run by women | Minas Gerais, 2017 | [Diário do Comércio](https://diariodocomercio.com.br/?p=14274) |
| Schooling | 64.2% up to elementary school; 16.1% high school | Minas Gerais, 2017 | [Diário do Comércio](https://diariodocomercio.com.br/?p=152380) |
| Internet in the rural population | 84.8% use the internet; 82% only on a phone | Brazil, 2024 | [Agência Gov](https://agenciagov.ebc.com.br/noticias/202507/acesso-a-internet-nas-areas-rurais-dispara-150-em-oito-anos-e-alcanca-84-8-da-populacao) |

| Activity | Weight in the region | Source |
| --- | --- | --- |
| Soybeans in summer, second-crop corn after | The most common grain system; Minas Gerais expects 9.1 Mt of soybeans and 7 Mt of corn in 2025/26 | [Agência Minas](https://agenciaminas.mg.gov.br/news/pdf/129946.pdf) |
| Corn | Uberaba leads corn in Minas Gerais (289,000 t in 2024/25) | [Revista Cultivar](https://revistacultivar.com.br/noticias/uberaba-e-paracatu-lideram-producao-de-graos-em-mg) |
| Sugarcane | The Triângulo produced 67% of Minas Gerais sugarcane in 2020 | [Agência Minas](https://www.agenciaminas.mg.gov.br/news/pdf/113556.pdf) |
| Cattle | Pasture covers 67% of family-farm land in the region | [UFU / Agricultural Census](https://seer.ufu.br/index.php/Observatorium/article/download/70868/37022/322940) |

**When.** About 85% of the year's rain falls from October to March, and 7- to 12-day dry spells occur mostly in February and March ([UFU](https://oasisbr.ibict.br/vufind/Record/UFU_d39712b9c5446201d9da06f307e717c6)). Soybeans are planted from October to December and harvested from February to April; second-crop corn follows right after, with the ideal window in February.

## Context and market

| Topic | Latest data | Source |
| --- | --- | --- |
| Rainfed crops in the Triângulo, 2025/26 | Severely affected by drought, with low yield expectations; dry spells in April and May | [Diário do Comércio / Conab](https://diariodocomercio.com.br/agronegocio/conab-projeta-alta-producao-graos-safra/) |
| Second-crop corn 2025/26 | Fields missed the ideal sowing window | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/producao-graos-minas-gerais-safra-2025-26/) |
| El Niño, 2026/27 | 1.5 Mt less soybean projected in Minas Gerais | [Diário do Comércio / Serasa](https://diariodocomercio.com.br/agronegocio/el-nino-safra-soja-minas-gerais/) |
| Concern about climate | 86% of farmers expect extreme events to affect their production (9th ABMRA survey, 3,100 interviews) | [Diário do Comércio / ABMRA](https://diariodocomercio.com.br/agronegocio/mudancas-climaticas-preocupam-86-produtores-rurais/) |
| Crop insurance | 3.2 million hectares insured in 2025, 3.3% of planted area | [Brasil 61 / MAPA](https://brasil61.com/n/seguro-rural-parlamentares-de-mg-e-do-pr-cobram-fortalecimento-da-politica-para-dar-previsibilidade-ao-agro-cacb260201) |
| Rural default | 8.8% in Q1 2026, up 1.2 points in a year | [Compre Rural / Serasa](https://comprerural.com/antes-de-vender-a-fazenda-para-pagar-dividas-produtor-precisa-conhecer-seus-direitos/) |
| Fires | About 45,000 ha of sugarcane burned in the Triângulo in 2024 | [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/prejuizos-incendios-cana-superam-180-milhoes-reais/) |

**Product reading:** dry spells are not rare, they are recurring, and farmers have less and less cushion (insurance and credit) to absorb a loss. Deciding better before the loss is worth more every year.

## The 2026/27 El Niño as a use case

El Niño is not the product; it is the best example of the problem. Dry spells, irregular rain, heat and fire happen every year in the Triângulo. A strong El Niño raises the chance and intensity of all of them at once. Raiz Orbital handles climate risk for any season; El Niño is the stress test that shows why it matters now.

| Aspect | What sources say | Source |
| --- | --- | --- |
| Intensity | NOAA estimated a 63% chance of a very strong El Niño for Nov 2026–Jan 2027 | [Itaú BBA](https://www.itau.com.br/media/dam/m/5bde3c83e3780878/original/Radar-El-Nino_Junho26_ItauBBA.pdf) |
| Rain and heat in Minas Gerais | Drier conditions Sept–Dec and higher temperatures Sept–Feb (Inpe, Inmet, Funceme) | [O Fator](https://ofator.com.br/?p=70362) |
| Second-crop corn | The most sensitive crop: compressed sowing and heat and water stress at grain filling; rain may stop in early April 2027 | [Itaú BBA](https://www.itau.com.br/media/dam/m/5bde3c83e3780878/original/Radar-El-Nino_Junho26_ItauBBA.pdf) |
| Soybeans in the Cerrado | Rain may come early without settling; a spread-out planting delays harvest and squeezes the second crop | [Canal Rural / Rural Clima](https://www.canalrural.com.br/agricultura/el-nino-forte-amplia-risco-para-soja-do-cerrado-e-safrinha-2026-27-diz-rural-clima/) |
| Fire | Late rains, heat and long drought favor fires; Minas Gerais launched a state fire plan | [Agência Minas](https://www.agenciaminas.mg.gov.br/news/pdf/130454.pdf) |

**What history shows.** In the strong 2023/24 El Niño, soybean yields fell 16% in Mato Grosso and 8% in Brazil. The effect is not uniform: that season the Triângulo did better in corn than other regions. That calls for local information, not generic alarm.

**Pitch line:** "El Niño passes. The dry spell comes back every year. Raiz Orbital stays."

## How farmers decide and get information today

| Behavior | Data | Source |
| --- | --- | --- |
| Internet on the farm | 98% of farms, at least on a phone | [Canal Rural / 9th ABMRA](https://www.canalrural.com.br/agricultura/quase-100-das-propriedades-rurais-conta-com-internet-mostra-pesquisa/) |
| WhatsApp | Main tool for business decisions, used by 96% | [O Presente Rural / 9th ABMRA](https://opresenterural.com.br/internet-chega-a-98-das-propriedades-rurais-no-brasil-revela-estudo-da-abmra/) |
| Digital tools in the field | 55% of Brazilian farmers in 2024, up from 42% in 2022 | [BrasilAgro / McKinsey](https://brasilagro.com.br/conteudo/mais-da-metade-dos-agricultores-espera-aumento-dos-lucros-em-2-anos.html) |
| Trust in AI | Only 6% cite generative AI as a trusted source for decisions | [AgFeed / McKinsey](https://agfeed.com.br/economia/mais-seletivos-com-gastos-produtores-rurais-adotam-ia-com-rapidez-aponta-estudo-da-mckinsey) |
| What makes farmers change practice | 65% cite a technical recommendation | [Diário do Comércio / 9th ABMRA](https://diariodocomercio.com.br/agronegocio/mudancas-climaticas-preocupam-86-produtores-rurais/) |
| Technical assistance | Only 20.2% of Brazilian farms received technical guidance in 2017 | [Ipea](https://repositorio.ipea.gov.br/server/api/core/bitstreams/3122370b-8af7-4af7-867b-43ea9b422968/content) |
| Cost barrier | 67.1% cite investment cost as the main barrier to digital agriculture | [Canal Rural / Embrapa](https://www.canalrural.com.br/agronegocio/pesquisa-embrapa-tecnologias-digitais/) |

**Three implications.** First, the answer must reach WhatsApp, not depend on opening an app (roadmap, Bet 4: fully integrated with WhatsApp). Second, "made with AI" does not sell; "NASA satellite data, explained by your agronomist" does, which is why the engine uses no generative AI. Third, the product must be free for the farmer, because cost is the first barrier.

## Pain map

| # | Pain | Evidence | What Raiz Orbital does today | Next |
| --- | --- | --- | --- | --- |
| 1 | Not knowing what to plant after soybeans | The soybean–corn or soybean–fallow routine dominates; Embrapa links it to soil degradation | Recommendation per field with "worked in X of 20 years", compare up to 3, 3-year plan | More crops (Bet 2) |
| 2 | The second-crop window is uncertain | When soybeans are late, the window shrinks; 2025/26 fields missed it and some switched to sorghum | Harvest date drives every result; ZARC deadline shown; options out of window never recommended | — |
| 3 | Rain ends early | In Ituiutaba, the dry season began in April in 63.4% of years | "When the rain ends" and rain left after harvest on the harvest-date screen | — |
| 4 | Dry spells and heat at flowering | Severe drought in 2025/26; 7- to 12-day dry spells common in Feb–Mar | Success rule uses ISNA and 35 °C at flowering; alerts page | Daily alerts on WhatsApp |
| 5 | Heavy rain on bare soil | Excess rain has caused 40% average soybean losses in the Triângulo | Heavy-rain alert; plans that keep the soil covered | — |
| 6 | Fire coming from outside the farm | 45,000 ha of sugarcane burned in 2024 | Fire history within 5 km; official alert channels | Community "It happened here" (Bet 3) |
| 7 | Little technical guidance, low trust in tools | 20.2% get guidance; 6% trust AI | Every source visible; printable report for the agronomist | Agronomist co-signed alerts |
| 8 | No financial cushion | 3.3% insured; 8.8% default | Plan B for a dry autumn; avoid avoidable losses | Credit and insurance report |
| 9 | Weak signal in the field | 66.9% of soybean production outside 4G/5G coverage | Light, mobile-first web app | WhatsApp (Bet 4) |
| 10 | Chronic stress | A psychologist describes farmers as "chronically stressed" | Calm tone, no alarmism, alerts only when they change a decision | — |

## Regional press reports

| Report | What it shows | Source |
| --- | --- | --- |
| A 3,000-ha farmer near Uberlândia started planting 15 days late because of drought | "When to plant" is a daily dilemma | [Canal Rural](https://www.canalrural.com.br/agricultura/com-plantio-atrasado-produtor-repensa-a-safrinha-em-mg/) |
| Uberlândia had rain 20% above average in a month when Uberaba, less than 100 km away, was 30% below | Rain is local; regional forecasts are not enough | [Canal Rural](https://www.canalrural.com.br/agricultura/preco-baixo-desestimula-sojicultura-em-minas-gerais/) |
| A farmer estimated losses of up to 50% on 250 ha; an agronomist reported losses from 10% to 80% | Losses turn into debt | [Canal Rural](https://www.canalrural.com.br/agricultura/milho-soja-sao-culturas-mais-atingidas-pela-seca-minas-gerais-24403/) |
| After two years of losses, Uberlândia farmers had not yet paid off their debts | Losses pile up season after season | [Notícias Agrícolas](https://www.noticiasagricolas.com.br/noticia/166903) |
| In June 2026, Conab recorded shorter rainfed crops for lack of rain in the Triângulo | The pain is current | [Conab](https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/safras/progresso-de-safra/acompanhamento-das-lavouras-01-06-a-07-06-26/monitoramento-das-condicoes-das-lavouras) |

The strongest signal: rain varies a lot from one farm to the next. That is why the community layer starts with "It rained here", where farmers record their own rain gauge (roadmap, Bet 3).

## Regional research

| Study | Finding | Use in the product | Source |
| --- | --- | --- | --- |
| UFU (Roldão and Ferreira, 2015), 30 stations, 1980–2013 | Rainy season from Oct 19 to Apr 11 on average; 77% of dry spells last 5 to 9 days; February holds 37% | Short dry spells do little harm; the engine focuses on water at flowering | [Estudos Geográficos / UFU](https://periodicos.rc.biblioteca.unesp.br/index.php/estgeo/article/download/10210/7360) |
| UFU and IFTM (Costa and Queiroz, 2021), Ituiutaba | Dry season began in April in 63.4% of years and in May in 33.3% | End-of-rain risk for the second crop | [Revista Brasileira de Climatologia](https://ojs.ufgd.edu.br/rbclima/article/download/14572/7715/46644) |
| UFV, Revista Ceres | Start of the rainy season: first 20 mm in 1–2 days after Sept 10 | Future "can I plant the soybeans yet?" signal | [Revista Ceres](https://ojs.ceres.ufv.br/ceres/article/download/3139/1034/4717) |
| Embrapa (2021) | MODIS series separated soybean–corn, soybean–millet and soybean–fallow in the Cerrado with 84% to 100% accuracy | Field history by NDVI | [Embrapa](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1135867/1/Big-Earth-Observation-Data-e-aprendizado-de-maquina-2021.pdf) |
| Inpe, Cemaden and University of Leeds: AgroClimatic Monitor | Near-real-time drought indicators | Reference and alternative; our difference is the field-level decision | [AgClimate BR](https://agclimatebr.leeds.ac.uk/data/pdfs/ficha_tecnica_1_apresentacao_PT.pdf) |

Partners to validate and build credibility: UFU's Institute of Geography (climatology lab), IFTM Uberaba, FAZU, Epamig and Emater Uberlândia.

## Personas

Names and stories are fictional; every trait comes from the data above. They must be confirmed in interviews.

### 1. Marcelo, rainfed grain farmer (main user)

- **Profile:** 52, high school, about 600 ha (owned and leased) near Uberlândia. Soybeans in summer, second-crop corn after, no irrigation. Finances the season with a bank and with the reseller; no insurance this year.
- **Digital routine:** phone all day; WhatsApp with the reseller, the agronomist and the union group. No signal in the field.
- **Wants:** plant at the right time, not miss the second-crop window, close the season without more debt.
- **Likely quote:** "I have the forecast. What I don't know is whether the corn will make it."
- **Raiz Orbital gives him:** a recommendation for his field, the ZARC deadline, Plan B for a dry autumn and a report for his agronomist; next, the same on WhatsApp.

### 2. Seu José and Dona Cida, family farmers (community layer)

- **Profile:** 63 and 58, elementary school; 30 ha near Patos de Minas with dairy cattle, silage corn and a vegetable garden. Occasional Emater visits.
- **Digital routine:** one prepaid phone, only WhatsApp and voice messages; the association group for everything.
- **Wants:** keep pasture and silage through the dry season and lose nothing to fire.
- **Likely quote:** "If fire starts here, it's the neighbor who warns me."
- **Raiz Orbital gives them (roadmap):** fire and drought alerts as short text or audio, neighbors' reports and a way to ask for and offer help.

### 3. Ana, reseller or cooperative agronomist (channel and trust)

- **Profile:** 32, agronomist serving about 80 farmers through a reseller or cooperative; on the road and on WhatsApp all day.
- **Wants:** accurate recommendations for many farmers at once, and to be the one who warned first.
- **Likely quote:** "In February everyone calls me asking whether to plant the corn."
- **Raiz Orbital gives her:** the planning report to discuss with each client; next, co-signed alerts and a portfolio dashboard.

## Hypotheses

**Main.** We believe rainfed grain farmers in the Triângulo keep the soybean–corn or soybean–fallow routine because they cannot see, for their field, the climate risk and soil benefit of the alternatives. If they get a comparison built on 20 years of NASA data, projected climate and soil effect, adjusted to their priorities and with the reason for each result, then at least 1 in 3 will test another option on part of their land next off-season. We will know it is true when 10 interviews and a pilot with 15 to 20 farmers in the 2027 off-season show 30% or more changed part of their area, verified by NDVI.

| # | Hypothesis | Why we believe it | How to test |
| --- | --- | --- | --- |
| H2 | WhatsApp delivers more value than a website | 96% use WhatsApp for business; weak signal in the field | Compare reach and response in the WhatsApp beta and on the website |
| H3 | Farmers trust a recommendation more when it comes from their agronomist | 65% change practice through technical recommendation; 6% trust AI | Same message with and without the agronomist's endorsement |
| H4 | Agronomists and cooperatives pay, not farmers | Cost is the first barrier for 67.1% | Offer a per-hectare license to 3 resellers or cooperatives |
| H5 | Neighbors' reports keep the product alive all year | Fire and local events are invisible to satellites | Weekly reports in a pilot group during the dry season |
| H6 | In a strong El Niño year, farmers actively look for this kind of tool | 86% worried about climate | Sign-up rate with and without the El Niño hook |

**Riskiest assumptions.** The farmer may already have this information from a consultant; the decision may be locked in once seed is bought; SMAP and IMERG see kilometers while farmers think in fields.

## How to validate

| Step | What | Success metric | When |
| --- | --- | --- | --- |
| 1. Interviews | 10 conversations: 5 grain farmers, 3 family farmers, 2 agronomists | 7 of 10 describe a recent loss and say earlier information would have changed something | Right after the hackathon |
| 2. Back-testing | Compare the engine's high-risk years with IBGE municipal second-crop corn losses | High-risk years match loss years | December 2026 |
| 3. Off-season pilot | 15 to 20 farmers in Uberlândia and Uberaba, with the union, Emater or a reseller | 1 in 3 tests a soil-building option; 7 in 10 understand "why" | Feb–Mar 2027 |
| 4. Adoption check | NDVI in the following off-season | Fallow area drops among participants | Jul–Aug 2027 |
| 5. Willingness to pay | Present the product to 3 resellers or cooperatives | At least 1 paid or co-funded pilot | Mid-2027 |

### Interview script (30 minutes)

1. Tell me about the last season. What went well, what went wrong?
2. What was your last climate loss? When did you realize it would go wrong?
3. How do you decide what to plant after the soybeans? Who do you ask?
4. Where do you check the weather today? What is missing?
5. What are you doing differently this season because of El Niño?
6. If someone showed you how each crop did on your field over 20 years, what would you do with it?
7. When there is fire, hail or a bad road nearby, how do you find out? Who do you tell?
8. Would you trust information from a satellite? And if it came from your agronomist?
9. Do you pay for any information or consulting today? How much?
10. Can I send you your field's plan in February to see if it helps?

Avoid asking "would you use an app like this?": the answer is almost always yes and worth little. What matters is the concrete story of the last loss and what the person actually did.

## Sources

Official sources (IBGE, Conab, MAPA, Inmet, Inpe, Embrapa, Minas Gerais government, NASA, NOAA), market surveys with published methods (ABMRA with S&P Global, McKinsey, Serasa, Itaú BBA) and universities (UFU, UFV, IFTM, Ipea) were prioritized. Press articles were used for farmer reports and to relay data from those institutions. All links are in the tables above.
