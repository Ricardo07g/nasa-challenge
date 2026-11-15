# Tarefa 0047: Comunidade ("Na sua região", `/comunidade`)

- **Identificador:** `0047`
- **Título:** Relatos da comunidade sem cadastro (plantio, chuva e evento): tabela `community_report`, rotas de enviar, listar e apagar, e a tela "Na sua região" refeita como o primeiro passo de uma comunidade local
- **Status:** Concluída na branch `feat/remodelagem-s7-comunidade` (falta o merge em `feat/remodelagem`, aplicar a migração no banco de desenvolvimento e a revisão)
- **Prioridade:** Média (seção 7 da remodelagem, S7)
- **PRD:** RF-28 (novo) e RNF-10 (privacidade da comunidade, reescrito); RF-13 a RF-15 apontam para o RF-28
- **Módulos Afetados:**
  - backend: `migrations/versions/3f7c2a9d4e81_relatos_da_comunidade.py`, `app/models/community_report.py`, `app/repositories/community_report_repository.py`, `app/services/community_report_service.py`, `app/schemas/community_report.py`, `app/controllers/community_report_controller.py`, `app/services/errors.py` (`TooManyReportsError`, `CommunityUnavailableError`), `app/models/regras.py` e `app/repositories/rules_repository.py` (grupo `comunidade`), `app/config_data/regras.yaml`, `app/config.py` (`community_device_salt`), `app/constants.py` (`PILOT_UTC_OFFSET_HOURS`), `app/dependencies.py`, `app/main.py`, `.env.example`;
  - front: `models/community.ts`, `repositories/communityRepository.ts`, `repositories/deviceRepository.ts`, `repositories/httpClient.ts` (`sendJson` e cabeçalhos no `getJson`), `repositories/mocks/mockCommunity.ts`, `repositories/index.ts`, `services/communityService.ts`, `controllers/useCommunityController.ts`, `controllers/useSatelliteController.ts` (compartilhar), `views/CommunityView.tsx`, `views/CommunityForms.tsx`, `views/ShareSeasons.tsx`, `views/SatelliteView.tsx`, `design-system/components/ReportsMap.tsx`, `design-system/components/Choice.tsx` (`MeasureField`), `pages.tsx`, `i18n/messages.{pt,en}.ts` (só acréscimos no bloco `community`).
- **Referências:** pedido de remodelagem de 15/11/2026 (seção 7), `projeto/backend/docs/remodelagem.md` (D42 a D54), `projeto/backend/AGENTS.md` ("Relatos da comunidade"), `projeto/frontend/AGENTS.md` ("Comunidade")

---

## 1. O que foi feito

- **Contar (três relatos, no máximo três toques cada):**
  - "O que plantei depois da soja": cultura (as 6 do `culturas.yaml`, com o `pousio` como "Deixei parado", mais "Outra"), a safra (a mais recente já vem marcada) e "Como foi?" ("Foi bem", "Mais ou menos", "Perdi"); se perdeu, "Por que perdeu?" (seca, calor, geada, granizo, praga, outro motivo). "Deixei parado" não pergunta como foi. Toques: cultura, como foi e, se perdeu, o motivo (o "Enviar" confirma).
  - "Choveu aqui": milímetros (aceita vírgula) e a data, com hoje já preenchido (de 30 dias atrás até hoje).
  - "Aconteceu aqui": fogo, granizo, geada, vendaval, enxurrada ou erosão, praga ou doença, e a data. Com fogo: "Em caso de fogo, ligue 193 (Bombeiros)." com o botão "Ligar 193" (`tel:193`).
  - Antes do primeiro envio que deu certo: "Seus vizinhos veem a região, não o seu ponto." (lembrado no aparelho).
  - Só conta quem marcou a própria lavoura: sem ponto na URL, ou na fazenda de exemplo, a tela pede "Marcar minha lavoura" (`/onde`).
- **Ver a redondeza (30 km):**
  - Resumo "Perto de você": "N vizinhos contaram o que fizeram depois da soja em [ano]: X milho com braquiária, Y milheto…" e "K de N disseram que foi bem" (a safra mais recente com relatos); a chuva dos últimos 7 dias ("os pluviômetros marcaram em média X mm (N relatos)"); os eventos dos últimos 30 dias, do mais recente para o mais antigo. Cada linha e cada evento com o selo "Relato de vizinho, não confirmado".
  - "Ao lado do que o satélite mediu" não aparece: não há chuva recente do satélite ligada (o IMERG Late está fora do sinal e o banco só tem janeiro a julho).
  - Mapa: o círculo de 30 km em volta da lavoura (tracejado, explicado em texto), um marcador por célula de 0,1° com relatos, e em cada um o ícone e o número de cada tipo (plantio, chuva, evento); legenda em texto embaixo e a lista completa para o leitor de tela. "Cada marca é um quadrado de cerca de 10 km, nunca uma fazenda."
  - "Seus relatos", com "Apagar" (só este aparelho apaga).
  - Sem relatos: "Ainda não há relatos perto de você. Seja o primeiro a contar." Nenhum relato falso: os exemplos existem só no modo `mock` (`VITE_API_MODE=mock`, desligado por padrão), cada um com o selo "Exemplo".
- **O bloco da região pelo satélite (NDVI)** ficou como estava: sem o arquivo da região, a API responde 404 e o bloco não aparece.
- **Ligações:**
  - Tela 4 (`/satelite`), bloco "Confirme as últimas safras" (tarefa 0039): depois de confirmar, "Compartilhar com a comunidade" abre uma linha por safra confirmada; "Deixei parado" vai pronto, "Plantei" pergunta a cultura e como foi; "Enviar" grava o relato de plantio daquela safra. Não aparece na fazenda de exemplo.
  - No fim da tela, a entrada para o Guia (já existia).
  - **Sem link, por enquanto:** os artigos "Fogo na palha" (relato de fogo) e "Como evitar erosão" (relato de enxurrada ou erosão) ainda não existem no Guia (D9). O link entra quando o artigo for escrito.

## 2. Banco: tabela `community_report` (migração `3f7c2a9d4e81`, revisa `6e961f333ddc`)

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `uuid` | `gen_random_uuid()`, chave |
| `report_type` | `text` | tipo do relato: `plantio`, `chuva`, `evento`. Texto aberto para os tipos futuros (oferta, troca, empréstimo), que o service ainda recusa |
| `subtype` | `text` (nulo) | cultura (plantio), evento (evento); nulo na chuva |
| `details` | `jsonb` | os valores: `{"ano", "resultado", "motivo"}` (plantio), `{"mm"}` (chuva), `{}` (evento) |
| `cell_id` | `text` | célula de 0,1° do `cell_id_for`; `CHECK` no formato `<int>_<int>`: a coordenada exata não cabe |
| `fact_date` | `date` (nulo) | data da chuva ou do evento; nula no plantio |
| `sent_at` | `timestamptz` | data e hora do envio (do service) |
| `device_hash` | `text` | HMAC-SHA-256 do identificador do aparelho com o `COMMUNITY_DEVICE_SALT`; `CHECK` de 64 dígitos hexadecimais |

Índices: `(cell_id, fact_date)` para a listagem e `(device_hash, sent_at)` para o limite por aparelho. O `downgrade` apaga a tabela. **A migração não foi aplicada no banco `raiz_orbital` de desenvolvimento** (fica para o orquestrador); os testes `db` aplicam no banco de teste.

## 3. Rotas

O aparelho se identifica pelo cabeçalho `X-Aparelho` (letras, números e hífen, de 8 a 64; o front manda um UUID v4 aleatório).

### `POST /api/comunidade/relatos` (201)

```http
POST /api/comunidade/relatos
X-Aparelho: 6f1c2d3e-4a5b-4c6d-8e7f-001122334455
Content-Type: application/json

{"tipo": "chuva", "subtipo": null, "valores": {"mm": 32.46}, "lat": -18.9543, "lon": -48.1993, "data_fato": "2026-11-15"}
```

```json
{"id": "0b6e…", "tipo": "chuva", "subtipo": null, "valores": {"mm": 32.5}, "celula": "-190_-482",
 "lat": -18.95, "lon": -48.15, "data_fato": "2026-11-15", "meu": true}
```

Outros corpos: `{"tipo": "plantio", "subtipo": "milho_braquiaria", "valores": {"ano": 2026, "resultado": "perdi", "motivo": "seca"}, "lat": …, "lon": …}` e `{"tipo": "evento", "subtipo": "fogo", "valores": {}, "lat": …, "lon": …, "data_fato": "2026-11-14"}`. Campo a mais no corpo (ex.: `nome`) é recusado.

### `GET /api/comunidade/relatos?lat&lon[&raio_km]` (200)

`X-Aparelho` opcional (marca os meus com `meu: true`). `raio_km` padrão 30, máximo 50.

```json
{"raio_km": 30.0, "anos_safra": [2024, 2025, 2026],
 "relatos": [{"id": "0b6e…", "tipo": "evento", "subtipo": "granizo", "valores": {}, "celula": "-189_-482",
              "lat": -18.85, "lon": -48.15, "data_fato": "2026-11-12", "meu": false}]}
```

A resposta nunca traz o aparelho, o hash, a hora do envio nem o ponto exato: só a célula e o centro dela.

### `DELETE /api/comunidade/relatos/{id}` (204)

Com o `X-Aparelho` de quem enviou. De outro aparelho ou inexistente: 404 `NOT_FOUND` (não diz qual dos dois).

### Erros (problem+json)

| Situação | Status | `code` |
| --- | --- | --- |
| Corpo, cabeçalho ou parâmetro fora do formato (sem `X-Aparelho`, campo a mais, `lat` fora de −90 a 90, `id` que não é UUID) | 422 | `INVALID_REQUEST` |
| Regra do relato (chuva fora de 0 a 300 mm, data futura ou de mais de 30 dias, ano fora das últimas safras, valor fora da lista, ponto fora da área piloto, raio acima de 50 km, tipo futuro) | 422 | `VALIDATION_ERROR` |
| Mais de 10 relatos do aparelho nas últimas 24 horas | 429 | `TOO_MANY_REPORTS` |
| Relato de outro aparelho ou inexistente | 404 | `NOT_FOUND` |
| Sem banco (`DATABASE_URL` vazia) | 503 | `COMMUNITY_UNAVAILABLE` |

## 4. Regras (no `CommunityReportService`; números no grupo `comunidade` do `regras.yaml`)

- `raio_km` 30 (pedido), `raio_max_km` 50 (hipótese do time), `chuva_max_mm` 300 (pedido), `dias_atras_max` 30 (pedido), `max_relatos_por_dia` 10 (hipótese do time; o pedido dá 10 como exemplo).
- "Hoje" é o dia de Uberlândia (UTC-3, `PILOT_UTC_OFFSET_HOURS`), não o do servidor em UTC.
- O limite conta os relatos do aparelho nas **últimas 24 horas** (janela que corre, não o dia do calendário).
- Plantio: o ano precisa ser uma das últimas safras (`FieldHistoryService.confirmable_years()`: 2024, 2025 e 2026, as mesmas da tela 4); `resultado` obrigatório, menos no `pousio` (que não tem resultado nem motivo); `motivo` obrigatório só com `perdi`. Um novo plantio do mesmo aparelho e do mesmo ano **substitui** o anterior.
- Redondeza: as células cujo centro fica a até `raio_km` do ponto (haversine; de 24 a 26 células em 30 km na área piloto), com a chuva e os eventos dos últimos 30 dias e o plantio das últimas safras, do mais novo ao mais velho.

## 5. Privacidade

- Guardamos só a célula de 0,1° (cerca de 11 km × 10,5 km), nunca a coordenada: o ponto chega no corpo do `POST` (não vai para o log de acesso, que só registra o caminho) e é descartado depois do `cell_id_for`. O `CHECK` da tabela recusa coordenada no lugar da célula.
- O identificador do aparelho é aleatório, criado no aparelho, sem nome, telefone ou e-mail; o banco guarda só o HMAC-SHA-256 com o sal (`COMMUNITY_DEVICE_SALT`, segredo fora do código; vazio = sal aleatório por processo, D44).
- Sem texto livre: cada tipo aceita só os campos dele, com valores de listas fechadas ou número conferido.
- A listagem mostra a célula (o centro dela) e nunca o aparelho, o hash, a hora do envio ou o ponto exato.
- ⚠️ O `GET` da listagem leva `lat` e `lon` na query (como `/talhao` e `/regiao`), que podem ir para o log de acesso do servidor.

## 6. Testes (TDD)

Cada teste foi escrito antes do código e visto falhando pelo motivo certo, salvo onde está dito:

| Teste | Red |
| --- | --- |
| `tests/unit/repositories/test_community_rules.py` | `AttributeError: 'Regras' object has no attribute 'comunidade'` e `KeyError: 'comunidade'` |
| `tests/unit/services/test_community_report_service.py` (71 casos) | `ModuleNotFoundError: app.models.community_report`; depois, `AttributeError: 'CommunityReport' object has no attribute 'lat'` (o envio passou a devolver a visão do vizinho, sem o hash) |
| `tests/integration/db/test_community_report_db.py` (marker `db`) | `ImportError: PostgisCommunityReportRepository`; depois, `UndefinedTable: relation "community_report" does not exist` (repository antes da migração) |
| `tests/integration/db/test_migracao_fontes_novas.py` (existente) | falhou com a migração nova: o `downgrade -1` só desfazia a 0047; passou a descer até a migração inicial |
| `tests/integration/controllers/test_community_report_controller.py` (13 casos) | `ImportError: cannot import name 'get_community_report_service'` |
| `tests/unit/test_community_dependencies.py` e o teste de ponta a ponta da API com banco | escritos logo depois da ligação no `dependencies.py` (passaram de primeira) |
| `repositories/httpClient.test.ts` | 4 falhas: `sendJson` inexistente e cabeçalhos ignorados |
| `repositories/communityRepository.test.ts`, `repositories/deviceRepository.test.ts` | módulos inexistentes |
| `services/communityService.test.ts` (32 casos) | 26 falhas: `service.nearby is not a function` |
| `design-system/components/Choice.test.tsx` (`MeasureField`) | "Element type is invalid… got: undefined" |
| `design-system/components/ReportsMap.test.tsx` | o primeiro não foi rodado antes do componente; a legenda: "Unable to find … role list and name Legenda" |
| `controllers/useCommunityController.test.ts` (14 casos) | 14 falhas (controller antigo) |
| `views/CommunityView.test.tsx` (23 casos) | 17 falhas (tela antiga) |
| `controllers/useSatelliteController.test.ts` (compartilhar, 5 casos) | 5 falhas (sem `share`) |
| `views/ShareSeasons.test.tsx`, `views/SatelliteView.test.tsx` (botão) | módulo inexistente; 1 falha (sem o botão) |
| `routes.test.tsx` (existente) | falhou com o texto da comunidade simulada; passou a conferir "Perto de você" com o selo "Exemplo" |

Rodar os testes com banco: `TEST_DATABASE_URL=postgresql://raiz:raiz_local@localhost:5433/raiz_orbital_test_s7 uv run pytest -m db`.

## 7. O que ficou de fora e por quê

- **Chuva do satélite ao lado da chuva relatada:** sem chuva recente do satélite ligada (o pedido diz "quando houver dado recente").
- **Área queimada do MODIS no mapa:** depende da seção 4 (o MCD64A1 ainda não foi baixado).
- **Links "Fogo na palha" e "Como evitar erosão":** os artigos ainda não existem no Guia (D9).
- **Tipos futuros** (oferta, troca, empréstimo): a coluna aceita, o service recusa.
- **Moderação e denúncia de relato falso:** não há (sem cadastro, o freio é o limite por aparelho e o selo "não confirmado").
