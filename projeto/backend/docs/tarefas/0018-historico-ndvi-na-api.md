# Tarefa 0018: histórico do talhão pelo NDVI na API (R3.2)

- **Identificador:** `0018`
- **Título:** Histórico do talhão no formato completo do guia NDVI, lido do arquivo do contrato, com frase no `porque` e `/exemplo` pela colheita sugerida
- **Status:** Concluída
- **Prioridade:** Alta (T-10 do PRD, Must; destrava o "hoje" do R4.3)
- **Roteiro:** R3.2 (Fase 3)
- **Módulos Afetados:** `app/config_data/regras.yaml`, `app/models/regras.py`, `app/models/talhao.py`, `app/repositories/ndvi_repository.py`, `app/repositories/rules_repository.py`, `app/services/field_history_service.py`, `app/services/recommendation_service.py`, `app/schemas/talhao.py`, `app/controllers/recomendacao_controller.py`, `app/dependencies.py`, `app/constants.py`
- **Referências:** [PRD – Raiz Orbital](../../../../arquivos%20contexto/PRD%20%E2%80%93%20Raiz%20Orbital%20o%20que%20plantar%20depois%20da%20soja.md) (RF-08, 7.6, 7.8 e 7.9; T-10), [guia do histórico NDVI](../../../../arquivos%20contexto/Raiz%20Orbital%20%E2%80%93%20hist%C3%B3rico%20do%20talh%C3%A3o%20e%20da%20regi%C3%A3o%20pelo%20NDVI%20%28guia%20para%20o%20dev%29.md) ("Regra do talhão" e "Contrato da API"), "Contrato dos dados das fontes" no [`AGENTS.md`](../../AGENTS.md) (seção NDVI), [tarefa 0009](0009-token-earthdata-e-contrato-dados-fontes.md)

---

## 1. Descrição e Motivação

O `/api/talhao` já tinha um `historico`, mas no formato mínimo (`anos`, `parado`, `total`, `fonte`),
contando só os anos com alguma imagem e classificando pelos meses de abril a julho, sem mínimo de
observações. O `CachedNdviRepository` só lia o cache antigo (`data`, `ndvi`) pela chave de 0,0025°.

Decisões do time (seção 5 do roteiro): anos **2016 a 2025** e o **formato completo do guia NDVI**.

Esta tarefa:

1. Põe a regra do talhão no grupo `historico_ndvi` do `regras.yaml`, cada número com fonte: janela
   `04-01` a `07-31`, `limite_plantou` 0,60, `limite_parado` 0,45, `min_observacoes` 3, `ano_inicio`
   2016 e `ano_fim` 2025. Os limites saem do grupo `ndvi`, que fica só com a queda da colheita.
2. `CachedNdviRepository` lê o arquivo do contrato (`versao_dados` + `pontos[].serie[{data, ndvi,
   qualidade, produto}]`) e o cache antigo; usa o ponto mais perto do talhão a até 250 m (um pixel do
   MOD13Q1); descarta qualidade 2 ou 3 e NDVI vazio.
3. `FieldHistoryService.classify_entressafra` aplica a regra do guia e monta o formato completo.
4. O `porque` de cada opção ganha a frase do histórico (PRD 7.6), em pt e en, pelo modelo do
   `regras.yaml`.
5. `/exemplo` recomenda com a `colheita_sugerida` do talhão, não mais com `meio` fixo.

Contrato que a API passa a devolver (o front adapta no mesmo ciclo):

```json
"historico": {
  "anos": [{"ano": 2016, "situacao": "parado", "ndvi_max": 0.31, "n_obs": 3},
           {"ano": 2018, "situacao": "sem_dado", "ndvi_max": null, "n_obs": 1}],
  "parado": 5, "plantou": 4, "sem_certeza": 1, "total": 10,
  "fonte": "MODIS MOD13Q1 + MYD13Q1", "janela": "04-01 a 07-31"
}
```

---

## 2. Fluxo

```
NDVI_CACHE_PATH ──> CachedNdviRepository.get_ndvi_history(lat, lon)
                     (ponto mais perto a até 250 m; sem qualidade 2/3 nem NDVI vazio)
                                   │ list[NdviRecord]
              ┌────────────────────┴─────────────────────┐
              ▼                                          ▼
        TalhaoService                           RecommendationService
   classify_entressafra ──> historico         classify_entressafra ──> frase do "Por quê?"
   suggest_harvest_band ──> colheita_sugerida        (regras.yaml: frases.*.historico)
              │
              ▼
   /api/talhao  e  /api/exemplo (recomenda com colheita_sugerida.faixa)
```

---

## 3. Sub-tarefas (TDD)

### 3.1 Regras no `regras.yaml`
- [x] Testes em `tests/unit/repositories/test_rules_repository.py` (falharam com
  `AttributeError: 'Regras' object has no attribute 'historico_ndvi'`,
  `AttributeError: 'FrasesPorque' object has no attribute 'historico'` e
  `KeyError: 'historico_ndvi'`): valores do grupo, frase em pt e en, recusa sem `fonte`.
- [x] `RegrasHistoricoNdvi`, grupo `historico_ndvi` e modelos `frases.pt.historico` e
  `frases.en.historico`.

### 3.2 Repository
- [x] Testes em `tests/unit/repositories/test_ndvi_repository.py` (falharam com `qualidade=None`
  no lugar de `0`, `TypeError: float() argument must be ... not 'NoneType'`, ponto errado
  `[0.2] == [0.71]` e `unexpected keyword argument 'max_distance_m'`): lê qualidade e produto,
  descarta neve, nuvem e NDVI vazio, ponto mais perto dentro da distância, longe demais = vazio.
- [x] `CachedNdviRepository` com busca pelo ponto mais perto (haversine) e
  `NDVI_POINT_MAX_DISTANCE_M` (250 m) em `app/constants.py`.

### 3.3 Service, model e schema
- [x] Testes em `tests/unit/services/test_field_history_service.py` (falharam com
  `TypeError: HistoricoAno.__init__() got an unexpected keyword argument 'n_obs'`,
  `'HistoricoTalhao' object has no attribute 'plantou'`, anos fora da janela, `fonte` antiga e
  `'plantou' == 'incerto'` no bruto 6000): os casos da seção "Testes" do guia (0,72 / 0,30 / 0,52,
  limites 0,60 e 0,45, fator de escala, fora da janela, menos de 3 observações, resumo 5/4/1/10,
  limites e janela vindos das regras).
- [x] `HistoricoAno(ano, situacao, ndvi_max | None, n_obs)` e `HistoricoTalhao(anos, parado, plantou,
  sem_certeza, total, fonte, janela)`; `SituacaoAno` = `plantou | parado | incerto | sem_dado`.
- [x] NDVI físico arredondado a 4 casas (`NDVI_DECIMALS`, a precisão do MOD13Q1): sem isso, o bruto
  6000 virava 0,6000000000000001 e caía em "plantou".
- [x] Testes de controller em `tests/integration/controllers/test_talhao_controller.py` (falharam
  com `ValidationError ... ndvi_max Input should be a valid number` e `KeyError: 'plantou'`): o
  formato completo com o NDVI falso do `conftest.py`, o arquivo do contrato com valores de teste
  (`versao_dados.fonte = "teste"`, nunca `modis_mod13q1`) e o ponto sem NDVI perto (`historico: null`).
- [x] `HistoricoSchema.from_model` no formato completo.

### 3.4 Frase no `porque` e ligação
- [x] Testes em `tests/unit/services/test_recommendation_service.py` (falharam com
  `TypeError: RecommendationService.__init__() got an unexpected keyword argument 'ndvi_repo'`) e em
  `test_recomendacao_controller.py` (a última frase era a do solo): frase em pt e en, a mesma em
  todas as opções, sem frase sem série ou sem ano certo, modelo e anos vindos das regras.
- [x] `RecommendationService` recebe `ndvi_repo` e `history_service` (opcionais) e
  `dependencies.get_recommendation_service` liga os dois.

### 3.5 `/exemplo`
- [x] Teste em `test_recomendacao_controller.py` (falhou com `'meio' == 'cedo'`): NDVI com a soja
  secando em 2/fev leva a recomendação do exemplo para `cedo` (semeadura 8/fev).
- [x] `get_exemplo` usa `talhao.colheita_sugerida.faixa`; sai `EXAMPLE_FARM_HARVEST`.

### 3.6 Colheita sugerida com o arquivo novo
- [x] Conferido: o `suggest_harvest_band` já lia o NDVI de janeiro a março. Testes novos (service e
  controller) com Terra e Aqua intercalados e NDVI físico passaram sem mudar a regra.

---

## 4. Critérios de Aceitação

1. **TDD:** cada comportamento novo com teste escrito antes e visto falhando (erros acima).
2. **Contrato:** `/api/talhao` devolve o formato completo; sem NDVI do ponto, `historico: null`.
3. **Regra só no service; números no `regras.yaml`** com fonte (janela, limites, mínimo e anos).
4. **Nada de dado sintético com nome de fonte real:** os arquivos de teste usam `fonte: "teste"`.
5. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e
   `pre-commit run --all-files` passando.

---

## 5. Fora do escopo (para as próximas tarefas)

- O arquivo de NDVI de verdade (R2.2): sem ele, a API responde `historico: null` e colheita `meio`.
- A tabela `ndvi_point` (R1.6) e um repository do PostGIS para o NDVI.
- Os números da colheita sugerida (mínimo de 5 anos, dias 41 e 53, meses de janeiro a março) seguem em
  `app/constants.py`; o PRD 7.9 permitiria levá-los ao `regras.yaml`.
- `/api/regiao` (P3) e a calibração com 5 talhões conhecidos (guia NDVI).
- O plano "hoje" pelo histórico do talhão (R4.3).
