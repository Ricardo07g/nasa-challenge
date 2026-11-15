# Raiz Orbital: remodelagem do produto

Você vai trabalhar no repositório do Raiz Orbital (NASA Space Apps 2026, desafio Field Shift): backend em `projeto/backend` (FastAPI, PostGIS), frontend em `projeto/frontend` (React, PT e EN), parâmetros em `culturas.yaml` e `regras.yaml`, documentação em `arquivos contexto/` e `projeto/backend/docs/`.

O desafio pede uma ferramenta de apoio à decisão que use observações da Terra da NASA, informação local de solo, características das culturas e prioridades do produtor, para ele explorar estratégias de rotação que fortaleçam a saúde do solo, conservem água e adaptem a fazenda ao clima que está mudando. O produto responde "o que plantar depois da soja?" para o produtor do Triângulo Mineiro. A rotação é o centro do produto.

Vamos remodelar as telas usando só dados que já estão no banco ou em `data/baixados/`. Antes de mexer, leia o PRD, as regras do motor, as tabelas do banco (`climate_season`, `grid_cell`, `soil_point`, `cmip6_delta`, `smap_point`, `ndvi_point`, `data_run`) e os arquivos `oni.json` e `smap_recente.json`.

Trabalhe na ordem das seções abaixo, uma entrega por seção.

## Regras gerais

- Nenhum dado inventado. Todo número na tela vem do banco, de arquivo baixado ou do motor, com a fonte citada. Se um dado não existir para o ponto, o elemento não aparece.
- Esconda todos os selos "Ainda não conectado". Mostre só o que está ligado.
- Nenhum valor em reais em lugar nenhum do produto (seção 1).
- Todo texto novo em PT e EN, em linguagem simples para o produtor, e compatível com o botão "Ouvir".
- Tudo responsivo, celular primeiro. Contraste mínimo de 4,5:1. Nenhuma informação depende só de cor.
- Não escreva recomendação agronômica nova (dose, variedade, taxa de semeadura, defensivo). Use o que está em `culturas.yaml`, `regras.yaml` e no PRD. Onde faltar, texto genérico e a marca "a revisar pela agrônoma".
- Limites novos (avisos, fogo, geada, Plano B, sede da cultura) ficam em `regras.yaml`, cada um com a fonte ou marcado como hipótese do time.
- Onde a chuva vem do GPM IMERG e o calor do NASA POWER, cite a fonte certa em cada frase.
- Atualize os testes existentes e crie testes para as regras novas do backend.
- Ao final, liste o que foi feito, o que não foi possível e por quê, e qualquer número que pareça estranho.

## 1. Valores em reais

- Remova todo valor em R$ do frontend e das respostas da API: cartão "Dinheiro", cartões de opções, plano, textos do "Por quê?" e qualquer outra tela.
- A dimensão passa a se chamar "Renda" e mostra só fatos:
  - "Dá grão para vender" ou "Não dá grão: é investimento na terra".
  - "Risco de perder a lavoura: faltou água ou fez calor em N de 20 anos."
- Refaça a nota de renda do motor sem preço nem custo (por exemplo: dá grão ou não, combinado com a segurança climática). Documente a regra em `regras.yaml` e na tela "Como a conta é feita".

## 2. Tela "Onde fica a lavoura" (`/onde`)

- Campo de busca "Buscar cidade, estrada ou endereço" com autocompletar, usando Photon ou Nominatim (OpenStreetMap, sem chave). Respeite os limites de uso (espera entre teclas, uma busca por vez).
- O mesmo campo aceita coordenadas coladas (ex.: `-18.9543, -48.1993`) e link do Google Maps colado (extraia latitude e longitude do link).
- Mantenha "Usar onde estou agora" e o arrastar do mapa.
- Troque o botão "É aqui →" por um botão com ícone de pin e o texto "Confirmar local". Mostre o endereço aproximado do ponto perto do pin.
- Desenhe no mapa o limite da área piloto (lat −19,90 a −18,40; lon −49,00 a −47,50). Ponto fora da área bloqueia o avanço, com o aviso: "Por enquanto só temos dados da região de Uberlândia e Uberaba."

## 3. Tela "Quando você colhe a soja" (`/quando`)

- Novo layout: no topo, um campo de data exata, já preenchido com a data sugerida pelo satélite (NDVI) quando houver. Abaixo, o link "Não sei o dia exato", que abre as três faixas (começo, meio, fim de fevereiro ou março). Remova a opção "Colocar a data exata" da lista.
- Corrija a inconsistência atual: a faixa azul diz que o satélite sugere "fim de fevereiro ou março", mas a opção marcada é "Meio de fevereiro". Sugestão e seleção precisam ser a mesma.
- Troque o gráfico "Chuva de cada mês" por "Chuva que sobra depois da colheita": da data escolhida até junho, a chuva acumulada mediana e a de um ano seco (percentil 20), com o IMERG da célula. Frase dinâmica: "Colhendo em [data], sobram em média X mm; num ano seco, Y mm."
- Mostre também, por mês, a chuva (IMERG) contra a evapotranspiração (ETo do POWER), destacando o mês em que a chuva fica menor que a demanda.
- Custo do atraso, com o resultado do motor para a melhor cultura em cada faixa: "Colhendo cedo, deu certo em A de 20 anos; no meio, B de 20; tarde, C de 20."
- Fim das chuvas na célula: primeiro dia, a partir de 1º de março, que inicia 20 dias seguidos com menos de 10 mm (IMERG). Texto: "Em metade dos anos, a chuva acabou até [data]; o mais cedo foi [data] e o mais tarde [data]."

## 4. Tela "O que o satélite viu" (`/satelite`)

Esta tela passa a ser o raio-X do ponto marcado: um panorama dos dados que os satélites da NASA têm daquela terra.

### Painel "Raio-X da sua terra" (destaque da tela)

- Visual de instrumento de satélite: fundo escuro, números grandes em fonte tabular, grade de blocos, e em cada bloco um selo pequeno com fonte e resolução (ex.: "SMAP · NASA · 9 km"). Use as cores e fontes do app; o painel é o único elemento escuro da tela.
- Cabeçalho: nome do lugar, coordenadas, miniatura do mapa com o pin, data da leitura mais recente e a altitude, se existir no `grid_cell` (não busque fora).
- Animação leve na chegada (blocos em sequência, números contando até o valor), respeitando "reduzir movimento".
- Cada bloco tem número, unidade e uma frase curta. Blocos, calculados para o ponto ou para a célula dele:
  1. Solo: textura, % de argila e % de areia (SoilGrids), em barra dividida. Mantém o link "Não é? Trocar".
  2. Água que a terra guarda: CAD em mm e "aguenta cerca de N dias sem chuva na floração" (CAD dividida pelo consumo diário da cultura sugerida na floração, ETo × Kc).
  3. Umidade da terra agora: percentil do SMAP (`smap_recente.json`), em medidor ("mais úmida que em X% dos anos nesta época").
  4. Verde da lavoura: último NDVI e o pico da soja na última safra, quando houver NDVI para o ponto.
  5. Chuva de um ano típico: total médio de janeiro a julho (IMERG) e a data em que a chuva costuma acabar (regra da seção 3: mediana, ano mais cedo e mais tarde).
  6. Maior veranico: maior sequência de dias com menos de 1 mm entre março e maio, com o ano.
  7. Calor: em quantos dos 20 anos houve dia de 35 °C ou mais entre março e maio (POWER).
  8. Sua área e a região: posição da célula entre as 225 da caixa em chuva de março a maio ("mais seca que X% da região").
- Rodapé do painel: uma linha dizendo que cada dado vale para a área em volta do ponto, no tamanho indicado em cada selo, e não para o talhão exato.
- Ponto em célula sem dado de solo: use a vizinha mais próxima e diga isso no bloco.

### Histórico do talhão

- Troque os quadrados "plantou / ficou parado" por uma faixa de calor do NDVI: cada linha é um ano (2016–2025), cada coluna é uma leitura de 16 dias de janeiro a julho, a cor é o NDVI. Marque no topo "soja", "colheita" e "entressafra". Título: "Na entressafra, sua área ficou parada em X de 10 anos."

### Alertas da sua área

Fileira de alertas curtos. Cada um só aparece se o dado indicar risco:

- Geada: anos com mínima de 3 °C ou menos entre maio e julho (POWER).
- Chuva forte: média de dias por ano com 50 mm ou mais em fevereiro e março (IMERG), com a frase de que terra descoberta perde solo nesses dias.
- Fogo: verifique primeiro se o serviço da ORNL DAAC que já usamos para o MODIS oferece o produto de área queimada MCD64A1. Se oferecer, baixe para a caixa piloto (2016–2025), registre em `data_run` e mostre "Houve fogo a até X km do seu ponto em N de 10 anos (MODIS, NASA)". Se não oferecer, calcule o índice substituto: dias de junho e julho com umidade relativa abaixo de 30%, máxima de 30 °C ou mais e pelo menos 15 dias sem chuva. Nesse caso o nome na tela é "Tempo seco que favorece fogo na palha", nunca "queimada".
- Não existe dado de granizo nas fontes que temos: não crie alerta de granizo a partir de dados.

### Cartões menores (abaixo do painel e do histórico)

Com o número principal e o link "ver na sugestão":

- 20 anos de chuva: em quantos dos 20 anos a melhor opção deu certo.
- Clima 2041–2060: variação da chuva de março a maio em %, da máxima em °C (média dos 3 modelos do `cmip6_delta`) e a concordância ("3 de 3 modelos indicam…").

Mantenha o botão "Ver o que plantar".

## 5. Abas da resposta

Nova ordem e nomes: "Sugestão" (antes "Resposta"), "Comparar" (substitui "Todas as opções") e "Plano de 3 anos". As três abas contam a mesma história: a sugestão é o ano 1 de uma rotação, o Comparar mostra as alternativas e o Plano deixa o produtor montar a rotação.

### 5.1 Objetivo do produtor (vale nas três abas)

Seletor no topo "O que você quer mais?": "Mais segurança" (antes "Chuva"), "Renda" (antes "Dinheiro") e "Cuidar da terra" (antes "Terra"). A escolha reordena a sugestão, as opções do Comparar e o plano sugerido, e se mantém entre as abas.

### 5.2 Imagem da planta

Em todo cartão, chip e artigo de cultura, uma imagem da planta no canto. Ilustrações próprias em SVG ou fotos com licença aberta, com crédito. Não use imagem gerada por IA sem marca d'água visível.

### 5.3 Água (vale nas três abas)

Tudo sai do balanço hídrico diário que o motor já calcula.

- Selo "Sede da cultura" em cada cartão e chip: "pouca", "média" ou "muita" água, pelo consumo no ciclo (ETo × Kc). Cortes em `regras.yaml`, como hipótese do time.
- Linha "Água", com três números em mm para a data de plantio escolhida, em uma barra simples (necessidade, chuva, o que falta):
  - "Precisa de X mm" (consumo da cultura no ciclo);
  - "Costuma chover Y mm" (mediana do IMERG no ciclo);
  - "Falta Z mm em ano normal e W mm em ano seco" (déficit do balanço: mediana e percentil 20 dos 20 anos).
- Na mesma linha, a versão 2041–2060: quanto a falta de água muda com os deltas do `cmip6_delta`, com a faixa entre os 3 modelos.
- Não escreva número para "palhada segura umidade", enxurrada ou água guardada para a próxima safra: não temos dado. Esses pontos ficam no Guia, sem número.
- Opcional, atrás de uma opção de configuração desligada por padrão: pergunta "Você irriga essa área?" na tela "Quando você colhe" (padrão: não). Se sim, a linha "Água" troca "Falta" por "Água a repor", em mm e em m³ por hectare (1 mm = 10 m³/ha), e o Comparar mostra "[cultura A] no lugar de [cultura B] economiza N mm por safra". O critério de "deu certo" não muda: diga que a conta de anos bons é para lavoura sem irrigação.

### 5.4 Aba Sugestão

- Mostre a melhor opção como "Ano 1 do seu plano" e, logo abaixo, os 3 anos do plano em miniatura (cultura e imagem de cada ano), com o link "Explorar o plano".
- Explique "deu certo" junto do número, com o critério real do motor (confira em `regras.yaml`; hoje é água suficiente na fase crítica, ISNA de 0,55 ou mais, e nenhum dia de 35 °C nessa fase). Exemplo: "Deu certo = choveu o bastante na fase em que a planta mais precisa de água e não fez calor de 35 °C nessa fase."
- Troque a fileira de quadradinhos e bolinhas por um explorador ano a ano: gráfico de barras, um ano por barra (2005–2024), altura = água na fase crítica em % do que a planta precisa, linha de corte no limite do motor, rótulo e cor para "deu certo" e "faltou água / calor". Marque El Niño e La Niña com texto.
- Ao tocar em um ano, abra o detalhe: semeadura, floração, maior sequência sem chuva perto da floração, dias de 35 °C, El Niño ou La Niña (ONI), umidade inicial do SMAP quando existir (2016 em diante) e a frase do motivo. Reaproveite a tela `/safra-passada`: ela deixa de ser uma tela solta e vira o detalhe de qualquer ano.
- El Niño e La Niña: calcule a taxa de acerto por tipo de ano. Só mostre a frase ("em anos de La Niña, deu certo em X de Y") se a diferença for clara, dizendo que são poucos anos. Caso contrário, só a marcação por ano.
- Linhas do cartão, nesta ordem: Deu certo (com o explorador), Água (5.3), Clima 2041–2060 (com a variação de chuva e temperatura e a concordância dos modelos), Renda (seção 1) e Terra.
- "Como fazer" por cultura, em quatro partes: quando plantar (data limite do motor), quanto tempo leva (ciclo e floração de `culturas.yaml`), o que observar (dos dados: veranico típico, calor, fim das chuvas) e manejo (só o que já está nos documentos). Termina com o link "Passo a passo completo" para o artigo da cultura (seção 8).
- Colheita tarde: troque os três avisos repetidos por um só, com a lista montada dinamicamente: "Colhendo depois de 20 de fevereiro, já passou o prazo seguro de plantio (ZARC, 28/02) para milho, milho com braquiária e crotalária. Por isso elas não aparecem." Uma linha explica o ZARC, com link para o artigo. Mostre o risco de geada (seção 4) quando existir.
- Remova o botão e a tela "Relatório para banco ou seguro".

### 5.5 Aba Comparar

- O produtor escolhe até 3 culturas por chips com a imagem da planta e o selo de sede. Por padrão, as 3 melhores para o objetivo escolhido. Culturas fora da janela aparecem desabilitadas, com o motivo.
- Colunas lado a lado com as mesmas linhas: deu certo em X de 20 anos; por que falhou (anos por falta de água, anos por calor); água (5.3); clima 2041–2060; renda (seção 1); terra (palhada, nitrogênio, nematoide); prazo para plantar; "Por que usar" e "Por que evitar", gerados das notas do motor; link "Saiba mais" para o artigo.
- O bloco "Se você prefere…" sai da Sugestão e vira o ponto de partida desta aba.
- Em cada coluna, o botão "Usar no meu plano" leva a cultura para o ano 1 do Plano de 3 anos.

### 5.6 Aba Plano de 3 anos

- Montar a rotação: em cada ano, o produtor pode trocar a cultura (entre as que cabem na janela de plantio). As notas do plano recalculam na hora, sempre ao lado do "Como é hoje": segurança climática, saúde da terra e clima 2041–2060. Botão "Voltar ao plano sugerido".
- Saúde da terra da rotação inteira, com fatos: em quantos dos 3 anos a terra fica coberta, quantos anos deixam nitrogênio, quantos quebram o ciclo do nematoide, e se há repetição da mesma cultura.
- Bloco "Chuva aproveitada": para cada ano do plano e para o "Como é hoje", quantos mm da chuva entre a colheita da soja e o fim de julho foram usados pela planta (evapotranspiração real da cultura no balanço) e quantos caíram com a terra parada. Frase: "Com a terra parada, X mm de chuva por ano caem sem virar grão nem palha. Com o plano, a lavoura usa Y mm." Para o pousio, não estime evaporação do solo: mostre só a chuva que caiu sem cultura.
- "Como é hoje": hoje é uma sequência fixa de referência (milho sozinho nos 3 anos). Passe a usar o NDVI das três últimas safras do ponto, quando houver, mais a confirmação do produtor: "O satélite viu plantio na entressafra de [anos]. O que foi?" (milho, sorgo, cobertura, nada). O satélite mostra se plantou, não o quê. Sem NDVI para o ponto, pergunte direto. Sem resposta, mantenha a referência e diga que é uma referência.
- Plano A e Plano B: uma frase para cada ("Plano A: [cultura], se a chuva vier normal" / "Plano B: [cultura], se secar"). Defina "secar" com um número que o produtor confere no pluviômetro. Derive da série: procure o limite de chuva nos 15 dias antes da semeadura (ou outro indicador simples, como o percentil do SMAP) que melhor separa os anos que deram certo dos que falharam. Se nenhum limite separar bem, não invente: explique o Plano B sem número e relate isso.
- Remova o bloco "Comece por um pedaço" inteiro (hectares, valores, custo da semente) e o botão "Como teria sido em 2024?".

## 6. Avisos (`/avisos`)

Botão "Avisos" no cabeçalho, ao lado de "Comunidade", com contador dos avisos ativos.

- Os avisos valem para o ponto marcado, salvo no aparelho (sem cadastro). Sem ponto, a tela pede para marcar a lavoura. Sem notificação por push: aparecem quando o app é aberto.
- Cada aviso tem: nível em texto ("Atenção" ou "Fique de olho"), o que o dado mostra, o que fazer em uma frase, a fonte e a data da leitura.
- Grupo sem aviso mostra "Nada fora do normal" com a data da última leitura.

### Grupo 1: Agora

- Terra seca: percentil do SMAP de 20 ou menos → "A terra está mais seca que em X% dos anos nesta época." Leitura com mais de 15 dias é marcada como antiga.
- Dias sem chuva e calor: busque na API do NASA POWER os últimos 30 dias da célula (mesma API da pré-carga, sem chave), no backend, com cache de 24 horas. Avise com 10 ou mais dias seguidos com menos de 1 mm até a última leitura, ou 3 ou mais dias de 35 °C nos últimos 10. Mostre a data da última leitura. Se a API falhar, o aviso não aparece.
- Não compare a chuva recente com "o normal": o banco só tem janeiro a julho.
- El Niño ou La Niña: se o arquivo da previsão da NOAA para o outono de 2027 existir, mostre a previsão e o que aconteceu na célula em anos parecidos, dizendo que são poucos anos.
- Durante a safrinha (entre a semeadura e a colheita informadas), aplique a regra de avisos do replay aos dados recentes. Fora dela, o link "Ver como teriam sido os avisos em 2024" abre o detalhe de 2024 no explorador.

### Grupo 2: O que mudou na sua área

Compare 2020–2024 com 2005–2019 na célula: maior veranico de março a maio, data do fim das chuvas, dias de 35 °C entre março e maio, falta de água da melhor opção (mm) e anos em que ela deu certo. Mostre só as mudanças acima do limite mínimo de `regras.yaml`, com os dois números lado a lado. Diga que são poucos anos e que isso mostra o que aconteceu, não uma previsão.

### Grupo 3: Fora do comum

Recordes da célula nos 20 anos (maior veranico, outono mais seco, fim das chuvas mais cedo, ano com mais dias de calor), uma linha cada, com o ano.

### Grupo 4: Perto de você

Eventos relatados pela comunidade (seção 7) nos últimos 7 dias a até 30 km, marcados como "relato de vizinho, não confirmado".

### Rodapé fixo "Alertas oficiais"

- "Estes avisos não são alertas oficiais e não substituem a Defesa Civil nem o INMET."
- "Para receber os alertas oficiais da Defesa Civil no celular, de graça:"
  - SMS: envie o CEP do lugar para 40199 (na área rural, use o CEP da sua cidade). Botão que abre o SMS com o número preenchido.
  - WhatsApp: mande "Oi" para (61) 2034-4611. Botão que abre a conversa.
  - Alertas graves chegam sozinhos pelo "Defesa Civil Alerta", sem cadastro.
- "Em caso de fogo, ligue 193 (Bombeiros). Emergência da Defesa Civil: 199."
- Link para o artigo do Guia sobre alertas oficiais.

## 7. Comunidade (`/comunidade`)

Refaça a tela "Na sua região" como o primeiro passo de uma comunidade local. Sem cadastro, sem texto livre, sem dado pessoal.

### Contar (três relatos, no máximo três toques cada)

- "O que plantei depois da soja": cultura (as do `culturas.yaml`, mais "outra" e "deixei parado"), ano da safra e como foi ("foi bem", "mais ou menos", "perdi"). Se perdeu, o motivo: seca, calor, geada, granizo, praga, outro.
- "Choveu aqui": milímetros e a data (padrão: hoje).
- "Aconteceu aqui": fogo, granizo, geada, vendaval, enxurrada ou erosão, praga ou doença; e a data. Ao relatar fogo, mostre "Em caso de fogo, ligue 193 (Bombeiros)".

### Regras dos relatos

- O relato vale para o ponto marcado. Guarde só a célula da grade (0,1°), nunca a coordenada exata. Antes do primeiro envio: "Seus vizinhos veem a região, não o seu ponto."
- Sem login: identificador aleatório salvo no aparelho, só para limitar a quantidade (por exemplo, 10 por dia) e permitir apagar os próprios relatos.
- Valide os valores (chuva de 0 a 300 mm por dia; datas não futuras e de no máximo 30 dias atrás para chuva e eventos).
- Todo relato aparece como "relato de vizinho, não confirmado".
- Tabela nova `community_report` (tipo, subtipo, valores em JSON, célula, data do fato, data do envio, identificador do aparelho com hash). O campo de tipo fica aberto para tipos futuros (oferta, troca, empréstimo de insumos e equipamentos), que não entram agora.
- Endpoints: enviar, listar por ponto e raio, apagar o próprio relato.

### Ver a redondeza

- Mapa com raio de 30 km em volta do ponto, relatos agrupados por célula, com ícone e texto por tipo.
- Resumo "Perto de você":
  - Plantio: "N vizinhos contaram o que plantaram em [ano]: X milho, Y milheto…" e quantos disseram que foi bem.
  - Chuva: média dos relatos dos últimos 7 dias e número de relatos, ao lado do que o satélite mediu no mesmo período quando houver dado recente.
  - Eventos dos últimos 30 dias, do mais recente para o mais antigo.
- Se o dado de área queimada do MODIS tiver sido baixado (seção 4), mostre no mapa junto dos relatos de fogo, com a fonte.
- O bloco da região pelo satélite (NDVI) continua escondido até a calibração terminar.
- Sem relatos: "Ainda não há relatos perto de você. Seja o primeiro a contar." Não crie relatos falsos. Dados de demonstração só atrás de uma opção desligada por padrão, com o selo "Exemplo" em cada item.

### Ligações

- Plano de 3 anos: ao confirmar o que plantou nas últimas safras, ofereça "Compartilhar com a comunidade", que grava o relato de plantio.
- No fim da tela, a entrada para o Guia.

## 8. Guia (`/guia` e `/guia/[artigo]`)

Base pequena de artigos de ajuda, dentro da Comunidade, em PT e EN, guardados como arquivos Markdown no repositório. Página inicial com os artigos agrupados nos cinco temas abaixo e uma busca simples por título.

### Formato de cada artigo

- 150 a 300 palavras, frases curtas, sem jargão.
- Estrutura fixa: "Em uma frase", "Por que importa", "Na sua lavoura" (onde o app mostra isso, com link de volta para a tela) e "Fontes".
- Conceitos gerais e consolidados podem ser explicados. Números e parâmetros só de `culturas.yaml`, `regras.yaml`, PRD ou do motor.
- Em "Fontes", só cite página que você abriu e conferiu. Não invente link.
- Todo artigo de cultura, plantio ou manejo leva no topo: "Rascunho: a revisar pela agrônoma."
- Funciona com o botão "Ouvir". Artigos de cultura usam a imagem da planta.

### Ordem de escrita

Primeiro os artigos com link nas telas principais: as seis culturas, "O que significa 'deu certo'", "A conta de água da lavoura", "Rotação de culturas", "O prazo de plantio e o ZARC", "Veranico" e "Alertas oficiais da Defesa Civil". Depois os demais.

### Tema A: Culturas (um artigo cada)

Milho safrinha · Milho com braquiária · Sorgo · Milheto · Crotalária · Deixar a terra parada.

Cada um com duas partes: "Conheça" (para que serve, quanta água pede, o que deixa na terra, do que tem mais medo: seca, calor, geada) e "Passo a passo" (quando plantar, quanto tempo leva, fases, o que observar, o que vem depois).

### Tema B: Plantar

- Plantio direto: plantar sem revirar a terra.
- Sementes: o que olhar antes de comprar (semente certificada, germinação e vigor no rótulo, tratamento; quantidade e variedade ficam com o agrônomo).
- O prazo de plantio e o ZARC.
- Plantar logo depois da colheita: por que cada dia conta.

### Tema C: Cuidar da terra

- Como evitar erosão (cobertura, plantio direto, curvas de nível e terraços, chuva forte de fevereiro e março).
- Palhada: por que cobrir a terra.
- Adubo verde: nitrogênio que a planta deixa.
- Nematoide e por que trocar de cultura.
- Rotação de culturas: como ler e montar o plano de 3 anos.

### Tema D: Clima, água e dados

- O que significa "deu certo".
- A conta de água da lavoura (quanto a planta precisa, quanto chove, quanto falta, e como aproveitar a chuva que já cai).
- Veranico: os dias sem chuva.
- Calor de 35 °C na floração.
- Quando a chuva acaba.
- El Niño e La Niña.
- O clima de 2041 a 2060.
- Como ler o raio-X da sua terra (solo, água que a terra guarda, umidade, verde da lavoura).

### Tema E: Segurança

- Como receber os alertas oficiais da Defesa Civil.
- Fogo na palha: como prevenir e o que fazer.
- Geada na safrinha.

### Links nas telas (ícone de ajuda ou "Saiba mais" ao lado do termo)

| Tela | Elemento | Artigo |
|---|---|---|
| Quando você colhe | Gráfico de chuva que sobra | Quando a chuva acaba |
| Quando você colhe | Custo do atraso | Plantar logo depois da colheita |
| Raio-X | Blocos de solo e de água | Como ler o raio-X da sua terra |
| Raio-X | Veranico | Veranico |
| Raio-X | Calor | Calor de 35 °C na floração |
| Raio-X | Alerta de geada | Geada na safrinha |
| Raio-X | Alerta de chuva forte | Como evitar erosão |
| Raio-X | Alerta de fogo | Fogo na palha |
| Sugestão | "Deu certo" | O que significa "deu certo" |
| Sugestão | Linha Água | A conta de água da lavoura |
| Sugestão | Selo de sede | Artigo da cultura |
| Sugestão | Marcação de El Niño | El Niño e La Niña |
| Sugestão | Linha do clima futuro | O clima de 2041 a 2060 |
| Sugestão | "Como fazer" | "Passo a passo" da cultura |
| Sugestão | Aviso da colheita tarde | O prazo de plantio e o ZARC |
| Comparar | Cada coluna | Artigo da cultura |
| Comparar | Linha Terra | Palhada, Adubo verde, Nematoide |
| Plano de 3 anos | Título | Rotação de culturas |
| Plano de 3 anos | Chuva aproveitada | A conta de água da lavoura |
| Plano de 3 anos | Plano B | Veranico |
| Avisos | Rodapé | Alertas oficiais da Defesa Civil |
| Comunidade | Relato de fogo | Fogo na palha |
| Comunidade | Relato de enxurrada ou erosão | Como evitar erosão |

## 9. Consistência

- A tela de missão lista só as fontes realmente usadas e o número certo de opções.
- "Como a conta é feita" reflete as regras novas (deu certo, renda sem preço, água, sede da cultura, nota da rotação, Plano B, fogo, geada, avisos).
- Confira que nenhuma tela ficou com link para as telas removidas (relatório, safra passada como tela solta).
