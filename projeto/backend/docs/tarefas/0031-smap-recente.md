# Tarefa 0031: SMAP recente e percentil na climatologia (sinal para o outono)

- **Identificador:** `0031`
- **Título:** Modo `--recente` do script do SMAP (dia mais recente + percentil na climatologia da mesma janela) e o SMAP do sinal do outono pelo `SMAP_RECENTE_PATH`
- **Status:** Concluída (o download real é com o token, pelo orquestrador)
- **Prioridade:** Média
- **Roteiro:** A2.2 (depende do R2.3, [tarefa 0029](0029-smap-por-recorte.md)); alimenta o A2.4 ([tarefa 0015](0015-servico-sinal-outono.md))
- **Módulos Afetados:** `pipeline/fetch_smap.py`, `app/repositories/sinal_outono_repository.py` (`FileRecentSoilMoistureRepository`), `app/dependencies.py`, `app/config.py` (`SMAP_RECENTE_PATH`), `.env.example`, `projeto/docker-compose.yml`, testes de pipeline, repository, dependências e controller
- **Referências:** PRD §7.10 (terra seca: SMAP `sm_rootzone_pctl` abaixo de 20 e chuva de 30 dias abaixo de 60% da média), plano de evolução A2

---

## 1. Descrição e motivação

O sinal para o outono (tarefa 0015) precisa do percentil da umidade na zona das raízes **de agora**. O
SPL4SMGP não traz percentil pronto: ele sai da climatologia do próprio SMAP. A climatologia não está nos
dados dos dias de semeadura (tarefa 0029), que só têm 08/02, 18/02 e 03/03; por isso o modo `--recente`
baixa a janela do ano que precisa, pelo mesmo recorte e o mesmo cache.

## 2. Como funciona

```
CMR (público): granulo mais recente (sort_key=-start_date) → dia D
   se D tem menos de 8 granulos, D-1 (até 3 dias antes)
   ▼
recente: os 8 granulos de D × (sm_rootzone_wetness, sm_rootzone, sm_surface) → média do dia
climatologia: D ± 7 dias em cada ano de 2016 até D.ano − 1 (150 dias) × 8 granulos × sm_rootzone
   ▼
por ponto (centro da célula de 0,1°, pixel de 9 km mais perto, como na 0029):
   percentil = % dos dias da climatologia com a média do dia abaixo da de agora (empate vale meio)
   menos de 5 anos com dado na janela → null
   ▼
smap_recente.json: contrato SMAP (serie com o dia D) + sm_rootzone_pctl em cada ponto
   ▼
API: FileRecentSoilMoistureRepository (SMAP_RECENTE_PATH) → RecentSoilMoisture(pctl, data)
```

- **29/02:** vira 28/02 nos anos que não são bissextos.
- **Variável do percentil:** `sm_rootzone` (m³/m³). A `sm_rootzone_wetness` é a mesma umidade dividida
  pela porosidade do pixel (constante), então daria o mesmo percentil; baixar só uma variável corta a
  climatologia pela metade.
- **API:** o `dependencies.py` troca o `NoAutumnSignalDataRepository` **só no SMAP**. O service da tarefa
  0015 só usa o dado da terra com SMAP **e** chuva recente juntos (PRD 7.10): até o A2.3 (IMERG Late), o
  `sinal` continua `null`, a não ser que o A2.1 (GEOS-S2S) chegue antes. O teste de controller confirma o
  caminho inteiro com uma chuva falsa.

## 3. Custo

| O quê | Pedidos | Tempo |
| --- | --- | --- |
| Dia recente | 1 busca do granulo mais novo + 1 a 4 buscas do dia no CMR; 24 recortes | ~15 s |
| Climatologia (1ª vez) | 150 buscas no CMR (públicas) e 1.200 recortes de uma variável | ~12 min com 4 em paralelo |
| Cada dia seguinte | ~10 buscas e ~80 recortes (os dias novos da janela; o resto está no cache) | ~1 min |

Conferido com o CMR de verdade em 14/11/2026 (`--recente --dry-run`): dia completo mais recente
2026-11-10, climatologia de 150 dias (2016 a 2025, 10/11 ± 7), 1.200 recortes, ~12 min.

## 4. Decisões e riscos

- **Janela de ± 7 dias e mínimo de 5 anos:** hipótese do time, para ter ~150 dias na climatologia de 10
  anos. Ficam no script (`DEFAULT_WINDOW_DAYS`, `MIN_CLIMATOLOGY_YEARS`), não no `regras.yaml`, porque é
  preparo do dado e não regra do motor; o limiar do percentil 20 continua no `regras.yaml`.
- **Dado velho:** o arquivo vale o dia em que foi gerado (`data` do ponto, mostrada na tela). Sem cron,
  o sinal pode usar um SMAP de semanas atrás; rode perto da data de plantio.
- **Latência do L4:** o granulo mais novo costuma ter 2 a 4 dias; o dia incompleto é pulado.

## 5. Critérios de aceite

- [x] Janela da climatologia (anos, ± dias, 29/02), percentil com empate e dia completo mais recente.
- [x] Arquivo do `--recente` com o percentil certo num caso de teste e lido de volta pelo contrato SMAP.
- [x] Sem anos suficientes: `sm_rootzone_pctl: null`, e o repository devolve None.
- [x] `--dry-run --recente` com o dia e o custo, sem recorte nem token.
- [x] `dependencies.py` liga o SMAP recente; GEOS-S2S e chuva seguem sem dado.
- [ ] Execução real pelo orquestrador (com o token).
