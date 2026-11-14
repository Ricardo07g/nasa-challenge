# Tarefa 0007: alternativas só quando superam a `melhor` no próprio eixo (R4.2)

- **Identificador:** `0007`
- **Título:** Alternativas "Se você prefere…" melhores que a `melhor` no próprio eixo, sem repetir cultura
- **Status:** Concluída (regra **a revisar** com o produto: ver seção 5)
- **Prioridade:** Alta (a tela 5 mostrava alternativa pior que a resposta)
- **Roteiro:** R4.2 (Fase 4, trilha Motor; depende do R4.1, tarefa 0006)
- **Módulos Afetados:** `app/services/recommendation_service.py`
- **Referências:** [PRD – Raiz Orbital](../../../../arquivos%20contexto/PRD%20%E2%80%93%20Raiz%20Orbital%20o%20que%20plantar%20depois%20da%20soja.md) (RF-05, T-05), [plano técnico do backend](../../../../arquivos%20contexto/Raiz%20Orbital%20%E2%80%93%20plano%20t%C3%A9cnico%20do%20backend.md) (§4.5), roteiro §5 ("Regra das alternativas")

---

## 1. Descrição e Motivação

O PRD (RF-05) e o plano técnico (§4.5) dizem "alternativas = a melhor em cada eixo isolado (segurança,
renda, solo), sem repetir a `melhor`". O `_build_alternatives` pegava o máximo de cada eixo entre as
outras opções **sem comparar com a `melhor`** e **repetia cultura** entre eixos. Com os dados reais da
fazenda de exemplo:

| Colheita | `melhor` | Antes | Problema |
| --- | --- | --- | --- |
| `meio` | milho safrinha (renda 100) | risco: crotalária · dinheiro: **sorgo (renda 18)** · terra: crotalária | "mais dinheiro" com renda 18 contra 100; crotalária em dois eixos |
| `cedo` | milho safrinha (renda 100) | risco: crotalária · dinheiro: milho + braquiária (44) · terra: crotalária | idem |
| `tarde` | milheto | sorgo nos três eixos | o sorgo perde do milheto em segurança, renda e solo |

## 2. Regra adotada (padrão da Onda 1, a revisar)

`build_alternatives(opcoes, melhor_id)` em `recommendation_service.py`:

1. Os eixos seguem a ordem da tela: `menos_risco` (segurança), `mais_dinheiro` (renda),
   `cuidar_da_terra` (solo).
2. Um eixo só aparece se alguma opção ainda não usada tem nota **maior** que a da `melhor` nesse eixo
   (empatar com a `melhor` não conta).
3. Entre as candidatas, vence a de maior nota no eixo. No empate, a opção que é a **única maior de um
   eixo seguinte** fica para ele; depois, vale a maior nota final (o mesmo desempate da tela 6 no front).
4. Uma cultura aparece em um eixo só. Sem candidata, o eixo some (a lista pode ter 0 a 3 itens).

Depois, com os dados reais:

| Colheita | `melhor` | Alternativas |
| --- | --- | --- |
| `cedo` e `meio` | milho safrinha | risco: milheto (95 contra 90/65) · terra: crotalária (85 contra 20) |
| `tarde` | milheto | nenhuma |

---

## 3. Sub-tarefas (TDD)

- [x] Teste de integração com os arquivos reais (`test_exemplo_dados_reais.py`, colheita `meio`):
  cada alternativa supera a `melhor` no seu eixo, sem repetir cultura, e não há "mais dinheiro"
  quando o milho tem renda 100. Falhou com
  `AssertionError: assert 'mais_dinheiro' not in {'cuidar_da_terra', 'mais_dinheiro', 'menos_risco'}`.
- [x] Testes unitários de `build_alternatives` (caso real, empate no eixo e empate com a `melhor`,
  eixo que some porque a única candidata já foi usada, nenhuma candidata). Falharam primeiro com
  `ImportError: cannot import name 'build_alternatives'`.
- [x] Refinamento do desempate: o caso real pedia "risco: milheto, terra: crotalária". A primeira
  versão (desempate só pela nota final) dava "risco: crotalária, terra: milheto". O teste falhou com
  `Alternativa(motivo='menos_risco', opcao='crotalaria') != Alternativa(motivo='menos_risco', opcao='milheto')`
  e passou com a regra 3 acima.
- [x] `build_alternatives` como função do service (no lugar do `_build_alternatives` estático).
- [x] Teste de contrato (`test_recomendacao_controller.py`) atualizado: antes exigia os três motivos;
  com os dados falsos (todas as opções com 18 anos bons, milho com a maior renda) sobra só
  `cuidar_da_terra: crotalaria`.

---

## 4. Critérios de Aceitação

1. **TDD:** testes escritos antes e vistos falhando (erros acima).
2. Nenhuma alternativa pior ou igual à `melhor` no próprio eixo; nenhuma cultura repetida; pousio
   nunca aparece (já fica fora das opções).
3. O contrato do JSON não muda (`alternativas: [{motivo, opcao}]`); só a quantidade de itens pode ser
   menor que 3.
4. `uv run pytest` (144 testes), `uv run ruff check .`, `uv run ruff format --check .` e
   `pre-commit run` nos arquivos da branch passando.

---

## 5. A revisar com o produto

- **Decisão pendente** (roteiro §5, "Regra das alternativas"): pular o eixo, pegar a segunda, ou mostrar
  só se for melhor que a `melhor`. Este PR adota a última, sem repetir cultura. Se o produto escolher
  outra, a mudança fica toda em `build_alternatives` e nos testes dele.
- **Ordem dos eixos e desempate:** a prioridade segue a ordem da tela. Se uma cultura for a única maior
  em dois eixos, fica no primeiro (risco antes de dinheiro antes de terra).
- **Texto do PRD e do plano técnico:** RF-05 e §4.5 ainda dizem "a melhor em cada eixo isolado". Atualizar
  o texto quando o produto fechar a regra.
- **Front:** `buildAnswer` (`projeto/frontend/src/services/recomendacaoRules.ts`) só mapeia o que vier
  (e ignora id que não existe nas opções) e o `AnswerView` esconde a seção "Se você prefere…" quando a
  lista fica vazia. Lista menor funciona sem mudar o front: o próprio mock
  (`repositories/mocks/fixtures.ts`, `melhor: milho_braquiaria`) já devolve só duas alternativas com
  colheita `tarde`. Não há teste no front para a lista vazia.
