# Tarefa 0039: o produtor confirma as últimas safras e o histórico confere a soja de cada ano

- **Identificador:** `0039`
- **Título:** Confirmação das 3 últimas entressafras pelo produtor na tela 4 (`confirmadas` em `/talhao` e `/recomendacao`), checagem da soja em cada ano do histórico (`sem_soja`) e histórico de 2017 a 2026
- **Status:** Concluída
- **Prioridade:** Alta (decisão do usuário de 15/11/2026)
- **PRD:** RF-25 (e a nota da seção 7.8)
- **Módulos Afetados:** `app/config_data/regras.yaml`, `app/models/regras.py`, `app/models/talhao.py`, `app/services/field_history_service.py`, `app/services/region_service.py`, `app/services/talhao_service.py`, `app/services/recommendation_service.py`, `app/schemas/talhao.py`, `app/controllers/confirmadas_param.py`, `app/controllers/talhao_controller.py`, `app/controllers/recomendacao_controller.py`, `pipeline/fetch_ndvi.py`; no front, `models/talhao.ts`, `models/recomendacao.ts`, `services/confirmedSeasonsService.ts`, `services/satelliteService.ts`, `services/flowParams.ts`, `services/farmService.ts`, `repositories/recomendacaoRepository.ts`, `repositories/mocks/fixtures.ts`, `controllers/useSatelliteController.ts` (e os que pedem a recomendação), `controllers/useReportController.ts`, `views/SatelliteView.tsx`, `views/ReportView.tsx`, `design-system/components/Status.tsx`, `i18n/messages.{pt,en}.ts`
- **Referências:** [tarefa 0018](0018-historico-ndvi-na-api.md) (histórico do talhão), [tarefa 0036](0036-regiao-calibrada.md) (a soja do ano na região), [tarefa 0037](0037-soja-recente.md) (soja na safra mais recente, RF-24), `AGENTS.md` do backend ("NDVI do MODIS e histórico do talhão") e do front ("Safras confirmadas")

---

## 1. Descrição e Motivação

Decisões do usuário de 15/11/2026:

1. **Confirmação na tela 4** ("Pronto. O satélite já viu o resto."): o produtor confirma o que plantou
   depois da soja nas **3 últimas entressafras (2024, 2025 e 2026)**. Cada ano mostra o que o satélite
   viu, quando houver dado, e os botões "Plantei" / "Deixei parado". Ano sem dado do satélite começa
   vazio. A resposta do produtor **vale no lugar do satélite** naquele ano.
2. **Soja em cada ano** (a mesma regra da região e da soja recente): um ano só conta como entressafra
   depois da soja quando o pixel teve o pico (maior NDVI ≥ 0,70 de 1/jan a 15/mar) e a colheita
   (depois do pico, até 15/mai, alguma observação ≤ 0,40). A entressafra é classificada pela regra de
   hoje (`classify_year`) só com as observações depois da colheita até 31/jul. Sem pico ou sem
   colheita: `sem_soja`, que não conta como parado nem plantou.
3. **Janela de anos:** 10 anos, de **2017 a 2026**.

### Regra da soja num lugar só

A regra do pico e da colheita que a tarefa 0036 pôs no `RegionClassifier` passou para o
`FieldHistoryService` (`soy_harvest_date` e `post_harvest_values`, com os números do grupo
`regiao_ndvi`); o `RegionClassifier` só chama. O talhão usa a mesma regra em `classify_soy_year`:

| Situação do verão no pixel | Ano do talhão | Pixel da região |
| --- | --- | --- |
| nenhuma observação boa de 1/jan a 15/mar | `sem_dado` (não dá para dizer que não teve soja) | fora (como antes) |
| pico < 0,70 ou sem colheita até 15/mai | `sem_soja` | fora (como antes) |
| soja e colheita | `classify_year` com as observações depois da colheita até 31/jul | idem |

Com os dados reais (`ndvi_modis_appeears.json` de 15/11, 2017 a 2025; 2026 ainda sem dado):

| Ponto | Antes | Depois |
| --- | --- | --- |
| Fazenda de exemplo (−18,9543 / −48,1993) | — | plantou 9, 2026 sem dado |
| Uberlândia urbana (−18,9149 / −48,2568) | parado 10 de 10 | **sem soja 9**, 2026 sem dado |
| Cana ou pasto (−19,55 / −48,75) | plantou 10 | **sem soja 7**, plantou 2 (2022 e 2024), 2026 sem dado |
| Norte (−18,6 / −48,9) | — | plantou 5, sem soja 3, incerto 1, 2026 sem dado |

### Contrato

`/api/talhao?lat&lon[&confirmadas]` (e o talhão do `/exemplo`):

```json
"historico": {
  "anos": [{"ano": 2017, "situacao": "sem_soja", "ndvi_max": null, "n_obs": 0, "fonte_ano": "satelite"},
           {"ano": 2025, "situacao": "parado", "ndvi_max": 0.72, "n_obs": 3, "fonte_ano": "produtor"}],
  "parado": 4, "plantou": 4, "sem_certeza": 1, "sem_soja": 1, "total": 10,
  "fonte": "MODIS MOD13Q1 + MYD13Q1", "janela": "04-01 a 07-31"
},
"anos_confirmaveis": [2024, 2025, 2026]
```

- `sem_soja` (resumo) e `fonte_ano` (cada ano) têm padrão no schema (`0` e `"satelite"`); no front
  são opcionais (API antiga).
- `confirmadas=2024:plantou,2025:parado`: só as 3 últimas entressafras e só `plantou` / `parado`.
  Formato errado: 422 `INVALID_REQUEST` (o controller confere o formato); ano fora, valor errado ou ano
  repetido: 422 `VALIDATION_ERROR` (o service confere). Problem+json nos dois.
- No ano confirmado, `situacao` é a do produtor e `fonte_ano` é `"produtor"`; `ndvi_max` e `n_obs`
  continuam os do satélite. Sem série de NDVI e com alguma confirmação, o histórico sai só com elas
  (`fonte: "produtor"`, os outros anos `sem_dado`). Sem série e sem confirmação: `historico: null`.
- `/api/recomendacao?...&confirmadas=...`: a frase do histórico no "Por quê?" usa as confirmações;
  com alguma, o modelo é `frases.<língua>.historico_confirmado` ("... (você confirmou 1; o satélite
  viu 7, pelo NDVI do MODIS)."). Hoje só a frase lê o histórico: o pousio e o plano "hoje" ainda não.

### Regras no `regras.yaml`

- `historico_ndvi.ano_inicio` 2017 e `ano_fim` 2026 (fonte: decisão de 15/11/2026).
- `historico_ndvi.anos_confirmaveis` 3 (novo).
- `frases.pt.historico_confirmado` e `frases.en.historico_confirmado` (novos).
- O `pipeline/fetch_ndvi.py` lê os anos padrão do `historico_ndvi` (antes, constantes próprias). O
  `pipeline/fetch_regiao_ndvi.py`, que já lia, passa a pedir 2017 a 2026 na próxima rodada.

### Front (tela 4)

- No cartão do histórico, o bloco "Confirme as últimas safras": um `ChipGroup` por ano (grupo com o
  rótulo "Depois da soja de 2024", botões "Plantei" / "Deixei parado" com `aria-pressed`), com "O
  satélite viu: ..." quando houver dado. Tocar de novo na resposta marcada tira a confirmação.
- A escolha vai para a URL (`confirmadas=...`, legível) e daí para o `/recomendacao` de todas as telas
  seguintes; a faixa aplica as respostas na hora (sem recarregar o talhão) e a legenda diz "N anos
  confirmados por você". O relatório também aplica.
- `sem_soja`: quadrinho pontilhado com "–" e legenda "Sem soja". Nenhum ano com soja: o cartão diz
  "Não parece uma lavoura de soja. Confira o ponto no mapa." com "Ajustar no mapa".
- Sem histórico do satélite, o cartão continua "Ainda não conectado", com o bloco de confirmação.
- Fazenda de exemplo com safra confirmada: a recomendação vem do `/recomendacao` (o `/exemplo` é fixo).

---

## 2. Fluxo

```
Tela 4 ─► useSatelliteController
            ├─ farm.talhao (sem confirmadas: o que o satélite viu)
            ├─ confirmationRows(historico, anos_confirmaveis, confirmadas da URL) ─► bloco
            ├─ historySummary(applyConfirmations(historico, confirmadas)) ─► faixa e frase
            └─ confirmSeason(ano, valor) ─► URL ?...&confirmadas=2024:plantou,2025:parado
Telas 5 a 9 ─► farm.recomendacao({..., confirmadas}) ─► GET /api/recomendacao?...&confirmadas=...

GET /api/talhao | /api/recomendacao
  confirmadas_param.parse_confirmadas (formato) ─► pares
  FieldHistoryService.check_confirmations (anos e valores; 422) ─► {ano: resposta}
  FieldHistoryService.classify_entressafra(série, confirmadas)
     └─ por ano: classify_soy_year ─► soy_harvest_date / post_harvest_values (regiao_ndvi)
                                   └─ classify_year (historico_ndvi) ─► resposta do produtor por cima
  TalhaoService ─► historico + anos_confirmaveis | RecommendationService ─► frase do "Por quê?"
```

---

## 3. Sub-tarefas (TDD)

### 3.1 Janela de 2017 a 2026
- [x] Testes: `test_rules_repository.py` (anos do `historico_ndvi`) e `test_fetch_ndvi.py`
  (`FIRST_YEAR`/`LAST_YEAR` iguais ao `regras.yaml`).
- [x] Red: `assert (2016, 2025) == (2017, 2026)` nos dois.
- [x] Green: `regras.yaml` e `fetch_ndvi` lendo do `load_default_rules().historico_ndvi`. Os testes
  que dependiam da janela antiga (pipeline do NDVI, da região, services e rotas) passaram a usar
  2017 a 2026.

### 3.2 Soja de cada ano e `sem_soja`
- [x] Testes em `test_field_history_service.py` (sem pico, perene verde, queda depois de 15/mai, soja
  tardia verde em abril, verão sem observação = `sem_dado`, resumo com `sem_soja`, pico vindo do
  `regiao_ndvi`, `soy_harvest_date`), `test_recommendation_service.py` (frase sem os anos sem soja;
  nenhuma frase com todos sem soja), `test_talhao_controller.py` (`sem_soja` no contrato) e
  `test_region_service.py` (a região nunca conta `sem_soja`; teste de guarda, já passava).
- [x] Red: `'parado' != 'sem_soja'`, `'plantou' == 'sem_soja'`, `'incerto' == 'sem_soja'`,
  `n_obs: 4 != 3` (a colheita contava), `AttributeError: 'HistoricoTalhao' object has no attribute
  'sem_soja'`, `AttributeError: 'FieldHistoryService' object has no attribute 'soy_harvest_date'` e a
  frase com "3 de 8" no lugar de "1 de 6".
- [x] Green: `classify_soy_year`, `soy_harvest_date` e `post_harvest_values` no
  `FieldHistoryService`; o `RegionClassifier` delega; `SituacaoAno` com `sem_soja`;
  `HistoricoTalhao.sem_soja`; `in_entressafra` saiu (sem uso).

### 3.3 Safras confirmadas
- [x] Testes: regras (`anos_confirmaveis`, `historico_confirmado`), `FieldHistoryService`
  (`confirmable_years`, `check_confirmations`, resposta no lugar do satélite, ano sem dado, sem série),
  `TalhaoService`, `RecommendationService` (frase com as confirmações, só com elas, 422) e as rotas
  (`/talhao` com `fonte_ano` e `anos_confirmaveis`, 422 de formato e de ano; `/recomendacao` com a
  frase e os 422).
- [x] Red: `AttributeError: 'FieldHistoryService' object has no attribute 'confirmable_years'` /
  `'check_confirmations'`, `TypeError: classify_entressafra() takes 2 positional arguments but 3 were
  given`, `TypeError: ... unexpected keyword argument 'anos_confirmaveis'`, `AttributeError:
  'FrasesPorque' object has no attribute 'historico_confirmado'`, `TypeError: TalhaoService.
  inspect_talhao() / RecommendationService.recommend() got an unexpected keyword argument
  'confirmadas'`, `KeyError: 'anos_confirmaveis'` e as rotas respondendo 200 com o parâmetro ignorado.
- [x] Green: `Confirmacao`, `FonteAno`, `HistoricoAno.fonte_ano`, `Talhao.anos_confirmaveis`,
  `confirmadas_param.py`, schemas e services.

### 3.4 Front
- [x] Testes: `confirmedSeasonsService.test.ts` (novo), `satelliteService.test.ts`,
  `flowParams.test.ts`, `farmService.test.ts`, `farmRepositories.test.ts`, `Status.test.tsx`,
  `useSatelliteController.test.ts`, `SatelliteView.test.tsx` (pt e en), `useAnswerController.test.ts`,
  `useReportController.test.ts`, `useMethodController.test.ts` e `useWhenController.test.ts`.
- [x] Red: `Failed to resolve import "./confirmedSeasonsService"`, `confirmations` e `noSoy`
  indefinidos no controller, `Unable to find role "heading" { name: 'Confirme as últimas safras' }`,
  quadrinho `none` sem o "–", URL sem `confirmadas`, `farm.recomendacao` chamado sem `confirmadas` e
  o mock ainda de 2016 a 2025.
- [x] Green: o service, o controller, a view com o bloco e o aviso, o estado `none` do `YearStrip`,
  os textos em pt e en e o `confirmadas` em todas as telas que pedem a recomendação.

### 3.5 Documentação
- [x] `AGENTS.md` do backend e do front, `docs/como-preparar-os-dados-locais.md`, RF-25 e a nota da
  seção 7.8 no PRD.

---

## 4. Critérios de Aceitação

1. `/api/talhao` com `sem_soja` no resumo, `fonte_ano` em cada ano e `anos_confirmaveis`; o ano sem a
   soja no verão é `sem_soja` e não conta como parado, plantou nem sem certeza.
2. `confirmadas` em `/api/talhao` e `/api/recomendacao`: a resposta do produtor vale no lugar do
   satélite; fora das 3 últimas safras ou com outro valor, 422 problem+json.
3. A regra do pico e da colheita fica num lugar só (`FieldHistoryService`), para o talhão e a região;
   os números no `regras.yaml`.
4. Tela 4 com o bloco "Confirme as últimas safras", a legenda "Sem soja" e o aviso "Não parece uma
   lavoura de soja", em pt e en, acessível.
5. Nada de rede real nem rótulo de fonte real nos testes.
6. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .`, `npx vitest run`,
   `npm run lint`, `npm run build` e `pre-commit run --all-files` passando.

---

## 5. Fora do escopo e riscos

- **NDVI de 2026**: não foi baixado aqui (quem roda é o orquestrador). De `projeto/backend`, com os 4
  pontos do arquivo atual: `uv run python -m pipeline.fetch_ndvi --fonte ornl
  "--pontos=-18.9543,-48.1993;-18.9149,-48.2568;-19.55,-48.75;-18.6,-48.9"`. O `--dry-run` (sem rede,
  15/11/2026): **24 pedidos** (6 por ponto, só 2026; 972 de 1080 composições já no cache), **~36
  min**. A saída tem só os pontos pedidos: passe todos. Até lá, 2026 aparece "sem dado" (cinza com
  "?") e o produtor pode responder.
- **Região**: o `fetch_regiao_ndvi` passa a pedir 2017 a 2026: com o cache atual, **9 pedidos, ~4 min**
  (os de 2026 e o MCD12Q1 com os anos novos; o MCD12Q1 de 2026 pode ainda não existir, e o script usa
  o último ano antes). Até rodar de novo, o arquivo da região segue 2016 a 2025.
- **`janela` do histórico**: continua "04-01 a 07-31" (o texto "de abril a julho" da tela), mas a
  entressafra agora começa na colheita de cada ano (pode ser em fevereiro ou março).
- **Pousio e plano "hoje"**: ainda não leem o histórico do talhão; quando lerem, devem usar o
  histórico com as confirmações (o `classify_entressafra(série, confirmadas)`).
- **Grupos duplicados no `regras.yaml`**: o `soja_recente` ainda repete o pico do `regiao_ndvi`
  (integração pendente da tarefa 0037; um teste confere que são iguais).
- **URL editada à mão** com ano fora das 3 últimas: o `/recomendacao` responde 422 e a tela mostra o
  erro. O front só filtra o formato.
- **Próximas safras**: em 2027, `ano_fim` 2027 desloca as confirmáveis para 2025 a 2027; links antigos
  com 2024 passam a dar 422.
