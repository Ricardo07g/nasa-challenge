# Remodelagem do produto (iniciada em 15/11/2026)

Pedido do usuário: `arquivos contexto/prompt-raiz-orbital.md` (9 seções). Este arquivo é o roteiro, o
estado de cada entrega, o registro das decisões e a revisão. Quem trabalhar numa seção lê o pedido
inteiro (as "Regras gerais" valem para todas), os `AGENTS.md` e esta página.

## Como trabalhamos

- **Uma branch e um PR só, sem merge** (pedido do usuário, 15/11 ~02:10): tudo entra em `feat/remodelagem`;
  o PR para o `main` fica aberto para o usuário revisar e decidir. Cada seção é uma branch
  `feat/remodelagem-sN-...` criada de `feat/remodelagem` e juntada nela com merge, sem PR próprio.
- **Ordem do pedido, uma entrega por seção.** No máximo duas seções em paralelo, só quando não mexem
  nos mesmos arquivos (coluna "Junto com").
- **TDD e camadas** como em todo o repositório. Cada seção tem a tarefa em `docs/tarefas/` (número abaixo)
  e o requisito no PRD no mesmo PR.
- **Só dados que já temos** (banco e `data/baixados/`). Sem dado para o ponto, o elemento não aparece.
- **Revisão de cada seção** depois do merge: testes, telas no Chrome sem interface (pt e en, celular e
  computador) e a lista de itens do pedido marcada aqui (✅ feito, ⚠️ feito com ressalva, ❌ não feito e
  por quê).

## Roteiro

| # | Seção do pedido | Tarefa | O que entra | Junto com | Estado |
| --- | --- | --- | --- | --- | --- |
| S1 | 1. Valores em reais (e a regra geral de esconder "Ainda não conectado") | 0040 | nota de renda sem preço nem custo no motor (`regras.yaml`), "Renda" com fatos, nenhum R$ na API nem no front, selos "Ainda não conectado" escondidos, "Como a conta é feita" | S8 | ✅ na branch (15/11 ~03:20), revisada |
| S8 | 8. Guia | 0048 | `/guia` e `/guia/<artigo>`, artigos em Markdown pt/en (primeiro os da lista prioritária), busca por título, imagens das plantas (SVG próprio) | S1 | feito na branch `feat/remodelagem-s8-guia` (19 artigos em pt e en; faltam 7 do tema, ver a tarefa 0048) |
| S2 | 2. Onde fica a lavoura | 0041 | busca com autocompletar (Photon/OSM), coordenadas e link do Google Maps colados, "Confirmar local" com pin, endereço aproximado, limite da área piloto e bloqueio fora dela | S3 | feita na branch `feat/remodelagem-s2-onde` (falta o merge em `feat/remodelagem` e a revisão); `GET /api/area-piloto` novo |
| S3 | 3. Quando você colhe | 0042 | data exata + "Não sei o dia exato", sugestão = seleção, chuva que sobra (mediana e ano seco), chuva × ETo por mês, custo do atraso, fim das chuvas | S2 | a fazer |
| S4 | 4. O que o satélite viu (raio-X) | 0043 | painel escuro com 8 blocos, histórico em faixa de calor do NDVI, alertas (geada, chuva forte, fogo: MCD64A1 na ORNL ou índice substituto), cartões menores | — | a fazer |
| S5a | 5. Abas: objetivo, Sugestão e Água | 0044 | abas Sugestão / Comparar / Plano, seletor "O que você quer mais?", linha Água e sede da cultura, explorador ano a ano (substitui `/safra-passada`), "Como fazer" em 4 partes, aviso único da colheita tarde, sem relatório | — | a fazer |
| S5b | 5. Comparar e Plano de 3 anos | 0045 | Comparar (até 3 culturas, colunas, "Usar no meu plano"), Plano editável com notas na hora, saúde da terra da rotação, chuva aproveitada, "Como é hoje" com o NDVI e a confirmação, Plano A/B com número derivado da série, sem "Comece por um pedaço" | — | a fazer |
| S6 | 6. Avisos | 0046 | `/avisos` com contador, grupos Agora / O que mudou / Fora do comum / Perto de você, POWER recente com cache de 24 h, rodapé "Alertas oficiais" | S7 | a fazer |
| S7 | 7. Comunidade | 0047 | relatos (plantio, chuva, evento) sem cadastro, tabela `community_report`, endpoints, mapa de 30 km, resumo "Perto de você" | S6 | a fazer |
| S9 | 9. Consistência e revisão final | 0049 | missão com as fontes certas, "Como a conta é feita" com as regras novas, nenhum link para telas removidas, lista final do pedido | — | a fazer |

Ordem de merge: S1 → S8 → S2 → S3 → S4 → S5a → S5b → S6 → S7 → S9. Se a janela de uso acabar, a
retomada automática continua da primeira seção não terminada (arquivo de retomada do orquestrador).

## Decisões (registro)

Cada decisão tomada sem o usuário entra aqui, com o porquê. Decisões de produto ficam "a revisar".

| # | Data | Decisão | Por quê |
| --- | --- | --- | --- |
| D1 | 15/11 | A S8 (Guia) roda junto da S1 e sai antes das outras telas. | É conteúdo em arquivos próprios, sem conflito, e as outras seções linkam para os artigos. |
| D2 | 15/11 | "Esconda todos os selos 'Ainda não conectado'" (regra geral do pedido) substitui a regra do `projeto/frontend/AGENTS.md` que mandava mostrar o selo. Feito na S1, com o AGENTS do front atualizado no mesmo PR. | O pedido é a decisão mais recente do usuário. |
| D3 | 15/11 | Busca de endereço pelo **Photon** (komoot, OpenStreetMap, sem chave), com espera de ~400 ms entre teclas e uma busca por vez; endereço aproximado do pin pelo *reverse* do Photon; atribuição "© OpenStreetMap". | Feito para autocompletar e sem cadastro; uma fonte só para buscar e para o endereço. |
| D4 | 15/11 | Imagens das plantas: ilustrações próprias em SVG, simples, feitas no repositório. | O pedido proíbe IA sem marca d'água; SVG próprio não tem licença a conferir. |
| D5 | 15/11 | O histórico usa **2017–2026** (10 anos até a entressafra mais recente, decisão de 15/11, tarefa 0039), não 2016–2025 como está escrito na seção 4. | Decisão mais recente do usuário. |
| D6 | 15/11 | O Guia (S8) é escrito com o modelo Sonnet; as seções de código, com o modelo padrão. | Poupa a janela de uso no trabalho de texto, sem perder a revisão (o orquestrador revisa). |
| D8 | 15/11 | Tudo numa branch (`feat/remodelagem`) e num PR sem merge; as telas são revisadas num segundo ambiente local (API na porta 8001 e front na 5174, a partir do worktree da branch), sem mexer no checkout que o Docker do usuário usa. | Pedido do usuário; o checkout principal segue no `main`, que ele usa para testar. |
| D7 | 15/11 | O orquestrador não consegue ler o percentual da janela de 5 horas. Mitigação: no máximo 2 subagentes ao mesmo tempo, entregas pequenas e commitadas, e a retomada automática a cada 30 min continua depois que a janela libera. | Não há ferramenta que mostre o uso; o que dá para garantir é não perder trabalho. |
| D9 | 15/11 | O Guia tem 19 artigos em pt e en: os 12 prioritários e 7 de apoio (palhada, adubo verde, nematoide, geada, El Niño e La Niña, calor de 35 °C, clima de 2041 a 2060). Faltam 7 (plantio direto, sementes, plantar logo depois da colheita, erosão, quando a chuva acaba, raio-X, fogo na palha). | Os que faltam dependem de uma fonte conferida ou de telas das seções 3 e 4, ainda não feitas; é melhor faltar artigo do que citar o que não foi aberto. |
| D10 | 15/11 | Todo link externo dos artigos precisa estar em `src/content/guia/verifiedSources.ts` (data e o que a página confirma); um teste barra qualquer outro. | Garante a regra "só cite página que você abriu". |
| D11 | 15/11 | Artigos de cultura, plantio e manejo, e também os de geada, conta de água e palhada, saem como rascunho (`rascunho: sim`); a view põe "Rascunho: a revisar pela agrônoma." no topo. | Pedido do usuário; os números são hipótese do time. |
| D12 | 15/11 | O Markdown vira uma árvore de blocos (`markdownService`) e a view desenha com React: nunca há `dangerouslySetInnerHTML`, e HTML no texto vira texto puro. | Segurança sem biblioteca nova. |
| D13 | 15/11 | O Guia usa o requisito RF-26 do PRD. | Próximo RF livre no PRD. Se outra seção também pegar o RF-26, renumerar na hora do merge. |
| D14 | 15/11 | Nota de renda (S1): quem dá grão tem a segurança climática da própria opção (anos bons ÷ total × 100; no cenário seco, só os anos secos); cobertura e pousio ficam com `renda.nota_sem_grao` = 0. Mesmos eixos e pesos na nota final. **A revisar.** | É a proposta do pedido; o PRD 5 já dava renda 0 às coberturas, e uma nota maior faria a cobertura subir duas vezes (ela já ganha no eixo do solo). |
| D15 | 15/11 | "Dá grão" = `tipo` `grao` ou `consorcio` do `culturas.yaml` (`renda.tipos_com_grao`): o milho com braquiária dá grão. | PRD 5: "Grão + cobertura"; a lista fica no `regras.yaml` para a agrônoma mudar. |
| D16 | 15/11 | Saem do `culturas.yaml` e do `CropParams` o preço, o custo e a produtividade, e do motor a perda de produtividade pelo ISNA (`perda_*`, `fator_perda`). | Nada mais usava depois da margem; o pedido manda remover o que ficar sem uso. |
| D17 | 15/11 | Contrato: `dinheiro` vira `renda` (`da_grao`, `anos_aperto`, `rotulo`, `texto`, `risco`), o motivo `mais_dinheiro` vira `mais_renda` e os rótulos `dinheiro_*` viram `renda_*` (os mesmos 70 e 30). O selo Bom/Médio/Fraco da renda ficou. | A dimensão mudou de nome e o nome fica igual em toda a pilha; o selo mantém o cartão como está até a S5a redesenhar as linhas. |
| D18 | 15/11 | "Ainda não conectado" saiu do design system (`NotConnected`, `NotConnectedCard` e o `status="unavailable"`), não só das telas; o estado interno `not-connected` dos controllers ficou. | Garante que nenhuma tela volte a mostrar o selo; o estado interno ainda separa "endpoint que não existe" de erro. |
| D19 | 15/11 | D2 elemento a elemento: sem histórico do satélite, a tela 4 mostra só "Confirme as últimas safras"; na missão, a fase sem dado fica sem resultado; no relatório, as seções sem dado somem e a célula do clima futuro vira "—"; em "Como a conta é feita", só as fontes ligadas; na comunidade com a API real, os blocos dos vizinhos não aparecem. | "O elemento sem dado não aparece" (D2); a 5.6 do pedido manda perguntar direto quando não há NDVI. A comunidade é refeita na S7. |
| D20 | 15/11 | O bloco "Comece por um pedaço" saiu inteiro já na S1 (a S5b também previa). | É todo em reais (hectares × sobra, semente e pior ano seco). |
| D21 | 15/11 | Limites da área piloto numa fonte só (S2): `GET /api/area-piloto` devolve os `PILOT_*` do `app/constants.py` e o front lê a rota, sem repetir os números (só o mock, que imita a API). Nenhum RF novo: o RF-01 foi reescrito. | Não acopla o build do front aos arquivos do backend (o container do front só monta `projeto/frontend`); mudar a caixa é mudar só as constantes. |
| D22 | 15/11 | Enquanto a área piloto carrega, o "Confirmar local" espera; se ela não carregar (API fora do ar), a tela deixa seguir. | O backend continua respondendo `OUTSIDE_AREA` nas telas seguintes; travar o fluxo por uma rota auxiliar não protege nada a mais. |
| D23 | 15/11 | Photon em pt com `lang=default` (nomes locais); em en, `lang=en`. | O Photon não aceita `pt` (400, conferido em 15/11) e, no Brasil, os nomes locais já são em português. |
| D24 | 15/11 | A preferência da busca é o centro da área piloto (`lat`/`lon`), não o `bbox`. | O `bbox` corta os lugares de fora, e a pessoa precisa achar o lugar dela mesmo fora da área para ver o aviso. |
| D25 | 15/11 | Coordenadas e link colados viram uma opção da lista ("Ir para as coordenadas" / "Ir para o ponto do link"), escolhida com Enter ou toque, e não um salto automático do mapa. | Enquanto a pessoa digita, "-18.95, -4" já é um par válido: pular a cada tecla levaria o mapa para o lugar errado e dispararia o endereço aproximado à toa. |
| D26 | 15/11 | No link do Google Maps, o pino do lugar (`!3d`/`!4d`) vale mais que `q`/`query`/`ll`, que valem mais que o caminho `/maps/search/` e o centro do mapa (`@`). Link curto não é aberto: a tela pede o link completo ou as coordenadas. | O `@` é o centro da tela de quem copiou, não o lugar marcado; o link curto só abre com um redirecionamento que o navegador não pode seguir. |
| D27 | 15/11 | Endereço aproximado: enquanto o *reverse* não chega, ou se falhar, aparece a cidade de referência mais perto (lista que já existia no front). | O "Perto de…" nunca some, mesmo sem rede ou com o Photon fora do ar. |
| D28 | 15/11 | Botão "Ver a área inteira" na legenda do mapa: afasta o mapa até a área caber, sem tirar o alfinete do ponto. | No zoom de marcar a lavoura (12), a caixa de 1,5° fica fora da tela: sem o botão, o limite desenhado quase nunca seria visto. |
| D29 | 15/11 | O aviso "Por enquanto só temos dados da região de Uberlândia e Uberaba." entrou numa chave nova (`where.outsideNotice`); o `where.outsideText`, usado pelas telas 4 a 7 (`FlowStates`), ficou igual. | Mudar o texto antigo mexeria em telas e testes da S1 e da S4. |
| D30 | 15/11 | No modo `mock` (e nos testes), a busca e o endereço aproximado são de exemplo (6 cidades, sem rede), escolhidos em `repositories/index.ts` como os outros dados. | Nenhum teste pode chamar o Photon de verdade, e as telas abertas nos testes de rota usam os repositories padrão. |

## Revisão por seção

### S1 — Renda sem reais e sem "Ainda não conectado" (revisada em 15/11 ~03:25)

- ✅ Nenhum `R$` na API (conferido no JSON de `/recomendacao` nos 3 cenários de colheita) nem no front (busca no código, fora dos testes).
- ✅ "Renda" com fatos: "Dá grão para vender" ou "Não dá grão: é investimento na terra" e "Risco de perder a lavoura: faltou água ou fez calor em N de 20 anos" (na UFU, colheita meio: milho com braquiária, 4 de 20).
- ✅ Nota de renda sem preço nem custo, no grupo `renda` do `regras.yaml` (D14 a D16), explicada em "Como a conta é feita".
- ✅ "Comece por um pedaço" saiu inteiro (D20). Nenhum selo "Ainda não conectado" na tela; só comentários no código citam a regra (D18, D19).
- ⚠️ A melhor opção da UFU mudou com a renda nova: colheita cedo e meio passaram de milho sozinho para **milho com braquiária**; tarde continua milheto.
- ⚠️ Ainda na tela até as próximas seções: o botão "Relatório para banco ou seguro" (sai na S5a) e "Como teria sido em 2024?" (sai na S5b).

### S8 — Guia (revisada em 15/11 ~02:45)

- ✅ `/guia` com os 5 temas e busca por título; `/guia/<artigo>` com a estrutura fixa (Em uma frase, Por que importa, Na sua lavoura, Fontes; nas culturas, Conheça e Passo a passo). Conferido no Chrome sem interface em 1280 e 390 px.
- ✅ 19 artigos em pt e en: os 12 prioritários (6 culturas, deu certo, conta de água, rotação, prazo/ZARC, veranico, alertas da Defesa Civil) e 7 de apoio (palhada, adubo verde, nematoide, geada, El Niño/La Niña, calor de 35 °C, clima 2041–2060). Entre 156 e 214 palavras.
- ✅ "Rascunho: a revisar pela agrônoma" no topo dos de cultura, plantio e manejo.
- ✅ Números conferidos contra o `culturas.yaml` (Kc 1,20 do milho, floração 60 e ciclo 120 dias, limite 28/02) e o `regras.yaml` (ISNA 0,55 / 0,50, fase crítica ±15 dias, 35 °C em 3 dias).
- ✅ Fontes só de páginas abertas e conferidas (gov.br, Embrapa, NASA, NOAA), com um teste que barra link externo fora da lista `verifiedSources.ts`. Os números da Defesa Civil (SMS 40199, WhatsApp (61) 2034-4611, 193 e 199) foram conferidos no gov.br.
- ✅ Ilustrações próprias em SVG das 6 opções (D4); Markdown renderizado sem `innerHTML` e sem biblioteca nova.
- ⚠️ Faltaram 7 artigos: plantio direto, sementes e erosão (sem fonte aberta conferida); "quando a chuva acaba" e "raio-X" (descrevem telas das seções 3 e 4, que ainda não existem); "plantar logo depois da colheita" (sem fonte e depende do custo do atraso da S3); fogo na palha (só guias estaduais, não conferidos). Os links das telas para esses artigos entram quando as seções 3, 4 e 6 forem feitas.
- ⚠️ A S8 entrou antes da S1 (a S1 ainda estava rodando). Não há conflito: arquivos diferentes.

## Números estranhos encontrados

- **Renda e chuva com rótulos diferentes na mesma opção:** milho com braquiária na UFU (16 de 20) sai "Médio" na chuva e "Bom" na renda, porque os cortes são 85/60 na chuva e 70/30 na renda. A segurança pesa duas vezes para quem dá grão (segurança 30% + renda 30%).
- **Plano A da UFU (colheita cedo e meio):** milho com braquiária em 2027 e 2028; e a regra da data diz "siga o plano B; o 1º ano continua com milho com braquiária", porque o 1º ano do Plano B é a mesma cultura. A frase fica estranha; a S5b refaz o Plano A/B.
- **CMIP6 na UFU:** a nota de futuro sai igual à de segurança em todas as opções (os deltas não mudam nenhum ano de "deu certo" para "faltou" nesse ponto). Conferir na S4/S5a.
- **"Deu certo" no pedido × motor:** o pedido diz "nenhum dia de 35 °C nessa fase"; o motor (`regras.yaml`, `calor_min_dias`) conta aperto com **3 dias ou mais** de 35 °C na fase crítica. Os textos seguem o motor; mudar a regra é decisão da agrônoma.
- **Soja recente (RF-24):** 96% dos pixels da caixa piloto têm pico de NDVI ≥ 0,70 em jan–mar de 2026 (pasto e cerrado também ficam verdes na chuva). O aviso do começo pega cidade, água e solo exposto, mas não distingue soja de pasto.
- **Região pelo satélite calibrada (tarefa 0036):** depois de tirar cana, café e pasto, a soja do ano é 45–58% da lavoura, mas "parado" ainda fica entre 0,7% e 6% (plantou 72–96%). Só 2 de 10 anos passam no critério de crível combinado com o usuário (parado entre 5% e 80%), então a região continua escondida. Pode ser real (safrinha comum no Triângulo) ou mato que rebrota com a chuva de março.
- **S1, fazenda da UFU (banco local):** a nota "futuro" (CMIP6) sai igual à "segurança" em todas as
  opções nos 3 cenários de colheita (ex.: milho 90/90, 80/80). Os deltas do CMIP6 não mudam nenhum ano
  de "deu certo" para "faltou" nesse ponto; vale conferir na S4/S5a (linha "Clima 2041–2060").
- **S1, Plano A da colheita cedo na UFU:** com a renda nova, milho com braquiária nos 3 anos (nota 85,0
  contra 84,7 com crotalária no 3º ano). O PRD 7.7 não pune repetição; a S5b mostra a repetição como fato.

## O que não foi possível e por quê

- **S2, link curto do Google Maps** (`maps.app.goo.gl`, `goo.gl/maps`): não dá para abrir sem rede, e o
  navegador não pode seguir o redirecionamento do Google. A tela explica: abrir o link no Google Maps e
  colar o link completo, ou colar as coordenadas.
- **S2, graus, minutos e segundos** colados como texto (`18°57'15.6"S 48°11'57.4"W`) não são lidos (o
  pedido só cita o formato decimal). O link do Google com esse nome funciona, pelo pino `!3d`/`!4d`.
