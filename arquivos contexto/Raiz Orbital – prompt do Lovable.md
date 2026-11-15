# Prompt para o Lovable: Raiz Orbital

> Cole o bloco "PROMPT PRINCIPAL" inteiro na primeira mensagem do Lovable. Depois, use os "PROMPTS DE AJUSTE" (no fim) um por vez, só se precisar.

---

## PROMPT PRINCIPAL

Crie um **site responsivo** chamado **Raiz Orbital**, com o slogan **"Do espaço até a raiz."**. Ele ajuda o produtor rural do Cerrado brasileiro (Triângulo Mineiro, Minas Gerais) a decidir **o que plantar depois da soja**, usando dados de satélite da NASA. É um projeto do hackathon NASA Space Apps Challenge 2026 (desafio "Field Shift").

Esta primeira versão funciona **só com dados de exemplo (mock)**, mas o acesso a dados já fica separado para ligar numa API real depois (contrato no fim).

### 1. Público e princípios (o mais importante)

O usuário principal é o produtor de soja e milho sem irrigação do Triângulo Mineiro:
- Tem mais de 45 anos (76%) e, na maioria, estudou só até o ensino fundamental (64%).
- Usa o celular o dia todo, muitas vezes com sinal fraco no campo.
- Desconfia de tecnologia e de inteligência artificial; confia no agrônomo.

Por isso, siga estes princípios em **todas** as telas:
1. **Muito fácil e intuitivo.** Pouco texto, frases curtas, linguagem do campo ("lavoura", "terra", "chuva", "plantar"), nada de jargão técnico na frente do produtor.
2. **Só duas perguntas:** onde fica a lavoura e quando ele colhe a soja. Todo o resto vem dos dados.
3. **Uma pergunta por tela** no caminho principal.
4. **Palavras e cores, não notas.** Nunca mostre nota de 0 a 100 para o produtor. Mostre "Deu certo em 14 de 20 anos", "Sobra perto de R$ 700 por hectare" e rótulos **Bom / Médio / Fraco**, sempre com palavra + cor + ícone (nunca só cor).
5. **Resposta primeiro, detalhe depois.** O "Por quê?" fica escondido num botão que abre.
6. **Botão "Ouvir"** em todas as telas: lê o conteúdo principal da tela em voz alta (Web Speech API, `speechSynthesis`, voz `pt-BR`; em inglês, `en-US`). Tocar de novo para parar.
7. **Botões grandes:** altura mínima de 48 px; botões principais com 60 px. Texto a partir de 15 px (corpo 16–18 px).
8. **Tom calmo**, sem alarmismo, sem vermelho de alerta.
9. **Sem cadastro, sem login e sem guardar dado pessoal.**
10. Sempre visível em algum lugar: "Ajuda a decidir. Não substitui o seu agrônomo."
11. **Não use logotipo da NASA.** Pode escrever "dados da NASA".
12. **Não** crie tela de "mandar para o agrônomo", chat, IA, painel de notas nem controles de peso.

### 2. Stack e organização do código

- React + TypeScript + Vite + Tailwind CSS (shadcn/ui pode ser usado, mas com o visual abaixo).
- Rotas com `react-router-dom`.
- Mapa com **Leaflet + react-leaflet** e tiles do **OpenStreetMap** (com a atribuição obrigatória do OSM).
- Idiomas: **português (padrão) e inglês**, com botão "PT | EN" no topo. Todos os textos ficam num dicionário (`src/i18n/pt.ts` e `src/i18n/en.ts`). Os jurados do hackathon leem em inglês: traduza tudo.
- Organize em camadas, nesta estrutura de pastas (é o padrão do repositório do time):
  - `src/models/` tipos do domínio (ex.: `Recommendation`, `CropOption`, `Field`).
  - `src/repositories/` acesso a dados: `recommendationRepository.ts` com duas implementações, **mock** (padrão) e **HTTP** (usada quando `VITE_API_URL` estiver definida).
  - `src/services/` regras de apresentação (ordenar opções, escolher rótulo e texto), sem React.
  - `src/controllers/` hooks `useXxx` que ligam service e view.
  - `src/views/` componentes e telas.
- Testes com **Vitest** pelo menos para os services (ordenação e textos).
- O estado da jornada fica **na URL**: `?lat=-18.9543&lon=-48.1993&colheita=meio`. Assim recarregar a página ou compartilhar o link mostra a mesma resposta.

### 3. Visual (design system)

Cores:
- Fundo da página: `#F4F6F5`
- Cartões: `#FFFFFF`, borda `#DDE3E0`, raio 16–20 px, sem sombra pesada
- Texto principal: `#14211C`; texto secundário: `#2E3A35`; texto fraco: `#45524C` (nunca mais claro que isso)
- Verde principal (botões, destaques): `#1F6B47`; hover `#164E34`; verde claro de fundo: `#E6F0EA`
- Azul (chuva, satélite, botão "Ouvir"): `#1D5FA8`; azul claro de fundo: `#EAF1FA`
- Laranja-terra (terra parada, falta de água): `#B5551A`; fundo `#FFF4EC`; texto sobre fundo laranja: `#6B3009`
- Rótulos: **Bom** fundo `#D9ECDF` texto `#164E34`; **Médio** fundo `#FFEFC9` texto `#5C4000`; **Fraco** fundo `#FBE3D0` texto `#6B3009`

Tipografia (Google Fonts): **Space Grotesk** (títulos, 600–700) e **Inter** (texto, 400–700).
- Título da tela: `clamp(30px, 3.4vw, 40px)`; título da página inicial: `clamp(36px, 4.6vw, 56px)`.
- Corpo: 16–18 px; legendas: 14–15 px.

Layout responsivo (a mesma página serve celular e computador):
- Cabeçalho branco em todas as telas: logo + "Raiz Orbital" à esquerda; botão "Ouvir" (contorno azul, ícone de alto-falante) e "PT | EN" à direita.
- Conteúdo com largura máxima de **1240 px**, centralizado, padding lateral `clamp(16px, 4vw, 40px)`.
- No **celular (até ~768 px)**: tudo empilhado na ordem de leitura, botões ocupando a largura toda.
- No **computador**: aproveite a largura com duas colunas e grades (detalhes em cada tela). Botões principais com largura máxima de ~420 px quando sozinhos.
- Use `flex-wrap` e `grid` com `auto-fit`; nada de largura fixa.
- Logo: um círculo verde com uma órbita azul inclinada e um brotinho de três folhas no centro (SVG simples, traço).

Acessibilidade: botões de verdade (`<button>`, `<a>`), `aria-pressed` nos botões de escolha, `aria-expanded` no "Por quê?", contraste mínimo 4.5:1, ícones decorativos com `aria-hidden`.

### 4. Telas

#### Caminho principal (5 telas)

**Tela 1: Início (`/`)**
- Texto pequeno verde: "Para quem planta soja no Triângulo Mineiro".
- Título: "O que plantar depois da soja?"
- Slogan logo abaixo, em verde: "Do espaço até a raiz."
- Texto: "O satélite da NASA olhou 20 anos de chuva na sua lavoura. Veja a melhor opção."
- Botão principal "Começar" → tela 2. Abaixo dele: "2 perguntas · 1 minuto · grátis, sem cadastro".
- Botão secundário (contorno verde) "Ver um exemplo pronto" → tela 5 com a fazenda de exemplo (`lat=-18.9543&lon=-48.1993&colheita=meio`).
- Ilustração em SVG: um satélite numa órbita tracejada sobre fileiras curvas de lavoura com brotinhos (tons de verde e azul).
- Três cartões com ícone: "1. Marque a lavoura", "2. Diga quando colhe", "3. Veja a resposta".
- Rodapé: "Ajuda a decidir. Não substitui o seu agrônomo." + link "Sou agrônomo(a): como a conta é feita" → tela 9.
- Computador: texto e botões à esquerda, ilustração à direita; os três cartões em linha embaixo.

**Tela 2: Onde fica a lavoura? (`/onde`)**
- Linha superior: "‹ Voltar" e o indicador "Pergunta 1 de 2" com duas barrinhas (a primeira verde).
- Título: "Onde fica a lavoura?"
- Mapa Leaflet grande (no celular, ~400 px de altura), centralizado na fazenda de exemplo (-18.9543, -48.1993), zoom 12, com um **alfinete verde arrastável**. Rótulo sobre o mapa com o nome da cidade mais próxima (no mock, "Perto de Uberlândia (MG)").
- Botão "Usar onde estou agora" (contorno azul, ícone de mira): usa `navigator.geolocation` e move o alfinete. Se o usuário negar, mostre uma mensagem curta e calma.
- Texto: "Ou arraste o mapa até o alfinete ficar em cima da lavoura."
- Botão principal "É aqui" → tela 3, levando `lat` e `lon` na URL.
- Se o ponto ficar fora da área atendida (caixa lon -49.0 a -47.5, lat -19.9 a -18.4), mostre: "Ainda não temos dados dessa região. Veja a lavoura de demonstração." com botão para o exemplo.
- Computador: mapa à esquerda (2/3), botões à direita (1/3).

**Tela 3: Quando você colhe a soja? (`/colheita`)**
- "‹ Voltar" e "Pergunta 2 de 2" (as duas barrinhas verdes).
- Título: "Quando você colhe a soja?"
- Faixa azul-clara com ícone de satélite: "Pelo satélite, a soja daqui costuma secar no **meio de fevereiro**. Já deixamos marcado." (o valor vem de `colheita_sugerida` do mock/API).
- Três botões grandes, um embaixo do outro, tipo opção única (com bolinha de seleção à direita); o escolhido fica verde-cheio com texto branco:
  - "Começo de fevereiro" / "até dia 10" → `cedo`
  - "Meio de fevereiro" / "dia 11 a 20" → `meio`
  - "Fim de fevereiro ou março" / "depois do dia 20" → `tarde`
- Texto: "Não tem certeza? Deixe como está. Dá para mudar depois."
- Botão principal "Ver a resposta" → tela 4.
- Computador: opções à esquerda; à direita um cartão "Por que perguntamos isso?" com o texto "A chuva vai acabando depois de março. Quanto mais cedo você colhe a soja, mais chuva sobra para a próxima planta." e um gráfico de barras simples da chuva média por mês (jan a jun, barras azuis decrescentes), com a legenda "Chuva de cada mês na região."

**Tela 4: Pronto. O satélite já viu o resto. (`/satelite`)**
- "‹ Voltar". Título: "Pronto. O satélite já viu o resto." Subtítulo: "Você não precisa preencher mais nada."
- Quatro cartões, cada um com ícone redondo à esquerda e um ✓ verde à direita:
  1. "Sua área ficou parada em 5 de 10 anos" / "O que cresceu depois da soja, ano a ano:" + uma faixa de 10 quadradinhos (2016 a 2025): verde cheio = "Plantou", contorno laranja = "Ficou parado", com o ano embaixo e legenda.
  2. "20 anos de chuva daqui" / "De 2006 a 2025, dia por dia."
  3. "Terra média" / "Do mapa de solos." + link "Não é? Trocar", que abre uma escolha simples: "Arenosa (solta, seca rápido)", "Média", "Argilosa (pesada, gruda na bota)".
  4. "Clima dos próximos anos" / "Como a chuva e o calor devem mudar até 2050."
- Botão principal "Ver o que plantar" → tela 5.
- Enquanto os dados carregam, mostre os cartões aparecendo um a um com um indicador simples ("Buscando dados do satélite…"), nunca uma tela branca.
- Computador: duas colunas (histórico e chuva à esquerda; terra, clima e botão à direita).

**Tela 5: A resposta (`/resultado`)**
- "‹ Voltar". Texto: "Depois da soja de 2027, na sua lavoura:"
- **Cartão verde grande** (fundo `#1F6B47`, texto branco): "A melhor opção" / **"Milho com braquiária"** (título grande) / "Plante logo depois de colher a soja."
- Cartão branco com três linhas de sinais, cada uma com ícone, rótulo pequeno, frase em negrito e rótulo colorido à direita:
  - Chuva (ícone de gota): "Deu certo em 14 de 20 anos" → **Médio**. Embaixo, uma faixa de **20 quadradinhos** (um por ano, 2006 a 2025): verde cheio = choveu o bastante; contorno laranja = faltou chuva.
  - Dinheiro (ícone de nota): "Sobra perto de R$ 700 por hectare" → **Bom**.
  - Terra (ícone de broto): "Fica coberta na seca" → **Bom**.
  - Botão "Por quê?" que abre um bloco com as frases do campo `porque` (cada uma cita o dado da NASA). Vira "Fechar".
- Cartão verde-claro "Como fazer" com 3 passos numerados (bolinhas verdes): "Semeie o capim junto com o milho." / "Colha o milho. O capim fica cobrindo a terra." / "Plante a próxima soja em cima da palhada." + nota pequena "Dose de semente e herbicida: combine com o seu agrônomo."
- Botão principal "Ver plano de 3 anos" → tela 7; secundário "Ver todas as opções" → tela 6.
- Seção "Se você prefere…" com três cartões de alternativa (rótulo pequeno + nome em negrito + uma frase):
  - "Menos risco de seca" → **Sorgo**: "Deu certo em 17 de 20 anos. Sobra perto de R$ 540 por hectare."
  - "Mais dinheiro em ano bom" → **Milho sozinho**: "Sobra perto de R$ 950 por hectare, mas a terra fica sem cobertura."
  - "Cuidar da terra" → **Crotalária**: "Deixa adubo natural (nitrogênio) e quebra o nematoide. Não tem colheita."
- Nota final: "Valores de exemplo. Ajuda a decidir; não substitui o agrônomo."
- Computador: cartão verde + sinais à esquerda; "Como fazer" + botões à direita; as três alternativas lado a lado embaixo, na largura toda.
- Tudo nesta tela vem do mock/API: muda conforme `colheita` (ver dados no item 6).

#### Telas de apoio

**Tela 6: Todas as opções (`/opcoes`)**
- "‹ Resposta". Título "Todas as opções".
- "Colocar na frente quem é melhor em:" + três botões **Chuva / Dinheiro / Terra** (tocar de novo volta à ordem padrão).
- Um cartão por opção: posição ("1º") + nome; linhas "Chuva" (frase + faixa de 20 quadradinhos), "Dinheiro" e "Terra". O primeiro cartão tem borda verde mais grossa.
- "Deixar parado" aparece por último, com "Não depende de chuva", "Não rende nem custa" e "Fica descoberta".
- Opções fora da janela de plantio (quando `colheita=tarde`) aparecem num aviso laranja-claro: "Já não dá tempo: Milho com braquiária, Milho sozinho e Crotalária ficam fora da janela de plantio."
- Legenda: "Cada quadrinho é um ano, de 2006 a 2025. Cheio: choveu o bastante. Vazio: faltou chuva na hora que a planta mais precisa."
- Computador: grade de 3 cartões por linha.

**Tela 7: Plano de 3 anos (`/plano`)**
- "‹ Resposta". Título "Plano de 3 anos". Subtítulo "O que plantar depois da soja, um ano de cada vez."
- Linha do tempo com 3 blocos: selo verde com o ano (2027, 2028, 2029) + nome + uma frase:
  - 2027 "Milho com braquiária" / "Dá grão e cobre a terra."
  - 2028 "Crotalária" / "Adubo natural e quebra o nematoide."
  - 2029 "Sorgo" / "Dá grão com menos risco de seca."
- "E se vier um ano seco?" com dois botões **Ano normal / Ano seco** (azuis quando ativos). No ano seco, 2027 vira "Sorgo" / "Troca o milho: aguenta mais a seca." e o texto explica: "Repetimos o ano mais seco dos últimos 20, parecido com El Niño forte."
- Dois cartões comparando: verde-claro "Com o plano: Terra coberta nos 3 anos · Grão em 2 de 3 anos"; laranja-claro "Como é hoje: Terra descoberta em metade dos anos".
- Cartão "Comece por um pedaço" com botões **50 ha / 100 ha / Tudo** e a frase "O plano em 50 hectares. O resto fica como hoje, para você comparar."
- Cartão verde-claro "O ganho vem na soja seguinte": "Num estudo no Cerrado, a soja depois de grão com braquiária rendeu 11% a mais do que depois de terra parada."
- Botão secundário "Voltar para a resposta".
- Computador: a linha do tempo na horizontal (3 colunas); embaixo, duas colunas.

**Tela 8: Perto de você (`/regiao`)** (comunidade, simulada)
- Título "Perto de você", subtítulo "Até 30 km de Uberlândia · 18 produtores participando".
- Cartão "O que os vizinhos plantaram depois da soja em 2026": para cada opção, uma fila de bolinhas (uma por vizinho; cheia = gostou do resultado): Milho safrinha 3 de 6 gostaram; Parado (pousio) 1 de 4; Milho + braquiária 2 de 3; Sorgo 2 de 2; Crotalária 1 de 1. Botão "Contar como foi a minha" (só visual).
- Mapa pequeno da região com pontos aproximados (sem localização exata) e o cartão "Choveu aqui" (ontem): "A 6 km, ao norte: 32 mm · satélite 24 mm"; "A 11 km, a leste: 18 mm · satélite 21 mm"; "A 14 km, ao sul: 0 mm · satélite 3 mm". Botão "Registrar a chuva de hoje" (só visual).
- Nota: "O mapa mostra a região, nunca a posição exata das fazendas. Nome só aparece com autorização. Valores ilustrativos."
- Acesso por um link discreto no rodapé da tela 7.

**Tela 9: Como a conta é feita (`/como-funciona`)** (para agrônomos e jurados)
- Três passos numerados: "Pegamos a chuva e o calor de cada ano, de 2006 a 2025, no ponto do seu talhão." / "Para cada opção, simulamos a água na terra dia a dia, a partir da data de semeadura." / "Contamos em quantos anos faltou água ou sobrou calor na fase em que a planta mais precisa."
- Cartão verde-claro "Sem inteligência artificial, conta aberta": "Cada nota é uma regra que cabe numa frase. Os limites de falta de água e de calor vêm da Embrapa e do ZARC."
- Cartão "Bateu com o que aconteceu?": "[RESULTADO DO TESTE COM O IBGE]".
- Cartão azul-claro "O que o satélite não enxerga": "A chuva vem em quadrados de 10 km, não do seu talhão: seu pluviômetro vale mais. O clima de 2050 é uma faixa entre modelos, não uma previsão."
- "De onde vem cada dado", grade de cartões: Chuva — GPM IMERG (NASA), quadrados de 10 km, por dia · Calor, vento e sol — NASA POWER · Umidade da terra — SMAP L4 (NASA), 9 km · Histórico do talhão — MODIS (NASA), 250 m, a cada 16 dias · Clima de 2050 — NEX-GDDP-CMIP6 (NASA), cerca de 28 km · Tipo de terra — SoilGrids (ISRIC), 250 m.
- Esta é a única tela que pode mostrar as notas de 0 a 100 (campo `notas`), numa tabela simples por opção.

### 5. Comportamentos

- **Ouvir:** lê o título e os textos principais da tela atual (não lê menus). Mostra "Parar" enquanto fala.
- **PT | EN:** troca todos os textos, inclusive os que vêm do mock (o mock tem as duas versões).
- **Voltar** sempre volta um passo e mantém as escolhas (estão na URL).
- **Carregamento:** esqueleto/placeholder discreto; nunca tela vazia.
- **Erro de dados:** mensagem calma ("Não conseguimos buscar os dados agora. Tente de novo ou veja a lavoura de demonstração.") com os dois botões.
- **Sem animação exagerada;** respeite `prefers-reduced-motion`.

### 6. Dados de exemplo (mock)

Fazenda de exemplo: **lavoura de demonstração, perto de Uberlândia (MG)**, `lat -18.9543`, `lon -48.1993`, terra média, colheita sugerida `meio`. O ponto fica perto da Fazenda do Glória, mas não garantidamente dentro dela. Na tela, mostre "Lavoura de demonstração, perto de Uberlândia (MG)" (em inglês, "Demo field, near Uberlândia (MG)"). Não use nome de produtor nem diga de quem é a área.

Histórico (2016 a 2025): 2016 parado, 2017 plantou, 2018 parado, 2019 plantou, 2020 parado, 2021 plantou, 2022 plantou, 2023 parado, 2024 parado, 2025 plantou → parado em 5 de 10.

Opções por faixa de colheita (`anos_bons` = anos sem falta de água, em 20; `sobra` = R$ por hectare; `null` = fora da janela):

| Opção | id | Terra (rótulo, frase) | cedo: anos / sobra | meio: anos / sobra | tarde: anos / sobra | 2050 (meio) |
| --- | --- | --- | --- | --- | --- | --- |
| Milho com braquiária | milho_braquiaria | Bom, "Fica coberta na seca" | 15 / 800 | 14 / 700 | fora | 12 |
| Sorgo | sorgo | Médio, "Palhada média" | 18 / 560 | 17 / 540 | 15 / 470 | 15 |
| Milho sozinho | milho_safrinha | Fraco, "Pouca cobertura" | 15 / 1050 | 14 / 950 | fora | 12 |
| Crotalária | crotalaria | Bom, "Adubo natural, quebra nematoide" | 18 / −250 | 17 / −250 | fora | 16 |
| Milheto | milheto | Bom, "Muita palhada" | 19 / −120 | 18 / −120 | 17 / −120 | 17 |
| Deixar parado | pousio | Fraco, "Fica descoberta" | não depende | não depende | não depende | — |

Regras de texto e rótulo (ficam no service do front no mock; na API real vêm prontos):
- Chuva: "Deu certo em N de 20 anos". Rótulo **Bom** se N ≥ 17, **Médio** se 12–16, **Fraco** se < 12.
- Dinheiro: sobra > 0 → "Sobra perto de R$ X por hectare"; < 0 → "Custa perto de R$ X por hectare"; 0 → "Não rende nem custa". Rótulo pela proporção da maior sobra entre as opções: **Bom** ≥ 70%, **Médio** 30–69%, **Fraco** < 30%.
- Melhor opção: `cedo` e `meio` → Milho com braquiária; `tarde` → Sorgo. **Deixar parado nunca é a melhor opção nem alternativa.**
- Alternativas: a melhor em chuva, a melhor em dinheiro e a melhor em terra, sem repetir a melhor opção.
- "Por quê?" (meio, milho com braquiária): "Plantando no meio de fevereiro, o milho floresce em abril. Em 6 dos últimos 20 anos, faltou chuva bem nessa hora (GPM IMERG + NASA POWER)." / "No clima de 2041–2060 (NEX-GDDP-CMIP6), isso subiria para 8 em 20 anos." / "A braquiária cresce junto e cobre a terra até a próxima soja." Para as outras opções e faixas, gere frases no mesmo formato a partir da tabela.
- A faixa de 20 quadradinhos: os primeiros N verdes e o resto vazio (no mock; na API vem ano a ano).
- Plano de 3 anos: normal = milho_braquiaria → crotalaria → sorgo; seco = sorgo → crotalaria → sorgo; quando `colheita=tarde`, o normal começa com sorgo.

### 7. Contrato da API real (para a implementação HTTP do repository)

Base: `VITE_API_URL` (ex.: `http://localhost:8000`). Sem a variável, use o mock.

`GET /api/talhao?lat=-18.9543&lon=-48.1993`
```json
{
  "ponto": {"lat": -18.9543, "lon": -48.1993},
  "dentro_da_area": true,
  "solo": {"textura": "medio", "cad_mm": 50, "fonte": "soilgrids"},
  "colheita_sugerida": {"faixa": "meio", "fonte": "ndvi_modis"},
  "historico": {"anos": [{"ano": 2016, "situacao": "parado"}, {"ano": 2017, "situacao": "plantou"}], "parado": 5, "total": 10}
}
```

`GET /api/recomendacao?lat=-18.9543&lon=-48.1993&colheita=meio[&solo=argiloso]` (cabeçalho `Accept-Language: pt-BR` ou `en`)
```json
{
  "entrada": {"colheita": "meio", "semeadura": "2027-02-18", "solo": "medio"},
  "melhor": "milho_braquiaria",
  "alternativas": [
    {"motivo": "menos_risco", "opcao": "sorgo"},
    {"motivo": "mais_dinheiro", "opcao": "milho_safrinha"},
    {"motivo": "cuidar_da_terra", "opcao": "crotalaria"}
  ],
  "opcoes": [
    {
      "id": "milho_braquiaria",
      "nome": "Milho com braquiária",
      "na_janela": true,
      "chuva": {"anos_bons": 14, "anos": 20, "faixa": [true, true, false], "rotulo": "medio", "texto": "Deu certo em 14 de 20 anos"},
      "futuro": {"anos_bons_media": 12},
      "dinheiro": {"margem_ha": 700, "rotulo": "bom", "texto": "Sobra perto de R$ 700 por hectare"},
      "terra": {"rotulo": "bom", "texto": "Fica coberta na seca"},
      "notas": {"seguranca": 70, "futuro": 60, "solo": 50, "renda": 74, "final": 66},
      "porque": ["…", "…"],
      "como_fazer": ["…", "…", "…"]
    }
  ],
  "fora_da_janela": [],
  "pousio": {"texto": "Deixar parado: não depende de chuva, mas a terra fica descoberta de maio a setembro."},
  "plano_3_anos": {
    "normal": {"anos": ["milho_braquiaria", "crotalaria", "sorgo"]},
    "seco": {"anos": ["sorgo", "crotalaria", "sorgo"]}
  }
}
```
(`faixa` tem 20 booleanos, de 2006 a 2025.)

`GET /api/exemplo` devolve `talhao` + `recomendacao` juntos para a fazenda de exemplo.

Faça o mock devolver exatamente esse formato, para que trocar mock por HTTP não mude nenhuma tela.

### 8. Pronto quando

- Do início à resposta em **2 respostas e no máximo 4 toques**, no celular e no computador.
- "Ver um exemplo pronto" mostra a resposta em menos de 2 segundos.
- Trocar a colheita para "Fim de fevereiro ou março" muda a resposta para **Sorgo** e mostra o aviso de "Já não dá tempo".
- "Ouvir" lê a tela em português e em inglês.
- PT | EN traduz tudo.
- Sem rolagem horizontal em 360 px; no computador (1280 px) as telas usam duas colunas como descrito.
- Nenhuma nota de 0 a 100 aparece fora da tela 9.

---

## PROMPTS DE AJUSTE (use um por vez, se precisar)

1. **Se o mapa não carregar:** "O mapa da tela 2 não aparece. Use react-leaflet com `import 'leaflet/dist/leaflet.css'`, dê altura fixa ao contêiner do mapa e corrija o ícone padrão do marcador do Leaflet no Vite."
2. **Se o texto ficar técnico:** "Revise todos os textos das telas 1 a 5: frases de no máximo 12 palavras, linguagem simples para quem estudou até o ensino fundamental, sem siglas. As siglas dos dados só podem aparecer no 'Por quê?' e na tela 9."
3. **Se o computador ficar com espaço vazio:** "No computador (≥ 1024 px), aproveite a largura: telas 3, 4, 5 e 7 em duas colunas; tela 6 em grade de 3; tela 9 com as fontes em grade de 4. No celular continua tudo empilhado."
4. **Para ligar no backend:** "Defina `VITE_API_URL` e faça o repository HTTP chamar `/api/talhao` e `/api/recomendacao` com os parâmetros da URL. Se a chamada falhar, mostre a mensagem de erro calma e o botão da fazenda de exemplo. Não mude nenhuma tela."
5. **Botão Ouvir:** "Ao tocar em 'Ouvir', leia na ordem: título da tela, a resposta principal e os três sinais (chuva, dinheiro, terra). Use `speechSynthesis` com voz `pt-BR` (ou `en-US` no inglês), velocidade 0.95, e troque o botão para 'Parar' enquanto fala."
