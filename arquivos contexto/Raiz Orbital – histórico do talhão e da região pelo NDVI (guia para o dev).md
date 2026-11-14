# Raiz Orbital – histórico do talhão e da região pelo NDVI (guia para o dev)

Nov 14, 2026 · @Rayanne

## Resumo

O cartão "Sua área ficou parada em 5 de 10 anos" (tela 4) e o "Na região, 62% ficou parada" (tela 8) precisam sair do satélite MODIS. Hoje os dois números são de mock: o histórico do talhão é a tarefa T-10 do PRD e a região é o item P3 do plano de evolução.

O que entregar:

1. **Histórico do talhão (T-10, Must):** para cada entressafra de 2016 a 2025, dizer se o ponto do talhão **plantou**, **ficou parado** ou **não dá para saber**, usando o NDVI do MODIS. Vai em `GET /api/talhao`, no campo `historico`.
2. **Região pelo satélite (P3, Should):** o mesmo resultado para cerca de 2.800 pontos de lavoura num raio de 30 km, agregado em percentuais por ano. Vai em `GET /api/regiao`.
3. **Faixa de colheita sugerida (seção 7.9 do PRD):** sai da mesma série de NDVI e entra junto com o histórico. Está fora deste guia, mas use a mesma extração.

Onde está hoje: o README de `data/` cita um script `extract_gee_ndvi.py`, mas **o arquivo não existe no repositório**. Em `data/` só há os scripts do NASA POWER, da série de 20 anos e do SMAP. Este guia é o ponto de partida para criar o script e o caminho até a tela.

Regra do projeto: TDD obrigatório e camadas MVC + service/repository, como no `AGENTS.md`. A regra de classificação fica no **service**; a leitura do Earth Engine e do banco fica no **repository** e no pipeline.

## Conceito: por que o NDVI mostra se a terra ficou parada

Planta verde reflete muito infravermelho próximo e absorve o vermelho; terra nua e palha seca refletem os dois de forma parecida. O NDVI resume essa diferença num número de −1 a 1:

```latex
NDVI = \frac{NIR - Red}{NIR + Red}
```

Na prática, numa lavoura: terra nua ou palha fica perto de 0,15 a 0,3; cultura bem desenvolvida passa de 0,7.

Por que olhar de **1º de abril a 31 de julho**: a soja do Triângulo é colhida entre fevereiro e março, e esses meses são a seca. Uma lavoura colhida e deixada parada quase não fica verde nessa época. Se o NDVI do ponto sobe nesses meses, alguém plantou alguma coisa ali (milho, sorgo, milheto, braquiária, crotalária). Como a regra usa o **maior** valor da janela, basta a planta ter crescido em algum momento.

O ano da entressafra é o ano da colheita da soja: "2025" = abril a julho de 2025, depois da soja da safra 2024/25.

## Dados: MODIS MOD13Q1 no Earth Engine

A fonte é a coleção `MODIS/061/MOD13Q1` (satélite Terra), uma imagem composta a cada 16 dias com pixel de 250 m, desde fevereiro de 2000.

| Item | Valor | Cuidado |
| --- | --- | --- |
| Banda principal | `NDVI` | Vem como inteiro: **multiplicar por 0,0001** antes de comparar (7.100 = 0,71) |
| Qualidade | `SummaryQA` | 0 = bom, 1 = aceitável, 2 = neve, 3 = nuvem. Usar só 0 e 1 |
| Data real do pixel | `DayOfYear` | A imagem cobre 16 dias; a data do pixel pode ser qualquer um deles |
| Pixel | 250 m (≈ 6 ha) | Um talhão pequeno mistura estrada, mata e vizinho |
| Coordenadas | lon, lat (WGS 84) | `ee.Geometry.Point([lon, lat])`, nessa ordem |
| Acesso | Earth Engine com projeto do Google Cloud | Grátis para uso não comercial; quando o produto cobrar, rever a licença |

Opcional para ter mais imagens na janela: a coleção gêmea `MODIS/061/MYD13Q1` (satélite Aqua) é defasada em 8 dias. Juntando as duas, a janela de abril a julho tem cerca de 14 imagens em vez de 7, e menos anos ficam sem dado bom.

O satélite Terra deve parar de coletar em 2027. O histórico continua disponível e é o que o MVP usa. Para os anos novos, o caminho é o HLS (30 m), que fica para depois.

## Regra do talhão

Para cada ano de 2016 a 2025, no pixel do ponto do talhão:

1. Pegar as imagens do MOD13Q1 de 1º de abril a 31 de julho daquele ano.
2. Descartar as observações com `SummaryQA` maior que 1 (neve ou nuvem).
3. Converter: `ndvi = NDVI × 0,0001`.
4. Contar as observações boas (`n_obs`) e pegar o maior valor (`ndvi_max`).
5. Classificar:
   - `n_obs` menor que 3 → **sem\_dado**
   - `ndvi_max` acima de 0,60 → **plantou**
   - `ndvi_max` abaixo de 0,45 → **parado**
   - entre 0,45 e 0,60 → **incerto**

Os limites e a janela não ficam no código: vão para o `regras.yaml`, para a calibração (seção de riscos) não exigir deploy.

```yaml
historico_ndvi:
  janela_inicio: "04-01"
  janela_fim: "07-31"
  limite_plantou: 0.60
  limite_parado: 0.45
  min_observacoes: 3
  anos: [2016, 2025]
```

Saída por ano: `{ano, ndvi_max, n_obs, situacao}`. Resumo do talhão: quantos anos ficaram **parado**, quantos **plantou**, quantos **incerto** ou **sem\_dado**, e o total de anos.

Na tela, o produtor vê três estados, não dois: verde (plantou), laranja (ficou parado) e cinza com "?" (o satélite não teve certeza, juntando `incerto` e `sem_dado`). A frase do cartão conta só os anos certos: "Sua área ficou parada em 5 de 10 anos" vira "em 5 de 9 anos (1 sem certeza)" quando houver um ano cinza. Embaixo da faixa entra a linha "Visto pelo satélite MODIS (NASA), de abril a julho de cada ano".

## Código de referência (Earth Engine em Python)

A divisão recomendada: o Earth Engine só **busca as observações brutas** do ponto (repository); a janela, a qualidade, o fator de escala e a classificação ficam em **Python puro** no service. Assim a regra é testada sem rede, como o `AGENTS.md` exige.

Busca bruta, uma chamada só para os 10 anos (repository ou script do pipeline `data/extract_gee_ndvi.py`):

```python
import os
import ee

ee.Initialize(project=os.environ["GEE_PROJECT"])

BANDAS = ["NDVI", "SummaryQA"]

def buscar_ndvi_bruto(lon: float, lat: float, inicio="2016-01-01", fim="2026-01-01") -> list[dict]:
    ponto = ee.Geometry.Point([lon, lat])  # ordem: lon, lat
    col = (
        ee.ImageCollection("MODIS/061/MOD13Q1").select(BANDAS)
        .merge(ee.ImageCollection("MODIS/061/MYD13Q1").select(BANDAS))
        .filterDate(inicio, fim)  # fim é exclusivo
    )
    linhas = col.getRegion(ponto, 250).getInfo()
    cab, *dados = linhas  # cab = ['id','longitude','latitude','time','NDVI','SummaryQA']
    i = {c: n for n, c in enumerate(cab)}
    return [
        {"data_ms": d[i["time"]], "ndvi_bruto": d[i["NDVI"]], "qa": d[i["SummaryQA"]]}
        for d in dados
        if d[i["NDVI"]] is not None
    ]
```

Classificação (service, sem Earth Engine):

```python
from datetime import date, datetime, timezone

def classificar_ano(obs: list[dict], ano: int, regra: dict) -> dict:
    ini = date.fromisoformat(f"{ano}-{regra['janela_inicio']}")
    fim = date.fromisoformat(f"{ano}-{regra['janela_fim']}")
    valores = [
        o["ndvi_bruto"] * 0.0001
        for o in obs
        if o["qa"] <= 1
        and ini <= datetime.fromtimestamp(o["data_ms"] / 1000, tz=timezone.utc).date() <= fim
    ]
    if len(valores) < regra["min_observacoes"]:
        return {"ano": ano, "ndvi_max": None, "n_obs": len(valores), "situacao": "sem_dado"}
    maior = max(valores)
    if maior > regra["limite_plantou"]:
        situacao = "plantou"
    elif maior < regra["limite_parado"]:
        situacao = "parado"
    else:
        situacao = "incerto"
    return {"ano": ano, "ndvi_max": round(maior, 3), "n_obs": len(valores), "situacao": situacao}
```

Notas:

- O `time` do MODIS é o **início** do período de 16 dias da imagem. Uma imagem que começa em 28 de julho entra na janela e cobre parte de agosto; para o MVP isso não muda o resultado.
- Credenciais do Earth Engine só em variável de ambiente (`GEE_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`), com os **nomes** no `.env.example`. O JSON da service account nunca entra no git.
- Uma chamada `getRegion` traz cerca de 460 linhas por ponto (2 satélites × 23 imagens por ano × 10 anos), bem abaixo do limite do Earth Engine. Se der erro de limite, quebrar por ano.

## Região pelo satélite (P3)

A tela 8 mostra "Em 2025, 62% da área de lavoura ficou parada depois da soja", com a série de 2015 a 2025. É a mesma regra do talhão, aplicada a toda a lavoura num raio de 30 km.

Recomendação: em vez de uma grade de pontos, classificar **todos os pixels de lavoura** do círculo direto no Earth Engine e contar por classe. Dá o mesmo resultado que a grade de 1 km do plano, com mais pixels e menos código.

Passos por ano (pipeline offline, roda uma vez por região):

1. Círculo de 30 km em volta do ponto.
2. Máscara de lavoura: pixels que eram **soja** naquele ano no MapBiomas (coleção mais recente no Earth Engine). Conferir o asset e o código da classe na legenda da coleção. O MapBiomas tem um ou dois anos de atraso: para o último ano, usar a máscara do ano mais recente disponível. Sem tempo para o MapBiomas: classe 12 (lavouras) do MODIS Land Cover `MODIS/061/MCD12Q1`.
3. Imagem do maior NDVI e da contagem de observações boas de abril a julho, com a mesma regra do talhão.
4. Classificar cada pixel (sem dado, parado, incerto, plantou) e contar com `frequencyHistogram`.
5. Gravar só os totais e os percentuais. Nenhum pixel nem ponto individual sai do pipeline (RNF-10).

```python
def regiao_ano(lon, lat, ano, mascara_lavoura, regra, raio_m=30_000):
    area = ee.Geometry.Point([lon, lat]).buffer(raio_m)
    col = (
        ee.ImageCollection("MODIS/061/MOD13Q1")
        .merge(ee.ImageCollection("MODIS/061/MYD13Q1"))
        .filterDate(f"{ano}-04-01", f"{ano}-08-01")
        .filterBounds(area)
    )
    boas = col.map(lambda img: img.select("NDVI").multiply(0.0001)
                   .updateMask(img.select("SummaryQA").lte(1)))
    maior, n = boas.max(), boas.count()
    ok = n.gte(regra["min_observacoes"])
    classe = (
        ee.Image(0)  # 0 = sem dado
        .where(ok.And(maior.lt(regra["limite_parado"])), 1)  # parado
        .where(ok.And(maior.gte(regra["limite_parado"])).And(maior.lte(regra["limite_plantou"])), 2)  # incerto
        .where(ok.And(maior.gt(regra["limite_plantou"])), 3)  # plantou
        .updateMask(mascara_lavoura)
        .rename("classe")
    )
    return classe.reduceRegion(
        ee.Reducer.frequencyHistogram(), area, scale=250, maxPixels=1e8
    ).get("classe").getInfo()  # ex.: {'0': 30, '1': 812, '2': 120, '3': 410}
```

O percentual sai no service, em Python puro, a partir do histograma: `pct_parado = parado / (parado + plantou + incerto)`, e o "sem dado" fica fora da conta mas é informado. Os limites vêm do mesmo `regras.yaml` do talhão, para as duas telas nunca discordarem.

Tabela no PostGIS:

| Coluna | Tipo | Exemplo |
| --- | --- | --- |
| `celula_id` | text | `-190_-482` |
| `ano` | int | 2025 |
| `raio_km` | int | 30 |
| `pct_parado` | numeric | 62.0 |
| `pct_plantou` | numeric | 29.0 |
| `pct_incerto` | numeric | 9.0 |
| `n_pixels` | int | 1342 |
| `fonte_mascara` | text | `mapbiomas_2023` |

No hackathon, calcular só para a região da fazenda de exemplo (UFU). Outras regiões entram quando o pipeline rodar por célula.

## Contrato da API e onde entra em cada camada

&#91;embedded content: caminho do NDVI · pipeline offline e pedido do site\]

O pipeline grava as observações brutas e os percentuais da região no PostGIS; a cada pedido, o service lê pelo repository e aplica a regra. Talhão novo sem dado no banco: o repository busca no Earth Engine e grava como cache.

**`GET /api/talhao`**, campo `historico`. O formato atual continua válido; entram `ndvi_max`, `n_obs`, os estados `incerto` e `sem_dado` e o resumo `plantou` / `sem_certeza`:

```json
"historico": {
  "anos": [
    {"ano": 2016, "situacao": "parado", "ndvi_max": 0.38, "n_obs": 12},
    {"ano": 2017, "situacao": "plantou", "ndvi_max": 0.74, "n_obs": 13},
    {"ano": 2018, "situacao": "incerto", "ndvi_max": 0.52, "n_obs": 11}
  ],
  "parado": 5, "plantou": 4, "sem_certeza": 1, "total": 10,
  "fonte": "MODIS MOD13Q1 + MYD13Q1", "janela": "04-01 a 07-31"
}
```

**`GET /api/regiao?lat&lon`** (novo):

```json
{"raio_km": 30, "fonte": "MODIS MOD13Q1 + MYD13Q1", "mascara": "mapbiomas_2023",
 "anos": [{"ano": 2025, "pct_parado": 62.0, "pct_plantou": 29.0, "pct_incerto": 9.0, "n_pixels": 1342}]}
```

| Camada | Onde | O que faz |
| --- | --- | --- |
| Pipeline | `data/extract_gee_ndvi.py` e `projeto/backend/pipeline/regiao_ndvi.py` | Busca no Earth Engine e grava `ndvi_obs` (ponto, data, ndvi\_bruto, qa, satélite) e `regiao_entressafra` |
| Repository | `ndvi_repository` | Lê `ndvi_obs` e `regiao_entressafra`; sem dado do ponto, busca no Earth Engine e grava como cache |
| Service | `historico_service`, `regiao_service` | `classificar_ano`, resumo do talhão e percentuais da região, com os limites do `regras.yaml` |
| Schema | `TalhaoResponse.historico`, `RegiaoResponse` | Formato JSON acima |
| Controller | `talhao_controller`, `regiao_controller` | Recebe lat e lon, chama o service, devolve o schema |
| Front-end | `farmService` / repository HTTP, views das telas 4 e 8 | Troca o mock pela API; estado cinza com "?" e a linha da fonte |

## Testes (TDD: escrever antes, ver falhar, depois implementar)

Todos sem rede, sem Earth Engine e sem banco real: o repository é trocado por um falso com observações montadas à mão.

**Service do histórico (backend):**

- [ ] Maior NDVI na janela de 0,72 (bruto 7.200) → `plantou`.
- [ ] Maior NDVI de 0,30 → `parado`.
- [ ] Maior NDVI de 0,52 → `incerto`.
- [ ] Valores exatamente no limite: 0,60 → `incerto`; 0,45 → `incerto`.
- [ ] Fator de escala: valor bruto 7.100 vira 0,71 (teste que falha se alguém esquecer o × 0,0001).
- [ ] Observação com `qa` 3 (nuvem) e NDVI alto é ignorada.
- [ ] Observação de 15 de março ou de 5 de agosto, com NDVI alto, fica fora da janela.
- [ ] Menos de 3 observações boas → `sem_dado`.
- [ ] Resumo: 10 anos com 5 `parado`, 4 `plantou` e 1 `incerto` → `parado: 5, plantou: 4, sem_certeza: 1, total: 10`.
- [ ] Limites lidos do `regras.yaml`: trocar 0,60 por 0,65 muda o resultado sem mudar código.

**Service da região (backend):**

- [ ] Histograma `{'0': 30, '1': 812, '2': 120, '3': 410}` → `pct_parado` 60,5, `pct_plantou` 30,6, `pct_incerto` 8,9 (o "sem dado" fica fora da conta).
- [ ] Região sem nenhum pixel de lavoura → resposta vazia, sem divisão por zero.

**Contrato da API:**

- [ ] `GET /api/talhao` da fazenda de exemplo devolve `historico.anos` com 10 itens e `situacao` dentro de `plantou | parado | incerto | sem_dado`.
- [ ] Earth Engine fora do ar → `historico: null` e a recomendação continua funcionando (plano técnico, seção 8).

**Front-end:**

- [ ] Ano `incerto` ou `sem_dado` aparece cinza com "?".
- [ ] A frase do cartão conta só os anos certos: "parada em 5 de 9 anos (1 sem certeza)".
- [ ] A linha "Visto pelo satélite MODIS (NASA), de abril a julho de cada ano" aparece embaixo da faixa.

## Calibração, limites conhecidos e riscos

Os limites 0,60 e 0,45 são ponto de partida, não verdade. A Embrapa já separou soja-milho, soja-milheto e soja-pousio no Cerrado com séries do MODIS, com acerto de 84% a 100% nessas classes ([Embrapa, 2021](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1135867/1/Big-Earth-Observation-Data-e-aprendizado-de-maquina-2021.pdf)). Antes de mostrar números reais para os jurados:

1. Juntar uns 5 talhões com histórico conhecido (o que foi plantado em cada entressafra). Começar pela área experimental da UFU, com o ICIAG.
2. Rodar a classificação e comparar ano a ano.
3. Ajustar os limites no `regras.yaml` e anotar no PR quantos anos bateram (ex.: "43 de 50").
4. Plotar a curva de NDVI de um talhão "plantou" e de um "parado" lado a lado: é uma boa imagem para o pitch e para a tela 9.

| Risco | O que acontece | O que fazer |
| --- | --- | --- |
| Pixel de 250 m mistura vizinhos | Talhão pequeno pega estrada, mata ou a lavoura do lado | Mostrar "estimativa pelo satélite"; depois, HLS (30 m) |
| Mato e milho tiguera | Terra "parada" fica verde e vira `plantou` | Aceitar no MVP; anotar na tela 9; calibrar o limite |
| Nuvem em abril | Poucas observações boas, mais `sem_dado` | Juntar MOD13Q1 e MYD13Q1 (Terra e Aqua) |
| Earth Engine lento ou fora | `/api/talhao` demora 2 a 8 s ou falha | Cache por célula; fazenda de exemplo pré-calculada; `historico: null` sem derrubar a resposta |
| Fim do Terra (2027) | Anos novos sem MOD13Q1 | MYD13Q1 enquanto durar; HLS para os anos novos |
| Licença do Earth Engine | Grátis só para uso não comercial | Rever quando o produto cobrar |

## Pronto quando

- [ ] `data/extract_gee_ndvi.py` existe e baixa as observações brutas da fazenda de exemplo (o README de `data/` passa a bater com o que tem na pasta).
- [ ] Limites e janela no `regras.yaml`, sem números fixos no código.
- [ ] Todos os testes da seção de testes passando, escritos antes do código.
- [ ] `GET /api/talhao` da fazenda de exemplo devolve os 10 anos classificados, e a tela 4 troca o mock pelos dados da API.
- [ ] Ano incerto aparece cinza com "?", e a linha "Visto pelo satélite MODIS (NASA)" aparece embaixo da faixa.
- [ ] `GET /api/regiao` devolve os percentuais de 2015 a 2025 da região da UFU, e a tela 8 lê da API.
- [ ] Calibração com pelo menos 5 talhões conhecidos, com o resultado anotado no PR.
- [ ] `pytest`, `ruff check`, `ruff format --check`, `npm test`, `npm run lint` e `npm run build` passando.

## Fontes

- [Earth Engine, catálogo do MOD13Q1 (bandas, fator 0,0001, SummaryQA, 250 m, 16 dias)](https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1)
- [Embrapa (2021), séries do MODIS para separar soja-milho, soja-milheto e soja-pousio no Cerrado](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1135867/1/Big-Earth-Observation-Data-e-aprendizado-de-maquina-2021.pdf)
- Documentos do time em `arquivos contexto/`: PRD (seções 6, 7.8 e 7.9, tarefa T-10), plano técnico do backend (seções 3.1, 5 e 8) e plano de evolução (item P3).
