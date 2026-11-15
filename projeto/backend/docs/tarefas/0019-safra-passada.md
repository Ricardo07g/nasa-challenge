# Tarefa 0019: `GET /api/safra-passada` e o service das regras de aviso (P4)

- **Identificador:** `0019`
- **Título:** Replay de uma safrinha passada no ponto, com os avisos de veranico e calor daquele ano
- **Status:** Concluída
- **Prioridade:** Média (Fase 7; o service de avisos é a base do P6)
- **Roteiro:** P4 (Fase 7)
- **Módulos Afetados:** `app/config_data/regras.yaml`, `app/models/regras.py`, `app/models/safra_passada.py`, `app/repositories/rules_repository.py`, `app/services/crop_alert_service.py`, `app/services/past_season_service.py`, `app/schemas/safra_passada.py`, `app/controllers/safra_passada_controller.py`, `app/dependencies.py`, `app/main.py`
- **Referências:** plano de evolução (4.4: P4 e regras do P6; 4.1: P1), PRD (7.2: janela crítica e calor), contrato do front em `projeto/frontend/src/models/pastSeason.ts`

---

## 1. Descrição e Motivação

O front já tem a tela "Como teria sido a safrinha de 2024" e o contrato
`GET /api/safra-passada?lat&lon&ano` → `{ano, opcao, eventos[{data, tipo, texto}]}`, com dado de
exemplo. Esta tarefa entrega a rota com dado real: repete a chuva e o calor de um ano da série do
NASA POWER com a opção que o `/recomendacao` escolhe para o ponto e mostra os avisos que o produtor
teria recebido.

Esta tarefa:

1. Cria o `CropAlertService`: percorre o ciclo dia a dia e monta a linha do tempo (semeadura, fase
   crítica, "parou de chover", aviso de veranico, "voltou a chover", aviso de calor e colheita).
   Recebe a série diária, a cultura e a semeadura, sem saber de onde vem o dado: é o mesmo service
   que o acompanhamento diário (P6) vai usar.
2. Cria o `PastSeasonService`: acha a célula com `find_or_ingest_cell` (a mesma busca sob demanda do
   `/recomendacao`), pega a temporada do ano, a `melhor` opção e a semeadura da faixa de colheita
   pelo `RecommendationService` e passa a série ao `CropAlertService`.
3. Põe os números e os textos (pt e en) no `regras.yaml`, grupos `avisos` e `frases_safra`, com
   fonte em cada número.
4. Liga a rota `GET /api/safra-passada` (controller fino, schema no contrato do front).

---

## 2. Fluxo

```
GET /api/safra-passada?lat&lon&ano[&colheita]   (Accept-Language: pt / en)
        │
        ▼
PastSeasonService.replay
        ├─ find_or_ingest_cell ─────────────► ClimateRepository (PostGIS / fixture) + busca sob demanda
        ├─ temporada do ano ── sem ano ─────► NotFoundError (404 NOT_FOUND)
        ├─ RecommendationService.recommend ─► melhor opção + semeadura da faixa de colheita
        └─ CropAlertService.timeline ───────► eventos (regras.yaml: clima, avisos, frases_safra)
```

---

## 3. Regras de aviso

| Regra | Valor | Fonte |
| --- | --- | --- |
| Fase crítica | grão e consórcio: floração ± 15 dias (evento na floração estimada); cobertura: primeiros 30 dias (evento na semeadura) | PRD 7.2, mesma janela da conta do aperto (`clima` do `regras.yaml`) |
| Dia seco | chuva abaixo de **1 mm** | **hipótese do time, a revisar** (ver 5) |
| Veranico | **10** dias secos seguidos, num dia da fase crítica (a seca pode ter começado antes); um aviso por sequência seca | plano de evolução 4.4 |
| Calor | **2** dias seguidos com máxima de **35 °C** ou mais na fase crítica; um aviso por sequência quente | plano de evolução 4.4; 35 °C de `clima.calor_temp_c` |
| Limite | no máximo **2** avisos em **7** dias corridos que terminam no dia do aviso; o aviso que não cabe espera a primeira vaga, se a sequência ainda durar | plano de evolução 4.4; a janela de 7 dias corridos é **hipótese do time, a revisar** |
| "Parou de chover" | no primeiro dia da sequência seca que gerou aviso | hipótese do time (mesma leitura do dado de exemplo do front) |
| "Voltou a chover" | no primeiro dia com chuva depois de uma sequência que gerou aviso, só antes da colheita, com o total de dias secos | hipótese do time (idem) |
| Colheita | semeadura + `ciclo_dias` do `culturas.yaml` | `culturas.yaml` |

Ficaram de fora porque o contrato do front não tem tipo de evento para eles: ISNA abaixo de 0,55,
50 mm ou mais em 24 h e foco de fogo (FIRMS).

---

## 4. Sub-tarefas (TDD)

### 4.1 Regras no `regras.yaml`
- [x] Testes em `tests/unit/repositories/test_rules_repository.py` (falharam com
  `AttributeError: 'Regras' object has no attribute 'avisos'` / `... 'frases_safra'` e
  `KeyError: 'avisos'`): números do grupo `avisos`, textos pt/en e recusa de número sem fonte.
- [x] `RegrasAvisos` e `FrasesSafra` em `app/models/regras.py`; leitura no `YamlRulesRepository`.

### 4.2 Service das regras de aviso
- [x] `tests/unit/services/test_crop_alert_service.py` (falhou com
  `ModuleNotFoundError: No module named 'app.services.crop_alert_service'`), com séries montadas à
  mão: aviso no 10º dia seco dentro da fase crítica (reproduz o dado de exemplo do front: seca de
  6/abr a 19/abr de 2024, aviso em 15/abr, "voltou a chover" em 20/abr com 14 dias), limiar do dia
  seco, seca fora da fase crítica sem aviso, seca que começa antes da fase, nada de "voltou a
  chover" depois da colheita, calor no 2º dia seguido, um aviso por sequência quente, limite de 2
  avisos em 7 dias, inglês, cobertura (fase crítica na semeadura), texto do consórcio, números
  vindos das regras e série mais curta que o ciclo.
- [x] `app/models/safra_passada.py` e `app/services/crop_alert_service.py`.

### 4.3 Service do replay
- [x] `tests/unit/services/test_past_season_service.py` (falhou com
  `ModuleNotFoundError: No module named 'app.services.past_season_service'`), com repositories
  falsos e o motor do `/recomendacao` por cima deles: 2024 de teste com veranico e calor, ano bom
  sem aviso, inglês, semeadura da faixa `tarde`, ano sem dado (`NOT_FOUND`), ponto sem dado
  (`OUTSIDE_AREA`), busca sob demanda da célula nova, faixa de colheita inválida e nenhuma opção na
  janela.
- [x] `app/services/past_season_service.py`.

### 4.4 Rota
- [x] `tests/integration/controllers/test_safra_passada_controller.py` (falhou com 404: a rota não
  existia): formato do contrato, opção = `melhor` do `/recomendacao`, ano bom, faixa `tarde`, inglês,
  ano sem dado (404 `NOT_FOUND` em problem+json), ponto fora da área (404 `OUTSIDE_AREA`) e 422
  `INVALID_REQUEST` para `ano` inválido ou ausente, `lat` fora da faixa e `colheita` inválida.
- [x] `app/schemas/safra_passada.py`, `app/controllers/safra_passada_controller.py`,
  `get_crop_alert_service` e `get_past_season_service` em `dependencies.py`, `include_router` no
  `main.py`.
- [x] Teste com os arquivos reais em `test_exemplo_dados_reais.py`: na fazenda de exemplo, 2024 tem
  aviso de veranico em 28/abr e 2023 passa sem aviso.

---

## 5. Decisões a revisar

- **Dia seco abaixo de 1 mm.** O 4.4 do plano de evolução não define o dia seco do aviso; o 4.1 (P1)
  usa 5 mm para a maior sequência seca. Com 5 mm, a fazenda de exemplo (milho sozinho, colheita no
  meio de fevereiro) teria aviso de veranico em **19 de 20 anos** (2023 com dois), porque as chuvas
  acabam em abril, dentro da fase crítica. Com 1 mm (o dia seco do índice CDD do ETCCDI/OMM), o
  aviso sai em **11 anos**, incluindo os **7** em que o motor marca aperto (2005, 2007, 2010, 2016,
  2020, 2022, 2024), e 2023 passa sem aviso, como o front e o plano esperam. Se o P1 ficar com 5 mm,
  a frase do quadradinho e a linha do tempo vão contar dias secos diferentes para o mesmo ano:
  decidir um só limiar com a agrônoma (é só trocar `avisos.dia_seco_abaixo_mm`).
- **Semana do limite de avisos:** 7 dias corridos que terminam no dia do aviso.
- **Textos** (`frases_safra`): rascunho para a agrônoma revisar.
- **Opção do replay:** a `melhor` do `/recomendacao` com a faixa de colheita (padrão `meio`) e sem
  `solo`, `nematoide` e `gado`, que o front ainda não manda para esta rota.

---

## 6. Exemplo (fazenda de exemplo, 2024, `Accept-Language: pt-BR`)

```json
{
  "ano": 2024,
  "opcao": "milho_safrinha",
  "eventos": [
    {"data": "2024-02-18", "tipo": "semeadura", "texto": "Semeadura: Milho sozinho."},
    {"data": "2024-04-18", "tipo": "fase_critica", "texto": "Floração, por volta desta data: a fase que mais precisa de água."},
    {"data": "2024-04-19", "tipo": "sem_chuva", "texto": "Parou de chover."},
    {"data": "2024-04-28", "tipo": "aviso_veranico", "texto": "Aviso: 10 dias sem chuva perto da fase que mais precisa de água. Converse com o agrônomo."},
    {"data": "2024-06-17", "tipo": "colheita", "texto": "Colheita: Milho sozinho."}
  ]
}
```

---

## 7. Critérios de Aceitação

1. **TDD:** cada comportamento novo com teste escrito antes e visto falhando (erros acima).
2. **Camadas:** controller fino; regras só no `CropAlertService` e no `PastSeasonService`; dado só
   nos repositories; números e textos no `regras.yaml`, com fonte.
3. **Sem rede e sem banco** nos testes.
4. `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` e
   `pre-commit run --all-files` passando.

---

## 8. Fora do escopo

- Linha do roteiro e da tabela de `docs/tarefas/README.md` (atualizadas por quem integra a Fase 7).
- Front: trocar o mock pela rota e tratar o 404 `NOT_FOUND` de ano sem dado ("Sem dado deste ano").
- `colheita`, `solo`, `nematoide` e `gado` na chamada do front, para o replay usar a mesma opção que a
  tela do plano mostra quando o produtor muda essas respostas.
- A janela crítica está escrita no `CropAlertService` com a mesma fórmula do `ClimateRiskService`;
  juntar as duas numa função só quando a trilha do motor (P1) mexer nele.
