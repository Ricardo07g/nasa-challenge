# Tarefa 0006: `regras.yaml` + `YamlRulesRepository` (R4.1)

- **Identificador:** `0006`
- **Título:** Limiares, pesos e frases do motor em `regras.yaml`, lidos por um repository
- **Status:** Concluída
- **Prioridade:** Alta (destrava R4.2, R4.3 e a Fase 6)
- **Roteiro:** R4.1 (Fase 4, trilha Motor)
- **Módulos Afetados:** `app/config_data/regras.yaml`, `app/models/regras.py`, `app/repositories/rules_repository.py`, `app/services/` (clima, histórico, plano, recomendação), `app/dependencies.py`, `app/config.py`, `app/constants.py`
- **Referências:** [PRD – Raiz Orbital](../../../../arquivos%20contexto/PRD%20%E2%80%93%20Raiz%20Orbital%20o%20que%20plantar%20depois%20da%20soja.md) (seção 7: "os limiares são a versão 0 e ficam em `regras.yaml`"; T-02, T-11), [plano técnico do backend](../../../../arquivos%20contexto/Raiz%20Orbital%20%E2%80%93%20plano%20t%C3%A9cnico%20do%20backend.md) (§4.4, §4.8 e §5), [ADR-0004](../adr/0004-fluxo-fazenda-exemplo-e-camada-comunitaria.md) (bônus da pecuária)

---

## 1. Descrição e Motivação

Os limiares e pesos do motor estavam fixos em `app/constants.py` e as frases do "Por quê?" fixas em
`recommendation_service._why`. O PRD (seção 7) e o plano técnico (§4.4 e §4.8) pedem tudo isso em
`regras.yaml`, com a fonte ao lado de cada número, para a agrônoma calibrar sem mexer no código.

Esta tarefa:

1. Cria `app/config_data/regras.yaml` com os números agrupados (`clima`, `nota_final`, `rotulos`,
   `solo`, `ndvi`, `rotacao`). Cada número tem `valor` e `fonte` (seção do PRD, ADR ou "hipótese do
   time"). O grupo `frases` traz os modelos do "Por quê?" em `pt` e `en`.
2. Cria o model tipado `Regras` (`app/models/regras.py`) e o `YamlRulesRepository`
   (`app/repositories/rules_repository.py`), que recusa número sem `fonte`.
3. Os services recebem as regras por parâmetro. O padrão é o `regras.yaml` que vai com a API
   (`load_default_rules()`), por isso os testes antigos continuam simples. A API injeta as regras do
   caminho do `Settings` (`REGRAS_PATH`) por `app/dependencies.py`.
4. **Sem mudar comportamento:** os 121 testes que já existiam passam sem trocar nenhum valor esperado,
   e a saída do motor foi comparada byte a byte antes e depois (96 combinações da fazenda de exemplo:
   colheita × língua × nematoide × gado × solo, com e sem deltas do CMIP6, mais o histórico NDVI).

---

## 2. Fluxo

```
regras.yaml ──> YamlRulesRepository.get_rules() ──> Regras (model)
                         │
          dependencies.get_rules (REGRAS_PATH do Settings)
                         │
      ┌──────────────────┼───────────────────┬─────────────────────┐
      ▼                  ▼                   ▼                     ▼
ClimateRiskService  FieldHistoryService  RotationPlanService  RecommendationService
  (clima)             (ndvi)               (rotacao)            (nota_final, rotulos,
                                                                 solo, frases, clima)
```

---

## 3. Sub-tarefas (TDD)

### 3.1 Arquivo, model e repository
- [x] Teste `tests/unit/repositories/test_rules_repository.py` (falhou com
  `ModuleNotFoundError: No module named 'app.repositories.rules_repository'`):
  - valores do `regras.yaml` entregue batem com o PRD (ISNA 0,55/0,50, ±15/30 dias, 35 °C × 3 dias,
    perda 0,65/0,55 e 30%/60%, pesos 30/25/30/15 somando 1, rótulos 85/60, 50/20 e 70/30, solo
    40/30/30 e ×1,5, NDVI 0,60/0,45/0,50 e abr–jul, rotação 4 anos, fev–abr, 2 pousios, +5/+10, −12,
    crotalária e milheto);
  - modelos de frase em `pt` e `en`;
  - lê o arquivo do caminho recebido; recusa número sem `fonte`; `load_default_rules()` lê o arquivo
    que vai com a API.
- [x] Teste em `tests/unit/test_config.py` (falhou com
  `AttributeError: 'Settings' object has no attribute 'regras_path'`): `regras_path` com padrão em
  `app/config_data/regras.yaml` e troca por `REGRAS_PATH`.
- [x] `app/config_data/regras.yaml`, `app/models/regras.py`, `app/repositories/rules_repository.py`,
  `Settings.regras_path` e `REGRAS_PATH` no `.env.example`.

### 3.2 Services recebendo as regras
- [x] Testes com regras trocadas (falharam com `TypeError: ClimateRiskService.__init__() got an
  unexpected keyword argument 'rules'`, `FieldHistoryService() takes no arguments` e
  `RotationPlanService() takes no arguments`):
  - `ClimateRiskService`: limiar de calor e degraus de perda vindos das regras;
  - `FieldHistoryService`: limiar de "plantou" vindo das regras;
  - `RotationPlanService`: quantidade de anos secos vinda das regras;
  - `RecommendationService`: pesos da nota final, limiar do rótulo de dinheiro e modelo de frase,
    com o número do calor na frase igual ao da conta.
- [x] Os quatro services recebem `rules: Regras | None = None` (padrão: `load_default_rules()`).
- [x] `_why` monta as frases pelos modelos do YAML. O número do calor (`{calor_c}`) e a janela das
  coberturas (`{dias}`) vêm das mesmas regras da conta (plano técnico §4.8).
- [x] A descrição do plano seco cita a quantidade real de anos secos (antes era "4" fixo; com 4 anos a
  frase é a mesma).

### 3.3 Ligação e limpeza
- [x] Teste de integração em `test_recomendacao_controller.py` e `test_talhao_controller.py` (falhou
  com `ImportError: cannot import name 'get_rules_repository' from 'app.dependencies'`): regras de
  um repository falso chegam ao clima, aos rótulos, ao plano seco e ao histórico NDVI.
- [x] `get_rules_repository` e `get_rules` em `app/dependencies.py`, ligados aos quatro services.
- [x] `app/constants.py` sem os limiares que foram para o YAML.
- [x] `projeto/backend/AGENTS.md` (estrutura e "Dados da API") atualizado.

---

## 4. Critérios de Aceitação

1. **TDD:** cada comportamento novo com teste escrito antes e visto falhando (erros acima).
2. **Sem mudar comportamento:** os 121 testes antigos passam sem trocar valores esperados; saída do
   motor idêntica antes e depois. Total: 139 testes.
3. **Fonte em cada número:** o repository recusa número sem `fonte`.
4. **Camadas:** leitura do YAML só no repository; regra só nos services; ligação em `dependencies.py`.
5. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e
   `pre-commit run --all-files` passando.

---

## 5. Fora do escopo (para as próximas tarefas)

Continuam em `app/constants.py` porque não estavam na lista do R4.1. Alguns são regra de negócio e
podem ir para o `regras.yaml` depois:

- Datas de semeadura por faixa de colheita (`SOWING_MONTH_DAY_BY_HARVEST`). O PRD 7.1 e o plano
  técnico §4.1 pedem essas datas no `regras.yaml`.
- Mínimo de 5 anos de NDVI e os limites de dia do ano da colheita sugerida (PRD 7.9).
- Balde inicial de 50% da CAD (`DEFAULT_INITIAL_ARM_FRACTION`, também usado pelo
  `nasa_power_client.py`) e o piso de 20% (`MIN_INITIAL_ARM_FRACTION`).
- CAD por textura (PRD 6.4; usada pelos repositories de solo) e curva de Kc.
- Frases fora do `_why`: dinheiro, terra (com os cortes de palhada 35/20), fora da janela, pousio,
  aviso e descrições dos planos.
- O filtro de pousio (`rotacao.max_pousios`) segue com a lógica antiga, que nunca atua: corrigir no
  R4.3. A penalidade de monocultura de milho (12) não tem fonte no PRD e está marcada como hipótese.
