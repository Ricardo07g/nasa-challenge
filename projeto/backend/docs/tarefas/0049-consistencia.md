# Tarefa 0049: Remodelagem S9, consistência entre as telas e revisão final

- **Identificador:** `0049`
- **Título:** As telas dizem o mesmo número e dão o mesmo conselho; missão com as fontes certas; "Como a conta é feita" com as regras novas; nada de link para telas removidas; limpeza; regras gerais conferidas; 3 artigos do Guia
- **Status:** Concluída (o que ficou de fora está na "Lista final do pedido" do `docs/remodelagem.md`)
- **Prioridade:** Alta (seção 9 da remodelagem)
- **PRD:** RF-19 e RF-20 (reescritos), RF-33 (novo), PRD 7.6 (nota sobre o nematoide)
- **Decisões:** D130 a D142 do `docs/remodelagem.md`
- **Referências:** `arquivos contexto/prompt-raiz-orbital.md` (regras gerais e seções 8 e 9), `docs/remodelagem.md` (revisões S1 a S8, "Números estranhos", "O que não foi possível")

---

## 1. O que mudou, item a item

| Item | Antes (fazenda de exemplo, dado real) | Depois |
| --- | --- | --- |
| A1 Clima 2041–2060 | Sugestão "−0,7%, 2 de 3 indicam menos chuva" (média simples dos meses, `CellClimateFactsService`); raio-X "+2,2%, 2 de 3 indicam mais chuva" | As duas telas "+2,2%, 2 de 3 modelos indicam mais chuva; 3 de 3, mais calor" (o `/recomendacao` manda o cartão do raio-X, `FutureClimateService`). Geada: o alerta do raio-X (`RaioXClimateService.frost`) nas duas. Saíram o service duplicado e os grupos `clima_futuro_sugestao` e `geada_sugestao` |
| A2 Sinal × aviso de El Niño | Plano "Sinal de ano normal. O sinal marca o Plano A."; aviso "Veja o Plano B no Plano de 3 anos antes de decidir" | Aviso "O sinal do outono marca o Plano A. Confira o plano no Plano de 3 anos." (segue `valores.sinal`). O sinal usa o Plano B da tela (`PlanBService`) e o `/api/plano` devolve o sinal do plano mostrado (editado: "sorgo deu certo em 4") |
| A3 Falta de água | Avisos "101,6 → 177,4 mm por ano" e Sugestão "Falta 116 mm em ano normal… Mediana de 20 anos" | Avisos "…na média dos anos… Os anos muito secos puxam a média para cima."; Sugestão "Ano normal = em metade dos anos faltou isso ou menos (mediana de 20 anos)" |
| A4 Nematoide | Linha Terra: sorgo e milho com braquiária "ajuda a quebrar o ciclo"; Plano: só crotalária e milheto | Uma regra (supressoras do PRD 7.7): crotalária e milheto "quebra o ciclo do nematoide"; os outros "não quebra" |
| A5 Verde sem soja | Ponto da cidade: "Pico da soja 2025/26: 0,33" | `verde.soja_vista: false` → "Maior verde de janeiro a meados de março (2025/26): 0,33, em 18 de fevereiro de 2026. O satélite não viu soja aqui." |
| A6 Exemplo pronto | `/exemplo` → `colheita=meio` com a resposta do `/exemplo` (tarde) | `/exemplo` → `colheita=tarde` (a do satélite); o `farmService` só usa a resposta pronta quando a faixa da URL é a dela |
| B7 Missão | Fases sem fonte; "Fazendo a conta das 6 opções" fixo | Cada fase cita só a fonte usada (SoilGrids, SMAP do balde, GPM IMERG/NASA POWER, MODIS NDVI, MCD64A1 com o arquivo, NEX-GDDP-CMIP6, NOAA) e "Fazendo a conta das N opções" (tarde: 3) |
| B8 Como a conta é feita | Só passos, renda ("hoje zero") e o cartão "em breve" do IBGE | Bloco "As regras da conta" com os números de `GET /api/metodo` (13 regras); nota de quem não dá grão do YAML; cartão "em breve" saiu; cartão do NASA POWER diz calor e ETo |
| B9 Telas removidas | Nenhum link na tela; sobrava a chave "Todas as opções" | Teste `consistency.test.ts` barra links e textos das telas removidas; chave e comentário corrigidos |
| B10 Limpeza | Funções e chaves sem uso | Saíram `buildPlan`, `planSwaps`, `planSummary`, `initialScenario`, `plantingRule`, `optionsSummary`, `buildAnswer`, `optionsForObjective`, `PAST_YEARS`, `LateWarning`, `GRAIN_CROPS`/`COVER_CROPS`, as chaves `report`, `past`, `answerTabs.answer/options/plan`, `plan.*` antigas e da comunidade simulada, e o `regra_dia_plantar`/`regra_data` da API |
| C11 R$ e "Ainda não conectado" | Conferido à mão | Testes no front (`consistency.test.ts`) e no backend (`test_regras_gerais.py`) |
| C12 pt/en | Teste de paridade já existia (`messages.test.ts`) | Continua verde com as chaves novas |
| C13 Fonte certa | "De onde vem cada dado": NASA POWER = "Chuva e calor" | "Calor e gasto de água da lavoura (ETo); a chuva, só nos anos sem o GPM IMERG"; docstring do replay corrigida |
| C14 Celular | "Cuidar da terra" em 2 ou 3 linhas em 390 px | O botão cresce pelo texto e desce de linha; o texto não quebra |
| D15 Guia | Faltavam erosão, plantio direto e sementes | Os 3 em pt e en (rascunho), fontes conferidas, "Saiba mais" do alerta de chuva forte e dos relatos de erosão e fogo |

## 2. Contratos novos ou mudados

- `/recomendacao` e `/exemplo`: `clima_futuro` e `geada` têm o formato do raio-X (`ClimaFuturo` e `AlertaGeada`); `sinal` sem `regra_dia_plantar` e `regra_data`.
- `/api/plano`: `sinal` (o mesmo formato, do Plano A e do Plano B da tela).
- `/api/avisos`: `valores.sinal` no aviso `enso`.
- `/api/raio-x`: `verde.soja_vista`.
- `/talhao`: `dados` lista `modis_mcd64a1` quando o arquivo da área queimada cobre o ponto.
- Novo: `GET /api/metodo` (`MethodService`).

## 3. Testes (TDD)

Cada item começou por um teste vermelho pelo motivo certo (anotado no relatório da tarefa): `test_should_give_the_suggestion_the_same_2041_2060_climate_and_frost_as_the_x_ray` (−10,0 × +4,1), `futureClimateText.test.ts`, `test_should_give_the_signal_the_plan_a_and_the_plan_b_shown_on_the_plan_screen`, `test_should_give_the_autumn_signal_of_the_plan_on_screen`, `test_should_give_the_enso_warning_the_verdict_of_the_autumn_signal`, `AvisosView`/`planService`/`usePlanController` (sinal), `test_should_say_only_the_suppressor_crops_of_prd_7_7_break_the_nematode_cycle`, `test_should_say_whether_the_satellite_saw_soy_in_the_latest_season`, `useExampleController.test.ts` e `farmService` (faixa da URL), `missionService`/`MissionView` (fontes e opções), `test_method_service.py`, `test_metodo_controller.py`, `MethodView`/`useMethodController`/`metodoRepository`, `consistency.test.ts`, `test_regras_gerais.py`, `test_should_list_the_burned_area_only_when_the_file_covers_the_point`, `guideContent.test.ts` (fontes não conferidas) e os links do Guia.
