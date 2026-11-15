# Tarefa 0008: Conteúdo das culturas (nomes e "como fazer" em pt/en, ids canônicos e `/crop-options` lendo o YAML)

- **Identificador:** `0008`
- **Título:** Conteúdo das culturas (nomes e "como fazer" em pt/en, ids canônicos e `/crop-options` lendo o YAML)
- **Status:** Concluída
- **Prioridade:** Média
- **Roteiro:** R4.4 (Fase 4) · PRD T-11
- **Módulos afetados:** `projeto/backend/app/config_data/culturas.yaml`, `app/models/crop_option.py`, `app/repositories/crop_params_repository.py`, `app/repositories/crop_option_repository.py`, `app/services/recommendation_service.py` (uma linha), `app/dependencies.py` (uma função)
- **Referências:** [roteiro de implementação](../roteiro-de-implementacao.md) (R4.4), [ADR-0001](../adr/0001-padronizacao-identificadores-de-culturas-crop-id.md), PRD (§4 tela 5, §5, RNF-03), plano técnico (§3.2 e §3.4)

---

## 1. Descrição e motivação

Antes desta tarefa:

- O `culturas.yaml` usava as chaves longas `sorgo_granifero` e `crotalaria_spectabilis`. O id canônico (`sorgo`, `crotalaria`) só saía por causa do `CROP_ID_ALIASES`.
- Não havia `nome_en` nem `como_fazer`. Em inglês, o nome da cultura saía em português, e `opcoes[].como_fazer` saía vazio nos dois idiomas. O cartão "Como fazer" da tela de resposta (PRD §4, tela 5) ficava sem passos com a API real.
- Os nomes do YAML ("Milho Safrinha", "Milho + Braquiária ruziziensis") não eram os da interface ("Milho sozinho", "Milho com braquiária").
- `/api/crop-options` lia uma lista fixa em código (`DEFAULT_CROP_OPTIONS`), e não o `culturas.yaml` (plano técnico §3.4).

---

## 2. Decisões

| Tema | Decisão |
| --- | --- |
| Ids | Chaves canônicas direto no YAML (`pousio`, `milho_safrinha`, `sorgo`, `milho_braquiaria`, `milheto`, `crotalaria`). Os aliases longos **continuam** aceitos na entrada (`CROP_ID_ALIASES` em `app/constants.py`, sem alteração), como pede a regra 3 da ADR-0001. |
| Nomes | `nome` e `nome_en` iguais aos da interface (`projeto/frontend/src/i18n/messages.pt.ts` e `messages.en.ts`, `crops.names`). O nome técnico do PRD §5 fica num comentário ao lado de cada id. |
| "Como fazer" | `como_fazer` (pt) e `como_fazer_en` (en), no mesmo padrão de `nome`/`nome_en`. São 3 passos por cultura (o PRD §4 fala em "Como fazer em 3 passos"). |
| Idioma | Continua pelo cabeçalho `Accept-Language` (plano técnico §3.2). Começou com `en` → inglês; o resto → português. Sem tradução no YAML, o service usa o português (igual ao `nome_en`). |
| `role` do `/crop-options` | Vem do campo `funcao` do YAML. A `funcao` foi alinhada à coluna "Função" do PRD §5, que é exatamente o `role` de antes: `Grão + Cobertura` → `Grão + cobertura` e `Cobertura de solo` → `Cobertura`. Nenhum service usa `funcao`. |
| `name` do `/crop-options` | Vem do `nome` do YAML, ou seja, o nome da interface. **Mudou o valor** (ex.: "Milho safrinha" → "Milho sozinho"; "Pousio" → "Deixar parado"). O formato `{id, name, role}` e os ids e `role` continuam iguais. O único consumidor no front é a tela de design system, que só mostra o texto. |
| Lista fixa | `DEFAULT_CROP_OPTIONS` e `InMemoryCropOptionRepository` ficam como dublê de teste e como referência do contrato: um teste compara ids e `role` do YAML com essa lista. |

### Rascunho para a agrônoma revisar

Os passos de `como_fazer` / `como_fazer_en` são **rascunho**: estão marcados assim no `culturas.yaml`. Nenhum número agronômico novo foi criado.

De onde veio cada texto:

- **Milho com braquiária, sorgo, milho sozinho, crotalária e milheto:** passos do protótipo (`projeto/frontend/src/repositories/mocks/fixtures.ts`, campo `how`). Os do milho com braquiária são os mesmos do plano técnico §3.2 e do prompt do Lovable (tela de resposta).
- **Pousio (deixar parado):** escritos a partir do texto do pousio que a API já devolve ("multiplica daninhas e gera custo de dessecação"). O pousio não entra no ranking, então esses passos não aparecem em `opcoes[]` hoje.

---

## 3. Sub-tarefas de implementação (TDD)

### 3.1 Passos no idioma pedido
- [x] `CropParams.como_fazer_en` (model) e leitura no `YamlCropParamsRepository`.
- [x] `RecommendationService._build_option`: `como_fazer` em inglês quando o idioma é `en`, com o português como reserva.
- [x] **Testes:** `tests/unit/repositories/test_crop_params_repository.py` (passos nas duas línguas; vazio sem tradução) e `tests/unit/services/test_recommendation_service.py` (pt, en e reserva).

### 3.2 Conteúdo do `culturas.yaml`
- [x] Chaves `sorgo` e `crotalaria`.
- [x] `nome_en` em todas as culturas; `nome` igual ao da interface.
- [x] `como_fazer` e `como_fazer_en` com 3 passos em todas as culturas, marcados como rascunho.
- [x] **Testes:** YAML com as chaves canônicas, nomes da interface e de 3 a 5 passos nas duas línguas (`test_crop_params_repository.py`); `/api/exemplo` com os arquivos reais em pt e en (`tests/integration/controllers/test_exemplo_dados_reais.py`).

### 3.3 `/crop-options` lendo o YAML
- [x] `YamlCropOptionRepository` (`name` = `nome`, `role` = `funcao`), reaproveitando o `YamlCropParamsRepository` (leitura e aliases).
- [x] `get_crop_option_repository` em `dependencies.py` passa a devolver o repository do YAML (com `lru_cache`, igual ao de parâmetros).
- [x] `funcao` do YAML alinhada à coluna "Função" do PRD §5.
- [x] **Testes:** `tests/unit/repositories/test_crop_option_repository.py` (lista, ids antigos, id desconhecido) e `tests/integration/controllers/test_crop_option_controller.py` (ligação padrão; mesmos ids e `role` de antes, no formato `{id, name, role}`).

---

## 4. Critérios de aceitação

1. `opcoes[].nome`, `fora_da_janela[].nome` e `opcoes[].como_fazer` saem em português por padrão e em inglês com `Accept-Language: en`.
2. Nenhuma opção sai com `como_fazer` vazio usando o `culturas.yaml` que vai com a API.
3. A API devolve só os ids canônicos da ADR-0001; os ids antigos continuam aceitos na entrada.
4. `/api/crop-options` lê o `culturas.yaml`, com o mesmo formato, os mesmos ids e os mesmos `role` de antes.
5. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files` passando.

## 5. Fora do escopo

- Revisão agronômica dos passos (fica com a agrônoma).
- `name`/`role` do `/crop-options` em inglês (a rota não olha o idioma hoje).
- Modelos de frase em `regras.yaml` (R4.1).
