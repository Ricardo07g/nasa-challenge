# Tarefa 0010: Docs do backend em dia (R0.4)

- **Identificador:** `0010`
- **Título:** Docs do backend em dia
- **Status:** Concluída
- **Prioridade:** Média (só documentação, mas engana quem chega e pega uma tarefa do roteiro)
- **Módulos afetados:** `data/README.md`, `docs/` (raiz), `projeto/backend/docs/`, `projeto/backend/AGENTS.md`
- **Roteiro:** [R0.4](../roteiro-de-implementacao.md) (Fase 0). Registra também o adiamento do R0.3.
- **Referências:** [ADR-0005](../adr/0005-fontes-diretas-da-nasa-sem-earth-engine.md), [tarefa 0009](0009-token-earthdata-e-contrato-dados-fontes.md) (contrato dos dados das fontes)

---

## 1. Descrição e motivação

Os docs diziam que existiam scripts que nunca existiram (`extract_soilgrids.py`, `extract_gee_ndvi.py`,
`extract_gee_cmip6.py`), citavam a "Fazenda Santa Luzia" e um ponto antigo, apontavam para caminhos
`file:///workspace/...` que só valiam na máquina de quem escreveu, desenhavam o Google Earth Engine
no caminho dos dados (fora do MVP pela ADR-0005) e tinham duas cópias de docs que já divergiam.
Quem pegasse uma tarefa do roteiro partiria de uma premissa errada.

---

## 2. Sub-tarefas

### 2.1 `data/README.md`
- [x] Árvore, seção 4 e tabela de status sem marcar como prontos `extract_soilgrids.py`,
  `extract_gee_ndvi.py` e `extract_gee_cmip6.py`. O texto diz onde cada dado está hoje: SoilGrids pelo
  `SoilGridsClient` da API (ligado na busca sob demanda no R1.1); NDVI e CMIP6 como scripts a fazer em
  `projeto/backend/pipeline/` (R2.2 e R2.1).
- [x] Acesso ao MODIS e ao CMIP6 sem Earth Engine (AppEEARS com a ORNL de reserva; NCCS THREDDS).
- [x] SMAP na versão que o script usa (`SPL4SMGP.007`, e não "v8"); conferir a 008 fica no R2.3.
- [x] Credenciais do SMAP: usar usuário e senha da Earthdata. O `EARTHDATA_TOKEN` não serve no
  AppEEARS (403), e o script ainda tenta esse token primeiro (ver tarefa 0009).
- [x] Regra do NDVI do PRD 7.8 (maior NDVI de abr–jul; `plantou`, `parado`, `incerto`) no lugar da
  regra antiga (média de mar–mai, corte em 0,38). CMIP6 como delta mensal por modelo, sem os números
  fixos de exemplo (−12,5%, +1,8 °C) que pareciam resultado.
- [x] Aviso da pasta `output/` (L218): ela fica fora do git; quem tem cópia anterior a 14/11/2026
  precisa gerar de novo; a fixture da API já é do ponto novo.
- [x] Links `file:///workspace/...` viram relativos.

### 2.2 Tarefas
- [x] Tarefa 0001: sem `data/extract_soilgrids.py` (o `SoilGridsClient` foi escrito direto da API do
  ISRIC) e sem `httpx` (o cliente usa `urllib`). Link da ADR-0003 corrigido (`../adr/`).
- [x] `docs/tarefas/` da raiz: o README vira ponteiro para `projeto/backend/docs/tarefas/` (a pasta
  canônica) e a cópia desatualizada da 0001 sai.

### 2.3 ADRs
- [x] ADR-0003 e ADR-0004: "Fazenda Santa Luzia" (−18,82 / −48,28) vira a lavoura de demonstração, perto de
  Uberlândia (MG), −18,9543 / −48,1993. Cada uma ganha a linha "Atualizado em" dizendo que a
  decisão não mudou.
- [x] ADR-0003: `/workspace/data/...` vira `data/`, o `data/config.py` (que não existe) vira `PILOT_*` em
  `app/constants.py`, e a tabela `clima_historico_diario` vira `climate_season` (o nome real).
- [x] Índice das ADRs: deixa de citar scripts de SoilGrids, MODIS e CMIP6.

### 2.4 Histórias de usuário (`docs/historias-de-usuario.md`)
- [x] Coluna **Status** no catálogo (§4), conferida no código: o que está feito, o que é parcial e qual
  tarefa do roteiro falta em cada história.
- [x] Matriz da §1 reescrita com o lugar real de cada dado; links `/workspace` viram relativos (na §1
  e nas outras seções).

### 2.5 Sem Earth Engine nos diagramas e textos
- [x] `como-funcionam-os-dados-de-satelite-e-postgis.md`: "MODIS / GEE" vira MODIS pelo AppEEARS;
  exemplo de célula com a lavoura de demonstração e nota sobre as duas regras de id (R1.2).
- [x] A cópia idêntica em `docs/` da raiz vira ponteiro para a do backend.
- [x] `diagrama-de-sequencias.md`: pipeline com os scripts reais e os que faltam (sem Earth Engine);
  `/exemplo` pela fixture; NDVI do `/talhao` pelo cache do pipeline.
- [x] `diagrama-de-classes.md`: fontes atuais, models do contrato da tarefa 0009 (`Cmip6Delta` mensal,
  `NdviRecord` com qualidade e produto, `DataRun`), `CachedNdviRepository` e `FixtureClimateRepository`
  no lugar de classes que não existem (`CachedEarthEngineNdviRepository`, `DataOutputClimateRepository`)
  e nota sobre a migração R1.6 no diagrama ER.

### 2.6 `AGENTS.md` do backend
- [x] A árvore dizia que `pipeline/` "não entra na imagem", mas o `Dockerfile` copia a pasta (junto com
  `tests/`, para o `pytest` rodar no container). O texto agora diz isso. O `Dockerfile` não mudou.
- [x] A seção "Dados da API" ficou como estava (é de outra tarefa da mesma onda).

### 2.7 Espaço no fim de linha (pedido do coordenador)
- [x] O `pre-commit run --all-files` já falhava no `main` no hook `trailing-whitespace`, por causa das
  quebras forçadas com dois espaços em `como-funcionam-os-dados-de-satelite-e-postgis.md` (raiz e
  backend). A quebra virou barra invertida (`\`), que o Markdown mostra igual; a linha em branco do
  mermaid perdeu o espaço; a cópia da raiz virou ponteiro.

---

## 3. R0.3 adiado: grupo `pipeline` de dependências

O roteiro pedia um grupo `pipeline` no uv (`earthaccess`, `xarray`, `h5netcdf`, `numpy`), feito de uma
vez. **Fica para quando um script precisar de verdade**, que deve ser o IMERG (R2.4, arquivos NetCDF/HDF5):

- O roteiro supunha que o `httpx2` "já está na API". Não está: o cliente HTTP da API usa `urllib`
  (`app/repositories/external/http_client.py`).
- CMIP6 (CSV do recorte por ponto no THREDDS), AppEEARS (JSON e CSV) e ORNL (JSON) saem com esse cliente
  HTTP que já existe, sem dependência nova.
- Abrir agora um grupo sem uso só mexe no `uv.lock`, que é arquivo de conflito entre as trilhas.
- Quando entrar, continua valendo o combinado do roteiro: um PR só da dependência, justificado.

---

## 4. Fora do escopo (fica registrado)

- `arquivos contexto/` (PRD, plano técnico, guia do NDVI) ainda citam o Earth Engine e o
  `extract_gee_ndvi.py`: são a fonte de verdade do produto e mudam quando a ADR-0005 for aceita.
- ADR-0002 ainda fala do `data/extract_gee_ndvi.py` (como contexto da época) e do "Earth Engine
  instável" na resiliência do `historico`.
- `docs/coding-guidelines.md` ainda tem links `file:///workspace/...`.
- §5 das histórias de usuário: alguns critérios citam campos antigos do `culturas.yaml`
  (`palhada_score`, `nematoide_efeito`) em vez de `nota_solo`; fica para o R4.4 (conteúdo das culturas).
- Diagrama de sequência §6: o exemplo de 404 ainda mostra `{"detail": ...}`; o formato problem+json
  é a tarefa 0011 (R4.5).
- A seção "Dados da API" do `AGENTS.md` (busca sob demanda e PostGIS) é de outra tarefa da onda.

---

## 5. Critérios de aceitação

1. Nenhum doc do backend, nem `data/README.md`, marca como pronto um script que não existe.
2. Sem "Fazenda Santa Luzia" e sem o ponto −18,82 / −48,28 nas ADRs.
3. Sem Earth Engine no caminho dos dados do MVP nos diagramas e no `como-funcionam`.
4. Uma cópia só de cada doc (as da raiz viram ponteiros).
5. `pre-commit run --all-files` passando (o `trailing-whitespace` volta a passar) e `uv run pytest`,
   `uv run ruff check .` e `uv run ruff format --check .` sem mudança (só docs).
