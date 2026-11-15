/**
 * Fotos reais das culturas (tarefa 0055), do Wikimedia Commons, baixadas para `public/fotos/` (sem link
 * direto para o Commons). Um arquivo só: a tela mostra a foto com o `PlantPhoto` do design system e o modal
 * "Créditos e uso de IA" lista cada foto (`content/credits.ts`), os dois lidos daqui.
 *
 * Licenças conferidas na página de cada arquivo no Commons em 15/11/2026 (tabela na tarefa 0055 do backend).
 * Só entra foto CC BY, CC BY-SA ou domínio público, sem logo nem marca. As fotos foram só reduzidas (até
 * 800 px de largura), sem outra alteração. Foto nova ou trocada? Confira a licença, baixe a miniatura do
 * Commons para `public/fotos/` (até 250 KB) e atualize a tabela da tarefa.
 */
import type { PlantPhotoProps } from '../design-system/components/PlantPhoto'
import type { Lang } from '../i18n/language'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { CropId } from '../models/recomendacao'

/** Licença como está na página do Commons (com a versão); domínio público é escrito no idioma. */
export type PhotoLicense = 'CC BY 3.0' | 'CC BY-SA 2.0' | 'CC BY-SA 3.0' | 'CC BY-SA 4.0' | 'public-domain'

export type PlantPhotoSource = {
  /** Caminho servido pelo Vite (arquivo em `public/fotos/`). */
  src: string
  /** Nome do arquivo no Wikimedia Commons. */
  file: string
  /** Página do arquivo no Commons (`commonsPage(file)`), aberta em nova aba. */
  page: string
  author: string
  license: PhotoLicense
  /** Texto alternativo: o que a foto mostra. */
  alt: Record<Lang, string>
  /** Legenda opcional, quando a foto não mostra a cultura inteira. */
  caption?: Record<Lang, string>
}

const TEXT: Record<Lang, { photo: string; newTab: string; publicDomain: string }> = {
  pt: { photo: 'Foto', newTab: '(abre em nova aba)', publicDomain: 'Domínio público' },
  en: { photo: 'Photo', newTab: '(opens in a new tab)', publicDomain: 'Public domain' },
}

const NAMES = { pt: pt.crops.names, en: en.crops.names }

/** Página do arquivo no Commons; parênteses também codificados, para o link sobreviver ao Markdown dos créditos. */
export function commonsPage(file: string): string {
  const title = encodeURIComponent(file.replaceAll(' ', '_')).replaceAll('(', '%28').replaceAll(')', '%29')
  return `https://commons.wikimedia.org/wiki/File:${title}`
}

export function licenseLabel(license: PhotoLicense, lang: Lang): string {
  return license === 'public-domain' ? TEXT[lang].publicDomain : license
}

function photo(source: Omit<PlantPhotoSource, 'page'>): PlantPhotoSource {
  return { ...source, page: commonsPage(source.file) }
}

/** Na ordem em que aparecem nos créditos. */
export const PLANT_PHOTOS: Record<CropId, PlantPhotoSource> = {
  milheto: photo({
    src: '/fotos/milheto.jpg',
    file: 'Mahangu (pearl millet) field flourishing in the perfect climate in the rural north of Namibia.jpg',
    author: 'Shikoha Tautiko',
    license: 'CC BY-SA 4.0',
    alt: {
      pt: 'Lavoura de milheto alta e verde, com nuvens de chuva escuras ao fundo',
      en: 'Tall green pearl millet field under dark rain clouds',
    },
  }),
  milho_braquiaria: photo({
    src: '/fotos/braquiaria.jpg',
    file: 'Strip of Brachiaria brizantha (signal grass).jpg',
    author: 'Ethan Bass',
    license: 'CC BY-SA 4.0',
    alt: {
      pt: 'Faixas de braquiária verde ao lado de pés de milho já secos',
      en: 'Strips of green brachiaria grass next to dry corn plants',
    },
    caption: { pt: 'na foto: a braquiária', en: 'photo shows the brachiaria' },
  }),
  pousio: photo({
    src: '/fotos/pousio.jpg',
    file: 'Fallow Field - geograph.org.uk - 484462.jpg',
    author: 'Andy Beecroft',
    license: 'CC BY-SA 2.0',
    alt: {
      pt: 'Campo parado, só com a palha da safra anterior e poças de chuva no chão',
      en: "Fallow field with only last season's stubble and rain puddles on the ground",
    },
  }),
  sorgo: photo({
    src: '/fotos/sorgo.jpg',
    file: 'Cristalina GO Brasil - Plantação de sorgo, BR 040 - panoramio.jpg',
    author: 'Josue Marinho',
    license: 'CC BY 3.0',
    alt: {
      pt: 'Lavoura de sorgo com os cachos de grão maduros, em Cristalina (GO)',
      en: 'Sorghum field with ripe grain heads in Cristalina, Goiás, Brazil',
    },
  }),
  milho_safrinha: photo({
    src: '/fotos/milho.jpg',
    file: 'ZeaMays.jpg',
    author: 'Christian Fischer',
    license: 'CC BY-SA 3.0',
    alt: {
      pt: 'Beira de uma lavoura de milho alto e verde, com os pendões no topo',
      en: 'Edge of a tall green corn field with tassels on top',
    },
  }),
  crotalaria: photo({
    src: '/fotos/crotalaria.jpg',
    file: 'Sunn Hemp Cover Crop.jpg',
    author: 'NRCS Pacific Islands Area',
    license: 'public-domain',
    alt: {
      pt: 'Crotalária alta e verde, com flores amarelas, plantada para cobrir a terra',
      en: 'Tall green sunn hemp (crotalaria) with yellow flowers, grown as a cover crop',
    },
  }),
}

export const PLANT_PHOTO_CROPS = Object.keys(PLANT_PHOTOS) as CropId[]

/** As props do `PlantPhoto` de uma cultura, no idioma (a tela só escolhe a altura). */
export function plantPhotoProps(crop: CropId, lang: Lang): Omit<PlantPhotoProps, 'height'> {
  const source = PLANT_PHOTOS[crop]
  return {
    src: source.src,
    alt: source.alt[lang],
    name: NAMES[lang][crop],
    caption: source.caption?.[lang],
    credit: {
      label: TEXT[lang].photo,
      author: source.author,
      license: licenseLabel(source.license, lang),
      href: source.page,
      newTabLabel: TEXT[lang].newTab,
    },
  }
}
