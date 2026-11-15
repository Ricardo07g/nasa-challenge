# Tarefa 0016: plano de 3 anos fiel ao PRD 7.7 (R4.3)

- **Identificador:** `0016`
- **Título:** Plano de 3 anos com as 216 combinações (com pousio), filtro de pousios seguidos, bônus por função e sem nota −1,0
- **Status:** Concluída (dois padrões **a revisar**: ver seção 5)
- **Prioridade:** Alta (o plano B do RF-20 é o plano do ano seco)
- **Roteiro:** R4.3 (Fase 4, trilha Motor; depende do R4.1, tarefa 0006; o "hoje" pelo histórico depende do R3.2)
- **Módulos Afetados:** `app/services/rotation_plan_service.py`, `app/services/recommendation_service.py`, `app/config_data/regras.yaml`, `app/models/regras.py`, `app/repositories/rules_repository.py`
- **Referências:** PRD (5, 7.2, 7.4, 7.6, 7.7, RF-07, §11 "Testes unitários obrigatórios", T-09), roteiro §5 ("Reescala do nematoide" e "Plano hoje")

---

## 1. Descrição e Motivação

O `RotationPlanService` não seguia o PRD 7.7:

| PRD 7.7 | Antes |
| --- | --- |
| 6³ = 216 sequências, **com pousio** | `product(candidatos, repeat=3)` só com as culturas na janela; o pousio nunca entrava |
| Descartar mais de 2 pousios **seguidos** | `if sum(pousios) >= max_pousios`: contava o total e, sem pousio nas combinações, nunca atuava |
| Bônus +5 / +10 por **funções** (grão, cobertura gramínea, cobertura leguminosa) | Contava culturas distintas: milho, sorgo, milho ganhava +5 com uma função só |
| Nematoide = sim: descartar 3 anos sem crotalária ou milheto | Sem nenhuma das duas na janela, todas as sequências eram puladas e o plano saía com **nota −1,0** |
| Nota = média das notas finais + bônus | Milho safrinha nos 3 anos e o "hoje" perdiam 12 pontos de uma penalidade sem fonte no PRD |
| "Hoje" = sequência atual (soja/milho ou soja/pousio) | Milho ×3 − 12; sem milho na janela, a **melhor opção** repetida (o "hoje" ficava parecido com a resposta) |

---

## 2. Regras adotadas

`RotationPlanService.build_3_year_plans(opcoes, anos_secos, pousio, nematoide, lang)`:

1. **Sequências** (`all_sequences`): as opções na janela mais o pousio, 3 anos. Com as 5 culturas na janela,
   6 × 6 × 6 = 216. Opção fora da janela não chega ao service (é o filtro "fora da janela" do PRD).
2. **Restrições** (`candidate_sequences`):
   - sai a sequência com mais de `rotacao.max_pousios` (2) pousios **seguidos** (`longest_fallow_run`). Com
     3 anos, só pousio-pousio-pousio sai: 215 sobram;
   - nematoide = sim: sai a sequência sem crotalária nem milheto (`culturas_supressoras_nematoide`), **só
     se uma delas estiver na janela**. Sem nenhuma, o plano sai normalmente e as descrições de `normal` e
     `seco` ganham a frase "Nenhuma cultura que quebra o ciclo do nematoide cabe na janela desta
     colheita, então o plano não corta o nematoide." (em inglês também).
3. **Nota** (`plan_score`): média das notas finais dos 3 anos + bônus de diversidade, de 0 a 100. O ano
   normal usa `notas.final`; o ano seco, `notas_seco.final` (os 4 anos mais secos). Empate: fica a
   primeira sequência na ordem das opções (da maior nota final para a menor; pousio por último).
4. **Bônus por função** (`diversity_bonus`): conta as funções diferentes do plano, pelo novo
   `rotacao.funcoes` do `regras.yaml` (com fonte). Milho e sorgo = grão; milheto = cobertura gramínea;
   crotalária = cobertura leguminosa; milho + braquiária = grão **e** cobertura gramínea; pousio = nenhuma.
   2 funções: +5; 3: +10.
5. **Pousio nas combinações:** fica fora do ranking (PRD 7.6), mas entra no plano. O
   `RecommendationService._fallow_scores` calcula as notas dele com as mesmas funções do motor:
   segurança 100 (PRD 7.2), futuro 100 só com CMIP6 (PRD 7.6), solo da tabela 7.4 (0) e renda 0
   (PRD 5). Sem CMIP6: 30 / 0,85 = **35,3**; com CMIP6: **45**. As mesmas notas valem no ano seco.
6. **Sem nenhuma opção na janela:** os três planos são pousio ×3 (com a nota do pousio), com uma frase
   que diz isso. Não existe mais nota −1,0 nem a nota fixa 20.
7. **Penalidade de monocultura removida:** `rotacao.penalidade_monocultura_milho` (12, "hipótese do time,
   revisar no R4.3") saiu do `regras.yaml` e do model. Com o bônus por função, o milho repetido já fica
   sem os +5/+10.

O contrato do JSON não mudou (`plano_3_anos: {normal, seco, hoje}`, cada um `{anos, nota, descricao}`,
igual ao `Plano` de `projeto/frontend/src/models/recomendacao.ts`). A diferença é que `anos` agora pode
trazer `pousio`, que já é um `CropId` do front (com nome em `messages.pt.ts`/`messages.en.ts`; o
`planSummary` não conta o pousio nem como grão nem como cobertura).

---

## 3. Sub-tarefas (TDD)

- [x] Bônus por função e nematoide sem supressora (`test_rotation_plan_service.py`). Falharam assim:
  - só grão (milho 80, sorgo 80, milheto 50): `AssertionError: assert 85.0 == 80.0`;
  - milho + braquiária com crotalária (3 funções): `AssertionError: assert 55.0 == 60.0`;
  - nematoide = sim, só milho e sorgo na janela: `AssertionError: assert -1.0 == 70.0`.
- [x] `rotacao.funcoes` no `regras.yaml` (`test_rules_repository.py`): falhou com
  `AttributeError: 'RegrasRotacao' object has no attribute 'funcoes'`. O `YamlRulesRepository` passou a
  converter `dict[str, frozenset[str]]`.
- [x] "Hoje" com a conta do plano: depois do bônus por função, o teste do nematoide ainda dava
  `assert 66.7 == 70.0` (o milho ×3 perdia 12), e o teste novo do "hoje" deu `assert 58.0 == 70.0`.
  A penalidade saiu.
- [x] Pousio nas 216 combinações, filtro de pousios **seguidos**, "hoje" com pousio sem milho na janela e
  nenhuma opção na janela. Primeiro falharam por API (`unexpected keyword argument 'pousio'`, `no
  attribute 'all_sequences'`); com o parâmetro aceito e o filtro antigo exposto, falharam pelo motivo
  certo:
  - `assert 200 == 215` (o filtro contava o total de pousios) e `assert 146 == (215 - 63)`;
  - ano seco com milho 10 e pousio 35,3: `'milho_safrinha' != 'pousio'` (pousio fora das combinações);
  - colheita tarde: `('milheto', 'milheto', 'milheto') != ('pousio', 'pousio', 'pousio')`;
  - nenhuma opção: `assert 20.0 == 35.3`.
- [x] `RecommendationService` passando as notas do pousio (`test_recommendation_service.py`): colheita
  tarde dá "hoje" = pousio ×3 com 35,3 (sem CMIP6) e 45 (com CMIP6). Falharam com `TypeError: ...
  missing 1 required positional argument: 'pousio'` (o service ainda não calculava o pousio). No `main`,
  o mesmo caso dava milheto ×3 com 39,5.
- [x] Testes antigos atualizados: as chamadas de `build_3_year_plans` passam `pousio=POUSIO` (o pousio
  agora entra nas combinações), e `test_should_load_shipped_ndvi_and_rotation_rules` passou a conferir
  que a penalidade de 12 não existe mais. Nenhum valor esperado antigo mudou.
- [x] Teste explícito da reescala do nematoide (`test_should_rescale_soil_by_theoretical_maximum_...`):
  documenta o padrão a revisar (seção 5). Passa direto, porque é o comportamento que já existia.
- [x] Diagramas de classes e de sequência com a assinatura nova.

---

## 4. Antes × depois na fazenda de exemplo

Arquivos reais (`culturas.yaml`, fixture do POWER), solo padrão (médio), sem CMIP6, nematoide não
informado. Nota entre parênteses.

| Colheita | Plano | Antes | Depois |
| --- | --- | --- | --- |
| `cedo` | normal | milho, milho + braquiária, crotalária (74,5) | igual (74,5): 3 funções |
| `cedo` | seco | milho, milho, milho + braquiária (78,7) | igual (78,7): grão + gramínea |
| `cedo` | hoje | milho ×3 (60,9) | milho ×3 (**72,9**): sem a penalidade de 12 |
| `meio` | normal | milho, crotalária, milheto (67,4) | igual (67,4) |
| `meio` | seco | crotalária, crotalária, milheto (62,4) | igual (62,4) |
| `meio` | hoje | milho ×3 (52,1) | milho ×3 (**64,1**) |
| `tarde` | normal | milheto ×3 (51,5) | igual (51,5) |
| `tarde` | seco | milheto ×3 (51,5) | igual (51,5) |
| `tarde` | hoje | milheto ×3 − 12 (39,5): a melhor opção repetida | **pousio ×3 (35,3)**: o milho não cabe na janela |

Com nematoide = sim, `normal` e `seco` também ficam iguais ao antes e muda só o "hoje" (cedo 60,2 → 72,2;
meio 51,4 → 63,4; tarde milheto ×3 com 39,9 → pousio ×3 com 35,3). Nos dados
reais os melhores planos já tinham a mesma quantidade de culturas distintas e de funções, por isso
`normal` e `seco` não mudaram; os testes unitários cobrem os casos em que mudam.

---

## 5. Padrões a revisar

- **Reescala da nota de solo com nematoide** (roteiro §5, agrônoma): com pragas × 1,5, o total é
  dividido pelo **máximo teórico** (40 + 30 + 30 × 1,5 = 115) e multiplicado por 100. Assim só uma cultura
  com todos os pontos no máximo chega a 100 (crotalária: 100/115 → 87,0). Outra opção seria dividir pelo
  maior total entre as opções. Teste que fixa o padrão: `test_should_rescale_soil_by_theoretical_maximum_when_nematoide_is_true`.
- **Plano "hoje"** (roteiro §5, produto): continua **milho safrinha ×3** enquanto o histórico NDVI do
  talhão (R3.2) não entra na conta; sem milho na janela (colheita tarde), **pousio ×3**. A descrição diz
  que é uma sequência de referência. Quando o R3.2 chegar, o "hoje" sai do histórico (anos com segunda
  safra = milho; anos parados = pousio).
- **Milho + braquiária com duas funções** (agrônoma): conta grão e cobertura gramínea. Se contar só como
  grão, o plano seco de `cedo` passaria a ser outro. A regra está só no `regras.yaml` (`rotacao.funcoes`).
- **Pousio com futuro 100:** segue o PRD 7.6 ("com segurança e futuro 100"). Sem CMIP6 o futuro sai da
  conta, como nas outras opções.

---

## 6. Critérios de Aceitação

1. **TDD:** testes escritos antes e vistos falhando (erros acima).
2. 216 sequências antes do filtro; nenhuma com 3 pousios seguidos; com nematoide = sim e supressora na
   janela, nenhum plano sem crotalária ou milheto; nunca nota −1,0.
3. Contrato do JSON igual ao do front.
4. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.
