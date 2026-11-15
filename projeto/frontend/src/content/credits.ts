/**
 * Créditos e uso de IA (regra do NASA Space Apps: listar toda fonte, código, texto e imagem usados).
 * O mesmo conteúdo em todas as telas: o rodapé abre o modal global (`views/CreditsModal.tsx`).
 *
 * Fonte nova? Acrescente UMA linha no grupo certo, em pt e em en (o teste confere que os dois idiomas
 * têm os mesmos grupos e o mesmo número de linhas). Negrito com **…** e link com [texto](https://…), lidos
 * por `parseInline` (o link abre em nova aba). As linhas das fotos das plantas saem de `content/plantPhotos.ts`.
 */
import type { Lang } from '../i18n/language'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { PLANT_PHOTO_CROPS, PLANT_PHOTOS, licenseLabel } from './plantPhotos'

export type CreditGroup = {
  /** Igual nos dois idiomas. */
  id: 'nasa' | 'other' | 'code' | 'images' | 'photos'
  title: string
  lines: readonly string[]
}

export type CreditsContent = {
  title: string
  subtitle: string
  groups: readonly CreditGroup[]
  /** Quadro azul-claro "Uso de IA". */
  ai: { title: string; text: string }
  /** "(abre em nova aba)": vai escondido no fim de cada link, para leitor de tela. */
  newTab: string
}

const CROP_NAMES = { pt: pt.crops.names, en: en.crops.names }

/** Uma linha por foto: cultura (e a legenda), arquivo com link para o Commons, autor e licença. */
function photoLines(lang: Lang): string[] {
  return PLANT_PHOTO_CROPS.map((crop) => {
    const photo = PLANT_PHOTOS[crop]
    const caption = photo.caption ? ` (${photo.caption[lang]})` : ''
    return `**${CROP_NAMES[lang][crop]}**${caption} · [${photo.file}](${photo.page}) · ${photo.author} · ${licenseLabel(photo.license, lang)}`
  })
}

export const CREDITS: Record<Lang, CreditsContent> = {
  pt: {
    title: 'Créditos e uso de IA',
    subtitle: 'Tudo o que usamos para fazer o Raiz Orbital.',
    groups: [
      {
        id: 'nasa',
        title: 'Dados da NASA',
        lines: [
          '**GPM IMERG Final** · chuva de cada dia, 2005–2024',
          '**NASA POWER** · temperatura, umidade, vento e sol',
          '**NEX-GDDP-CMIP6** · clima de 2041–2060 (SSP2-4.5)',
          '**SMAP L4** · umidade da terra',
          '**MODIS** (NDVI pela ORNL DAAC, MCD64A1, MCD12Q1) · verde da lavoura, fogo e uso do solo',
        ],
      },
      {
        id: 'other',
        title: 'Outros dados',
        lines: [
          '**SoilGrids** (ISRIC, CC BY 4.0) · solo',
          '**NOAA CPC** · índice ONI e previsão de El Niño / La Niña',
          '**ZARC (MAPA) e Embrapa** · prazos e parâmetros das culturas',
          '**OpenStreetMap** (© colaboradores do OpenStreetMap, ODbL) · mapa e endereços',
          '**Photon** (komoot) · endereço aproximado do ponto marcado, com dados do OpenStreetMap',
        ],
      },
      {
        id: 'code',
        title: 'Código, fontes e ícones',
        lines: [
          'React, Vite, FastAPI, PostgreSQL e PostGIS (código aberto; lista completa no repositório)',
          '**Leaflet** (BSD-2-Clause) · mapa',
          'Fontes Inter e Space Grotesk (SIL Open Font License) · ícones Lucide (ISC)',
        ],
      },
      {
        id: 'images',
        title: 'Imagens',
        lines: [
          'Foto da lavoura na tela inicial: imagem gerada por IA no **Lovable**, não é uma foto real. Está marcada na própria tela.',
        ],
      },
      {
        id: 'photos',
        title: 'Fotos das plantas',
        lines: [
          'Fotos reais do **Wikimedia Commons**, só reduzidas (até 800 px de largura), sem outra alteração.',
          ...photoLines('pt'),
        ],
      },
    ],
    ai: {
      title: 'Uso de IA',
      text: 'Usamos **Claude** (Anthropic), **Gemini** (Google) e **Lovable** para ajudar a escrever código, textos, documentos e telas. Tudo foi revisado pelo time. Nenhum número das telas vem de IA: a conta é feita por regras fixas, com dados de satélite.',
    },
    newTab: '(abre em nova aba)',
  },
  en: {
    title: 'Credits and use of AI',
    subtitle: 'Everything we used to build Raiz Orbital.',
    groups: [
      {
        id: 'nasa',
        title: 'NASA data',
        lines: [
          '**GPM IMERG Final** · daily rainfall, 2005–2024',
          '**NASA POWER** · temperature, humidity, wind and sun',
          '**NEX-GDDP-CMIP6** · 2041–2060 climate (SSP2-4.5)',
          '**SMAP L4** · soil moisture',
          '**MODIS** (NDVI via ORNL DAAC, MCD64A1, MCD12Q1) · crop greenness, fire and land use',
        ],
      },
      {
        id: 'other',
        title: 'Other data',
        lines: [
          '**SoilGrids** (ISRIC, CC BY 4.0) · soil',
          '**NOAA CPC** · ONI index and El Niño / La Niña outlook',
          '**ZARC (MAPA) and Embrapa** · crop calendars and parameters',
          '**OpenStreetMap** (© OpenStreetMap contributors, ODbL) · map and addresses',
          '**Photon** (komoot) · approximate address of the marked spot, with OpenStreetMap data',
        ],
      },
      {
        id: 'code',
        title: 'Code, fonts and icons',
        lines: [
          'React, Vite, FastAPI, PostgreSQL and PostGIS (open source; full list in the repository)',
          '**Leaflet** (BSD-2-Clause) · map',
          'Inter and Space Grotesk fonts (SIL Open Font License) · Lucide icons (ISC)',
        ],
      },
      {
        id: 'images',
        title: 'Images',
        lines: [
          'Field photo on the home screen: AI-generated with **Lovable**, not a real photo. It is labeled on the screen.',
        ],
      },
      {
        id: 'photos',
        title: 'Plant photos',
        lines: [
          'Real photos from **Wikimedia Commons**, only resized (up to 800 px wide), with no other changes.',
          ...photoLines('en'),
        ],
      },
    ],
    ai: {
      title: 'Use of AI',
      text: 'We used **Claude** (Anthropic), **Gemini** (Google) and **Lovable** to help write code, text, documents and screens. Everything was reviewed by the team. No number on screen comes from AI: the math is done by fixed rules on satellite data.',
    },
    newTab: '(opens in a new tab)',
  },
}
