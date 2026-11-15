# Tarefa 0041: Onde fica a lavoura (`/onde`)

- **Identificador:** `0041`
- **Título:** Busca de endereço com autocompletar (Photon), coordenadas e link do Google Maps colados, "Confirmar local" com o endereço aproximado do pino e o limite da área piloto com bloqueio fora dela
- **Status:** Concluída na branch `feat/remodelagem-s2-onde` (falta o merge em `feat/remodelagem` e a revisão)
- **Prioridade:** Alta (seção 2 da remodelagem, S2)
- **PRD:** RF-01 (reescrito) e RNF-07 (atribuição do OpenStreetMap)
- **Módulos Afetados:**
  - backend: `app/models/pilot_area.py`, `app/services/pilot_area_service.py`, `app/schemas/pilot_area.py`, `app/controllers/pilot_area_controller.py`, `app/dependencies.py`, `app/main.py`;
  - front: `services/locationInputService.ts`, `services/geocodingService.ts`, `services/pilotAreaService.ts`, `services/locationService.ts`, `repositories/geocodingRepository.ts`, `repositories/pilotAreaRepository.ts`, `repositories/httpClient.ts` (`getExternalJson`), `repositories/mocks/mockLocation.ts`, `repositories/index.ts`, `models/place.ts`, `models/area.ts`, `controllers/useWhereController.ts`, `controllers/useDebouncedRequest.ts`, `views/WhereView.tsx`, `design-system/components/PlaceSearch.tsx`, `design-system/components/MapPicker.tsx`, `design-system/icons` (`SearchIcon`), `pages.tsx`, `i18n/messages.{pt,en}.ts` (só o bloco `where`).
- **Referências:** pedido de remodelagem de 15/11/2026 (seção 2), `projeto/backend/docs/remodelagem.md` (D3, D21 a D30), `projeto/frontend/AGENTS.md` ("Busca de endereço" e "Área piloto")

---

## 1. O que foi feito

- **Busca "Buscar cidade, estrada ou endereço"** com autocompletar pelo Photon (komoot, dados do OpenStreetMap, sem chave): espera de 400 ms depois da última tecla, um pedido por vez (o anterior é cancelado com `AbortController`), mínimo de 3 letras, até 5 lugares, preferência pelo centro da área piloto (`lat`/`lon`, não `bbox`, para ainda achar um lugar de fora e mostrar o aviso). Lista acessível (padrão *combobox* do WAI-ARIA 1.2): setas, Enter (sem nada marcado, a primeira opção), Esc, toque; situação da busca num `role="status"` ("Achamos 3 lugares…", "Procurando…", "Não achamos…", erro). "Endereços: © OpenStreetMap" sempre visível, com link para a página de direitos do OSM.
- **O mesmo campo aceita coordenadas e link colados** (tabela da seção 4). O ponto colado vira a opção "Ir para as coordenadas" ou "Ir para o ponto do link", com as coordenadas; Enter ou toque leva o mapa até lá. Link curto, link sem coordenadas e coordenadas impossíveis têm um aviso próprio (`role="alert"`).
- **Mantidos** o "Usar onde estou agora" (GPS) e o arrastar do mapa.
- **"Confirmar local"** com o ícone de alfinete no lugar do "É aqui →". **Endereço aproximado** logo abaixo da ponta do alfinete e no título do painel, pelo *reverse* do Photon, com a mesma espera de 400 ms (depois de o mapa parar) e o cancelamento; enquanto não chega ou se falhar, a cidade de referência mais perto (lista que já existia).
- **Área piloto no mapa:** retângulo tracejado azul, com a legenda em texto "Linha tracejada: área com dados" e o botão "Ver a área inteira", que afasta o mapa até a área caber sem tirar o alfinete do ponto. Ponto fora da área: cartão "Ainda não chegamos aí" com "Por enquanto só temos dados da região de Uberlândia e Uberaba." (en: "For now we only have data for the Uberlândia and Uberaba region."), "Ver a fazenda de exemplo" e o "Confirmar local" desligado.
- **Limites com uma fonte só:** `GET /api/area-piloto` devolve os `PILOT_*` do `app/constants.py`; o front não repete os números (só o mock, que imita a API).

## 2. Contrato `GET /api/area-piloto`

```json
{"min_lat": -19.9, "max_lat": -18.4, "min_lon": -49.0, "max_lon": -47.5}
```

Graus, WGS 84. Sem parâmetros, sem cache HTTP (o front pede uma vez por visita e guarda; se falhar, tenta de novo na próxima). Camadas: `PilotArea` (model) → `PilotAreaService` (lê as constantes; recebe outra área por injeção nos testes) → `PilotAreaResponse` (schema) → controller fino.

## 3. Busca de endereço: o pedido ao Photon

| Uso | Pedido |
| --- | --- |
| Autocompletar | `https://photon.komoot.io/api/?q=<texto>&limit=5&lang=<default ou en>&lat=-19.15&lon=-48.25` |
| Endereço aproximado | `https://photon.komoot.io/reverse?lat=<lat>&lon=<lon>&lang=<default ou en>&limit=1` |

- **Idioma:** o Photon só aceita `default`, `de`, `en` e `fr` (`lang=pt` responde 400, conferido em 15/11/2026). Em pt vai `default` (nomes locais, que no Brasil já são em português); em en, `en`.
- **Formato conferido em 15/11/2026** (3 pedidos reais, com intervalo): GeoJSON `FeatureCollection`; cada `feature` tem `geometry.coordinates` = `[lon, lat]` e `properties` com `name`, `street`, `housenumber`, `district`, `locality`, `city`, `county`, `state`, `country`, `countrycode`, `osm_type`, `osm_id`. Exemplo do *reverse* da lavoura de demonstração: "Fazenda Maria Dória, Uberlândia, Minas Gerais".
- **Rótulos (service):** nome (ou rua e número, ou a cidade); detalhe = bairro, cidade, estado e o país fora do Brasil, sem repetir o nome. Lugares repetidos (mesmo nome e detalhe) e sem nome saem. O endereço aproximado junta nome, bairro, cidade e estado numa linha.
- **Camadas:** o `fetch` fica no `httpClient.ts` (`getExternalJson`, URL completa e `signal`); `geocodingRepository.ts` só monta o pedido; `geocodingService.ts` tem as regras (3 letras, 400 ms, rótulos); `useDebouncedRequest` (controller) faz a espera e o cancelamento. No modo `mock` e nos testes, `mocks/mockLocation.ts` busca em 6 cidades de exemplo, sem rede.

## 4. Coordenadas e links aceitos (service puro `locationInputService.ts`)

| Formato | Exemplo | Resultado |
| --- | --- | --- |
| Coordenadas com ponto decimal | `-18.9543, -48.1993` · `-18.9543,-48.1993` · `-18.9543 -48.1993` · `(-18.9543, -48.1993)` | ponto |
| Coordenadas com vírgula decimal | `-18,9543; -48,1993` · `-18,9543, -48,1993` · `-18,9543 -48,1993` | ponto |
| Pino do lugar no link | `…/maps/place/…/@-18.91,-48.34,12z/data=…!3d-18.9113317!4d-48.2622478…` | o pino (`!3d`/`!4d`), não o centro do mapa |
| Parâmetro `q`, `query` ou `ll` | `https://maps.google.com/?q=-18.9543,-48.1993` · `…?q=-18.9543%2C-48.1993` · `…?q=loc:-18.95,-48.19` · `…/maps/search/?api=1&query=-18.95,-48.19` · `…/maps?ll=-18.95,-48.19` | ponto |
| Caminho de busca | `https://www.google.com/maps/search/-18.9543,+-48.1993` | ponto |
| Centro do mapa | `https://www.google.com/maps/@-18.9543,-48.1993,15z` · `www.google.com/maps/@…` (sem `https://`) · `google.com.br` | ponto |
| Link curto | `https://maps.app.goo.gl/…` · `https://goo.gl/maps/…` · `share.google`, `g.co` | aviso: abrir no Google Maps e colar o link completo ou as coordenadas |
| Link sem coordenadas | `https://www.google.com/maps/place/Uberaba,+MG` · `?q=Uberaba` | aviso |
| Coordenadas impossíveis | `91, -48` · `…/@-98.1,-48.1,15z` | aviso: latitude de −90 a 90, longitude de −180 a 180 |
| Só números, incompletos | `-18.95` · `-18,9543;` | nada (a pessoa ainda está digitando) |
| CEP | `38400-000` | vai para a busca |
| Texto | `Uberaba`, `BR-050 km 80`, `Rua 2, 120, Uberlândia` | vai para a busca |

Links de outros mapas com o mesmo formato (`ll=` e `q=` do Apple Maps, por exemplo) também funcionam.

## 5. Testes (TDD)

Cada teste foi escrito antes do código e visto falhando pelo motivo certo:

| Teste | Red |
| --- | --- |
| `tests/unit/services/test_pilot_area_service.py` | `ModuleNotFoundError: app.models.pilot_area` |
| `tests/integration/controllers/test_pilot_area_controller.py` | `ImportError: get_pilot_area_service` (depois, sem a rota) |
| `services/locationInputService.test.ts` (31 casos) | módulo inexistente; depois, o caso do CEP (`incomplete-coordinates` em vez de `search`) |
| `repositories/httpClient.test.ts` (`getExternalJson`) | `getExternalJson is not a function` |
| `repositories/geocodingRepository.test.ts`, `pilotAreaRepository.test.ts` | módulos inexistentes |
| `services/geocodingService.test.ts`, `pilotAreaService.test.ts`, `locationService.test.ts` | módulo inexistente / `isInsideArea is not a function` |
| `controllers/useDebouncedRequest.test.ts` (relógio falso) | módulo inexistente |
| `controllers/useWhereController.test.ts` (18 casos) | o controller antigo (`isInsidePreparedArea is not a function`, sem busca) |
| `design-system/components/MapPicker.test.tsx` | sem o retângulo; depois, sem o botão "Ver a área inteira" |
| `design-system/components/PlaceSearch.test.tsx` | módulo inexistente |
| `views/WhereView.test.tsx` (18 casos) | 16 falhas (sem busca, sem "Confirmar local", sem o aviso novo) |
| `routes.test.tsx` (busca → escolhe → confirma → `/quando`) | com a ligação do `pages.tsx` desfeita: `Cannot read properties of undefined (reading 'map')` |

O Photon é sempre falso nos testes (`vi.stubGlobal('fetch', ...)` no repository; service e controller com objetos falsos; rotas com o mock).

## 6. Decisões

D21 a D30 em `projeto/backend/docs/remodelagem.md`.

## 7. Riscos e o que ficou de fora

- **Instância pública do Photon:** uso justo, sem garantia de disponibilidade nem de limite fixo. Sem resposta, a tela continua funcionando (mapa, GPS, coordenadas e link colados; endereço = cidade de referência). Para uso em escala, uma instância própria do Photon ou um serviço com chave no backend.
- **Privacidade (RNF-06):** o texto buscado e o ponto do *reverse* vão para o komoot (sem cookie, sem cadastro). Os ladrilhos do mapa já iam para o OpenStreetMap.
- **Graus, minutos e segundos** colados como texto (`18°57'15.6"S 48°11'57.4"W`) não são lidos; o link do Google com esse nome funciona pelo `!3d`/`!4d`.
- **Link curto** não é aberto (precisaria de rede e o Google não deixa o navegador seguir o redirecionamento): a tela explica o que fazer.
- O componente `PlaceSearch` não entrou na página `/design-system` (evitar conflito com a S1, que mexeu nela).
