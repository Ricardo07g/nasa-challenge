# Tarefa 0046: Avisos do ponto marcado (`/avisos`)

- **Identificador:** `0046`
- **Título:** Tela "Avisos" com o botão e o contador no cabeçalho, quatro grupos (Agora, O que mudou na sua área, Fora do comum, Perto de você), NASA POWER recente com cache de 24 h e o rodapé fixo "Alertas oficiais"
- **Status:** Concluída na branch `feat/remodelagem-s6-avisos` (falta o merge em `feat/remodelagem`, depois da S5a, e a revisão)
- **Prioridade:** Média (seção 6 da remodelagem, S6)
- **PRD:** RF-31 (novo)
- **Módulos Afetados:**
  - backend: `app/config_data/regras.yaml` (grupo novo `avisos_tela`, logo depois do `avisos`), `app/models/regras.py` (`RegrasAvisosTela`), `app/repositories/rules_repository.py`, `app/models/avisos.py`, `app/repositories/recent_weather_repository.py`, `app/services/avisos_service.py`, `avisos_agora_service.py`, `avisos_mudanca_service.py`, `avisos_vizinhos_service.py`, `app/schemas/avisos.py`, `app/controllers/avisos_controller.py`, `app/dependencies.py`, `app/main.py`;
  - front: `models/avisos.ts`, `repositories/avisosRepository.ts`, `repositories/savedPointRepository.ts`, `repositories/mocks/mockAvisos.ts`, `repositories/index.ts`, `services/avisosService.ts`, `controllers/useAvisosController.ts`, `controllers/useAlertsBadge.ts`, `controllers/useShellController.ts`, `views/AvisosView.tsx`, `views/alertTexts.ts`, `design-system/components/Header.tsx` (botão "Avisos" com o número), `design-system/icons` (sino e olho), `pages.tsx`, `routes.tsx`, `i18n/messages.{pt,en}.ts` (bloco novo `alerts`), artigo do Guia "Como ler os avisos".
- **Referências:** pedido de remodelagem de 15/11/2026 (seção 6 e regras gerais), `projeto/backend/docs/remodelagem.md` (D90 a D104), tarefas 0019 (avisos do replay), 0033/0038 (ENSO e SMAP recente), 0042 (fim das chuvas), 0043 (raio-X) e 0047 (comunidade)

---

## 1. O que foi feito

- **Endpoint novo `GET /api/avisos?lat&lon[&colheita][&solo][&confirmadas]`** (D93): roda o motor do `/recomendacao` uma vez (a melhor opção vai no ENSO, na safrinha e no "O que mudou") e junta os quatro grupos, o período comparado, a safrinha e o `contador`. ~0,5 s na lavoura de demonstração com o POWER em cache; ~1,6 s no primeiro pedido do dia (o POWER). Erros como no `/recomendacao` (404 `OUTSIDE_AREA`, 422).
- **Grupo 1, Agora** (`AvisosAgoraService`):
  - terra seca: percentil do SMAP recente de 20 ou menos → "A terra está mais seca que em X% dos anos nesta época." (X = 100 − percentil, D96); leitura com mais de 15 dias marcada como antiga;
  - dias sem chuva e calor: os 30 dias até ontem do NASA POWER no centro da célula de 0,1°, pedidos pelo backend (`PowerRecentWeatherRepository`, cache de 24 h por célula e janela, 8 s no máximo, espera de 15 min depois de falha, D95). Aviso com 10 ou mais dias seguidos abaixo de 1 mm (o dia seco dos avisos) até a última leitura, ou 3 ou mais dias de 35 °C (o calor do motor) nos últimos 10. A data da última leitura vai junto. Se a API falhar, o aviso não aparece. A chuva recente **não** é comparada com o normal;
  - El Niño / La Niña: com o arquivo da previsão da NOAA, a estação do outono (FMA de 2027) com a fase mais provável em 50% ou mais (as mesmas regras do sinal, D97), e como a melhor opção do motor se saiu na célula nos anos daquela fase (ONI) e nos outros, "São poucos anos.";
  - safrinha: entre a semeadura (a do motor para a faixa) e a colheita (semeadura + ciclo da melhor opção), com o "hoje" injetado, os avisos de veranico e calor do `CropAlertService` (a regra do replay) nos dias recentes; fora dela, a próxima safrinha e o link "Ver como teriam sido os avisos em 2024" para `/resposta?<parâmetros do fluxo>&ano=2024` (D98; com a S5a, o `ano` abre o detalhe do ano no explorador).
- **Grupo 2, O que mudou na sua área** (`AvisosMudancaService.changes`): 2020–2024 contra 2005–2019 na série da célula: maior veranico de março a maio (média dos anos), fim das chuvas (mediana, regra da tela 3), dias de 35 °C de março a maio (média por ano), falta de água da melhor opção no ciclo (média, mm: ETc − ETr do balanço do motor, `cycle_deficits`) e a parte dos anos em que ela deu certo. Só entra a mudança acima do mínimo do `regras.yaml` (D99), com os dois números lado a lado e "São poucos anos: mostra o que aconteceu, não uma previsão.".
- **Grupo 3, Fora do comum** (`AvisosMudancaService.records`): maior veranico de março a maio, outono mais seco (com a média), fim das chuvas mais cedo e ano com mais dias de calor, uma linha cada, com o ano (D100).
- **Grupo 4, Perto de você** (`AvisosVizinhosService`): eventos relatados pela comunidade (tarefa 0047) nos últimos 7 dias a até 30 km, um aviso por tipo com o número de relatos e o mais recente, sempre com "Relato de vizinho, não confirmado"; com fogo, "Em caso de fogo, ligue 193 (Bombeiros)." (D101). Sem banco, o grupo não aparece.
- **Cada aviso** tem o nível em texto ("Atenção" ou "Fique de olho", D94) com ícone (triângulo ou olho), o que o dado mostra, "O que fazer:" em uma frase, a fonte e a data da leitura (ou "dados até 30 de julho de 2024" nos grupos da série). Grupo sem aviso: "Nada fora do normal." com a data da última leitura.
- **Botão "Avisos" no cabeçalho**, logo depois de "Comunidade", com o número de avisos ativos (Agora + Perto de você, D92) num selo e no nome acessível ("Avisos: 2 avisos ativos"). O `useAlertsBadge` guarda no aparelho o último ponto do fluxo (nunca a fazenda de exemplo, D91) e pede os avisos uma vez por ponto e idioma na visita (o mesmo pedido da tela). Sem ponto, sem aviso ou com falha, o botão fica sem número. Até 480 px o cabeçalho fica mais justo e, se não couber, os botões descem uma linha (D103).
- **Tela `/avisos`**: vale o ponto da URL (o que a pessoa está olhando) ou, sem ele, o salvo no aparelho; sem nenhum, "Marcar minha lavoura". Mostra "Lavoura perto de <cidade>" (lista do front, sem rede) e "Saiba mais: como ler os avisos".
- **Rodapé fixo "Alertas oficiais"** (sempre na tela, com ou sem ponto, D102): o aviso de que não são alertas oficiais, SMS do CEP para 40199 (botão `sms:40199`), WhatsApp "Oi" para (61) 2034-4611 (botão `https://wa.me/556120344611`), "Defesa Civil Alerta" sem cadastro, 193 e 199 (botões `tel:`) e o artigo "Alertas oficiais da Defesa Civil" do Guia.
- **Guia:** artigo novo "Como ler os avisos" (pt e en, tema clima, sem rascunho), só com fontes já conferidas em `verifiedSources.ts` (D104).

## 2. Contrato (resumo; o completo está no `AGENTS.md` do backend)

```json
{"ponto": {"lat": -18.9543, "lon": -48.1993}, "celula_id": "-190_-482", "hoje": "2026-11-15", "contador": 1,
 "agora": {"avisos": [{"tipo": "enso", "nivel": "fique_de_olho", "fontes": ["noaa", "gpm_imerg"], "data": "2026-11-12",
   "antiga": false, "valores": {"fase": "el_nino", "chance_pct": 98, "estacao": "FMA", "ano": 2027, "cultura": "milho_braquiaria",
   "nome": "Milho com braquiária", "anos_fase": 7, "bons_fase": 5, "anos_outros": 13, "bons_outros": 11, "ano_inicio": 2005, "ano_fim": 2024}}],
   "ultima_leitura": "2026-11-12"},
 "mudou": {"avisos": [...], "ultima_leitura": "2024-07-30"}, "periodo": {"recente_inicio": 2020, "recente_fim": 2024, "antes_inicio": 2005, "antes_fim": 2019},
 "recordes": {"avisos": [...], "ultima_leitura": "2024-07-30"}, "perto": {"avisos": [], "ultima_leitura": "2026-11-15"},
 "raio_km": 30.0, "vizinhos_dias": 7,
 "safrinha": {"em_andamento": false, "cultura": "milho_braquiaria", "nome": "Milho com braquiária", "semeadura": "2027-02-18", "colheita": "2027-06-18", "explorar_ano": 2024}}
```

## 3. Números com dado real (banco `raiz_orbital_remodelagem`, 15/11/2026, colheita meio)

**Fazenda de exemplo (−18,9543 / −48,1993), célula `-190_-482`: contador 1.**

| Grupo | Aviso | Valor | Fonte |
| --- | --- | --- | --- |
| Agora | terra seca | não aparece (percentil **59,3**, SMAP de 10/11/2026) | SMAP |
| Agora | dias sem chuva | não aparece (1 dia seco até 12/11, a última leitura) | NASA POWER |
| Agora | calor | não aparece (**2** dias de 35 °C ou mais de 3 a 12/11: 35,2 °C em 5/11 e 35,9 °C em 7/11) | NASA POWER |
| Agora | El Niño | previsão de fevereiro a abril de 2027: **El Niño, 98%**; milho com braquiária deu certo em **5 de 7** anos de El Niño e em **11 de 13** nos outros | NOAA + GPM IMERG |
| Agora | safrinha | não está em andamento; próxima: milho com braquiária, **18/02/2027 a 18/06/2027**; link do ano **2024** | motor |
| O que mudou | maior veranico de março a maio | **27,2** dias em 2020–2024; **20,8** em 2005–2019 | GPM IMERG |
| O que mudou | fim das chuvas | **13/abr** em 2020–2024; **24/abr** em 2005–2019 (11 dias mais cedo) | GPM IMERG |
| O que mudou | falta de água no ciclo (milho com braquiária) | **177,4 mm** por ano em 2020–2024; **101,6 mm** em 2005–2019 | GPM IMERG + NASA POWER |
| O que mudou | deu certo (milho com braquiária) | **3 de 5** anos em 2020–2024; **13 de 15** em 2005–2019 | GPM IMERG + NASA POWER |
| O que mudou | dias de 35 °C de março a maio | não aparece (abaixo de 1 dia por ano de diferença) | NASA POWER |
| Fora do comum | maior veranico | **43 dias** a partir de 19/abr/**2024** | GPM IMERG |
| Fora do comum | outono mais seco | **178 mm** de março a maio de **2021** (média 330,7 mm) | GPM IMERG |
| Fora do comum | fim das chuvas mais cedo | **16/mar/2021** | GPM IMERG |
| Fora do comum | ano com mais calor | **3 dias** de 35 °C ou mais em **2024** | NASA POWER |
| Perto de você | eventos de vizinhos | nenhum ("Nada fora do normal", leitura de 15/11/2026) | comunidade |

**Ponto da cidade (−18,9149 / −48,2568), célula `-190_-483`: contador 1**: os mesmos avisos de agora (El Niño, 5 de 7 e 11 de 13) e o mesmo grupo de mudanças (veranico 20,2 → 26 dias; fim das chuvas 24/abr → 13/abr; falta de água 102,2 → 175,7 mm; deu certo 13 de 15 → 3 de 5); outono mais seco 170 mm em 2021 (média 330 mm).

**Ponto com a terra seca (−19,55 / −48,95, colheita tarde), célula `-196_-490`: contador 3**: terra seca (**percentil 15,3**, "mais seca que em 85% dos anos"), calor (**5 dias** de 35 °C ou mais nos últimos 10 até 12/11) e El Niño (milheto, 6 de 7 e 12 de 13); mudanças: veranico 22,1 → 27,8 dias, dias de 35 °C de março a maio **0 → 4,4** por ano, falta de água 57,4 → 108,5 mm, deu certo 15 de 15 → 3 de 5; recordes: veranico de 43 dias em 2024, outono de 141,1 mm em 2021, fim das chuvas em 25/mar/2005 e **15 dias** de calor em 2024.

## 4. Testes (TDD; os "red" anotados)

- **Backend** (1.667 com banco, 1.597 sem): `test_rules_repository.py` (5 novos: red = `AttributeError: 'Regras' object has no attribute 'avisos_tela'` e `KeyError: 'avisos_tela'`); `test_recent_weather_repository.py` (5, red = `ModuleNotFoundError`); `test_avisos_agora_service.py` (24; red = `ModuleNotFoundError`; o do calor da safrinha, red = `AssertionError` sem `temp_c`); `test_avisos_mudanca_service.py` (12, red = `ModuleNotFoundError`); `test_avisos_vizinhos_service.py` (2, red = `ModuleNotFoundError`); `test_avisos_service.py` (9, red = `ModuleNotFoundError`; depois, 1 falha da janela esperada no teste, 31 dias em vez de 30, corrigida no teste); `test_avisos_controller.py` (7, red = `ImportError` de `get_recent_weather_repository`).
- **Front** (991): `avisosRepository.test.ts` (3) e `savedPointRepository.test.ts` (4) (red = import não resolvido); `avisosService.test.ts` (9, red = import); `useAvisosController.test.ts` (6, red = import); `AvisosView.test.tsx` (14; red = import, depois 11 falhas porque o `Card` não aceita `aria-labelledby`, trocado por `aria-label`; o "Saiba mais", red = link ausente); `Header.test.tsx` (2 novos, red = sem o link "Avisos"); `useAlertsBadge.test.ts` (4, red = import); `useShellController.test.ts` (2 novos, red = `header.alerts` indefinido); `routes.test.tsx` (3 novos; red = rota inexistente (volta ao início), depois o ponto salvo em memória vazando entre testes com o `localStorage` limpo, corrigido no repository; e o artigo novo, red = "Não achamos esse artigo."). O teste do conteúdo do Guia confere o artigo novo.

## 5. O que não foi feito e por quê

- **Notificação por push:** fora do pedido ("aparecem quando o app é aberto").
- **Safrinha em andamento com dado real:** hoje (15/11) não há safrinha; a regra foi conferida só com o "hoje" injetado nos testes.
- **Link do ano antes da S5a:** `/resposta?…&ano=2024` abre a Sugestão sem o detalhe do ano até a S5a entrar.
- **Cache do POWER entre processos:** o cache fica na memória do processo; reiniciar a API ou ter mais de um processo pede o POWER de novo.
- **Falta de água da linha "Água" (S5a):** o grupo 2 calcula a falta de água no ciclo com o mesmo balde do motor (`cycle_deficits`); se a S5a trouxer a conta dela, unificar no merge.
