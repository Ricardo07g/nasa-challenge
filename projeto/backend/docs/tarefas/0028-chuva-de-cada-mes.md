# Tarefa 0028: Chuva de cada mês na região (gráfico da tela 3) com dado real

- **Identificador:** `0028`
- **Título:** `chuva_mensal` em `/talhao` e o gráfico "Chuva de cada mês na região" ligado na API
- **Status:** Concluída
- **Prioridade:** Média (o gráfico do protótipo só aparecia no modo mock, PR #51)
- **Módulos afetados:** `app/services/monthly_rain_service.py` (novo), `app/services/talhao_service.py`,
  `app/models/talhao.py`, `app/schemas/talhao.py`; front: `src/services/monthlyRainService.ts` (novo),
  `src/models/talhao.ts`, `src/controllers/useWhenController.ts`, `src/views/WhenView.tsx`,
  `src/design-system/components/Charts.tsx` (+ `.module.css`), `src/i18n/messages.{pt,en}.ts`,
  `src/repositories/mocks/fixtures.ts`; `AGENTS.md` do backend e do front
- **Referências:** `arquivos contexto/Raiz Orbital – prompt do Lovable.md` (tela 3: "gráfico de barras simples
  da chuva média por mês (jan a jun, barras azuis decrescentes), com a legenda 'Chuva de cada mês na
  região.'"), plano técnico §3.1 (`/talhao`)

---

## 1. Descrição e motivação

A tela "Quando você colhe a soja?" (pergunta 2) tem, no protótipo, o gráfico "Chuva de cada mês na
região" (janeiro a junho). Desde o PR #51 (front sem mock), com a API real ele virava "Ainda não
conectado", porque a API não mandava o dado. O dado já estava no banco: `climate_season` tem a chuva
diária de 1/jan a 31/jul de 2005 a 2024 de cada célula (NASA POWER; depois, IMERG).

O front não tinha formato para esse dado (o modo mock desenhava barras fixas, sem modelo). O campo
foi proposto aqui e documentado nos dois `AGENTS.md`.

## 2. Contrato (`GET /api/talhao` e o `talhao` de `GET /api/exemplo`)

```json
"chuva_mensal": {
  "meses": [{"mes": 1, "media_mm": 212.7}, {"mes": 2, "media_mm": 161.0}, {"mes": 3, "media_mm": 156.8},
            {"mes": 4, "media_mm": 74.7}, {"mes": 5, "media_mm": 31.3}, {"mes": 6, "media_mm": 12.6}],
  "anos": [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014,
           2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  "fonte": "nasa_power"
}
```

(valores reais da fazenda de exemplo, célula `-190_-482`, lidos do banco local; a fixture dá os mesmos.)

- `meses`: janeiro a junho, `media_mm` = média entre os anos da chuva total do mês, com uma casa decimal.
- `anos`: os anos que entraram na média, em ordem.
- `fonte`: a `rain_source` das temporadas; com mais de uma, as chaves em ordem separadas por `+`.
- `null` fora da área ou quando nenhuma temporada cobre de 1/jan a 30/jun.

## 3. Regra (só no service)

`MonthlyRainService`:
- `monthly_totals(season)`: chuva total de cada mês (1 a 6) no ano da temporada, dia a dia pela data
  (`start_date + i`).
- `summarize(seasons)`: só os anos cuja série cobre de 1/jan a 30/jun (um ano pela metade baixaria a
  média dos meses que faltam); média de cada mês entre esses anos; sem nenhum, `None`.

O `TalhaoService` lê `get_seasons(cell_id)` (o mesmo que a recomendação usa) e entrega ao service.

No front, `rainChart(talhao)` (service) faz as barras: altura em % do mês mais chuvoso, mm arredondados
para escrever em cima da barra, primeiro e último ano, quantos anos e as chaves das fontes. A view só
escreve: legenda "Chuva de cada mês na região, em mm. Média de 2005 a 2024, NASA POWER." (com ano
faltando: "Média de 19 anos entre 2005 e 2024"); nome da fonte igual ao da tela "Como a conta é feita"
(chave desconhecida sai como veio). Descrição acessível com os mm de cada mês.

## 4. Sub-tarefas (TDD)

### Backend
- [x] `tests/unit/services/test_monthly_rain_service.py` (11 testes, temporadas de teste com valores
  redondos e fonte `teste`): soma por mês (2024 bissexto), cada dia no seu mês, média entre os anos,
  arredondamento, anos em ordem, fonte, várias fontes, ano incompleto fora, temporada que acaba em
  30/jun conta, sem temporadas e sem ano completo = `None`.
  **Red:** `ImportError: cannot import name 'ChuvaMensal'`; com o esqueleto do service, os 11 com
  `NotImplementedError`.
- [x] `tests/unit/services/test_talhao_service.py`: o falso passou a ter temporadas de 212 dias (2 mm/dia);
  `chuva_mensal` da célula (janeiro 62, fevereiro 56,5), `None` fora da área e na célula sem temporadas.
  **Red:** `AttributeError: 'Talhao' object has no attribute 'chuva_mensal'` (3 testes).
- [x] Controller: `test_talhao_controller.py` (JSON inteiro com o clima falso do conftest: fevereiro
  203,6 com 2007 e 2014 secos; `null` fora da área) e `test_recomendacao_controller.py` (`/exemplo`).
  **Red:** `KeyError: 'chuva_mensal'` (3 testes).
- [x] Guarda com os arquivos reais (`test_exemplo_dados_reais.py`): os 6 valores da fazenda de exemplo
  (passou de primeira: o código já existia).

### Front
- [x] `monthlyRainService.test.ts` (7). **Red:** 6 falhando com o esqueleto que devolvia `null`.
- [x] Mock (`farmRepositories.test.ts`): talhão com `chuva_mensal` de jan a jun e `null` fora da área.
  **Red:** `expected undefined to deeply equal [1, 2, 3, 4, 5, 6]` e `expected undefined to be null`.
- [x] `useWhenController.test.ts`: gráfico vem do talhão, `'loading'` enquanto carrega, `null` sem o campo
  ou com erro (saiu a dependência do modo da API). **Red:** `expected false to deeply equal {...}`,
  `expected false to be 'loading'`, `expected false to be null`.
- [x] `WhenView.test.tsx`: barras, descrição acessível, legenda com período e fonte, ano faltando, várias
  fontes e chave desconhecida, "Ainda não conectado", carregando, inglês. **Red:** 5 falhando (o gráfico
  ainda era o desenho fixo).
- [x] `Charts.test.tsx` (design system): o valor fica dentro da barra. **Red:** `toHaveTextContent` (o
  valor era irmão da barra).

## 5. Decisões

1. **Objeto, não lista.** O exemplo do pedido era uma lista `[{mes, media_mm}]`, mais `anos` e `fonte`:
   os três só cabem juntos num objeto (`meses`, `anos`, `fonte`).
2. **`anos` é a lista dos anos**, não a contagem: dá o primeiro, o último, quantos e os buracos. A
   legenda usa "Média de 2005 a 2024" quando não falta ano e "Média de 19 anos entre 2005 e 2024" quando
   falta.
3. **Só a média vai no JSON.** O total de cada mês em cada ano é calculado (e testado) no service, mas a
   tela só mostra a média; mandar os 120 números pesaria no sinal fraco sem uso.
4. **Ano incompleto fica de fora** (em vez de entrar só nos meses que tem), para todos os meses usarem
   os mesmos anos e a legenda valer para o gráfico inteiro. Pela regra do POWER (tarefa 0005), ano com
   dia faltando já não vira temporada.
5. **Janeiro a junho fica no service** (`CHART_MONTHS`), não no `regras.yaml`: é o recorte do gráfico,
   não um número do motor.
6. **Mock com os números reais da fazenda de exemplo** (NASA POWER, 2005 a 2024), no formato do contrato.
   O gráfico sai do dado nos dois modos; no mock, o aviso fixo "Modo de demonstração" continua.
7. **Carregando ≠ sem dado.** Enquanto o talhão carrega, a tela não mostra nada no lugar do gráfico,
   para "Ainda não conectado" não piscar antes do dado chegar.
8. **Valor em cima da barra (design system).** Com os mm em cima das barras, o texto ocupava altura e a
   barra de 100% encolhia: janeiro (213 mm) parecia só 14% maior que fevereiro (161 mm), quando são 32%.
   O valor agora fica preso em cima da própria barra (posição absoluta) e a área reserva o espaço só
   quando há valores. O gráfico da Comunidade (área parada, com %) também ficou proporcional.

## 6. Conferência com a API real

API do worktree (`uvicorn --port 8010`, banco local só leitura, pontos já gravados) e front com
`VITE_API_MODE=http`: o gráfico aparece nos três pontos (-18,9543/-48,1993: 213, 161, 157, 75, 31, 13 mm;
-19,23/-48,47: 208, 161, 140, 66, 30, 15; -19,55/-48,75 em inglês: 216, 171, 145, 70, 33, 17), com a
legenda "Média de 2005 a 2024, NASA POWER". Com a API do checkout principal (sem o campo), a tela mostra
"Chuva de cada mês na região: Ainda não conectado".

## 7. Fora do escopo

- Atualizar o plano técnico §3.1 em `arquivos contexto/` (fonte do produto): o campo está documentado
  aqui e nos `AGENTS.md`.
- IMERG: quando a temporada vier com outra `rain_source`, o campo já leva a chave nova sem mudança.
- Usar o gráfico em outras telas.

## 8. Critérios de aceitação

1. TDD: cada teste novo foi visto falhando antes do código (seção 4).
2. Backend: `uv run pytest` (613 passando, 47 pulados sem banco de teste), `ruff check` e
   `ruff format --check` passando.
3. Front: `npm test` (590 passando), `npm run lint` (0 erros) e `npm run build` passando.
4. `pre-commit run --all-files` passando.
