# Tarefa 0056: Motor da tela 5 do pacote 2 ("Escolher" + "Plano de 3 anos")

- **Identificador:** `0056`
- **Título:** Culturas fora do prazo do ZARC também na conta, sugestão em cadeia do plano de 3 anos com o porquê de cada ano e os campos do "E se o ano vier seco?"
- **Status:** Concluída
- **Prioridade:** Alta (pacote 2, tela 5)
- **PRD:** RF-39 (nova)
- **Módulos Afetados:** `app/services/recommendation_service.py`, `app/models/recomendacao.py`, `app/schemas/recomendacao.py`, `app/services/rotation_plan_service.py`, `app/services/plan_suggestion_service.py` (novo), `app/services/plan_evaluation_service.py`, `app/models/plano.py`, `app/schemas/plano.py`, `app/controllers/plano_controller.py`, `app/config_data/regras.yaml` (grupos `plano_cadeia` e `frases_plano`), `app/models/regras.py`, `app/repositories/rules_repository.py`
- **Referências:** `tela-5-escolher-plano-prompt.md` e `tela-5-escolher-plano.html` do pacote 2 (seções "Mudanças no motor e na API", "Aba 2 · Plano de 3 anos" e "Comparar até 3"), tarefas 0044 (objetivos), 0045 (`/api/plano`, Plano A/B) e 0049 (sinal do outono com o Plano A da tela)

---

## 1. O que foi feito

1. **Culturas fora do prazo do ZARC na conta.** O motor (`RecommendationService.recommend`) calcula todas as culturas com a mesma semeadura da faixa de colheita (logo depois da colheita, o "dia seguinte à colheita" do prompt). As que passaram do prazo continuam em `fora_da_janela[]` e agora também vêm com a conta inteira (chuva, água, anos, futuro, notas, porquê), num campo novo do model (`Recomendacao.opcoes_fora_do_prazo`, com `na_janela = False`). O `Recomendacao.opcoes` continua só com as no prazo: o custo do atraso, o raio-X, o replay (`/safra-passada`), os avisos e o sinal não mudam.
2. **`/recomendacao` e `/exemplo`:** cada opção ganha `fora_do_prazo` (= `!na_janela`); as fora do prazo entram em `opcoes[]` depois das no prazo (cada grupo da maior nota final para a menor). Em `objetivos[].ordem`, as fora do prazo vêm depois das no prazo, pela mesma regra do eixo.
3. **`/api/plano?anos=…`:** a cultura fora do prazo (em qualquer ano) vem com os números do motor e `fora_do_prazo: true`, em vez de `null`, e entra nas médias. O Plano A pode ser ela; o Plano B continua só entre as culturas no prazo (o `PlanBService` não mudou: recebe as no prazo mais a do 1º ano). O sinal do outono fala dela.
4. **Sugestão em cadeia:** `GET /api/plano/sugestao?lat&lon&fixos=a[,b][&colheita][&solo]`. O produtor fixa o 1º ano, ou o 1º e o 2º; o motor sugere os outros considerando os anteriores e devolve a avaliação do plano inteiro (o mesmo JSON do `/api/plano`), com o porquê de cada ano sugerido.
   - `RotationPlanService.best_plan_with_prefix`: o `best_plan_starting_with` generalizado para um prefixo fixo (mesmas sequências, restrições e nota do PRD 7.7; com só o 1º ano e sem a cadeia, o plano é o mesmo de antes, conferido em teste). O prefixo pode ter uma cultura fora do prazo; os anos sugeridos só usam as no prazo e o pousio.
   - Com `chain=True`, soma em cada ano sugerido os pontos das regras da cadeia (`transition_rules` / `transition_bonus`, grupo `plano_cadeia`).
   - `PlanSuggestionService` monta os 3 anos e escreve o porquê (grupo `frases_plano`, pt/en).
5. **"E se o ano vier seco?"**: conferido o que o front já tem no `/api/plano` (seção 5). Nada mudou no `PlanBService`.
6. **"Escolha atual"** (a intenção da safra 2026/27 do raio-X): só do front, sem API.

## 2. Contrato final (números reais da lavoura de demonstração, −18,9543 / −48,1993, banco local com IMERG, 15/11/2026)

### 2.1 `/recomendacao` e `/exemplo`: `opcoes[].fora_do_prazo`

Campo novo `fora_do_prazo: boolean` em cada opção (opcional no front: ausente = `false`). Colheita tarde (semeadura 3/mar), `opcoes[]` em ordem: milheto, sorgo (no prazo), crotalária, milho com braquiária, milho sozinho (fora do prazo). Uma fora do prazo, resumida:

```json
{"id": "crotalaria", "nome": "Crotalária", "na_janela": false, "fora_do_prazo": true,
 "data_limite": "2027-02-28",
 "chuva": {"anos_bons": 20, "anos": 20, "faixa": [true, "…"], "rotulo": "bom", "texto": "Deu certo em 20 de 20 anos"},
 "notas": {"seguranca": 100.0, "futuro": 100.0, "solo": 85.0, "renda": 0.0, "final": 66.2},
 "…": "agua, renda, terra, porque, como_fazer, anos_detalhe, criterio, ciclo, observar, enso_acerto como as outras"}
```

```json
"melhor": "milheto",
"objetivos": {"equilibrio": {"ordem": ["milheto", "sorgo", "crotalaria", "milho_braquiaria", "milho_safrinha"],
                             "plano": ["milheto", "milheto", "sorgo"], "nota_plano": 60.9}, "…": "…"},
"fora_da_janela": [{"id": "crotalaria", "nome": "Crotalária", "data_limite": "2027-02-28",
                    "texto": "Crotalária: o plantio vai só até 28/02 (ZARC), e com a colheita no fim de fevereiro ou em março não dá tempo."}, "…"]
```

- **`data_limite`**: o pedido falava em "MM-DD", mas o campo **já existia** em toda opção no formato `AAAA-MM-DD` do ano de referência (`"2027-02-28"`) e o front atual faz `formatDayMonth` nele. Ficou como estava, para não quebrar o front: o MM-DD é `data_limite.slice(5)`.
- Colheitas cedo e meio na lavoura de demonstração: nenhuma cultura fora do prazo (`fora_do_prazo: false` em todas, `fora_da_janela: []`).
- O JSON da colheita tarde cresce ~60% (3 opções a mais com o detalhe de 20 anos; 55,9 KB sem compressão).

### 2.2 `/api/plano?anos=a,b,c`: campos novos em `anos[]`

`fora_do_prazo` (bool), `fixo` (bool; aqui sempre `true`) e `motivo` (string ou `null`; aqui sempre `null`). Colheita tarde, as 3 últimas safras do protótipo ("Como é hoje": milho com braquiária, milho sozinho, deixar parado):

```json
{"anos": [{"cultura": "milho_braquiaria", "nome": "Milho com braquiária", "na_janela": false, "anos_bons": 13, "total_anos": 20,
           "futuro_anos_bons": 12, "sede": "muita", "cobre_terra": true, "deixa_nitrogenio": false, "quebra_nematoide": false,
           "usa_mm": 184, "fora_do_prazo": true, "fixo": true, "motivo": null},
          {"cultura": "milho_safrinha", "…": "…", "anos_bons": 13, "usa_mm": 184, "fora_do_prazo": true, "fixo": true, "motivo": null},
          {"cultura": "pousio", "nome": "Deixar parado", "na_janela": true, "anos_bons": null, "…": "…", "fora_do_prazo": false, "fixo": true, "motivo": null}],
 "notas": {"seguranca": 65.0, "solo": 28.3, "futuro": 60.0},
 "chuva": {"inicio": "2027-03-03", "fim": "07-31", "chuva_mm": 341, "usa_media_mm": 123, "anos": 20, "fonte": "gpm_imerg"},
 "plano_ab": {"cultura_a": "milho_braquiaria", "nome_a": "Milho com braquiária", "falhas_a": 7, "total": 20,
              "cultura_b": "milheto", "nome_b": "Milheto", "b_bons_nas_falhas": 7,
              "limite": {"dias": 15, "chuva_mm": 100, "anos_marcados": 10, "falhas_marcadas": 5, "falhas": 7, "total": 20,
                         "chance_pct": 17.5, "separa": false, "motivo": "nao_separa"}, "motivo": null}}
```

Antes desta tarefa, esse mesmo pedido dava `anos_bons: null` nos dois milhos, `seguranca: null`, `usa_media_mm: null`, `plano_ab: null` e `sinal: null`. Planos só com culturas no prazo não mudam (meio, `milho_braquiaria,milho_braquiaria,crotalaria`: 85 / 71,7 / 85, os números da tarefa 0045).

### 2.3 `GET /api/plano/sugestao?lat&lon&fixos=a[,b][&colheita][&solo]` (novo)

- `fixos`: 1 ou 2 ids do `culturas.yaml` (o pousio vale; uma cultura fora do prazo vale), separados por vírgula.
- Resposta: **o mesmo JSON do `/api/plano`** para o plano completado, com `anos[].fixo` (`false` nos anos sugeridos) e `anos[].motivo` (a frase pronta, só nos sugeridos, no idioma do `Accept-Language`, sem o nome da cultura: a tela mostra o nome logo antes).
- Erros: sem 1 ou 2 anos fixos, ou cultura desconhecida: 422 `VALIDATION_ERROR`; sem `fixos`, faixa ou solo inválidos: 422 `INVALID_REQUEST`; ponto sem dados: 404 `OUTSIDE_AREA`. Sem cache HTTP; ~0,4 s (uma recomendação do motor por pedido).
- **Por que um endpoint e não um campo do `/api/plano`:** cada troca de ano na tela precisa da sugestão **e** da avaliação; com o JSON do `/api/plano` na resposta, é um pedido só. O `/api/plano` continua com `anos` obrigatório (o front atual não muda) e serve para a troca do 3º ano (nada a sugerir).

Colheita tarde, o caso do protótipo ("Você mudou 2027/28 para Deixar parado"), `fixos=sorgo,pousio`:

```json
{"colheita": "tarde", "semeadura": "2027-03-03",
 "anos": [{"cultura": "sorgo", "nome": "Sorgo", "na_janela": true, "anos_bons": 11, "total_anos": 20, "futuro_anos_bons": 11,
           "sede": "media", "cobre_terra": true, "deixa_nitrogenio": false, "quebra_nematoide": false, "usa_mm": 183,
           "fora_do_prazo": false, "fixo": true, "motivo": null},
          {"cultura": "pousio", "nome": "Deixar parado", "na_janela": true, "anos_bons": null, "total_anos": null,
           "futuro_anos_bons": null, "sede": null, "cobre_terra": false, "deixa_nitrogenio": false, "quebra_nematoide": false,
           "usa_mm": null, "fora_do_prazo": false, "fixo": true, "motivo": null},
          {"cultura": "milheto", "nome": "Milheto", "na_janela": true, "anos_bons": 20, "total_anos": 20, "futuro_anos_bons": 20,
           "sede": "pouca", "cobre_terra": true, "deixa_nitrogenio": false, "quebra_nematoide": true, "usa_mm": 182,
           "fora_do_prazo": false, "fixo": false, "motivo": "a terra ficou descoberta; cobre rápido e aguenta a seca"}],
 "notas": {"seguranca": 77.5, "solo": 35.0, "futuro": 77.5},
 "terra": {"anos_cobertos": 2, "anos_nitrogenio": 0, "anos_nematoide": 1, "repetidas": [], "total": 3, "bonus_diversidade": 5.0},
 "chuva": {"inicio": "2027-03-03", "fim": "07-31", "chuva_mm": 341, "usa_media_mm": 122, "anos": 20, "fonte": "gpm_imerg"},
 "plano_ab": {"cultura_a": "sorgo", "nome_a": "Sorgo", "falhas_a": 9, "total": 20, "cultura_b": "milheto", "nome_b": "Milheto",
              "b_bons_nas_falhas": 9,
              "limite": {"dias": 15, "chuva_mm": 100, "anos_marcados": 10, "falhas_marcadas": 6, "falhas": 9, "total": 20,
                         "chance_pct": 18.5, "separa": false, "motivo": "nao_separa"}, "motivo": null},
 "sinal": {"nivel": "seco",
           "motivo": "Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA). Nos 7 anos de El Niño desde 2005, sorgo deu certo em 3 e milheto em 7.",
           "fonte": ["NOAA", "GPM IMERG", "SMAP"], "data": "2026-11-12",
           "smap_agora": {"percentil": 59, "data": "2026-11-10",
                          "texto": "Sua terra está um pouco mais úmida que o normal agora (SMAP, percentil 59, 10/11/2026)."}}}
```

Em inglês (`Accept-Language: en`), o mesmo 3º ano: `"motivo": "the soil was left bare; it covers it fast and handles drought"`.

Colheita tarde, 1º ano fora do prazo (`fixos=milho_braquiaria`), resumido:

```json
{"anos": [{"cultura": "milho_braquiaria", "na_janela": false, "anos_bons": 13, "fora_do_prazo": true, "fixo": true, "motivo": null},
          {"cultura": "milheto", "na_janela": true, "anos_bons": 20, "fora_do_prazo": false, "fixo": false,
           "motivo": "quebra o ciclo do nematoide que o milho multiplica e aguenta a seca"},
          {"cultura": "sorgo", "na_janela": true, "anos_bons": 11, "fora_do_prazo": false, "fixo": false,
           "motivo": "dá grão para vender depois de um ano cuidando da terra"}],
 "plano_ab": {"cultura_a": "milho_braquiaria", "falhas_a": 7, "total": 20, "cultura_b": "milheto", "b_bons_nas_falhas": 7, "motivo": null},
 "sinal": {"nivel": "seco", "motivo": "Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA). Nos 7 anos de El Niño desde 2005, milho com braquiária deu certo em 3 e milheto em 7.", "…": "…"}}
```

**Como o front usa (tela 5, aba 2):**

| Ação na tela | Pedido |
| --- | --- |
| Abrir a aba / "Voltar ao plano sugerido" | `/api/plano/sugestao?fixos=<1º ano>` |
| Mudar o 1º ano | `/api/plano/sugestao?fixos=<novo 1º ano>` (refaz o 2º e o 3º; alerta "Seu 1º ano mudou…") |
| Mudar o 2º ano | `/api/plano/sugestao?fixos=<1º>,<2º>` (refaz o 3º; o alerta usa `anos[2].nome` e `anos[2].motivo`) |
| Mudar o 3º ano | `/api/plano?anos=<1º>,<2º>,<3º>` (nada a sugerir; a etiqueta "Você mudou" é do front) |
| "Como é hoje" | `/api/plano?anos=<as 3 últimas safras>` (agora com números também para as fora do prazo) |

O "Por quê:" do card e a coluna "Observação" do relatório são o `motivo` dos anos com `fixo: false`.

## 3. Regras (todas no service, números e frases no `regras.yaml`)

| Regra | Onde | `regras.yaml` |
| --- | --- | --- |
| Toda cultura (menos o pousio) com a conta do motor na semeadura da faixa; as fora do prazo ficam fora da sugestão, das alternativas e dos planos | `RecommendationService.recommend` | — |
| Ordem dos objetivos: no prazo pelo eixo (desempate pela final); depois as fora do prazo, na mesma regra | `RecommendationService._objectives` | — |
| Plano com prefixo fixo: as sequências `prefixo + anos sugeridos` (só no prazo + pousio), restrições do PRD 7.7 na sequência inteira, nota = média + diversidade (ano fixo sem nota conta 0, igual em todas) | `RotationPlanService.best_plan_with_prefix` | `rotacao` |
| Cadeia, em cada ano sugerido: milheto depois de um pousio **fixo** (o motor não sugere deixar parado para ganhar os pontos); supressora do nematoide depois do milho; nenhuma função repetida do ano anterior | `RotationPlanService.transition_rules`, `transition_bonus` | `plano_cadeia`: `bonus_cobrir_depois_do_parado` (10), `bonus_quebrar_nematoide_depois_do_milho` (5), `bonus_variar_funcao` (3), `culturas_cobertura_rapida` ([milheto]), `culturas_que_multiplicam_nematoide` ([milho_safrinha, milho_braquiaria]); supressoras e funções do grupo `rotacao` |
| Porquê, pela 1ª regra que pesou: cobrir depois do parado → quebrar o nematoide depois do milho → prazo (sem o prazo do ZARC, com o mesmo começo, uma cultura fora dele ganharia o ano) → variar a função (grão depois de cobertura, cobertura depois de grão, ou outra troca) → melhor nota; com a sede `pouca`, "e aguenta a seca" | `PlanSuggestionService._reason` | `frases_plano` (pt/en) |
| No `/api/plano`, a fora do prazo entra nas médias de segurança e clima futuro e na chuva aproveitada; Plano A = ela, Plano B só entre as no prazo | `PlanEvaluationService._assemble` | `plano_b` (sem mudança) |

Por que só milheto em "cobre rápido": a crotalária spectabilis começa devagar e a braquiária vem junto com o milho (hipótese do time). Por que 10 pontos: na colheita do meio de fevereiro, depois de milho com braquiária + parado, a crotalária ganha +5 a mais de diversidade que o milheto (3 funções); com menos de 7,5 pontos ela ficaria.

## 4. Números reais na lavoura de demonstração (`/api/plano/sugestao`, 15/11/2026)

| Colheita | Fixos | Sugerido (porquê) |
| --- | --- | --- |
| tarde | sorgo | milheto ("milho com braquiária passou do prazo do ZARC (28/02); esta cabe no prazo (até 15/03) e aguenta a seca"), sorgo ("dá grão para vender depois de um ano cuidando da terra") — o mesmo plano do protótipo |
| tarde | sorgo, parado | milheto ("a terra ficou descoberta; cobre rápido e aguenta a seca") — o caso do prompt |
| tarde | milheto | sorgo ("milho sozinho passou do prazo do ZARC (28/02); esta cabe no prazo (até 20/03)"), milheto ("cuida da terra depois de um ano de grão e aguenta a seca") |
| tarde | milho com braquiária (fora do prazo) | milheto ("quebra o ciclo do nematoide que o milho multiplica e aguenta a seca"), sorgo |
| tarde | crotalária (fora do prazo) | milheto (prazo), sorgo |
| tarde | parado | milheto (cobrir depois do parado), sorgo |
| meio | milho com braquiária | crotalária (nematoide + aguenta a seca), milho com braquiária (grão depois de cobertura) |
| meio | milho com braquiária, parado | milheto (cobrir depois do parado) |
| meio | milho sozinho | crotalária, milho com braquiária |
| cedo | milho com braquiária | crotalária, milho com braquiária |

- **Os números das culturas no prazo não mudaram** nas 3 faixas (conferido contra o `/recomendacao` de antes: notas, melhor, alternativas, os 3 planos, os planos dos objetivos e o sinal iguais).
- **Fora do prazo na colheita tarde** (3/mar): crotalária 20 de 20 anos, nota final 66,2 (maior que a do milheto, a sugestão: 58,8); milho com braquiária e milho sozinho 13 de 20 (60,5 e 53,0).
- **A cadeia não muda o Plano A** do `/recomendacao` nem os planos de `objetivos` (a regra deles é a da tarefa 0044). Por isso, com o mesmo 1º ano, a aba 2 pode sugerir outro 2º/3º ano que o `objetivos.equilibrio.plano`: meio, milho com braquiária → cadeia: crotalária, milho com braquiária; `plano_3_anos.normal`: milho com braquiária, crotalária. Na cedo, o Plano A repete milho com braquiária nos 3 anos; a cadeia sugere crotalária no meio.

## 5. "E se o ano vier seco?": o que o front usa

Tudo vem do `/api/plano` (ou `/api/plano/sugestao`) do plano que a tela mostra:

| Pedaço da tela | Campo |
| --- | --- |
| "Sinal para o outono de 2027: El Niño (98% de chance)", da NOAA CPC | `sinal.motivo` (1ª frase: "Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA)."), `sinal.fonte[0]`, `sinal.data`, `sinal.nivel` (`seco` / `normal` / `incerto`) |
| "Nos 7 anos de El Niño desde 2005, {cultura do 1º ano} deu certo em N" | `sinal.motivo` (2ª frase, já com o nome da cultura do 1º ano e, quando o nível é `seco`, a do Plano B: "… sorgo deu certo em 3 e milheto em 7.") |
| Conferir o sinal e a umidade em fevereiro | `sinal.smap_agora` (`percentil`, `data`, `texto`); o resto é texto do front |
| Plano A ("se a chuva vier normal") | `plano_ab.cultura_a`, `plano_ab.nome_a`, `plano_ab.falhas_a`, `plano_ab.total` |
| Plano B ("se em fevereiro o sinal for de ano seco e a terra estiver seca") | `plano_ab.cultura_b`, `plano_ab.nome_b`, `plano_ab.b_bons_nas_falhas`; o número de "secar" só com `plano_ab.limite.separa: true` |
| "Não precisa: … já é a que mais aguenta seca" | `plano_ab.motivo`: `pousio` (1º ano parado) ou `nunca_falhou` (deu certo nos 20 anos: milheto na tarde); `nenhuma_melhor` = nenhuma outra deu mais certo nos anos em que a do 1º ano falhou |

**O que falta (não feito, só se o front precisar):**
- O `sinal` não tem campos separados para a fase prevista, a chance, o ano da estação, os anos da fase e os anos bons: está tudo no `sinal.motivo` (duas frases). Se a tela quiser montar o título e a frase separados, o caminho é acrescentar ao `SinalOutono` (aditivo) `fase`, `chance_pct`, `estacao`, `ano`, `anos_fase`, `bons_a` e `bons_b`.
- O protótipo fixa "Plano B = milheto"; a API calcula o Plano B pela série (a cultura que mais deu certo quando a do Plano A falhou). Na lavoura de demonstração dá milheto na tarde e crotalária na cedo e no meio. O front deve usar `plano_ab`, não o milheto fixo.
- Com `sinal: null` (sem a previsão do ENSO), o bloco fica só com o Plano A / Plano B.

## 6. Testes (TDD)

| Teste | Red |
| --- | --- |
| `test_rules_repository.py` (grupos `plano_cadeia` e `frases_plano`; número sem fonte) | 5 falhas (`AttributeError`, `KeyError`) |
| `test_recommendation_service.py`: fora do prazo avaliada na mesma semeadura; os mesmos números que teria no prazo; sugestão, alternativas e planos só com as no prazo, `ordem` com as fora depois; nada fora do prazo quando tudo cabe; notas do pousio | 5 falhas (`AttributeError: opcoes_fora_do_prazo` / `notas_pousio`); a guarda "não muda os números das no prazo" já passava |
| `test_recomendacao_controller.py`: `opcoes[].fora_do_prazo` e a ordem; o teste da colheita tarde ajustado | 4 falhas (`KeyError: 'fora_do_prazo'`, `ordem` × `opcoes`) |
| `test_rotation_plan_service.py`: prefixo de 1 ano sem cadeia = plano de antes (24 casos), 2 anos fixos, fixo fora das opções, 3º pousio seguido, nematoide com prefixo, `transition_rules` (10 casos), cobrir depois do parado, nematoide depois do milho, pontos das regras injetadas | 25 falhas (`AttributeError`) |
| `test_rotation_plan_service.py`: não sugerir parado para cobrir depois (achado ao montar os testes do porquê) | `('sorgo', 'pousio', 'milheto') != ('sorgo', 'milheto', 'sorgo')` |
| `test_plan_suggestion_service.py` (12 casos: os do prompt, inglês, prazo, variar, melhor nota, nematoide, frases injetadas, 0 ou 3 fixos) | `ModuleNotFoundError`; depois 2 falhas por dado de teste (o ano anterior fora das opções), que viraram o retorno para a frase genérica |
| `test_plan_evaluation_service.py`: 1º ano fora do prazo com números, Plano A/B e sinal; anos fixos; `suggest` igual ao `evaluate` do plano completado; trocar o 1º ano; fora do prazo no 1º ano; recusa | 9 falhas (`AttributeError`) |
| `test_plano_controller.py`: campos novos; fora do prazo com os números do `/recomendacao`; `/plano/sugestao` igual ao `/plano` do plano completado; idioma; recusas; 404 | 9 falhas (chaves e 404 na rota nova) |

`uv run pytest`: 1834 passaram (70 pulados sem banco); com `TEST_DATABASE_URL`, 1904. `ruff check` e `ruff format --check` limpos.

## 7. Decisões (a revisar)

- **Fora do prazo fora da sugestão:** a sugestão, as alternativas e os planos sugeridos só com culturas no prazo (o seguro não cobre); elas aparecem na comparação e podem ser escolhidas, com o aviso. `fora_da_janela[]` continua para o front atual.
- **`Recomendacao.opcoes` continua só com as no prazo** (campo novo `opcoes_fora_do_prazo` no model); o JSON junta as duas. Assim nenhum outro service muda de comportamento.
- **`data_limite` continua `AAAA-MM-DD`** (seção 2.1).
- **No `/api/plano`, a fora do prazo entra nas médias** (o produtor escolheu plantar; o risco conta). O "Como é hoje" com safras fora do prazo passa a ter nota.
- **Endpoint `/api/plano/sugestao`** com o JSON do `/api/plano` (seção 2.3).
- **A cadeia não muda o Plano A nem os planos de `objetivos`** (seção 4): mudar o `best_plan_starting_with` mudaria o que o front em produção mostra; a aba 2 nova usa só a cadeia. Unificar quando o front novo entrar (decisão do time).
- **"Cobrir depois do parado" só depois de um parado fixo** (senão o motor sugeria deixar parado para ganhar os pontos no ano seguinte).
- **O "prazo" como porquê** é contrafactual: a mesma conta com as culturas fora do prazo, com o mesmo começo, escolheria outra cultura (fora do prazo) naquele ano.
- **O porquê sem o nome da cultura** (a tela mostra o nome antes): evita artigo e gênero em português.

## 8. A revisar pela agrônoma

- Os pontos da cadeia (10, 5 e 3) e as listas `culturas_cobertura_rapida` (só milheto) e `culturas_que_multiplicam_nematoide` (milho sozinho e milho com braquiária; o sorgo ficou de fora).
- Todas as frases do grupo `frases_plano` (pt e en), em especial "aguenta a seca" para toda cultura com sede pouca (crotalária e milheto) e o texto do prazo ("… passou do prazo do ZARC (28/02); esta cabe no prazo (até 15/03)").
- A prioridade entre as regras no porquê (parado → nematoide → prazo → função → nota).
- Os resultados das culturas fora do prazo plantadas em 3/mar (crotalária 20 de 20 anos na lavoura de demonstração): o motor usa o mesmo critério de pegamento de 30 dias da cobertura; o prazo do ZARC da crotalária (28/02) no `culturas.yaml` também é hipótese.

## 9. Riscos

- **Front atual com o `opcoes[]` maior:** o Comparar, a Sugestão e a missão filtram `na_janela` (sem mudança visível); a tela "Como a conta é feita" (`scoreRows`) lista todas as opções e passa a mostrar as fora do prazo junto (filtrar por `fora_do_prazo` no front novo). O "Como é hoje" do Plano atual ganha números para safras fora do prazo.
- **Fora do prazo que parece melhor que a sugestão** (crotalária 66,2 × milheto 58,8 na tarde): a tela precisa deixar claro o "Passou do prazo" e o seguro.
- **Duas regras de plano** (cadeia × objetivos/Plano A) até o time unificar.
- **`/safra-passada?opcao=<fora do prazo>`** continua 404 (o replay só tem as no prazo); o detalhe de cada ano das fora do prazo já vem em `opcoes[].anos_detalhe`.
- JSON da colheita tarde ~60% maior.
