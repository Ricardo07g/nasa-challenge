# Tarefa 0038: sinal para o outono pela previsão do El Niño / La Niña e regra da data

- **Identificador:** `0038`
- **Título:** Sinal para o outono pela previsão oficial do ENSO da NOAA CPC e o histórico da opção
  nos anos daquela fase, regra da data com a chuva guardada e o SMAP de agora como informação
- **Status:** Concluída no código (testes com HTTP falso). A previsão real foi lida da página da
  NOAA CPC na investigação (15/11/2026); quem roda o script de verdade é o orquestrador (seção 6)
- **Prioridade:** Alta (RF-20: o `sinal` saía sempre `null`, "Ainda não conectado" na tela 7)
- **Decisão do usuário (15/11/2026):** "El Niño + regra da data". **Fora:** o GEOS-S2S (só
  NetCDF-4/HDF5, [tarefa 0032](0032-geos-s2s-investigacao.md)) e o IMERG Late (só de fev a jul,
  [tarefa 0033](0033-chuva-30-dias-imerg-late.md)); os repositories e o código deles continuam no
  repositório, sem uso no sinal. **Fica:** o SMAP recente ([tarefa 0031](0031-smap-recente.md)),
  só para informar.
- **Módulos Afetados:** `pipeline/fetch_enso_previsao.py`, `app/models/enso_forecast.py`,
  `app/repositories/enso_forecast_repository.py`, `app/services/sinal_outono_service.py`,
  `app/models/sinal_outono.py`, `app/schemas/recomendacao.py`, `app/config.py`,
  `app/dependencies.py`, `app/config_data/regras.yaml` (grupo `sinal_enso`), `.env.example`,
  `projeto/docker-compose.yml`; no front, `src/models/recomendacao.ts`, `src/views/PlanView.tsx`,
  `src/views/ReportView.tsx`, `src/i18n/` e o mock
- **Referências:** PRD RF-20 e 7.10, [tarefa 0015](0015-servico-sinal-outono.md) (serviço do sinal),
  [tarefa 0035](0035-detalhe-de-cada-ano.md) (ONI de cada ano e `anos_detalhe`)

---

## 1. Descrição

O sinal marca o **Plano A** (`normal`) ou o **Plano B, se secar** (`seco`) pela chance oficial de El
Niño, neutro e La Niña da NOAA CPC para fevereiro a abril, junto com o desempenho da opção do 1º ano
do Plano A nos anos daquela fase. Junto vem a **regra da data**, que o produtor aplica perto do
plantio, e uma linha com o **SMAP de agora**, que não decide nada.

## 2. A fonte da previsão (investigação, 15/11/2026)

Pedidos públicos, sem credencial, com `curl` (5 páginas, ~250 KB no total):

| Página | URL | Formato | Resultado |
| --- | --- | --- | --- |
| **Official NOAA CPC ENSO Probabilities** (a usada) | `https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/` | HTML com `<table id="probabilities-table">`: `Season`, `La Niña`, `Neutral`, `El Niño`, chances inteiras em %, 9 estações de 3 meses; título `Issued November 2026` | ~28 KB, HTTP 200, texto no servidor (sem JavaScript). Lido com o `html.parser` da biblioteca padrão |
| **ENSO Diagnostic Discussion** (o dia) | `https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml` | HTML; cabeçalho `CLIMATE PREDICTION CENTER/NCEP/NWS 12 November 2026` | ~13 KB. Dá o dia da emissão (a tabela só diz o mês) |
| ENSO QuickLook da IRI | `https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/` | HTML; a chance oficial da CPC é **imagem** (`enso-probs-current.png`); as da IRI estão em imagem e em texto corrido | Descartada: sem tabela legível |
| Official NOAA RONI Outlook | `https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/outlook/` | HTML com tabela de percentis do RONI previsto (5% a 95%) por estação | Descartada: não dá a chance de cada fase (a página aponta para a das probabilidades) |
| RONI (histórico) | `https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/` | HTML com tabela por ano e estação | Só conferido (risco da seção 7) |

- **Emissão vista:** 12/11/2026 (`Issued November 2026`). **Cadência:** 2ª quinta-feira de cada mês,
  com a discussão. Próxima discussão: 10/12/2026 (está na própria página).
- **Números da emissão de 12/11/2026:** OND, NDJ, DJF e JFM com 100% de El Niño; **FMA 2027: La Niña
  0%, neutro 2%, El Niño 98%**; MAM 2027: 0%, 20%, 80%; AMJ: 1%, 61%, 38%; MJJ: 13%, 75%, 12%; JJA:
  33%, 61%, 6%.
- A 1ª estação da tabela é a do meio no mês da emissão (em novembro, OND), e o ano de cada estação é
  o do mês do meio (como a tabela do ONI: o DJF de 2027 é dez/2026 a fev/2027).
- Desde 2026 a NOAA verifica a previsão pelo **RONI** (Niño 3.4 relativo), com ±0,5 °C; o histórico
  do motor usa o ONI (tarefa 0035). Ver seção 7.

## 3. Decisões

- **Estação FMA (fevereiro a abril)**, no `regras.yaml` (`sinal_enso.estacao_previsao`):
  1. vai da semeadura (fevereiro) à floração da safrinha (abril);
  2. é a última estação da média do ONI dos anos da série (grupo `enso`: DJF, JFM e FMA), então a
     fase prevista e a dos anos passados medem a mesma época;
  3. sai com 1 mês a menos de antecedência que MAM, antes da barreira de previsibilidade do outono.
  MAM cobriria melhor o fim do ciclo, mas fica fora da janela do ONI dos anos passados.
- **Nível** (números no grupo `sinal_enso`, hipótese do time, **a revisar**):
  - `incerto` se nenhuma fase tem a chance mínima (`fase_chance_min_pct`: 50%) ou se duas empatam
    no topo;
  - `incerto` se a série tem menos de `anos_fase_min` (5) anos daquela fase para a opção do 1º ano
    do Plano A (ou nenhum ano com o ONI);
  - `seco` se essa opção deu errado (o `bom` do `anos_detalhe`, aperto do PRD 7.2) em metade ou
    mais (`fracao_anos_ruins_seco`: 0,5) dos anos da fase **e** o 1º ano do Plano B se saiu melhor
    neles (ou é a mesma cultura, ou é pousio). Se o Plano B não foi melhor: `incerto`, e o motivo
    diz isso (decisão do time: marcar o Plano B que também deu errado nesses anos seria desonesto);
  - `normal` no resto.
  O neutro é a fase `None` do ONI; ano sem ONI no arquivo não conta como neutro.
- **Motivo:** uma frase com a previsão e o histórico, sem chamar El Niño de "ano seco" (PRD 7.10):
  "Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA). Nos 7 anos de El Niño desde 2005,
  milho sozinho deu certo em 5." No `seco`, entra o número do Plano B ("e sorgo em 5").
- **Regra da data** (no service): "Se nos 30 dias antes de <data limite> chover menos que X mm
  (60% da média de M mm), vá de plano B: <B> no lugar de <A>." X = `sinal_outono.chuva_fracao_seco`
  (0,60) × a média (M) da chuva desses 30 dias na série guardada da célula (`climate_season`, a mesma
  do motor: POWER ou IMERG), arredondados em mm. A janela é da data limite − 30 dias até a véspera;
  ano sem a janela inteira fica de fora. A data limite é a da cultura do 1º ano do Plano A (ou do B,
  se o A começa em pousio). Sem a série, volta a frase antiga do dia de plantar.
- **SMAP de agora:** `smap_agora.texto`, uma faixa do percentil em 5 (`sinal_enso.smap_faixas_pct`:
  20, 45, 55, 80) + o percentil e o dia. Não muda o nível. Só com o SMAP (sem previsão), o `sinal`
  continua `null`.
- **Previsão velha:** se a estação FMA já acabou (30/abr), ou a previsão não chega até ela, o `sinal`
  sai `null`.
- **Fonte na frase vem do arquivo** (`fonte`: "NOAA"), não fixa no service: os testes usam um rótulo
  de teste.
- **Contrato do front mantido:** `regra_dia_plantar` continua (o texto agora é a regra da data);
  entram opcionais `regra_data` (números da regra) e `smap_agora`. `fonte` lista a previsão primeiro,
  depois a chuva (NASA POWER / GPM IMERG) e o SMAP.

## 4. Contrato

Seção "Previsão do ENSO" do `AGENTS.md` do backend: `versao_dados` (fonte `noaa_cpc_enso`),
`fonte` ("NOAA", vai na frase), `emitida_em` e `estacoes[]` com `estacao`, `ano`, `la_nina`,
`neutro`, `el_nino` (inteiros em %, somando 100 ± 2). Saída padrão
`data/baixados/noaa_enso_previsao/enso_previsao.json`, lida pelo `ENSO_PREVISAO_PATH` (já ligado no
compose).

## 5. Sub-tarefas (TDD)

- [x] Model `EnsoForecast` / `EnsoSeasonForecast` (`tests/unit/models/test_enso_forecast.py`, 17
  testes): falhou com `ModuleNotFoundError: No module named 'app.models.enso_forecast'`.
- [x] `FileEnsoForecastRepository` (`tests/unit/repositories/test_enso_forecast_repository.py`, 5
  testes): falhou com `ModuleNotFoundError` (`app.repositories.enso_forecast_repository`).
- [x] `ENSO_PREVISAO_PATH` no `Settings` (`test_config.py`): falhou com `AttributeError`
  (`enso_previsao_path`).
- [x] Grupo `sinal_enso` no `regras.yaml` (`test_rules_repository.py`, 2 testes): falhou com
  `AttributeError: 'Regras' object has no attribute 'sinal_enso'` e `KeyError: 'sinal_enso'`.
- [x] Service (`tests/unit/services/test_sinal_outono_service.py`, 35 testes, reescrito para a regra
  nova): falhou primeiro com `ImportError: cannot import name 'RegraData'` e, com os models, com
  `TypeError: SinalOutonoService.__init__() got an unexpected keyword argument 'today'` (33 testes).
  Um teste a mais pegou o plural errado em inglês ("No La Niña years").
- [x] `RecommendationService` passa a série ao sinal (`test_recommendation_service.py`): falhou
  porque a `fonte` vinha sem a chuva (`('Fonte de teste',)`).
- [x] Ligação (`test_dependencies.py`) e conftest das rotas: falharam com `AttributeError` e
  `ImportError` (`get_enso_forecast_repository`).
- [x] Schema (`test_recomendacao_controller.py`, `test_smap_recente.py`): falharam sem
  `regra_data` e `smap_agora` no JSON (`KeyError: 'smap_agora'`).
- [x] Script (`tests/unit/pipeline/test_fetch_enso_previsao.py`, 19 testes, HTML falso no formato
  da NOAA): tabela, mês, cabeçalho trocado, linha fora do formato, estações fora de ordem, 1ª estação
  fora do mês, dia da discussão, arquivo lido pelo repository, discussão de outro mês, chances que
  não somam 100, nova tentativa, formato inesperado sem gravar, `--dry-run`. Falhou com
  `ModuleNotFoundError: No module named 'pipeline.fetch_enso_previsao'`. Conferido também com as
  páginas reais baixadas na investigação (sem pedido novo).
- [x] Front, tela 7 (`PlanView.test.tsx`): 5 testes falharam sem os textos novos (fonte e dia, plano
  marcado, linha do SMAP, nota da regra da data, inglês); o relatório (`ReportView.test.tsx`) falhou
  com a fonte nova.
- [x] Docs: `AGENTS.md` do backend, `docs/como-preparar-os-dados-locais.md`, RF-20 do PRD.

## 6. Como rodar (orquestrador)

```bash
cd projeto/backend
uv run python -m pipeline.fetch_enso_previsao --dry-run   # os 2 pedidos, sem rede
uv run python -m pipeline.fetch_enso_previsao             # grava data/baixados/noaa_enso_previsao/
```

Rodar no checkout principal (a pasta `data/baixados` fica na raiz do repositório) ou passar
`--saida`. Depois, reiniciar o backend (o arquivo é lido uma vez por processo). Repetir todo mês,
depois da 2ª quinta-feira.

**Exemplo com os dados reais da fazenda da UFU** (−18,9543 / −48,1993, colheita "meio", banco local
com o IMERG, ONI e SMAP recente de `data/baixados`, previsão de 12/11/2026): `normal` (Plano A).
"Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA). Nos 7 anos de El Niño desde 2005,
milho sozinho deu certo em 5." Regra: "Se nos 30 dias antes de 28/fev chover menos que 136 mm (60%
da média de 227 mm), vá de plano B: crotalária no lugar de milho sozinho." SMAP: "Sua terra está um
pouco mais úmida que o normal agora (SMAP, percentil 59, 10/11/2026)." Fontes: NOAA, GPM IMERG, SMAP.

## 7. A revisar

- **RONI x ONI:** a previsão é verificada pelo RONI e o histórico usa o ONI (média de DJF a FMA,
  tarefa 0035). Nos anos da série as fases quase sempre batem, mas o RONI tende a dar El Niño mais
  fraco que o ONI nos anos recentes. Se o time quiser o mesmo índice nos dois lados, a página do
  RONI tem a tabela por ano (HTML, mesmo formato simples).
- **Números do `sinal_enso`** (50%, 5 anos, metade dos anos, faixas do SMAP): hipóteses do time,
  para a agrônoma revisar. Com 20 anos de série há 5 a 8 anos por fase: o histórico é curto e a frase
  diz os números para o produtor julgar.
- **Validação (PRD 7.10):** rodar a regra nas previsões passadas da NOAA (o formulário "Archives" da
  mesma página lista as emissões no formato novo, desde agosto de 2026) para
  dizer na tela 9 em quantos anos o sinal teria acertado.
- **Formato da página:** é HTML de tabela; se a NOAA mudar a página, o script recusa e não grava
  (o arquivo antigo continua). A tabela e a discussão precisam ser da mesma emissão: no dia da
  publicação, uma pode sair antes da outra; o script pede para rodar de novo mais tarde.
