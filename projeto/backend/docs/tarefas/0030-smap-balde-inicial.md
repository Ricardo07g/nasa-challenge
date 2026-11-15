# Tarefa 0030: balde inicial de cada ano pelo SMAP do dia de plantar

- **Identificador:** `0030`
- **Título:** Balde inicial pelo SMAP (tabela `smap_point` → arquivo `SMAP_PATH`), frase no "Por quê?" e `smap` em `dados[]`
- **Status:** Concluída
- **Prioridade:** Alta
- **Roteiro:** R3.3 (depende do R2.3, [tarefa 0029](0029-smap-por-recorte.md))
- **Módulos Afetados:** `app/services/climate_risk_service.py`, `app/services/recommendation_service.py`, `app/services/talhao_service.py`, `app/repositories/smap_repository.py`, `app/dependencies.py`, `app/config.py`, `app/config_data/regras.yaml`, `app/models/regras.py`, `.env.example`, `projeto/docker-compose.yml`, testes de service, repository, controller e banco
- **Referências:** PRD §7.2 ("o balde começa em 50% da CAD, ou no valor estimado pelo SMAP quando houver"), US-03 (`arm0 = cad × sm_rootzone_wetness`, piso de 20%), contrato SMAP do `AGENTS.md`

---

## 1. Descrição e motivação

O motor já aceitava um `smap_wetness` único em `simulate_historical`, mas ninguém passava o dado e o balde
começava sempre em 50% da CAD. Com o SMAP dos dias de semeadura (tarefa 0029), cada ano da série pode
começar com a terra real daquele dia.

## 2. Regra (no service)

- `ClimateRiskService.sowing_day_wetness(serie, semeadura)`: `{ano: sm_rootzone_wetness}` só dos dias com o
  dia e o mês da semeadura da faixa pedida (cedo 08/02, meio 18/02, tarde 03/03). Outro dia não conta.
- `ClimateRiskService.initial_bucket_fraction(umidade)`: sem SMAP, 50% da CAD; com SMAP, a umidade relativa
  com piso de 20% (`MIN_INITIAL_ARM_FRACTION`) e teto de 100%. É a conversão da US-03 que o código já tinha.
- `simulate_historical(..., smap_wetness_by_year=...)`: cada ano usa a sua fração; o ano fora do dicionário
  (antes de 2016) fica com 50%.
- `simulate_future_cmip6` usa o mesmo dicionário: o método do delta muda só o clima, e a diferença entre hoje
  e 2050 não pode vir da condição inicial (teste que já existia).

## 3. Leitura (no repository)

- `CellSmapRepository.get_cell_smap_series(cell_id)`: a série da célula de 0,1° (o ponto do centro).
  - `PostgisSmapRepository`: chave `point_key` do centro da célula na `smap_point`;
  - `FileSmapRepository`: o ponto do arquivo dentro da célula (o mais perto do centro); nunca de célula vizinha;
  - `LayeredSmapRepository(tabela, arquivo)`: a primeira fonte com série (como o CMIP6).
- `get_smap_repository` (`dependencies.py`): com banco, tabela → arquivo do `SMAP_PATH`; sem banco, só o arquivo.

## 4. Contrato com o front

- `/talhao`: `dados[]` ganha `{"fonte": "smap", "periodo": "2016-2025"}` (primeiro e último ano da série da
  célula) quando há SMAP. O `sourceService.ts` do front já conta `smap` em `dados[]` como conectado.
- `/recomendacao`: o `porque` de cada opção ganha, logo depois da frase da chuva, a frase
  `frases.<língua>.balde_smap` do `regras.yaml`, por exemplo: "O balde de água começou com a umidade da terra
  medida pelo SMAP no dia de plantar em 9 dos 20 anos (2016 a 2024); nos outros, com 50% da água
  disponível." Sem nenhum ano com SMAP, não há frase. Nenhum campo novo no JSON.

## 5. Decisões e limites

- A série do clima vai de 2005 a 2024: o SMAP de 2025 fica no arquivo, mas só entra quando a série do clima
  incluir 2025. O `periodo` do `/talhao` mostra os anos que o SMAP tem (2016–2025).
- `sm_rootzone_wetness` é a umidade relativa à porosidade (saturação), não à água disponível entre a
  capacidade de campo e o ponto de murcha. Usar como fração da CAD é a regra da US-03 (hipótese do time); a
  conversão pela capacidade de campo do SoilGrids fica para quando a agrônoma calibrar.
- Se todos os anos da série tiverem SMAP, a frase ainda diz "nos outros"; não acontece com a série de hoje.

## 6. Critérios de aceite

- [x] Service com repository falso: o ano com SMAP seco vira aperto; dia que não é o da semeadura não conta;
  frase em pt e en; sem SMAP, nada muda.
- [x] Repository: tabela (teste com banco), arquivo e a ordem tabela → arquivo.
- [x] Controller: `/talhao` com `smap` em `dados` e `/recomendacao` com a frase, pelo `dependencies.py` de
  verdade e um `SMAP_PATH` de teste; sem arquivo ou com ponto de outra célula, nada.
