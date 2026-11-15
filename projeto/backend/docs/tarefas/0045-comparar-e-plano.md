# Tarefa 0045: Abas Comparar e Plano de 3 anos (remodelagem S5b)

- **Identificador:** `0045`
- **Título:** Comparar com até 3 culturas lado a lado e Plano de 3 anos editável, com as notas na hora (`GET /api/plano`), a saúde da terra da rotação, a chuva aproveitada, o "Como é hoje" com o NDVI e a resposta do produtor, e o Plano A / Plano B com o número de "secar" derivado da série
- **Status:** Concluída na branch `feat/remodelagem-s5b-plano` (falta o merge em `feat/remodelagem` e a revisão)
- **Prioridade:** Alta (seção 5 da remodelagem, itens 5.5 e 5.6; S5b)
- **PRD:** RF-32 (novo) e nota no PRD 7.7
- **Módulos Afetados:**
  - backend: `app/config_data/regras.yaml` (grupos `plano_b` e `chuva_aproveitada`), `app/models/regras.py`, `app/repositories/rules_repository.py`, `app/models/recomendacao.py` (`AguaOpcao.usa_mm`), `app/services/water_need_service.py`, `app/models/plano.py` (novo), `app/services/plan_b_service.py` (novo), `app/services/plan_evaluation_service.py` (novo), `app/schemas/plano.py` (novo), `app/controllers/plano_controller.py` (novo), `app/dependencies.py`, `app/main.py`;
  - front: `models/plano.ts` (novo), `repositories/planoRepository.ts` e `mocks/mockPlano.ts` (novos), `repositories/index.ts`, `services/cropListParams.ts`, `compareService.ts` e `planService.ts` (novos), `services/flowParams.ts`, `controllers/useAnswerNav.ts`, `useOptionsController.ts`, `usePlanController.ts`, `views/OptionsView.tsx` e `PlanView.tsx` (refeitas), `views/AnswerView.tsx` (sem "Se você prefere…"), `views/CommunityForms.tsx` (`QuestionChips` exportado), `design-system/components/Compare.tsx` (novo: `CropPicker`, `CompareTable`), `Choice.tsx` (`SelectField`), `Card.tsx` (`AlternativeCard.action`), `pages.tsx`, `i18n/messages.{pt,en}.ts` (blocos novos `compare` e `rotation`).
- **Referências:** `arquivos contexto/prompt-raiz-orbital.md` (seção 5, itens 5.5 e 5.6; tabela de links da seção 8), `projeto/backend/docs/remodelagem.md` (D110 a D122), tarefas 0038 (sinal do outono), 0039 (safras confirmadas), 0044 (aba Sugestão) e 0047 (comunidade)

---

## 1. O que foi feito

### 5.5 Aba Comparar

- **Chips das culturas** (`CropPicker`): imagem da planta, nome e selo de sede; tocar põe ou tira (no máximo 3, nunca nenhuma). **Por padrão, as 3 melhores para o objetivo** (a ordem do motor, `objetivos`). Fora da janela de plantio: o chip fica desligado, tracejado, com "Passou do prazo (28 de fevereiro)".
- **Colunas lado a lado** (`CompareTable`, uma `<table>` com o rótulo da linha em cima das células, para 3 colunas caberem em 390 px sem rolar a página): deu certo em X de 20 anos (com o rótulo), por que falhou (anos por falta de água e anos por calor, do explorador do motor), água (precisa, chove, falta e o ano seco), clima 2041–2060 ("Daria certo em X de 20 anos (média dos modelos)" e a faixa entre os modelos), renda, terra (palhada, nitrogênio, nematoide, a frase do motor), prazo para plantar, "Por que usar" e "Por que evitar", "Saiba mais" (artigo da cultura) e "Usar no meu plano". Linha sem dado em nenhuma coluna não aparece.
- **"Por que usar" e "Por que evitar"** saem das notas do motor, pelos rótulos que o backend já calcula (cortes do `regras.yaml`): usar = chuva Bom, grão com renda Bom, terra Bom, pouca sede; evitar = chuva Fraco, sem grão, terra Fraco, muita sede, e menos anos bons em 2041–2060 que hoje. Nenhum corte novo no navegador.
- **"Se você prefere…"** saiu da Sugestão e abre o Comparar: cada cartão tem "Comparar [cultura] com a sugestão", que põe a alternativa ao lado da 1ª opção do objetivo.
- **"Usar no meu plano"** leva para o Plano com a cultura no ano 1 (os anos 2 e 3 do plano atual ficam).
- Links da linha Terra: Palhada, Adubo verde e Nematoide.

### 5.6 Aba Plano de 3 anos

- **Montar a rotação:** cada ano tem a imagem, o selo de sede, "Deu certo em X de 20 anos" e a lista "O que plantar em [ano]" com as culturas que cabem na janela (na ordem do objetivo) e "Deixar parado". As **notas do plano recalculam na hora** pelo `GET /api/plano` (endpoint novo, D110), **ao lado do "Como é hoje"**: segurança climática, saúde da terra e clima 2041–2060 (0 a 100; o último resultado fica na tela com "Recalculando…" enquanto o novo chega). "Voltar ao plano sugerido" só aparece com o plano mudado.
- **Saúde da terra da rotação** com fatos: anos com a terra coberta, anos que deixam nitrogênio, anos que quebram o ciclo do nematoide, a cultura repetida, e os pontos do bônus de diversidade.
- **Chuva aproveitada:** "Com a terra parada, X mm de chuva por ano caem sem virar grão nem palha. Com o plano, a lavoura usa Y mm.", cada ano do plano ("2027, milho com braquiária: a planta usa 221 mm"; "2028, deixar parado: 413 mm caem sem cultura"), o "Como é hoje" e a nota com a fonte certa (GPM IMERG, ou "GPM IMERG + NASA POWER" quando a série mistura) e o gasto da lavoura do NASA POWER. No pousio, só a chuva que caiu sem cultura (nada de evaporação estimada).
- **"Como é hoje"** com o NDVI das 3 últimas safras (`anos_confirmaveis` do `/talhao`) e as safras confirmadas na tela 4: "O satélite viu plantio na entressafra de 2024, 2025 e 2026. O que foi?", com o que o satélite viu e o verde máximo do MODIS em cada ano, e "O que foi em [ano]?" com as culturas do relato de plantio da S7 (sem "outra", com "Deixei parado"). Ano parado já vale como "Deixei parado". Sem NDVI para o ponto, pergunta direto. Com as 3 conhecidas, "Como é hoje" é essa sequência; sem resposta, fica a referência do motor e a tela diz que é uma referência.
- **Plano A e Plano B**, uma frase cada: "Plano A: [cultura], se a chuva vier normal." e "Plano B: [cultura], se secar.", com "Nos N anos em que [A] falhou, [B] deu certo em M." "Secar" vira número do pluviômetro só se a série separar bem (abaixo); senão, a tela explica que não há número e manda usar o Plano B se a terra estiver seca no dia de plantar. Link "Saiba mais: Veranico".
- **Sinal para o outono** (RF-20) continua (previsão do ENSO, motivo, SMAP de agora). Saíram a escolha "Plano A / Plano B" da linha do tempo, a regra antiga da data (30 dias antes da data limite, 60% da média) e o botão "Como teria sido em 2024?" (o detalhe de cada ano está no explorador da Sugestão, `/resposta?…&ano=2024`). O estudo ilustrativo do ganho na soja (só no modo de demonstração, sem fonte) também saiu.
- **Estado na URL:** `comparar=sorgo,milheto`, `plano=sorgo,pousio,milheto` e `hoje=2024:pousio,2025:sorgo` (sem codificar `:` e `,`), pelo `flowParams`, que os leva entre as abas. Trocar o objetivo limpa `comparar` e `plano`.

## 2. Contrato `GET /api/plano?lat&lon&anos=a,b,c[&colheita][&solo]`

`anos`: 3 ids do `culturas.yaml` (o pousio vale), separados por vírgula. Sem 3 culturas ou com cultura desconhecida: 422 `VALIDATION_ERROR`. Ponto sem dados: 404 `OUTSIDE_AREA`. Faixa ou solo inválidos: 422 `INVALID_REQUEST`. Sem cache HTTP. Números reais da lavoura de demonstração, colheita meio:

```json
{
  "colheita": "meio", "semeadura": "2027-02-18",
  "anos": [{"cultura": "milho_braquiaria", "nome": "Milho com braquiária", "na_janela": true,
            "anos_bons": 16, "total_anos": 20, "futuro_anos_bons": 16, "sede": "muita",
            "cobre_terra": true, "deixa_nitrogenio": false, "quebra_nematoide": false, "usa_mm": 221},
           "...", {"cultura": "crotalaria", "...": "...", "usa_mm": 206}],
  "notas": {"seguranca": 85.0, "solo": 71.7, "futuro": 85.0},
  "terra": {"anos_cobertos": 3, "anos_nitrogenio": 1, "anos_nematoide": 1,
            "repetidas": ["milho_braquiaria"], "total": 3, "bonus_diversidade": 10.0},
  "chuva": {"inicio": "2027-02-18", "fim": "07-31", "chuva_mm": 413, "usa_media_mm": 216, "anos": 20, "fonte": "gpm_imerg"},
  "plano_ab": {"cultura_a": "milho_braquiaria", "nome_a": "Milho com braquiária", "falhas_a": 4, "total": 20,
               "cultura_b": "crotalaria", "nome_b": "Crotalária", "b_bons_nas_falhas": 4,
               "limite": {"dias": 15, "chuva_mm": 42, "anos_marcados": 1, "falhas_marcadas": 0, "falhas": 4,
                          "total": 20, "chance_pct": 100.0, "separa": false, "motivo": "nao_separa"},
               "motivo": null}
}
```

- Fora da janela: `na_janela: false` e os números do motor `null` (os fatos da terra ficam); as médias usam só os anos avaliados e `usa_media_mm` fica `null`.
- `plano_ab.motivo` sem Plano B: `pousio` (o ano 1 é deixar parado), `nunca_falhou` ou `nenhuma_melhor`. `limite` vem sempre que a cultura do Plano A falhou (a análise inteira, para a transparência); o número só vai para a tela com `separa: true`.
- `/recomendacao` e `/exemplo` ganharam `agua.usa_mm` no model (mediana da ETr); o JSON deles não mudou.

## 3. Regras (todas no service, números no `regras.yaml`)

| Regra | Onde | Números (`regras.yaml`) |
| --- | --- | --- |
| Cada ano do plano = a conta do motor da cultura na faixa (`RecommendationService.recommend`, mesmo solo); nada é recalculado fora dele | `PlanEvaluationService.evaluate` | — |
| Segurança e clima 2041–2060 do plano = média das notas do motor nos anos com lavoura na janela; saúde da terra = média da nota de solo dos 3 anos (PRD 7.4, pousio 0) + bônus de diversidade (PRD 7.7), até 100 | `PlanEvaluationService._scores` | os da `rotacao` |
| Fatos da terra: coberta = palhada > 0; nitrogênio = `n_deixado_kg` > 0; quebra o nematoide = supressoras do PRD 7.7; repetida = cultura (sem o pousio) em mais de um ano | `PlanEvaluationService._soil_facts` | `rotacao.culturas_supressoras_nematoide` |
| Chuva aproveitada: mediana da chuva da semeadura ao fim de julho; "usa" = mediana da ETr do ciclo; média dos 3 anos (pousio 0) | `PlanEvaluationService._used_rain`, `WaterNeedService` | `chuva_aproveitada.fim` (07-31) |
| Plano B = a cultura na janela (sem o pousio) que mais deu certo nos anos em que a do Plano A falhou; desempate pela nota final | `PlanBService.plan_ab` | — |
| Limite de "secar": chuva dos 15 dias antes da semeadura (sem o dia); marca os k anos mais secos, fica o k com mais acertos − alarmes falsos (empate: menor k; nunca corta entre anos com a mesma chuva); limite = meio entre o k-ésimo e o seguinte | `PlanBService.rain_limit` | `plano_b.dias_antes_semeadura` (15) |
| "Separa bem" = 3 anos de falha ou mais, pega 50% das falhas ou mais, 60% dos anos marcados ou mais são falha, e a chance de pegar tantas falhas marcando o mesmo número de anos ao acaso (hipergeométrica) é de 10% ou menos | `PlanBService.rain_limit` | `anos_falha_min`, `sensibilidade_min_pct`, `precisao_min_pct`, `chance_max_pct` (hipótese do time) |

No front: `compareService.ts` (escolha, chips, por que falhou, usar/evitar), `planService.ts` (culturas de cada ano, plano da URL × sugerido, "Como é hoje", nome da fonte da chuva, cache do `/api/plano`) e `cropListParams.ts` (as três listas da URL).

## 4. Testes (TDD)

| Teste | Red |
| --- | --- |
| `test_water_need_service.py` (ETr mediana) | `AttributeError: 'AguaOpcao' object has no attribute 'usa_mm'` |
| `test_rules_repository.py` (grupos `plano_b` e `chuva_aproveitada`; número sem fonte) | 3 falhas (`AttributeError` e `KeyError`) |
| `test_plan_b_service.py` (14 casos) | `ModuleNotFoundError: app.services.plan_b_service` |
| `test_plan_evaluation_service.py` (17 casos) | `ModuleNotFoundError: app.services.plan_evaluation_service` |
| `test_plano_controller.py` (10 casos) | 10 falhas (404 na rota que não existia) |
| `flowParams.test.ts` (comparar, plano, hoje) | 5 falhas |
| `planoRepository.test.ts`, `compareService.test.ts`, `planService.test.ts` | módulos inexistentes; depois `COMPARE_ARTICLES`, `PLAN_ARTICLES` e `rainSourceName` indefinidos |
| `Compare.test.tsx`, `Card.test.tsx` (`action`), `Choice.test.tsx` (`SelectField`) | módulo inexistente / 1 falha / 1 falha |
| `useOptionsController.test.ts` | 6 de 7 falhas (controller antigo) |
| `OptionsView.test.tsx` | escrito antes da view nova (a antiga não tinha as props) |
| `AnswerView.test.tsx` ("Se você prefere…" saiu) | 1 falha |
| `usePlanController.test.ts` | 8 de 12 falhas |
| `PlanView.test.tsx` | 15 de 15 falhas contra a view antiga (conferido depois de escrever a nova: a view nova foi escrita antes de rodar o teste novo) |

Exceções: os testes de "Como é hoje com a mesma cultura nos 3 anos", "terra parada hoje não diz 0 mm" e "sem Plano B, sem a linha da fonte" vieram da conferência com dado real (os dois últimos com red; o primeiro escrito depois da correção). Os testes de rota (`routes.test.tsx`) foram ajustados junto com as telas.

Nada de rede nem banco nos testes unitários: recommender, clima e repositories falsos no backend; services e repositories falsos no front.

## 5. Números reais na lavoura de demonstração (−18,9543 / −48,1993; banco de revisão, IMERG em 20 de 20 anos)

| Colheita | Plano (sugerido) | Notas (seg / terra / 2041–2060) | Como é hoje (referência) | Chuva da semeadura a 31/jul | Usa (plano / hoje) | Plano A / B |
| --- | --- | --- | --- | --- | --- | --- |
| cedo (8/fev) | milho com braquiária × 3 | 90 / 55 / 90 | milho sozinho × 3 | 478 mm | 247 / 247 mm | A milho com braquiária (falhou 2 de 20); B crotalária (deu certo nos 2); **sem número**: poucas falhas |
| meio (18/fev) | milho com braquiária, milho com braquiária, crotalária | 85 / 72 / 85 | milho sozinho × 3: 80 / 20 / 80 | 413 mm | 216 / 221 mm | A milho com braquiária (falhou 4 de 20); B crotalária (4 de 4); **sem número**: não separa |
| tarde (3/mar) | milheto, milheto, sorgo | 85 / 53 / 85 | deixar parado × 3 (o milho não cabe): sem lavoura / 0 | 341 mm | 182 / — | A milheto, **sem Plano B**: deu certo nos 20 anos |

- **Limite de "secar" (chuva dos 15 dias antes da semeadura, GPM IMERG):**
  - meio, milho com braquiária: as falhas (2010, 2016, 2021 e 2022) tiveram 77, 102, 129 e 164 mm; os anos bons, de 31 a 181 mm. Nenhum limite acerta mais do que erra: o melhor marca 1 ano (2005, 31 mm, bom) e nenhuma falha. **Não separa.**
  - cedo: 2 falhas (2016: 112 mm; 2021: 54 mm), abaixo do mínimo de 3. **Sem número.**
  - tarde, sorgo (o 1º ano do plano "Renda"): 9 falhas; o melhor limite (100 mm) marca os 10 anos mais secos com 6 falhas: pega 67% das falhas e 60% dos marcados são falha (passa nas três primeiras condições), mas marcar 10 anos ao acaso pega 6 ou mais falhas em **18,5%** das vezes (> 10%). **Sem número.**
  - SMAP no dia de plantar (2016 em diante, 9 anos na série do motor): meio, as falhas tiveram 40%, 40% e 44% da água que a terra guarda, no meio dos anos bons (35% a 46%): também não separa (e o produtor não confere o SMAP no pluviômetro).
- **Saúde da terra (meio):** terra coberta nos 3 anos, 1 ano com nitrogênio (crotalária), 1 que quebra o nematoide, repete milho com braquiária, +10 de diversidade (71,7). Hoje (milho sozinho × 3): 20.
- **"Como é hoje" na lavoura de demonstração:** o satélite viu plantio nas 3 últimas entressafras (verde máximo 0,71 em 2024, 0,80 em 2025 e 0,89 em 2026); a tela pergunta "O que foi?" nos 3 anos e, sem resposta, usa a referência.
- **Tempo do `/api/plano`:** de 0,25 a 0,42 s (uma recomendação do motor por pedido); a tela pede o plano e o "Como é hoje".

## 6. Decisões

D110 a D122 em `projeto/backend/docs/remodelagem.md`.

## 7. Riscos e o que ficou de fora

- **Plano B × sinal do outono:** o sinal (RF-20) continua com o `plano_3_anos` do motor (o Plano B dele começa igual ao A na lavoura de demonstração). A frase do sinal fala da cultura do Plano A sugerido mesmo quando o produtor troca o ano 1. Unificar na S9.
- **Irrigação** (opcional da 5.3) e o "[A] no lugar de [B] economiza N mm" do Comparar: não feitos.
- **"Outra" cultura no "Como é hoje":** fora (o motor não avalia). Cultura respondida que não cabe na janela da faixa de agora entra sem números.
- **Sem uso no front** (limpar na S9): `buildPlan`, `planSwaps`, `planSummary`, `initialScenario`, `plantingRule`, `optionsSummary`, `buildAnswer` (`recomendacaoRules.ts`), `optionsForObjective` (`suggestionService.ts`), `PAST_YEARS` e as chaves `plan.*` antigas. No backend, o `regra_dia_plantar` do sinal segue na API sem uso na tela.
