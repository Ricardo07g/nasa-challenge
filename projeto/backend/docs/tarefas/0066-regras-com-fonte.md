# Tarefa 0066: Regras e parâmetros do motor com fonte conferida

- **Identificador:** `0066`
- **Título:** Revisão com fontes científicas e oficiais dos números do `regras.yaml` e do `culturas.yaml`, dos textos
  de prós e contras, do "Como o plano ajuda a ganhar" e do Guia; os números conferidos citam a fonte, os ajustados
  mudam de valor e o resto fica marcado como "Hipótese do time"
- **Status:** Concluída
- **Prioridade:** Alta (pedido do usuário em 15/11/2026)
- **PRD:** RF-49 (nova); ajusta a RF-02/RF-16 (prazos do ZARC na conta), a RF-20 (sinal do outono), a RF-30 (critério
  de "deu certo" por cultura), a RF-39 e a RF-43 (prazo da crotalária) e a RF-46 (Guia)
- **Módulos Afetados:**
  - backend: `config_data/regras.yaml` (fontes, `clima.isna_por_cultura`, `sinal_enso.p_max_seco`,
    `rotacao.culturas_supressoras_nematoide`, `plano_cadeia.culturas_que_multiplicam_nematoide`, frases
    `fora_da_janela_sugerida` e `prazo_sugerido`, grupo `fontes_metodo`), `config_data/culturas.yaml` (prazos,
    `prazo_zarc`, floração da crotalária, pontos de pragas, bloco `fontes`), `models/{crop_option,regras,metodo,
    recomendacao}.py`, `repositories/{crop_params,rules}_repository.py`, `services/climate_risk_service.py`,
    `services/recommendation_service.py`, `services/plan_suggestion_service.py`, `services/sinal_outono_service.py`,
    `services/method_service.py`, `schemas/{metodo,recomendacao}.py`, `pipeline/fetch_oni.py`
  - frontend: `i18n/messages.{pt,en}.ts`, `i18n/planningTexts.ts`, `models/{metodo,recomendacao}.ts`,
    `services/planningService.ts`, `controllers/usePlanningController.ts`, `views/{MethodView,ChooseModals,
    choiceTexts}.tsx/ts`, `repositories/mocks/{mockMetodo,fixtures}.ts`, `content/guia/` (5 artigos em pt e en e
    `verifiedSources.ts`)
- **Referências:** a revisão completa (com o trecho de cada fonte) ficou no relatório de pesquisa da sessão; as
  citações curtas estão na `fonte` de cada número do `regras.yaml`, no bloco `fontes` do `culturas.yaml` e no grupo
  `fontes_metodo`

---

## 1. O que mudou de valor

| Número | Antes | Agora | Fonte |
| --- | --- | --- | --- |
| `culturas.milho_safrinha.semeadura_limite_mes_dia` | 02-28 | **02-10** | ZARC milho 2ª safra MG, Portaria SPA/MAPA nº 324, de 28/07/2026 |
| `culturas.milho_braquiaria.semeadura_limite_mes_dia` | 02-28 | **02-10** | ZARC milho consorciado com braquiária 2ª safra MG, Portaria SPA/MAPA nº 339, de 28/07/2026 |
| `culturas.milheto.semeadura_limite_mes_dia` | 03-15 | **04-20** | ZARC milheto MG, Portaria SPA/MAPA nº 345, de 20/10/2020 |
| `culturas.*.prazo_zarc` (novo) | — | `false` na crotalária e no pousio | Não há ZARC de crotalária nem de plantas de cobertura (portarias de MG, Tábua de Risco, Res. CMN 4.902/2021) |
| `culturas.crotalaria.dias_florescer` | 60 | **70** | Amabile et al. (2000), PAB 35(1); Garcia & Staut (2018), Embrapa CT 44 (estimativa indireta) |
| `culturas.sorgo.nota_solo.pragas` | 15 | **0** | Debiasi et al. (2016), PAB 51(10): sorgo é hospedeiro favorável de *P. brachyurus* |
| `culturas.milho_braquiaria.nota_solo.pragas` | 10 | **0** | Debiasi et al. (2016): as braquiárias tiveram as maiores populações |
| `culturas.milheto.nota_solo.pragas` | 20 | **0** | Debiasi et al. (2016): no campo, o milheto sozinho não diferiu da testemunha |
| `clima.isna_por_cultura` (novo) | — | consórcio 0,50; sorgo 0,45; milheto 0,60 | Portarias SPA/MAPA nº 339/2026, 275/2026 e 345/2020 |
| `rotacao.culturas_supressoras_nematoide` | crotalária, milheto | **crotalária** | Debiasi et al. (2016); Dias et al. (2010), Embrapa Soja CT 76 |
| `plano_cadeia.culturas_que_multiplicam_nematoide` | milho, consórcio | **+ sorgo** | Debiasi et al. (2016) |
| `sinal_enso.p_max_seco` (novo) | — | 0,10 | Teste exato de Fisher (hipergeométrico); nível de Iizumi et al. (2014), Nature Communications 5:3712 |
| `pipeline/fetch_oni.py` (índice do ano) | ONI | **RONI** | NWS Public Information Statement 26-05 (RONI oficial desde 01/02/2026) |

**Regra do prazo (um valor por cultura):** o último dia do último decêndio do ZARC de MG vigente com risco de até 20%,
para cultivar de ciclo curto (Grupo I), no solo que mais guarda água (AD6 no método novo, Tipo 3 no antigo), o mais
cedo entre Uberlândia e Uberaba (SISZARC e Tábua de Risco do MAPA, 13/11/2026). Em solo arenoso o prazo é mais cedo
(milho 10/01 a 31/01; sorgo e milheto 20/02). Por isso a tela diz "o risco sobe e o seguro pode não cobrir" (o ZARC
ainda indica épocas com risco de 30% e 40%) e explica que a data é a do solo que mais guarda água.

**Consequência na lavoura de demonstração:** com a colheita do meio de fevereiro (semeadura em 18/02), o milho
sozinho e o milho com braquiária ficam fora do prazo; a melhor opção no prazo passa a ser a crotalária, e o sorgo
aparece como "mais renda". Na colheita cedo (semeadura em 08/02), o milho com braquiária continua a melhor opção.

**Sinal do outono:** "seco" passa a pedir também que a fase tenha mais anos ruins que os outros anos, com o teste
exato de Fisher unilateral (p de até 0,10). Com 5 anos da fase em 20, a regra da metade sozinha disparava por acaso de
13% a 50% das vezes. Sem diferença, o sinal fica `incerto` com "Nos outros anos, {cultura} falhou tanto quanto: a
fase não muda a conta."

## 2. O que foi confirmado (valor igual, a `fonte` agora cita)

| Número | Valor | Fonte |
| --- | --- | --- |
| `clima.isna_grao` | 0,55 | ZARC milho 2ª safra MG (Port. 324/2026, item 1.14.a); soja MG (Port. 200/2026) |
| `clima.janela_grao_meia_dias` | 15 | Andrade et al. (1999), Crop Science 39(2): período crítico de 31 dias em volta do embonecamento |
| `clima.calor_temp_c` | 35,0 | Hatfield & Prueger (2015), Weather and Climate Extremes 10: pólen do milho acima de 35 °C |
| `culturas.milho_*` floração e ciclo | 60 e 120 | ZARC milho 2ª safra MG, Grupo II: fases 20/40/40/20 (Port. 324/2026, item 1.12) |
| `culturas.sorgo.semeadura_limite_mes_dia` | 03-20 | ZARC sorgo MG (Port. 275/2026), Grupo I, solo Tipo 3, risco 20% |
| `culturas.sorgo.dias_florescer` | 65 | Menezes et al. (2015), Embrapa Milho e Sorgo BPD 127 (média de 61 dias) |
| `culturas.milheto` floração e ciclo | 50 e 90 | Embrapa Milho e Sorgo (2016), Cultivo do Milheto, Tabela 3 |
| `kc_pico` de milho, sorgo e milheto | 1,20; 1,05; 1,00 | FAO-56 (Allen et al., 1998), Tabela 12 |
| `agua.percentil_seco` e `chuva_que_sobra.percentil_seco` | 20 | ZARC: níveis de risco de 20%, 30% e 40%; Sans et al. (2001) |
| `alertas_area.geada_temp_c` | 3,0 | Wrege et al. (2018), Rev. Bras. Climatologia 22 (o ZARC do milho usa < 2 °C) |
| `alertas_area.chuva_forte_mm` | 50,0 | INMET, avisos de Chuvas Intensas ("Perigo" com 50 a 100 mm/dia) |
| `regiao_ndvi.pico_min_ndvi` e `soja_recente.ndvi_minimo` | 0,70 | Risso et al. (2012), PAB 47(9): pico da soja acima de 0,85 |
| `regiao_ndvi.pico_fim` | 03-15 | Risso et al. (2012) |
| `regiao_ndvi.colheita_max_ndvi` | 0,40 | Oliveira et al. (2016), Ciência Rural 46(9); Carneiro de Santana et al. (2024), Remote Sensing 16 |
| `regiao_ndvi.colheita_fim` | 05-15 | Conab, Progresso de safra 2025/26 |
| `enso.el_nino_oni_min` e `la_nina_oni_max` | ±0,5 | NOAA CPC (RONI, NWS PNS 26-05) |
| `culturas.crotalaria.nota_solo.pragas` | 30 | Debiasi et al. (2016); Dias et al. (2010) |

## 3. O que continua hipótese do time (a `fonte` começa com "Hipótese do time")

`clima.isna_cobertura` (crotalária, sem ZARC), `clima.janela_cobertura_dias` (30; o ZARC do milho usa 20 no
estabelecimento), `clima.calor_min_dias` (3), os 4 pesos da nota final, `agua.sede_pouca_ate_mm` e
`sede_muita_desde_mm` (só a ordem milho > sorgo > milheto tem fonte, FAO 1986), `alertas_area.fogo_raio_km` (5 km),
`historico_ndvi.limite_plantou` e `limite_parado` (0,60 e 0,45; o "Embrapa, 2021" não foi encontrado),
`ndvi.queda_colheita` (50% do pico; a literatura usa fração da amplitude), `rotacao.bonus_diversidade_2` e `_3`,
`rotacao.max_pousios`, `sinal_enso.fase_chance_min_pct`, `anos_fase_min` e `fracao_anos_ruins_seco`,
`enso.estacoes`, o prazo da crotalária (02-28), o ciclo do sorgo (115) e da crotalária (100), o Kc da crotalária e o
`n_deixado_kg` (80; a frase do "Por quê?" não mostra mais o número).

**Ajuste indicado e não aplicado:** `regiao_ndvi.pico_inicio` e `soja_recente.janela_inicio` deveriam começar em
1º/dez (no Triângulo o pico da soja pode cair em dezembro: Oliveira et al., 2016), mas a série guardada do NDVI começa
em 1º/jan. Fica para quando os scripts baixarem dezembro.

## 4. Textos

- Backend: frase de solo do "Por quê?" sem os kg/ha de nitrogênio e com "ajuda a baixar o nematoide" (só a
  crotalária); `frases_plano`: "ajuda a baixar o nematoide que o milho e o sorgo multiplicam", "pede pouca água" no
  lugar de "aguenta a seca" (a sede é consumo, não tolerância), `prazo_sugerido` e `fora_da_janela_sugerida` para a
  crotalária.
- Frontend: "deixa nitrogênio na terra" (a soja inoculada tira o seu do ar), "ajuda a baixar o nematoide", "deixa
  menos palha que o milho com braquiária", "adubo verde"; fora do prazo do ZARC, "o risco sobe e o seguro pode não
  cobrir"; na crotalária, "passou da data sugerida", sem ZARC nem seguro (Escolher, modal do prazo, linha do tempo
  do planejamento e resumo falado); o ZARC explicado com solo, ciclo e os níveis de risco. O `messages.test.ts` barra
  as frases antigas.
- "Como a conta é feita": cada regra mostra a fonte (campo opcional `fontes` do `/api/metodo`) e o aviso "ainda não
  validado em campo" só no que é hipótese (toda a regra ou parte dela); o ISNA do ZARC de cada cultura.
- Guia: crotalária (sem ZARC; espécies; nematoide), nematoide (Debiasi et al. 2016 e o nematoide de cisto), El Niño e
  La Niña (RONI; La Niña no Sudeste), prazo do ZARC (solo, ciclo, risco e Proagro) e milho com braquiária (a
  ruziziensis na safrinha).

## 5. Contratos (campos novos, todos opcionais no front)

- `/recomendacao` e `/exemplo`: `opcoes[].prazo_zarc` (padrão `true`).
- `/api/metodo`: `deu_certo.isna_por_cultura_pct` e `fontes` (`{regra: {citacoes: [{citacao, url}], hipotese:
  "nao" | "parte" | "sim"}}`).

## 6. Critérios de aceite

- [x] Cada número conferido cita a fonte; o resto começa com "Hipótese do time" (testes do `regras.yaml` e do
  `culturas.yaml`).
- [x] Valores ajustados com teste antes; testes que dependiam deles atualizados.
- [x] "Como a conta é feita" mostra a fonte de cada regra e o aviso só no que é hipótese.
- [x] Textos sem afirmação que a literatura não sustenta, em pt e en; nenhum número novo nem recomendação nova.
- [x] Guia com as fontes novas em `verifiedSources.ts` e os testes do Guia passando.

---

### Padrão de Qualidade

- TDD obrigatório (Red-Green-Refactor).
- Sem chamadas de rede real nos testes unitários.
- Respeito rigoroso às camadas (Controller → Service → Repository).
