# ADR-0002: Alinhamento dos Contratos de API (`/talhao` e `/recomendacao`)

**Status:** Decidido
**Data:** 14 de Novembro de 2026
**Contexto Técnico:** Frontend (`projeto/frontend/src/models/`), Backend (`projeto/backend/app/schemas/`), Plano Técnico (§3.1 e §3.2)

---

## 1. Contexto do Problema e Incompatibilidades Detectadas

A auditoria dos contratos TypeScript do frontend (`models/talhao.ts`, `models/recomendacao.ts`, `recomendacaoRepository.ts`) contra os documentos técnicos do backend revelou **4 divergências críticas de dados e tipos**:

### A. Campo `nematoide` (Tipo e Parâmetro Ausente na URL)
- **Frontend (`models/recomendacao.ts`):** tipa `entrada.nematoide` como booleano: `boolean | null`.
- **Frontend (`repositories/recomendacaoRepository.ts`):** `RecomendacaoParams` **não inclui** o parâmetro `nematoide`, impossibilitando o envio na query string:
  ```typescript
  // Atual no front:
  export type RecomendacaoParams = { lat: number; lon: number; colheita: Colheita; solo?: Textura }
  ```
- **Backend (Plano Técnico §3.2):** espera na URL strings como `&nematoide=sim` ou `&nematoide=nao`.

### B. Campo `data_limite` em `Opcao`
- **Frontend (`models/recomendacao.ts`):** possui a sugestão `data_limite?: string` para exibir o prazo do ZARC na Tela 5 (*"Plante logo depois de colher a soja, até [data limite do ZARC]"*).
- **Backend (Plano Técnico §3.2):** não incluía o campo no JSON de exemplo de `opcoes`, embora possua `semeadura_limite_mes_dia` em `culturas.yaml`.

### C. Estrutura de `fora_da_janela`
- **Frontend (`models/recomendacao.ts`):** define como lista simplificada de avisos:
  ```typescript
  fora_da_janela: { id: CropId; nome: string; texto: string }[]
  ```
- **Backend (`diagrama-de-classes.md` inicial):** tipava como `tuple[ResultadoOpcao]`, exigindo todas as notas e arrays de 20 anos mesmo para opções inviáveis.

### D. Estrutura de `historico` do NDVI (Tela 4)
- **Frontend (`models/talhao.ts`):** espera:
  ```typescript
  historico: {
    anos: { ano: number; situacao: 'plantou' | 'parado' | 'incerto'; ndvi_max: number }[]
    parado: number
    total: number
    fonte: string
  } | null
  ```
- **Script de dados (`data/extract_gee_ndvi.py`):** exportava `status_talhao` (`"Pousio"` / `"Segunda Safra"`) e `ndvi_medio_safrinha`.

---

## 2. Decisões Arquiteturais

### Decisão 1: Unificação do Parâmetro e Retorno de `nematoide`
1. **No Backend (FastAPI):**
   - O controller aceita query param flexível: `nematoide: Optional[str] = Query(None)`. Trata `"sim"`, `"true"`, `"1"` como `True`; `"nao"`, `"false"`, `"0"` como `False`; e ausência como `None`.
   - O schema de resposta `EntradaSchema` serializa estritamente como `boolean | null` (`true`, `false` ou `null`), atendendo perfeitamente ao frontend.
2. **No Frontend:**
   - Adicionar `nematoide?: boolean` a `RecomendacaoParams` em `src/models/recomendacao.ts`.
   - Atualizar `recomendacaoRepository.ts` para serializar `nematoide !== undefined ? '&nematoide=' + (nematoide ? 'sim' : 'nao') : ''`.

### Decisão 2: Inclusão Oficial de `data_limite` em `Opcao`
O backend incluirá oficialmente o campo `data_limite: str` (formato ISO `YYYY-MM-DD`, ex.: `"2027-02-28"`) no schema Pydantic de cada cultura viável retornada em `opcoes`. Isso permite ao frontend formatar a data localizada (*"28 de fevereiro"*) diretamente para o produtor.

### Decisão 3: Padronização Leve para `fora_da_janela`
O schema da API para `fora_da_janela` adotará a estrutura do frontend:
```json
"fora_da_janela": [
  {
    "id": "milho_safrinha",
    "nome": "Milho safrinha",
    "texto": "Fora da janela de plantio para colheita tardia (limite ZARC: 28/fev)."
  }
]
```

### Decisão 4: Padronização dos Campos de `historico` do NDVI
O `TalhaoService` e o schema `HistoricoTalhao` mapearão a saída do satélite para os campos exatos esperados pelo frontend:
- `situacao`: `"plantou"` (quando NDVI máximo da entressafra $\ge 0.60$), `"parado"` (quando $< 0.45$) ou `"incerto"`;
- `ndvi_max`: float reescalado (ex.: `0.71`);
- `parado`: contagem de anos com situação `"parado"`;
- `total`: contagem de anos válidos da série;
- `fonte`: `"modis_mod13q1"`.

---

## 3. Consequências

- **Compatibilidade Total:** Elimina riscos de `TypeError` ou campos `undefined` no cliente React.
- **Transparência Agronômica:** O produtor tem acesso à data limite do ZARC em cada opção.
- **Resiliência:** Se o satélite Earth Engine estiver instável, `historico` virá como `null` e o frontend já está programado para esconder o cartão graciosamente sem quebrar a tela.

---

## 4. Atualização (PR de correções do code review do backend)

A implementação anterior não seguia o formato aninhado do plano técnico §3.2, que é o que o
frontend lê (`models/recomendacao.ts` e `models/talhao.ts`). Com isso, a "compatibilidade total"
acima não valia na prática. O schema passou a seguir o plano:

- **`opcoes[]`:** objetos `chuva {anos_bons, anos, faixa, rotulo, texto}`,
  `futuro {anos_bons_media, anos_bons_min, anos_bons_max, modelos, cenario} | null`,
  `dinheiro {margem_ha, rotulo, texto}` e `terra {nota, rotulo, texto}`, além de `notas`,
  `porque` e `como_fazer`. Os campos planos (`anos_bons_chuva`, `rotulo_chuva` etc.) saíram.
- **`alternativas[]`:** `{motivo, opcao}` (era `opcao_id`).
- **`futuro` e `notas.futuro`:** vêm `null` quando não há deltas do NEX-GDDP-CMIP6 para a célula.
  Nesse caso a nota final usa só segurança, solo e renda (pesos 30/25/30 reescalados), em vez de
  inventar uma faixa de modelos.
- **`/talhao`:** `solo {textura, cad_mm, fonte}`, `historico.anos[] {ano, situacao, ndvi_max}` e
  `dados[] {fonte, periodo, cenario, modelos}`, listando só as fontes que existem para o ponto.
- **Ponto sem dados:** `/talhao` responde 200 com `dentro_da_area: false`; `/recomendacao`
  responde 404 com `code: "OUTSIDE_AREA"` (antes devolvia, sem aviso, a resposta de Uberlândia).
- **Parâmetros:** `colheita`, `solo`, `nematoide` e `gado` são validados; valor fora da lista
  dá 422 em vez de ser ignorado.
