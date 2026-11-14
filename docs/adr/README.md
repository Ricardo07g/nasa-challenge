# Registro de Decisões de Arquitetura (ADR) — Raiz Orbital

Este diretório reúne os **Architecture Decision Records (ADRs)** do projeto **Raiz Orbital**, resultantes da auditoria cruzada entre:
1. **Frontend (`projeto/frontend`):** Modelos TypeScript, Repositories, Mocks/Fixtures e Views do Protótipo v3;
2. **Documentação Técnica do Backend (`projeto/backend/docs`):** Histórias de usuário, diagramas de classe e diagramas de sequência;
3. **Pipeline de Dados Extraídos (`/data`):** Datasets reais e scripts da NASA POWER, SMAP, SoilGrids, MODIS e CMIP6;
4. **Escopo do Produto:** PRD, Plano Técnico do Backend e Protótipo das Telas.

---

## Índice de Decisões e Incompatibilidades Mapeadas

| ADR | Título | Status | Incompatibilidade Resolvida |
| :---: | :--- | :---: | :--- |
| [**ADR-0001**](0001-padronizacao-identificadores-de-culturas-crop-id.md) | **Padronização dos Identificadores de Culturas (`CropId`)** | **Decidido** | Conflito entre chaves do frontend (`sorgo`, `crotalaria`), backend existente (`sorgo-granifero`, `crotalaria-spectabilis`) e pipeline `/data` (`sorgo_granifero`, `crotalaria_spectabilis`). |
| [**ADR-0002**](0002-contratos-api-talhao-e-recomendacao.md) | **Alinhamento dos Contratos de API (`/talhao` e `/recomendacao`)** | **Decidido** | Divergências de tipagem em `nematoide` (`boolean` vs `'sim'|'nao'`), ausência de `data_limite` no backend, formato de `fora_da_janela` e tipagem de `historico` do NDVI. |
| [**ADR-0003**](0003-series-temporais-nasa-e-janela-de-20-anos.md) | **Série Histórica de 20 Anos da NASA e Bounding Box Geográfica** | **Decidido** | Discrepância de período temporal (`2005–2024` consolidado em `/data` vs `2006–2025` no plano) e substituição oficial do GPM IMERG pela chuva do NASA POWER no MVP. |
| [**ADR-0004**](0004-fluxo-fazenda-exemplo-e-camada-comunitaria.md) | **Fluxo da Fazenda de Exemplo e Escopo da Camada Comunitária** | **Decidido** | Rota `/exemplo` no frontend (redirecionamento com query params vs endpoint `GET /api/exemplo`) e confinamento de *"Perto de você"* e *Pecuária* como simulados/pós-MVP. |

---

## Matriz Resumida de Compatibilidade

```
+-----------------------------------------------------------------------------------------+
|                                  ECOSSISTEMA RAIZ ORBITAL                               |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|   FRONTEND (React + TS)              BACKEND (FastAPI + PostGIS)      DATA (NASA & Solo)|
|   --------------------              ---------------------------      ------------------ |
|   CropId: 'sorgo', 'crotalaria'  <-> Mapeamento canônico ADR-0001 <-> culturas.yaml     |
|   nematoide: boolean | null      <-> Parametrizado via ADR-0002   <-> nematoide_efeito  |
|   data_limite: opcional          <-> Incluído no Schema Opcao     <-> semeadura_limite  |
|   Caixa: PREPARED_AREA           <-> grid_cell (0,1° PostGIS)     <-> -19.9 a -18.4     |
|   Período: 2005-2024 (20 anos)   <-> Alinhado via ADR-0003        <-> POWER + SMAP      |
|   Comunidade: Mock no Front      <-> Sem backend no MVP (ADR-0004)<-> -                 |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```
