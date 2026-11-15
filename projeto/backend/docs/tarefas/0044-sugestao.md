# Tarefa 0044: Abas da resposta, objetivo do produtor, água e aba Sugestão (remodelagem S5a)

- **Identificador:** `0044`
- **Título:** Abas Sugestão / Comparar / Plano de 3 anos, seletor "O que você quer mais?", imagem da planta, linha Água e selo "Sede da cultura", aba Sugestão com o explorador ano a ano (no lugar de `/safra-passada`), "Como fazer" em quatro partes, aviso único da colheita tarde e sem o relatório
- **Status:** Concluída na branch `feat/remodelagem-s5a-sugestao` (falta o merge em `feat/remodelagem` e a revisão)
- **Prioridade:** Alta (seção 5 da remodelagem, itens 5.1 a 5.4; S5a)
- **PRD:** RF-05 e RF-22 (reescritos) e RF-30 (novo)
- **Módulos Afetados:**
  - backend: `app/config_data/regras.yaml` (grupos `agua`, `enso_acerto`, `clima_futuro_sugestao`, `geada_sugestao`), `app/models/regras.py`, `app/repositories/rules_repository.py`, `app/models/recomendacao.py`, `app/schemas/recomendacao.py`, `app/services/climate_risk_service.py`, `app/services/water_need_service.py` (novo), `app/services/suggestion_facts_service.py` (novo), `app/services/cell_climate_facts_service.py` (novo), `app/services/year_detail_service.py`, `app/services/rotation_plan_service.py`, `app/services/recommendation_service.py`, `app/services/past_season_service.py`, `app/controllers/safra_passada_controller.py`;
  - front: `models/recomendacao.ts`, `models/pastSeason.ts`, `services/flowParams.ts`, `services/suggestionService.ts` (novo), `services/recomendacaoRules.ts`, `services/pastSeasonService.ts`, `repositories/pastSeasonRepository.ts`, `repositories/mocks/`, `controllers/useAnswerNav.ts`, `controllers/useAnswerController.ts`, `controllers/useOptionsController.ts`, `controllers/usePlanController.ts`, `controllers/useFlowRain.ts`, `views/AnswerHeader.tsx` (novo), `views/AnswerView.tsx`, `views/OptionsView.tsx`, `views/PlanView.tsx`, `views/SeasonTimeline.tsx` (novo), `design-system/components/SuggestionCharts.tsx` (novo: `YearBarsChart`, `WaterBar`), `design-system/components/Status.tsx` (`ThirstBadge`), `Content.tsx` (`MiniPlan`, imagem e selo nos cartões), `Card.tsx`, `routes.tsx`, `pages.tsx`, `i18n/messages.{pt,en}.ts` (bloco novo `suggestion`). Saíram `ReportView`, `useReportController`, `reportService`, `PastSeasonView` e `usePastSeasonController`.
- **Referências:** `arquivos contexto/prompt-raiz-orbital.md` (seção 5, itens 5.1 a 5.4; tabela de links da seção 8), `projeto/backend/docs/remodelagem.md` (D67 a D80), tarefas 0035 (detalhe de cada ano), 0040 (renda), 0042 (tela 3) e 0048 (Guia)

---

## 1. O que foi feito

- **Abas na ordem nova:** "Sugestão" (antes "Resposta"), "Comparar" (antes "Todas as opções") e "Plano de 3 anos". As URLs ficaram (`/resposta`, `/opcoes`, `/plano`): os links compartilhados não quebram. A aba Comparar continua com o conteúdo de antes (a S5b refaz), com o nome novo, a imagem da planta, o selo de sede e a linha Água.
- **5.1 "O que você quer mais?"** no topo das três abas: "Mais segurança", "Renda" e "Cuidar da terra" (sem escolha = equilíbrio, os pesos padrão do motor). A escolha fica na URL (`objetivo=seguranca|renda|terra`), segue nas abas e reordena a sugestão, o Comparar e o plano sugerido. **A ordem e o plano de cada objetivo vêm prontos do motor** (`objetivos` do `/recomendacao`); o navegador só escolhe, sem pedir de novo (RNF-02).
- **5.2 Imagem da planta** (`PlantImage` da S8) no destaque da Sugestão, nos 3 anos em miniatura, nos cartões "Se você prefere…", nos cartões do Comparar (com o "Deixar parado") e em cada ano do Plano.
- **5.3 Água**, toda do balanço hídrico diário do motor, nos dias do ciclo de cada ano:
  - selo "Sede da cultura" (pouca, média ou muita água) pelo consumo da cultura no ciclo (ETc = ETo × Kc), cortes no `regras.yaml` (hipótese do time);
  - linha "Água" com a barra: "Precisa de X mm" (mediana do ETc), "Costuma chover Y mm" (mediana da chuva do IMERG no ciclo), "Falta Z mm em ano normal e W mm em ano seco" (falta = ETc − ETr; mediana e ano seco);
  - a versão 2041–2060 na mesma linha: a falta em ano normal com os deltas de cada modelo do CMIP6 (média, faixa entre os 3 modelos e a mudança contra hoje);
  - a frase de por que falta mesmo chovendo mais que a planta precisa (a terra só guarda a CAD da conta) e a linha de que a palhada, a enxurrada e a água da próxima safra estão no Guia, **sem número**.
- **5.4 Aba Sugestão:**
  - a melhor opção do objetivo como "Ano 1 do seu plano", com a imagem e o selo de sede, e os 3 anos do plano em miniatura com "Explorar o plano". **O Plano A agora começa pela melhor opção** (D71);
  - "Deu certo" explicado com o **critério real do motor**, vindo da API (`criterio`): ISNA de 0,55 ou mais na fase crítica (15 dias antes e depois da floração; na cobertura, 0,50 nos primeiros 30 dias) e **menos de 3 dias** de 35 °C nessa fase (`calor_min_dias` = 3);
  - **explorador ano a ano** no lugar dos quadradinhos: uma barra-botão por ano (2005–2024), altura = ISNA do motor em %, linha de corte tracejada com o texto "Limite: 55%", ano bom cheio e ano com aperto listrado com contorno (nunca só cor), "N" e "L" escritos em cima dos anos de El Niño e La Niña, legenda em texto;
  - **ao tocar num ano**, o detalhe abre embaixo (e o `ano` vai para a URL): semeadura, floração (ou começo do pegamento), maior sequência sem chuva na fase, dias de 35 °C, El Niño ou La Niña (ONI), umidade do SMAP no dia de plantar (só de 2016 em diante), a frase do motivo e **a safra dia a dia** do `/api/safra-passada` (a antiga tela, agora com a opção mostrada e a faixa da URL). `/safra-passada?…&ano=X` leva para `/resposta?…&ano=X`;
  - El Niño e La Niña: taxa de acerto por fase contra os outros anos (`enso_acerto`); a frase "Em anos de La Niña, deu certo em X de Y; nos outros anos, em A de B." e "São poucos anos…" só aparecem com diferença clara (critério no `regras.yaml`); senão, só a marcação por ano;
  - linhas na ordem: Deu certo (com o explorador), Água, Clima 2041–2060 (chuva de março a maio em %, máxima em °C, quantos modelos concordam, e os anos que dariam certo), Renda e Terra;
  - "Como fazer" em quatro partes: quando plantar (data limite do motor), quanto tempo leva (ciclo e floração do `culturas.yaml`), o que observar (veranico típico e anos de calor da fase crítica, do motor, e o fim das chuvas da S3) e manejo (os passos do `culturas.yaml`, com "Rascunho: a revisar pela agrônoma."), terminando em "Passo a passo completo" (artigo da cultura);
  - colheita tarde: **um aviso só**, com a lista montada ("Colhendo depois de 20 de fevereiro, já passou o prazo seguro de plantio (ZARC, 28 de fevereiro) para milho sozinho, milho com braquiária e crotalária. Por isso elas não aparecem."), a linha que explica o ZARC com o link do artigo e o risco de geada quando algum ano teve geada;
  - **saiu o botão e a tela "Relatório para banco ou seguro"**; `/relatorio` leva para a Sugestão.
- **Links "Saiba mais"** (tabela da seção 8): deu certo (`/guia/deu-certo`), conta de água (`/guia/conta-de-agua`), artigo da cultura (selo e "Passo a passo completo"), El Niño (`/guia/el-nino-la-nina`), clima 2041–2060 (`/guia/clima-2041-2060`), ZARC (`/guia/prazo-de-plantio-zarc`) e geada (`/guia/geada-na-safrinha`). Um teste confere que cada link aponta para um artigo que existe em pt e en.

## 2. Contrato (`/api/recomendacao` e `/api/exemplo`): campos novos, todos opcionais no front

```json
"opcoes": [{
  "agua": {"precisa_mm": 346, "chove_mm": 400, "falta_normal_mm": 116, "falta_seco_mm": 158,
           "sede": "muita", "cad_mm": 60, "anos": 20,
           "futuro": {"falta_normal_mm": 128, "falta_min_mm": 112, "falta_max_mm": 143, "mudanca_mm": 12, "modelos": 3}},
  "criterio": {"isna_min": 0.55, "calor_temp_c": 35.0, "calor_min_dias": 3, "fase": "floracao", "janela_dias": 15},
  "ciclo": {"dias": 120, "floracao_dias": 60},
  "observar": {"veranico_dias": 9, "anos_calor": 0, "total": 20},
  "enso_acerto": [{"fase": "el_nino", "anos": 7, "bons": 5, "anos_outros": 13, "bons_outros": 11, "clara": false}],
  "anos_detalhe": [{"ano": 2016, "...": "...", "isna": 0.33, "dias_calor": 0, "falta_agua": true, "calor": false,
                    "semeadura": "2016-02-18", "umidade_inicial": 0.403}]
}],
"fora_da_janela": [{"id": "crotalaria", "nome": "Crotalária", "texto": "...", "data_limite": "2027-02-28"}],
"objetivos": {
  "equilibrio": {"ordem": ["milho_braquiaria", "milho_safrinha", "sorgo", "crotalaria", "milheto"],
                 "plano": ["milho_braquiaria", "milho_braquiaria", "crotalaria"], "nota_plano": 79.7},
  "seguranca": {"ordem": ["crotalaria", "milheto", "..."],
                "plano": ["crotalaria", "milho_braquiaria", "crotalaria"], "nota_plano": 76.8},
  "renda": {"...": "..."}, "terra": {"...": "..."}
},
"clima_futuro": {"chuva_pct": -0.7, "tmax_c": 1.3, "modelos": 3, "concordam_chuva": 2, "concordam_tmax": 3,
                 "meses": [3, 4, 5], "cenario": "ssp245"},
"geada": {"anos": 0, "total": 20, "tmin_max_c": 3.0, "meses": [5, 6, 7]}
```

(números reais da lavoura de demonstração, colheita meio). Sem CMIP6: `agua.futuro` e `clima_futuro` nulos. Sem o ONI: `enso_acerto` vazio. Sem opção na janela: `objetivos` vazio. `GET /api/safra-passada` ganhou `opcao` (opcional): o replay dessa opção, se ela couber na janela da faixa (senão, 404 `NOT_FOUND`).

## 3. Regras (todas no service, números no `regras.yaml`)

| Regra | Onde | Números (`regras.yaml`) |
| --- | --- | --- |
| Somas do ciclo em cada ano: ETc, ETr e chuva nos dias do ciclo (a mesma simulação do "deu certo") | `ClimateRiskService.simulate_historical` | os do `clima` |
| Futuro por modelo: os anos simulados com a série projetada pelos deltas de cada modelo; a nota de futuro e a falta de água saem do mesmo conjunto | `ClimateRiskService.simulate_future_by_model` / `summarize_future` | — |
| Linha Água: medianas do ETc, da chuva e da falta (ETc − ETr); ano seco = percentil 100 − 20 = 80 da falta (interpolação linear, a mesma da tela 3); futuro = mediana de cada modelo, média, mínimo e máximo, e a diferença contra hoje | `WaterNeedService` | `agua.percentil_seco` (20) |
| Sede da cultura: ETc mediano < 280 mm = pouca; ≥ 325 mm = muita; senão, média | `WaterNeedService.thirst` | `agua.sede_pouca_ate_mm`, `sede_muita_desde_mm` (hipótese do time) |
| El Niño / La Niña: acertos nos anos da fase contra os outros anos (neutros e a outra fase); clara = pelo menos 5 anos da fase e 25 pontos percentuais de diferença | `SuggestionFactsService.enso_hit_rates` | `enso_acerto.anos_fase_min`, `diferenca_min_pct` (hipótese) |
| O que observar: veranico típico = mediana (para baixo) da maior sequência sem chuva na fase crítica; anos de calor = anos com o calor do aperto | `SuggestionFactsService.watch_facts` | os do `clima` e `avisos` |
| Clima 2041–2060 na célula: média dos meses de cada modelo, média entre os modelos e quantos vão no mesmo sentido | `CellClimateFactsService.future_outlook` | `clima_futuro_sugestao.meses` (3, 4, 5) |
| Geada: anos com alguma mínima de 3 °C ou menos de maio a julho (NASA POWER) | `CellClimateFactsService.frost_risk` | `geada_sugestao.tmin_max_c`, `meses` |
| Objetivos: ordem = nota do eixo (segurança, renda ou solo; equilíbrio = nota final), desempate pela final; plano = melhor sequência do PRD 7.7 que começa pela 1ª da ordem, com a média da nota do eixo + o bônus de diversidade (sem o teto de 100 na comparação), desempate pela mesma conta com a nota final; nos objetivos, sem o pousio | `RecommendationService._objectives`, `RotationPlanService.best_plan_starting_with` | os da `rotacao` |
| Plano A = o plano do equilíbrio (começa pela melhor opção); o Plano B continua livre | `RecommendationService.recommend` | — |

No front: `suggestionService.ts` só escolhe (ordem e plano do objetivo; sem o campo, a regra antiga do navegador), monta as barras do explorador, junta o aviso da colheita tarde por data e liga os artigos.

## 4. Testes (TDD)

Cada teste foi escrito antes do código e visto falhando pelo motivo certo:

| Teste | Red |
| --- | --- |
| `test_climate_risk_service.py` (somas do ciclo; futuro por modelo) | `AttributeError: 'ResultadoAno' object has no attribute 'etc_mm'` / `'ClimateRiskService' object has no attribute 'simulate_future_by_model'` |
| `test_rules_repository.py` (grupos novos e "sem fonte") | `AttributeError: 'Regras' object has no attribute 'agua'` / `KeyError: 'agua'` (6 falhas) |
| `test_water_need_service.py` (12 casos) | `ModuleNotFoundError: app.services.water_need_service` |
| `test_suggestion_facts_service.py` e `test_cell_climate_facts_service.py` (12 casos) | módulos inexistentes |
| `test_year_detail_service.py` (explorador; contrato) | `TypeError: unexpected keyword argument 'smap_wetness_by_year'` e o `AnoDetalhe` sem os campos |
| `test_rotation_plan_service.py` (plano que começa pela cultura, por eixo, nematoide; sem pousio) | `AttributeError: … 'best_plan_starting_with'`; depois `TypeError: … 'allow_fallow'` |
| `test_recommendation_service.py` (9 casos novos) | `AttributeError` em `agua`, `criterio`, `objetivos`, `clima_futuro`, `data_limite` |
| `test_recomendacao_controller.py` (contrato) | `KeyError: 'agua'` / `'objetivos'` |
| `test_past_season_service.py` e `test_safra_passada_controller.py` (`opcao`) | `TypeError: unexpected keyword argument 'opcao'`; a rota ignorava a opção (200 e a melhor do motor) |
| `flowParams.test.ts` (objetivo) | 3 falhas (`objetivo` indefinido e fora da URL) |
| `suggestionService.test.ts` | módulo inexistente; depois `cropArticle`, `optionsForObjective` e `thirstByCrop` indefinidos |
| `pastSeasonRepository.test.ts`, `pastSeasonService.test.ts` | 4 falhas (URL sem `colheita`/`opcao`, opções não repassadas) |
| `Status.test.tsx`, `Content.test.tsx`, `Card.test.tsx`, `SuggestionCharts.test.tsx` | `ThirstBadge` e `MiniPlan` indefinidos, imagem e selo não desenhados, módulo inexistente |
| `useAnswerNav.test.ts` | 4 falhas (ordem e nomes antigos, sem objetivo) |
| `AnswerHeader.test.tsx` | módulo inexistente |
| `useAnswerController.test.ts` | 7 falhas (controller antigo) |
| `AnswerView.test.tsx` (20 casos) | 15 falhas contra a tela antiga |
| `useOptionsController.test.ts`, `OptionsView.test.tsx` | `optionsForObjective` indefinido; 4 falhas na tela |
| `usePlanController.test.ts`, `PlanView.test.tsx`, `recomendacaoRules.test.ts` | 2 + 2 falhas (aba na posição antiga, plano sem o objetivo, sem imagem e selo) |

Exceções: o teste dos anos embaixo do explorador (o vizinho do ano escolhido some) foi escrito depois da correção visual, na revisão no Chrome; os testes de rota (`routes.test.tsx`) foram escritos antes, mas a troca das rotas e das páginas foi feita junto, sem um red isolado.

Nada de rede: repositórios falsos no backend; no front, services e repositórios falsos. Dados de teste com valores redondos e fonte de teste.

## 5. Números reais na lavoura de demonstração (−18,9543 / −48,1993; banco local de revisão, IMERG em 20 de 20 anos, solo argiloso, CAD 60 mm)

| Colheita | Cultura | Precisa | Chove | Falta normal / seca | 2041–2060 (normal, faixa, mudança) | Sede |
| --- | --- | --- | --- | --- | --- | --- |
| meio (18/fev) | milho com braquiária (melhor) e milho sozinho | 346 | 400 | 116 / 158 | 128 (112–143), +12 | muita |
| meio | sorgo | 303 | 398 | 83 / 114 | 90 (80–100), +7 | média |
| meio | crotalária | 262 | 392 | 42 / 87 | 46 (38–55), +4 | pouca |
| meio | milheto | 242 | 376 | 25 / 77 | 27 (17–38), +2 | pouca |
| tarde (3/mar) | milheto (melhor) | 231 | 332 | 49 / 79 | 54 (47–59), +5 | pouca |
| tarde | sorgo | 289 | 337 | 107 / 144 | 116 (96–130), +9 | média |
| cedo (8/fev) | milho com braquiária (melhor) | 359 | 438 | 96 / 147 | 103 (88–119), +7 | muita |

- **Clima 2041–2060 na célula (março a maio):** chuva −0,7% (2 de 3 modelos indicam menos chuva), máxima +1,3 °C (3 de 3).
- **Geada:** 0 de 20 anos com mínima de 3 °C ou menos de maio a julho (a linha não aparece).
- **El Niño e La Niña:** nenhuma frase aparece para a melhor opção em nenhuma faixa (milho com braquiária no meio: El Niño 5 de 7 contra 11 de 13; La Niña 6 de 8 contra 10 de 12). Aparece para o **sorgo**: no meio, "Em anos de El Niño, deu certo em 4 de 7; nos outros anos, em 11 de 13."; na colheita tarde, "Em anos de La Niña, deu certo em 6 de 8; nos outros anos, em 5 de 12."
- **Objetivos (meio):** equilíbrio = milho com braquiária, plano milho com braquiária → milho com braquiária → crotalária (o mesmo Plano A de antes: nas 3 faixas, o Plano A não mudou com a regra de começar pela melhor opção); segurança = crotalária (19 de 20), plano crotalária → milho com braquiária → crotalária; renda = milho com braquiária nos 3 anos; terra = crotalária nos 3 anos. Na colheita tarde: equilíbrio milheto → milheto → sorgo; segurança e terra milheto nos 3 anos; renda sorgo nos 3 anos.
- **O que observar (meio, milho com braquiária):** veranico típico de 9 dias na fase crítica; nenhum ano com 3 dias de 35 °C nessa fase; fim das chuvas até 21/abr em metade dos anos.
- **Explorador (meio, milho com braquiária):** os anos que falharam têm ISNA de 0,33 (2016), 0,38 (2021), 0,49 (2010) e 0,51 (2022).

## 6. Decisões

D67 a D80 em `projeto/backend/docs/remodelagem.md`.

## 7. Riscos e o que ficou de fora

- **Irrigação (item opcional da 5.3)** não foi feita: atrás de uma opção desligada, sem dado de quem irriga; fica para a S5b ou depois.
- **Clima 2041–2060 e geada** têm cálculo próprio desta seção (grupos `clima_futuro_sugestao` e `geada_sugestao`): a S4 faz o mesmo no raio-X; unificar na S9.
- **O plano dos objetivos tende a repetir a cultura** (renda: milho com braquiária nos 3 anos; terra: crotalária nos 3): o PRD 7.7 não pune repetição. A S5b mostra a repetição como fato.
- **Comparar e Plano** só ganharam o objetivo, a imagem, o selo e (no Comparar) a linha Água; o resto é da S5b. O botão "Como teria sido em 2024?" do Plano agora abre o detalhe de 2024 no explorador (a S5b tira o botão).
- **Chaves de i18n antigas** (`report`, `past`, `answerTabs.answer`/`options`) ficaram sem uso, pela regra de só acrescentar no i18n enquanto a S4 roda; limpar na S9.
