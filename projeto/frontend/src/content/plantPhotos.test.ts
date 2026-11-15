import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { GUIDE_PLANTS } from '../models/guide'
import { parseInline } from '../services/markdownService'
import { PLANT_PHOTO_CROPS, PLANT_PHOTOS, commonsPage, licenseLabel, plantPhotoProps } from './plantPhotos'

/** As fotos baixadas, como data URL (base64): dá para conferir o tipo e o tamanho sem rede e sem `fs`. */
const files = import.meta.glob<string>('/public/fotos/*', { query: '?inline', import: 'default', eager: true })
const bytes = (dataUrl: string) => Math.floor((dataUrl.split(',')[1].length * 3) / 4)

describe('fotos das plantas (tarefa 0055: Wikimedia Commons, baixadas para public/fotos)', () => {
  it('tem uma foto para cada cultura do culturas.yaml, nem mais nem menos', () => {
    expect([...PLANT_PHOTO_CROPS].sort()).toEqual([...GUIDE_PLANTS].sort())
  })

  it('cada foto é um JPEG em public/fotos, com nome curto em ASCII e até 250 KB, sem arquivo sobrando', () => {
    const used = PLANT_PHOTO_CROPS.map((crop) => PLANT_PHOTOS[crop].src)

    for (const src of used) {
      expect(src).toMatch(/^\/fotos\/[a-z0-9-]+\.jpg$/)
      const data = files[`/public${src}`]
      expect(data, src).toBeDefined()
      // JPEG começa com FF D8 FF ("/9j/" em base64).
      expect(data.startsWith('data:image/jpeg;base64,/9j/'), src).toBe(true)
      expect(bytes(data), src).toBeLessThanOrEqual(250 * 1024)
    }
    expect(Object.keys(files).sort()).toEqual(used.map((src) => `/public${src}`).sort())
    expect(new Set(used).size).toBe(used.length)
  })

  it('a licença de cada foto foi conferida na página do Commons (15/11/2026)', () => {
    const table = PLANT_PHOTO_CROPS.map((crop) => {
      const photo = PLANT_PHOTOS[crop]
      return [crop, photo.file, photo.author, photo.license]
    })

    expect(table).toEqual([
      [
        'milheto',
        'Mahangu (pearl millet) field flourishing in the perfect climate in the rural north of Namibia.jpg',
        'Shikoha Tautiko',
        'CC BY-SA 4.0',
      ],
      ['milho_braquiaria', 'Strip of Brachiaria brizantha (signal grass).jpg', 'Ethan Bass', 'CC BY-SA 4.0'],
      ['pousio', 'Fallow Field - geograph.org.uk - 484462.jpg', 'Andy Beecroft', 'CC BY-SA 2.0'],
      ['sorgo', 'Cristalina GO Brasil - Plantação de sorgo, BR 040 - panoramio.jpg', 'Josue Marinho', 'CC BY 3.0'],
      ['milho_safrinha', 'ZeaMays.jpg', 'Christian Fischer', 'CC BY-SA 3.0'],
      ['crotalaria', 'Sunn Hemp Cover Crop.jpg', 'NRCS Pacific Islands Area', 'public-domain'],
    ])
  })

  it('só aceita CC BY, CC BY-SA (com a versão) ou domínio público', () => {
    for (const crop of PLANT_PHOTO_CROPS) {
      expect(PLANT_PHOTOS[crop].license).toMatch(/^(CC BY(-SA)? \d\.\d|public-domain)$/)
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
    for (const crop of PLANT_PHOTO_CROPS) {
      const { file, page } = PLANT_PHOTOS[crop]
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

  it('cada foto tem um texto alternativo que descreve a imagem, em pt e en', () => {
    for (const crop of PLANT_PHOTO_CROPS) {
      for (const [lang, t] of [['pt', pt], ['en', en]] as const) {
        const alt = PLANT_PHOTOS[crop].alt[lang]
        expect(alt.length, `${crop} ${lang}`).toBeGreaterThan(25)
        expect(alt).not.toBe(t.crops.names[crop])
        expect(alt).not.toMatch(/^(foto|imagem|photo|image)\b/i)
      }
    }
  })

  it('só a braquiária tem legenda: a foto de "Milho com braquiária" mostra só o capim', () => {
    expect(PLANT_PHOTOS.milho_braquiaria.caption).toEqual({ pt: 'na foto: a braquiária', en: 'photo shows the brachiaria' })
    expect(PLANT_PHOTO_CROPS.filter((crop) => PLANT_PHOTOS[crop].caption)).toEqual(['milho_braquiaria'])
  })

  it('plantPhotoProps monta as props do PlantPhoto com o nome da cultura, o crédito e a legenda no idioma', () => {
    expect(plantPhotoProps('milho_braquiaria', 'pt')).toEqual({
      src: '/fotos/braquiaria.jpg',
      alt: PLANT_PHOTOS.milho_braquiaria.alt.pt,
      name: pt.crops.names.milho_braquiaria,
      caption: 'na foto: a braquiária',
      credit: {
        label: 'Foto',
        author: 'Ethan Bass',
        license: 'CC BY-SA 4.0',
        href: commonsPage('Strip of Brachiaria brizantha (signal grass).jpg'),
        newTabLabel: '(abre em nova aba)',
      },
    })

    const crotalaria = plantPhotoProps('crotalaria', 'en')
    expect(crotalaria.name).toBe(en.crops.names.crotalaria)
    expect(crotalaria.credit).toMatchObject({ label: 'Photo', license: 'Public domain', newTabLabel: '(opens in a new tab)' })
    expect(crotalaria.caption).toBeUndefined()
  })
})
