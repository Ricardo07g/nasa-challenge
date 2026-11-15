# Tarefa 0020: `dinheiro.pior_ano_seco_ha` em `/recomendacao` (A1.2, parte do pior ano)

- **Identificador:** `0020`
- **Título:** Margem por hectare do pior dos anos mais secos em cada opção
- **Status:** Concluída (só a parte do pior ano; `custo_semente_ha` espera o valor da agrônoma, A1.1)
- **Prioridade:** Alta (tela 7: "Quantos hectares quer testar?", RF-21)
- **Roteiro:** A1.2 (Fase 6, ajuste A1). Empilhada sobre a tarefa 0015 (A2.4), que está sobre a 0016 (R4.3)
- **Módulos Afetados:** `app/services/recommendation_service.py`, `app/models/recomendacao.py`, `app/schemas/recomendacao.py`
- **Referências:** PRD (7.5, 7.7, 7.11, RF-21, T-17), plano de evolução (ajuste A1), contrato do front `Opcao.dinheiro.pior_ano_seco_ha?: number` em `projeto/frontend/src/models/recomendacao.ts`

---

## 1. Descrição e Motivação

O cartão "Quantos hectares quer testar?" (RF-21) mostra o pior caso num ano seco em reais: margem do pior
ano entre os mais secos da série × hectares (PRD 7.11). O front já faz a conta × hectares
(`testAreaTotals` em `recomendacaoRules.ts`), mas a API não mandava o valor por hectare.

## 2. Regra

- `pior_ano_seco_ha` = **menor margem por hectare** entre os anos que o
  `RotationPlanService.select_driest_years` escolhe (os `rotacao.anos_secos` = 4 anos com menos chuva de
  fevereiro a abril, a mesma base do Plano B do PRD 7.7).
- A margem de cada ano é a conta do motor (PRD 7.5): produtividade × (1 − perda pelo ISNA daquele ano) ×
  preço − custo (`expected_margin` com um ano só). É o **pior ano**, não a média dos anos secos (a média
  já entra na renda do cenário seco).
- Cobertura (crotalária, milheto) não dá grão: em qualquer ano sobra −custo. O front mostra "faltaria".
- Função `worst_dry_year_margin(crop, anos_secos)` no service; `None` só se não houver ano seco (não
  acontece com série: sem anos, a API já responde `OUTSIDE_AREA`).
- **JSON:** `opcoes[].dinheiro.pior_ano_seco_ha` (número). Sem valor, a **chave não vai** (em vez de
  `null`): o front testa `=== undefined`, e um `null` viraria "R$ 0" na conta × hectares (`null × 50 = 0`
  no JavaScript). O serializador do `DinheiroSchema` fica sem tipo de retorno de propósito: com ele, o
  OpenAPI (`/docs`) perdia os campos do `dinheiro` (há teste para isso).
- **Fora:** `custo_semente_ha` (espera o valor da agrônoma, A1.1). Teste de contrato confere que não sai.

## 3. Valores na fazenda de exemplo

Arquivos reais, colheita `meio`, solo padrão (médio), anos secos 2007, 2010, 2012 e 2014.

| Opção | `margem_ha` (20 anos) | `pior_ano_seco_ha` |
| --- | ---: | ---: |
| Milho sozinho | 344,00 | −1.516,00 (80 sc × 0,4 × R$ 62 − R$ 3.500: perda de 60%) |
| Crotalária | −800,00 | −800,00 |
| Milheto | −600,00 | −600,00 |
| Sorgo | 61,76 | −1.009,60 (60 × 0,4 × 49,6 − 2.200) |
| Milho com braquiária | −148,20 | −1.915,20 (76 × 0,4 × 62 − 3.800) |

Para comparar: com colheita `cedo`, milho −28,00, milho com braquiária −501,60 e sorgo −116,80; com
`tarde`, sorgo −1.009,60.

## 4. Sub-tarefas (TDD)

- [x] Service (`test_recommendation_service.py`): pior ano com os 4 anos secos sem chuva (milho −1.516,
  crotalária −800); pior ano e não a média (só 2007 seco: −1.516, não 716); quantidade de anos secos
  vinda das regras injetadas. Falharam com
  `AttributeError: 'ResultadoOpcao' object has no attribute 'pior_ano_seco_ha'`.
- [x] Contrato (`test_recomendacao_controller.py`): o teste que fixava `dinheiro` com três chaves passou a
  esperar quatro, com o valor do milho (2007 e 2014 secos nos dados falsos: −1.516), e confere que
  `custo_semente_ha` não sai. Falhou com o conjunto de chaves sem `pior_ano_seco_ha` e
  `KeyError: 'pior_ano_seco_ha'`.
- [x] Schema (`tests/unit/schemas/test_recomendacao_schema.py`): o valor vai no `dinheiro`; sem valor, a
  chave não vai; o `/docs` mantém os campos. O teste do `/docs` foi escrito depois de ver o OpenAPI com
  `{"additionalProperties": true, "type": "object"}` no `DinheiroSchema`; com o tipo de retorno de volta no
  serializador, ele falha com `KeyError: 'properties'`.

## 5. Critérios de Aceitação

1. **TDD:** testes escritos antes e vistos falhando (erros acima).
2. Campo opcional no formato do front; nada de `custo_semente_ha`.
3. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e `pre-commit run --all-files`
   passando.
