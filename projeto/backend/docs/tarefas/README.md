# Backlog de Tarefas de Engenharia — Backend

Este diretório gerencia as tarefas técnicas, épicos e melhorias do backend do **Raiz Orbital**.
Cada tarefa possui um identificador numérico sequencial (`0001`, `0002`, etc.) e segue o padrão MVC + Service/Repository com TDD obrigatório.

---

## Tabela de Tarefas

| ID | Título | Status | Prioridade | Responsável / Módulo |
| :---: | :--- | :---: | :---: | :--- |
| [**0001**](0001-ingestao-on-demand-dados-satelite.md) | **Pipeline de Ingestão On-Demand de Dados de Satélite e Solo (Cache-Aside Espacial)** | **Concluída** | **Alta** | `app/repositories/external/`, `app/services/` |
| [**0002**](0002-id-de-celula-unico.md) | **Um id de célula só (`floor`) na ingestão, no PostGIS e no seed** | **Concluída** | **Alta** | `app/repositories/climate_repository.py`, `app/services/satellite_ingestion_service.py` |
| [**0003**](0003-ligar-busca-sob-demanda.md) | **Ligar a busca sob demanda: PostGIS com a fixture como reserva, `/talhao` e `/recomendacao` buscam ponto novo** | **Concluída** | **Alta** | `app/dependencies.py`, `app/services/`, `app/repositories/`, `tests/integration/db/` |
| [**0004**](0004-eto-penman-monteith.md) | **ETo FAO-56 Penman-Monteith no service (o cliente do POWER só traz dados)** | **Concluída** | **Alta** | `app/services/water_balance_calculator.py`, `app/services/climate_season_builder.py`, `nasa_power_client.py` |
| [**0005**](0005-power-sem-dado-inventado.md) | **NASA POWER sem dado inventado: ano com dia faltando sai da série** | **Concluída** | **Alta** | `nasa_power_client.py`, `app/services/climate_season_builder.py` |
| [**0006**](0006-regras-yaml-e-yaml-rules-repository.md) | **`regras.yaml` + `YamlRulesRepository`: limiares, pesos e frases do motor com fonte** | **Concluída** | **Alta** | `app/config_data/regras.yaml`, `app/repositories/rules_repository.py`, services do motor |
| [**0007**](0007-alternativas-melhores-que-a-melhor.md) | **Alternativas só quando superam a melhor no próprio eixo, sem repetir cultura** | **Concluída** | **Alta** | `app/services/recommendation_service.py` |
| [**0008**](0008-conteudo-das-culturas.md) | **Conteúdo das culturas (ids canônicos, nome_en, como fazer pt/en, /crop-options pelo YAML)** | **Concluída** | **Média** | `app/config_data/culturas.yaml`, `app/repositories/` |
| [**0009**](0009-token-earthdata-e-contrato-dados-fontes.md) | **Tokens da Earthdata e do AppEEARS no `Settings` e contrato tipado dos dados das fontes (CMIP6, NDVI, SMAP, `data_run`)** | **Concluída** | **Alta** | `app/config.py`, `app/models/`, `AGENTS.md` |
| [**0010**](0010-docs-backend-em-dia.md) | **Docs em dia: scripts que existem, ADRs com a Fazenda do Glória, status das histórias, diagramas sem GEE (e R0.3 adiado)** | **Concluída** | **Média** | `docs/`, `data/README.md`, `AGENTS.md` |
| [**0011**](0011-http-cache-e-422-problem-json.md) | **HTTP: `Cache-Control` de um dia em `/recomendacao` e 422 em problem+json** | **Concluída** | **Média** | `app/main.py`, `app/controllers/recomendacao_controller.py` |
| [**0012**](0012-pre-carga-caixa-piloto.md) | **Pré-carga da caixa piloto e da fazenda de exemplo (225 células, 20 pedidos ao POWER, SoilGrids com pausa)** | **Concluída** | **Alta** | `pipeline/preload_pilot_box.py`, `soil_repository.py` |
| [**0013**](0013-migracao-fontes-novas.md) | **Migração das fontes novas: `cmip6_delta` mensal por modelo, `ndvi_point` com qualidade, `smap_point`, `data_run.version`; aposenta `scripts/`** | **Concluída** | **Alta** | `migrations/versions/`, `app/repositories/` |
| [**0014**](0014-deltas-cmip6.md) | **Deltas mensais do NEX-GDDP-CMIP6 pelo THREDDS (3 modelos, SSP2-4.5, 2041–2060 × 1995–2014)** | **Concluída** | **Alta** | `pipeline/fetch_cmip6_deltas.py`, `http_client.py` |
| [**0016**](0016-plano-3-anos-fiel-ao-prd.md) | **Plano de 3 anos fiel ao PRD 7.7: 216 combinações com pousio, pousios seguidos, diversidade por função, sem nota −1,0** | **Concluída** | **Alta** | `app/services/rotation_plan_service.py` |
| [**0015**](0015-servico-sinal-outono.md) | **Service do sinal para o outono (regra do PRD 7.10) e campo sinal opcional em /recomendacao** | **Concluída** | **Média** | `app/services/sinal_outono_service.py`, `app/repositories/sinal_outono_repository.py` |
| [**0020**](0020-pior-ano-seco-na-api.md) | **Margem do pior ano seco em /recomendacao (opcoes[].dinheiro.pior_ano_seco_ha); custo da semente espera o A1.1** | **Concluída** | **Média** | `app/services/recommendation_service.py`, `app/schemas/recomendacao.py` |
| [**0019**](0019-safra-passada.md) | **/api/safra-passada: replay de uma safra passada com as regras de aviso (veranico, calor, chuva voltou)** | **Concluída** | **Média** | `app/services/past_season_service.py`, `app/services/crop_alert_service.py` |
| [**0021**](0021-nota-de-futuro-cmip6.md) | **Nota de futuro lendo os deltas do CMIP6 (tabela → arquivo CMIP6_PATH → fixture), com tmin_c** | **Concluída** | **Alta** | `app/repositories/cmip6_repository.py`, `climate_repository.py`, `climate_risk_service.py` |
| [**0018**](0018-historico-ndvi-na-api.md) | **Histórico do talhão pelo NDVI no formato completo do guia, frase no porque e /exemplo com a colheita sugerida** | **Concluída** | **Alta** | `app/services/field_history_service.py`, `app/repositories/ndvi_repository.py`, `app/schemas/talhao.py` |
| [**0022**](0022-carga-dos-arquivos-no-banco.md) | **Carga dos arquivos do CMIP6 e do NDVI no banco (`cmip6_delta`, `ndvi_point`, `data_run`)** | **Concluída** | **Média** | `pipeline/load_files_to_db.py`, repositories |
| [**0023**](0023-cmip6-por-area.md) | **CMIP6 por área: um pedido por arquivo para a caixa inteira (OPeNDAP ASCII, 378 pedidos, ~45 min) e saída em data/baixados** | **Concluída** | **Alta** | `pipeline/fetch_cmip6_deltas.py` |
| [**0017**](0017-ndvi-appeears.md) | **Script do NDVI do MODIS pelo AppEEARS (MOD13Q1 + MYD13Q1, 2016–2025, jan–jul)** | **Concluída** | **Alta** | `pipeline/fetch_ndvi.py`, `http_client.py` |
| [**0025**](0025-cache-que-revalida.md) | **Cache que revalida em /recomendacao: `public, no-cache` + ETag do corpo e 304 (no lugar do `max-age` de um dia)** | **Concluída** | **Alta** | `app/controllers/http_cache.py`, `app/controllers/recomendacao_controller.py` |

---

## Convenções de Tarefas

1. **Nomenclatura do arquivo:** `XXXX-descricao-curta-em-kebab-case.md` (ex.: `0001-ingestao-on-demand-dados-satelite.md`).
2. **Ciclo de Vida:**
   - `Pendente` (Planejada e especificada)
   - `Em Progresso` (Em desenvolvimento na branch)
   - `Concluída` (Merged com testes verdes e aderente a `AGENTS.md`)
3. **Padrão de Qualidade:**
   - TDD obrigatório (Red-Green-Refactor).
   - Sem chamadas de rede real nos testes unitários.
   - Respeito rigoroso às camadas (Controller → Service → Repository).
