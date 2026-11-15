# Tarefa 0040: renda sem reais, dimensão "Renda" só com fatos e sem o selo "Ainda não conectado"

- **Identificador:** `0040`
- **Título:** Nota de renda sem preço nem custo, bloco `renda` na API, nenhum valor em reais no produto e
  nenhum selo "Ainda não conectado" nas telas
- **Status:** Concluída
- **Prioridade:** Alta (seção 1 da remodelagem, S1)
- **PRD:** 7.5 (renda), 7.6 (rótulos), RF-21 (saiu), RF-10 (saiu), 7.11 (saiu)
- **Módulos Afetados:** `app/config_data/regras.yaml`, `app/config_data/culturas.yaml`,
  `app/models/regras.py`, `app/models/crop_option.py`, `app/models/recomendacao.py`,
  `app/repositories/rules_repository.py`, `app/repositories/crop_params_repository.py`,
  `app/services/recommendation_service.py`, `app/services/climate_risk_service.py`,
  `app/schemas/recomendacao.py`; no front, `models/recomendacao.ts`, `services/recomendacaoRules.ts`,
  `controllers/usePlanController.ts`, `repositories/mocks/fixtures.ts`, as views da resposta, das
  opções, do plano, do relatório, de "Como a conta é feita", da tela 4, da tela 3, da missão e da
  comunidade, `design-system/components/{Status,Card}.tsx`, `design-system/icons`, `i18n/`
- **Referências:** pedido de remodelagem de 15/11/2026 (regras gerais e seção 1),
  `docs/remodelagem.md` (S1, decisões D2 e D14 a D20), `AGENTS.md` do front ("Dado que a API ainda não
  manda" e "Nenhum valor em reais")

---

## 1. Descrição

Pedido do usuário (remodelagem, 15/11/2026):

1. **Nenhum valor em reais** em lugar nenhum do produto: API, cartões, opções, plano, relatório,
   "Por quê?" e qualquer outra tela.
2. A dimensão "Dinheiro" passa a se chamar **"Renda"** e mostra só fatos: "Dá grão para vender" ou
   "Não dá grão: é investimento na terra"; "Risco de perder a lavoura: faltou água ou fez calor em N de
   20 anos."
3. A **nota de renda** do motor sem preço nem custo, documentada no `regras.yaml` e em "Como a conta é
   feita".
4. Regra geral: **esconder todos os selos "Ainda não conectado"** (decisão D2): o elemento sem dado
   simplesmente não aparece.

## 2. A regra da renda

| Opção | Dá grão? (`tipo` do `culturas.yaml`) | Nota de renda |
| --- | --- | --- |
| Milho sozinho, sorgo | sim (`grao`) | segurança climática da própria opção: anos sem aperto ÷ anos simulados × 100 |
| Milho com braquiária | sim (`consorcio`) | idem |
| Milheto, crotalária | não (`cobertura`) | `renda.nota_sem_grao` = 0 |
| Deixar parado (plano de 3 anos) | não (`pousio`) | `renda.nota_sem_grao` = 0 |

- No cenário seco do plano (os 4 anos mais secos), a renda do grão é a segurança desses anos.
- A nota final continua com os mesmos eixos e pesos (30% segurança, 25% solo, 30% renda, 15% futuro).
- Rótulos Bom / Médio / Fraco da renda: 70 e 30 (`rotulos.renda_bom` e `renda_medio`, antes
  `dinheiro_*`).
- `regras.yaml`, grupo `renda` (hipótese do time, a revisar):
  - `tipos_com_grao: [grao, consorcio]` (fonte: PRD 5, coluna Função);
  - `nota_sem_grao: 0.0` (fonte: PRD 5, coluna Renda = 0 para pousio, milheto e crotalária).
- Frases (`frases.pt` / `frases.en`): `renda_com_grao`, `renda_sem_grao` e `renda_risco`
  (`{anos_aperto}` = anos com aperto do motor, `{total}` = anos simulados).

Por que assim: quem dá grão só tem renda quando o clima deixa colher, e o motor já conta isso ano a ano
(é o mesmo número da linha "Deu certo"). Quem não dá grão não vende nada naquele ano: o que ele traz é
terra melhor, e isso já pesa no eixo do solo. Nenhum preço, custo ou produtividade entra na conta.

### O que saiu

- `expected_margin`, `worst_dry_year_margin`, o texto "Sobra perto de R$ …" e a nota relativa à maior
  margem.
- `produtividade_padrao_sc_ha`, `preco_padrao_saca` e `custo_padrao_ha` do `culturas.yaml` e do
  `CropParams` (nada mais usava; um YAML antigo com as chaves ainda carrega, e elas são ignoradas).
- A perda de produtividade pelo ISNA (`perda_isna_*`, `perda_fator_*` do grupo `clima`,
  `ClimateRiskService.loss_factor` e `ResultadoAno.fator_perda`): só servia à margem.
- No front: o bloco "Comece por um pedaço" da tela 7 (hectares, sobra, custo da semente e pior ano
  seco; a seção 5b do pedido também previa removê-lo: **feito aqui**), `normalizeHectares`,
  `testAreaTotals`, `formatCurrency`, `formatApproxMoney`, o ícone de nota de dinheiro e os componentes
  `NotConnected`, `NotConnectedCard` e o `status="unavailable"` dos cartões.

## 3. Contrato

`opcoes[]` de `/api/recomendacao` e `/api/exemplo`: o bloco `dinheiro` vira `renda`.

```json
"renda": {
  "da_grao": true,
  "anos_aperto": 6,
  "rotulo": "bom",
  "texto": "Dá grão para vender",
  "risco": "Risco de perder a lavoura: faltou água ou fez calor em 6 de 20 anos."
}
```

- Saem `dinheiro.margem_ha`, `dinheiro.pior_ano_seco_ha` e o `custo_semente_ha` proposto.
- `anos_aperto` = `chuva.anos − chuva.anos_bons` (o total de anos é o `chuva.anos`).
- O motivo da alternativa `mais_dinheiro` passa a `mais_renda`.
- Um teste de rota confere que nem `R$`, nem `dinheiro`, `margem_ha`, `pior_ano_seco_ha`,
  `custo_semente_ha` ou `mais_dinheiro` aparecem no JSON (pt e en, nas duas rotas).

## 4. A melhor opção da lavoura de demonstração (−18,9543 / −48,1993), antes e depois

Banco local (IMERG + POWER, SMAP, CMIP6) e os arquivos de `data/baixados`, medido em 15/11/2026:

| Colheita | Antes (margem em reais) | Depois (renda = segurança) |
| --- | --- | --- |
| cedo | milho sozinho (final 75,5; renda 100) | **milho com braquiária** (final 80,0; renda 90) |
| meio | milho sozinho (final 71,0; renda 100) | **milho com braquiária** (final 72,5; renda 80) |
| tarde | milheto (final 58,8) | milheto (final 58,8) |

- Cedo: braquiária 68,4 → 80,0; sorgo 63,3 → 76,2; milho sozinho 75,5 → 72,5. Meio: braquiária
  57,1 → 72,5; milho sozinho 71,0 → 65,0; sorgo 54,4 → 65,0. Coberturas sem mudança (renda já era 0).
- Tarde: o sorgo passa a ter renda 55 (antes 0, margem negativa) e aparece como "Se você prefere mais
  renda"; o Plano A vira milheto, milheto, sorgo (antes milheto nos 3 anos).
- Plano A da colheita cedo: milho com braquiária nos 3 anos (nota 85,0 contra 84,7 com crotalária no 3º
  ano). O PRD 7.7 não pune a repetição (a penalidade saiu no R4.3): ver "A revisar".
- `/api/exemplo` usa a colheita sugerida pelo NDVI (tarde): milheto antes e depois.
- Com o clima da fixture (NASA POWER, sem banco), a melhor do exemplo na colheita meio também passa do
  milho sozinho ao milho com braquiária (testes de `test_exemplo_dados_reais.py`).

## 5. Sub-tarefas (TDD)

### 5.1 Regras (`regras.yaml`)
- [x] Testes: `test_rules_repository.py` (grupo `renda`, número sem fonte recusado, rótulos
  `renda_*`, frases pt/en, sem `perda_*`).
- [x] Red: `AttributeError: 'Regras' object has no attribute 'renda'`, `KeyError: 'renda'`,
  `AttributeError: 'RegrasRotulos' object has no attribute 'renda_bom'`, `AttributeError:
  'FrasesPorque' object has no attribute 'renda_com_grao'` e `assert not hasattr(clima,
  'perda_fator_alta')` falhando.
- [x] Green: `RegrasRenda`, `Regras.renda`, `FrasesPorque.renda_*`, o YAML.

### 5.2 Motor
- [x] Testes: `test_recommendation_service.py` (renda = segurança no grão e no consórcio, 0 na
  cobertura, cenário seco, fatos pt/en, nenhum `R$` nos textos, regras injetadas, pousio no plano com
  `nota_sem_grao`, rótulo pelos limiares injetados, alternativa `mais_renda`).
- [x] Red: `assert 0.0 == 80.0` (com a fixture sem preço, a margem dava 0 para todos),
  `AttributeError: 'ResultadoOpcao' object has no attribute 'da_grao'` / `'texto_renda'`,
  `TypeError: RegrasRotulos.__init__() got an unexpected keyword argument 'renda_bom'`,
  `TypeError: ResultadoOpcao.__init__() got an unexpected keyword argument 'da_grao'`.
- [x] Green: `gives_grain`, `income_score(crop, seguranca, regras)`, `ResultadoOpcao` com `da_grao`,
  `rotulo_renda`, `texto_renda` e `texto_risco`; saem a margem e a perda pelo ISNA.

### 5.3 Contrato
- [x] Testes: `test_recomendacao_schema.py` (OpenAPI com `RendaSchema` e sem `DinheiroSchema`),
  `test_recomendacao_controller.py` (bloco `renda`, nenhum R$ nas duas rotas e nas duas línguas,
  rótulo pelas regras injetadas), `test_crop_params_repository.py` (sem preço, custo e produtividade).
- [x] Red: `KeyError: 'RendaSchema'`, `KeyError: 'renda'`, `assert 'R$' not in ...` e
  `hasattr(sorgo, 'produtividade_padrao_sc_ha')` verdadeiro.
- [x] Green: `RendaSchema`, `OpcaoSchema.renda`; `culturas.yaml` e `CropParams` sem as chaves de
  dinheiro.

### 5.4 Front
- [x] Testes: `recomendacaoRules.test.ts`, `usePlanController.test.ts`, `useOptionsController.test.ts`,
  `farmRepositories.test.ts` (mock no formato novo, sem R$), `AnswerView`, `OptionsView`, `PlanView`,
  `ReportView`, `MethodView`, `SatelliteView`, `WhenView`, `MissionView`, `CommunityView`,
  `DesignSystemView`, `Status`, `Card`, `format`.
- [x] Red: `TypeError: Cannot read properties of undefined (reading 'texto')` (a view lia
  `dinheiro`), `byAxis[axis] is not a function`, `expected true to be false` (os exports de hectares
  e de reais ainda existiam), `Cannot read properties of undefined (reading 'margin')` (o bloco do
  pedaço), `expected '{"entrada":…' not to contain 'R$'` (mock), e os testes de D2 achando "Ainda não
  conectado" ou o cartão tracejado.
- [x] Green: model, regras, controller do plano, mocks, as views e os textos pt/en.

### 5.5 Documentação
- [x] `AGENTS.md` do backend e do front, PRD (7.5, 7.6, 7.11, RF-10, RF-21), `docs/remodelagem.md`.

## 6. Critérios de Aceitação

1. Nenhum `R$` nas respostas de `/api/recomendacao` e `/api/exemplo` nem em tela nenhuma.
2. Cada opção mostra "Renda" com "Dá grão para vender" ou "Não dá grão: é investimento na terra" e
   "Risco de perder a lavoura: faltou água ou fez calor em N de 20 anos.", em pt e en.
3. A nota de renda segue o grupo `renda` do `regras.yaml` (valor e fonte em cada número).
4. "Como a conta é feita" explica a renda nova em pt e en.
5. Nenhuma tela mostra "Ainda não conectado"; o elemento sem dado não aparece.
6. `pytest`, `ruff`, `vitest`, `lint`, `build` e `pre-commit` verdes.

## 7. A revisar

- **Pesos:** com a renda igual à segurança para quem dá grão, a segurança climática pesa duas vezes
  nessas opções (30% + 30%). A regra pedida mantém os eixos e os pesos; a agrônoma e o time podem
  querer rever o peso da renda.
- **Repetição no plano:** o Plano A da colheita cedo da lavoura de demonstração repete o milho com braquiária nos 3 anos.
  A saúde da terra da rotação (seção 5b) vai mostrar a repetição como fato; a regra do plano não muda
  aqui.
- **Nota fixa sem grão:** 0 (o PRD 5 já dizia renda 0 para as coberturas). Uma nota maior faria as
  coberturas subirem no ranking só por "investir na terra", o que já conta no eixo do solo.
- **Rótulo da renda:** os limiares 70 / 30 continuam os do PRD 7.6; para o grão, eles não coincidem com
  os da chuva (85% / 60%), então a mesma opção pode ter "Médio" na chuva e "Bom" na renda.
