# Raiz Orbital: plano de evolução do produto

**Status:** aprovado para implementar **agora, por ordem de prioridade** (decisão do time em 14/11). Cada item entra no PRD com `RF-` e `T-` no PR que começar a implementá-lo.
**Criado em:** 14/11/2026, durante o NASA Space Apps Uberlândia.
**Relação com os outros documentos:** este arquivo fica **fora do PRD** de propósito. O PRD continua sendo a fonte de verdade do MVP. Quando um item daqui começar a ser implementado, ele vira requisito no PRD (com ID `RF-` e tarefa `T-`) no mesmo PR.

## 1. Ajustes no que já existe (fazer primeiro)

Dois ajustes na tela 7 (Plano de 3 anos) vêm antes de qualquer item novo. **Registrados no PRD v3.1** como RF-20 e RF-21 (tarefas T-17 e T-18), junto com a nova tela de cálculo em forma de missão (RF-19, T-16). Hoje a tela pede uma escolha que o produtor não sabe fazer ("Ano normal" ou "Ano seco") e tem botões que não mudam nada (50 ha, 100 ha, Tudo).

### A1. "Quantos hectares quer testar?" (2 a 3 h)

**Problema.** Os botões 50 ha, 100 ha e Tudo só trocam o texto; nenhum número muda. "Tudo" não tem sentido, porque o app não sabe o tamanho da fazenda (são só duas perguntas). O produtor toca e nada acontece.

**Ajuste.** Trocar os botões por um campo **"Quantos hectares quer testar?"**, começando em 50, e mostrar o total em reais. Por hectare o número é abstrato; "R$ 35 mil nos 50 ha" o produtor entende na hora. O cartão mostra, para a opção do primeiro ano do plano:
- **Quanto deve sobrar:** margem por hectare × hectares ("Deve sobrar perto de R$ 35 mil nos 50 ha").
- **Quanto custa a semente:** custo da semente por hectare × hectares ("A semente custa perto de R$ 48 mil" para milho com braquiária, que tem semente cara; na crotalária o valor é bem menor).
- **O pior caso num ano seco:** a margem do pior ano entre os 4 mais secos da série (a mesma base do plano B, seção 7.7 do PRD) × hectares ("No pior ano seco, sobraria perto de R$ 8 mil", ou "faltaria perto de R$ 4 mil" se for negativo).
- Embaixo: "O resto da fazenda fica como hoje, para você comparar."

**Regras.** Campo numérico com teclado de números no celular, mínimo 1 ha; valores arredondados ("perto de R$ 35 mil"); a conta é feita no frontend com os números por hectare que a API já manda, sem chamada nova. Os valores por hectare continuam editáveis pela RF-10.

**O que muda nos dados.** `culturas.yaml` ganha `custo_semente_ha` por cultura (hoje só existe o custo total, `custo_padrao_ha`); valor marcado como hipótese até o agrônomo conferir. A API passa a mandar, em cada opção, `dinheiro.pior_ano_seco_ha` e `custo_semente_ha`.

**Testes.** Service do frontend: 50 ha × R$ 700 = "perto de R$ 35 mil"; pior caso negativo vira "faltaria"; campo vazio ou zero volta para 50.

**Mais para frente.** Com o acompanhamento da safra (P6), o satélite pode comparar o pedaço testado com o resto da fazenda. Isso dá um motivo concreto para o teste existir.

### A2. Sinal para o outono e Plano A / Plano B (4 a 6 h)

**Problema.** Em fevereiro, quando o produtor decide, ninguém sabe se o outono vai ser seco. A tela pede que ele escolha "Ano normal" ou "Ano seco" sem dar pista nenhuma. O texto atual ("parecido com El Niño forte") também passa uma ideia errada: no Triângulo, El Niño não garante outono seco.

**Ajuste.**
- Um cartão **"Sinal para o outono de 2027"** com uma de três respostas: **sinal de ano normal**, **sinal de ano seco** ou **sem sinal claro**, sempre com o motivo em uma frase (por exemplo: "A previsão da NASA para março a maio indica chuva abaixo do normal, com 60% de chance").
- Os botões passam a se chamar **"Plano A"** e **"Plano B, se secar"**, e o app já deixa marcado o plano que combina com o sinal. Com "sem sinal claro", fica marcado o Plano A, com a frase "Deixe o plano B na manga".
- Uma **regra de decisão com data**: "No dia de plantar (até 28/fev), se a terra estiver seca, use o plano B (sorgo no lugar do milho)." Isso o produtor não consegue ver sozinho, e é aí que o satélite ajuda.
- O texto do plano B passa a ser "Repetimos os anos mais secos dos últimos 20", sem citar El Niño.

**De onde vem o sinal.**

| Dado | O que mede | Situação no projeto |
| --- | --- | --- |
| **GEOS-S2S-2 (NASA GMAO)** | Previsão de chuva para os próximos meses, com a chance de ficar acima ou abaixo do normal, numa grade de 0,5° | **Novo.** Baixar a previsão mais recente no pipeline (conferir o acesso aos arquivos na página de downloads do GMAO) |
| SMAP L4 (`sm_rootzone_pctl`) | Água na raiz agora, comparada com o histórico | Já existe |
| GPM IMERG | Chuva dos últimos 30 dias, comparada com a média | Já existe |

**Regra (hipótese, calibrar antes de publicar).**
- **Sinal de ano seco:** GEOS-S2S com chance de chuva abaixo do normal em março a maio ≥ 50% **ou** terra seca agora (SMAP abaixo do percentil 20 e chuva dos últimos 30 dias abaixo de 60% da média).
- **Sinal de ano normal:** chance de chuva abaixo do normal < 33% **e** terra sem falta de água.
- **Sem sinal claro:** qualquer outro caso.
- **"Terra seca no dia de plantar"** usa o mesmo critério do SMAP. Antes da semeadura o app só mostra a regra; com o acompanhamento (P6), o próprio app confere no dia e avisa pelo Telegram.

**Validar com o passado.** O GMAO publica previsões retrospectivas. Rodar a regra nos anos da série e contar em quantos o sinal teria acertado o ano seco. Esse número vai para a tela "Como a conta é feita" (critério Validade). Se o acerto for baixo, a tela mostra só a regra do dia de plantar e o sinal fica de fora.

**Cuidados.** A previsão sazonal erra bastante no outono. A tela mostra **chance**, nunca certeza, e sempre o motivo. O GEOS-S2S entra na lista de fontes da NASA do PRD e da página do projeto (ajuda no prêmio Best Use of Data).

**Onde entra no código.** Script `previsao_sazonal` no pipeline (grava a chance por célula e mês), service `sinal_outono` com a regra acima e testes por caso (seco pela previsão, seco pela terra, normal, sem sinal), campo `sinal: {nivel, motivo, fonte, data}` em `/api/recomendacao` e o cartão novo na tela 7.

## 2. Por que este plano existe

O MVP responde uma pergunta que o produtor faz **uma vez por ano**: o que plantar depois da soja, entre fevereiro e março. Isso basta para o hackathon, mas não sustenta um produto. Fora dessa janela ninguém tem motivo para abrir o app, e quem paga (revenda, cooperativa, banco, seguradora) quer ver o produtor usando e quer algo que sirva para ele também.

Os itens abaixo atacam esses dois buracos: dar motivo para o produtor voltar ao longo do ano e entregar algo útil para quem paga. Quase todos usam os dados da NASA que o pipeline já tem.

## 3. Ordem de implementação

**Regra de ouro:** nada daqui começa antes do MVP do PRD estar no ar (T-13, deploy) e do vídeo de 30 s gravado. Uma entrega com tudo pela metade perde para uma entrega simples funcionando. Depois do deploy, os itens entram **um de cada vez, nesta ordem**, cada um em sua branch e seu PR. Se o prazo apertar, para-se onde estiver; o que já foi integrado continua valendo.

Cada item tem um **corte MVP** (o que entra agora) e o que fica para a versão completa.

| Prioridade | Item | Corte MVP (agora) | Fica para depois | Horas (MVP) | Por que nesta posição |
| --- | --- | --- | --- | --- | --- |
| A1 | Hectares para testar (1) | Campo de hectares e totais em reais na tela 7 | Comparação do pedaço testado pelo satélite | 2 a 3 | Conserta uma tela que hoje não responde ao toque |
| A2 | Sinal para o outono, Plano A / Plano B (1) | Cartão do sinal, botões renomeados, regra do dia de plantar | Calibração com mais anos e mais modelos | 4 a 6 | Responde a pergunta que a tela deixa em aberto e traz mais um dado da NASA |
| P1 | Tocar num ano (4.1) | Quadradinhos tocáveis com a frase do ano e a marca de El Niño/La Niña | — | 3 a 5 | Barato, usa o que o motor já calcula e é o melhor momento do vídeo |
| P2 | Relatório para banco e seguro (4.2) | Página de impressão gerada do mesmo JSON da resposta, "Salvar em PDF" pelo navegador | PDF no servidor, avisos do ano, conferência por satélite, validação com banco | 3 a 4 | Mostra uma segunda fonte de receita no pitch com pouco código |
| P3 | Na sua região, pelo satélite (4.3) | Bloco novo na tela "Na sua região": % da área que ficou parada depois da soja num raio de 30 km, ano a ano, pelo MODIS. Complementa a comunidade | Mapa mais fino (HLS 30 m), outras regiões | 4 a 6 | Junta dado real da NASA à experiência dos vizinhos. Pesa em Best Use of Data e Local Impact |
| P4 | Replay de uma safra passada (4.4) | Linha do tempo com os avisos de veranico e calor que o produtor teria recebido numa safrinha passada (ex.: 2024) | — | 4 a 6 | Mostra o acompanhamento funcionando antes de ele existir, com as mesmas regras |
| P5 | Bot do Telegram (4.5) | Bot oficial: o produtor manda a localização, escolhe a colheita e recebe a resposta em texto, áudio e link, em PT ou EN | Perguntas por voz | 4 a 6 | Canal de conversa grátis, oficial e que os jurados conseguem testar. Vira o canal de aviso do P6 |
| P6 | Acompanhamento diário da safra (4.4) | Talhão salvo pelo bot, busca diária de chuva e temperatura, regras de veranico e calor, aviso pelo Telegram e na tela "Minha safra" | Fogo (FIRMS), semáforo da soja, conferência de julho pelo NDVI | 10 a 14 | Dá motivo para voltar ao app o ano todo. Reaproveita o service de regras do P4 e o canal do P5 |

**Desejável, em discussão:** WhatsApp (4.5). O time ainda vai decidir entre a API oficial da Meta e uma integração não oficial; as duas estão descritas na seção 4.5.

**Conta:** A1 a P6 somam **34 a 50 horas de dev**. A expectativa realista é fechar A1, A2 e P1 a P3 no hackathon (16 a 24 h), fazer P4 e P5 se sobrar tempo e seguir com o P6 logo depois, sem mudar a ordem.

**Para os jurados:** tudo que for mostrado precisa estar em inglês, e o vídeo continua com 30 s. A2, P1 e P3 entram no vídeo; P2, P4 e P5 entram em uma frase cada na página do projeto. O site continua sendo a demo principal; o link do bot é um extra.

## 4. Os itens em detalhe

### 4.1 Tocar num ano e ver o que aconteceu (P1)

**O que é.** Na tela da resposta, os 20 quadradinhos (2006 a 2025) já mostram em quais anos a opção deu certo. A ideia é deixar cada quadradinho tocável. Ao tocar em 2024, o produtor lê uma frase como: "Em 2024, plantando no meio de fevereiro, o milho teria florescido por volta de 18 de abril e ficou 14 dias sem chuva nessa fase." Os anos de El Niño e La Niña ganham uma marca discreta.

**Por que importa.** O produtor se lembra dos anos ruins ("2021 foi aquele ano"). Quando o app acerta a lembrança dele, a confiança no resto da resposta sobe. É também o melhor momento do vídeo de 30 segundos e reforça os critérios Validade e Apresentação.

**Como funciona.**
- O motor já roda o balanço hídrico ano a ano para montar `faixa`. Basta guardar, por opção e por ano, quatro números que ele já calcula: data estimada da floração, maior sequência de dias secos (< 5 mm) na janela crítica, ISNA da janela e dias com máxima ≥ 35 °C.
- A frase sai de um modelo em `regras.yaml` (pt-BR e inglês), sem IA generativa, como as outras explicações (RF-06).
- A marca de El Niño e La Niña vem do índice ONI da NOAA (tabela pública, uma linha por trimestre). É dado da NOAA, não da NASA, e a tela diz isso. A marca só informa; ela não entra na conta.

**Onde entra no código.**
- Backend: o service do motor devolve os detalhes por ano; o schema de `/api/recomendacao` ganha, em cada opção, `anos_detalhe: [{ano, bom, floracao, dias_secos, isna, dias_calor, enso, texto}]`. Vai junto na mesma resposta para não exigir outra chamada com sinal fraco (são 6 opções × 20 anos, poucos KB a mais com gzip). A `faixa` passa a sair de `anos_detalhe[].bom`.
- Frontend: os quadradinhos viram botões (mínimo 44 px de área de toque) e abrem um painel com a frase e o botão "Ouvir".
- Testes primeiro: um ano com veranico conhecido na série de exemplo gera a frase esperada; ano sem dado mostra "Sem dado deste ano".

**Risco.** A data de floração é estimada pelo ciclo médio da cultura (hipótese de `culturas.yaml`). A frase diz "por volta de" e a tela "Como a conta é feita" explica.

### 4.2 Relatório para banco e seguro (P2)

**O que é.** Um relatório por talhão com: o risco climático de 20 anos de cada opção, o histórico de uso do talhão pelo NDVI (10 anos de rotação ou pousio), se a data de plantio planejada cai dentro da janela e, depois do P6, os avisos do ano e a conferência por satélite.

**Por que importa.** O crédito rural e o seguro olham para o ZARC e para o histórico da área. Um histórico pronto e com fonte economiza tempo do gerente e do corretor. É a fonte de receita já prevista no business plan (Doc 5), com o banco ou a seguradora como pagante.

**MVP (o que entra agora).**
- Uma rota do frontend, `/relatorio?lat&lon&colheita`, que lê o **mesmo JSON** de `/api/recomendacao`. Sem endpoint novo e sem regra nova.
- Layout de impressão (CSS `@media print`, A4, preto e branco legível) e botão "Salvar em PDF", que chama a impressão do navegador. Na impressão, cabeçalho, botões e "Ouvir" somem.
- Conteúdo: identificação do ponto (sem nome de produtor), data, versão dos dados, risco de 20 anos por opção, histórico de 10 anos pelo NDVI, se a semeadura planejada cai na janela de `culturas.yaml`, os preços usados na conta de margem, o sinal para o outono (A2), lista das fontes da NASA e o rodapé "Ajuda a decidir. Não é laudo técnico, não substitui o ZARC oficial nem o agrônomo responsável."
- Testes: a view renderiza todas as seções a partir de um JSON de exemplo; sem histórico de NDVI, mostra "Sem dado do satélite".

**Versão completa (depois).**
- PDF gerado no servidor a partir do mesmo JSON, com data, versão dos dados e lista de fontes.
- O produtor gera e decide com quem compartilhar. Nada vai para o banco sem ação dele.
- Entram os avisos do ano e a conferência por satélite do P6.

**Decisões abertas.** Revisão jurídica do texto (responsabilidade se o banco usar o relatório para negar crédito). Validar com um gerente de crédito rural e um corretor de seguro agrícola o que eles realmente leem antes da versão completa.

### 4.3 Na sua região, pelo satélite (P3)

**O que é.** A tela "Na sua região" ganha um bloco feito com dado do satélite, **somado** à comunidade que já está no PRD ("Choveu aqui" e "O que os vizinhos plantaram", RF-13 a RF-15). O satélite mostra o que a região inteira fez depois da soja: "Na sua região (30 km), 62% da área ficou parada depois da soja em 2025. Em 2015 eram 70%." Os vizinhos contam como foi para eles. Os dois juntos respondem perguntas diferentes: o satélite diz **quanto** a região deixa a terra parada; os vizinhos dizem **se valeu a pena** plantar.

**Por que importa.** Traz dado real da NASA para uma tela que hoje é só simulada (critério Validade), mostra o problema do pousio em escala regional (Impacto e prêmio Local Impact) e reaproveita a mesma regra de NDVI do histórico do talhão (seção 7.8 do PRD). Também resolve o começo da comunidade: enquanto poucos vizinhos participam, o bloco do satélite já mostra algo útil.

**Como funciona.**
- Grade de pontos a cada 1 km num raio de 30 km da fazenda de exemplo (cerca de 2.800 pontos), filtrada para áreas agrícolas pelo mapa de uso do solo (MapBiomas, ou MODIS Land Cover se faltar tempo).
- No Earth Engine, para cada ponto e cada entressafra de 2015 a 2025, aplica-se a regra do PRD: NDVI acima de 0,6 na entressafra = segunda safra; abaixo de 0,45 = pousio; o meio fica como "não dá para saber".
- O resultado sai do pipeline já agregado (percentual por ano) e vai para uma tabela `regiao_entressafra(ano, raio_km, pct_pousio, pct_segunda_safra, pct_incerto, n_pontos)`. O site só lê, por `GET /api/regiao?lat&lon`.
- Na tela, o bloco do satélite vem primeiro (número grande, barras por ano e a comparação "Sua área: parada em 5 de 10 anos"); embaixo continuam os blocos da comunidade. No hackathon a comunidade segue simulada e marcada como "valores ilustrativos"; o bloco do satélite é real.
- No hackathon, calcula-se só para a região da fazenda de exemplo. Outras regiões entram quando o pipeline rodar por célula.

**Privacidade.** Só o percentual agregado vai para o banco e para a tela; nenhum ponto individual aparece. Isso cumpre o RNF-10.

**Risco.** O MODIS tem pixel de 250 m e mistura talhões pequenos. A tela diz "estimativa pelo satélite" e a tela "Como a conta é feita" explica a regra e a faixa incerta. A versão completa pode usar o HLS (30 m).

**Onde entra no código.** Script novo no pipeline (`regiao_ndvi`), repository e service `regiao` com teste de agregação (pontos de exemplo → percentuais esperados), endpoint `/api/regiao` e um componente novo na tela 8, acima dos blocos da comunidade.

### 4.4 Acompanhamento da safra: replay (P4) e diário (P6)

**O que é.** O produtor salva o talhão e o plano escolhido. A partir daí, o app avisa quando algo ameaça esse plano e, na entressafra seguinte, confere pelo satélite se o plano foi seguido. Antes de construir isso, o replay mostra como funcionaria numa safra que já passou.

**P4, replay de uma safra passada.** Escolhemos uma safrinha passada com veranico conhecido na série (por exemplo, 2024), rodamos as regras abaixo dia a dia sobre os dados históricos (IMERG e POWER) e exibimos uma linha do tempo: "15/abr: aviso de veranico (10 dias sem chuva perto da floração)", "24/abr: 2 dias acima de 35 °C". Ao lado, um ano bom (por exemplo, 2023) sem avisos. Sem busca diária, sem talhão salvo, sem canal. Rota `/safra-passada?lat&lon&colheita&ano=2024` e endpoint `GET /api/safra-passada` com a lista de eventos. O service das regras é o mesmo que o P6 vai usar, então nada é jogado fora. Testes primeiro: uma série montada à mão com 10 dias secos na floração gera o aviso no dia certo.

**P6, acompanhamento diário.** Calendário do ano (por que há motivo para voltar todo mês):

| Período | O que o app faz | No MVP do P6? |
| --- | --- | --- |
| Set a nov | Semáforo de plantio da soja: início da estação chuvosa (critério de 20 mm em 1 a 2 dias depois de 10/set, do Doc 5) | Depois |
| Dez a jan | Aviso de veranico e calor na floração da soja | Sim |
| Fev a mar | A decisão de entressafra (o MVP de hoje) e a conferência "terra seca no dia de plantar" (A2) | Sim |
| Abr a mai | Aviso de veranico e calor na floração do milho e do sorgo | Sim |
| Jun a set | Aviso de foco de fogo perto do talhão (FIRMS) | Depois |
| Jul a ago | "O satélite conferiu": o NDVI mostra se a área foi plantada ou ficou parada | Depois |

**Regras.** As do Doc 5, que já estão no PRD: 10 ou mais dias secos na fase crítica, ISNA abaixo de 0,55, 2 dias seguidos com máxima ≥ 35 °C, 50 mm ou mais em 24 h, foco de fogo em até 10 km. Limite de **no máximo 2 avisos por semana por talhão**, para não virar ruído.

**Dados.** GPM IMERG Late (chuva do dia anterior, com cerca de 14 h de atraso), NASA POWER (temperatura), SMAP L4 (umidade na raiz) e, depois, FIRMS (fogo) e MODIS/HLS (NDVI da conferência).

**Canal de aviso no MVP.** O bot do Telegram (P5): no fim da resposta, o bot pergunta "Quer que eu avise se faltar chuva na sua lavoura?". Quem aceita fica com o talhão e o plano salvos, ligados ao chat. No site, a tela "Minha safra" mostra a mesma linha do tempo (mesmo componente do replay) para quem abrir pelo link que o bot manda. Quando o WhatsApp for decidido, ele vira mais um canal, sem mudar as regras.

**Talhão salvo sem login.** O talhão fica ligado ao chat do Telegram, sem senha e sem nome. Guardar o ponto exato exige consentimento explícito (LGPD), o produtor pode sair a qualquer momento com `/parar`, e o RNF-10 continua valendo.

**Medir o impacto com o próprio satélite (versão completa).** A conferência de julho e agosto responde à pergunta dos jurados e dos clientes ("como vocês sabem que funciona?"). Indicador principal: **% dos talhões salvos que deixaram de ficar parados** na entressafra seguinte, comparado com o histórico de 10 anos do mesmo talhão.

**Onde entra no código.**
- Banco: tabelas `talhao_salvo` (ponto, plano, canal, chat, consentimento), `aviso` (tipo, data, enviado, lido) e, depois, `conferencia_ndvi`.
- Pipeline: um job diário (cron) que baixa o IMERG Late e o POWER da região, roda as regras por talhão salvo e grava os avisos.
- Service de avisos (o mesmo do replay) com repository falso nos testes; um teste por regra, com séries curtas montadas à mão.
- Envio pela interface `notificador` (seção 4.5), com a versão do Telegram agora.

### 4.5 Canais de conversa: Telegram (P5) e WhatsApp (desejável)

**Por que um canal de conversa.** O Doc 3 mostra que o público decide pelo celular, em conversa, e muitas vezes não vai digitar um endereço de site. Um canal de conversa leva a resposta e, depois, os avisos do P6 até ele.

**O mesmo código para qualquer canal.** O backend chama o **mesmo service** de recomendação do site (nada de regra duplicada). Um `conversa_service` guarda o estado da conversa (esperando localização, esperando colheita, respondido), e o envio fica atrás da interface `notificador`. Cada canal é só um adapter (Telegram agora, WhatsApp depois), com versão falsa nos testes. O áudio sai de síntese de voz no servidor, com o mesmo texto que o botão "Ouvir" lê.

#### Telegram (P5)

**Como funciona.**
1. O produtor abre o bot (link `t.me/...` no site e na página do projeto) e toca em **Começar**. O bot pergunta o idioma (Português / English).
2. O bot pede a localização da lavoura com um botão "Mandar minha localização" (o Telegram tem esse botão nativo).
3. O bot pergunta quando ele colhe a soja, com três botões na própria conversa (começo, meio, fim de fevereiro ou março), já com a sugestão do satélite.
4. O bot responde com a melhor opção e os sinais de chuva, dinheiro e terra em texto curto, um **áudio** com a mesma resposta e o **link do site** com `lat`, `lon` e `colheita` para ver os detalhes.
5. No fim, o convite para os avisos do P6.

**Técnica.** Bot API oficial do Telegram, grátis, sem aprovação de modelos e sem custo por mensagem. Bot criado pelo @BotFather; o backend recebe as mensagens por webhook (`setWebhook`, validando o cabeçalho de token secreto) num controller fino `telegram_controller`; o áudio vai como mensagem de voz (OGG/Opus). Token só em variável de ambiente (`TELEGRAM_BOT_TOKEN`, nome no `.env.example`). Fora da área atendida, o bot oferece a fazenda de exemplo, como o site.

**Privacidade.** A localização serve para calcular a resposta. Só fica guardada, ligada ao chat, se o produtor aceitar os avisos. O bot nunca mostra a posição de outro produtor.

**Para os jurados.** O bot fala inglês, e qualquer pessoa no mundo consegue testar, ao contrário do número de teste do WhatsApp (5 celulares). O site continua sendo a demo principal, porque nem todo jurado tem Telegram e o aplicativo é bloqueado em alguns países.

**Limite.** O produtor mais velho do Triângulo usa pouco o Telegram, e pedir para instalar um aplicativo novo é barreira para quem já desconfia de tecnologia. Como canal de alcance, o Telegram não substitui o WhatsApp.

**Testes.** `conversa_service` com adapter falso: localização dentro da área → pergunta da colheita; fora da área → fazenda de exemplo; escolha da colheita → resposta com texto, áudio e link; `/parar` apaga o talhão salvo.

#### WhatsApp (desejável, em discussão)

É o canal que mais alcança o público, mas não usa dado da NASA nem fala de rotação, então quase não pontua no desafio. Com o Telegram pronto, entra como mais um adapter. Os caminhos possíveis:

| | API oficial da Meta (Cloud API) | Integração não oficial (gateway por QR code) |
| --- | --- | --- |
| Como liga | App na Meta, número dedicado e webhook | Escaneia um QR code, como no WhatsApp Web, por um serviço pago ou uma biblioteca aberta |
| Para começar | Número de teste da Meta, sem verificação, para até 5 celulares cadastrados. Para o público: verificação da empresa e modelos aprovados (dias) | Minutos; sem verificação e sem aprovação de modelos |
| Custo | Por mensagem: utilidade e serviço R$ 0,035 (as primeiras 1.000 de serviço no mês são grátis), marketing R$ 0,32 | Mensalidade fixa do serviço, sem cobrança por mensagem |
| Regras do WhatsApp | Dentro dos termos | **Fora dos termos de uso do WhatsApp** |
| Risco | Baixo | O número pode ser bloqueado a qualquer momento, sobretudo ao mandar avisos para muita gente; quebra quando o WhatsApp muda; a sessão fica num servidor |
| Serve para | Demo e produção | Só demo, com um chip que pode ser perdido |

**Recomendação (para decidir com o time).** Para produção, só a API oficial: perder o número no meio da safra derruba os avisos do P6 justamente quando eles importam, e um parceiro que paga (revenda, cooperativa, banco) não aceita esse risco. Integração não oficial só para demo, nunca com o número de um cliente ou da empresa.

**Decisões abertas.** Caminho (oficial ou não); quando começar o cadastro na Meta (a verificação leva dias).

## 5. O que precisa de gente de fora

| Quem | Para quê | Itens |
| --- | --- | --- |
| Agrônomo(a) | Custo da semente por cultura; ciclo das culturas para estimar a floração; conferir as frases dos avisos e a regra de terra seca | A1, A2, P1, P4, P6 |
| Advogado e um gerente de crédito rural | Texto e conteúdo do relatório | P2 |
| Meta (WhatsApp Business) | Verificação da empresa e aprovação dos modelos de aviso, se o caminho for o oficial | 4.5 |

## 6. Como saber se valeu a pena

| Item | Indicador | Meta inicial (hipótese) |
| --- | --- | --- |
| A1 | % das visitas à tela 7 que mudam o número de hectares | Medir; sem meta |
| A2 | Em quantos anos da série o sinal teria acertado o ano seco (previsões retrospectivas) | Publicar o número, seja ele qual for |
| P1 | % das sessões em que alguém toca num ano | 30% |
| P2 | Relatórios gerados e compartilhados com banco ou seguro | 1 parceiro pagante em 2027 |
| P3 | % das visitas à tela "Na sua região" que chegam ao bloco da comunidade | Medir; sem meta |
| P4 | % das sessões que abrem o replay | Medir; sem meta |
| P5 | Conversas no bot que chegam à resposta | 70% |
| P6 | % dos talhões salvos que saem do pousio na entressafra seguinte (NDVI) | 20% a mais que o histórico do próprio talhão |

## 7. Fora deste plano (anotado para não se perder)

- Retirados em 14/11 por decisão do time: preços atualizados automaticamente, funcionar sem sinal, "Tem gado?" e aviso de cigarrinha. O detalhe de cada um está no histórico do git deste arquivo, se voltarem à pauta.
- Painel da revenda (carteira de clientes e risco por região): é quem paga e hoje o produto não tem nada para ela. Merece um plano próprio.
- "Waze do campo" (queimada e estrada ruim relatadas pelo produtor): segue no módulo 2 do PRD, depois dos avisos.
- Perguntas por voz no Telegram ou no WhatsApp (o produtor fala, o app entende): depois de os canais funcionarem com texto e botões.
- Novas opções de entressafra (feijão, girassol, nabo forrageiro, mixes de cobertura): só com parâmetros validados pelo agrônomo.
- Levar o app para outras regiões (resto do Cerrado, Sul, outros países): os dados da NASA são globais; muda o arquivo de parâmetros por região.

## 8. Fontes

- Previsão sazonal da NASA: [GMAO GEOS-S2S-2, visão geral do sistema](https://gmao.gsfc.nasa.gov/cgi-bin/products/climateforecasts/geos5/S2S_2/index.cgi), [GMAO, previsão com probabilidade (exemplo de 2020)](https://gmao.gsfc.nasa.gov/science-snapshots/geos-s2s-predicted-2020-summertime-precipitation-anomalies-three-months-in-advance).
- El Niño e chuva no Triângulo (por que não citar El Niño como sinônimo de ano seco): [The AgriBiz, impactos do El Niño no agro](https://www.theagribiz.com/agronegocio/commodities-agricolas/o-el-nino-vai-chegar-mais-cedo-quais-sao-os-impactos-para-o-agro/), [Itatiaia, El Niño em MG](https://www.itatiaia.com.br/agro/el-nino-em-mg-meteorologista-alerta-para-ondas-de-calor-e-seca-no-agro/).
- Preços da API do WhatsApp no Brasil (tarifas desde 1º/10/2026): [ChatMaxima](https://chatmaxima.com/pt-br/whatsapp-api-pricing/brazil/), [Leadsales](https://leadsales.io/pt/ferramentas/calculadora-api-whatsapp/), [AiSensy, cobrança das mensagens de serviço](https://m.aisensy.com/blog/pt/atualizacao-preco-whatsapp-api-outubro-2026/). Conferir na página oficial de preços da Meta.
- Webhook e localização na Cloud API: [Chatsac, webhook na API oficial](https://chatsac.com/blog/webhook-whatsapp/), [360dialog, mensagem de pedido de localização](https://docs.360dialog.com/partner/messaging/sending-and-receiving-messages/text-messages/interactive-messages/location-request-messages), [SleekFlow, tipos e tamanhos de mídia](https://help.sleekflow.io/pt_BR/supported-message-types-on-whatsapp-business-api-cloud-a).
- Integração não oficial por sessão web: [Whapi.Cloud, como funciona a integração por QR code](https://whapi.cloud/blog/pt/how-whatsapp-api-integration-works-event-reaction-model).
- Documentos do time: PRD (seções 4, 7 e 8), plano técnico do backend (seções 3.2 e 8) e Doc 5 (como identificar os eventos), todos nesta pasta.
