# Tarefa 0055: Fotos reais das plantas (Wikimedia Commons), o `PlantPhoto` e a seção nos créditos

- **Identificador:** `0055`
- **Título:** As 6 culturas ganham foto real do Wikimedia Commons, baixada para o repositório, com o crédito em cima da
  imagem e a seção "Fotos das plantas" no modal "Créditos e uso de IA"
- **Status:** Concluída
- **Prioridade:** Alta (pacote 2 de telas, pedido do time em 15/11/2026)
- **PRD:** sem requisito novo (a tela 5 vai usar as fotos; a regra do NASA Space Apps de listar toda imagem já vale)
- **Módulos Afetados:** só o front: `public/fotos/` (novo), `content/plantPhotos.ts` (novo),
  `design-system/components/PlantPhoto.tsx` (novo), `content/credits.ts`, `views/CreditsModal.tsx`,
  `views/DesignSystemView.tsx`, `design-system/tokens.css`, `i18n/messages.{pt,en}.ts` (só o bloco `designSystem`),
  `pages.tsx` (o idioma para a página `/design-system`) e `test/newTabName.ts`
- **Referências:** `tela-5-escolher-plano-prompt.md` (seção "Fotos das plantas"), `pacote-2-regras-gerais-prompt.md`
  (regra 10) e o protótipo `tela-5-escolher-plano.html` (fora do repositório); tarefa 0052 (modal de créditos)

---

## 1. Decisão

- As fotos ficam **no repositório** (`projeto/frontend/public/fotos/`), como o time pediu, e não com link direto
  para o Commons: a tela não depende de um site de fora e a licença fica registrada junto com o arquivo.
- Só entra foto **CC BY, CC BY-SA ou domínio público**, sem logo nem marca, conferida na página do arquivo no Commons.
- Um arquivo só guarda os dados das fotos (`content/plantPhotos.ts`); a tela e o modal de créditos leem dele.
- O `PlantImage` (desenho em SVG) continua nas telas de hoje. A tela 5 nova vai usar o `PlantPhoto`.

## 2. As 6 fotos (licenças conferidas em 15/11/2026)

Conferidas na página de cada arquivo e na API do Commons (`prop=imageinfo&iiprop=extmetadata`, que dá o autor, a
licença e o modelo da página). Nenhuma foto tem logo ou marca (conferido olhando cada uma).

| Cultura (id) | Arquivo no repositório | Arquivo no Commons (link) | Autor | Licença | Conferida em | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| Milheto (`milheto`) | `fotos/milheto.jpg` (800 × 450, 166 KB) | [Mahangu (pearl millet) field flourishing in the perfect climate in the rural north of Namibia.jpg](https://commons.wikimedia.org/wiki/File:Mahangu_%28pearl_millet%29_field_flourishing_in_the_perfect_climate_in_the_rural_north_of_Namibia.jpg) | Shikoha Tautiko | CC BY-SA 4.0 | 15/11/2026 | Igual ao pedido. |
| Milho com braquiária (`milho_braquiaria`) | `fotos/braquiaria.jpg` (800 × 939, 214 KB) | [Strip of Brachiaria brizantha (signal grass).jpg](https://commons.wikimedia.org/wiki/File:Strip_of_Brachiaria_brizantha_%28signal_grass%29.jpg) | Ethan Bass | CC BY-SA 4.0 | 15/11/2026 | Foto só da braquiária, com a legenda "na foto: a braquiária" / "photo shows the brachiaria". |
| Deixar parado (`pousio`) | `fotos/pousio.jpg` (640 × 480, 99 KB) | [Fallow Field - geograph.org.uk - 484462.jpg](https://commons.wikimedia.org/wiki/File:Fallow_Field_-_geograph.org.uk_-_484462.jpg) | Andy Beecroft | CC BY-SA 2.0 | 15/11/2026 | O original tem 640 px de largura: ficou no tamanho original. |
| Sorgo (`sorgo`) | `fotos/sorgo.jpg` (800 × 600, 186 KB) | [Cristalina GO Brasil - Plantação de sorgo, BR 040 - panoramio.jpg](https://commons.wikimedia.org/wiki/File:Cristalina_GO_Brasil_-_Planta%C3%A7%C3%A3o_de_sorgo%2C_BR_040_-_panoramio.jpg) | Josue Marinho | **CC BY 3.0** | 15/11/2026 | Era "a conferir". O protótipo dizia CC BY-SA 3.0; a página diz CC BY 3.0 (`{{cc-by-3.0\|Josue Marinho}}`, foto do Panoramio revisada). Mantida. |
| Milho sozinho (`milho_safrinha`) | `fotos/milho.jpg` (640 × 944, 224 KB) | [ZeaMays.jpg](https://commons.wikimedia.org/wiki/File:ZeaMays.jpg) | **Christian Fischer** | CC BY-SA 3.0 | 15/11/2026 | Era "a conferir". O pedido dizia "Fice", que é o nome de usuário; a licença pede a atribuição "Christian Fischer" (`{{cc-by-sa-3.0\|attribution=Christian Fischer}}`). Mantida, com o nome. Foto em pé: 640 px de largura para caber em 250 KB. |
| Crotalária (`crotalaria`) | `fotos/crotalaria.jpg` (800 × 600, 215 KB) | [Sunn Hemp Cover Crop.jpg](https://commons.wikimedia.org/wiki/File:Sunn_Hemp_Cover_Crop.jpg) | NRCS Pacific Islands Area | **Domínio público** | 15/11/2026 | Era "a conferir". Foto do USDA NRCS (governo dos EUA, `{{PD-USGov-USDA-NRCS}}`). Mantida. |

**Nenhuma foto foi trocada:** as três "a conferir" têm licença aceita. Só o crédito mudou em duas (sorgo e milho).

## 3. Como as fotos foram baixadas

- Só de `upload.wikimedia.org`, só imagens (nada foi executado).
- O `upload.wikimedia.org` não serve mais miniatura de 800 px (responde 400; só os tamanhos padrão, como 960 px).
  Baixamos a de 960 px (ou o original, quando era menor) e reduzimos para 800 px com o `sips` do macOS, com a
  qualidade do JPEG ajustada para cada foto ficar com até 250 KB. As 6 somam 1,1 MB.
- Reduzir é uma alteração: os créditos dizem "Fotos reais do Wikimedia Commons, só reduzidas (até 800 px de
  largura), sem outra alteração" (CC BY e CC BY-SA pedem para indicar alteração).

## 4. `content/plantPhotos.ts`

- `PLANT_PHOTOS`: para cada cultura do `culturas.yaml`, o `src` (`/fotos/<nome>.jpg`), o `file` e a `page` do
  Commons (`commonsPage(file)`, com espaço virando `_` e os parênteses codificados, para o link sobreviver ao
  Markdown dos créditos), o `author`, a `license` (`CC BY 3.0`, `CC BY-SA 2.0`, `CC BY-SA 3.0`, `CC BY-SA 4.0` ou
  `public-domain`), o `alt` descritivo e a `caption` opcional, em pt e en. A ordem do objeto é a ordem dos créditos.
- `licenseLabel(license, lang)`: "Domínio público" / "Public domain"; as CC ficam iguais.
- `plantPhotoProps(crop, lang)`: as props prontas do `PlantPhoto` (o nome da cultura vem de `crops.names` das
  mensagens). A tela só escolhe a altura: `<PlantPhoto {...plantPhotoProps('sorgo', lang)} height={120} />`.

## 5. `PlantPhoto` (design system)

```ts
type PlantPhotoProps = {
  src: string
  alt: string // o que a foto mostra
  name: string // nome da cultura, no bloco de quando a foto não carrega
  credit: { label: string; author: string; license: string; href: string; newTabLabel: string }
  caption?: string // ex.: "na foto: a braquiária"
  height?: number // px, padrão 150; a largura acompanha o contêiner
  className?: string // cantos e espaço, decididos pela tela (padrão: --radius-xs)
}
```

- `<figure>` com a altura pedida e a largura do contêiner (`max-width: 100%`, `min-width: 0`): nada de rolagem
  lateral em 360 px. A imagem é `object-fit: cover`, `loading="lazy"`.
- **Crédito em cima da foto**, embaixo: "Foto: autor · licença", uma linha só (reticências numa foto estreita, com o
  texto inteiro no `title`), sobre uma faixa escura (`--photo-credit-shade`: 55% de preto no ponto mais claro, o
  texto branco passa de 4,5:1 até sobre céu branco). O autor liga à página do Commons em nova aba
  (`target="_blank" rel="noopener"`), com " (abre em nova aba)" escondido para leitor de tela; o espaço fica dentro
  do texto escondido, para o sublinhado parar no nome (o Chrome lê "Ethan Bass (abre em nova aba)").
- **Legenda** opcional: pílula clara no canto de cima.
- **Se a imagem não carregar** (`onError`): bloco verde (`--photo-fallback`) com o nome da cultura, sem crédito e sem
  legenda. Outra foto no mesmo lugar tenta carregar de novo.
- Na página `/design-system`: as 6 fotos e um exemplo do bloco (uma foto que não existe), no idioma da página.

## 6. Créditos

- Grupo novo `photos` em `content/credits.ts`: "Fotos das plantas" / "Plant photos", com a nota das fotos reduzidas
  e uma linha por foto, montada do `plantPhotos.ts`: `**Cultura** (legenda) · [arquivo](página no Commons) · autor ·
  licença`.
- O `CreditsModal` passa a desenhar os links do `parseInline`: o de fora abre em nova aba, com o aviso escondido
  (`CreditsContent.newTab`: "(abre em nova aba)" / "(opens in a new tab)"). Nome de arquivo comprido quebra a linha
  (`overflow-wrap: anywhere`).

## 7. Testes e conferência

- TDD: cada comportamento com o teste antes, visto falhando: `content/plantPhotos.test.ts` (uma foto por cultura;
  cada uma é JPEG de verdade em `public/fotos`, até 250 KB, sem arquivo sobrando, lido com `import.meta.glob` e
  `?inline`, sem rede e sem `fs`; a tabela das licenças conferidas; só CC BY, CC BY-SA ou domínio público; o link do
  Commons; o `alt`; a legenda só na braquiária; o `plantPhotoProps`), `PlantPhoto.test.tsx`, `credits.test.ts`,
  `CreditsModal.test.tsx` e `DesignSystemView.test.tsx`.
- Front: 1127 testes passando; `npm run lint` sem erro (só o aviso antigo do `useMissionController`); `npm run build`
  passando (as fotos vão para `dist/fotos/`).
- Prints no Chrome (CDP): `/design-system` e o modal de créditos em 1280 px (pt e en) e em 360 px (pt), sem rolagem
  lateral; o nome acessível dos links conferido no Chrome.

## 8. Riscos e pendências

- A foto da crotalária é de *Crotalaria juncea* (o PRD usa *C. spectabilis*) e a da braquiária é *B. brizantha* (o
  milho com braquiária do PRD usa *B. ruziziensis*). As duas mostram o tipo de planta, mas não a espécie exata; se a
  agrônoma pedir, trocamos por uma foto da espécie certa (seguindo a seção 3).
- O crédito numa foto estreita (ex.: 54 px de altura na lista do plano) corta com reticências; o texto inteiro fica no
  `title`, no leitor de tela e no modal de créditos.
- As licenças foram conferidas em 15/11/2026. Se um arquivo mudar no Commons, a tabela da seção 2 e o
  `plantPhotos.ts` precisam ser revistos juntos.
