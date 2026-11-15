# Tarefa 0065: Uma regra só para o plano sugerido, avisos sem os vizinhos e pela cultura do plano, prazo e ciclo de cada ano

- **Identificador:** `0065`
- **Título:** O Plano A do `/recomendacao` e o plano de cada objetivo passam a sair da mesma sugestão em cadeia do
  `/api/plano/sugestao` (com o porquê de cada ano); o `/api/avisos` deixa de lado os relatos dos vizinhos e aceita a
  cultura do 1º ano do plano; o `/api/plano` traz o prazo do ZARC e o ciclo de cada ano, usados no relatório e na linha
  do tempo da tela 6
- **Status:** Concluída
- **Prioridade:** Alta (ajustes pedidos e aprovados pelo usuário em 15/11/2026)
- **PRD:** RF-48 (nova); ajusta a RF-30 (planos dos objetivos e Plano A), a RF-31 e a RF-45 (contador, "Perto de você"
  e os quadros da cultura dos avisos), a RF-39 (a cadeia vale também para o Plano A) e a RF-43 (prazo de cada ano no
  relatório)
- **Módulos Afetados:**
  - backend: `services/recommendation_service.py` (`_objectives` pelo `PlanSuggestionService`),
    `services/plan_suggestion_service.py` (`axis` e `allow_fallow`), `services/rotation_plan_service.py` (sai o
    `best_plan_starting_with` e o `chain`), `models/recomendacao.py` e `schemas/recomendacao.py` (`motivos`),
    `services/avisos_service.py` (`vizinhos_service`, `contador`, `cultura`), `controllers/avisos_controller.py`
    (`cultura`), `dependencies.py` (avisos sem a comunidade), `models/avisos.py` e `schemas/avisos.py` (comentários),
    `services/plan_evaluation_service.py`, `models/plano.py` e `schemas/plano.py` (`data_limite` e `ciclo`)
  - frontend: `repositories/avisosRepository.ts`, `services/avisosService.ts`, `controllers/useAvisosController.ts`,
    `repositories/mocks/mockAvisos.ts`, `models/{avisos,plano,recomendacao}.ts`, `services/planService.ts`
    (`PlanCard.deadline`), `services/planningService.ts` (passo `next` com o prazo do 2º ano),
    `controllers/usePlanningController.ts`, `i18n/planningTexts.ts` (`planDeadlineText` e o texto do `next`),
    `i18n/messages.{pt,en}.ts` (`planning.timeline.next.deadline` / `late`), `views/PlanReport.tsx` (coluna "Prazo"),
    `repositories/mocks/mockPlano.ts`
- **Referências:** tarefas 0044 (objetivos e Plano A), 0046 e 0062 (avisos), 0056 (sugestão em cadeia), 0060 (tela 6),
  0064 (a sugestão de cada ano sempre à vista)

---

## 1. Uma regra só para o plano sugerido

**Antes:** duas regras para a mesma coisa. O Plano A do `/recomendacao` e do `/exemplo` (`plano_3_anos.normal`) e os
`objetivos[].plano` saíam do `RotationPlanService.best_plan_starting_with` (só o PRD 7.7, sem a cadeia); o
`/api/plano/sugestao` saía do `best_plan_with_prefix(..., chain=True)`, com o `motivo` de cada ano. A tela 5 mostra
a cadeia; o JSON do `/recomendacao` dizia outro plano.

**Agora:**

- O plano de cada objetivo (`equilibrio`, `seguranca`, `renda`, `terra`) sai do `PlanSuggestionService.suggest` com o
  1º ano fixo (a 1ª cultura da `ordem`), a nota do eixo do objetivo (`axis`) e, nos objetivos, sem o pousio
  (`allow_fallow=False`), como antes; o `suggest` ganhou esses dois parâmetros. As culturas fora do prazo vão junto,
  para o porquê dizer quando o prazo pesou (a mesma conta do `/api/plano/sugestao`).
- O Plano A (`plano_3_anos.normal`) continua sendo o plano do equilíbrio, então é o plano do
  `/api/plano/sugestao?fixos=<melhor opção>` na mesma faixa (conferido em teste nas 3 faixas: as culturas e os
  porquês).
- **Campo novo, opcional:** `motivos` (lista na ordem dos anos; `null` no 1º ano, que não é sugerido) em
  `plano_3_anos.normal` e em cada `objetivos[...]`. No `plano_3_anos.seco` e no `hoje` vem `null`.
- **Regra antiga apagada:** o `best_plan_starting_with` e o parâmetro `chain` do `best_plan_with_prefix` saíram (nada
  mais usava); os pontos do grupo `plano_cadeia` valem sempre. Os testes que mostravam o plano sem a cadeia usam as
  regras com esses pontos zerados.
- **O que não muda:** o `plano_3_anos.seco` (Plano B do motor) sai do `build_3_year_plans` (as 216 sequências do PRD
  7.7 com as notas dos anos secos) e nunca usou o `best_plan_starting_with`: continua igual. A `nota` dos planos
  continua a do PRD 7.7 (média das notas finais + diversidade, sem os pontos da cadeia), comparável entre os objetivos.
  O front não usava o `plano_3_anos` nem o `objetivos[].plano` (só a `ordem`): nada quebra.

**Lavoura de demonstração** (`lat=-18.9543&lon=-48.1993`, cópia do banco):

| Faixa | Plano A antes | Plano A agora (= `/api/plano/sugestao?fixos=<1º>`) | Plano B (igual) |
| --- | --- | --- | --- |
| cedo | milho com braquiária ×3 (85,0) | milho com braquiária, crotalária, milho com braquiária (84,7) | milho com braquiária, milho com braquiária, crotalária |
| meio | milho com braquiária, milho com braquiária, crotalária (79,7) | milho com braquiária, crotalária, milho com braquiária (79,7) | milho com braquiária, crotalária, crotalária |
| tarde | milheto, milheto, sorgo (60,9) | milheto, sorgo, milheto (60,9) | milheto ×3 |

Porquês da colheita tarde: 2º ano "milho sozinho passou do prazo do ZARC (28/02); esta cabe no prazo (até 20/03)";
3º ano "cuida da terra depois de um ano de grão e aguenta a seca".

## 2. Avisos sem os relatos dos vizinhos

- O `contador` do `/api/avisos` conta só os avisos de `agora` (o front já contava só os cartões de "Agora").
- O `perto` vem `null` e a API não lê a comunidade: o `AvisosService` recebe o `AvisosVizinhosService` opcional
  (`vizinhos_service`) e só monta o grupo com ele e com o service da comunidade; o `dependencies.py` passa `None` nos
  dois. O `AvisosVizinhosService` continua no código, com os testes, para quando a comunidade voltar; mesmo religado,
  o `contador` não conta o `perto`.
- **Front:** os dados de exemplo (`buildAvisos`) mandam `perto: null` e o `contador` igual aos avisos de "Agora"; o
  `activeCount` continua contando os cartões que a tela mostra (o `contador` da API inclui tipos que a tela não sabe
  escrever).

## 3. Os quadros de cultura dos avisos pela cultura do plano

- `GET /api/avisos?…&cultura=<id>` (opcional, id do `culturas.yaml`). Com ela, a falta de água (`mudou_falta_agua`) e
  o "deu certo" (`mudou_deu_certo`) usam essa cultura: a conta do motor dela (no prazo ou fora do prazo do ZARC,
  `opcoes_fora_do_prazo`) e a falta de água com o ciclo e o Kc dela. No pousio, os dois quadros não vêm (não há conta).
  Sem `cultura`, a melhor opção do motor, como antes. Cultura desconhecida: 422 `VALIDATION_ERROR` (antes de rodar o
  motor). O El Niño / La Niña (`enso`) e a safrinha continuam pela melhor opção.
- **Front:** o `useAvisosController` espera a recomendação da tela 5 e manda a cultura do 1º ano do plano
  (`planCropOf`: a escolha, o que pensa plantar ou a sugestão do objetivo); sem colheita ou com a recomendação em erro,
  a escolha da URL ou nenhuma. O `avisosRepository` põe `&cultura=` na URL e o cache do `avisosService` separa por
  cultura. Com isso, os quadros da cultura aparecem também quando o plano não começa pela melhor opção (antes, o
  `changeTiles` escondia os quadros de outra cultura). O `changeTiles` continua filtrando pela cultura do plano.

Lavoura de demonstração, colheita tarde (melhor opção: milheto): sem `cultura`, falta de água do milheto (44,3 → 85,2
mm); com `cultura=sorgo`, falta de água do sorgo (87,1 → 153,6 mm) e "deu certo" do sorgo (10 de 15 → 1 de 5); com
`cultura=pousio`, só o veranico e o fim das chuvas; `cultura=trigo`, 422.

## 4. Prazo e ciclo de cada ano no `/api/plano`

- Cada item de `anos[]` do `/api/plano` e do `/api/plano/sugestao` ganha `data_limite` ("AAAA-MM-DD", o prazo do ZARC
  da cultura no ano daquele ano do plano: o 1º é o ano da semeadura do motor, o mesmo `data_limite` do `/recomendacao`;
  o 2º, um ano depois; o 3º, dois) e `ciclo` (`dias_florescer` e `ciclo_dias` do `culturas.yaml`). No pousio, os dois
  vêm `null`. Opcionais no model do front.
- **Front, relatório da tela 6 (`PlanReport`):** a tabela "4. Plano de 3 anos" ganha a coluna "Prazo" ("Prazo" / en
  "Deadline", o mesmo título da tabela "Opções comparadas"), com o prazo de cada ano (`planDeadlineText`: "Até 20 de
  março"; passou do prazo, "Passou do prazo (28 de fevereiro)"; no pousio, "Sem prazo"; sem o dado, "—").
- **Front, linha do tempo ("O que fazer agora"):** o desenho não muda. Só o 1º ano tem passo de plantio, e ele já usa o
  prazo certo (o `data_limite` da opção, igual ao do `/api/plano`). O único passo que fala do 2º ano é o da próxima
  soja ("Próxima soja; depois dela, {cultura}"): o texto dele passa a começar com o prazo do 2º ano ("Plante até 15
  de março (prazo do ZARC)." ou, fora do prazo, "Passou do prazo do ZARC (28 de fevereiro): o seguro rural não
  cobre.", com o tom laranja que o passo de plantio já usa), antes do "Abra o app de novo…". O 3º ano não aparece na
  linha do tempo. O `ciclo` não é usado no front por enquanto.

## 5. Decisões tomadas sem perguntar

- **Nome e forma do campo novo:** `motivos`, uma lista paralela aos anos (`null` no 1º), em vez de trocar `anos` por
  objetos: o front e quem mais lê o JSON continuam iguais.
- **`motivos` no `PlanoSchema` inteiro:** o mesmo schema serve `normal`, `seco` e `hoje`; nos dois últimos vem `null`.
- **Prazo no ano de cada ano do plano** (2027, 2028, 2029), e não o ano de referência para todos: é a data de verdade
  daquele plantio; o front só mostra dia e mês.
- **`ciclo` `null` no pousio** (o `culturas.yaml` tem 0 e 0): o pousio não tem ciclo.
- **A cadeia vale também nos planos dos objetivos** (com a nota do eixo): o pedido era "uma regra só". Por isso o
  plano de "Cuidar da terra" deixou de repetir a crotalária nos 3 anos na lavoura de teste.
- **O `best_plan_with_prefix` perdeu o `chain`**: com ele, a regra antiga continuaria a um argumento de distância.
- **O porquê dos objetivos usa as mesmas frases** do grupo `frases_plano` (nenhuma frase nova).
- **O front espera a recomendação antes de pedir os avisos** (em vez de pedir duas vezes): ela quase sempre já está
  no cache da tela 5.

## 6. Testes (TDD)

| Teste | Red |
| --- | --- |
| `test_plan_suggestion_service.py`: o plano pela nota do eixo com a mesma cadeia; sem o pousio quando pedido | `TypeError: … unexpected keyword argument 'axis'` |
| `test_recommendation_service.py`: Plano A e os 4 objetivos = `best_plan_with_prefix` com a cadeia nas 3 faixas, com os `motivos`; o porquê no idioma do pedido | os planos diferiam (milho com braquiária ×3 contra a cadeia); `AttributeError: … 'motivos'` |
| `test_plano_controller.py`: Plano A do `/recomendacao` = `/api/plano/sugestao?fixos=<1º>` (culturas e porquês) nas 3 faixas; `data_limite` e `ciclo` de cada ano; pousio sem os dois | "At index 1 diff: 'milho_braquiaria' != 'crotalaria'"; `KeyError: 'data_limite'` |
| `test_recomendacao_controller.py`: `motivos` no objetivo e no Plano A, `null` no Plano B | campo ausente |
| `test_rotation_plan_service.py`: os testes do `best_plan_starting_with` passam para o `best_plan_with_prefix` (com a cadeia; o "sem a cadeia" pelas regras com os pontos zerados) | refatoração (verde antes e depois) |
| `test_avisos_service.py`: contador só com o "Agora", `perto` `None` sem ler a comunidade, o grupo volta com o service dos vizinhos sem contar; a falta de água e o "deu certo" pela `cultura` (no prazo, fora do prazo, pousio), o resto pela melhor opção, cultura desconhecida | `contador == 4`, `perto` montado; `TypeError: … 'vizinhos_service'` e `… 'cultura'` |
| `test_avisos_controller.py`: `perto` null e o relato do vizinho fora do contador; a comunidade não é lida; `cultura=sorgo`; `cultura=trigo` = 422 | `perto` com o relato; `AssertionError` da comunidade lida; 200 em vez de 422 |
| `test_plan_evaluation_service.py`: prazo e ciclo de cada ano, também nos anos sugeridos | `AttributeError: … 'data_limite'` |
| `avisosRepository.test.ts`, `avisosService.test.ts`, `useAvisosController.test.ts`: `&cultura=` na URL, cache por cultura, os dados de exemplo sem os vizinhos e com a cultura, a cultura do plano no pedido, a espera pela recomendação, a falha da recomendação | URL sem `cultura`, cache juntando culturas, `perto` não nulo, pedido sem a cultura |
| `planService.test.ts`, `planningService.test.ts`, `planningTexts.test.ts`, `PlanningView.test.tsx`: `deadline` de cada cartão, o passo `next` com o prazo do 2º ano, `planDeadlineText`, a coluna "Prazo" do relatório | campos e textos ausentes |

Backend: `uv run pytest` (1847 passaram, 70 pulados), `-m db` no banco de teste, `ruff check` e `ruff format --check`.
Front: `npm test` (147 arquivos, 1442 testes), `npx tsc -b`, `npm run lint`, `npm run build`. `pre-commit run
--all-files` passando.

## 7. Conferência

API de revisão na porta 8017 (cópia do banco), front na 5200, Chrome headless: `curl` do `/api/recomendacao` e do
`/api/plano/sugestao` nas 3 faixas (a tabela da seção 1, antes medida com o código do `main`), `/api/avisos` com e sem
`cultura` (seção 3) e prints de `/plano`, `/planejamento` (com o relatório em modo de impressão) e `/avisos` em 1280 e
360 px, com `escolha=sorgo` na colheita tarde (o plano não começa pela melhor opção): os quadros "Falta de água ·
Sorgo" e "Deu certo · Sorgo" aparecem; a linha do tempo diz "Plante até 15 de março (prazo do ZARC)." no passo da
próxima soja; o relatório tem a coluna "Prazo" (20 de março, 15 de março, 20 de março no exemplo do modo mock); sem
rolagem lateral em 360 px.

## 8. Riscos

- **O Plano A mudou para quem lê o JSON** (a tabela da seção 1). A `nota` do Plano A pode cair um pouco (cedo: 85,0 →
  84,7), porque a nota continua a do PRD 7.7 e a cadeia escolhe pela nota com os pontos dela.
- **Igualdade só com as mesmas entradas:** o `/api/plano/sugestao` não recebe `nematoide`, `gado` nem `confirmadas`;
  com `nematoide=sim`, o Plano A do `/recomendacao` usa o filtro do nematoide e pode ser outro.
- **"Tem a melhor nota do motor" nos objetivos:** a frase fala da nota do motor, mas nos objetivos o ano é escolhido
  pela nota do eixo (ex.: "Mais segurança").
- **Dois pedidos de avisos na tela de avisos:** o sino do cabeçalho pede sem a cultura e a tela pede com ela (o cache
  separa por cultura); a tela também espera a recomendação antes de pedir.
- **O El Niño / La Niña e a safrinha dos avisos** continuam pela melhor opção do motor, mesmo com a cultura do plano.
