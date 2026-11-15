# Tarefa 0042: Quando você colhe a soja (`/quando`)

- **Identificador:** `0042`
- **Título:** Dia da colheita no topo (já com o dia do satélite) e "Não sei o dia exato", sugestão = seleção, chuva que sobra depois da colheita (mediana e ano seco), chuva × ETo por mês, custo do atraso e fim das chuvas
- **Status:** Concluída na branch `feat/remodelagem-s3-quando` (falta o merge em `feat/remodelagem` e a revisão)
- **Prioridade:** Alta (seção 3 da remodelagem, S3)
- **PRD:** RF-02 e RF-16 (reescritos) e RF-27 (novo)
- **Módulos Afetados:**
  - backend: `app/config_data/regras.yaml` (grupos `colheita`, `chuva_que_sobra`, `fim_das_chuvas`), `app/models/regras.py`, `app/repositories/rules_repository.py`, `app/services/calendar_days.py`, `app/services/field_history_service.py`, `app/services/remaining_rain_service.py`, `app/services/rain_end_service.py`, `app/services/monthly_rain_service.py`, `app/services/talhao_service.py`, `app/services/harvest_delay_service.py`, `app/models/talhao.py`, `app/models/custo_atraso.py`, `app/schemas/talhao.py`, `app/schemas/custo_atraso.py`, `app/controllers/custo_atraso_controller.py`, `app/dependencies.py`, `app/main.py`, `app/constants.py`;
  - front: `models/talhao.ts`, `models/custoAtraso.ts`, `repositories/custoAtrasoRepository.ts`, `repositories/mocks/` (fixtures e mock do custo), `repositories/index.ts`, `services/harvestService.ts`, `services/rainLeftService.ts`, `services/monthlyRainService.ts`, `services/delayCostService.ts`, `controllers/useWhenController.ts`, `views/WhenView.tsx`, `design-system/components/Charts.tsx` (`RainLeftChart`, `RainEtoChart`), `pages.tsx`, `i18n/messages.{pt,en}.ts` (só o bloco `when`), `views/DesignSystemView.tsx` (tirou o "Colocar a data exata"), dois artigos do Guia.
- **Referências:** `arquivos contexto/prompt-raiz-orbital.md` (seção 3), `projeto/backend/docs/remodelagem.md` (D31 a D41), tarefas 0028 (chuva de cada mês), 0037 (soja recente) e 0048 (Guia)

---

## 1. O que foi feito

- **Novo layout da tela 3:** no topo, o campo "Dia da colheita", já preenchido com o dia em que a soja costuma secar pelo NDVI (`colheita_sugerida.dia`); abaixo, a faixa azul com o que o satélite viu e o link "Não sei o dia exato", que abre as três faixas (começo, meio e fim de fevereiro ou março). Saiu a opção "Colocar a data exata" da lista.
- **A data exata vira a faixa** pela regra que a tela já usava: até 10/fev (e janeiro) = cedo; de 11 a 20/fev = meio; depois do dia 20 ou março = tarde. A regra agora está no `regras.yaml` (grupo `colheita`) e vale também para a faixa sugerida pelo NDVI.
- **Sugestão = seleção** (a inconsistência da faixa azul): (1) o backend chamava de "meio" a soja que seca até 22/fev (`MID_HARVEST_DOY_LIMIT` = dia 53), enquanto a mesma data posta no campo virava "tarde"; agora o dia vem primeiro e a faixa sai dele pela mesma regra; (2) a faixa da URL (voltando da tela 4, ou o `colheita=meio` fixo do "Ver um exemplo pronto") deixava "Meio de fevereiro" marcado com a faixa azul dizendo "fim de fevereiro ou março… Já deixamos marcado". Agora a faixa azul só diz "Já deixamos esse dia no campo" quando o campo tem o dia do satélite; com outra faixa escolhida, ela só informa o que o satélite viu e oferece "Usar o dia do satélite". Testes: `test_should_suggest_the_band_of_the_suggested_day` (backend), `harvestSuggestion` "sugestão = seleção", `useWhenController` "já preenche o dia que o satélite viu e marca a faixa desse dia: sugestão = seleção" e a `WhenView` "com outra faixa escolhida, a faixa azul não diz que já marcou".
- **"Chuva que sobra depois da colheita"** (no lugar do gráfico "Chuva de cada mês"): frase "Colhendo em [data], sobram em média X mm; num ano seco, Y mm." e a curva da mediana (linha cheia) e do ano seco (tracejada) para todos os dias de colheita de 15/jan a 31/mar, com a marca no dia escolhido. Só com a faixa ("Não sei o dia exato"), a conta usa o dia de colheita da faixa no motor (PRD 7.1: semeadura = colheita + 3 dias; 5/fev, 15/fev e 28/fev). Fonte: GPM IMERG (nos anos sem IMERG, NASA POWER, citado como tal).
- **Chuva × gasto da lavoura (ETo) por mês**, de janeiro a junho, duas barras por mês (chuva cheia, gasto listrado) e o mês em que a chuva média fica menor que a ETo média com contorno e o texto "chove menos" (nada só por cor), mais a frase "Em abril, a chuva média fica menor que o que a lavoura gasta." Fontes: chuva do GPM IMERG e ETo calculada com o clima do NASA POWER (a mesma do balanço hídrico do motor).
- **Custo do atraso:** "Colhendo cedo, deu certo em A de 20 anos; no meio, B de 20; tarde, C de 20.", com os números do motor (a `melhor` do `/recomendacao` em cada faixa). Quando a melhor cultura muda, a frase diz qual é em cada faixa, e a lista marca "(sua escolha)" na faixa selecionada.
- **Fim das chuvas na célula:** "Em metade dos anos, a chuva acabou até [data]; o mais cedo foi [data de ano] e o mais tarde [data de ano].", com a regra escrita embaixo.
- **"Saiba mais"** para o Guia: "Quando a chuva acaba" (chuva que sobra e fim das chuvas), "A conta de água da lavoura" (chuva × ETo), "Plantar logo depois da colheita" e "O que significa 'deu certo'" (custo do atraso). Os artigos "Quando a chuva acaba" e "Plantar logo depois da colheita" foram escritos nesta tarefa (pt e en, 150 a 300 palavras, fontes já conferidas e reabertas em 15/11/2026).

## 2. Contratos

### `/api/talhao` (e o talhão do `/exemplo`): campos novos

```json
"colheita_sugerida": {"faixa": "tarde", "fonte": "ndvi_modis", "anos_usados": 10, "dia": "02-25"},
"chuva_mensal": {
  "meses": [{"mes": 4, "media_mm": 89.5, "eto_media_mm": 108.8}],
  "anos": [2005, "...", 2024], "fonte": "gpm_imerg",
  "fonte_eto": "nasa_power", "mes_chuva_abaixo_eto": 4
},
"chuva_que_sobra": {
  "fim": "06-30", "percentil_seco": 20,
  "dias": [{"dia": "01-15", "mediana_mm": 697.2, "seco_mm": 615.8}, "...", {"dia": "03-31", "mediana_mm": 141.3, "seco_mm": 87.0}],
  "anos": [2005, "...", 2024], "fonte": "gpm_imerg"
},
"fim_das_chuvas": {
  "mediana": "04-21", "mais_cedo": {"dia": "03-16", "ano": 2021}, "mais_tarde": {"dia": "06-22", "ano": 2012},
  "anos": [2005, "...", 2024], "fonte": "gpm_imerg", "inicio": "03-01", "dias": 20, "chuva_max_mm": 10.0
}
```

(números reais da fazenda da UFU, banco local de 15/11/2026). Todos os campos novos são opcionais no front (API antiga = o bloco não aparece) e `null` sem dado.

### `GET /api/custo-atraso?lat&lon[&solo][&confirmadas]` (novo)

```json
{"faixas": [
  {"colheita": "cedo", "semeadura": "2027-02-08", "melhor": "milho_braquiaria", "nome": "Milho com braquiária", "anos_bons": 18, "total_anos": 20},
  {"colheita": "meio", "semeadura": "2027-02-18", "melhor": "milho_braquiaria", "nome": "Milho com braquiária", "anos_bons": 16, "total_anos": 20},
  {"colheita": "tarde", "semeadura": "2027-03-03", "melhor": "milheto", "nome": "Milheto", "anos_bons": 20, "total_anos": 20}],
 "mesma_cultura": false}
```

Uma recomendação do motor por faixa, com o mesmo solo e as mesmas safras confirmadas. Faixa sem opção na janela de plantio: os campos da opção `null`. Ponto sem dados: 404 `OUTSIDE_AREA`; solo ou `confirmadas` inválidos: 422. Sem cache HTTP (são 3 recomendações: ~1 s na fazenda da UFU).

**Por que um endpoint, e não um campo do `/talhao`:** o custo roda o motor três vezes; o `/talhao` é pedido já na tela 2 e por várias telas, e ficaria lento. A chuva que sobra, a ETo e o fim das chuvas são contas leves da mesma série e foram para o `/talhao` (o raio-X da seção 4 também vai usar o fim das chuvas).

## 3. Regras (todas no service, números no `regras.yaml`)

| Regra | Onde | Números (`regras.yaml`) |
| --- | --- | --- |
| Dia sugerido: em cada ano, a primeira imagem de fev ou mar abaixo de 50% do pico; mediana dos dias num ano comum (29/fev = 28/fev), arredondada para baixo; a faixa sai do dia | `FieldHistoryService.suggest_harvest_band` e `harvest_band` | `ndvi.queda_colheita`, `colheita.cedo_ate` (02-10), `colheita.meio_ate` (02-20) |
| Chuva que sobra: para cada dia de `janela_inicio` a `janela_fim`, a chuva somada do dia até `fim` (inclusive) em cada ano que cobre a época inteira; mediana e percentil com interpolação linear entre os anos ordenados (posição (n − 1) × p / 100, o padrão do numpy) | `RemainingRainService` | `colheita.janela_inicio` (01-15), `janela_fim` (03-31), `chuva_que_sobra.fim` (06-30), `percentil_seco` (20) |
| Fim das chuvas: o primeiro dia, a partir de `inicio`, que começa `dias` dias seguidos com menos de `chuva_max_mm` mm **somados**; mediana arredondada para baixo (num ano comum), o mais cedo e o mais tarde com o ano. Ano sem esse dia dentro da série (até 31/jul): sem resultado | `RainEndService` | `fim_das_chuvas.inicio` (03-01), `dias` (20), `chuva_max_mm` (10) |
| ETo de cada mês: média entre os anos da ETo do motor (`ClimateRiskService.reference_eto`: a gravada ou Hargreaves-Samani); o mês em destaque é o primeiro em que a chuva média fica menor que a ETo média | `MonthlyRainService` | — |
| Custo do atraso: a `melhor` do `RecommendationService` em cada faixa, com os anos sem aperto | `HarvestDelayService` | os do motor |

## 4. Testes (TDD)

Cada teste foi escrito antes do código e visto falhando pelo motivo certo:

| Teste | Red |
| --- | --- |
| `tests/unit/repositories/test_rules_repository.py` (grupos novos e "sem fonte") | `AttributeError: 'Regras' object has no attribute 'colheita'` / `KeyError: 'colheita'` |
| `tests/unit/services/test_field_history_service.py` (dia sugerido, faixa do dia, mediana par, ano bissexto) | `AttributeError: 'FieldHistoryService' object has no attribute 'harvest_band'` e `'ColheitaSugerida' object has no attribute 'dia'` |
| `tests/unit/services/test_remaining_rain_service.py` (15 casos) | `ImportError: cannot import name 'ChuvaQueSobraDia'` |
| `tests/unit/services/test_rain_end_service.py` (9 casos) | módulo inexistente |
| `tests/unit/services/test_monthly_rain_service.py` (ETo) | `ChuvaMes.__init__() got an unexpected keyword argument 'eto_media_mm'`, `MonthlyRainService() takes no arguments` |
| `tests/unit/services/test_talhao_service.py` | `'Talhao' object has no attribute 'chuva_que_sobra'` / `'fim_das_chuvas'` |
| `tests/integration/controllers/test_talhao_controller.py` | `dia` faltando no contrato; `KeyError: 'eto_media_mm'`, `'chuva_que_sobra'`, `'fim_das_chuvas'` |
| `tests/unit/services/test_harvest_delay_service.py` | módulo inexistente |
| `tests/integration/controllers/test_custo_atraso_controller.py` (os números iguais aos do `/recomendacao` de cada faixa) | 404: a rota não existia |
| `repositories/custoAtrasoRepository.test.ts` | módulo inexistente |
| `services/harvestService.test.ts` (dia, sugestão = seleção, `bandDate`) | 7 falhas (sem `date`, faixa da API antiga, `bandDate is not a function`) |
| `services/rainLeftService.test.ts` | módulo inexistente |
| `services/monthlyRainService.test.ts` (ETo) | 3 falhas (sem `etoMm` nem `eto`) |
| `services/delayCostService.test.ts` | módulo inexistente |
| `controllers/useWhenController.test.ts` (20 casos) | 15 falhas (controller antigo) |
| `design-system/components/Charts.test.tsx` (`RainLeftChart`, `RainEtoChart`) | componentes indefinidos |
| `views/WhenView.test.tsx` (20 casos) | 18 falhas (tela antiga); depois, 2 (status enquanto carrega e a linha do custo) |

Nada de rede: o motor é falso nos testes do service; os de rota usam os repositórios falsos do `conftest.py`; no front, repositórios e services falsos. Dados de teste com valores redondos e chave de fonte `teste` (ou, onde o teste confere a fonte, a chave sem rótulo de dado real).

## 5. Números reais na fazenda da UFU (−18,9543 / −48,1993; banco local, IMERG em 20 de 20 anos)

- **Dia sugerido pelo NDVI:** 25/fev (10 anos), faixa "fim de fevereiro ou março" (a mesma de antes).
- **Chuva que sobra até 30/jun:** colhendo em 25/fev, 367 mm em média e 276 mm num ano seco; 5/fev: 498 e 421; 15/fev: 435 e 352; 28/fev: 351 e 244.
- **Chuva × ETo:** jan 289 × 134, fev 221 × 122, mar 207 × 122, **abr 90 × 109** (o mês em destaque), mai 34 × 100, jun 14 × 92 (mm).
- **Custo do atraso:** cedo, milho com braquiária 18 de 20; meio, milho com braquiária 16 de 20; tarde, milheto 20 de 20.
- **Fim das chuvas:** em metade dos anos até 21/abr; o mais cedo 16/mar (2021), o mais tarde 22/jun (2012).

## 6. Decisões

D31 a D41 em `projeto/backend/docs/remodelagem.md`.

## 7. Riscos e o que ficou de fora

- **O dia exato não vai para a URL:** voltando da tela 4, a URL traz só a faixa. Se ela é a do satélite, o campo volta com o dia do satélite (não com o dia que a pessoa digitou); se é outra, o campo fica vazio e a faixa fica marcada. Não mexemos no `flowParams` para não pisar na S2.
- **Custo do atraso compara culturas diferentes** quando a melhor muda de faixa (na UFU, tarde = milheto, uma cobertura com outro critério de "deu certo"): a frase diz a cultura de cada faixa, mas o "20 de 20" do fim pode parecer melhor que o começo. Ver "Números estranhos".
- **Fim das chuvas sensível a chuva solta:** a regra pega o primeiro trecho seco a partir de 1º/mar; um veranico em março conta como fim, e uma chuva de maio ou junho empurra o fim para longe (2012 na UFU).
