# ADR-0001: Padronização dos Identificadores de Culturas (`CropId`)

**Status:** Decidido  
**Data:** 14 de Novembro de 2026  
**Contexto Técnico:** Frontend (`projeto/frontend`), Backend (`projeto/backend`) e Dados (`data/culturas.yaml`)

---

## 1. Contexto do Problema e Incompatibilidade Detectada

Ao confrontar o código do frontend (`projeto/frontend`), o backend existente (`projeto/backend`) e os parâmetros de extração em `data/culturas.yaml`, identificamos uma **incompatibilidade direta de nomenclatura nas chaves primárias das culturas de entressafra**:

1. **Frontend (`src/models/recomendacao.ts` e `src/repositories/mocks/fixtures.ts`):**
   O TypeScript define a união literal estrita:
   ```typescript
   export type CropId = 'milho_braquiaria' | 'milho_safrinha' | 'sorgo' | 'milheto' | 'crotalaria' | 'pousio'
   ```
   Além disso, `GRAIN_CROPS` e `COVER_CROPS` são construídos a partir desses literais exatos (`'sorgo'`, `'crotalaria'`).

2. **Backend Atual (`app/repositories/crop_option_repository.py`):**
   A tupla padrão `DEFAULT_CROP_OPTIONS` utiliza nomes em *kebab-case* longo:
   ```python
   CropOption(id="sorgo-granifero", name="Sorgo granífero", role="Grão")
   CropOption(id="crotalaria-spectabilis", name="Crotalária spectabilis", role="Cobertura leguminosa")
   CropOption(id="milho-safrinha", name="Milho safrinha", role="Grão")
   CropOption(id="milho-braquiaria", name="Milho + braquiária ruziziensis", role="Grão + cobertura")
   ```

3. **Configuração de Dados (`data/culturas.yaml`):**
   Utiliza chaves em *snake_case* longo:
   ```yaml
   culturas:
     pousio: ...
     milho_safrinha: ...
     sorgo_granifero: ...
     milho_braquiaria: ...
     milheto: ...
     crotalaria_spectabilis: ...
   ```

### Impacto
Se a API FastAPI retornar `id: "sorgo_granifero"` ou `id: "sorgo-granifero"`, o frontend rejeitará o payload ou falhará silenciosamente na renderização dos ícones, rotas, cálculo de resumo de planos (`planSummary`) e textos explicativos.

---

## 2. Decisão Arquitetural

Adotamos os **identificadores curtos em *snake_case*** já consolidados no protótipo v3 e nos modelos do frontend como o **padrão canônico universal** de toda a API REST:

| Nome da Cultura | Identificador Canônico Universal (`CropId`) |
| :--- | :---: |
| **Pousio** | `pousio` |
| **Milho Safrinha** | `milho_safrinha` |
| **Sorgo Granífero** | `sorgo` |
| **Milho + Braquiária ruziziensis** | `milho_braquiaria` |
| **Milheto** | `milheto` |
| **Crotalária spectabilis** | `crotalaria` |

### Regras de Implementação no Backend:
1. Os contratos da API (`/api/recomendacao`, `/api/crop-options`, `/api/exemplo`) devolverão **obrigatoriamente** o `id` canônico (`sorgo`, `crotalaria`, `milho_safrinha`, `milho_braquiaria`, `milheto`, `pousio`).
2. O arquivo `culturas.yaml` e os repositories de parâmetros devem utilizar essas chaves canônicas.
3. Para garantir robustez e retrocompatibilidade com eventuais chamadas antigas ou dados legados, a camada de repositório do backend (`CropParamsRepository`) aceitará os aliases longos (`sorgo_granifero` e `crotalaria_spectabilis`), normalizando-os internamente para o ID canônico.

---

## 3. Consequências

- **Positivas:**
  - Compatibilidade 100% garantida entre os tipos estritos TypeScript do frontend e o JSON retornado pela API FastAPI.
  - Eliminação de bugs de renderização de ícones e quebra de regras de negócio no frontend (`recomendacaoRules.ts`).
  - Nomenclatura concisa, legível e alinhada com as URLs e o protótipo v3.
- **Ajustes Necessários:**
  - Atualizar `data/culturas.yaml` para usar `sorgo` e `crotalaria` como chaves principais (mantendo alias se necessário).
  - Atualizar `app/repositories/crop_option_repository.py` no backend para trocar os hifens (`-`) por underlines (`_`) e encurtar os nomes.
