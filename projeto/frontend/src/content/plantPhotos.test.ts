import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { GUIDE_PLANTS } from '../models/guide'
import { parseInline } from '../services/markdownService'
import { PLANT_PHOTO_CROPS, PLANT_PHOTOS, commonsPage, licenseLabel, plantPhotoProps } from './plantPhotos'

/** As fotos baixadas, como data URL (base64): dá para conferir o tipo e o tamanho sem rede e sem `fs`. */
const files = import.meta.glob<string>('/public/fotos/*', { query: '?inline', import: 'default', eager: true })
const bytes = (dataUrl: string) => Math.floor((dataUrl.split(',')[1].length * 3) / 4)

/** Todas as imagens, na ordem das culturas (o milho aparece em "Milho sozinho" e em "Milho com braquiária"). */
const allImages = () => PLANT_PHOTO_CROPS.flatMap((crop) => PLANT_PHOTOS[crop].images)

describe('fotos das plantas (tarefa 0055: Wikimedia Commons, baixadas para public/fotos)', () => {
  it('tem uma foto para cada cultura do culturas.yaml, nem mais nem menos', () => {
    expect([...PLANT_PHOTO_CROPS].sort()).toEqual([...GUIDE_PLANTS].sort())
  })

  it('cada imagem é um JPEG em public/fotos, com nome curto em ASCII e até 250 KB, sem arquivo sobrando', () => {
    const used = allImages().map((image) => image.src)

    for (const src of used) {
      expect(src).toMatch(/^\/fotos\/[a-z0-9-]+\.jpg$/)
      const data = files[`/public${src}`]
      expect(data, src).toBeDefined()
      // JPEG começa com FF D8 FF ("/9j/" em base64).
      expect(data.startsWith('data:image/jpeg;base64,/9j/'), src).toBe(true)
      expect(bytes(data), src).toBeLessThanOrEqual(250 * 1024)
    }
    expect(Object.keys(files).sort()).toEqual([...new Set(used)].map((src) => `/public${src}`).sort())
    // A mesma imagem em duas culturas (o milho) é o mesmo arquivo do Commons, com o mesmo autor e a mesma licença.
    for (const src of new Set(used)) {
      const same = allImages().filter((image) => image.src === src)
      expect(new Set(same.map((image) => `${image.file}|${image.author}|${image.license}`)).size, src).toBe(1)
    }
  })

  it('a licença de cada imagem foi conferida na página do Commons (15/11/2026)', () => {
    const table = PLANT_PHOTO_CROPS.map((crop) => [
      crop,
      ...PLANT_PHOTOS[crop].images.map((image) => [image.file, image.author, image.license]),
    ])

    expect(table).toEqual([
      [
        'milheto',
        [
          'Mahangu (pearl millet) field flourishing in the perfect climate in the rural north of Namibia.jpg',
          'Shikoha Tautiko',
          'CC BY-SA 4.0',
        ],
      ],
      [
        'milho_braquiaria',
        ['ZeaMays.jpg', 'Christian Fischer', 'CC BY-SA 3.0'],
        ['Strip of Brachiaria brizantha (signal grass).jpg', 'Ethan Bass', 'CC BY-SA 4.0'],
      ],
      ['pousio', ['Fallow Field - geograph.org.uk - 484462.jpg', 'Andy Beecroft', 'CC BY-SA 2.0']],
      ['sorgo', ['Cristalina GO Brasil - Plantação de sorgo, BR 040 - panoramio.jpg', 'Josue Marinho', 'CC BY 3.0']],
      ['milho_safrinha', ['ZeaMays.jpg', 'Christian Fischer', 'CC BY-SA 3.0']],
      ['crotalaria', ['Sunn Hemp Cover Crop.jpg', 'NRCS Pacific Islands Area', 'public-domain']],
    ])
  })

  it('só aceita CC BY, CC BY-SA (com a versão) ou domínio público', () => {
    for (const image of allImages()) {
      expect(image.license).toMatch(/^(CC BY(-SA)? \d\.\d|public-domain)$/)
    }
  })

  it('o link é a página do arquivo no Commons, com os caracteres especiais codificados', () => {
    expect(commonsPage('ZeaMays.jpg')).toBe('https://commons.wikimedia.org/wiki/File:ZeaMays.jpg')
    expect(commonsPage('Strip of Brachiaria brizantha (signal grass).jpg')).toBe(
      'https://commons.wikimedia.org/wiki/File:Strip_of_Brachiaria_brizantha_%28signal_grass%29.jpg',
    )
    expect(commonsPage('Cristalina GO Brasil - Plantação de sorgo, BR 040 - panoramio.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/File:Cristalina_GO_Brasil_-_Planta%C3%A7%C3%A3o_de_sorgo%2C_BR_040_-_panoramio.jpg',
    )
    for (const { file, page } of allImages()) {
      expect(page).toBe(commonsPage(file))
      // O link precisa sobreviver ao Markdown simples dos créditos.
      expect(parseInline(`[${file}](${page})`)).toEqual([{ type: 'link', text: file, href: page, external: true }])
    }
  })

  it('o domínio público aparece escrito em cada idioma; as licenças CC ficam iguais', () => {
    expect(licenseLabel('public-domain', 'pt')).toBe('Domínio público')
    expect(licenseLabel('public-domain', 'en')).toBe('Public domain')
    expect(licenseLabel('CC BY-SA 4.0', 'en')).toBe('CC BY-SA 4.0')
  })

  it('cada imagem tem um texto alternativo que descreve o que mostra, em pt e en', () => {
    for (const crop of PLANT_PHOTO_CROPS) {
      for (const image of PLANT_PHOTOS[crop].images) {
        for (const [lang, t] of [['pt', pt], ['en', en]] as const) {
          const alt = image.alt[lang]
          expect(alt.length, `${crop} ${lang}`).toBeGreaterThan(25)
          expect(alt).not.toBe(t.crops.names[crop])
          expect(alt).not.toMatch(/^(foto|imagem|photo|image)\b/i)
        }
      }
    }
  })

  it('milho com braquiária: o milho à esquerda (a mesma de "Milho sozinho") e a braquiária à direita, sem legenda', () => {
    const [left, right, ...rest] = PLANT_PHOTOS.milho_braquiaria.images
    expect(left).toBe(PLANT_PHOTOS.milho_safrinha.images[0])
    expect(right?.src).toBe('/fotos/braquiaria.jpg')
    expect(rest).toEqual([])
    // Só ela tem 2 imagens; nenhuma cultura tem mais a legenda "na foto: a braquiária".
    expect(PLANT_PHOTO_CROPS.filter((crop) => PLANT_PHOTOS[crop].images.length > 1)).toEqual(['milho_braquiaria'])
    expect(JSON.stringify(PLANT_PHOTOS)).not.toMatch(/na foto: a braquiária|photo shows the brachiaria/)
  })

  it('plantPhotoProps monta as props do PlantPhoto com o nome da cultura e o crédito de cada imagem no idioma', () => {
    expect(plantPhotoProps('milho_braquiaria', 'pt')).toEqual({
      images: [
        {
          src: '/fotos/milho.jpg',
          alt: PLANT_PHOTOS.milho_safrinha.images[0].alt.pt,
          author: 'Christian Fischer',
          license: 'CC BY-SA 3.0',
          href: commonsPage('ZeaMays.jpg'),
        },
        {
          src: '/fotos/braquiaria.jpg',
          alt: PLANT_PHOTOS.milho_braquiaria.images[1]?.alt.pt,
          author: 'Ethan Bass',
          license: 'CC BY-SA 4.0',
          href: commonsPage('Strip of Brachiaria brizantha (signal grass).jpg'),
        },
      ],
      name: pt.crops.names.milho_braquiaria,
      creditLabel: 'Foto',
      newTabLabel: '(abre em nova aba)',
    })

    const crotalaria = plantPhotoProps('crotalaria', 'en')
    expect(crotalaria.name).toBe(en.crops.names.crotalaria)
    expect(crotalaria).toMatchObject({ creditLabel: 'Photo', newTabLabel: '(opens in a new tab)' })
    expect(crotalaria.images).toHaveLength(1)
    expect(crotalaria.images[0].license).toBe('Public domain')
  })
})
